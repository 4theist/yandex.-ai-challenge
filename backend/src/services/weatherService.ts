import axios from "axios";

export interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
    };
    wind_kph: number;
    humidity: number;
    feelslike_c: number;
    uv: number;
  };
}

export interface WeatherForecast {
  location: WeatherData["location"];
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        avgtemp_c: number;
        condition: {
          text: string;
          icon: string;
        };
        daily_chance_of_rain: number;
      };
    }>;
  };
}

export class WeatherService {
  private apiKey: string;
  private baseURL = "http://api.weatherapi.com/v1";

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("WEATHER_API_KEY должен быть установлен в .env");
    }
  }

  /**
   * Получить текущую погоду для города
   * @param city - Название города (например: "Moscow", "London", "New York")
   * @param aqi - Включить данные о качестве воздуха (по умолчанию: нет)
   */
  async getCurrentWeather(
    city: string,
    aqi: boolean = false
  ): Promise<{
    data: WeatherData;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    console.log(`[WEATHER] Getting current weather for: ${city}`);

    try {
      const response = await axios.get(`${this.baseURL}/current.json`, {
        params: {
          key: this.apiKey,
          q: city,
          aqi: aqi ? "yes" : "no",
        },
        timeout: 10000,
      });

      const latencyMs = Date.now() - startTime;

      console.log(`[WEATHER SUCCESS]`, {
        city,
        latencyMs,
        temp: response.data.current.temp_c,
      });

      return {
        data: response.data,
        latencyMs,
      };
    } catch (error: any) {
      console.error("[WEATHER API ERROR]", {
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message,
      });

      if (error.response?.status === 400) {
        throw new Error(`Город не найден: ${city}`);
      }

      throw new Error(
        `Weather API error: ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /**
   * Получить прогноз погоды на несколько дней
   * @param city - Название города
   * @param days - Количество дней прогноза (1-10)
   */
  async getForecast(
    city: string,
    days: number = 3
  ): Promise<{
    data: WeatherForecast;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    // Ограничиваем от 1 до 10 дней
    const daysCount = Math.max(1, Math.min(10, days));

    console.log(`[WEATHER] Getting ${daysCount}-day forecast for: ${city}`);

    try {
      const response = await axios.get(`${this.baseURL}/forecast.json`, {
        params: {
          key: this.apiKey,
          q: city,
          days: daysCount,
          aqi: "no",
          alerts: "no",
        },
        timeout: 10000,
      });

      const latencyMs = Date.now() - startTime;

      console.log(`[WEATHER FORECAST SUCCESS]`, {
        city,
        days: daysCount,
        latencyMs,
      });

      return {
        data: response.data,
        latencyMs,
      };
    } catch (error: any) {
      console.error("[WEATHER FORECAST ERROR]", error.message);

      if (error.response?.status === 400) {
        throw new Error(`Город не найден: ${city}`);
      }

      throw new Error(
        `Weather API error: ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /**
   * Форматировать данные погоды для ответа агенту (сжатый формат)
   */
  formatWeatherForAgent(weatherData: WeatherData): string {
    const { location, current } = weatherData;

    return `📍 ${location.name}, ${location.country}
🌡️ Температура: ${current.temp_c}°C (ощущается как ${current.feelslike_c}°C)
☁️ Условия: ${current.condition.text}
💨 Ветер: ${current.wind_kph} км/ч
💧 Влажность: ${current.humidity}%
☀️ УФ индекс: ${current.uv}
🕐 Местное время: ${location.localtime}`;
  }

  /**
   * Форматировать прогноз для агента
   */
  formatForecastForAgent(forecastData: WeatherForecast): string {
    const { location, forecast } = forecastData;

    let result = `📍 Прогноз для ${location.name}, ${location.country}\n\n`;

    forecast.forecastday.forEach((day, index) => {
      result += `${index === 0 ? "📅 Сегодня" : `📅 ${day.date}`}:
🌡️ ${day.day.mintemp_c}°C ... ${day.day.maxtemp_c}°C (средняя: ${
        day.day.avgtemp_c
      }°C)
☁️ ${day.day.condition.text}
🌧️ Вероятность дождя: ${day.day.daily_chance_of_rain}%\n\n`;
    });

    return result;
  }
}

// Экспортируем синглтон
export const weatherService = new WeatherService();
