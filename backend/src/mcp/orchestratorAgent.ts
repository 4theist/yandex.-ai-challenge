import "../config/env";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface MCPServer {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

export class ToolOrchestrator {
  private servers: Map<string, MCPServer> = new Map();

  async connectToServers() {
    const serverConfigs = [
      { name: "search", script: "searchServer" },
      { name: "processing", script: "processingServer" },
      { name: "file", script: "fileServer" },
    ];

    console.log("[Orchestrator] Connecting to MCP servers...\n");

    for (const config of serverConfigs) {
      // Определяем команду в зависимости от окружения
      const transport = IS_PRODUCTION
        ? new StdioClientTransport({
            command: "node",
            args: [path.join(__dirname, `${config.script}.js`)],
          })
        : new StdioClientTransport({
            command: "npx",
            args: ["ts-node", path.join(__dirname, `${config.script}.ts`)],
          });

      const client = new Client(
        {
          name: `orchestrator-${config.name}-client`,
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);

      this.servers.set(config.name, {
        name: config.name,
        client,
        transport,
      });

      console.log(`[Orchestrator] ✓ Connected to ${config.name} server`);
    }

    console.log(`\n[Orchestrator] All servers connected!\n`);
  }

  async listAllTools() {
    const allTools: any[] = [];

    for (const [serverName, server] of this.servers) {
      const tools = await server.client.listTools();
      tools.tools.forEach((tool) => {
        allTools.push({
          server: serverName,
          name: tool.name,
          description: tool.description,
        });
      });
    }

    return allTools;
  }

  async executePipeline(
    query: string,
    options?: {
      days?: number;
      searchType?: "text" | "forecasts";
      maxSummaryLength?: number;
      fileFormat?: "md" | "txt" | "json";
    }
  ) {
    console.log("🔄 STARTING PIPELINE EXECUTION");
    console.log("=".repeat(60));
    console.log(`Query: "${query}"\n`);

    const {
      days = 7,
      searchType = "forecasts",
      maxSummaryLength = 300,
      fileFormat = "md",
    } = options || {};

    try {
      // STEP 1: Search
      console.log("📝 STEP 1: Searching documents...");
      const searchServer = this.servers.get("search")!;
      const searchResult = (await searchServer.client.callTool({
        name: "search_docs",
        arguments: {
          query,
          days,
          searchType,
        },
      })) as CallToolResult;

      const searchData = JSON.parse(
        (searchResult.content[0] as TextContent).text
      );
      console.log(`✓ Search completed. Found ${searchData.found} results.`);

      // STEP 2: Summarize
      console.log("📝 STEP 2: Summarizing results...");
      const processingServer = this.servers.get("processing")!;

      const textToSummarize =
        searchType === "forecasts"
          ? JSON.stringify(searchData.forecasts)
          : JSON.stringify(searchData.results);

      const summarizeResult = (await processingServer.client.callTool({
        name: "summarize",
        arguments: {
          text: textToSummarize,
          maxLength: maxSummaryLength,
        },
      })) as CallToolResult;

      const summaryData = JSON.parse(
        (summarizeResult.content[0] as TextContent).text
      );
      console.log(`✓ Summarization completed.`);
      console.log(`  Original: ${summaryData.original_length} chars`);
      console.log(`  Summary: ${summaryData.summary_length} chars`);
      console.log(`  Compression: ${summaryData.compression_ratio}`);
      console.log(`  Tokens used: ${summaryData.tokens_used}\n`);

      // STEP 3: Save to file
      console.log("📝 STEP 3: Saving to file...");
      const fileServer = this.servers.get("file")!;
      const saveResult = (await fileServer.client.callTool({
        name: "save_to_file",
        arguments: {
          content: summaryData.summary,
          title: `MCP Pipeline: ${query}`,
          format: fileFormat,
        },
      })) as CallToolResult;

      const saveData = JSON.parse((saveResult.content[0] as TextContent).text);
      console.log(`✓ File saved successfully.`);
      console.log(`  Path: ${saveData.filepath}`);
      console.log(`  Filename: ${saveData.filename}`);
      console.log(`  Size: ${saveData.size} bytes\n`);

      console.log("=".repeat(60));
      console.log("✅ PIPELINE COMPLETED SUCCESSFULLY!");
      console.log("=".repeat(60));

      return {
        success: true,
        query,
        search: {
          found: searchData.found,
          type: searchType,
          stats: searchData.stats,
        },
        summary: {
          text: summaryData.summary,
          original_length: summaryData.original_length,
          summary_length: summaryData.summary_length,
          compression_ratio: summaryData.compression_ratio,
          tokens_used: summaryData.tokens_used,
        },
        file: {
          filename: saveData.filename,
          filepath: saveData.filepath,
          size: saveData.size,
          createdAt: saveData.createdAt,
        },
      };
    } catch (error: any) {
      console.error("\n❌ PIPELINE FAILED:");
      console.error(error.message);
      throw error;
    }
  }

  async disconnect() {
    console.log("\n[Orchestrator] Disconnecting from servers...");
    for (const server of this.servers.values()) {
      await server.client.close();
    }
    console.log("[Orchestrator] All connections closed\n");
  }
}

// Standalone execution
async function main() {
  const orchestrator = new ToolOrchestrator();

  try {
    await orchestrator.connectToServers();

    const tools = await orchestrator.listAllTools();
    console.log("Available tools:", tools);

    await orchestrator.executePipeline("Weather forecasts analysis", {
      days: 7,
      fileFormat: "md",
    });
  } catch (error: any) {
    console.error("[Orchestrator] Error:", error.message);
  } finally {
    await orchestrator.disconnect();
  }
}

// Запуск если файл запущен напрямую
if (require.main === module) {
  main();
}
