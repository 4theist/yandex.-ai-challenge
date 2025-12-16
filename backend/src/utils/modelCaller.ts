import "../config/env";

import {
  YandexGPTService,
  Message as YandexMessage,
} from "../services/yandexService";
import {
  OpenRouterService,
  Message as OpenRouterMessage,
} from "../services/openRouterService";
import { calculateCost } from "./pricing";
import { getModelInfo } from "../config/models";

let yandexService: YandexGPTService | null = null;
let openRouterService: OpenRouterService | null = null;

function getYandexService() {
  if (!yandexService) {
    yandexService = new YandexGPTService();
  }
  return yandexService;
}

function getOpenRouterService() {
  if (!openRouterService) {
    openRouterService = new OpenRouterService();
  }
  return openRouterService;
}

export interface ModelCallOptions {
  systemPrompt?: string;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ModelResult {
  provider: string;
  model: string;
  text: string;
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
 * @param options - Дополнительные опции (systemPrompt, maxTokens и т.д.)
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
  });

  try {
    let result;

    if (provider === "yandex") {
      // Конвертируем сообщения в формат Yandex если это массив
      let yandexMessage: string | YandexMessage[];

      if (typeof message === "string") {
        yandexMessage = message;
      } else {
        // Конвертируем OpenRouter формат в Yandex формат
        yandexMessage = message.map((msg: any) => ({
          role: msg.role,
          text: msg.content || msg.text,
        }));
      }

      result = await getYandexService().sendMessage(
        model as "yandexgpt" | "yandexgpt-lite",
        yandexMessage,
        temperature,
        options?.systemPrompt,
        options?.maxTokens
      );
    } else {
      // OpenRouter
      let openRouterMessage: string | OpenRouterMessage[];

      if (typeof message === "string") {
        openRouterMessage = message;
      } else {
        // Конвертируем Yandex формат в OpenRouter формат
        openRouterMessage = message.map((msg: any) => ({
          role: msg.role,
          content: msg.text || msg.content,
        }));
      }

      result = await getOpenRouterService().sendMessage(
        model,
        openRouterMessage,
        temperature,
        options?.systemPrompt,
        options?.maxTokens,
        options?.topP,
        options?.frequencyPenalty,
        options?.presencePenalty
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
    });

    return {
      provider,
      model,
      text: result.text,
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
