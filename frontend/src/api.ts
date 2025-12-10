import axios from "axios";
import { ModelsConfig, ModelResult, CompareResponse } from "./types";

const API_BASE_URL = "";

// Получить список моделей
export async function getModels(): Promise<ModelsConfig> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/models`);
    return response.data;
  } catch (error: any) {
    console.error("[GET MODELS ERROR]", error);
    throw new Error("Не удалось получить список моделей");
  }
}

// Single mode - одна модель
export async function sendToModel(
  message: string,
  temperature: number,
  provider: string,
  model: string
): Promise<ModelResult> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat`,
      {
        message,
        temperature,
        provider,
        model,
      },
      {
        timeout: 60000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("[SEND MESSAGE ERROR]", error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.details ||
        "Ошибка при отправке сообщения"
    );
  }
}

// Compare mode - две модели
export async function compareModels(
  message: string,
  temperature: number,
  model1: { provider: string; model: string },
  model2: { provider: string; model: string }
): Promise<CompareResponse> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/compare`,
      {
        message,
        temperature,
        model1,
        model2,
      },
      {
        timeout: 120000, // 2 минуты для двух моделей
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("[COMPARE ERROR]", error);
    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.details ||
        "Ошибка при сравнении моделей"
    );
  }
}

// Health check
export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
}> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    console.error("[HEALTH CHECK ERROR]", error);
    throw new Error("Сервер недоступен");
  }
}
