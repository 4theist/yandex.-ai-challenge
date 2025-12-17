import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { MODELS_CONFIG } from "./config/models";
import { callModel, ModelCallOptions, ModelResult } from "./utils/modelCaller";
import { SessionConfig, sessionManager } from "./services/sessionManager";
import { compressionService } from "./services/compressionService";
import { persistenceService } from "./services/persistenceService";
import { weatherService } from "./services/weatherService";
import { agentService } from "./services/agentService";
import { forecastRunner } from "./jobs/forecastRunner";
import { forecastScheduler } from "./services/forecastScheduler";
import { forecastStorage } from "./services/forecastStorage";

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

// Список доступных моделей
app.get("/api/models", (req, res) => {
  res.json(MODELS_CONFIG);
});

// Single mode - одна модель
app.post("/api/chat", async (req, res) => {
  try {
    const { message, temperature, provider, model } = req.body;

    // Валидация
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "message обязателен и должен быть непустой строкой",
      });
    }

    if (!provider || !["yandex", "openrouter"].includes(provider)) {
      return res.status(400).json({
        error: "provider должен быть 'yandex' или 'openrouter'",
      });
    }

    if (!model || typeof model !== "string") {
      return res.status(400).json({
        error: "model обязателен",
      });
    }

    const temp = temperature !== undefined ? temperature : 0.6;

    console.log(
      `[CHAT] ${provider}/${model} - "${message.substring(0, 50)}..."`
    );

    const result = await callModel(provider, model, message, temp);

    console.log(
      `[CHAT SUCCESS] ${result.metrics.latencyMs}ms, ${result.metrics.totalTokens} tokens`
    );

    res.json(result);
  } catch (error: any) {
    console.error("[CHAT ERROR]", error);
    res.status(500).json({
      error: "Не удалось получить ответ",
      details: error.message,
    });
  }
});

// Compare mode - две модели параллельно
app.post("/api/compare", async (req, res) => {
  try {
    const { message, temperature, model1, model2 } = req.body;

    // Валидация
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "message обязателен и должен быть непустой строкой",
      });
    }

    if (!model1 || !model1.provider || !model1.model) {
      return res.status(400).json({
        error: "model1 должен содержать provider и model",
      });
    }

    if (!model2 || !model2.provider || !model2.model) {
      return res.status(400).json({
        error: "model2 должен содержать provider и model",
      });
    }

    const temp = temperature !== undefined ? temperature : 0.6;

    console.log(
      `[COMPARE] ${model1.provider}/${model1.model} vs ${model2.provider}/${model2.model}`
    );

    // Параллельный вызов обеих моделей
    const [result1, result2] = await Promise.all([
      callModel(model1.provider, model1.model, message, temp),
      callModel(model2.provider, model2.model, message, temp),
    ]);

    console.log(
      `[COMPARE SUCCESS] Model1: ${result1.metrics.latencyMs}ms, Model2: ${result2.metrics.latencyMs}ms`
    );

    res.json({
      results: [result1, result2],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[COMPARE ERROR]", error);
    res.status(500).json({
      error: "Не удалось сравнить модели",
      details: error.message,
    });
  }
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("[GLOBAL ERROR]", err);
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      details: err.message,
    });
  }
);
// ============================================
// FORECAST API
// ============================================

/**
 * Получить последнюю сводку
 */
app.get("/api/forecast/latest", async (req, res) => {
  try {
    const summary = await forecastStorage.getLatestSummary();

    if (!summary) {
      return res.json({
        generated: false,
        message: "No forecasts generated yet",
      });
    }

    res.json({
      generated: true,
      ...summary,
    });
  } catch (error: any) {
    console.error("[GET FORECAST LATEST ERROR]", error);
    res.status(500).json({
      error: "Failed to get latest forecast",
      details: error.message,
    });
  }
});

/**
 * Получить историю сводок
 */
app.get("/api/forecast/history", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const history = await forecastStorage.getHistory(days);

    res.json({
      count: history.length,
      days,
      forecasts: history,
    });
  } catch (error: any) {
    console.error("[GET FORECAST HISTORY ERROR]", error);
    res.status(500).json({
      error: "Failed to get forecast history",
      details: error.message,
    });
  }
});

/**
 * Получить текущую конфигурацию
 */
app.get("/api/forecast/config", async (req, res) => {
  try {
    const config = forecastScheduler.getConfig();

    if (!config) {
      return res.status(404).json({
        error: "Config not found",
      });
    }

    res.json(config);
  } catch (error: any) {
    console.error("[GET FORECAST CONFIG ERROR]", error);
    res.status(500).json({
      error: "Failed to get config",
      details: error.message,
    });
  }
});

/**
 * Обновить конфигурацию
 */
app.post("/api/forecast/config", async (req, res) => {
  try {
    const { schedule, enabled } = req.body;

    if (schedule) {
      await forecastScheduler.updateSchedule(schedule);
    }

    if (enabled !== undefined) {
      await forecastScheduler.setEnabled(enabled);
    }

    const updatedConfig = forecastScheduler.getConfig();

    res.json({
      message: "Config updated",
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error("[UPDATE FORECAST CONFIG ERROR]", error);
    res.status(500).json({
      error: "Failed to update config",
      details: error.message,
    });
  }
});

/**
 * Сгенерировать сводку прямо сейчас
 */
app.post("/api/forecast/generate-now", async (req, res) => {
  try {
    console.log("[FORECAST GENERATE NOW] Manual trigger");
    const summary = await forecastRunner.executeNow();

    res.json({
      message: "Forecast generated successfully",
      summary,
    });
  } catch (error: any) {
    console.error("[FORECAST GENERATE NOW ERROR]", error);
    res.status(500).json({
      error: "Failed to generate forecast",
      details: error.message,
    });
  }
});

/**
 * Получить логи forecast runner
 */
app.get("/api/forecast/logs", async (req, res) => {
  try {
    const lines = parseInt(req.query.lines as string) || 50;
    const logs = await forecastRunner.getRecentLogs(lines);

    res.json({
      count: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error("[GET FORECAST LOGS ERROR]", error);
    res.status(500).json({
      error: "Failed to get logs",
      details: error.message,
    });
  }
});

/**
 * Получить статистику storage
 */
app.get("/api/forecast/stats", async (req, res) => {
  try {
    const stats = await forecastStorage.getStats();
    const config = forecastScheduler.getConfig();

    res.json({
      storage: stats,
      scheduler: {
        enabled: config?.enabled,
        schedule: config?.schedule,
        lastRun: config?.lastRun,
        nextRun: config?.nextRun,
      },
    });
  } catch (error: any) {
    console.error("[GET FORECAST STATS ERROR]", error);
    res.status(500).json({
      error: "Failed to get stats",
      details: error.message,
    });
  }
});

// ============================================
// DIALOG API
// ============================================

app.post("/api/dialog/create", (req, res) => {
  try {
    console.log("[CREATE DIALOG] Request body:", req.body);

    const { provider, model, temperature, config } = req.body;

    if (!provider || !model) {
      return res.status(400).json({
        error: "provider и model обязательны",
      });
    }

    const sessionConfig: SessionConfig = {
      compressionEnabled: config?.compressionEnabled ?? true,
      compressionThreshold: config?.compressionThreshold ?? 10,
      summaryProvider: config?.summaryProvider || provider,
      summaryModel: config?.summaryModel || model,
    };

    const sessionId = sessionManager.createSession(
      provider,
      model,
      temperature ?? 0.6,
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
});

app.post("/api/dialog/message", async (req, res) => {
  try {
    const { sessionId, message, options, useTools } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "sessionId и message обязательны",
      });
    }

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

    // Добавляем ответ ассистента в историю
    sessionManager.addMessage(sessionId, {
      role: "assistant",
      content: result.text,
      timestamp: new Date(),
      tokens: result.metrics.totalTokens,
      toolsCalled: toolsCalled.length > 0 ? toolsCalled : undefined,
    });

    const stats = sessionManager.getStats(sessionId);

    res.json({
      result,
      stats,
      compressionTriggered,
      toolsCalled, // ← NEW
      iterations, // ← NEW
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
});
// app.post("/api/dialog/message", async (req, res) => {
//   try {
//     const { sessionId, message, options } = req.body;

//     if (!sessionId || !message) {
//       return res.status(400).json({
//         error: "sessionId и message обязательны",
//       });
//     }

//     const session = sessionManager.getSession(sessionId);
//     if (!session) {
//       return res.status(404).json({
//         error: "Сессия не найдена",
//       });
//     }

//     sessionManager.addMessage(sessionId, {
//       role: "user",
//       content: message,
//       timestamp: new Date(),
//       tokens: Math.ceil(message.length / 4),
//     });

//     let compressionTriggered = false;
//     if (sessionManager.needsCompression(sessionId)) {
//       console.log(`[DIALOG ${sessionId}] Triggering compression...`);

//       const summary = await compressionService.createSummary(
//         session.messages,
//         session.config.summaryProvider || session.provider,
//         session.config.summaryModel || session.model,
//         session.temperature
//       );

//       sessionManager.addSummary(sessionId, summary);
//       compressionTriggered = true;
//     }

//     const context = sessionManager.getContextForModel(sessionId);

//     const messages = context.map((msg) => ({
//       role: msg.role,
//       content: msg.content,
//     }));

//     const result = await callModel(
//       session.provider,
//       session.model,
//       messages,
//       session.temperature,
//       {
//         systemPrompt: options?.systemPrompt,
//         maxTokens: options?.maxTokens,
//         topP: options?.topP,
//         frequencyPenalty: options?.frequencyPenalty,
//         presencePenalty: options?.presencePenalty,
//       }
//     );

//     sessionManager.addMessage(sessionId, {
//       role: "assistant",
//       content: result.text,
//       timestamp: new Date(),
//       tokens: result.metrics.totalTokens,
//     });

//     const stats = sessionManager.getStats(sessionId);

//     res.json({
//       result,
//       stats,
//       compressionTriggered,
//       context: {
//         messagesInContext: context.length,
//         summariesCount: session.summaries.length,
//       },
//     });
//   } catch (error: any) {
//     console.error("[DIALOG MESSAGE ERROR]", error);
//     res.status(500).json({
//       error: "Не удалось отправить сообщение",
//       details: error.message,
//     });
//   }
// });

app.get("/api/dialog/:sessionId/stats", (req, res) => {
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
});

app.delete("/api/dialog/:sessionId", (req, res) => {
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
});

app.post("/api/dialog/:sessionId/compress", async (req, res) => {
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
});
// Получить список всех сохранённых сессий
app.get("/api/dialog/sessions", async (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();

    // Возвращаем базовую информацию о каждой сессии
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
});
// Получить историю сообщений сессии
app.get("/api/dialog/:sessionId/history", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "Сессия не найдена",
      });
    }

    // Получаем полный контекст (summaries + текущие сообщения)
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
});

// Восстановить сессию (проверить что она существует и загружена)
app.post("/api/dialog/:sessionId/restore", async (req, res) => {
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

      // Загружаем сессию в память
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
});
// Экспортировать полную сессию в JSON
app.get("/api/dialog/:sessionId/export", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: "Сессия не найдена",
      });
    }

    // Возвращаем полную сессию с человекочитаемым форматированием
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
});

app.post("/api/weather", async (req, res) => {
  try {
    const { city, days } = req.body;

    if (!city) {
      return res.status(400).json({ error: "City is required" });
    }

    if (days) {
      // Прогноз
      const forecast = await weatherService.getForecast(city, days);
      res.json({
        type: "forecast",
        data: forecast.data,
        latencyMs: forecast.latencyMs,
      });
    } else {
      // Текущая погода
      const weather = await weatherService.getCurrentWeather(city);
      res.json({
        type: "current",
        data: weather.data,
        latencyMs: weather.latencyMs,
      });
    }
  } catch (error: any) {
    console.error("[WEATHER ENDPOINT ERROR]", error.message);
    res.status(500).json({ error: error.message });
  }
});
// ============================================
//  Получить доступные MCP tools
// ============================================
app.get("/api/tools", async (req, res) => {
  try {
    await agentService.initialize();
    const tools = (agentService as any).availableTools; // если нужно сделать публичным

    res.json({
      tools: tools || [],
      count: tools?.length || 0,
    });
  } catch (error: any) {
    console.error("[GET TOOLS ERROR]", error);
    res.status(500).json({
      error: "Не удалось получить список инструментов",
      details: error.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "ai-models-comparison",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /api/models - Получить список моделей",
      "POST /api/chat - Отправить сообщение одной модели",
      "POST /api/compare - Сравнить две модели",
      "POST /api/dialog/create - Создать диалоговую сессию",
      "POST /api/dialog/message - Отправить сообщение в диалог",
      "GET /api/dialog/sessions - Получить список всех сессий",
      "POST /api/dialog/:id/restore - Восстановить сессию",
      "GET /api/dialog/:id/export - Экспортировать сессию",
      "GET /api/dialog/:id/stats - Статистика сессии",
      "DELETE /api/dialog/:id - Удалить сессию",
      "POST /api/dialog/:id/compress - Сжать текущие сообщения",
      "GET /api/health - Проверка здоровья",
      "GET /api/dialog/:id/history - Получить историю сообщений",
    ],
  });
});
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/models`);
  console.log(`  POST http://localhost:${PORT}/api/chat`);
  console.log(`  POST http://localhost:${PORT}/api/compare`);
  console.log(`  POST http://localhost:${PORT}/api/dialog/create`);
  console.log(`  POST http://localhost:${PORT}/api/dialog/message`);
  console.log(`  GET  http://localhost:${PORT}/api/dialog/sessions`);
  console.log(`  POST http://localhost:${PORT}/api/dialog/:id/restore`);
  console.log(`  GET  http://localhost:${PORT}/api/dialog/:id/export`);
  console.log(`  DELETE http://localhost:${PORT}/api/dialog/:id`);
  console.log(`  GET  http://localhost:${PORT}/api/forecast/latest`);
  console.log(`  GET  http://localhost:${PORT}/api/forecast/history`);
  console.log(`  GET  http://localhost:${PORT}/api/forecast/config`);
  console.log(`  POST http://localhost:${PORT}/api/forecast/config`);
  console.log(`  POST http://localhost:${PORT}/api/forecast/generate-now`);
  console.log(`  GET  http://localhost:${PORT}/api/forecast/logs`);
  console.log(`  GET  http://localhost:${PORT}/api/forecast/stats`);
  console.log(`  GET  http://localhost:${PORT}/api/tools`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);

  // Запускаем forecast runner
  console.log(`\n⏰ Starting forecast runner...`);
  try {
    forecastRunner.start();
  } catch (error: any) {
    console.error("Failed to start forecast runner:", error.message);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n[SERVER] Shutting down gracefully...");
  await agentService.close();
  process.exit(0);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[SERVER] Shutting down gracefully...");
  await agentService.close();
  process.exit(0);
});
export default app;
