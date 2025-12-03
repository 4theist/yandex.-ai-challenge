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
  status: "collecting" | "ready";
  reasoning: string;
  missingInfo: string[];
  question: string;
  result: any;
  confidence: number;
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
   * Системный промпт для агента-сборщика
   */
  private getSystemPrompt(): string {
    return `Ты - интеллектуальный ассистент, который помогает пользователю получить детальный ответ на его запрос.

ТВОЯ РОЛЬ:
1. Проанализируй запрос пользователя и определи, какая информация необходима для полного ответа
2. Задавай уточняющие вопросы по одному, чтобы собрать недостающие данные
3. После каждого ответа пользователя оценивай: достаточно ли информации для формирования финального результата
4. Когда данных достаточно - сформируй детальный результат

КРИТЕРИИ ДОСТАТОЧНОСТИ ДАННЫХ:
- Собраны все ключевые параметры, специфичные для данного типа запроса
- Устранены критические неопределенности (например: бюджет, предпочтения, ограничения)
- Дополнительные вопросы не изменят суть результата значительно
- Минимум 2-3 уточняющих вопроса задано (если только запрос изначально не содержит всю информацию)

ФОРМАТ ОТВЕТА:
ОБЯЗАТЕЛЬНО отвечай ТОЛЬКО валидным JSON в следующем формате (без markdown, без комментариев):

Если нужны уточнения:
{
  "status": "collecting",
  "reasoning": "краткий анализ",
  "missingInfo": ["элемент1", "элемент2"],
  "question": "текст следующего вопроса",
  "result": {},
  "confidence": 30
}

Если данных достаточно:
{
  "status": "ready",
  "reasoning": "краткий анализ",
  "missingInfo": [],
  "question": "",
  "result": {"любая": "структура с данными"},
  "confidence": 95
}

ВАЖНО:
1. ВСЕГДА включай ВСЕ 6 полей: status, reasoning, missingInfo, question, result, confidence
2. Если поле не нужно - используй пустое значение ("" для строк, [] для массивов, {} для объектов)
3. НЕ используй markdown форматирование (без \`\`\`json)
4. confidence - число от 0 до 100
5. status - только "collecting" или "ready"
6. Переходи в status="ready" когда дополнительные уточнения не добавят значимой ценности`;
  }

  /**
   * Отправка запроса в YandexGPT API
   */
  async sendRequest(messages: Message[]): Promise<YandexResponse> {
    const requestBody: YandexRequest = {
      modelUri: this.modelUri,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens: 2000,
      },
      messages,
    };

    try {
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
   * Определение языка пользователя по первому сообщению
   */
  private detectLanguage(messages: Message[]): "ru" | "en" {
    const userMessage = messages.find((m) => m.role === "user");
    if (!userMessage?.text) return "ru";

    // Если есть кириллица - русский
    const hasCyrillic = /[\u0400-\u04FF]/.test(userMessage.text);
    return hasCyrillic ? "ru" : "en";
  }

  /**
   * Проверка на отказ модели
   */
  private isModelRefusal(text: string): boolean {
    const refusalPatterns = [
      /я не могу/i,
      /не могу обсуждать/i,
      /не могу помочь/i,
      /я не буду/i,
      /давайте поговорим о чём-нибудь/i,
      /i cannot/i,
      /i can't/i,
      /i am unable to/i,
      /let's talk about something else/i,
    ];

    return refusalPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Создание ответа при отказе модели
   */
  private createRefusalResponse(refusalText: string): AgentResponse {
    return {
      status: "ready",
      reasoning: "Модель отказалась обрабатывать запрос",
      missingInfo: [],
      question: "",
      result: {
        сообщение: refusalText.trim(),
      },
      confidence: 100,
    };
  }

  /**
   * Перевод ключей JSON через YandexGPT
   */
  private async translateKeysWithLLM(
    result: any,
    targetLang: "ru" | "en"
  ): Promise<any> {
    if (
      !result ||
      typeof result !== "object" ||
      Object.keys(result).length === 0
    ) {
      return result;
    }

    // Проверяем, нужен ли перевод
    const firstKey = Object.keys(result)[0];
    const hasCyrillic = /[\u0400-\u04FF]/.test(firstKey);

    if (targetLang === "ru" && hasCyrillic) {
      console.log("[KEYS ALREADY IN RUSSIAN]");
      return result;
    }
    if (targetLang === "en" && !hasCyrillic) {
      console.log("[KEYS ALREADY IN ENGLISH]");
      return result;
    }

    try {
      const translationPrompt =
        targetLang === "ru"
          ? `Переведи ТОЛЬКО названия ключей (keys) этого JSON объекта на русский язык. Значения (values) оставь БЕЗ ИЗМЕНЕНИЙ. Верни ТОЛЬКО валидный JSON без текста, комментариев и markdown.

Исходный JSON:
${JSON.stringify(result, null, 2)}

Пример:
Было: {"name": "Pizza", "ingredients": ["flour", "cheese"]}
Стало: {"название": "Pizza", "ингредиенты": ["flour", "cheese"]}`
          : `Translate ONLY the keys of this JSON object to English. Keep ALL values unchanged. Return ONLY valid JSON without any text, comments or markdown.

Original JSON:
${JSON.stringify(result, null, 2)}

Example:
Before: {"название": "Пицца", "ингредиенты": ["мука", "сыр"]}
After: {"name": "Пицца", "ingredients": ["мука", "сыр"]}`;

      const messages: Message[] = [
        {
          role: "system",
          text: "Ты переводчик JSON структур. Переводишь ТОЛЬКО ключи, все значения оставляешь в оригинале. Возвращаешь только валидный JSON без комментариев.",
        },
        {
          role: "user",
          text: translationPrompt,
        },
      ];

      console.log("[TRANSLATING KEYS] Sending translation request to LLM...");

      const response = await this.sendRequest(messages);
      const translatedText = response.result.alternatives[0]?.message?.text;

      if (!translatedText) {
        console.warn("[TRANSLATION FAILED] Empty response, using original");
        return result;
      }

      // Очистка и парсинг
      let cleanText = translatedText;

      const markdownJson = "```";
      const markdownBlock = "```";

      cleanText = cleanText
        .replaceAll(markdownJson, "")
        .replaceAll(markdownBlock, "")
        .trim();

      const translated = JSON.parse(cleanText);

      console.log("[TRANSLATION SUCCESS]", {
        before: Object.keys(result).join(", "),
        after: Object.keys(translated).join(", "),
      });

      return translated;
    } catch (error: any) {
      console.error("[TRANSLATION ERROR]", error.message);
      console.warn("[FALLBACK] Using original keys");
      return result;
    }
  }

  /**
   * Валидация ответа агента
   */
  private validateAgentResponse(data: any): data is AgentResponse {
    if (!data || typeof data !== "object") {
      console.error("[VALIDATION] Not an object");
      return false;
    }

    if (!["collecting", "ready"].includes(data.status)) {
      console.error("[VALIDATION] Invalid status:", data.status);
      return false;
    }

    if (typeof data.reasoning !== "string") {
      console.error("[VALIDATION] Missing reasoning");
      return false;
    }

    if (typeof data.confidence !== "number") {
      console.error("[VALIDATION] Invalid confidence");
      return false;
    }

    if (data.confidence < 0 || data.confidence > 100) {
      console.error("[VALIDATION] Confidence out of range:", data.confidence);
      return false;
    }

    if (!("missingInfo" in data)) {
      console.error("[VALIDATION] Missing missingInfo field");
      return false;
    }

    if (!("question" in data)) {
      console.error("[VALIDATION] Missing question field");
      return false;
    }

    if (!("result" in data)) {
      console.error("[VALIDATION] Missing result field");
      return false;
    }

    if (data.status === "collecting") {
      if (typeof data.question !== "string" || !data.question.trim()) {
        console.error("[VALIDATION] Empty question in collecting mode");
        return false;
      }
    }

    if (data.status === "ready") {
      if (!data.result || typeof data.result !== "object") {
        console.error("[VALIDATION] Invalid result in ready mode");
        return false;
      }
    }

    return true;
  }

  /**
   * Парсинг и обработка ответа с переводом ключей
   */
  async parseResponseWithTranslation(
    rawResponse: YandexResponse,
    messages: Message[]
  ): Promise<AgentResponse> {
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

      // Проверка на отказ модели
      if (this.isModelRefusal(cleanText)) {
        console.warn("[MODEL REFUSAL DETECTED]", cleanText);
        return this.createRefusalResponse(cleanText);
      }

      // Парсинг JSON
      let parsed: any;
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("[JSON PARSE ERROR]", parseError);
        console.error("[CLEAN TEXT]", cleanText);

        // Если не JSON - считаем это отказом
        console.warn("[NON-JSON RESPONSE] Treating as refusal");
        return this.createRefusalResponse(cleanText);
      }

      // Перевод ключей в result если нужно
      if (
        parsed.result &&
        typeof parsed.result === "object" &&
        Object.keys(parsed.result).length > 0
      ) {
        const lang = this.detectLanguage(messages);
        console.log("[DETECTED USER LANGUAGE]", lang);

        if (lang === "ru") {
          parsed.result = await this.translateKeysWithLLM(parsed.result, "ru");
        }
      }

      // Валидация
      if (!this.validateAgentResponse(parsed)) {
        console.error("[VALIDATION FAILED]", parsed);
        throw new Error("Ответ не соответствует схеме AgentResponse");
      }

      console.log("[PARSED SUCCESS]", {
        status: parsed.status,
        confidence: parsed.confidence,
        hasQuestion: !!parsed.question,
        hasResult: !!parsed.result,
        resultKeys: parsed.result
          ? Object.keys(parsed.result).join(", ")
          : "none",
      });

      return parsed;
    } catch (error: any) {
      console.error("[PARSE ERROR]", error.message);
      throw error;
    }
  }

  /**
   * Главный метод получения ответа агента
   */
  async getAgentResponse(
    messages: Message[],
    maxRetries: number = 3
  ): Promise<AgentResponse> {
    const hasSystemPrompt = messages.some((m) => m.role === "system");
    const fullMessages = hasSystemPrompt
      ? messages
      : [
          { role: "system" as const, text: this.getSystemPrompt() },
          ...messages,
        ];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ATTEMPT ${attempt}/${maxRetries}]`);

        const rawResponse = await this.sendRequest(fullMessages);
        const parsed = await this.parseResponseWithTranslation(
          rawResponse,
          messages
        );

        return parsed;
      } catch (error: any) {
        lastError = error;
        console.warn(`[ATTEMPT ${attempt} FAILED]`, error.message);

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[RETRY] Waiting ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Не удалось получить ответ после ${maxRetries} попыток: ${lastError?.message}`
    );
  }
}
