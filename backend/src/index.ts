import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { YandexGPTService } from "./yandexService";
import path from "path";

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

const yandexService = new YandexGPTService();

// Единственный эндпоинт для структурированного JSON
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        status: "error",
        data: {
          answer: "Сообщение обязательно и должно быть непустой строкой",
          confidence: 0,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          model: "yandexgpt",
        },
      });
    }

    console.log(`[REQUEST] User: "${message.substring(0, 100)}..."`);

    const result = await yandexService.getStructuredResponse(message, 3);

    console.log(
      `[RESPONSE] Status: ${result.status}, Confidence: ${result.data.confidence}`
    );

    res.json(result);
  } catch (error: any) {
    console.error("[ERROR] Chat endpoint:", error);
    res.status(500).json({
      status: "error",
      data: {
        answer: "Внутренняя ошибка сервера",
        confidence: 0,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        model: "yandexgpt",
      },
    });
  }
});

// Проверка здоровья
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "yandex-gpt-structured",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: ["/api/chat", "/api/health"],
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
      status: "error",
      data: {
        answer: "Внутренняя ошибка сервера",
        confidence: 0,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        model: "yandexgpt",
      },
    });
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/chat`);
  console.log(`❤️  Health: GET http://localhost:${PORT}/api/health`);
});

export default app;
