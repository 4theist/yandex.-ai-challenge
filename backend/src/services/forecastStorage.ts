import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface ForecastSummary {
  id: string;
  date: string; // ISO string
  summaries: {
    [city: string]: string; // SMS-style short text
  };
  weatherData: {
    [city: string]: any; // Raw weather data
  };
  tokensUsed: number;
  generatedBy: string;
  createdAt: string;
}

class ForecastStorage {
  private readonly STORAGE_DIR = path.join(__dirname, "../../data/forecasts");
  private readonly MAX_AGE_DAYS = 30;

  constructor() {
    this.ensureStorageExists();
    this.cleanupOldForecasts();
  }

  /**
   * Создать директорию для хранения если не существует
   */
  private async ensureStorageExists(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_DIR, { recursive: true });
      console.log(`[FORECAST STORAGE] Directory ready: ${this.STORAGE_DIR}`);
    } catch (error: any) {
      console.error(
        "[FORECAST STORAGE] Failed to create directory:",
        error.message
      );
    }
  }

  /**
   * Сохранить сводку
   */
  async saveSummary(
    summary: Omit<ForecastSummary, "id" | "createdAt">
  ): Promise<ForecastSummary> {
    const fullSummary: ForecastSummary = {
      id: uuidv4(),
      ...summary,
      createdAt: new Date().toISOString(),
    };

    // Формат файла: YYYY-MM-DD_HH-mm.json
    const date = new Date(fullSummary.date);
    const fileName = `${date.toISOString().slice(0, 10)}_${date
      .getHours()
      .toString()
      .padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}.json`;
    const filePath = path.join(this.STORAGE_DIR, fileName);

    try {
      await fs.writeFile(
        filePath,
        JSON.stringify(fullSummary, null, 2),
        "utf-8"
      );
      console.log(`[FORECAST STORAGE] Saved: ${fileName}`);
      return fullSummary;
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Save error:", error.message);
      throw new Error("Failed to save forecast summary");
    }
  }

  /**
   * Получить последнюю сводку
   */
  async getLatestSummary(): Promise<ForecastSummary | null> {
    try {
      const files = await fs.readdir(this.STORAGE_DIR);
      const jsonFiles = files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      if (jsonFiles.length === 0) {
        return null;
      }

      const latestFile = jsonFiles[0];
      const filePath = path.join(this.STORAGE_DIR, latestFile);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Get latest error:", error.message);
      return null;
    }
  }

  /**
   * Получить сводку по дате
   */
  async getSummaryByDate(date: Date): Promise<ForecastSummary | null> {
    try {
      const dateStr = date.toISOString().slice(0, 10);
      const files = await fs.readdir(this.STORAGE_DIR);
      const matchingFiles = files.filter((f) => f.startsWith(dateStr));

      if (matchingFiles.length === 0) {
        return null;
      }

      // Берём последний файл за этот день
      const latestFile = matchingFiles.sort().reverse()[0];
      const filePath = path.join(this.STORAGE_DIR, latestFile);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Get by date error:", error.message);
      return null;
    }
  }

  /**
   * Получить историю за N дней
   */
  async getHistory(days: number = 7): Promise<ForecastSummary[]> {
    try {
      const files = await fs.readdir(this.STORAGE_DIR);
      const jsonFiles = files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      const summaries: ForecastSummary[] = [];
      const now = new Date();

      for (const file of jsonFiles) {
        const filePath = path.join(this.STORAGE_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const summary: ForecastSummary = JSON.parse(content);

        const summaryDate = new Date(summary.date);
        const daysDiff = Math.floor(
          (now.getTime() - summaryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= days) {
          summaries.push(summary);
        }
      }

      return summaries;
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Get history error:", error.message);
      return [];
    }
  }

  /**
   * Удалить сводки старше N дней
   */
  private async cleanupOldForecasts(): Promise<void> {
    try {
      const files = await fs.readdir(this.STORAGE_DIR);
      const now = new Date();

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(this.STORAGE_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const summary: ForecastSummary = JSON.parse(content);

        const summaryDate = new Date(summary.date);
        const daysDiff = Math.floor(
          (now.getTime() - summaryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff > this.MAX_AGE_DAYS) {
          await fs.unlink(filePath);
          console.log(`[FORECAST STORAGE] Deleted old forecast: ${file}`);
        }
      }
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Cleanup error:", error.message);
    }
  }

  /**
   * Получить статистику
   */
  async getStats(): Promise<{
    total: number;
    oldestDate: string | null;
    newestDate: string | null;
  }> {
    try {
      const files = await fs.readdir(this.STORAGE_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        return { total: 0, oldestDate: null, newestDate: null };
      }

      const sorted = jsonFiles.sort();
      const oldestFile = sorted[0];
      const newestFile = sorted[sorted.length - 1];

      return {
        total: jsonFiles.length,
        oldestDate: oldestFile.replace(".json", ""),
        newestDate: newestFile.replace(".json", ""),
      };
    } catch (error: any) {
      console.error("[FORECAST STORAGE] Get stats error:", error.message);
      return { total: 0, oldestDate: null, newestDate: null };
    }
  }
}

export const forecastStorage = new ForecastStorage();
