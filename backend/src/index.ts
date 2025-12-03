import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { YandexGPTService, Message, AgentResponse } from "./yandexService";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

// In-memory хранилище сессий
interface Session {
  sessionId: string;
  messages: Message[];
  createdAt: Date;
  lastActivityAt: Date;
  isComplete: boolean;
}

const sessions = new Map<string, Session>();

//  Очистка старых сессий (старше 1 часа)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastActivityAt.getTime() < oneHourAgo) {
      console.log(`[CLEANUP] Removing session ${sessionId}`);
      sessions.delete(sessionId);
    }
  }
}, 15 * 60 * 1000);

//  эндпоинт для создания сессии
app.post("/api/session/create", (req, res) => {
  const sessionId = uuidv4();

  sessions.set(sessionId, {
    sessionId,
    messages: [],
    createdAt: new Date(),
    lastActivityAt: new Date(),
    isComplete: false,
  });

  console.log(`[SESSION CREATED] ${sessionId}`);

  res.json({
    sessionId,
    message: "Session created successfully",
  });
});

//  эндпоинт для чата с историей
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Валидация
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Сообщение обязательно и должно быть непустой строкой",
      });
    }

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        error:
          "sessionId обязателен. Создайте сессию через POST /api/session/create",
      });
    }

    // Получаем или создаем сессию
    let session = sessions.get(sessionId);

    if (!session) {
      // Если сессия не найдена - создаем новую (fallback)
      console.log(`[SESSION NOT FOUND] Creating new session ${sessionId}`);
      session = {
        sessionId,
        messages: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        isComplete: false,
      };
      sessions.set(sessionId, session);
    }

    // Проверяем, не завершен ли диалог
    if (session.isComplete) {
      return res.json({
        status: "ready",
        reasoning: "Диалог уже завершен. Создайте новую сессию.",
        result: { message: "Создайте новую сессию для нового запроса" },
        confidence: 100,
      } as AgentResponse);
    }

    console.log(
      `[REQUEST] Session: ${sessionId}, Message: "${message.substring(
        0,
        100
      )}..."`
    );
    console.log(`[HISTORY] Current messages count: ${session.messages.length}`);

    // Добавляем новое сообщение пользователя в историю
    session.messages.push({
      role: "user",
      text: message,
    });

    //  Отправляем ВСЮ историю в YandexGPT
    const response = await yandexService.getAgentResponse(session.messages, 3);

    //  Сохраняем ответ ассистента в историю
    session.messages.push({
      role: "assistant",
      text: JSON.stringify(response),
    });

    //  Обновляем метаданные сессии
    session.lastActivityAt = new Date();

    //  Если статус "ready" - помечаем диалог завершенным
    if (response.status === "ready") {
      session.isComplete = true;
      console.log(`[SESSION COMPLETED] ${sessionId}`);
    }

    console.log(
      `[RESPONSE] Status: ${response.status}, Confidence: ${response.confidence}`
    );

    res.json(response);
  } catch (error: any) {
    console.error("[ERROR] Chat endpoint:", error);
    res.status(500).json({
      error: "Внутренняя ошибка сервера",
      details: error.message,
    });
  }
});

// эндпоинт для получения истории сессии
app.get("/api/session/:sessionId/history", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: "Session not found",
    });
  }

  // Форматируем историю для отображения
  const history = session.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "assistant") {
        try {
          const parsed = JSON.parse(m.text) as AgentResponse;
          return {
            role: "assistant",
            status: parsed.status,
            content: parsed.question || JSON.stringify(parsed.result, null, 2),
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
          };
        } catch {
          return { role: "assistant", content: m.text };
        }
      }
      return { role: m.role, content: m.text };
    });

  res.json({
    sessionId,
    isComplete: session.isComplete,
    messageCount: history.length,
    history,
  });
});

//  эндпоинт для сброса сессии
app.post("/api/session/:sessionId/reset", (req, res) => {
  const { sessionId } = req.params;

  if (!sessions.has(sessionId)) {
    return res.status(404).json({
      error: "Session not found",
    });
  }

  sessions.delete(sessionId);
  console.log(`[SESSION RESET] ${sessionId}`);

  res.json({
    message: "Session reset successfully",
    sessionId,
  });
});

//  Health check с информацией о сессиях
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "yandex-gpt-agent",
    activeSessions: sessions.size,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: [
      "POST /api/session/create - Создать новую сессию",
      "POST /api/chat - Отправить сообщение (требует sessionId)",
      "GET /api/session/:sessionId/history - Получить историю",
      "POST /api/session/:sessionId/reset - Сбросить сессию",
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
  console.log(`   POST http://localhost:${PORT}/api/session/create`);
  console.log(`   POST http://localhost:${PORT}/api/chat`);
  console.log(`   GET  http://localhost:${PORT}/api/session/:id/history`);
  console.log(`   POST http://localhost:${PORT}/api/session/:id/reset`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});

export default app;
