export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tokens?: number;
  toolsCalled?: Array<{
    name: string;
    arguments: any;
    result: string;
  }>;
}

export interface Summary {
  content: string;
  messagesCount: number;
  createdAt: Date;
  originalTokens: number;
  summaryTokens: number;
}

export interface SessionConfig {
  compressionThreshold: number;
  compressionEnabled: boolean;
  summaryModel?: string;
  summaryProvider?: "yandex" | "openrouter";
}

export interface Session {
  sessionId: string;
  messages: Message[];
  summaries: Summary[];
  createdAt: Date;
  lastActivityAt: Date;
  totalMessages: number;
  provider: "yandex" | "openrouter";
  model: string;
  temperature: number;
  config: SessionConfig;
}
