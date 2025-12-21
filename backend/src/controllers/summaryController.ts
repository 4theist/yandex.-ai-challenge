import { Request, Response } from "express";
import { documentSearchService } from "../services/documentSearchService";
import { summarizationService } from "../services/summarizationService";
import { fileWriterService } from "../services/fileWriterService";
import { weatherService } from "../services/weatherService";

export const summaryController = {
  /**
   * Создать ретроспективную сводку за N дней
   */
  async createRetrospective(req: Request, res: Response) {
    try {
      const { days = 7, cities } = req.body;

      console.log(`[RETROSPECTIVE SUMMARY] Generating for ${days} days`);

      // Шаг 1: Поиск прогнозов
      const searchResult = await documentSearchService.searchForecasts(
        days,
        cities
      );

      if (searchResult.found === 0) {
        return res.json({
          success: false,
          message: "Нет данных за указанный период",
        });
      }

      // Шаг 2: Суммаризация
      const summaryResult =
        await summarizationService.createRetrospectiveSummary(
          searchResult.forecasts
        );

      // Шаг 3: Сохранение в файл
      const savedFile = await fileWriterService.saveFile({
        content: summaryResult.summary,
        title: `Сводка за ${days} дней`,
        format: "md",
      });

      res.json({
        success: true,
        summary: summaryResult.summary,
        tokensUsed: summaryResult.tokensUsed,
        forecastsAnalyzed: searchResult.found,
        savedFile: {
          filename: savedFile.filename,
          path: savedFile.path,
          size: savedFile.size,
        },
      });
    } catch (error: any) {
      console.error("[RETROSPECTIVE SUMMARY ERROR]", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * Создать прогностическую сводку на N дней
   */
  async createForecast(req: Request, res: Response) {
    try {
      const { days = 7, cities = ["Moscow", "Saint Petersburg"] } = req.body;

      console.log(`[FORECAST SUMMARY] Generating for ${days} days ahead`);

      // Шаг 1: Получить прогноз погоды на будущее
      const forecastsData = [];

      for (const city of cities) {
        try {
          const forecast = await weatherService.getForecast(city, days);

          if (forecast.data?.forecast?.forecastday) {
            forecastsData.push(...forecast.data.forecast.forecastday);
          }
        } catch (error: any) {
          console.error(`Failed to get forecast for ${city}:`, error.message);
        }
      }

      if (forecastsData.length === 0) {
        return res.json({
          success: false,
          message: "Не удалось получить данные прогноза",
        });
      }

      // Шаг 2: Суммаризация
      const summaryResult = await summarizationService.createForecastSummary(
        forecastsData
      );

      // Шаг 3: Сохранение
      const savedFile = await fileWriterService.saveFile({
        content: summaryResult.summary,
        title: `Прогноз на ${days} дней`,
        format: "md",
      });

      res.json({
        success: true,
        summary: summaryResult.summary,
        tokensUsed: summaryResult.tokensUsed,
        daysAnalyzed: forecastsData.length,
        savedFile: {
          filename: savedFile.filename,
          path: savedFile.path,
          size: savedFile.size,
        },
      });
    } catch (error: any) {
      console.error("[FORECAST SUMMARY ERROR]", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * Скачать сохранённый файл сводки
   */
  async downloadFile(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      const content = await fileWriterService.readFile(filename);

      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(content);
    } catch (error: any) {
      console.error("[DOWNLOAD ERROR]", error);
      res.status(404).json({
        error: "File not found",
      });
    }
  },

  /**
   * Список сохранённых файлов
   */
  async listFiles(req: Request, res: Response) {
    try {
      const files = await fileWriterService.listFiles();
      res.json({
        count: files.length,
        files,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  },
};
