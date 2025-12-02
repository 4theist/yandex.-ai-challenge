import axios from "axios";
import { calculatorTool, timeTool, searchTool } from "./tools";

const YANDEX_API_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

interface Message {
  role: "user" | "assistant" | "system";
  text?: string;
  toolCallList?: any;
  toolResultList?: any;
}

interface YandexRequest {
  modelUri: string;
  tools: any[];
  messages: Message[];
}

interface YandexResponse {
  result: {
    alternatives: Array<{
      message: {
        role: string;
        text?: string;
        toolCallList?: {
          toolCalls: Array<{
            functionCall: {
              name: string;
              arguments: any;
            };
          }>;
        };
      };
      status: string;
    }>;
    usage: any;
    modelVersion: string;
  };
}

export class YandexGPTService {
  private folderId: string;
  private apiKey: string;
  private modelUri: string;

  constructor() {
    this.folderId = process.env.YANDEX_FOLDER_ID || "";
    this.apiKey = process.env.YANDEX_API_KEY || "";
    this.modelUri = `gpt://${this.folderId}/yandexgpt/latest`;

    if (!this.folderId || !this.apiKey) {
      throw new Error(
        "YANDEX_FOLDER_ID и YANDEX_API_KEY должны быть установлены в .env"
      );
    }
  }

  async sendRequest(messages: Message[]): Promise<YandexResponse> {
    const requestBody: YandexRequest = {
      modelUri: this.modelUri,
      tools: [calculatorTool, timeTool, searchTool],
      messages,
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
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(
        "YandexGPT API Error:",
        error.response?.data || error.message
      );
      throw new Error("Ошибка при обращении к YandexGPT API");
    }
  }
}
