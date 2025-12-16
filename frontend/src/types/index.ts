export interface ModelConfig {
  id: string;
  name: string;
  contextLimit: number;
  outputLimit?: number;
}

export interface ModelsConfig {
  yandex: ModelConfig[];
  openrouter: ModelConfig[];
}

export interface ModelResult {
  provider: string;
  model: string;
  text: string;
  metrics: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    currency: "₽" | "FREE";
    contextLimit: number;
    outputLimit: number;
    contextUsagePercent: number;
    outputUsagePercent: number;
  };
  warning?: string;
  error?: string;
}

export interface CompareResponse {
  results: [ModelResult, ModelResult];
  timestamp: string;
}
export interface ModelConfig {
  id: string;
  name: string;
  contextLimit: number;
  outputLimit?: number;
}

export interface ModelsConfig {
  yandex: ModelConfig[];
  openrouter: ModelConfig[];
}

export interface ModelResult {
  provider: string;
  model: string;
  text: string;
  metrics: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    currency: "₽" | "FREE";
    contextLimit: number;
    outputLimit: number;
    contextUsagePercent: number;
    outputUsagePercent: number;
  };
  warning?: string;
  error?: string;
}

export interface CompareResponse {
  results: [ModelResult, ModelResult];
  timestamp: string;
}

// Новые типы для диалогов
export interface DialogMessage {
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

export interface DialogSummary {
  content: string;
  messagesCount: number;
  createdAt: Date;
  originalTokens: number;
  summaryTokens: number;
}

export interface SessionConfig {
  compressionEnabled: boolean;
  compressionThreshold: number;
  summaryProvider?: "yandex" | "openrouter";
  summaryModel?: string;
}

export interface SessionStats {
  sessionId: string;
  totalMessages: number;
  currentMessages: number;
  summariesCount: number;
  contextTokens: number;
  originalTokensFromSummaries: number;
  summaryTokens: number;
  savedTokens: number;
  compressionRatio: string;
  config: SessionConfig;
}

export interface DialogResponse {
  result: ModelResult;
  stats: SessionStats;
  compressionTriggered: boolean;
  toolsCalled?: Array<{
    name: string;
    arguments: any;
    result: string;
  }>;
  iterations?: number;
  context: {
    messagesInContext: number;
    summariesCount: number;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  config: SessionConfig;
  message: string;
}

export interface SavedSessionInfo {
  sessionId: string;
  provider: string;
  model: string;
  totalMessages: number;
  lastActivity: string;
  createdAt: string;
}

export interface SessionsListResponse {
  sessions: SavedSessionInfo[];
  total: number;
}

export interface RestoreSessionResponse {
  message: string;
  session: {
    sessionId: string;
    provider: string;
    model: string;
    temperature: number;
    config: SessionConfig;
    createdAt: string;
    lastActivityAt: string;
  };
  stats: SessionStats;
  context: {
    messagesInContext: number;
    summariesCount: number;
  };
}
export interface SessionHistory {
  messages: DialogMessage[];
  summaries: DialogSummary[];
  context: DialogMessage[];
  totalMessages: number;
}
