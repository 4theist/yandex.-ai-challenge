import type { LLMMessage } from "../services/llm/baseLLMService";

/**
 * Yandex-специфичный формат сообщения (использует "text")
 */
export interface YandexMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

/**
 * OpenRouter-специфичный формат сообщения (использует "content")
 */
export interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Универсальное сообщение с обоими полями (для входящих данных)
 */
export interface AnyMessage {
  role: string;
  content?: string;
  text?: string;
}

export class MessageConverter {
  /**
   * Нормализация любого формата сообщения в LLMMessage
   * Обрабатывает как text, так и content поля
   */
  static normalize(message: string | AnyMessage[]): string | LLMMessage[] {
    if (typeof message === "string") {
      return message;
    }

    return message.map((msg: AnyMessage) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content || msg.text || "",
    }));
  }

  /**
   * Конвертация LLMMessage в формат Yandex (content → text)
   */
  static toYandexFormat(messages: LLMMessage[]): YandexMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      text: msg.content,
    }));
  }

  /**
   * Конвертация LLMMessage в формат OpenRouter (content → content)
   */
  static toOpenRouterFormat(messages: LLMMessage[]): OpenRouterMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Конвертация Yandex формата в LLMMessage (text → content)
   */
  static fromYandexFormat(messages: YandexMessage[]): LLMMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.text,
    }));
  }

  /**
   * Конвертация OpenRouter формата в LLMMessage (content → content)
   */
  static fromOpenRouterFormat(messages: OpenRouterMessage[]): LLMMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}
