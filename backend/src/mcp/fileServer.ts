import "../config/env";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { fileWriterService } from "../services/fileWriterService";

const TOOLS: Tool[] = [
  {
    name: "save_to_file",
    description: "Сохранение контента в файл",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Контент для сохранения",
        },
        filename: {
          type: "string",
          description:
            "Имя файла (опционально, будет сгенерировано автоматически)",
        },
        title: {
          type: "string",
          description: "Заголовок документа",
          default: "MCP Pipeline Result",
        },
        format: {
          type: "string",
          enum: ["md", "txt", "json"],
          description: "Формат файла",
          default: "md",
        },
      },
      required: ["content"],
    },
  },
];

const server = new Server(
  {
    name: "file-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("[File Server] Received listTools request");
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`[File Server] Tool called: ${request.params.name}`);

  try {
    if (request.params.name === "save_to_file") {
      const {
        content,
        filename,
        title = "MCP Pipeline Result",
        format = "md",
      } = request.params.arguments as any;

      console.log(`[File Server] Saving ${format} file...`);

      // Используем существующий сервис записи файлов
      const result = await fileWriterService.saveFile({
        content,
        filename,
        title,
        format: format as "md" | "txt" | "json",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                filepath: result.path,
                filename: result.filename,
                size: result.size,
                createdAt: result.createdAt,
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
    console.error(`[File Server] Error:`, error.message);
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
  console.log("[File Server] Starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[File Server] Running on stdio");
  console.log(`[File Server] Available tools: ${TOOLS.length}`);
}

main().catch((error) => {
  console.error("[File Server] Fatal error:", error);
  process.exit(1);
});
