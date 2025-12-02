import axios from "axios";

const API_BASE_URL = "";

export interface Message {
  role: "user" | "assistant" | "system";
  text?: string;
  toolCallList?: any;
  toolResultList?: any;
}

export interface ChatResponse {
  response: string;
  conversationHistory: Message[];
  toolsUsed: boolean;
}

export async function sendMessage(
  message: string,
  conversationHistory: Message[]
): Promise<ChatResponse> {
  try {
    const response = await axios.post<ChatResponse>(
      `${API_BASE_URL}/api/chat`,
      {
        message,
        conversationHistory,
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.error || "Ошибка при отправке сообщения"
    );
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    await axios.get(`${API_BASE_URL}/api/health`);
    return true;
  } catch {
    return false;
  }
}
