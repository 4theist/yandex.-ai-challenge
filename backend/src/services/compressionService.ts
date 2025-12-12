import { Message, Summary } from "./sessionManager";
import { YandexGPTService } from "./yandexService";
import { OpenRouterService } from "./openRouterService";

let yandexService: YandexGPTService | null = null;
let openRouterService: OpenRouterService | null = null;

function getYandexService() {
  if (!yandexService) {
    yandexService = new YandexGPTService();
  }
  return yandexService;
}

function getOpenRouterService() {
  if (!openRouterService) {
    openRouterService = new OpenRouterService();
  }
  return openRouterService;
}

export class CompressionService {
  /**
   * Создаёт краткое содержание диалога
   * Все параметры передаются извне, без хардкода
   */
  async createSummary(
    messages: Message[],
    provider: "yandex" | "openrouter",
    model: string,
    temperature: number
  ): Promise<Summary> {
    console.log(
      `[COMPRESSION] Creating summary for ${messages.length} messages using ${provider}/${model}`
    );

    // Формируем текст диалога
    const dialogText = messages
      .map((msg) => {
        const role =
          msg.role === "user"
            ? "Пользователь"
            : msg.role === "assistant"
            ? "Ассистент"
            : "Система";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    // Промпт для создания summary
    const summaryPrompt = `Создай краткое содержание следующего диалога. Сохрани все ключевые факты, решения, важные детали и контекст разговора. Будь максимально сжатым, но не теряй важную информацию.

Диалог:
${dialogText}

Краткое содержание (2-4 предложения):`;

    // Оцениваем токены оригинальных сообщений
    const originalTokens = messages.reduce((sum, msg) => {
      return sum + (msg.tokens || Math.ceil(msg.content.length / 4));
    }, 0);

    try {
      let result;

      // Вызываем нужный провайдер
      if (provider === "yandex") {
        result = await getYandexService().sendMessage(
          model as "yandexgpt" | "yandexgpt-lite",
          summaryPrompt,
          temperature
        );
      } else {
        result = await getOpenRouterService().sendMessage(
          model,
          summaryPrompt,
          temperature
        );
      }

      const summaryTokens = result.totalTokens;
      const savedTokens = originalTokens - summaryTokens;
      const compressionRatio = ((savedTokens / originalTokens) * 100).toFixed(
        1
      );

      console.log(`[COMPRESSION SUCCESS]`, {
        originalTokens,
        summaryTokens,
        savedTokens,
        compressionRatio: `${compressionRatio}%`,
      });

      return {
        content: result.text.trim(),
        messagesCount: messages.length,
        createdAt: new Date(),
        originalTokens,
        summaryTokens,
      };
    } catch (error: any) {
      console.error("[COMPRESSION ERROR]", error.message);

      // Fallback: простое текстовое сжатие без вызова модели
      const fallbackSummary = this.createFallbackSummary(messages);
      const fallbackTokens = Math.ceil(fallbackSummary.length / 4);

      console.log(`[COMPRESSION FALLBACK] Using simple text compression`);

      return {
        content: fallbackSummary,
        messagesCount: messages.length,
        createdAt: new Date(),
        originalTokens,
        summaryTokens: fallbackTokens,
      };
    }
  }

  /**
   * Создаёт простое содержание без вызова модели (для fallback)
   */
  private createFallbackSummary(messages: Message[]): string {
    if (messages.length === 0) {
      return "Диалог был пуст.";
    }

    // Берём первое сообщение пользователя и последний ответ
    const firstUserMessage = messages.find((m) => m.role === "user");
    const lastAssistantMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const parts: string[] = [];

    if (firstUserMessage) {
      const preview = firstUserMessage.content.substring(0, 150);
      parts.push(
        `Диалог начался с вопроса: "${preview}${
          preview.length < firstUserMessage.content.length ? "..." : ""
        }"`
      );
    }

    if (lastAssistantMessage) {
      const preview = lastAssistantMessage.content.substring(0, 150);
      parts.push(
        `Последний ответ: "${preview}${
          preview.length < lastAssistantMessage.content.length ? "..." : ""
        }"`
      );
    }

    parts.push(`Всего сообщений: ${messages.length}`);

    return parts.join(". ");
  }

  /**
   * Оценивает количество токенов в тексте (приблизительно)
   */
  estimateTokens(text: string): number {
    // Примерная оценка: 1 токен ≈ 4 символа
    return Math.ceil(text.length / 4);
  }
}

export const compressionService = new CompressionService();
