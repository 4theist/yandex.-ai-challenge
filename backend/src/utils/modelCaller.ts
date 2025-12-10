import { YandexGPTService } from "../services/yandexService";
import { OpenRouterService } from "../services/openRouterService";
import { calculateCost } from "./pricing";

// Ленивая инициализация - создаём только при первом вызове
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
  };
}

export async function callModel(
  provider: "yandex" | "openrouter",
  model: string,
  message: string,
  temperature: number
): Promise<ModelResult> {
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
    },
  };
}
