export interface ModelInfo {
  id: string;
  name: string;
  contextLimit: number;
  outputLimit?: number;
}

export const MODELS_CONFIG: {
  yandex: ModelInfo[];
  openrouter: ModelInfo[];
} = {
  yandex: [
    {
      id: "yandexgpt",
      name: "YandexGPT",
      contextLimit: 8000,
      outputLimit: 2000,
    },
    {
      id: "yandexgpt-lite",
      name: "YandexGPT Lite",
      contextLimit: 8000,
      outputLimit: 2000,
    },
  ],
  openrouter: [
    {
      id: "meta-llama/llama-4-maverick:free",
      name: "Llama 4 Maverick",
      contextLimit: 256000,
      outputLimit: 8192,
    },
    {
      id: "meta-llama/llama-4-scout:free",
      name: "Llama 4 Scout",
      contextLimit: 512000,
      outputLimit: 8192,
    },

    {
      id: "google/gemini-2.5-pro-exp-03-25:free",
      name: "Gemini 2.5 Pro Exp",
      contextLimit: 1000000,
      outputLimit: 8192,
    },

    {
      id: "tng/deepseek-r1t2-chimera:free",
      name: "DeepSeek R1T2 Chimera",
      contextLimit: 64000,
      outputLimit: 8000,
    },

    {
      id: "kwaipilot/kat-coder-pro-v1:free",
      name: "KAT-Coder-Pro V1",
      contextLimit: 32768,
      outputLimit: 4096,
    },

    {
      id: "zhipu/glm-4.5-air:free",
      name: "GLM 4.5 Air",
      contextLimit: 128000,
      outputLimit: 4096,
    },
    {
      id: "zhipu/glm-z1-32b:free",
      name: "GLM Z1 32B",
      contextLimit: 33000,
      outputLimit: 4096,
    },

    {
      id: "moonshot/kimi-k2:free",
      name: "Kimi K2",
      contextLimit: 33000,
      outputLimit: 4096,
    },

    {
      id: "mistralai/mistral-small-3.1-24b-instruct:free",
      name: "Mistral Small 3.1 24B",
      contextLimit: 128000,
      outputLimit: 4096,
    },
    {
      id: "cognitivecomputations/dolphin-3.0-mistral-24b:free",
      name: "Dolphin 3.0 Mistral 24B",
      contextLimit: 33000,
      outputLimit: 4096,
    },
  ],
};

// Функция получения информации о модели
export function getModelInfo(
  provider: "yandex" | "openrouter",
  modelId: string
): ModelInfo | undefined {
  const models = MODELS_CONFIG[provider];
  return models.find((m) => m.id === modelId);
}
