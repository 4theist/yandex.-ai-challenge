import path from "path";

// Определяем пути через переменные окружения или используем текущую директорию
const BACKEND_ROOT = process.env.BACKEND_DIR || process.cwd();
const MONOREPO_ROOT = process.env.ROOT_DIR || path.resolve(BACKEND_ROOT, "../");
const FRONTEND_ROOT =
  process.env.FRONTEND_DIR || path.resolve(MONOREPO_ROOT, "frontend");

export const CONFIG = {
  /**
   * Настройки LLM моделей
   */
  LLM: {
    DEFAULT_TEMPERATURE: 0.6,
    STABLE_TEMPERATURE: 0.3,
    DEFAULT_MAX_TOKENS: 2000,
    SUMMARY_MAX_TOKENS: 500,
    SHORT_MAX_TOKENS: 100,
  },

  /**
   * Настройки сессий
   */
  SESSION: {
    TIMEOUT_MS: 60 * 60 * 1000,
    CLEANUP_INTERVAL_MS: 15 * 60 * 1000,
    COMPRESSION_ENABLED: true,
    COMPRESSION_THRESHOLD: 10,
  },

  /**
   * Настройки агентов
   */
  AGENT: {
    MAX_ITERATIONS: 5,
    TEMPERATURE: 0.6,
    MAX_TOKENS: 2000,
  },

  /**
   * Настройки API
   */
  API: {
    REQUEST_TIMEOUT_MS: 30 * 1000,
    MAX_RETRIES: 3,
  },

  /**
   * Настройки выполнения shell команд
   */
  SHELL: {
    /** Таймаут выполнения команды (60 секунд) */
    COMMAND_TIMEOUT_MS: 60 * 1000,
    /** Максимальный размер буфера вывода (10MB) */
    MAX_BUFFER_SIZE: 1024 * 1024 * 10,
    /** Рабочая директория по умолчанию (backend) */
    WORKING_DIRECTORY: BACKEND_ROOT,

    /**
     * Пути к разным проектам
     * Переопределяются через переменные окружения:
     * BACKEND_DIR, FRONTEND_DIR, ROOT_DIR
     */
    PROJECT_PATHS: {
      backend: BACKEND_ROOT,
      frontend: FRONTEND_ROOT,
      root: MONOREPO_ROOT,
    },
  },

  /**
   * Настройки планировщика
   */
  SCHEDULER: {
    WEATHER_UPDATE_INTERVAL_MS: 60 * 60 * 1000,
    FILE_CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000,
    MAX_FILE_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  },

  /**
   * Настройки логирования
   */
  LOGGING: {
    VERBOSE: process.env.LOG_VERBOSE === "true",
    LEVEL: process.env.LOG_LEVEL || "info",
  },
} as const;
