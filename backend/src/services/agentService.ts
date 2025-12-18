import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResult,
  TextContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { callModel, ModelResult } from "../utils/modelCaller";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface AgentResponse {
  answer: string;
  toolsCalled: Array<{
    name: string;
    arguments: any;
    result: string;
  }>;
  totalLatencyMs: number;
  totalTokens: number;
  iterations: number;
}

export class AgentService {
  private mcpClient: Client | null = null;
  private mcpTransport: StdioClientTransport | null = null;
  private availableTools: Tool[] = [];

  async initialize() {
    if (this.mcpClient) return;
    console.log("[AGENT] Initializing MCP connection...");

    const mcpCommand = IS_PRODUCTION
      ? { command: "node", args: [path.join(__dirname, "../mcp/mcpServer.js")] }
      : {
          command: "npx",
          args: ["ts-node", path.join(__dirname, "../mcp/mcpServer.ts")],
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

  async close() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.mcpTransport = null;
      console.log("[AGENT] Connection closed");
    }
  }

  /**
   * Конвертация MCP tools в формат для API
   */
  private convertToolsForAPI() {
    const converted = this.availableTools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    console.log(
      "[AGENT] Tools converted:",
      JSON.stringify(converted.slice(0, 2), null, 2)
    );

    return converted;
  }

  /**
   * Выполнение tool через MCP
   */
  private async executeTool(toolName: string, args: any): Promise<string> {
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

  /**
   * Главный метод с нативным function calling
   */
  async processQuery(
    userQuery: string,
    provider: "yandex" | "openrouter" = "yandex",
    model: string = "yandexgpt",
    maxIterations: number = 5
  ): Promise<AgentResponse> {
    await this.initialize();

    const startTime = Date.now();
    let totalTokens = 0;
    const toolsCalled: AgentResponse["toolsCalled"] = [];

    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: userQuery },
    ];

    const systemPrompt =
      "Ты — полезный AI-ассистент с доступом к инструментам для получения информации о погоде. Используй их когда нужно получить актуальные данные.";

    let iteration = 0;

    // Agent loop
    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n[AGENT] Iteration ${iteration}/${maxIterations}`);

      // Вызываем модель с tools
      const tools = this.convertToolsForAPI();

      const result: ModelResult = await callModel(
        provider,
        model,
        messages,
        0.6,
        {
          systemPrompt,
          tools,
          maxTokens: 2000,
        }
      );

      totalTokens += result.metrics.totalTokens;
      console.log(
        `[AGENT] Model response (${result.text.length} chars):`,
        result.text
      );
      console.log(`[AGENT] Tool calls:`, result.toolCalls);

      // Проверяем, есть ли tool calls в ответе
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log(`[AGENT] Tool calls detected: ${result.toolCalls.length}`);

        // Выполняем все tool calls
        for (const toolCall of result.toolCalls) {
          try {
            const toolResult = await this.executeTool(
              toolCall.function.name,
              toolCall.function.arguments
            );

            toolsCalled.push({
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              result: toolResult,
            });

            // Добавляем результат tool в историю
            messages.push({
              role: "assistant",
              content: `[Вызван инструмент ${toolCall.function.name}]`,
            });
            messages.push({
              role: "user",
              content: `Результат выполнения ${toolCall.function.name}:\n\n${toolResult}\n\nИспользуй эти данные для ответа на вопрос: ${userQuery}`,
            });
          } catch (error: any) {
            console.error("[AGENT] Tool execution error:", error.message);
            return {
              answer: `Не удалось выполнить инструмент: ${error.message}`,
              toolsCalled,
              totalLatencyMs: Date.now() - startTime,
              totalTokens,
              iterations: iteration,
            };
          }
        }

        // Продолжаем цикл - модель должна дать финальный ответ
        continue;
      }

      // Нет tool calls - это финальный ответ
      console.log("[AGENT] ✓ Final answer received");
      return {
        answer: result.text,
        toolsCalled,
        totalLatencyMs: Date.now() - startTime,
        totalTokens,
        iterations: iteration,
      };
    }

    // Достигли максимального числа итераций
    console.log("[AGENT] Max iterations reached");
    return {
      answer: "Превышен лимит итераций агента",
      toolsCalled,
      totalLatencyMs: Date.now() - startTime,
      totalTokens,
      iterations: maxIterations,
    };
  }
}

// Экспортируем singleton
export const agentService = new AgentService();
