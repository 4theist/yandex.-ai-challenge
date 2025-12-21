/**
 * MCPClientManager - управление жизненным циклом MCP клиента
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResult,
  TextContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export class MCPClientManager {
  private mcpClient: Client | null = null;
  private mcpTransport: StdioClientTransport | null = null;
  private availableTools: Tool[] = [];

  /**
   * Инициализация MCP подключения
   */
  async initialize(): Promise<void> {
    if (this.mcpClient) return;
    console.log("[AGENT] Initializing MCP connection...");

    const mcpCommand = IS_PRODUCTION
      ? { command: "node", args: [path.join(__dirname, "../../mcp/mcpServer.js")] }
      : {
          command: "npx",
          args: ["ts-node", path.join(__dirname, "../../mcp/mcpServer.ts")],
        };

    this.mcpTransport = new StdioClientTransport(mcpCommand);
    this.mcpClient = new Client(
      { name: "agent-service", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.mcpClient.connect(this.mcpTransport);
    const toolsList = await this.mcpClient.listTools();
    this.availableTools = toolsList.tools;
    console.log(
      `[AGENT] ✓ Connected. Available tools: ${this.availableTools.length}`
    );
  }

  /**
   * Закрытие подключения
   */
  async close(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.mcpTransport = null;
      console.log("[AGENT] Connection closed");
    }
  }

  /**
   * Получить список доступных инструментов
   */
  getAvailableTools(): Tool[] {
    return this.availableTools;
  }

  /**
   * Выполнить tool через MCP
   */
  async executeTool(toolName: string, args: any): Promise<string> {
    if (!this.mcpClient) {
      throw new Error("MCP client not initialized");
    }

    console.log(`[AGENT] Executing tool: ${toolName}`, args);
    const result = (await this.mcpClient.callTool({
      name: toolName,
      arguments: args,
    })) as CallToolResult;

    const resultText = (result.content[0] as TextContent).text;
    console.log(`[AGENT] Tool result received (${resultText.length} chars)`);
    return resultText;
  }
}
