import "../config/env";

import type { LLMMessage } from "../services/llm/baseLLMService";
import { getYandexService, getOpenRouterService } from "./serviceFactory";
import { calculateCost } from "./pricing";
import { getModelInfo } from "../config/models";
import { MessageConverter } from "./messageConverter";

// ← ДОБАВЛЕНО: интерфейс для tool calls
export interface ToolCall {
  id?: string;
  type: "function";
  function: {
    name: string;
    arguments: any;
  };
}

export interface ModelCallOptions {
  systemPrompt?: string;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tools?: any[]; // ← ДОБАВЛЕНО: массив инструментов
}

export interface ModelResult {
  provider: string;
  model: string;
  text: string;
  toolCalls?: ToolCall[]; // ← ДОБАВЛЕНО: tool calls из ответа модели
  metrics: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    currency: "₽" | "FREE";
    contextLimit: number;
    outputLimit: number;
    contextUsagePercent: number;
    outputUsagePercent: number;
  };
  warning?: string;
  error?: string;
}

/**
 * Вызов модели с полным контролем параметров
 * @param provider - Провайдер (yandex | openrouter)
 * @param model - ID модели
 * @param message - Сообщение или массив сообщений для диалога
 * @param temperature - Температура генерации
 * @param options - Дополнительные опции (systemPrompt, maxTokens, tools и т.д.)
 */
export async function callModel(
  provider: "yandex" | "openrouter",
  model: string,
  message: string | any[],
  temperature: number,
  options?: ModelCallOptions
): Promise<ModelResult> {
  const modelInfo = getModelInfo(provider, model);
  const contextLimit = modelInfo?.contextLimit || 8000;
  const outputLimit = modelInfo?.outputLimit || 2000;

  console.log(`[MODEL CALLER] ${provider}/${model}`, {
    temperature,
    hasSystemPrompt: !!options?.systemPrompt,
    maxTokens: options?.maxTokens,
    hasTools: !!options?.tools, // ← ДОБАВЛЕНО
    toolsCount: options?.tools?.length || 0, // ← ДОБАВЛЕНО
  });

  try {
    let result;

    // Нормализуем сообщения в унифицированный формат
    const convertedMessage = MessageConverter.normalize(message);

    if (provider === "yandex") {
      result = await getYandexService().sendMessage(
        model as "yandexgpt" | "yandexgpt-lite",
        convertedMessage,
        {
          temperature,
          systemPrompt: options?.systemPrompt,
          maxTokens: options?.maxTokens,
          tools: options?.tools,
        }
      );
      console.log(
        "[MODEL CALLER] Tools being sent:",
        JSON.stringify(options?.tools, null, 2)
      );
    } else {
      // OpenRouter
      result = await getOpenRouterService().sendMessage(
        model,
        convertedMessage,
        {
          temperature,
          systemPrompt: options?.systemPrompt,
          maxTokens: options?.maxTokens,
          topP: options?.topP,
          frequencyPenalty: options?.frequencyPenalty,
          presencePenalty: options?.presencePenalty,
          tools: options?.tools,
        }
      );
    }

    const { cost, currency } = calculateCost(
      model,
      result.promptTokens,
      result.completionTokens
    );

    // Подсчёт использования в процентах
    const contextUsagePercent = Math.round(
      (result.promptTokens / contextLimit) * 100
    );
    const outputUsagePercent = Math.round(
      (result.completionTokens / outputLimit) * 100
    );

    // Проверка на предупреждения
    let warning: string | undefined;
    if (contextUsagePercent > 80) {
      warning = `Использовано ${contextUsagePercent}% лимита контекста (${result.promptTokens}/${contextLimit} токенов)`;
    } else if (outputUsagePercent > 80) {
      warning = `Использовано ${outputUsagePercent}% лимита ответа (${result.completionTokens}/${outputLimit} токенов)`;
    }

    console.log(`[MODEL CALLER SUCCESS]`, {
      provider,
      model,
      tokens: result.totalTokens,
      cost: `${cost} ${currency}`,
      toolCalls: result.toolCalls?.length || 0, // ← ДОБАВЛЕНО
    });

    return {
      provider,
      model,
      text: result.text,
      toolCalls: result.toolCalls, // ← ДОБАВЛЕНО: возвращаем tool calls
      metrics: {
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        cost,
        currency,
        contextLimit,
        outputLimit,
        contextUsagePercent,
        outputUsagePercent,
      },
      warning,
    };
  } catch (error: any) {
    console.error(`[MODEL CALLER ERROR] ${provider}/${model}:`, error.message);

    // Определяем тип ошибки
    let errorMessage = error.message;
    if (
      error.message.includes("context_length_exceeded") ||
      error.message.includes("maximum context length") ||
      error.message.includes("too many tokens")
    ) {
      errorMessage = `❌ Превышен лимит токенов модели (максимум: ${contextLimit})`;
    }

    return {
      provider,
      model,
      text: "",
      metrics: {
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        currency: provider === "yandex" ? "₽" : "FREE",
        contextLimit,
        outputLimit,
        contextUsagePercent: 0,
        outputUsagePercent: 0,
      },
      error: errorMessage,
    };
  }
}

/**
 * Вызов модели для диалога (с массивом сообщений)
 * @param provider - Провайдер
 * @param model - ID модели
 * @param messages - Массив сообщений диалога
 * @param temperature - Температура
 * @param options - Дополнительные опции
 */
export async function callModelDialog(
  provider: "yandex" | "openrouter",
  model: string,
  messages: any[],
  temperature: number,
  options?: ModelCallOptions
): Promise<ModelResult> {
  return callModel(provider, model, messages, temperature, options);
}
