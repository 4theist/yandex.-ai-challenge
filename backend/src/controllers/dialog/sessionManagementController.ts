/**
 * SessionManagementController - управление жизненным циклом сессий
 * Отвечает за: создание, удаление, восстановление, получение списка сессий
 */

import { Request, Response } from "express";
import { SessionConfig, sessionManager } from "../../services/sessionManager";
import { persistenceService } from "../../services/persistenceService";
import { CONFIG } from "../../config/defaults";

export const sessionManagementController = {
  /**
   * Создать новую диалоговую сессию
   */
  async createSession(req: Request, res: Response) {
    try {
      console.log("[CREATE DIALOG] Request body:", req.body);

      const { provider, model, temperature, config } = req.body;

      const sessionConfig: SessionConfig = {
        compressionEnabled: config?.compressionEnabled ?? CONFIG.SESSION.COMPRESSION_ENABLED,
        compressionThreshold: config?.compressionThreshold ?? CONFIG.SESSION.COMPRESSION_THRESHOLD,
        summaryProvider: config?.summaryProvider || provider,
        summaryModel: config?.summaryModel || model,
      };

      const sessionId = sessionManager.createSession(
        provider,
        model,
        temperature ?? CONFIG.LLM.DEFAULT_TEMPERATURE,
        sessionConfig
      );

      console.log("[CREATE DIALOG] Session created:", sessionId);

      res.json({
        sessionId,
        config: sessionConfig,
        message: "Сессия создана успешно",
      });
    } catch (error: any) {
      console.error("[CREATE DIALOG ERROR]", error);
      res.status(500).json({
        error: "Не удалось создать сессию",
        details: error.message,
      });
    }
  },

  /**
   * Удалить сессию
   */
  async deleteSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      sessionManager.deleteSession(sessionId);

      res.json({
        message: "Сессия удалена",
      });
    } catch (error: any) {
      console.error("[DELETE SESSION ERROR]", error);
      res.status(500).json({
        error: "Не удалось удалить сессию",
        details: error.message,
      });
    }
  },

  /**
   * Восстановить сессию
   */
  async restoreSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;

      let session = sessionManager.getSession(sessionId);

      // Если сессия не в памяти, пытаемся загрузить из файла
      if (!session) {
        const loadedSession = await persistenceService.loadSession(sessionId);
        if (!loadedSession) {
          return res.status(404).json({
            error: "Сессия не найдена",
          });
        }

        sessionManager.restoreSession(loadedSession);
        session = loadedSession;
      }

      const stats = sessionManager.getStats(sessionId);
      const context = sessionManager.getContextForModel(sessionId);

      res.json({
        message: "Сессия восстановлена",
        session: {
          sessionId: session.sessionId,
          provider: session.provider,
          model: session.model,
          temperature: session.temperature,
          config: session.config,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
        },
        stats,
        context: {
          messagesInContext: context.length,
          summariesCount: session.summaries.length,
        },
      });
    } catch (error: any) {
      console.error("[RESTORE SESSION ERROR]", error);
      res.status(500).json({
        error: "Не удалось восстановить сессию",
        details: error.message,
      });
    }
  },

  /**
   * Получить список всех сохранённых сессий
   */
  async getAllSessions(req: Request, res: Response) {
    try {
      const sessions = sessionManager.getAllSessions();

      const sessionsList = sessions.map((s) => ({
        sessionId: s.sessionId,
        provider: s.stats?.config?.summaryProvider || "unknown",
        model: s.stats?.config?.summaryModel || "unknown",
        totalMessages: s.stats?.totalMessages || 0,
        lastActivity: sessionManager.getSession(s.sessionId)?.lastActivityAt,
        createdAt: sessionManager.getSession(s.sessionId)?.createdAt,
      }));

      res.json({
        sessions: sessionsList,
        total: sessionsList.length,
      });
    } catch (error: any) {
      console.error("[GET SESSIONS ERROR]", error);
      res.status(500).json({
        error: "Не удалось получить список сессий",
        details: error.message,
      });
    }
  },
};
