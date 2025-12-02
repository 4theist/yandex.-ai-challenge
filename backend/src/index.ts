import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { YandexGPTService } from "./yandexService";
import { executeTool } from "./tools";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

const yandexService = new YandexGPTService();

interface ChatMessage {
  role: "user" | "assistant" | "system";
  text?: string;
  toolCallList?: any;
  toolResultList?: any;
}

// Эндпоинт для чата
app.post("/api/chat", async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Сообщение обязательно" });
    }

    // Формируем историю сообщений
    const messages: ChatMessage[] = conversationHistory || [];
    messages.push({
      role: "user",
      text: message,
    });

    // Первый запрос к модели
    let response = await yandexService.sendRequest(messages);
    let alternative = response.result.alternatives[0];

    // Проверяем, нужно ли вызвать инструменты
    if (
      alternative.status === "ALTERNATIVE_STATUS_TOOL_CALLS" &&
      alternative.message.toolCallList
    ) {
      const toolCalls = alternative.message.toolCallList.toolCalls;
      const toolResults = [];

      // Выполняем каждый вызов инструмента
      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.functionCall;
        console.log(`Executing tool: ${name} with args:`, args);

        const result = executeTool(name, args);
        toolResults.push({
          functionResult: {
            name,
            content: result,
          },
        });
      }

      // Добавляем ответ модели с вызовом инструментов
      messages.push({
        role: "assistant",
        toolCallList: alternative.message.toolCallList,
      });

      // Добавляем результаты выполнения инструментов
      messages.push({
        role: "user",
        toolResultList: {
          toolResults,
        },
      });

      // Второй запрос к модели с результатами инструментов
      response = await yandexService.sendRequest(messages);
      alternative = response.result.alternatives[0];
    }

    // Добавляем финальный ответ в историю
    messages.push({
      role: "assistant",
      text: alternative.message.text,
    });

    res.json({
      response: alternative.message.text,
      conversationHistory: messages,
      toolsUsed:
        alternative.status === "ALTERNATIVE_STATUS_FINAL"
          ? messages.filter((m) => m.toolCallList).length > 0
          : false,
    });
  } catch (error: any) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Ошибка сервера",
      details: error.message,
    });
  }
});

// Проверка здоровья сервера
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
