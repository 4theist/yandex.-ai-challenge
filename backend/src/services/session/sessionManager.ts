import { v4 as uuidv4 } from "uuid";
import { persistenceService } from "../persistenceService";
import { Session, SessionConfig, Message, Summary } from "./types";
import { SessionContextBuilder } from "./sessionContextBuilder";
import { SessionStatsCalculator, SessionStats } from "./sessionStatsCalculator";
import { CONFIG } from "../../config/defaults";
import { logger } from "../../utils/logger";

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TIMEOUT = CONFIG.SESSION.TIMEOUT_MS;

  constructor() {
    setInterval(() => this.cleanupOldSessions(), CONFIG.SESSION.CLEANUP_INTERVAL_MS);
    this.loadSessionsFromDisk();
  }

  /**
   * Создать новую сессию
   */
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

    // Сохраняем в файл
    persistenceService.saveSession(session).catch((error) => {
      logger.error("SESSION_MANAGER", "Failed to save new session", error);
    });

    logger.info("SESSION_MANAGER", `Session created: ${sessionId}`, {
      compressionEnabled: config.compressionEnabled,
      threshold: config.compressionThreshold,
    });

    return sessionId;
  }

  /**
   * Загрузить все сессии из файловой системы при старте сервера
   */
  private async loadSessionsFromDisk(): Promise<void> {
    try {
      logger.info("SESSION_MANAGER", "Loading sessions from disk...");
      const sessions = await persistenceService.loadAllSessions();

      for (const session of sessions) {
        this.sessions.set(session.sessionId, session);
      }

      logger.info("SESSION_MANAGER", `Loaded ${sessions.length} sessions from disk`);
    } catch (error: any) {
      logger.error("SESSION_MANAGER", "Failed to load sessions", error);
    }
  }

  /**
   * Получить сессию по ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Обновить конфигурацию сессии
   */
  updateSessionConfig(sessionId: string, config: Partial<SessionConfig>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.config = { ...session.config, ...config };

    // Автосохранение после обновления конфига
    persistenceService.saveSession(session).catch((error) => {
      console.error(
        `[SESSION MANAGER] Failed to save session: ${error.message}`
      );
    });

    console.log(`[SESSION CONFIG UPDATED] ${sessionId}`, session.config);
  }

  /**
   * Добавить сообщение в сессию
   */
  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.messages.push(message);
    session.totalMessages++;
    session.lastActivityAt = new Date();

    // Автосохранение после добавления сообщения
    persistenceService.saveSession(session).catch((error) => {
      console.error(
        `[SESSION MANAGER] Failed to save session: ${error.message}`
      );
    });

    console.log(
      `[SESSION ${sessionId}] Messages: ${session.messages.length}/${session.config.compressionThreshold}`
    );
  }

  /**
   * Проверить, нужна ли компрессия
   * Делегируется в SessionContextBuilder
   */
  needsCompression(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return SessionContextBuilder.needsCompression(session);
  }

  /**
   * Добавить сводку (summary) и очистить текущие сообщения
   */
  addSummary(sessionId: string, summary: Summary): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.summaries.push(summary);
    session.messages = [];

    // Автосохранение после сжатия
    persistenceService.saveSession(session).catch((error) => {
      console.error(
        `[SESSION MANAGER] Failed to save session: ${error.message}`
      );
    });

    console.log(
      `[SESSION ${sessionId}] Summary created. Total summaries: ${session.summaries.length}`
    );
  }

  /**
   * Получить контекст для модели
   * Делегируется в SessionContextBuilder
   */
  getContextForModel(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return SessionContextBuilder.buildContext(session);
  }

  /**
   * Восстановить сессию из загруженных данных
   */
  restoreSession(session: Session): void {
    this.sessions.set(session.sessionId, session);
    console.log(`[SESSION RESTORED] ${session.sessionId}`);
  }

  /**
   * Получить статистику сессии
   * Делегируется в SessionStatsCalculator
   */
  getStats(sessionId: string): SessionStats | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return SessionStatsCalculator.calculateStats(session);
  }

  /**
   * Удалить сессию
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);

    // Удаляем файл из файловой системы
    persistenceService.deleteSession(sessionId).catch((error) => {
      console.error(
        `[SESSION MANAGER] Failed to delete session file: ${error.message}`
      );
    });

    console.log(`[SESSION DELETED] ${sessionId}`);
  }

  /**
   * Очистка старых неактивных сессий
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        console.log(`[SESSION CLEANUP] ${sessionId}`);
      }
    }
  }

  /**
   * Получить все сессии с их статистикой
   */
  getAllSessions(): { sessionId: string; stats: SessionStats | null }[] {
    return Array.from(this.sessions.keys()).map((sessionId) => ({
      sessionId,
      stats: this.getStats(sessionId),
    }));
  }
}

export const sessionManager = new SessionManager();
