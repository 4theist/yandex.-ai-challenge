import { CONFIG } from "../config/defaults";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "\x1b[36m", // Cyan
  [LogLevel.INFO]: "\x1b[32m", // Green
  [LogLevel.WARN]: "\x1b[33m", // Yellow
  [LogLevel.ERROR]: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m";

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Определяем минимальный уровень логирования из конфигурации
    const configLevel = CONFIG.LOGGING.LEVEL.toLowerCase();
    switch (configLevel) {
      case "debug":
        this.minLevel = LogLevel.DEBUG;
        break;
      case "warn":
        this.minLevel = LogLevel.WARN;
        break;
      case "error":
        this.minLevel = LogLevel.ERROR;
        break;
      default:
        this.minLevel = LogLevel.INFO;
    }

    // Если включен verbose режим, показываем все логи
    if (CONFIG.LOGGING.VERBOSE) {
      this.minLevel = LogLevel.DEBUG;
    }
  }

  /**
   * Форматирование лог-сообщения
   */
  private format(level: LogLevel, context: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const color = LOG_LEVEL_COLORS[level];

    let formatted = `${color}[${timestamp}] [${levelName}] [${context}]${RESET_COLOR} ${message}`;

    if (data !== undefined) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    return formatted;
  }

  /**
   * Логирование сообщения
   */
  private log(level: LogLevel, context: string, message: string, data?: any): void {
    if (level < this.minLevel) {
      return;
    }

    const formatted = this.format(level, context, message, data);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Debug лог (самый детальный уровень)
   */
  debug(context: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  /**
   * Info лог (обычная информация)
   */
  info(context: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, context, message, data);
  }

  /**
   * Warning лог (предупреждения)
   */
  warn(context: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, context, message, data);
  }

  /**
   * Error лог (ошибки)
   */
  error(context: string, message: string, error?: any): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;

    this.log(LogLevel.ERROR, context, message, errorData);
  }

  /**
   * Установить минимальный уровень логирования
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// Экспортируем singleton
export const logger = new Logger();
