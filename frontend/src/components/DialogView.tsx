import React, { useState, useEffect, useRef } from "react";
import { ModelsConfig, DialogMessage, SessionStats } from "../types";
import {
  getModels,
  createDialogSession,
  sendDialogMessage,
  deleteSession,
  compressSession,
} from "../api";

export const DialogView: React.FC = () => {
  const [models, setModels] = useState<ModelsConfig | null>(null);
  const [provider, setProvider] = useState<"yandex" | "openrouter">("yandex");
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState(0.6);
  const [systemPrompt, setSystemPrompt] = useState("Ты полезный ассистент.");

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);

  // Compression settings
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionThreshold, setCompressionThreshold] = useState(10);

  // UI state
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load models
  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((error) => {
        alert("Ошибка загрузки моделей: " + error.message);
      });
  }, []);

  // Auto-select model
  useEffect(() => {
    if (models && models[provider] && models[provider].length > 0) {
      setSelectedModel(models[provider][0].id);
    }
  }, [provider, models]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start new session
  const handleStartSession = async () => {
    if (!selectedModel) return;

    setIsLoading(true);
    try {
      const response = await createDialogSession(
        provider,
        selectedModel,
        temperature,
        {
          compressionEnabled,
          compressionThreshold,
          summaryProvider: provider,
          summaryModel: selectedModel,
        },
        {
          systemPrompt,
        }
      );

      setSessionId(response.sessionId);
      setMessages([]);
      setStats(null);
      console.log("Session created:", response.sessionId);
    } catch (error: any) {
      alert("Ошибка создания сессии: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!sessionId || !message.trim()) return;

    const userMessage: DialogMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await sendDialogMessage(sessionId, message, {
        systemPrompt,
      });

      const assistantMessage: DialogMessage = {
        role: "assistant",
        content: response.result.text,
        timestamp: new Date(),
        tokens: response.result.metrics.totalTokens,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStats(response.stats);

      if (response.compressionTriggered) {
        console.log("🔥 Compression triggered!");
      }
    } catch (error: any) {
      alert("Ошибка отправки сообщения: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // End session
  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      await deleteSession(sessionId);
      setSessionId(null);
      setMessages([]);
      setStats(null);
      console.log("Session ended");
    } catch (error: any) {
      alert("Ошибка завершения сессии: " + error.message);
    }
  };

  // Manual compression
  const handleManualCompress = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await compressSession(sessionId);
      setStats(response.stats);
      alert(
        `Сжатие выполнено! Экономия: ${response.stats.savedTokens} токенов`
      );
    } catch (error: any) {
      alert("Ошибка сжатия: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sessionId) {
        handleSendMessage();
      }
    }
  };

  return (
    <div style={styles.container}>
      {!sessionId ? (
        // Session setup
        <div style={styles.setupCard}>
          <h2 style={styles.setupTitle}>🗨️ Новый диалог с памятью</h2>

          {/* Model selection */}
          <div style={styles.setupControls}>
            <div style={styles.controlGroup}>
              <label style={styles.label}>Провайдер:</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                style={styles.select}
              >
                <option value="yandex">Yandex GPT</option>
                <option value="openrouter">OpenRouter</option>
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

          {/* Temperature */}
          <div style={styles.controlGroup}>
            <label style={styles.label}>
              Температура:{" "}
              <span style={styles.value}>{temperature.toFixed(1)}</span>
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
          </div>

          {/* System prompt */}
          <div style={styles.controlGroup}>
            <label style={styles.label}>System Prompt:</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={2}
              style={styles.textarea}
              placeholder="Описание роли ассистента..."
            />
          </div>

          {/* Compression settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={styles.toggleButton}
            type="button"
          >
            ⚙️ {showSettings ? "Скрыть" : "Показать"} настройки сжатия
          </button>

          {showSettings && (
            <div style={styles.settingsBox}>
              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={compressionEnabled}
                    onChange={(e) => setCompressionEnabled(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>Включить автоматическое сжатие</span>
                </label>
              </div>

              {compressionEnabled && (
                <div style={styles.controlGroup}>
                  <label style={styles.label}>
                    Сжимать каждые:{" "}
                    <span style={styles.value}>
                      {compressionThreshold} сообщений
                    </span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={compressionThreshold}
                    onChange={(e) =>
                      setCompressionThreshold(parseInt(e.target.value))
                    }
                    style={styles.slider}
                  />
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleStartSession}
            disabled={isLoading || !selectedModel}
            style={styles.startButton}
          >
            {isLoading ? "⏳ Создание..." : "🚀 Начать диалог"}
          </button>
        </div>
      ) : (
        // Active dialog
        <div style={styles.dialogContainer}>
          {/* Header with stats */}
          <div style={styles.dialogHeader}>
            <div style={styles.headerLeft}>
              <h3 style={styles.dialogTitle}>
                {provider === "yandex" ? "🟣" : "🔵"} {selectedModel}
              </h3>
              {stats && (
                <div style={styles.statsChips}>
                  <span style={styles.chip}>
                    💬 {stats.totalMessages} сообщений
                  </span>
                  <span style={styles.chip}>
                    📦 {stats.summariesCount} сжатий
                  </span>
                  <span style={{ ...styles.chip, ...styles.chipSuccess }}>
                    💾 {stats.savedTokens} токенов сэкономлено (
                    {stats.compressionRatio}%)
                  </span>
                </div>
              )}
            </div>
            <div style={styles.headerRight}>
              <button
                onClick={handleManualCompress}
                disabled={isLoading || messages.length === 0}
                style={styles.compressButton}
                title="Принудительно сжать текущие сообщения"
              >
                🗜️ Сжать
              </button>
              <button onClick={handleEndSession} style={styles.endButton}>
                ❌ Завершить
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesContainer}>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  ...styles.message,
                  ...(msg.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage),
                }}
                className="fade-in"
              >
                <div style={styles.messageHeader}>
                  <span style={styles.messageRole}>
                    {msg.role === "user" ? "👤 Вы" : "🤖 Ассистент"}
                  </span>
                  {msg.tokens && (
                    <span style={styles.messageTokens}>
                      {msg.tokens} токенов
                    </span>
                  )}
                </div>
                <div style={styles.messageContent}>{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div style={styles.loadingMessage}>
                <span>⏳ Генерация ответа...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={styles.inputContainer}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение... (Enter для отправки)"
              rows={3}
              style={styles.input}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !message.trim()}
              style={styles.sendButton}
            >
              {isLoading ? "⏳" : "📤"} Отправить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    height: "calc(100vh - 140px)",
    display: "flex",
    flexDirection: "column",
  },

  // Setup screen
  setupCard: {
    backgroundColor: "#18181b",
    borderRadius: "16px",
    border: "1px solid #27272a",
    padding: "32px",
    margin: "auto",
    maxWidth: "600px",
  },
  setupTitle: {
    margin: "0 0 24px 0",
    fontSize: "24px",
    fontWeight: "600",
    color: "#fafafa",
    textAlign: "center",
  },
  setupControls: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  value: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#fafafa",
    fontFamily: "monospace",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
    color: "#fafafa",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none",
    transition: "border-color 0.2s",
  },
  slider: {
    width: "100%",
    height: "4px",
    borderRadius: "2px",
    background: "linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none" as any,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
    color: "#fafafa",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    lineHeight: "1.5",
  },
  toggleButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: "#27272a",
    color: "#fafafa",
    border: "1px solid #3f3f46",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    marginBottom: "16px",
    transition: "all 0.2s",
  },
  settingsBox: {
    padding: "16px",
    backgroundColor: "#0a0a0a",
    borderRadius: "8px",
    border: "1px solid #27272a",
    marginBottom: "16px",
  },
  checkboxGroup: {
    marginBottom: "16px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#fafafa",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  startButton: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
    transition: "all 0.2s",
  },

  // Active dialog
  dialogContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#18181b",
    borderRadius: "16px",
    border: "1px solid #27272a",
    overflow: "hidden",
  },
  dialogHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
  },
  headerLeft: {
    flex: 1,
  },
  dialogTitle: {
    margin: "0 0 8px 0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#fafafa",
  },
  statsChips: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  chip: {
    padding: "4px 10px",
    backgroundColor: "#27272a",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "500",
    color: "#a1a1aa",
    whiteSpace: "nowrap",
  },
  chipSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
  },
  headerRight: {
    display: "flex",
    gap: "8px",
  },
  compressButton: {
    padding: "8px 16px",
    backgroundColor: "#27272a",
    color: "#fafafa",
    border: "1px solid #3f3f46",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  endButton: {
    padding: "8px 16px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "12px",
    maxWidth: "85%",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#6366f1",
    color: "white",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#27272a",
    color: "#fafafa",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
    gap: "10px",
  },
  messageRole: {
    fontSize: "11px",
    fontWeight: "600",
    opacity: 0.8,
  },
  messageTokens: {
    fontSize: "10px",
    opacity: 0.6,
    fontFamily: "monospace",
  },
  messageContent: {
    fontSize: "14px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  loadingMessage: {
    alignSelf: "center",
    padding: "12px 20px",
    backgroundColor: "#27272a",
    borderRadius: "20px",
    color: "#a1a1aa",
    fontSize: "13px",
    fontWeight: "500",
  },

  // Input
  inputContainer: {
    padding: "16px 20px",
    borderTop: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
    display: "flex",
    gap: "12px",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #27272a",
    backgroundColor: "#18181b",
    color: "#fafafa",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    lineHeight: "1.5",
  },
  sendButton: {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
};
