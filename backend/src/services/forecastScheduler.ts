import * as cron from "node-cron";
import fs from "fs/promises";
import path from "path";

export interface ForecastConfig {
  schedule: string; // cron format
  cities: string[];
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

class ForecastScheduler {
  private task: cron.ScheduledTask | null = null;
  private config: ForecastConfig | null = null;
  private readonly CONFIG_PATH = path.join(
    __dirname,
    "../../data/forecast-config.json"
  );
  private jobCallback: (() => Promise<void>) | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Загрузить конфигурацию из файла
   */
  private async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.CONFIG_PATH, "utf-8");
      this.config = JSON.parse(content);
      console.log("[FORECAST SCHEDULER] Config loaded:", this.config);
    } catch (error: any) {
      // Если файла нет - создаём дефолтную конфигурацию
      this.config = {
        schedule: "0 8 * * *", // Каждый день в 8:00
        cities: ["Moscow", "Saint Petersburg"],
        enabled: true,
        lastRun: null,
        nextRun: null,
      };
      await this.saveConfig();
      console.log("[FORECAST SCHEDULER] Created default config");
    }
  }

  /**
   * Сохранить конфигурацию в файл
   */
  private async saveConfig(): Promise<void> {
    try {
      const dir = path.dirname(this.CONFIG_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.CONFIG_PATH,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
      console.log("[FORECAST SCHEDULER] Config saved");
    } catch (error: any) {
      console.error(
        "[FORECAST SCHEDULER] Failed to save config:",
        error.message
      );
    }
  }

  /**
   * Запустить планировщик
   */
  async start(callback: () => Promise<void>): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config!.enabled) {
      console.log("[FORECAST SCHEDULER] Disabled in config, skipping start");
      return;
    }

    this.jobCallback = callback;

    // Валидация cron выражения
    if (!cron.validate(this.config!.schedule)) {
      console.error(
        "[FORECAST SCHEDULER] Invalid cron expression:",
        this.config!.schedule
      );
      return;
    }

    // Создаём задачу
    this.task = cron.schedule(this.config!.schedule, async () => {
      console.log(
        `[FORECAST SCHEDULER] Executing scheduled task at ${new Date().toISOString()}`
      );

      try {
        await this.jobCallback!();

        this.config!.lastRun = new Date().toISOString();
        await this.saveConfig();
      } catch (error: any) {
        console.error(
          "[FORECAST SCHEDULER] Task execution error:",
          error.message
        );
      }
    });

    // Вычисляем следующий запуск
    this.updateNextRun();

    console.log(
      `[FORECAST SCHEDULER] ✓ Started with schedule: ${this.config!.schedule}`
    );
    console.log(`[FORECAST SCHEDULER] Next run: ${this.config!.nextRun}`);
  }

  /**
   * Остановить планировщик
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log("[FORECAST SCHEDULER] Stopped");
    }
  }

  /**
   * Обновить расписание
   */
  async updateSchedule(cronExpression: string): Promise<void> {
    if (!cron.validate(cronExpression)) {
      throw new Error("Invalid cron expression");
    }

    this.config!.schedule = cronExpression;
    await this.saveConfig();

    // Перезапускаем с новым расписанием
    if (this.task && this.jobCallback) {
      this.stop();
      await this.start(this.jobCallback);
    }

    console.log(`[FORECAST SCHEDULER] Schedule updated to: ${cronExpression}`);
  }

  /**
   * Включить/выключить планировщик
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.config!.enabled = enabled;
    await this.saveConfig();

    if (enabled && !this.task && this.jobCallback) {
      await this.start(this.jobCallback);
    } else if (!enabled && this.task) {
      this.stop();
    }

    console.log(`[FORECAST SCHEDULER] ${enabled ? "Enabled" : "Disabled"}`);
  }

  /**
   * Получить текущую конфигурацию
   */
  getConfig(): ForecastConfig | null {
    return this.config;
  }

  /**
   * Вычислить время следующего запуска
   */
  private updateNextRun(): void {
    if (!this.task || !this.config) return;

    // Простая эвристика: парсим cron и вычисляем
    const now = new Date();
    const parts = this.config.schedule.split(" ");

    // Для "0 8 * * *" (каждый день в 8:00)
    if (parts[0] === "0" && parts[1]) {
      const hour = parseInt(parts[1]);
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      this.config.nextRun = next.toISOString();
    } else {
      this.config.nextRun = "Unable to calculate";
    }
  }

  /**
   * Выполнить задачу сейчас (для тестирования)
   */
  async runNow(): Promise<void> {
    if (!this.jobCallback) {
      throw new Error("No job callback registered");
    }

    console.log("[FORECAST SCHEDULER] Manual execution triggered");
    await this.jobCallback();

    this.config!.lastRun = new Date().toISOString();
    await this.saveConfig();
  }
}

export const forecastScheduler = new ForecastScheduler();
