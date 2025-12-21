/**
 * SessionInfoController - получение информации и операции с сессиями
 * Отвечает за: статистику, историю, сжатие, экспорт
 */

import { Request, Response } from "express";
import { sessionManager } from "../../services/sessionManager";
import { compressionService } from "../../services/compressionService";

export const sessionInfoController = {
  /**
   * Получить статистику сессии
   */
  async getStats(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const stats = sessionManager.getStats(sessionId);

      if (!stats) {
        return res.status(404).json({
          error: "Сессия не найдена",
        });
      }

      res.json(stats);
    } catch (error: any) {
      console.error("[GET STATS ERROR]", error);
      res.status(500).json({
        error: "Не удалось получить статистику",
        details: error.message,
      });
    }
  },

  /**
   * Получить историю сообщений сессии
   */
  async getHistory(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "Сессия не найдена",
        });
      }

      const context = sessionManager.getContextForModel(sessionId);

      res.json({
        messages: session.messages,
        summaries: session.summaries,
        context: context,
        totalMessages: session.totalMessages,
      });
    } catch (error: any) {
      console.error("[GET HISTORY ERROR]", error);
      res.status(500).json({
        error: "Не удалось получить историю",
        details: error.message,
      });
    }
  },

  /**
   * Сжать текущие сообщения сессии
   */
  async compressSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "Сессия не найдена",
        });
      }

      if (session.messages.length === 0) {
        return res.status(400).json({
          error: "Нет сообщений для сжатия",
        });
      }

      const summary = await compressionService.createSummary(
        session.messages,
        session.config.summaryProvider || session.provider,
        session.config.summaryModel || session.model,
        session.temperature
      );

      sessionManager.addSummary(sessionId, summary);

      res.json({
        message: "Сжатие выполнено",
        summary,
        stats: sessionManager.getStats(sessionId),
      });
    } catch (error: any) {
      console.error("[COMPRESS ERROR]", error);
      res.status(500).json({
        error: "Не удалось выполнить сжатие",
        details: error.message,
      });
    }
  },

  /**
   * Экспортировать полную сессию в JSON
   */
  async exportSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "Сессия не найдена",
        });
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="session-${sessionId}-${new Date().toISOString()}.json"`
      );
      res.json(session);
    } catch (error: any) {
      console.error("[EXPORT SESSION ERROR]", error);
      res.status(500).json({
        error: "Не удалось экспортировать сессию",
        details: error.message,
      });
    }
  },
};
