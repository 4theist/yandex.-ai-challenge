import { weatherService } from "../services/weatherService";
import { YandexGPTService } from "../services/yandexService";

export interface CitySummary {
  city: string;
  summary: string;
  weatherData: any;
}

class WeatherSummaryAgent {
  private yandex = new YandexGPTService();

  /**
   * Генерация краткой сводки для списка городов
   */
  async generateSummary(cities: string[]): Promise<{
    summaries: { [city: string]: string };
    weatherData: { [city: string]: any };
    totalTokens: number;
  }> {
    console.log(
      `[SUMMARY AGENT] Generating summaries for: ${cities.join(", ")}`
    );

    const results: { [city: string]: string } = {};
    const weatherData: { [city: string]: any } = {};
    let totalTokens = 0;

    for (const city of cities) {
      try {
        // Шаг 1: Получить погоду
        const weather = await weatherService.getCurrentWeather(city);
        weatherData[city] = weather.data;

        // Шаг 2: Форматировать для промпта
        const weatherInfo = `
Город: ${weather.data.location.name}
Температура: ${weather.data.current.temp_c}°C
Ощущается как: ${weather.data.current.feelslike_c}°C
Погода: ${weather.data.current.condition.text}
Ветер: ${weather.data.current.wind_kph} км/ч
Влажность: ${weather.data.current.humidity}%
`;

        // Шаг 3: Сгенерировать краткое описание через LLM
        const prompt = `${weatherInfo}

Создай ОЧЕНЬ краткую погодную сводку (максимум 50 символов).
Формат: "ГОРОД: температура погода рекомендация"
Используй 1-2 эмодзи.
Пример: "МСК: -5°C ☁️ Тепло одевайся!"

Твоя сводка:`;

        const response = await this.yandex.sendMessage(
          "yandexgpt-lite",
          prompt,
          0.3,
          "Ты создаёшь краткие погодные сводки. Пиши кратко и ёмко.",
          100
        );

        totalTokens += response.totalTokens;

        // Очищаем ответ от лишнего
        let summary = response.text.trim();
        summary = summary.replace(/^["']|["']$/g, "");
        summary = summary.split("\n")[0];

        results[city] = summary;

        console.log(
          `[SUMMARY AGENT] ${city}: "${summary}" (${response.totalTokens} tokens)`
        );
      } catch (error: any) {
        console.error(`[SUMMARY AGENT] Error for ${city}:`, error.message);
        results[city] = `${city}: Ошибка получения данных`;
        weatherData[city] = null;
      }
    }

    console.log(
      `[SUMMARY AGENT] ✓ Generated ${cities.length} summaries, total tokens: ${totalTokens}`
    );

    return {
      summaries: results,
      weatherData,
      totalTokens,
    };
  }

  /**
   * Быстрая генерация без LLM (для тестов или если токены кончились)
   */
  generateSimpleSummary(city: string, weatherData: any): string {
    const temp = weatherData.current.temp_c;
    const condition = weatherData.current.condition.text;

    let emoji = "🌤️";
    if (condition.includes("облачно") || condition.includes("Облачно"))
      emoji = "☁️";
    if (condition.includes("дождь") || condition.includes("Дождь"))
      emoji = "🌧️";
    if (condition.includes("снег") || condition.includes("Снег")) emoji = "🌨️";
    if (condition.includes("ясно") || condition.includes("Ясно")) emoji = "☀️";

    let recommendation = "";
    if (temp < -10) recommendation = "Очень холодно!";
    else if (temp < 0) recommendation = "Тепло одевайся!";
    else if (temp < 10) recommendation = "Прохладно";
    else recommendation = "Комфортно";

    const cityShort =
      city === "Moscow" ? "МСК" : city === "Saint Petersburg" ? "СПБ" : city;

    return `${cityShort}: ${temp}°C ${emoji} ${recommendation}`;
  }
}

export const weatherSummaryAgent = new WeatherSummaryAgent();
