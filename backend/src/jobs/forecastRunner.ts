import { forecastScheduler } from "../services/forecastScheduler";
import { forecastStorage, ForecastSummary } from "../services/forecastStorage";
import { weatherSummaryAgent } from "../agents/weatherSummaryAgent";
import fs from "fs/promises";
import path from "path";

class ForecastRunner {
  private isRunning = false;
  private readonly LOG_FILE = path.join(
    __dirname,
    "../../logs/forecast-runner.log"
  );

  constructor() {
    this.ensureLogDirectory();
  }

  /**
   * Создать директорию для логов
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      const logDir = path.dirname(this.LOG_FILE);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error: any) {
      console.error(
        "[FORECAST RUNNER] Failed to create log directory:",
        error.message
      );
    }
  }

  /**
   * Логирование в файл
   */
  private async log(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    try {
      await fs.appendFile(this.LOG_FILE, logLine, "utf-8");
      console.log(`[FORECAST RUNNER] ${message}`);
    } catch (error: any) {
      console.error("[FORECAST RUNNER] Log write error:", error.message);
    }
  }

  /**
   * Запустить runner
   */
  async start(): Promise<void> {
    await this.log("Starting forecast runner...");

    const config = forecastScheduler.getConfig();
    if (!config) {
      await this.log("ERROR: No config found");
      return;
    }

    if (!config.enabled) {
      await this.log("Forecast runner is disabled in config");
      return;
    }

    // Запускаем scheduler с callback
    await forecastScheduler.start(async () => {
      await this.executeForecastJob();
    });

    await this.log(
      `✓ Forecast runner started with schedule: ${config.schedule}`
    );
    await this.log(`Cities: ${config.cities.join(", ")}`);
  }

  /**
   * Остановить runner
   */
  stop(): void {
    forecastScheduler.stop();
    this.log("Forecast runner stopped");
  }

  /**
   * Выполнить задачу генерации прогноза
   */
  async executeForecastJob(): Promise<ForecastSummary> {
    if (this.isRunning) {
      await this.log("Job already running, skipping");
      throw new Error("Job already running");
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      await this.log("=== Starting forecast generation ===");

      const config = forecastScheduler.getConfig();
      if (!config) {
        throw new Error("No config found");
      }

      const cities = config.cities;
      await this.log(`Generating summaries for: ${cities.join(", ")}`);

      // Шаг 1: Генерируем сводки
      const result = await weatherSummaryAgent.generateSummary(cities);

      await this.log(
        `Generated ${Object.keys(result.summaries).length} summaries`
      );
      await this.log(`Total tokens used: ${result.totalTokens}`);

      // Логируем каждую сводку
      for (const [city, summary] of Object.entries(result.summaries)) {
        await this.log(`  ${city}: "${summary}"`);
      }

      // Шаг 2: Сохраняем в storage
      const savedSummary = await forecastStorage.saveSummary({
        date: new Date().toISOString(),
        summaries: result.summaries,
        weatherData: result.weatherData,
        tokensUsed: result.totalTokens,
        generatedBy: "weatherSummaryAgent",
      });

      const duration = Date.now() - startTime;
      await this.log(`✓ Forecast saved with ID: ${savedSummary.id}`);
      await this.log(`Execution time: ${duration}ms`);
      await this.log("=== Forecast generation completed ===");

      return savedSummary;
    } catch (error: any) {
      await this.log(`ERROR: ${error.message}`);
      await this.log(`Stack: ${error.stack}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Выполнить сейчас (для ручного триггера)
   */
  async executeNow(): Promise<ForecastSummary> {
    await this.log("Manual execution triggered");
    return await this.executeForecastJob();
  }

  /**
   * Получить последние N строк из лога
   */
  async getRecentLogs(lines: number = 50): Promise<string[]> {
    try {
      const content = await fs.readFile(this.LOG_FILE, "utf-8");
      const allLines = content.split("\n").filter((line) => line.trim());
      return allLines.slice(-lines);
    } catch (error: any) {
      return [`Error reading logs: ${error.message}`];
    }
  }
}

export const forecastRunner = new ForecastRunner();
