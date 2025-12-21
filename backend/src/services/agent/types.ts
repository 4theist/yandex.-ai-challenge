/**
 * Agent module types
 */

export interface AgentResponse {
  answer: string;
  toolsCalled: Array<{
    name: string;
    arguments: any;
    result: string;
  }>;
  totalLatencyMs: number;
  totalTokens: number;
  iterations: number;
}

export interface AgentConfig {
  provider: "yandex" | "openrouter";
  model: string;
  maxIterations: number;
  temperature?: number;
  systemPrompt?: string;
}
