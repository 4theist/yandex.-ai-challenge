import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { setupRoutes } from "./routes";
import { globalErrorHandler } from "./middleware/errorHandler";
import { forecastRunner } from "./jobs/forecastRunner";
import { agentService } from "./services/agentService";

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

// Setup all routes
setupRoutes(app);

// Global error handler (должен быть последним)
app.use(globalErrorHandler);

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
