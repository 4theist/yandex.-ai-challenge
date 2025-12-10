import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { MODELS_CONFIG } from "./config/models";
import { callModel, ModelResult } from "./utils/modelCaller";

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

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/models`);
  console.log(`   POST http://localhost:${PORT}/api/chat`);
  console.log(`   POST http://localhost:${PORT}/api/compare`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});

export default app;
