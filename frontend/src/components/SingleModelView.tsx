import React, { useState, useEffect } from "react";
import { ModelsConfig, ModelResult } from "../types";
import { getModels, sendToModel } from "../api";

export const SingleModelView: React.FC = () => {
  const [models, setModels] = useState<ModelsConfig | null>(null);
  const [provider, setProvider] = useState<"yandex" | "openrouter">("yandex");
  const [selectedModel, setSelectedModel] = useState("");
  const [message, setMessage] = useState("");
  const [temperature, setTemperature] = useState(0.6);
  const [result, setResult] = useState<ModelResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Загрузить модели при монтировании
  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((error) => {
        alert("Ошибка загрузки моделей: " + error.message);
      });
  }, []);

  // Сброс выбранной модели при смене провайдера
  useEffect(() => {
    if (models && models[provider] && models[provider].length > 0) {
      setSelectedModel(models[provider][0].id);
    }
  }, [provider, models]);

  const handleSend = async () => {
    if (!message.trim() || !selectedModel) return;

    setIsLoading(true);
    setResult(null);
    try {
      const res = await sendToModel(
        message,
        temperature,
        provider,
        selectedModel
      );
      setResult(res);
    } catch (error: any) {
      alert("Ошибка: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Model selection */}
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Провайдер:</label>
          <select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as "yandex" | "openrouter")
            }
            style={styles.select}
          >
            <option value="yandex">Yandex GPT</option>
            <option value="openrouter">OpenRouter (Free)</option>
          </select>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>Модель:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={styles.select}
            disabled={!models}
          >
            {models?.[provider]?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Temperature slider */}
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

      {/* Message input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Введите ваш запрос..."
        rows={4}
        style={styles.textarea}
        disabled={isLoading}
      />

      <button
        onClick={handleSend}
        disabled={isLoading || !selectedModel}
        style={styles.button}
      >
        {isLoading ? "⏳ Отправка..." : "📤 Отправить"}
      </button>

      {/* Result */}
      {result && (
        <div className="fade-in" style={styles.result}>
          <div style={styles.resultHeader}>
            <h3 style={styles.modelName}>
              {result.provider === "yandex" ? "🟣" : "🔵"} {result.model}
            </h3>
          </div>

          <div style={styles.responseText}>{result.text}</div>

          <div style={styles.metrics}>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>⏱️ Время:</span>
              <span style={styles.metricValue}>
                {result.metrics.latencyMs} мс
              </span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>📊 Токены:</span>
              <span style={styles.metricValue}>
                {result.metrics.promptTokens} +{" "}
                {result.metrics.completionTokens} = {result.metrics.totalTokens}
              </span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>💰 Стоимость:</span>
              <span style={styles.metricValue}>
                {result.metrics.cost} {result.metrics.currency}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#18181b",
    color: "#fafafa",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none",
    transition: "all 0.2s",
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
    transition: "border-color 0.2s",
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
    transition: "all 0.2s",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
  },
  result: {
    marginTop: "20px",
    padding: "20px",
    backgroundColor: "#18181b",
    borderRadius: "12px",
    border: "1px solid #27272a",
  },
  resultHeader: {
    marginBottom: "12px",
  },
  modelName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#fafafa",
  },
  responseText: {
    padding: "16px",
    backgroundColor: "#0a0a0a",
    borderRadius: "8px",
    lineHeight: "1.7",
    whiteSpace: "pre-wrap",
    fontSize: "14px",
    color: "#e4e4e7",
    marginBottom: "16px",
    border: "1px solid #27272a",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  metricItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#0a0a0a",
    borderRadius: "8px",
    border: "1px solid #27272a",
  },
  metricLabel: {
    fontSize: "12px",
    color: "#a1a1aa",
    fontWeight: "500",
  },
  metricValue: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#fafafa",
    fontFamily: "monospace",
  },
};
