export interface ModelConfig {
  id: string;
  name: string;
  contextLimit: number;
  outputLimit?: number;
}

export interface ModelsConfig {
  yandex: ModelConfig[];
  openrouter: ModelConfig[];
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

export interface CompareResponse {
  results: [ModelResult, ModelResult];
  timestamp: string;
}
