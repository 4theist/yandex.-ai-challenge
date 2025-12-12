import { v4 as uuidv4 } from "uuid";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tokens?: number;
}

export interface Summary {
  content: string;
  messagesCount: number;
  createdAt: Date;
  originalTokens: number;
  summaryTokens: number;
}

export interface SessionConfig {
  compressionThreshold: number;
  compressionEnabled: boolean;
  summaryModel?: string;
  summaryProvider?: "yandex" | "openrouter";
}

export interface Session {
  sessionId: string;
  messages: Message[];
  summaries: Summary[];
  createdAt: Date;
  lastActivityAt: Date;
  totalMessages: number;
  provider: "yandex" | "openrouter";
  model: string;
  temperature: number;
  config: SessionConfig;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanupOldSessions(), 15 * 60 * 1000);
  }

  createSession(
    provider: "yandex" | "openrouter",
    model: string,
    temperature: number,
    config: SessionConfig
  ): string {
    const sessionId = uuidv4();
    const session: Session = {
      sessionId,
      messages: [],
      summaries: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      totalMessages: 0,
      provider,
      model,
      temperature,
      config,
    };

    this.sessions.set(sessionId, session);
    console.log(`[SESSION CREATED] ${sessionId}`, {
      compressionEnabled: config.compressionEnabled,
      threshold: config.compressionThreshold,
    });
    return sessionId;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionConfig(sessionId: string, config: Partial<SessionConfig>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.config = { ...session.config, ...config };
    console.log(`[SESSION CONFIG UPDATED] ${sessionId}`, session.config);
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages.push(message);
    session.totalMessages++;
    session.lastActivityAt = new Date();

    console.log(
      `[SESSION ${sessionId}] Messages: ${session.messages.length}/${session.config.compressionThreshold}`
    );
  }

  needsCompression(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return (
      session.config.compressionEnabled &&
      session.messages.length >= session.config.compressionThreshold
    );
  }

  addSummary(sessionId: string, summary: Summary): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.summaries.push(summary);
    session.messages = [];

    console.log(
      `[SESSION ${sessionId}] Summary created. Total summaries: ${session.summaries.length}`
    );
  }

  getContextForModel(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

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

  getStats(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const context = this.getContextForModel(sessionId);
    const contextTokens = context.reduce(
      (sum, msg) => sum + (msg.tokens || 0),
      0
    );

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

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`[SESSION DELETED] ${sessionId}`);
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        console.log(`[SESSION CLEANUP] ${sessionId}`);
      }
    }
  }

  getAllSessions(): { sessionId: string; stats: any }[] {
    return Array.from(this.sessions.keys()).map((sessionId) => ({
      sessionId,
      stats: this.getStats(sessionId),
    }));
  }
}

export const sessionManager = new SessionManager();
