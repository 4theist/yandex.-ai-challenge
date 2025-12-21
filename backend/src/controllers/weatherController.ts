import { Request, Response } from "express";
import { weatherService } from "../services/weatherService";
import { agentService } from "../services/agentService";

export const weatherController = {
  /**
   * Получить погоду (текущую или прогноз)
   */
  async getWeather(req: Request, res: Response) {
    try {
      const { city, days } = req.body;

      if (days) {
        // Прогноз
        const forecast = await weatherService.getForecast(city, days);
        res.json({
          type: "forecast",
          data: forecast.data,
          latencyMs: forecast.latencyMs,
        });
      } else {
        // Текущая погода
        const weather = await weatherService.getCurrentWeather(city);
        res.json({
          type: "current",
          data: weather.data,
          latencyMs: weather.latencyMs,
        });
      }
    } catch (error: any) {
      console.error("[WEATHER ENDPOINT ERROR]", error.message);
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Получить доступные MCP tools
   */
  async getTools(req: Request, res: Response) {
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
  },
};
