import axios from "axios";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private apiKey: string;
  private baseURL = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY должен быть установлен в .env");
    }
  }

  async sendMessage(
    model: string,
    message: string,
    temperature: number
  ): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    model: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await axios.post<OpenRouterResponse>(
        this.baseURL,
        {
          model: model,
          messages: [{ role: "user", content: message }],
          temperature: temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Models Comparison",
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      const latencyMs = Date.now() - startTime;

      return {
        text: response.data.choices[0].message.content,
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
        latencyMs,
        model,
      };
    } catch (error: any) {
      console.error("[OPENROUTER ERROR]", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      throw new Error(
        `OpenRouter API error: ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }
  }
}
