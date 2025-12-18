import "../config/env";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { documentSearchService } from "../services/documentSearchService";

const TOOLS: Tool[] = [
  {
    name: "search_docs",
    description: "Поиск информации в документах и прогнозах",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос (для текстового поиска)",
        },
        days: {
          type: "number",
          description: "Количество дней для поиска прогнозов",
          default: 7,
        },
        cities: {
          type: "array",
          items: { type: "string" },
          description: "Список городов для фильтрации (опционально)",
        },
        searchType: {
          type: "string",
          enum: ["text", "forecasts"],
          description:
            "Тип поиска: text - по текстовым файлам, forecasts - по прогнозам",
          default: "forecasts",
        },
      },
      required: ["query"],
    },
  },
];

const server = new Server(
  {
    name: "search-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("[Search Server] Received listTools request");
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(`[Search Server] Tool called: ${request.params.name}`);

  try {
    if (request.params.name === "search_docs") {
      const {
        query,
        days = 7,
        cities,
        searchType = "forecasts",
      } = request.params.arguments as any;

      console.log(`[Search Server] Searching (${searchType}): "${query}"`);

      let results: any;

      if (searchType === "text") {
        // Поиск по текстовым файлам
        const textResults = await documentSearchService.searchTextFiles(query);
        results = {
          type: "text_search",
          query,
          found: textResults.length,
          results: textResults,
        };
      } else {
        // Поиск прогнозов за N дней
        const forecastResults = await documentSearchService.searchForecasts(
          days,
          cities
        );

        // Получаем статистику
        const stats = await documentSearchService.getSearchStats(
          forecastResults.forecasts
        );

        results = {
          type: "forecast_search",
          query,
          days,
          cities,
          found: forecastResults.found,
          forecasts: forecastResults.forecasts,
          dateRange: forecastResults.dateRange,
          stats,
        };
      }

      console.log(`[Search Server] Found ${results.found} results`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...results,
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
    console.error(`[Search Server] Error:`, error.message);
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
  console.log("[Search Server] Starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("[Search Server] Running on stdio");
  console.log(`[Search Server] Available tools: ${TOOLS.length}`);
}

main().catch((error) => {
  console.error("[Search Server] Fatal error:", error);
  process.exit(1);
});
