import { YandexGPTService } from "../services/llm/yandexService";
import { OpenRouterService } from "../services/llm/openRouterService";

/**
 * Фабрика сервисов с lazy initialization
 */
class ServiceFactory {
  private static instance: ServiceFactory;

  // Singleton экземпляры сервисов
  private yandexService: YandexGPTService | null = null;
  private openRouterService: OpenRouterService | null = null;

  private constructor() {
    // Приватный конструктор для singleton pattern
  }

  /**
   * Получить singleton-экземпляр фабрики
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Получить YandexGPT сервис (lazy initialization)
   */
  public getYandexService(): YandexGPTService {
    if (!this.yandexService) {
      console.log("[SERVICE FACTORY] Initializing YandexGPTService");
      this.yandexService = new YandexGPTService();
    }
    return this.yandexService;
  }

  /**
   * Получить OpenRouter сервис (lazy initialization)
   */
  public getOpenRouterService(): OpenRouterService {
    if (!this.openRouterService) {
      console.log("[SERVICE FACTORY] Initializing OpenRouterService");
      this.openRouterService = new OpenRouterService();
    }
    return this.openRouterService;
  }

  /**
   * Получить LLM-сервис по имени провайдера
   */
  public getLLMService(
    provider: "yandex" | "openrouter"
  ): YandexGPTService | OpenRouterService {
    if (provider === "yandex") {
      return this.getYandexService();
    } else {
      return this.getOpenRouterService();
    }
  }

  /**
   * Сбросить все сервисы (для тестирования)
   */
  public reset(): void {
    console.log("[SERVICE FACTORY] Resetting all services");
    this.yandexService = null;
    this.openRouterService = null;
  }

  /**
   * Проверить, инициализирован ли сервис
   */
  public isServiceInitialized(
    provider: "yandex" | "openrouter"
  ): boolean {
    if (provider === "yandex") {
      return this.yandexService !== null;
    } else {
      return this.openRouterService !== null;
    }
  }
}

// Экспортируем singleton-экземпляр фабрики
export const serviceFactory = ServiceFactory.getInstance();

// Экспортируем удобные функции-хелперы
export const getYandexService = () => serviceFactory.getYandexService();
export const getOpenRouterService = () => serviceFactory.getOpenRouterService();
export const getLLMService = (provider: "yandex" | "openrouter") =>
  serviceFactory.getLLMService(provider);
