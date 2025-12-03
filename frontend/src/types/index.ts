// ========================================
// Базовые интерфейсы для сообщений
// ========================================

export interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

// ========================================
//  структура ответа агента-сборщика
// ========================================

export interface AgentResponse {
  status: "collecting" | "ready";
  reasoning: string;
  missingInfo: string[];
  question: string;
  result: any;
  confidence: number;
}

// ========================================
// Интерфейс для отображения сообщений в UI
// ========================================

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentResponse?: AgentResponse; // Полный ответ агента для рендеринга
}

// ========================================
// Состояние диалога (опционально, для удобства)
// ========================================

export interface ConversationState {
  sessionId: string | null;
  messages: DisplayMessage[];
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
}

// ========================================
// Ответы API эндпоинтов
// ========================================

export interface CreateSessionResponse {
  sessionId: string;
  message: string;
}

export interface SessionHistoryResponse {
  sessionId: string;
  isComplete: boolean;
  messageCount: number;
  history: Array<{
    role: string;
    content: string;
    status?: string;
    confidence?: number;
    reasoning?: string;
  }>;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  activeSessions: number;
}

// ========================================
// Типы ошибок
// ========================================

export interface APIError {
  error: string;
  details?: string;
}
