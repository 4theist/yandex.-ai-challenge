import React, { useState, useRef, useEffect } from "react";
import { sendMessage, Message } from "./api";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isToolUsage?: boolean;
  timestamp: Date;
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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
      // Показываем индикатор обработки
      const processingMessage: DisplayMessage = {
        id: `processing-${Date.now()}`,
        role: "assistant",
        content: "Обрабатываю запрос...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, processingMessage]);

      // Отправляем запрос
      const response = await sendMessage(input, conversationHistory);

      // Удаляем индикатор обработки
      setMessages((prev) => prev.filter((m) => m.id !== processingMessage.id));

      // Показываем использование инструментов, если они были вызваны
      if (response.toolsUsed) {
        const toolMessage: DisplayMessage = {
          id: `tool-${Date.now()}`,
          role: "assistant",
          content: "🔧 Агент использует инструменты для обработки запроса...",
          isToolUsage: true,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, toolMessage]);

        // Задержка для визуального эффекта
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Добавляем ответ
      const assistantMessage: DisplayMessage = {
        id: `response-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Обновляем историю
      setConversationHistory(response.conversationHistory);
    } catch (error: any) {
      setMessages((prev) =>
        prev.filter((m) => !m.id.startsWith("processing-"))
      );

      const errorMessage: DisplayMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ Ошибка: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>YandexGPT AI Agent</h1>
        <p style={styles.subtitle}>
          Агент с инструментами: калькулятор, время, поиск
        </p>
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p>👋 Привет! Я ИИ-агент с доступом к инструментам.</p>
            <p>Попробуй спросить:</p>
            <ul style={styles.examplesList}>
              <li>"Сколько будет 25 умножить на 4?"</li>
              <li>"Какое сейчас время в Токио?"</li>
              <li>"Найди информацию про React"</li>
            </ul>
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
              ...(msg.isToolUsage ? styles.toolMessage : {}),
            }}
          >
            <div style={styles.messageHeader}>
              <span style={styles.messageRole}>
                {msg.role === "user" ? "👤 Вы" : "🤖 Агент"}
              </span>
              <span style={styles.messageTime}>
                {msg.timestamp.toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div style={styles.messageContent}>{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          style={styles.input}
          disabled={isLoading}
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          style={{
            ...styles.button,
            ...(!input.trim() || isLoading ? styles.buttonDisabled : {}),
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
    maxWidth: "900px",
    margin: "0 auto",
    backgroundColor: "#f5f5f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    backgroundColor: "#2563eb",
    color: "white",
    padding: "20px",
    textAlign: "center",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "24px",
    fontWeight: "bold",
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
    opacity: 0.9,
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  emptyState: {
    textAlign: "center",
    color: "#666",
    padding: "40px 20px",
  },
  examplesList: {
    textAlign: "left",
    display: "inline-block",
    marginTop: "16px",
    color: "#2563eb",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "12px",
    maxWidth: "80%",
    wordWrap: "break-word",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    color: "white",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
  },
  toolMessage: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fbbf24",
    fontStyle: "italic",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
    fontSize: "12px",
    opacity: 0.8,
  },
  messageRole: {
    fontWeight: "bold",
  },
  messageTime: {
    fontSize: "11px",
  },
  messageContent: {
    lineHeight: "1.5",
  },
  inputContainer: {
    padding: "16px",
    backgroundColor: "white",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    gap: "12px",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "none",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#9ca3af",
    cursor: "not-allowed",
  },
};
