import axios from "axios";

const YANDEX_API_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

export interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

interface YandexRequest {
  modelUri: string;
  completionOptions: {
    stream: boolean;
    temperature: number;
    maxTokens: number;
  };
  messages: Message[];
}

interface YandexResponse {
  result: {
    alternatives: Array<{
      message: {
        role: string;
        text?: string;
      };
      status: string;
    }>;
    usage: any;
    modelVersion: string;
  };
}

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

export class YandexGPTService {
  private folderId: string;
  private apiKey: string;
  private modelUri: string;

  constructor() {
    this.folderId = process.env.YANDEX_FOLDER_ID || "";
    this.apiKey = process.env.YANDEX_API_KEY || "";
    this.modelUri = `gpt://${this.folderId}/yandexgpt/latest`;

    if (!this.folderId || !this.apiKey) {
      throw new Error(
        "YANDEX_FOLDER_ID и YANDEX_API_KEY должны быть установлены в .env"
      );
    }
  }

  /**
   * Системный промпт для гарантированного JSON
   */
  private getSystemPrompt(): string {
    return `Ты — AI-ассистент. Ты ВСЕГДА отвечаешь ТОЛЬКО валидным JSON в следующем формате:

{
  "status": "success",
  "data": {
    "answer": "текст твоего ответа здесь",
    "confidence": 0.95
  },
  "metadata": {
    "model": "yandexgpt"
  }
}

ПРАВИЛА:
1. Отвечай ТОЛЬКО JSON объектом, без текста до или после
2. НЕ используй markdown форматирование (без \`\`\`json)
3. Поле "answer" содержит развернутый ответ на вопрос пользователя
4. Поле "confidence" — твоя уверенность в ответе от 0 до 1
5. "status" всегда "success" если ответил, "error" если не можешь ответить
6. "timestamp" — текущее время в ISO формате
7. "model" всегда "yandexgpt"

Отвечай информативно и точно в поле "answer".`;
  }

  /**
   * Отправка запроса в Yandex GPT API
   */
  async sendRequest(userMessage: string): Promise<YandexResponse> {
    const messages: Message[] = [
      {
        role: "system",
        text: this.getSystemPrompt(),
      },
      {
        role: "user",
        text: userMessage,
      },
    ];

    const requestBody: YandexRequest = {
      modelUri: this.modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.3, // Низкая temp для стабильности
        maxTokens: 2000,
      },
      messages,
    };

    try {
      console.log("[REQUEST] Sending to YandexGPT...");

      const response = await axios.post<YandexResponse>(
        YANDEX_API_URL,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Api-Key ${this.apiKey}`,
            "x-folder-id": this.folderId,
          },
          timeout: 30000,
        }
      );

      console.log("[RESPONSE] Received:", {
        status: response.status,
        modelVersion: response.data.result.modelVersion,
      });

      return response.data;
    } catch (error: any) {
      console.error("[API ERROR]", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      throw new Error(
        `Ошибка YandexGPT API: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Валидация структуры ответа
   */
  private validateAgentResponse(data: any): data is AgentResponse {
    if (!data || typeof data !== "object") return false;

    if (!["success", "error"].includes(data.status)) return false;

    if (!data.data || typeof data.data !== "object") return false;
    if (typeof data.data.answer !== "string") return false;
    if (typeof data.data.confidence !== "number") return false;
    if (data.data.confidence < 0 || data.data.confidence > 1) return false;

    if (!data.metadata || typeof data.metadata !== "object") return false;
    if (typeof data.metadata.timestamp !== "string") return false;
    if (typeof data.metadata.model !== "string") return false;

    return true;
  }

  /**
   * Парсинг и очистка ответа от модели
   */
  parseResponse(rawResponse: YandexResponse): AgentResponse {
    try {
      const messageText = rawResponse.result.alternatives[0]?.message?.text;

      if (!messageText) {
        throw new Error("Пустой ответ от модели");
      }

      console.log("[RAW RESPONSE]", messageText.substring(0, 200));

      // Очистка от возможного markdown
      let cleanText = messageText.trim();

      const markdownJson = "```";
      const markdownBlock = "```";

      cleanText = cleanText
        .replaceAll(markdownJson, "")
        .replaceAll(markdownBlock, "")
        .trim();

      // Парсинг JSON
      let parsed: any;
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("[JSON PARSE ERROR]", parseError);
        console.error("[CLEAN TEXT]", cleanText);
        throw new Error(`Невалидный JSON от модели`);
      }

      // Валидация структуры
      if (!this.validateAgentResponse(parsed)) {
        console.error("[VALIDATION FAILED]", parsed);
        throw new Error("Ответ не соответствует схеме AgentResponse");
      }

      parsed.metadata.timestamp = new Date().toISOString();

      console.log("[PARSED SUCCESS]", {
        status: parsed.status,
        confidence: parsed.data.confidence,
        answerLength: parsed.data.answer.length,
      });

      return parsed;
    } catch (error: any) {
      console.error("[PARSE ERROR]", error.message);

      // Fallback ответ
      return {
        status: "error",
        data: {
          answer: `Ошибка обработки ответа модели: ${error.message}`,
          confidence: 0,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          model: "yandexgpt",
        },
      };
    }
  }

  /**
   * Главный метод с retry-логикой
   */
  async getStructuredResponse(
    userMessage: string,
    maxRetries: number = 3
  ): Promise<AgentResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ATTEMPT ${attempt}/${maxRetries}]`);

        const rawResponse = await this.sendRequest(userMessage);
        const parsed = this.parseResponse(rawResponse);

        // Если статус success, возвращаем
        if (parsed.status === "success") {
          return parsed;
        }

        // Если error от модели, но валидный JSON - тоже возвращаем
        console.warn("[MODEL ERROR]", parsed.data.answer);
        return parsed;
      } catch (error: any) {
        lastError = error;
        console.warn(`[ATTEMPT ${attempt} FAILED]`, error.message);

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.log(`[RETRY] Waiting ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Все попытки исчерпаны
    console.error(`[ALL RETRIES FAILED]`, lastError?.message);

    return {
      status: "error",
      data: {
        answer: `Не удалось получить ответ после ${maxRetries} попыток. Ошибка: ${lastError?.message}`,
        confidence: 0,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        model: "yandexgpt",
      },
    };
  }
}
