import express from "express";
import { ErrorHandler, ErrorType } from "../utils/errorHandler";

export const globalErrorHandler = (
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  ErrorHandler.logError("GLOBAL", err, ErrorType.INTERNAL);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Внутренняя ошибка сервера";

  res.status(statusCode).json({
    error: message,
    details: err.details || err.message,
    timestamp: new Date().toISOString(),
  });
};
