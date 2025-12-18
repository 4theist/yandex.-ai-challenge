import axios from "axios";

const YANDEX_API_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

export interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

export interface ToolCall {
  id?: string;
  type: "function";
  function: {
    name: string;
    arguments: any;
  };
}

interface YandexRequest {
  modelUri: string;
  completionOptions: {
    stream: boolean;
    temperature: number;
    maxTokens: number;
  };
  messages: Message[];
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
   * Отправка сообщения с полным контролем параметров
   * @param model - ID модели ('yandexgpt' | 'yandexgpt-lite')
   * @param message - Сообщение пользователя или массив сообщений для диалога
   * @param temperature - Температура генерации (0-1.2)
   * @param systemPrompt - Системный промпт (опционально)
   * @param maxTokens - Максимум токенов в ответе (по умолчанию 2000)
   * @param tools - Массив инструментов для function calling (опционально)
   */
  async sendMessage(
    model: "yandexgpt" | "yandexgpt-lite",
    message: string | Message[],
    temperature: number = 0.6,
    systemPrompt?: string,
    maxTokens: number = 2000,
    tools?: any[]
  ): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    model: string;
    toolCalls?: ToolCall[];
  }> {
    const modelUri = `gpt://${this.folderId}/${model}/latest`;
    const startTime = Date.now();

    // Формируем массив сообщений
    let messages: Message[];
    if (typeof message === "string") {
      // Простое сообщение - конвертируем в массив
      messages = [];

      // Добавляем system prompt если передан
      if (systemPrompt) {
        messages.push({
          role: "system",
          text: systemPrompt,
        });
      }

      // Добавляем сообщение пользователя
      messages.push({
        role: "user",
        text: message,
      });
    } else {
      // Уже массив сообщений (для диалогов)
      messages = [...message];

      // Добавляем system prompt в начало если передан и его там нет
      if (systemPrompt) {
        const hasSystemPrompt = messages.some((m) => m.role === "system");
        if (!hasSystemPrompt) {
          messages.unshift({
            role: "system",
            text: systemPrompt,
          });
        }
      }
    }

    const requestBody: YandexRequest = {
      modelUri: modelUri,
      completionOptions: {
        stream: false,
        temperature: temperature,
        maxTokens: maxTokens,
      },
      messages,
    };

    // Добавляем tools если переданы
    if (tools && tools.length > 0) {
      // Конвертируем в формат YandexGPT
      requestBody.tools = tools.map((tool) => ({
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));
    }

    console.log(`[YANDEX] Calling ${model}`, {
      temperature,
      maxTokens,
      messagesCount: messages.length,
      hasSystemPrompt: messages.some((m) => m.role === "system"),
      toolsCount: requestBody.tools?.length || 0,
    });

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
      const alternative = response.data.result.alternatives[0];

      // Логируем сырой ответ для отладки
      console.log(
        "[YANDEX RAW RESPONSE]",
        JSON.stringify(alternative, null, 2)
      );

      const text = alternative?.message?.text || "";

      // Парсим tool calls из Yandex формата
      let toolCalls: ToolCall[] | undefined;
      const yandexToolCalls = alternative?.message?.toolCallList?.toolCalls;

      if (yandexToolCalls && yandexToolCalls.length > 0) {
        toolCalls = yandexToolCalls.map((tc: any, index: number) => ({
          id: `yandex_${index}`,
          type: "function" as const,
          function: {
            name: tc.functionCall.name,
            arguments: tc.functionCall.arguments,
          },
        }));
      }

      const usage = response.data.result.usage;

      console.log(`[YANDEX SUCCESS]`, {
        model,
        latencyMs,
        tokens: usage.totalTokens,
        hasToolCalls: !!toolCalls,
        toolCallsCount: toolCalls?.length || 0,
      });

      return {
        text,
        promptTokens: usage.inputTextTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0,
        latencyMs,
        model,
        toolCalls,
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

  /**
   * Отправка диалога с контекстом (для continuous диалогов)
   * @param model - ID модели
   * @param messages - Массив сообщений диалога
   * @param temperature - Температура
   * @param systemPrompt - Системный промпт (опционально)
   * @param maxTokens - Максимум токенов
   * @param tools - Инструменты для function calling
   */
  async sendDialog(
    model: "yandexgpt" | "yandexgpt-lite",
    messages: Message[],
    temperature: number = 0.6,
    systemPrompt?: string,
    maxTokens: number = 2000,
    tools?: any[]
  ) {
    return this.sendMessage(
      model,
      messages,
      temperature,
      systemPrompt,
      maxTokens,
      tools
    );
  }
}
