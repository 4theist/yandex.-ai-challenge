import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { callModel } from "../utils/modelCaller";
import { compressionService } from "../services/compressionService";
import { MODELS_CONFIG } from "../config/models";

// Определяем доступные MCP tools
const TOOLS: Tool[] = [
  {
    name: "call_ai_model",
    description: "Вызов AI модели (Yandex или OpenRouter) с заданным промптом",
    inputSchema: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          enum: ["yandex", "openrouter"],
          description: "Провайдер модели",
        },
        model: {
          type: "string",
          description: "Название модели (например, yandexgpt/latest)",
        },
        message: {
          type: "string",
          description: "Сообщение для модели",
        },
        temperature: {
          type: "number",
          description: "Температура генерации (0.0-1.0)",
          default: 0.6,
        },
      },
      required: ["provider", "model", "message"],
    },
  },
  {
    name: "compare_models",
    description: "Сравнить ответы двух AI моделей на один и тот же промпт",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Сообщение для обеих моделей",
        },
        model1: {
          type: "object",
          properties: {
            provider: { type: "string", enum: ["yandex", "openrouter"] },
            model: { type: "string" },
          },
          required: ["provider", "model"],
        },
        model2: {
          type: "object",
          properties: {
            provider: { type: "string", enum: ["yandex", "openrouter"] },
            model: { type: "string" },
          },
          required: ["provider", "model"],
        },
        temperature: {
          type: "number",
          default: 0.6,
        },
      },
      required: ["message", "model1", "model2"],
    },
  },
  {
    name: "get_available_models",
    description: "Получить список всех доступных AI моделей",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "compress_messages",
    description: "Создать сжатое резюме из массива сообщений",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string" },
            },
          },
          description: "Массив сообщений для сжатия",
        },
        provider: {
          type: "string",
          enum: ["yandex", "openrouter"],
        },
        model: {
          type: "string",
        },
        temperature: {
          type: "number",
          default: 0.6,
        },
      },
      required: ["messages", "provider", "model"],
    },
  },
];

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
