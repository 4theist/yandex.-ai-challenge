import express, { Express } from "express";
import chatRoutes from "./chat.routes";
import dialogRoutes from "./dialog.routes";
import forecastRoutes from "./forecast.routes";
import weatherRoutes from "./weather.routes";
import mcpRoutes from "./mcp.routes";
import summaryRoutes from "./summary.routes";
import { agentService } from "../services/agentService";

export function setupRoutes(app: Express) {
  // Chat & Models
  app.use("/api", chatRoutes);

  // Dialog/Session management
  app.use("/api/dialog", dialogRoutes);

  // Forecast
  app.use("/api/forecast", forecastRoutes);

  // Weather
  app.use("/api/weather", weatherRoutes);

  // MCP
  app.use("/api/mcp", mcpRoutes);

  // Summary (под /api/forecast/summary)
  app.use("/api/forecast/summary", summaryRoutes);

  // Tools endpoint (отдельно, так как был в weather.routes но логически отдельный)
  app.get("/api/tools", async (req, res) => {
    try {
      await agentService.initialize();
      const tools = (agentService as any).availableTools;

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
}
