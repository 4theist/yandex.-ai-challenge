import axios from "axios";

const YANDEX_API_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

export interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

interface YandexRequest {
  modelUri: string;
  completionOptions: {
    stream: boolean;
    temperature: number;
    maxTokens: number;
  };
  messages: Message[];
}

interface YandexResponse {
  result: {
    alternatives: Array<{
      message: {
        role: string;
        text?: string;
      };
      status: string;
    }>;
    usage: {
      inputTextTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    modelVersion: string;
  };
}

export class YandexGPTService {
  private folderId: string;
  private apiKey: string;

  constructor() {
    this.folderId = process.env.YANDEX_FOLDER_ID || "";
    this.apiKey = process.env.YANDEX_API_KEY || "";

    if (!this.folderId || !this.apiKey) {
      throw new Error(
        "YANDEX_FOLDER_ID и YANDEX_API_KEY должны быть установлены в .env"
      );
    }
  }

  /**
   * Простая отправка сообщения с выбором модели
   */
  async sendMessage(
    model: "yandexgpt" | "yandexgpt-lite",
    message: string,
    temperature: number
  ): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    model: string;
  }> {
    const modelUri = `gpt://${this.folderId}/${model}/latest`;
    const startTime = Date.now();

    const requestBody: YandexRequest = {
      modelUri: modelUri,
      completionOptions: {
        stream: false,
        temperature: temperature,
        maxTokens: 2000,
      },
      messages: [
        {
          role: "user",
          text: message,
        },
      ],
    };

    try {
      const response = await axios.post<YandexResponse>(
        YANDEX_API_URL,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Api-Key ${this.apiKey}`,
            "x-folder-id": this.folderId,
          },
          timeout: 60000,
        }
      );

      const latencyMs = Date.now() - startTime;

      const text = response.data.result.alternatives[0]?.message?.text || "";
      const usage = response.data.result.usage;

      return {
        text,
        promptTokens: usage.inputTextTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0,
        latencyMs,
        model,
      };
    } catch (error: any) {
      console.error("[YANDEX API ERROR]", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      throw new Error(
        `Ошибка YandexGPT API: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }
}
