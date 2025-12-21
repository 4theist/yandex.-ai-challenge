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

// OpenRouter-специфичный формат сообщения
interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
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

export class OpenRouterService extends BaseLLMService {
  private apiKey: string;
  private baseURL = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    super();
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.validateConfig();
  }

  protected getProviderName(): string {
    return "OPENROUTER";
  }

  protected validateConfig(): void {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY должен быть установлен в .env");
    }
  }

  /**
   * Парсинг tool calls из OpenRouter формата
   */
  private parseToolCalls(choice: any): ToolCall[] | undefined {
    if (!choice?.message?.tool_calls) {
      return undefined;
    }

    return choice.message.tool_calls.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      },
    }));
  }

  protected async sendRequest(
    model: string,
    messages: LLMMessage[],
    options: SendMessageOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    const requestBody: OpenRouterRequest = {
      model,
      messages: MessageConverter.toOpenRouterFormat(messages),
      temperature: options.temperature || CONFIG.LLM.DEFAULT_TEMPERATURE,
    };

    // Добавляем опциональные параметры
    if (options.maxTokens !== undefined) {
      requestBody.max_tokens = options.maxTokens;
    }
    if (options.topP !== undefined) {
      requestBody.top_p = options.topP;
    }
    if (options.frequencyPenalty !== undefined) {
      requestBody.frequency_penalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      requestBody.presence_penalty = options.presencePenalty;
    }
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }

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
    const toolCalls = this.parseToolCalls(choice);

    return {
      text,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      latencyMs,
      model: response.data.model,
      toolCalls,
    };
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
