import "../config/env";
import path from "path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

async function testWeatherTool() {
  console.log("[TEST] Starting Weather Tool test...\n");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", path.join(__dirname, "mcpServer.ts")],
  });

  const client = new Client(
    {
      name: "weather-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log("[TEST] ✓ Connected to MCP server\n");

    // Тест 1: Получить текущую погоду
    console.log("=".repeat(60));
    console.log("TEST 1: Get Current Weather (Moscow)");
    console.log("=".repeat(60));

    const weatherResult = (await client.callTool({
      name: "get_current_weather",
      arguments: {
        city: "Moscow",
        formatForAgent: true,
      },
    })) as CallToolResult;

    // Безопасное извлечение текста
    const weatherText = weatherResult.content[0] as TextContent;
    console.log("\nResult:");
    console.log(weatherText.text);

    // Тест 2: Получить прогноз на 5 дней
    console.log("\n" + "=".repeat(60));
    console.log("TEST 2: Get 5-Day Forecast (London)");
    console.log("=".repeat(60));

    const forecastResult = (await client.callTool({
      name: "get_weather_forecast",
      arguments: {
        city: "London",
        days: 5,
        formatForAgent: true,
      },
    })) as CallToolResult;

    const forecastText = forecastResult.content[0] as TextContent;
    console.log("\nResult:");
    console.log(forecastText.text);

    // Тест 3: Получить сырые данные (JSON)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 3: Get Raw JSON Data (Paris)");
    console.log("=".repeat(60));

    const rawResult = (await client.callTool({
      name: "get_current_weather",
      arguments: {
        city: "Paris",
        formatForAgent: false,
      },
    })) as CallToolResult;

    const rawText = rawResult.content[0] as TextContent;
    console.log("\nRaw JSON:");
    console.log(rawText.text);

    // Тест 4: Обработка ошибки (несуществующий город)
    console.log("\n" + "=".repeat(60));
    console.log("TEST 4: Error Handling (Invalid City)");
    console.log("=".repeat(60));

    try {
      const errorResult = (await client.callTool({
        name: "get_current_weather",
        arguments: {
          city: "NonExistentCityXYZ12345",
          formatForAgent: true,
        },
      })) as CallToolResult;

      const errorText = errorResult.content[0] as TextContent;
      console.log("\nError Response:");
      console.log(errorText.text);
    } catch (error: any) {
      console.log("\nCaught error:", error.message);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✓ All tests completed successfully!");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("[TEST] ✗ Error:", error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log("\n[TEST] Connection closed");
  }
}

testWeatherTool();
