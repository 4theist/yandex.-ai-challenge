/**
 * SessionMessageController - обработка сообщений в диалоговых сессиях
 * Отвечает за: отправку сообщений, интеграцию с агентами и инструментами
 */

import { Request, Response } from "express";
import { sessionManager } from "../../services/sessionManager";
import { compressionService } from "../../services/compressionService";
import { agentService } from "../../services/agentService";
import { callModel, ModelResult } from "../../utils/modelCaller";

export const sessionMessageController = {
  /**
   * Отправить сообщение в диалог
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { sessionId, message, options, useTools } = req.body;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: "Сессия не найдена",
        });
      }

      // Добавляем сообщение пользователя
      sessionManager.addMessage(sessionId, {
        role: "user",
        content: message,
        timestamp: new Date(),
        tokens: Math.ceil(message.length / 4),
      });

      // Проверяем необходимость компрессии
      let compressionTriggered = false;
      if (sessionManager.needsCompression(sessionId)) {
        console.log(`[DIALOG ${sessionId}] Triggering compression...`);
        const summary = await compressionService.createSummary(
          session.messages,
          session.config.summaryProvider || session.provider,
          session.config.summaryModel || session.model,
          session.temperature
        );
        sessionManager.addSummary(sessionId, summary);
        compressionTriggered = true;
      }

      const context = sessionManager.getContextForModel(sessionId);

      // НОВАЯ ЛОГИКА: если useTools=true, используем autonomous agent
      let result: ModelResult;
      let toolsCalled: any[] = [];
      let iterations = 1;

      if (useTools) {
        console.log(`[DIALOG ${sessionId} + TOOLS] Processing with agent...`);

        // Формируем полный промпт с контекстом диалога
        const dialogContext = context
          .map(
            (msg) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n");

        const fullQuery = `${dialogContext}\nUser: ${message}`;

        const agentResult = await agentService.processQuery(
          fullQuery,
          session.provider,
          session.model,
          3
        );

        toolsCalled = agentResult.toolsCalled;
        iterations = agentResult.iterations;

        result = {
          provider: session.provider,
          model: session.model,
          text: agentResult.answer,
          metrics: {
            latencyMs: agentResult.totalLatencyMs,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: agentResult.totalTokens,
            cost: 0,
            currency: session.provider === "yandex" ? "₽" : "FREE",
            contextLimit: 8000,
            outputLimit: 2000,
            contextUsagePercent: 0,
            outputUsagePercent: 0,
          },
        };

        console.log(
          `[DIALOG ${sessionId} + TOOLS] Tools called: ${toolsCalled.length}`
        );
      } else {
        // Обычная логика без tools
        const messages = context.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        result = await callModel(
          session.provider,
          session.model,
          messages,
          session.temperature,
          {
            systemPrompt: options?.systemPrompt,
            maxTokens: options?.maxTokens,
            topP: options?.topP,
            frequencyPenalty: options?.frequencyPenalty,
            presencePenalty: options?.presencePenalty,
          }
        );
      }

      console.log("[DIALOG MESSAGE SAVING]", {
        resultText: result.text,
        textLength: result.text?.length || 0,
        toolsCalledCount: toolsCalled.length,
      });

      // Добавляем ответ ассистента в историю
      sessionManager.addMessage(sessionId, {
        role: "assistant",
        content: result.text,
        timestamp: new Date(),
        tokens: result.metrics.totalTokens,
        toolsCalled: toolsCalled.length > 0 ? toolsCalled : undefined,
      });

      const stats = sessionManager.getStats(sessionId);
      console.log("[DIALOG RESPONSE]", {
        resultText: result.text,
        textLength: result.text?.length || 0,
        statsMessages: stats?.totalMessages,
      });

      res.json({
        result,
        stats,
        compressionTriggered,
        toolsCalled,
        iterations,
        context: {
          messagesInContext: context.length,
          summariesCount: session.summaries.length,
        },
      });
    } catch (error: any) {
      console.error("[DIALOG MESSAGE ERROR]", error);
      res.status(500).json({
        error: "Не удалось отправить сообщение",
        details: error.message,
      });
    }
  },
};
