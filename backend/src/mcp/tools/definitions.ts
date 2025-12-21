/**
 * Определения MCP-инструментов
 * Извлечено из mcpServer.ts для улучшения модульности
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS: Tool[] = [
  {
    name: "get_current_weather",
    description: "Получить текущую погоду для указанного города",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Название города (на английском: Moscow, London, Paris)",
        },
        includeAqi: {
          type: "boolean",
          description: "Включить данные о качестве воздуха",
          default: false,
        },
        formatForAgent: {
          type: "boolean",
          description: "Форматировать ответ для удобства чтения агентом",
          default: true,
        },
      },
      required: ["city"],
    },
  },
  {
    name: "get_weather_forecast",
    description: "Получить прогноз погоды на несколько дней (1-10)",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Название города",
        },
        days: {
          type: "number",
          description: "Количество дней прогноза (1-10)",
          default: 3,
        },
        formatForAgent: {
          type: "boolean",
          description: "Форматировать ответ для удобства чтения агентом",
          default: true,
        },
      },
      required: ["city"],
    },
  },
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
  {
    name: "execute_command",
    description:
      "Выполнить shell команду на VPS (тесты, git, pm2 status, системная информация). Только безопасные команды из whitelist.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "Shell команда для выполнения. Разрешены: npm test, npm run test:*, pm2 status, pm2 list, git status, git log, df -h, free -m, uptime",
        },
      },
      required: ["command"],
    },
  },
];
