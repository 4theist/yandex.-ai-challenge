/**
 * Базовый абстрактный класс для LLM-сервисов
 * Содержит общую логику для работы с различными провайдерами
 */

import { CONFIG } from "../../config/defaults";

export interface LLMMessage {
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

export interface LLMResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  model: string;
  toolCalls?: ToolCall[];
}

export interface SendMessageOptions {
  temperature?: number;
  systemPrompt?: string;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tools?: any[];
}

/**
 * Абстрактный базовый класс для всех LLM-сервисов
 */
export abstract class BaseLLMService {
  /**
   * Имя провайдера для логирования
   */
  protected abstract getProviderName(): string;

  /**
   * Валидация конфигурации провайдера
   */
  protected abstract validateConfig(): void;

  /**
   * Отправка запроса к API провайдера
   */
  protected abstract sendRequest(
    model: string,
    messages: LLMMessage[],
    options: SendMessageOptions
  ): Promise<LLMResponse>;

  /**
   * Форматирование массива сообщений с добавлением system prompt
   * Общая логика для всех провайдеров
   */
  protected formatMessages(
    message: string | LLMMessage[],
    systemPrompt?: string
  ): LLMMessage[] {
    let messages: LLMMessage[];

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

    return messages;
  }

  /**
   * Логирование запроса
   */
  protected logRequest(
    model: string,
    messagesCount: number,
    options: SendMessageOptions
  ): void {
    console.log(`[${this.getProviderName()}] Calling ${model}`, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      messagesCount,
      hasSystemPrompt: options.systemPrompt !== undefined,
      toolsCount: options.tools?.length || 0,
    });
  }

  /**
   * Логирование успешного ответа
   */
  protected logSuccess(
    model: string,
    latencyMs: number,
    tokens: number,
    toolCalls?: ToolCall[]
  ): void {
    console.log(`[${this.getProviderName()} SUCCESS]`, {
      model,
      latencyMs,
      tokens,
      hasToolCalls: !!toolCalls,
      toolCallsCount: toolCalls?.length || 0,
    });
  }

  /**
   * Логирование ошибки
   */
  protected logError(error: any): void {
    console.error(`[${this.getProviderName()} API ERROR]`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
  }

  /**
   * Основной метод отправки сообщения
   * Используется всеми наследниками
   */
  async sendMessage(
    model: string,
    message: string | LLMMessage[],
    options: SendMessageOptions = {}
  ): Promise<LLMResponse> {
    // Устанавливаем дефолтные значения
    const fullOptions: SendMessageOptions = {
      temperature: CONFIG.LLM.DEFAULT_TEMPERATURE,
      ...options,
    };

    // Форматируем сообщения
    const messages = this.formatMessages(message, fullOptions.systemPrompt);

    // Логируем запрос
    this.logRequest(model, messages.length, fullOptions);

    try {
      // Отправляем запрос через реализацию провайдера
      const response = await this.sendRequest(model, messages, fullOptions);

      // Логируем успех
      this.logSuccess(
        response.model,
        response.latencyMs,
        response.totalTokens,
        response.toolCalls
      );

      return response;
    } catch (error: any) {
      this.logError(error);
      throw error;
    }
  }

  /**
   * Отправка диалога с контекстом
   * Обёртка над sendMessage для удобства
   */
  async sendDialog(
    model: string,
    messages: LLMMessage[],
    options: SendMessageOptions = {}
  ): Promise<LLMResponse> {
    return this.sendMessage(model, messages, options);
  }
}
