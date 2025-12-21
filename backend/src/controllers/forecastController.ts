import { Request, Response } from "express";
import { forecastRunner } from "../jobs/forecastRunner";
import { forecastScheduler } from "../services/forecastScheduler";
import { forecastStorage } from "../services/forecastStorage";

export const forecastController = {
  /**
   * Получить последнюю сводку
   */
  async getLatest(req: Request, res: Response) {
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
  },

  /**
   * Получить историю сводок
   */
  async getHistory(req: Request, res: Response) {
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
  },

  /**
   * Получить текущую конфигурацию
   */
  async getConfig(req: Request, res: Response) {
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
  },

  /**
   * Обновить конфигурацию
   */
  async updateConfig(req: Request, res: Response) {
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
  },

  /**
   * Сгенерировать сводку прямо сейчас
   */
  async generateNow(req: Request, res: Response) {
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
  },

  /**
   * Получить логи forecast runner
   */
  async getLogs(req: Request, res: Response) {
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
  },

  /**
   * Получить статистику storage
   */
  async getStats(req: Request, res: Response) {
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
  },
};
