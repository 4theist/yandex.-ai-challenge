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
import { YandexGPTService } from "./yandexService";
import { OpenRouterService } from "./openRouterService";

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

  /**
   * Инициализация MCP клиента и получение списка tools
   */
  async initialize() {
    if (this.mcpClient) return;

    console.log("[AGENT] Initializing MCP connection...");

    const mcpCommand = IS_PRODUCTION
      ? {
          command: "node",
          args: [path.join(__dirname, "../mcp/mcpServer.js")],
        }
      : {
          command: "npx",
          args: ["ts-node", path.join(__dirname, "../mcp/mcpServer.ts")],
        };

    this.mcpTransport = new StdioClientTransport(mcpCommand);

    this.mcpClient = new Client(
      {
        name: "agent-service",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.mcpClient.connect(this.mcpTransport);

    const toolsList = await this.mcpClient.listTools();
    this.availableTools = toolsList.tools;

    console.log(
      `[AGENT] ✓ Connected. Available tools: ${this.availableTools.length}`
    );
  }

  /**
   * Закрытие соединения
   */
  async close() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.mcpTransport = null;
      console.log("[AGENT] Connection closed");
    }
  }

  /**
   * Генерация описания tools для промпта модели
   */
  private generateToolsDescription(): string {
    const weatherTools = this.availableTools.filter(
      (t) =>
        t.name === "get_current_weather" || t.name === "get_weather_forecast"
    );

    if (weatherTools.length === 0) return "";

    let description = "\n## Доступные инструменты:\n\n";

    weatherTools.forEach((tool) => {
      description += `### ${tool.name}\n`;
      description += `${tool.description}\n`;
      description += `Параметры:\n`;

      const props = tool.inputSchema.properties || {};
      Object.entries(props).forEach(([key, value]: [string, any]) => {
        const required = tool.inputSchema.required?.includes(key)
          ? " (обязательный)"
          : "";
        description += `- ${key}: ${value.type}${required} - ${
          value.description || ""
        }\n`;
      });
      description += "\n";
    });

    description += `## Как использовать инструменты:\n`;
    description += `Если для ответа нужна информация о погоде, напиши:\n`;
    description += `TOOL_CALL: get_current_weather\n`;
    description += `ARGUMENTS: {"city": "Moscow", "formatForAgent": true}\n\n`;
    description += `Я выполню инструмент и верну результат. После этого дай финальный ответ пользователю.\n`;

    return description;
  }

  /**
   * Парсинг ответа модели на предмет tool calls
   */
  private parseToolCall(text: string): {
    shouldCall: boolean;
    toolName?: string;
    arguments?: any;
    remainingText: string;
  } {
    const toolCallMatch = text.match(/TOOL_CALL:\s*(\w+)/i);
    const argsMatch = text.match(/ARGUMENTS:\s*(\{[^}]+\})/i);

    if (!toolCallMatch) {
      return { shouldCall: false, remainingText: text };
    }

    let args = {};
    if (argsMatch) {
      try {
        args = JSON.parse(argsMatch[1]);
      } catch (e) {
        console.error("[AGENT] Failed to parse tool arguments:", argsMatch[1]);
      }
    }

    // Убираем TOOL_CALL и ARGUMENTS из текста
    const cleanText = text
      .replace(/TOOL_CALL:\s*\w+/gi, "")
      .replace(/ARGUMENTS:\s*\{[^}]+\}/gi, "")
      .trim();

    return {
      shouldCall: true,
      toolName: toolCallMatch[1],
      arguments: args,
      remainingText: cleanText,
    };
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
   * Главный метод: агент с autonomous tool calling
   */
  async processQuery(
    userQuery: string,
    provider: "yandex" | "openrouter" = "yandex",
    model: string = "yandexgpt",
    maxIterations: number = 3
  ): Promise<AgentResponse> {
    await this.initialize();

    const startTime = Date.now();
    let totalTokens = 0;
    const toolsCalled: AgentResponse["toolsCalled"] = [];

    const systemPrompt = `Ты — полезный AI-ассистент с доступом к инструментам для получения информации о погоде.${this.generateToolsDescription()}`;

    let currentPrompt = userQuery;
    let iteration = 0;

    // Agent loop
    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n[AGENT] Iteration ${iteration}/${maxIterations}`);

      // Вызываем модель
      let modelResponse;
      if (provider === "yandex") {
        const yandex = new YandexGPTService();
        modelResponse = await yandex.sendMessage(
          model as "yandexgpt" | "yandexgpt-lite",
          currentPrompt,
          0.6,
          systemPrompt,
          2000
        );
      } else {
        const openrouter = new OpenRouterService();
        modelResponse = await openrouter.sendMessage(
          model,
          currentPrompt,
          0.6,
          systemPrompt,
          2000
        );
      }

      totalTokens += modelResponse.totalTokens;
      const responseText = modelResponse.text;

      console.log(`[AGENT] Model response (${responseText.length} chars)`);

      // Парсим ответ на предмет tool calls
      const parsed = this.parseToolCall(responseText);

      if (!parsed.shouldCall) {
        // Модель не хочет вызывать tools, это финальный ответ
        console.log("[AGENT] ✓ Final answer received");
        return {
          answer: responseText,
          toolsCalled,
          totalLatencyMs: Date.now() - startTime,
          totalTokens,
          iterations: iteration,
        };
      }

      // Модель хочет вызвать tool
      if (!parsed.toolName) {
        console.log("[AGENT] Tool call detected but no tool name, stopping");
        return {
          answer: parsed.remainingText || responseText,
          toolsCalled,
          totalLatencyMs: Date.now() - startTime,
          totalTokens,
          iterations: iteration,
        };
      }

      // Выполняем tool
      try {
        const toolResult = await this.executeTool(
          parsed.toolName,
          parsed.arguments || {}
        );

        toolsCalled.push({
          name: parsed.toolName,
          arguments: parsed.arguments,
          result: toolResult,
        });

        // Формируем новый промпт для модели с результатом tool
        currentPrompt = `${parsed.remainingText || ""}

Результат выполнения ${parsed.toolName}:
${toolResult}

Теперь, используя эти данные, дай финальный ответ пользователю на вопрос: ${userQuery}`;
      } catch (error: any) {
        console.error("[AGENT] Tool execution error:", error.message);
        // Возвращаем ошибку как финальный ответ
        return {
          answer: `Не удалось получить данные о погоде: ${error.message}`,
          toolsCalled,
          totalLatencyMs: Date.now() - startTime,
          totalTokens,
          iterations: iteration,
        };
      }
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
