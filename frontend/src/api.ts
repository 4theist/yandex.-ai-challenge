import axios from "axios";
import {
  ModelsConfig,
  ModelResult,
  CompareResponse,
  SessionConfig,
  CreateSessionResponse,
  DialogResponse,
  SessionStats,
  DialogSummary,
} from "./types";

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

// ============================================
// DIALOG API
// ============================================

/**
 * Создать новую сессию диалога
 */
export async function createDialogSession(
  provider: "yandex" | "openrouter",
  model: string,
  temperature: number,
  config?: Partial<SessionConfig>,
  options?: {
    systemPrompt?: string;
    maxTokens?: number;
  }
): Promise<CreateSessionResponse> {
  console.log("[API] Creating session:", {
    provider,
    model,
    temperature,
    config,
    options,
  });

  const response = await fetch(`${API_BASE_URL}api/dialog/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider,
      model,
      temperature,
      config,
      options,
    }),
  });

  console.log("[API] Response status:", response.status);
  console.log("[API] Response headers:", response.headers);

  // Получаем текст ответа для отладки
  const responseText = await response.text();
  console.log("[API] Response text:", responseText);

  if (!response.ok) {
    let error;
    try {
      error = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Server error: ${response.status} - ${responseText}`);
    }
    throw new Error(error.error || "Failed to create session");
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${responseText}`);
  }
}

/**
 * Отправить сообщение в диалог
 */
export async function sendDialogMessage(
  sessionId: string,
  message: string,
  options?: {
    systemPrompt?: string;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }
): Promise<DialogResponse> {
  const response = await fetch(`${API_BASE_URL}api/dialog/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      message,
      options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send message");
  }

  return response.json();
}

/**
 * Получить статистику сессии
 */
export async function getSessionStats(
  sessionId: string
): Promise<SessionStats> {
  const response = await fetch(`${API_BASE_URL}api/dialog/${sessionId}/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get stats");
  }

  return response.json();
}

/**
 * Обновить настройки сессии
 */
export async function updateSessionConfig(
  sessionId: string,
  config: Partial<SessionConfig>
): Promise<{ message: string; config: SessionConfig }> {
  const response = await fetch(
    `${API_BASE_URL}api/dialog/${sessionId}/config`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update config");
  }

  return response.json();
}

/**
 * Удалить сессию
 */
export async function deleteSession(
  sessionId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}api/dialog/${sessionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete session");
  }

  return response.json();
}

/**
 * Принудительно сжать текущие сообщения
 */
export async function compressSession(
  sessionId: string
): Promise<{ message: string; summary: DialogSummary; stats: SessionStats }> {
  const response = await fetch(
    `${API_BASE_URL}api/dialog/${sessionId}/compress`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to compress");
  }

  return response.json();
}
