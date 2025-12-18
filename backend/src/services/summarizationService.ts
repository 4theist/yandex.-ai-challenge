import { YandexGPTService } from "./yandexService";
import { ForecastSummary } from "./forecastStorage";

export type SummaryType = "retrospective" | "forecast";

interface SummarizationResult {
  summary: string;
  tokensUsed: number;
  type: SummaryType;
  processedItems: number;
}

class SummarizationService {
  private yandex = new YandexGPTService();

  /**
   * Создать ретроспективную сводку (за прошлый период)
   */
  async createRetrospectiveSummary(
    forecasts: ForecastSummary[]
  ): Promise<SummarizationResult> {
    console.log(
      `[SUMMARIZATION] Creating retrospective summary for ${forecasts.length} forecasts`
    );

    if (forecasts.length === 0) {
      return {
        summary: "Нет данных для анализа",
        tokensUsed: 0,
        type: "retrospective",
        processedItems: 0,
      };
    }

    // Формируем данные для анализа
    const dataForAnalysis = this.formatForecastsForAnalysis(forecasts);

    // Промпт для ретроспективы
    const prompt = `Проанализируй погодные данные за прошедший период и создай краткую сводку.

Данные:
${dataForAnalysis}

Создай краткую сводку (максимум 300 символов) в формате:
- Период
- Средние температуры по городам
- Основные погодные явления
- Краткая рекомендация

Пиши кратко и по делу.`;

    try {
      const response = await this.yandex.sendMessage(
        "yandexgpt-lite", // Используем lite для экономии
        prompt,
        0.3, // Низкая температура для стабильности
        "Ты создаёшь краткие погодные сводки на основе исторических данных.",
        500 // Лимит токенов
      );

      console.log(
        `[SUMMARIZATION] Retrospective summary created (${response.totalTokens} tokens)`
      );

      return {
        summary: response.text.trim(),
        tokensUsed: response.totalTokens,
        type: "retrospective",
        processedItems: forecasts.length,
      };
    } catch (error: any) {
      console.error("[SUMMARIZATION] Error:", error.message);
      throw new Error(`Failed to create summary: ${error.message}`);
    }
  }

  /**
   * Создать прогностическую сводку (на будущее)
   */
  async createForecastSummary(
    weatherData: any[]
  ): Promise<SummarizationResult> {
    console.log(
      `[SUMMARIZATION] Creating forecast summary for ${weatherData.length} days`
    );

    if (weatherData.length === 0) {
      return {
        summary: "Нет данных для прогноза",
        tokensUsed: 0,
        type: "forecast",
        processedItems: 0,
      };
    }

    // Формируем данные прогноза
    const dataForAnalysis = this.formatWeatherDataForForecast(weatherData);

    const prompt = `Создай краткий прогноз погоды на основе данных.

Данные прогноза:
${dataForAnalysis}

Создай краткую сводку-прогноз (максимум 300 символов):
- На какой период
- Ожидаемые температуры
- Основные погодные явления
- Рекомендации

Пиши кратко и информативно.`;

    try {
      const response = await this.yandex.sendMessage(
        "yandexgpt-lite",
        prompt,
        0.3,
        "Ты создаёшь краткие прогнозы погоды.",
        500
      );

      console.log(
        `[SUMMARIZATION] Forecast summary created (${response.totalTokens} tokens)`
      );

      return {
        summary: response.text.trim(),
        tokensUsed: response.totalTokens,
        type: "forecast",
        processedItems: weatherData.length,
      };
    } catch (error: any) {
      console.error("[SUMMARIZATION] Error:", error.message);
      throw new Error(`Failed to create forecast: ${error.message}`);
    }
  }

  /**
   * Форматирование исторических прогнозов для анализа
   */
  private formatForecastsForAnalysis(forecasts: ForecastSummary[]): string {
    const lines: string[] = [];

    forecasts.forEach((forecast) => {
      const date = new Date(forecast.date).toLocaleDateString("ru-RU");
      lines.push(`\n${date}:`);

      Object.entries(forecast.summaries).forEach(([city, summary]) => {
        lines.push(`  ${city}: ${summary}`);
      });
    });

    return lines.join("\n");
  }

  /**
   * Форматирование данных прогноза
   */
  private formatWeatherDataForForecast(weatherData: any[]): string {
    const lines: string[] = [];

    weatherData.forEach((day, index) => {
      lines.push(`День ${index + 1}:`);
      lines.push(`  Температура: ${day.temp_c}°C`);
      lines.push(`  Погода: ${day.condition}`);
      if (day.city) {
        lines.push(`  Город: ${day.city}`);
      }
    });

    return lines.join("\n");
  }

  /**
   * Суммаризация произвольного текста (общий метод)
   */
  async summarizeText(
    text: string,
    maxLength: number = 300
  ): Promise<SummarizationResult> {
    const prompt = `Создай краткое резюме следующего текста (максимум ${maxLength} символов):

${text}

Резюме:`;

    try {
      const response = await this.yandex.sendMessage(
        "yandexgpt-lite",
        prompt,
        0.3,
        "Ты создаёшь краткие резюме текстов.",
        500
      );

      return {
        summary: response.text.trim(),
        tokensUsed: response.totalTokens,
        type: "retrospective",
        processedItems: 1,
      };
    } catch (error: any) {
      throw new Error(`Failed to summarize: ${error.message}`);
    }
  }
}

export const summarizationService = new SummarizationService();
