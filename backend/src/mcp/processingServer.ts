import "../config/env";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { summarizationService } from "../services/summarizationService";

const TOOLS: Tool[] = [
  {
    name: "summarize",
    description: "Создание краткого резюме из текста",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Текст для суммаризации",
        },
        maxLength: {
          type: "number",
          description: "Максимальная длина резюме в символах",
          default: 300,
        },
      },
      required: ["text"],
    },
  },
];

const server = new Server(
  {
    name: "processing-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("[Processing Server] Received listTools request");
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`[Processing Server] Tool called: ${request.params.name}`);

  try {
    if (request.params.name === "summarize") {
      const { text, maxLength = 300 } = request.params.arguments as any;

      console.log(
        `[Processing Server] Summarizing ${text.length} characters...`
      );

      // Используем существующий сервис суммаризации
      const result = await summarizationService.summarizeText(text, maxLength);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                original_length: text.length,
                summary_length: result.summary.length,
                compression_ratio:
                  ((result.summary.length / text.length) * 100).toFixed(2) +
                  "%",
                tokens_used: result.tokensUsed,
                summary: result.summary,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    console.error(`[Processing Server] Error:`, error.message);
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

async function main() {
  console.log("[Processing Server] Starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[Processing Server] Running on stdio");
  console.log(`[Processing Server] Available tools: ${TOOLS.length}`);
}

main().catch((error) => {
  console.error("[Processing Server] Fatal error:", error);
  process.exit(1);
});
