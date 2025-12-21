import { MCPClientManager } from "./mcpClientManager";
import { ToolConverter } from "./toolConverter";
import { AgentResponse, AgentConfig } from "./types";
import { callModel, ModelResult } from "../../utils/modelCaller";
import { CONFIG } from "../../config/defaults";

export class AgentService {
  private mcpManager: MCPClientManager;

  constructor() {
    this.mcpManager = new MCPClientManager();
  }

  /**
   * Инициализация агента
   */
  async initialize(): Promise<void> {
    await this.mcpManager.initialize();
  }

  /**
   * Закрытие агента
   */
  async close(): Promise<void> {
    await this.mcpManager.close();
  }

  /**
   * Обработка запроса пользователя с использованием function calling
   */
  async processQuery(
    userQuery: string,
    provider: "yandex" | "openrouter" = "yandex",
    model: string = "yandexgpt",
    maxIterations: number = CONFIG.AGENT.MAX_ITERATIONS
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

      // Получаем tools и конвертируем их
      const availableTools = this.mcpManager.getAvailableTools();
      const tools = ToolConverter.convertToolsForAPI(availableTools);

      // Вызываем модель с tools
      const result: ModelResult = await callModel(
        provider,
        model,
        messages,
        CONFIG.AGENT.TEMPERATURE,
        {
          systemPrompt,
          tools,
          maxTokens: CONFIG.AGENT.MAX_TOKENS,
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
            const toolResult = await this.mcpManager.executeTool(
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
