import axios from "axios";
import { AgentResponse } from "./types";

const API_BASE_URL = "";

export async function sendMessage(message: string): Promise<AgentResponse> {
  try {
    const response = await axios.post<AgentResponse>(
      `${API_BASE_URL}/api/chat`,
      { message },
      { timeout: 30000 }
    );

    return response.data;
  } catch (error: any) {
    if (error.code === "ECONNABORTED") {
      throw new Error("Превышено время ожидания (30с)");
    }
    throw new Error(
      error.response?.data?.data?.answer ||
        error.response?.data?.error ||
        "Ошибка при отправке сообщения"
    );
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
