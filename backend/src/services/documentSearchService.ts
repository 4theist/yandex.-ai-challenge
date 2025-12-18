import fs from "fs/promises";
import path from "path";
import { ForecastSummary } from "./forecastStorage";

interface SearchResult {
  found: number;
  forecasts: ForecastSummary[];
  dateRange: {
    from: string;
    to: string;
  };
}

class DocumentSearchService {
  private readonly FORECASTS_DIR = path.join(__dirname, "../../data/forecasts");

  /**
   * Поиск прогнозов за последние N дней
   */
  async searchForecasts(
    days: number = 7,
    cities?: string[]
  ): Promise<SearchResult> {
    try {
      console.log(
        `[DOCUMENT SEARCH] Searching forecasts for last ${days} days`
      );

      const files = await fs.readdir(this.FORECASTS_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      const forecasts: ForecastSummary[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.FORECASTS_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const forecast: ForecastSummary = JSON.parse(content);

        const forecastDate = new Date(forecast.date);

        // Проверяем что прогноз в нужном диапазоне дат
        if (forecastDate >= startDate && forecastDate <= now) {
          // Фильтрация по городам если указаны
          if (cities && cities.length > 0) {
            const hasCities = cities.some((city) =>
              Object.keys(forecast.summaries).includes(city)
            );
            if (!hasCities) continue;
          }

          forecasts.push(forecast);
        }
      }

      // Сортируем по дате (старые → новые)
      forecasts.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      console.log(`[DOCUMENT SEARCH] Found ${forecasts.length} forecasts`);

      return {
        found: forecasts.length,
        forecasts,
        dateRange: {
          from: startDate.toISOString(),
          to: now.toISOString(),
        },
      };
    } catch (error: any) {
      console.error("[DOCUMENT SEARCH] Error:", error.message);
      throw new Error(`Failed to search forecasts: ${error.message}`);
    }
  }

  /**
   * Поиск по текстовым файлам (если будут .txt заметки)
   */
  async searchTextFiles(query: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.FORECASTS_DIR);
      const txtFiles = files.filter((f) => f.endsWith(".txt"));

      const results: string[] = [];

      for (const file of txtFiles) {
        const filePath = path.join(this.FORECASTS_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");

        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push(content);
        }
      }

      return results;
    } catch (error: any) {
      console.error("[DOCUMENT SEARCH] Text search error:", error.message);
      return [];
    }
  }

  /**
   * Получить статистику по найденным прогнозам
   */
  async getSearchStats(forecasts: ForecastSummary[]): Promise<{
    totalForecasts: number;
    cities: string[];
    dateRange: string;
    totalTokens: number;
  }> {
    const cities = new Set<string>();
    let totalTokens = 0;

    forecasts.forEach((f) => {
      Object.keys(f.summaries).forEach((city) => cities.add(city));
      totalTokens += f.tokensUsed || 0;
    });

    const dates = forecasts.map((f) => new Date(f.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      totalForecasts: forecasts.length,
      cities: Array.from(cities),
      dateRange: `${minDate.toLocaleDateString(
        "ru-RU"
      )} - ${maxDate.toLocaleDateString("ru-RU")}`,
      totalTokens,
    };
  }
}

export const documentSearchService = new DocumentSearchService();
