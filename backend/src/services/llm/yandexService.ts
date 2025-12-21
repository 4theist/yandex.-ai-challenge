import axios from "axios";
import {
  BaseLLMService,
  LLMMessage,
  LLMResponse,
  SendMessageOptions,
  ToolCall,
} from "./baseLLMService";
import { MessageConverter } from "../../utils/messageConverter";
import { CONFIG } from "../../config/defaults";

const YANDEX_API_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

// Yandex-специфичный формат сообщения
interface YandexMessage {
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
  messages: YandexMessage[];
  tools?: any[];
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
    usage: {
      inputTextTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    modelVersion: string;
  };
}

export class YandexGPTService extends BaseLLMService {
  private folderId: string;
  private apiKey: string;

  constructor() {
    super();
    this.folderId = process.env.YANDEX_FOLDER_ID || "";
    this.apiKey = process.env.YANDEX_API_KEY || "";
    this.validateConfig();
  }

  protected getProviderName(): string {
    return "YANDEX";
  }

  protected validateConfig(): void {
    if (!this.folderId || !this.apiKey) {
      throw new Error(
        "YANDEX_FOLDER_ID и YANDEX_API_KEY должны быть установлены в .env"
      );
    }
  }

  /**
   * Конвертация инструментов в формат Yandex
   */
  private convertTools(tools?: any[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    return tools.map((tool) => ({
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Парсинг tool calls из Yandex формата
   */
  private parseToolCalls(alternative: any): ToolCall[] | undefined {
    const yandexToolCalls = alternative?.message?.toolCallList?.toolCalls;

    if (!yandexToolCalls || yandexToolCalls.length === 0) {
      return undefined;
    }

    return yandexToolCalls.map((tc: any, index: number) => ({
      id: `yandex_${index}`,
      type: "function" as const,
      function: {
        name: tc.functionCall.name,
        arguments: tc.functionCall.arguments,
      },
    }));
  }

  protected async sendRequest(
    model: string,
    messages: LLMMessage[],
    options: SendMessageOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const modelUri = `gpt://${this.folderId}/${model}/latest`;

    const requestBody: YandexRequest = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: options.temperature || CONFIG.LLM.DEFAULT_TEMPERATURE,
        maxTokens: options.maxTokens || CONFIG.LLM.DEFAULT_MAX_TOKENS,
      },
      messages: MessageConverter.toYandexFormat(messages),
    };

    // Добавляем tools если переданы
    const convertedTools = this.convertTools(options.tools);
    if (convertedTools) {
      requestBody.tools = convertedTools;
    }

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
    const alternative = response.data.result.alternatives[0];

    // Логируем сырой ответ для отладки
    console.log(
      "[YANDEX RAW RESPONSE]",
      JSON.stringify(alternative, null, 2)
    );

    const text = alternative?.message?.text || "";
    const toolCalls = this.parseToolCalls(alternative);
    const usage = response.data.result.usage;

    return {
      text,
      promptTokens: usage.inputTextTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0,
      latencyMs,
      model,
      toolCalls,
    };
  }
}
