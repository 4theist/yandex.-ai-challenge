// Определение доступных инструментов для агента
export interface Tool {
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

// Инструмент 1: Калькулятор
export const calculatorTool: Tool = {
  function: {
    name: "calculator",
    description:
      "Выполняет математические вычисления. Поддерживает операции: add (сложение), subtract (вычитание), multiply (умножение), divide (деление)",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "Математическая операция",
        },
        a: {
          type: "number",
          description: "Первое число",
        },
        b: {
          type: "number",
          description: "Второе число",
        },
      },
      required: ["operation", "a", "b"],
    },
  },
};

// Инструмент 2: Получение текущего времени
export const timeTool: Tool = {
  function: {
    name: "getCurrentTime",
    description: "Возвращает текущие дату и время в указанном часовом поясе",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "Часовой пояс, например: Europe/Moscow, America/New_York, Asia/Tokyo",
          default: "Europe/Moscow",
        },
      },
      required: [],
    },
  },
};

// Инструмент 3: Поиск информации (симуляция)
export const searchTool: Tool = {
  function: {
    name: "searchInfo",
    description: "Ищет информацию по запросу в базе знаний",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос",
        },
      },
      required: ["query"],
    },
  },
};

// Реализации инструментов
export function executeCalculator(args: {
  operation: string;
  a: number;
  b: number;
}): string {
  const { operation, a, b } = args;

  let result: number;
  switch (operation) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      if (b === 0) return "Ошибка: деление на ноль";
      result = a / b;
      break;
    default:
      return "Неизвестная операция";
  }

  return `Результат: ${result}`;
}

export function executeGetCurrentTime(args: { timezone?: string }): string {
  const timezone = args.timezone || "Europe/Moscow";

  try {
    const now = new Date();
    const formatted = now.toLocaleString("ru-RU", { timeZone: timezone });
    return `Текущее время в ${timezone}: ${formatted}`;
  } catch (error) {
    return `Ошибка: неверный часовой пояс ${timezone}`;
  }
}

export function executeSearchInfo(args: { query: string }): string {
  // Симуляция поиска - в реальном приложении здесь был бы API вызов
  const mockDatabase: Record<string, string> = {
    москва:
      "Москва — столица России, крупнейший город страны с населением более 12 миллионов человек",
    react:
      "React — JavaScript библиотека для создания пользовательских интерфейсов, разработанная Facebook",
    python:
      "Python — высокоуровневый язык программирования общего назначения, известный своей простотой",
  };

  const query = args.query.toLowerCase();
  for (const key in mockDatabase) {
    if (query.includes(key)) {
      return mockDatabase[key];
    }
  }

  return `Информация по запросу "${args.query}" не найдена`;
}

// Общий исполнитель инструментов
export function executeTool(name: string, args: any): string {
  switch (name) {
    case "calculator":
      return executeCalculator(args);
    case "getCurrentTime":
      return executeGetCurrentTime(args);
    case "searchInfo":
      return executeSearchInfo(args);
    default:
      return "Неизвестный инструмент";
  }
}
