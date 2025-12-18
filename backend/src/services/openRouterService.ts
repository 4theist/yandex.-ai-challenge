import axios from "axios";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  id?: string;
  type: "function";
  function: {
    name: string;
    arguments: any;
  };
}

interface OpenRouterRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: any[];
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private apiKey: string;
  private baseURL = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY должен быть установлен в .env");
    }
  }

  /**
   * Отправка сообщения с полным контролем параметров
   * @param model - ID модели OpenRouter
   * @param message - Сообщение пользователя или массив сообщений для диалога
   * @param temperature - Температура генерации (0-2)
   * @param systemPrompt - Системный промпт (опционально)
   * @param maxTokens - Максимум токенов в ответе (опционально)
   * @param topP - Top-p sampling (опционально)
   * @param frequencyPenalty - Штраф за повторения (опционально)
   * @param presencePenalty - Штраф за присутствие (опционально)
   * @param tools - Массив инструментов для function calling (опционально)
   */
  async sendMessage(
    model: string,
    message: string | Message[],
    temperature: number = 0.6,
    systemPrompt?: string,
    maxTokens?: number,
    topP?: number,
    frequencyPenalty?: number,
    presencePenalty?: number,
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
          content: systemPrompt,
        });
      }

      // Добавляем сообщение пользователя
      messages.push({
        role: "user",
        content: message,
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
            content: systemPrompt,
          });
        }
      }
    }

    const requestBody: OpenRouterRequest = {
      model: model,
      messages: messages,
      temperature: temperature,
    };

    // Добавляем опциональные параметры только если они переданы
    if (maxTokens !== undefined) {
      requestBody.max_tokens = maxTokens;
    }

    if (topP !== undefined) {
      requestBody.top_p = topP;
    }

    if (frequencyPenalty !== undefined) {
      requestBody.frequency_penalty = frequencyPenalty;
    }

    if (presencePenalty !== undefined) {
      requestBody.presence_penalty = presencePenalty;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    console.log(`[OPENROUTER] Calling ${model}`, {
      temperature,
      maxTokens,
      messagesCount: messages.length,
      hasSystemPrompt: messages.some((m) => m.role === "system"),
      toolsCount: requestBody.tools?.length || 0,
    });

    try {
      const response = await axios.post<OpenRouterResponse>(
        this.baseURL,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Models Comparison",
            "Content-Type": "application/json",
          },
          timeout: 90000,
        }
      );

      const latencyMs = Date.now() - startTime;
      const choice = response.data.choices[0];
      const text = choice?.message?.content || "";
      const usage = response.data.usage;

      let toolCalls: ToolCall[] | undefined;
      if (choice?.message?.tool_calls) {
        toolCalls = choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          },
        }));
      }

      console.log(`[OPENROUTER SUCCESS]`, {
        model,
        latencyMs,
        tokens: usage.total_tokens,
        hasToolCalls: !!toolCalls,
        toolCallsCount: toolCalls?.length || 0,
      });

      return {
        text,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        latencyMs,
        model: response.data.model,
        toolCalls,
      };
    } catch (error: any) {
      console.error("[OPENROUTER API ERROR]", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message;

      throw new Error(`OpenRouter API error: ${errorMessage}`);
    }
  }

  /**
   * Отправка диалога с контекстом (для continuous диалогов)
   * @param model - ID модели
   * @param messages - Массив сообщений диалога
   * @param temperature - Температура
   * @param systemPrompt - Системный промпт (опционально)
   * @param maxTokens - Максимум токенов
   * @param topP - Top-p sampling
   * @param frequencyPenalty - Штраф за повторения
   * @param presencePenalty - Штраф за присутствие
   * @param tools - Инструменты для function calling
   */
  async sendDialog(
    model: string,
    messages: Message[],
    temperature: number = 0.6,
    systemPrompt?: string,
    maxTokens?: number,
    topP?: number,
    frequencyPenalty?: number,
    presencePenalty?: number,
    tools?: any[]
  ) {
    return this.sendMessage(
      model,
      messages,
      temperature,
      systemPrompt,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      tools
    );
  }

  /**
   * Получить список доступных моделей OpenRouter
   */
  async getAvailableModels(): Promise<any> {
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.data.data;
    } catch (error: any) {
      console.error("[OPENROUTER GET MODELS ERROR]", error.message);
      throw new Error("Не удалось получить список моделей");
    }
  }
}
