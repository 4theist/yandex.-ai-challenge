import { Session } from "./types";
import { SessionContextBuilder } from "./sessionContextBuilder";

export interface SessionStats {
  sessionId: string;
  totalMessages: number;
  currentMessages: number;
  summariesCount: number;
  contextTokens: number;
  originalTokensFromSummaries: number;
  summaryTokens: number;
  savedTokens: number;
  compressionRatio: string;
  config: Session["config"];
}

export class SessionStatsCalculator {
  /**
   * Рассчитать статистику для сессии
   */
  static calculateStats(session: Session): SessionStats {
    const context = SessionContextBuilder.buildContext(session);
    const contextTokens = SessionContextBuilder.calculateContextTokens(context);

    const originalTokensFromSummaries = session.summaries.reduce(
      (sum, s) => sum + s.originalTokens,
      0
    );

    const summaryTokens = session.summaries.reduce(
      (sum, s) => sum + s.summaryTokens,
      0
    );

    const savedTokens = originalTokensFromSummaries - summaryTokens;

    return {
      sessionId: session.sessionId,
      totalMessages: session.totalMessages,
      currentMessages: session.messages.length,
      summariesCount: session.summaries.length,
      contextTokens,
      originalTokensFromSummaries,
      summaryTokens,
      savedTokens,
      compressionRatio:
        originalTokensFromSummaries > 0
          ? ((savedTokens / originalTokensFromSummaries) * 100).toFixed(1)
          : "0",
      config: session.config,
    };
  }

  /**
   * Рассчитать эффективность компрессии
   */
  static calculateCompressionEfficiency(session: Session): {
    efficiency: number;
    savedTokens: number;
  } {
    const originalTokens = session.summaries.reduce(
      (sum, s) => sum + s.originalTokens,
      0
    );

    const compressedTokens = session.summaries.reduce(
      (sum, s) => sum + s.summaryTokens,
      0
    );

    const savedTokens = originalTokens - compressedTokens;
    const efficiency =
      originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0;

    return { efficiency, savedTokens };
  }
}
