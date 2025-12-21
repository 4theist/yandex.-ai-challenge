import express from "express";
import { chatController } from "../controllers/chatController";
import {
  validateMessage,
  validateProvider,
  validateModel,
  validateCompareModels,
} from "../middleware/validation";

const router = express.Router();

// Список доступных моделей
router.get("/models", chatController.getModels);

// Single mode - одна модель
router.post(
  "/chat",
  validateMessage,
  validateProvider,
  validateModel,
  chatController.singleChat
);

// Compare mode - две модели параллельно
router.post(
  "/compare",
  validateMessage,
  validateCompareModels,
  chatController.compareModels
);

export default router;
