
import { Response } from "express";

/**
 * Стандартизированный формат ошибки
 */
export interface ErrorResponse {
  error: string;
  details?: string;
  statusCode?: number;
  timestamp?: string;
}

/**
 * Типы ошибок для более детального логирования
 */
export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  API = "API_ERROR",
  DATABASE = "DATABASE_ERROR",
  AUTH = "AUTH_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL = "INTERNAL_ERROR",
}

/**
 * Класс для обработки ошибок
 */
export class ErrorHandler {
  /**
   * Логирование ошибки с контекстом
   */
  static logError(
    context: string,
    error: any,
    type: ErrorType = ErrorType.INTERNAL
  ): void {
    const timestamp = new Date().toISOString();

    console.error(`[${type}] [${context}] ${timestamp}`, {
      message: error.message || error,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });
  }

  /**
   * Отправка стандартизированного ответа об ошибке
   */
  static sendError(
    res: Response,
    statusCode: number,
    message: string,
    details?: string
  ): Response {
    return res.status(statusCode).json({
      error: message,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Обработка ошибок API провайдеров (Yandex, OpenRouter)
   */
  static handleAPIError(
    context: string,
    error: any
  ): { message: string; statusCode: number } {
    this.logError(context, error, ErrorType.API);

    // Извлекаем сообщение об ошибке из разных форматов API
    const errorMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Unknown API error";

    const statusCode = error.response?.status || 500;

    return {
      message: `${context}: ${errorMessage}`,
      statusCode,
    };
  }

  /**
   * Обработка ошибок валидации
   */
  static handleValidationError(
    res: Response,
    message: string
  ): Response {
    this.logError("VALIDATION", new Error(message), ErrorType.VALIDATION);
    return this.sendError(res, 400, message);
  }

  /**
   * Обработка ошибок "не найдено"
   */
  static handleNotFoundError(
    res: Response,
    resource: string
  ): Response {
    const message = `${resource} не найден`;
    this.logError("NOT_FOUND", new Error(message), ErrorType.NOT_FOUND);
    return this.sendError(res, 404, message);
  }

  /**
   * Обработка внутренних ошибок сервера
   */
  static handleInternalError(
    res: Response,
    context: string,
    error: any
  ): Response {
    this.logError(context, error, ErrorType.INTERNAL);
    return this.sendError(
      res,
      500,
      "Внутренняя ошибка сервера",
      error.message
    );
  }

  /**
   * Создание объекта ошибки для throw
   */
  static createError(message: string, statusCode: number = 500): Error & { statusCode: number } {
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = statusCode;
    return error;
  }

  /**
   * Проверка, является ли ошибка операционной (не критической)
   */
  static isOperationalError(error: any): boolean {
    if (error.isOperational !== undefined) {
      return error.isOperational;
    }
    // Ошибки с статус-кодами 4xx считаются операционными
    return error.statusCode >= 400 && error.statusCode < 500;
  }
}

/**
 * Хелперы для быстрого использования
 */
export const logError = ErrorHandler.logError.bind(ErrorHandler);
export const sendError = ErrorHandler.sendError.bind(ErrorHandler);
export const handleAPIError = ErrorHandler.handleAPIError.bind(ErrorHandler);
export const handleValidationError = ErrorHandler.handleValidationError.bind(ErrorHandler);
export const handleNotFoundError = ErrorHandler.handleNotFoundError.bind(ErrorHandler);
export const handleInternalError = ErrorHandler.handleInternalError.bind(ErrorHandler);
export const createError = ErrorHandler.createError.bind(ErrorHandler);
