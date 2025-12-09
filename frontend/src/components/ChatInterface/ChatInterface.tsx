import React, { useState, useRef, useEffect } from "react";
import { DisplayMessage } from "../../types";
import {
  sendMessage,
  checkHealth,
  createSession,
  resetSession,
} from "../../api";
import { AgentResponse } from "../../types";

const messageAnimation: React.CSSProperties = {
  animation: "slideIn 0.3s ease-out",
};

export const ChatInterface: React.FC = () => {
  // sessionId и статус завершения
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [temperature, setTemperature] = useState<number>(0.3);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Создание сессии при монтировании
  useEffect(() => {
    async function init() {
      try {
        const healthData = await checkHealth();
        setIsApiHealthy(healthData.status === "OK");
        const newSessionId = await createSession();
        setSessionId(newSessionId);
        console.log("[SESSION CREATED]", newSessionId);
      } catch (error) {
        console.error("[INIT ERROR]", error);
        setIsApiHealthy(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // функция отправки с sessionId и temperature
  const handleSend = async () => {
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const processingMsg: DisplayMessage = {
        id: `processing-${Date.now()}`,
        role: "assistant",
        content: "⏳ Думаю...",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, processingMsg]);

      // Передаем temperature в API
      const response: AgentResponse = await sendMessage(
        input,
        sessionId,
        temperature
      );

      setMessages((prev) => prev.filter((m) => m.id !== processingMsg.id));

      // обработка ответа
      const assistantMessage: DisplayMessage = {
        id: `response-${Date.now()}`,
        role: "assistant",
        content: "", // Будет заполнено в рендере
        agentResponse: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Проверяем завершение диалога
      if (response.status === "ready") {
        setIsComplete(true);
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.filter((m) => !m.id.startsWith("processing-"))
      );
      const errorMessage: DisplayMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // функция для начала нового диалога
  const handleNewConversation = async () => {
    try {
      setIsLoading(true);
      if (sessionId) {
        await resetSession(sessionId);
      }

      const newSessionId = await createSession();
      setSessionId(newSessionId);
      setMessages([]);
      setIsComplete(false);
      console.log("[NEW CONVERSATION]", newSessionId);
    } catch (error: any) {
      console.error("[RESET ERROR]", error);
      alert(`Ошибка при создании новой сессии: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatResultAsText = (result: any): string => {
    if (!result || typeof result !== "object") {
      return String(result);
    }

    const lines: string[] = [];

    // Рекурсивная функция форматирования
    const formatValue = (key: string, value: any, indent: number = 0): void => {
      const prefix = "  ".repeat(indent);

      if (Array.isArray(value)) {
        // Массив - заголовок и элементы списком
        lines.push(`${prefix}${key}:`);
        value.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            // Если объект в массиве - форматируем его поля
            Object.entries(item).forEach(([k, v]) => {
              lines.push(`${prefix}  - ${k}: ${v}`);
            });
          } else {
            lines.push(`${prefix}  - ${item}`);
          }
        });
      } else if (typeof value === "object" && value !== null) {
        // Вложенный объект - заголовок и рекурсивная обработка
        lines.push(`${prefix}${key}:`);
        Object.entries(value).forEach(([k, v]) => {
          formatValue(k, v, indent + 1);
        });
      } else {
        // Простое значение
        lines.push(`${prefix}${key}: ${value}`);
      }
    };

    // Обрабатываем все поля корневого объекта
    Object.entries(result).forEach(([key, value]) => {
      formatValue(key, value, 0);
      lines.push(""); // Пустая строка между секциями
    });

    // Убираем последнюю пустую строку
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.join("\n");
  };

  const renderMessage = (msg: DisplayMessage) => {
    if (msg.agentResponse) {
      const response = msg.agentResponse;
      return (
        <div style={styles.structuredResponse}>
          {/* Режим сбора информации */}
          {response.status === "collecting" && response.question && (
            <div style={styles.questionText}>{response.question}</div>
          )}

          {/* Финальный результат - простой текст */}
          {response.status === "ready" && response.result && (
            <div style={styles.resultBlock}>
              <div style={styles.resultText}>
                {formatResultAsText(response.result)}
              </div>
            </div>
          )}

          {/* Метаданные */}
          <div style={styles.metadataSection}>
            <div style={styles.metadataRow}>
              <span
                style={{
                  ...styles.statusBadge,
                  ...(response.status === "collecting"
                    ? styles.statusCollecting
                    : styles.statusReady),
                }}
              >
                {response.status === "collecting" ? "Сбор данных" : "Готово"}
              </span>
              <span style={styles.confidenceValue}>{response.confidence}%</span>
            </div>
            <div style={styles.confidenceBar}>
              <div
                style={{
                  ...styles.confidenceBarFill,
                  width: `${response.confidence}%`,
                }}
              />
            </div>
            {response.reasoning && (
              <div style={styles.reasoningBlock}>
                <span style={styles.reasoningIcon}>💭</span>
                <span style={styles.reasoningText}>{response.reasoning}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return <div style={styles.messageContent}>{msg.content}</div>;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🤖 AI Агент-Сборщик</h1>
        <p style={styles.subtitle}>
          Умный помощник, который задает вопросы и собирает информацию
        </p>

        <div style={styles.headerInfo}>
          {isApiHealthy === null && (
            <span style={styles.healthIndicator}>⏳ Проверка...</span>
          )}
          {isApiHealthy === true && (
            <span style={styles.healthIndicator}>✓ API работает</span>
          )}
          {isApiHealthy === false && (
            <span style={styles.healthIndicator}>✗ API недоступен</span>
          )}
          {sessionId && (
            <span style={styles.sessionInfo}>
              Session: {sessionId.substring(0, 8)}...
            </span>
          )}
        </div>

        {/* Контрол температуры */}
        <div style={styles.temperatureControl}>
          <div style={styles.temperatureLabel}>
            <span>🌡️ Температура</span>
            <span style={styles.temperatureValue}>
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={styles.temperatureSlider}
          />
          <div style={styles.temperatureHints}>
            <span style={styles.temperatureHint}>0 - Точность</span>
            <span style={styles.temperatureHint}>0.7 - Баланс</span>
            <span style={styles.temperatureHint}>1.2 - Креатив</span>
          </div>
        </div>
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateTitle}>
              👋 Привет! Я умный агент-сборщик информации
            </div>
            <p style={styles.emptyStateText}>
              Я задам уточняющие вопросы и соберу всю нужную информацию, чтобы
              дать тебе детальный ответ
            </p>
            <div style={styles.examplesBlock}>
              <div style={styles.examplesTitle}>Попробуй спросить:</div>
              <ul style={styles.examplesList}>
                <li>"Хочу рецепт вкусной пиццы"</li>
                <li>"Помоги собрать игровой компьютер"</li>
                <li>"Составь план тренировки"</li>
                <li>"Посоветуй маршрут путешествия"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.role === "user"
                ? styles.userMessage
                : styles.assistantMessage),
              ...messageAnimation,
            }}
          >
            <div style={styles.messageHeader}>
              <span>{msg.role === "user" ? "👤 Вы" : "🤖 Агент"}</span>
              <span style={styles.messageTime}>
                {msg.timestamp.toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {renderMessage(msg)}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        {isComplete ? (
          // Кнопка нового диалога
          <button
            onClick={handleNewConversation}
            style={{
              ...styles.button,
              ...styles.newConversationButton,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
            disabled={isLoading}
          >
            {isLoading ? "⏳ Создаю..." : "🔄 Начать новый диалог"}
          </button>
        ) : (
          // Обычный инпут
          <>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Введите ответ или новый запрос..."
              style={styles.input}
              disabled={isLoading || isApiHealthy === false || !sessionId}
              rows={2}
            />
            <button
              onClick={handleSend}
              style={{
                ...styles.button,
                ...(isLoading || !input.trim() || !sessionId
                  ? styles.buttonDisabled
                  : {}),
              }}
              disabled={isLoading || !input.trim() || !sessionId}
            >
              {isLoading ? "⏳" : "📤"} Отправить
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: "1000px",
    margin: "0 auto",
    backgroundColor: "#0f172a",
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "32px 24px",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(10px)",
  },
  title: {
    margin: "0 0 12px 0",
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "0 0 16px 0",
    fontSize: "15px",
    opacity: 0.95,
    fontWeight: "400",
  },
  headerInfo: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  healthIndicator: {
    fontSize: "13px",
    fontWeight: "600",
    padding: "6px 12px",
    borderRadius: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(10px)",
  },
  sessionInfo: {
    fontSize: "12px",
    fontWeight: "500",
    padding: "6px 12px",
    borderRadius: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    fontFamily: "monospace",
  },
  temperatureControl: {
    marginTop: "20px",
    padding: "16px 20px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    backdropFilter: "blur(10px)",
    maxWidth: "600px",
    margin: "20px auto 0",
  },
  temperatureLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    fontSize: "14px",
    fontWeight: "600",
  },
  temperatureValue: {
    fontSize: "16px",
    fontWeight: "700",
    padding: "4px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    fontFamily: "monospace",
  },
  temperatureSlider: {
    width: "100%",
    height: "6px",
    borderRadius: "3px",
    background: "linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none",
    appearance: "none",
    marginBottom: "10px",
  },
  temperatureHints: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    opacity: 0.8,
    fontWeight: "500",
  },
  temperatureHint: {
    textAlign: "center",
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    scrollbarWidth: "thin",
    scrollbarColor: "#475569 #1e293b",
  },
  emptyState: {
    textAlign: "center",
    color: "#94a3b8",
    padding: "60px 20px",
    maxWidth: "600px",
    margin: "auto",
  },
  emptyStateTitle: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#e2e8f0",
  },
  emptyStateText: {
    fontSize: "15px",
    lineHeight: "1.6",
    marginBottom: "24px",
  },
  examplesBlock: {
    marginTop: "32px",
  },
  examplesTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#cbd5e1",
  },
  examplesList: {
    textAlign: "left",
    display: "inline-block",
    padding: "20px 24px",
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    listStyle: "none",
    fontSize: "14px",
    lineHeight: "2",
  },
  message: {
    padding: "16px 20px",
    borderRadius: "16px",
    maxWidth: "75%",
    wordWrap: "break-word",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
  },
  userMessage: {
    alignSelf: "flex-end",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    color: "#e2e8f0",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    fontSize: "12px",
    fontWeight: "600",
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  messageTime: {
    fontSize: "11px",
    fontWeight: "400",
    opacity: 0.6,
  },
  messageContent: {
    lineHeight: "1.7",
    whiteSpace: "pre-wrap",
    fontSize: "15px",
  },
  structuredResponse: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  questionText: {
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#f1f5f9",
    fontWeight: "500",
  },
  resultBlock: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "12px",
    padding: "16px",
  },
  resultText: {
    fontSize: "15px",
    lineHeight: "1.7",
    color: "#e2e8f0",
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    padding: "12px",
    backgroundColor: "rgba(51, 65, 85, 0.3)",
    borderRadius: "8px",
  },
  metadataSection: {
    fontSize: "13px",
    backgroundColor: "rgba(51, 65, 85, 0.5)",
    padding: "12px",
    borderRadius: "8px",
  },
  metadataRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    gap: "12px",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statusCollecting: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "white",
  },
  statusReady: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
  },
  confidenceValue: {
    fontWeight: "700",
    fontSize: "14px",
    color: "#a5b4fc",
  },
  confidenceBar: {
    height: "8px",
    backgroundColor: "rgba(51, 65, 85, 0.8)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  confidenceBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  reasoningBlock: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    marginTop: "8px",
    padding: "8px",
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    borderRadius: "6px",
  },
  reasoningIcon: {
    fontSize: "14px",
    flexShrink: 0,
  },
  reasoningText: {
    fontSize: "12px",
    color: "#cbd5e1",
    lineHeight: "1.5",
    fontStyle: "italic",
  },
  inputContainer: {
    padding: "20px",
    backgroundColor: "#1e293b",
    borderTop: "1px solid #334155",
    display: "flex",
    gap: "12px",
    boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
  },
  input: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontSize: "15px",
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
  },
  button: {
    padding: "14px 28px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
    whiteSpace: "nowrap",
  },
  buttonDisabled: {
    background: "linear-gradient(135deg, #475569 0%, #334155 100%)",
    cursor: "not-allowed",
    opacity: 0.6,
    boxShadow: "none",
  },
  newConversationButton: {
    flex: 1,
    fontSize: "16px",
    padding: "16px 32px",
  },
};
