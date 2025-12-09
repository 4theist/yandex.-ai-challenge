import axios from "axios";
import { AgentResponse } from "./types";

const API_BASE_URL = "";

// Создание сессии
export async function createSession(): Promise<string> {
  try {
    const response = await axios.post<{ sessionId: string }>(
      `${API_BASE_URL}/api/session/create`,
      {},
      { timeout: 5000 }
    );

    console.log("[SESSION CREATED]", response.data.sessionId);
    return response.data.sessionId;
  } catch (error: any) {
    console.error("[SESSION CREATE ERROR]", error);
    throw new Error("Не удалось создать сессию");
  }
}

// Отправка сообщения с sessionId и temperature
export async function sendMessage(
  message: string,
  sessionId: string,
  temperature: number = 0.3
): Promise<AgentResponse> {
  try {
    const response = await axios.post<AgentResponse>(
      `${API_BASE_URL}/api/chat`,
      {
        message,
        sessionId,
        temperature,
      },
      { timeout: 30000 }
    );

    console.log("[MESSAGE SENT]", {
      status: response.data.status,
      confidence: response.data.confidence,
      temperature,
    });

    return response.data;
  } catch (error: any) {
    console.error("[SEND MESSAGE ERROR]", error);

    if (error.code === "ECONNABORTED") {
      throw new Error("Превышено время ожидания (30с)");
    }

    if (error.response?.status === 400) {
      throw new Error(error.response.data?.error || "Неверный запрос");
    }

    throw new Error(
      error.response?.data?.error ||
        error.response?.data?.details ||
        "Ошибка при отправке сообщения"
    );
  }
}

// Получение истории сессии
export async function getSessionHistory(sessionId: string): Promise<{
  sessionId: string;
  isComplete: boolean;
  messageCount: number;
  history: Array<{
    role: string;
    content: string;
    status?: string;
    confidence?: number;
    reasoning?: string;
    temperature?: number;
  }>;
}> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/session/${sessionId}/history`,
      { timeout: 5000 }
    );

    return response.data;
  } catch (error: any) {
    console.error("[GET HISTORY ERROR]", error);

    if (error.response?.status === 404) {
      throw new Error("Сессия не найдена");
    }

    throw new Error("Не удалось получить историю сессии");
  }
}

// Сброс сессии
export async function resetSession(sessionId: string): Promise<void> {
  try {
    await axios.post(
      `${API_BASE_URL}/api/session/${sessionId}/reset`,
      {},
      { timeout: 5000 }
    );

    console.log("[SESSION RESET]", sessionId);
  } catch (error: any) {
    console.error("[RESET SESSION ERROR]", error);

    if (error.response?.status === 404) {
      throw new Error("Сессия не найдена");
    }

    throw new Error("Не удалось сбросить сессию");
  }
}

// Health check с информацией о сессиях
export async function checkHealth(): Promise<{
  status: string;
  activeSessions: number;
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
