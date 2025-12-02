// Интерфейсы для обычного чата (с tools)
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
  metadata: {
    timestamp: string;
    model: string;
    status: string;
  };
}

// Интерфейсы для структурированного режима
export interface AgentResponse {
  status: "success" | "error";
  data: {
    answer: string;
    confidence: number;
  };
  metadata: {
    timestamp: string;
    model: string;
  };
}

// Интерфейс для отображения сообщений в UI
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isToolUsage?: boolean;
  parsedData?: AgentResponse; // Для структурированного режима
}

// Режимы работы агента
export type AgentMode = "conversational" | "structured";

export interface AgentResponse {
  status: "success" | "error";
  data: {
    answer: string;
    confidence: number;
  };
  metadata: {
    timestamp: string;
    model: string;
  };
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  parsedData?: AgentResponse;
}
