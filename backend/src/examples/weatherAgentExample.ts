import dotenv from "dotenv";
import path from "path";

// Загружаем .env ПЕРЕД всеми импортами
dotenv.config({ path: path.join(__dirname, "../../.env") });

// ОТЛАДКА: проверим загрузку переменных
console.log("\n[DEBUG] Environment variables check:");
console.log(
  "WEATHER_API_KEY:",
  process.env.WEATHER_API_KEY ? "✓ Loaded" : "✗ Missing"
);
console.log(
  "YANDEX_FOLDER_ID:",
  process.env.YANDEX_FOLDER_ID ? "✓ Loaded" : "✗ Missing"
);
console.log(
  "YANDEX_API_KEY:",
  process.env.YANDEX_API_KEY ? "✓ Loaded" : "✗ Missing"
);
console.log();

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { YandexGPTService } from "../services/yandexService";

async function weatherAgentDemo() {
  console.log("[AGENT DEMO] Starting Weather Agent...\n");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", path.join(__dirname, "../mcp/mcpServer.ts")],
  });

  const client = new Client(
    {
      name: "weather-agent",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log("[AGENT] ✓ Connected to MCP server\n");

    const userQuery = "Какая сейчас погода в Москве и стоит ли брать зонт?";
    console.log(`[USER]: ${userQuery}\n`);

    console.log("[AGENT] Calling weather tool...");
    const weatherResult = (await client.callTool({
      name: "get_current_weather",
      arguments: {
        city: "Moscow",
        formatForAgent: true,
      },
    })) as CallToolResult;

    const weatherInfo = (weatherResult.content[0] as TextContent).text;
    console.log("[AGENT] ✓ Weather data received");
    console.log(weatherInfo);
    console.log();

    console.log("[AGENT] Generating response with AI model...");

    // ОТЛАДКА перед созданием сервиса
    console.log("[DEBUG] Before creating YandexGPTService:");
    console.log(
      "YANDEX_FOLDER_ID:",
      process.env.YANDEX_FOLDER_ID?.substring(0, 10) + "..."
    );
    console.log(
      "YANDEX_API_KEY:",
      process.env.YANDEX_API_KEY?.substring(0, 10) + "..."
    );

    const yandexService = new YandexGPTService();

    const systemPrompt =
      "Ты — полезный ассистент. Используй предоставленные данные о погоде для ответа пользователю. Отвечай на русском языке, кратко и информативно.";

    const prompt = `Данные о погоде:
${weatherInfo}

Вопрос пользователя: ${userQuery}

Сформулируй краткий и информативный ответ:`;

    const aiResponse = await yandexService.sendMessage(
      "yandexgpt",
      prompt,
      {
        temperature: 0.6,
        systemPrompt,
        maxTokens: 2000,
      }
    );

    console.log("\n" + "=".repeat(60));
    console.log("[ASSISTANT RESPONSE]");
    console.log("=".repeat(60));
    console.log(aiResponse.text);
    console.log("\n" + "=".repeat(60));
    console.log(`Latency: ${aiResponse.latencyMs}ms`);
    console.log(`Tokens: ${aiResponse.totalTokens}`);
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("[AGENT] ✗ Error:", error.message);
  } finally {
    await client.close();
    console.log("\n[AGENT] Connection closed");
  }
}

weatherAgentDemo();
