import "../config/env";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { callModel } from "../utils/modelCaller";
import { compressionService } from "../services/compressionService";
import { MODELS_CONFIG } from "../config/models";
import { weatherService } from "../services/weatherService";
import { TOOLS } from "./tools/definitions";
import { shellExecutor } from "./tools/shellExecutor"; // ⬅️ НОВЫЙ ИМПОРТ

// Создаем MCP сервер
const server = new Server(
  {
    name: "yandex-ai-agent-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Обработчик запроса списка инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("[MCP] Received listTools request");
  return { tools: TOOLS };
});

// Обработчик вызова инструментов
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`[MCP] Tool called: ${request.params.name}`);
  try {
    switch (request.params.name) {
      case "call_ai_model": {
        const {
          provider,
          model,
          message,
          temperature = 0.6,
        } = request.params.arguments as any;

        const result = await callModel(provider, model, message, temperature);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  text: result.text,
                  metrics: result.metrics,
                  model: result.model,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "compare_models": {
        const {
          message,
          model1,
          model2,
          temperature = 0.6,
        } = request.params.arguments as any;

        const [result1, result2] = await Promise.all([
          callModel(model1.provider, model1.model, message, temperature),
          callModel(model2.provider, model2.model, message, temperature),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  model1: {
                    text: result1.text,
                    metrics: result1.metrics,
                  },
                  model2: {
                    text: result2.text,
                    metrics: result2.metrics,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_available_models": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(MODELS_CONFIG, null, 2),
            },
          ],
        };
      }

      case "compress_messages": {
        const {
          messages,
          provider,
          model,
          temperature = 0.6,
        } = request.params.arguments as any;

        const summary = await compressionService.createSummary(
          messages,
          provider,
          model,
          temperature
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case "get_current_weather": {
        const {
          city,
          includeAqi = false,
          formatForAgent = true,
        } = request.params.arguments as any;

        const result = await weatherService.getCurrentWeather(city, includeAqi);

        const responseText = formatForAgent
          ? weatherService.formatWeatherForAgent(result.data)
          : JSON.stringify(result, null, 2);

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      }

      case "get_weather_forecast": {
        const {
          city,
          days = 3,
          formatForAgent = true,
        } = request.params.arguments as any;

        const result = await weatherService.getForecast(city, days);

        const responseText = formatForAgent
          ? weatherService.formatForecastForAgent(result.data)
          : JSON.stringify(result, null, 2);

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      }

      case "execute_command": {
        const { command } = request.params.arguments as any;

        const result = await shellExecutor.executeCommand(command);

        // Форматируем результат для агента
        const formattedResult = result.success
          ? `✅ Команда выполнена успешно (${result.executionTime}ms)\n\nКоманда: ${result.command}\n\nВывод:\n${result.output}`
          : `❌ Ошибка выполнения команды (${result.executionTime}ms)\n\nКоманда: ${result.command}\n\nОшибка:\n${result.error}\n\nВывод:\n${result.output}`;

        return {
          content: [
            {
              type: "text",
              text: formattedResult,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Запуск сервера
async function main() {
  console.log("[MCP] Starting MCP server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[MCP] Server running on stdio transport");
  console.log(`[MCP] Available tools: ${TOOLS.length}`);
  TOOLS.forEach((tool) => console.log(`  - ${tool.name}: ${tool.description}`));
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
