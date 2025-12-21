import { Message, Summary, Session } from "./types";

export class SessionContextBuilder {
  /**
   * Построить контекст для модели из сессии
   * Включает summaries как system сообщения + текущие сообщения
   */
  static buildContext(session: Session): Message[] {
    const context: Message[] = [];

    // Добавляем все summaries как system сообщения
    for (const summary of session.summaries) {
      context.push({
        role: "system",
        content: `История предыдущего диалога (краткое содержание ${summary.messagesCount} сообщений):\n${summary.content}`,
        timestamp: summary.createdAt,
        tokens: summary.summaryTokens,
      });
    }

    // Добавляем текущие сообщения
    context.push(...session.messages);

    return context;
  }

  /**
   * Подсчитать общее количество токенов в контексте
   */
  static calculateContextTokens(context: Message[]): number {
    return context.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  }

  /**
   * Проверить, нужна ли компрессия
   */
  static needsCompression(session: Session): boolean {
    return (
      session.config.compressionEnabled &&
      session.messages.length >= session.config.compressionThreshold
    );
  }
}
