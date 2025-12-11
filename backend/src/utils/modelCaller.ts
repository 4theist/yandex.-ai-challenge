import { YandexGPTService } from "../services/yandexService";
import { OpenRouterService } from "../services/openRouterService";
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

export async function callModel(
  provider: "yandex" | "openrouter",
  model: string,
  message: string,
  temperature: number
): Promise<ModelResult> {
  const modelInfo = getModelInfo(provider, model);
  const contextLimit = modelInfo?.contextLimit || 8000;
  const outputLimit = modelInfo?.outputLimit || 2000;

  try {
    let result;

    if (provider === "yandex") {
      result = await getYandexService().sendMessage(
        model as "yandexgpt" | "yandexgpt-lite",
        message,
        temperature
      );
    } else {
      result = await getOpenRouterService().sendMessage(
        model,
        message,
        temperature
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
    console.error(`[${provider}/${model} ERROR]`, error.message);

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
        currency: "FREE",
        contextLimit,
        outputLimit,
        contextUsagePercent: 0,
        outputUsagePercent: 0,
      },
      error: errorMessage,
    };
  }
}
