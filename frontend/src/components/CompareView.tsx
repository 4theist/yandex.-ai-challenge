import React, { useState, useEffect } from "react";
import { ModelsConfig, ModelResult } from "../types";
import { getModels, compareModels } from "../api";

export const CompareView: React.FC = () => {
  const [models, setModels] = useState<ModelsConfig | null>(null);

  // Модель 1
  const [provider1, setProvider1] = useState<"yandex" | "openrouter">("yandex");
  const [model1, setModel1] = useState("");

  // Модель 2
  const [provider2, setProvider2] = useState<"yandex" | "openrouter">(
    "openrouter"
  );
  const [model2, setModel2] = useState("");

  const [message, setMessage] = useState("");
  const [temperature, setTemperature] = useState(0.6);
  const [results, setResults] = useState<[ModelResult, ModelResult] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((error) => {
        alert("Ошибка загрузки моделей: " + error.message);
      });
  }, []);

  useEffect(() => {
    if (models && models[provider1] && models[provider1].length > 0) {
      setModel1(models[provider1][0].id);
    }
  }, [provider1, models]);

  useEffect(() => {
    if (models && models[provider2] && models[provider2].length > 0) {
      setModel2(models[provider2][0].id);
    }
  }, [provider2, models]);

  const handleCompare = async () => {
    if (!message.trim() || !model1 || !model2) return;

    setIsLoading(true);
    setResults(null);
    try {
      const response = await compareModels(
        message,
        temperature,
        { provider: provider1, model: model1 },
        { provider: provider2, model: model2 }
      );
      setResults(response.results);
    } catch (error: any) {
      alert("Ошибка: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getBestStyle = (isBest: boolean): React.CSSProperties => {
    return isBest
      ? {
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          fontWeight: "700",
          color: "#22c55e",
        }
      : {};
  };

  return (
    <div style={styles.container}>
      {/* Model selectors side-by-side */}
      <div style={styles.modelsRow}>
        <div style={styles.modelSelector}>
          <h3 style={styles.selectorTitle}>Модель 1</h3>
          <select
            value={provider1}
            onChange={(e) =>
              setProvider1(e.target.value as "yandex" | "openrouter")
            }
            style={styles.select}
          >
            <option value="yandex">Yandex GPT</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          <select
            value={model1}
            onChange={(e) => setModel1(e.target.value)}
            style={styles.select}
            disabled={!models}
          >
            {models?.[provider1]?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.vsText}>VS</div>

        <div style={styles.modelSelector}>
          <h3 style={styles.selectorTitle}>Модель 2</h3>
          <select
            value={provider2}
            onChange={(e) =>
              setProvider2(e.target.value as "yandex" | "openrouter")
            }
            style={styles.select}
          >
            <option value="yandex">Yandex GPT</option>
            <option value="openrouter">OpenRouter</option>
          </select>
          <select
            value={model2}
            onChange={(e) => setModel2(e.target.value)}
            style={styles.select}
            disabled={!models}
          >
            {models?.[provider2]?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shared controls */}
      <div style={styles.temperatureControl}>
        <label style={styles.temperatureLabel}>
          <span>🌡️ Температура:</span>
          <span style={styles.temperatureValue}>{temperature.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1.2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.temperatureHints}>
          <span>0 - Точность</span>
          <span>0.6 - Баланс</span>
          <span>1.2 - Креатив</span>
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Введите запрос для сравнения..."
        rows={4}
        style={styles.textarea}
        disabled={isLoading}
      />

      <button
        onClick={handleCompare}
        disabled={isLoading || !model1 || !model2}
        style={styles.button}
      >
        {isLoading ? "⏳ Сравнение..." : "🔄 Сравнить модели"}
      </button>

      {/* Results */}
      {results && (
        <>
          {/* Responses side-by-side */}
          <div className="fade-in">
            <div style={styles.responsesRow}>
              <div style={styles.responseCard}>
                <h3 style={styles.responseTitle}>
                  {results[0].provider === "yandex" ? "🟣" : "🔵"}{" "}
                  {results[0].model}
                </h3>
                <div style={styles.responseText}>{results[0].text}</div>
              </div>

              <div style={styles.responseCard}>
                <h3 style={styles.responseTitle}>
                  {results[1].provider === "yandex" ? "🟣" : "🔵"}{" "}
                  {results[1].model}
                </h3>
                <div style={styles.responseText}>{results[1].text}</div>
              </div>
            </div>

            {/* Metrics comparison table */}
            <div style={styles.tableWrapper}>
              <h3 style={styles.tableTitle}>📊 Сравнение метрик</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Метрика</th>
                    <th style={styles.th}>{results[0].model}</th>
                    <th style={styles.th}>{results[1].model}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}>⏱️ Время ответа</td>
                    <td
                      style={{
                        ...styles.td,
                        ...getBestStyle(
                          results[0].metrics.latencyMs <
                            results[1].metrics.latencyMs
                        ),
                      }}
                    >
                      {results[0].metrics.latencyMs} мс
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        ...getBestStyle(
                          results[1].metrics.latencyMs <
                            results[0].metrics.latencyMs
                        ),
                      }}
                    >
                      {results[1].metrics.latencyMs} мс
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.td}>📝 Prompt токены</td>
                    <td style={styles.td}>{results[0].metrics.promptTokens}</td>
                    <td style={styles.td}>{results[1].metrics.promptTokens}</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>💬 Completion токены</td>
                    <td style={styles.td}>
                      {results[0].metrics.completionTokens}
                    </td>
                    <td style={styles.td}>
                      {results[1].metrics.completionTokens}
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.td}>📊 Всего токенов</td>
                    <td style={styles.td}>{results[0].metrics.totalTokens}</td>
                    <td style={styles.td}>{results[1].metrics.totalTokens}</td>
                  </tr>
                  <tr>
                    <td style={styles.td}>💰 Стоимость</td>
                    <td
                      style={{
                        ...styles.td,
                        ...getBestStyle(
                          results[0].metrics.cost <= results[1].metrics.cost
                        ),
                      }}
                    >
                      {results[0].metrics.cost} {results[0].metrics.currency}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        ...getBestStyle(
                          results[1].metrics.cost <= results[0].metrics.cost
                        ),
                      }}
                    >
                      {results[1].metrics.cost} {results[1].metrics.currency}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  modelsRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "16px",
    marginBottom: "16px",
    alignItems: "center",
  },
  modelSelector: {
    padding: "16px",
    backgroundColor: "#18181b",
    borderRadius: "12px",
    border: "1px solid #27272a",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  selectorTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "600",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  vsText: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#8b5cf6",
    textShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
    color: "#fafafa",
    fontSize: "13px",
    cursor: "pointer",
    outline: "none",
    transition: "border-color 0.2s",
  },
  temperatureControl: {
    marginBottom: "16px",
    padding: "16px",
    backgroundColor: "#18181b",
    borderRadius: "12px",
    border: "1px solid #27272a",
  },
  temperatureLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#a1a1aa",
  },
  temperatureValue: {
    fontSize: "14px",
    fontWeight: "600",
    padding: "2px 10px",
    backgroundColor: "#27272a",
    borderRadius: "6px",
    color: "#fafafa",
    fontFamily: "monospace",
  },
  slider: {
    width: "100%",
    height: "4px",
    borderRadius: "2px",
    background: "linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)",
    outline: "none",
    cursor: "pointer",
    marginBottom: "8px",
    WebkitAppearance: "none",
  },
  temperatureHints: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "10px",
    color: "#71717a",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #27272a",
    backgroundColor: "#18181b",
    color: "#fafafa",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    marginBottom: "12px",
    lineHeight: "1.6",
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
    transition: "all 0.2s",
  },
  responsesRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "20px",
  },
  responseCard: {
    padding: "16px",
    backgroundColor: "#18181b",
    borderRadius: "12px",
    border: "1px solid #27272a",
  },
  responseTitle: {
    margin: "0 0 12px 0",
    fontSize: "14px",
    fontWeight: "600",
    color: "#fafafa",
  },
  responseText: {
    padding: "12px",
    backgroundColor: "#0a0a0a",
    borderRadius: "8px",
    lineHeight: "1.7",
    whiteSpace: "pre-wrap",
    fontSize: "13px",
    color: "#e4e4e7",
    minHeight: "150px",
    border: "1px solid #27272a",
  },
  tableWrapper: {
    padding: "20px",
    backgroundColor: "#18181b",
    borderRadius: "12px",
    border: "1px solid #27272a",
  },
  tableTitle: {
    margin: "0 0 16px 0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#fafafa",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    borderBottom: "2px solid #27272a",
    fontSize: "12px",
    fontWeight: "600",
    color: "#a1a1aa",
    backgroundColor: "#0a0a0a",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #27272a",
    fontSize: "13px",
    color: "#e4e4e7",
    fontFamily: "monospace",
  },
};
