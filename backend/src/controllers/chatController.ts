import { Request, Response } from "express";
import { MODELS_CONFIG } from "../config/models";
import { callModel } from "../utils/modelCaller";
import { CONFIG } from "../config/defaults";

export const chatController = {
  /**
   * Получить список доступных моделей
   */
  async getModels(req: Request, res: Response) {
    res.json(MODELS_CONFIG);
  },

  /**
   * Single mode - отправить сообщение одной модели
   */
  async singleChat(req: Request, res: Response) {
    try {
      const { message, temperature, provider, model } = req.body;
      const temp = temperature !== undefined ? temperature : CONFIG.LLM.DEFAULT_TEMPERATURE;

      console.log(
        `[CHAT] ${provider}/${model} - "${message.substring(0, 50)}..."`
      );

      const result = await callModel(provider, model, message, temp);

      console.log(
        `[CHAT SUCCESS] ${result.metrics.latencyMs}ms, ${result.metrics.totalTokens} tokens`
      );

      res.json(result);
    } catch (error: any) {
      console.error("[CHAT ERROR]", error);
      res.status(500).json({
        error: "Не удалось получить ответ",
        details: error.message,
      });
    }
  },

  /**
   * Compare mode - сравнить две модели параллельно
   */
  async compareModels(req: Request, res: Response) {
    try {
      const { message, temperature, model1, model2 } = req.body;
      const temp = temperature !== undefined ? temperature : CONFIG.LLM.DEFAULT_TEMPERATURE;

      console.log(
        `[COMPARE] ${model1.provider}/${model1.model} vs ${model2.provider}/${model2.model}`
      );

      // Параллельный вызов обеих моделей
      const [result1, result2] = await Promise.all([
        callModel(model1.provider, model1.model, message, temp),
        callModel(model2.provider, model2.model, message, temp),
      ]);

      console.log(
        `[COMPARE SUCCESS] Model1: ${result1.metrics.latencyMs}ms, Model2: ${result2.metrics.latencyMs}ms`
      );

      res.json({
        results: [result1, result2],
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[COMPARE ERROR]", error);
      res.status(500).json({
        error: "Не удалось сравнить модели",
        details: error.message,
      });
    }
  },
};
