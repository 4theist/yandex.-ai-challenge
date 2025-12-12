import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { MODELS_CONFIG } from "./config/models";
import { callModel, ModelCallOptions, ModelResult } from "./utils/modelCaller";
import { SessionConfig, sessionManager } from "./services/sessionManager";
import { compressionService } from "./services/compressionService";

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
    const { sessionId, message, options } = req.body;

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

    sessionManager.addMessage(sessionId, {
      role: "user",
      content: message,
      timestamp: new Date(),
      tokens: Math.ceil(message.length / 4),
    });

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

    const messages = context.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const result = await callModel(
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

    sessionManager.addMessage(sessionId, {
      role: "assistant",
      content: result.text,
      timestamp: new Date(),
      tokens: result.metrics.totalTokens,
    });

    const stats = sessionManager.getStats(sessionId);

    res.json({
      result,
      stats,
      compressionTriggered,
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
      "GET /api/health - Проверка здоровья",
    ],
  });
});
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/models`);
  console.log(`   POST http://localhost:${PORT}/api/chat`);
  console.log(`   POST http://localhost:${PORT}/api/compare`);
  console.log(`   POST http://localhost:${PORT}/api/dialog/create`);
  console.log(`   POST http://localhost:${PORT}/api/dialog/message`);
  console.log(`   DELETE http://localhost:${PORT}/api/dialog/:id`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});

export default app;
