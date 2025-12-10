// Цены в рублях за 1000 токенов для Yandex
// Все OpenRouter free модели = 0
const PRICING: Record<string, { input: number; output: number }> = {
  yandexgpt: { input: 0.6, output: 1.2 },
  "yandexgpt-lite": { input: 0.12, output: 0.24 },
  // OpenRouter free модели не добавляем - по умолчанию 0
};

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): { cost: number; currency: "₽" | "FREE" } {
  const pricing = PRICING[model];

  // Если модели нет в PRICING - бесплатная
  if (!pricing) {
    return { cost: 0, currency: "FREE" };
  }

  // Расчёт стоимости: (токены * цена за 1K) / 1000
  const cost =
    (promptTokens * pricing.input + completionTokens * pricing.output) / 1000;

  return {
    cost: parseFloat(cost.toFixed(4)),
    currency: "₽",
  };
}
