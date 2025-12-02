import React, { useState, useRef, useEffect } from "react";
import { DisplayMessage } from "../../types";
import { sendMessage, checkHealth } from "../../api";

const messageAnimation: React.CSSProperties = {
  animation: "slideIn 0.3s ease-out",
};

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth().then(setIsApiHealthy);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
        content: "⏳ Обрабатываю запрос...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, processingMsg]);

      const response = await sendMessage(input);

      setMessages((prev) => prev.filter((m) => m.id !== processingMsg.id));

      const assistantMessage: DisplayMessage = {
        id: `response-${Date.now()}`,
        role: "assistant",
        content: response.data.answer,
        parsedData: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
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

  const renderMessage = (msg: DisplayMessage) => {
    if (msg.parsedData) {
      return (
        <div style={styles.structuredResponse}>
          <div style={styles.answerText}>{msg.parsedData.data.answer}</div>

          <div style={styles.metadataSection}>
            <div style={styles.metadataRow}>
              <span
                style={{
                  ...styles.statusBadge,
                  ...(msg.parsedData.status === "success"
                    ? styles.statusSuccess
                    : styles.statusError),
                }}
              >
                {msg.parsedData.status === "success" ? "✓ Success" : "✗ Error"}
              </span>
              <span style={styles.confidenceValue}>
                Confidence: {(msg.parsedData.data.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div style={styles.confidenceBar}>
              <div
                style={{
                  ...styles.confidenceBarFill,
                  width: `${msg.parsedData.data.confidence * 100}%`,
                }}
              />
            </div>
            <div style={styles.metadataFooter}>
              <span>Model: {msg.parsedData.metadata.model}</span>
              <span>
                {new Date(msg.parsedData.metadata.timestamp).toLocaleString(
                  "ru-RU"
                )}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return <div style={styles.messageContent}>{msg.content}</div>;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>YandexGPT Structured JSON Agent</h1>
        <p style={styles.subtitle}>
          Структурированные ответы с confidence метрикой
        </p>
        <div style={styles.healthIndicator}>
          {isApiHealthy === null && <span>⏳ Проверка...</span>}
          {isApiHealthy === true && (
            <span style={{ color: "#10b981" }}>✓ API работает</span>
          )}
          {isApiHealthy === false && (
            <span style={{ color: "#ef4444" }}>✗ API недоступен</span>
          )}
        </div>
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p>👋 Привет! Я возвращаю структурированные JSON-ответы.</p>
            <p>Попробуй спросить:</p>
            <ul style={styles.examplesList}>
              <li>"Кто изобрел JavaScript?"</li>
              <li>"Объясни что такое React Hooks"</li>
              <li>"Какая столица Японии?"</li>
            </ul>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...messageAnimation,
              ...(msg.role === "user"
                ? styles.userMessage
                : styles.assistantMessage),
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
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Введите сообщение..."
          style={styles.input}
          disabled={isLoading || isApiHealthy === false}
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || isApiHealthy === false}
          style={{
            ...styles.button,
            ...(!input.trim() || isLoading || isApiHealthy === false
              ? styles.buttonDisabled
              : {}),
          }}
        >
          {isLoading ? "⏳" : "📤"} Отправить
        </button>
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
    backgroundColor: "#0f172a", // Темный фон (dark mode тренд)
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // Градиент
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
    background: "linear-gradient(to right, #ffffff, #e0e7ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    margin: "0 0 16px 0",
    fontSize: "15px",
    opacity: 0.95,
    fontWeight: "400",
    letterSpacing: "0.01em",
  },
  healthIndicator: {
    fontSize: "13px",
    fontWeight: "600",
    padding: "6px 12px",
    borderRadius: "20px",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(10px)",
    display: "inline-block",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    // Custom scrollbar для современного вида
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
  examplesList: {
    textAlign: "left",
    display: "inline-block",
    marginTop: "20px",
    padding: "20px",
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    listStyle: "none",
  },
  message: {
    padding: "16px 20px",
    borderRadius: "16px",
    maxWidth: "75%",
    wordWrap: "break-word",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  userMessage: {
    alignSelf: "flex-end",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1e293b", // Темная карточка
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
    textTransform: "none",
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
  answerText: {
    fontSize: "15px",
    lineHeight: "1.7",
    color: "#f1f5f9",
    paddingBottom: "16px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
    fontWeight: "400",
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
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  },
  statusSuccess: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
  },
  statusError: {
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "white",
  },
  confidenceValue: {
    fontWeight: "700",
    fontSize: "14px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  confidenceBar: {
    height: "8px",
    backgroundColor: "rgba(51, 65, 85, 0.8)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "10px",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)",
  },
  confidenceBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 0 10px rgba(102, 126, 234, 0.5)",
  },
  metadataFooter: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "#94a3b8",
    marginTop: "4px",
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
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
  },
  buttonDisabled: {
    background: "linear-gradient(135deg, #475569 0%, #334155 100%)",
    cursor: "not-allowed",
    opacity: 0.6,
    boxShadow: "none",
  },
};
