import { Request, Response, NextFunction } from "express";

/**
 * Валидация message (обязательное непустое поле)
 */
export const validateMessage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "message обязателен и должен быть непустой строкой",
    });
  }

  next();
};

/**
 * Валидация provider (yandex или openrouter)
 */
export const validateProvider = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { provider } = req.body;

  if (!provider || !["yandex", "openrouter"].includes(provider)) {
    return res.status(400).json({
      error: "provider должен быть 'yandex' или 'openrouter'",
    });
  }

  next();
};

/**
 * Валидация model (обязательное непустое поле)
 */
export const validateModel = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { model } = req.body;

  if (!model || typeof model !== "string") {
    return res.status(400).json({
      error: "model обязателен",
    });
  }

  next();
};

/**
 * Валидация model1 и model2 для сравнения
 */
export const validateCompareModels = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { model1, model2 } = req.body;

  if (!model1 || !model1.provider || !model1.model) {
    return res.status(400).json({
      error: "model1 должен содержать provider и model",
    });
  }

  if (!model2 || !model2.provider || !model2.model) {
    return res.status(400).json({
      error: "model2 должен содержать provider и model",
    });
  }

  next();
};

/**
 * Валидация sessionId и message для диалога
 */
export const validateDialogMessage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({
      error: "sessionId и message обязательны",
    });
  }

  next();
};

/**
 * Валидация provider и model для создания сессии
 */
export const validateSessionCreate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { provider, model } = req.body;

  if (!provider || !model) {
    return res.status(400).json({
      error: "provider и model обязательны",
    });
  }

  next();
};

/**
 * Валидация city для погоды
 */
export const validateCity = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { city } = req.body;

  if (!city) {
    return res.status(400).json({ error: "City is required" });
  }

  next();
};

/**
 * Валидация query для MCP pipeline
 */
export const validateMcpQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { query } = req.body;

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: "Query is required",
    });
  }

  next();
};
