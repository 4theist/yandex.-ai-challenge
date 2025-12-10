export interface ModelConfig {
  id: string;
  name: string;
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
  };
}

export interface CompareResponse {
  results: [ModelResult, ModelResult];
  timestamp: string;
}
