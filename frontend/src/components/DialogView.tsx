import React, { useState, useEffect, useRef } from "react";
import {
  ModelsConfig,
  DialogMessage,
  SessionStats,
  SavedSessionInfo,
} from "../types";
import {
  getModels,
  createDialogSession,
  sendDialogMessage,
  deleteSession,
  compressSession,
  getSavedSessions,
  restoreSession,
  exportSession,
  getSessionHistory,
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
  const [savedSessions, setSavedSessions] = useState<SavedSessionInfo[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // NEW: Tools state
  const [useTools, setUseTools] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSavedSessions = async () => {
    try {
      const response = await getSavedSessions();
      setSavedSessions(response.sessions);
    } catch (error: any) {
      console.error("Failed to load saved sessions:", error);
    }
  };

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
      await loadSavedSessions();
      console.log("Session created:", response.sessionId);
    } catch (error: any) {
      alert("Ошибка создания сессии: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // UPDATED: Send message with tools support
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
        useTools, // NEW
      });

      const assistantMessage: DialogMessage = {
        role: "assistant",
        content: response.result.text,
        timestamp: new Date(),
        tokens: response.result.metrics.totalTokens,
        toolsCalled: response.toolsCalled, // NEW
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStats(response.stats);
      await loadSavedSessions();

      if (response.compressionTriggered) {
        console.log("🔥 Compression triggered!");
      }

      // NEW: Log tools usage
      if (response.toolsCalled && response.toolsCalled.length > 0) {
        console.log(
          `🔧 Tools used: ${response.toolsCalled.length}`,
          response.toolsCalled
        );
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
    if (!confirm("Завершить и удалить эту сессию?")) return;

    try {
      await deleteSession(sessionId);
      setSessionId(null);
      setMessages([]);
      setStats(null);
      await loadSavedSessions();
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
      await loadSavedSessions();
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

  const handleRestoreSession = async (restoredSessionId: string) => {
    try {
      setIsLoading(true);
      const response = await restoreSession(restoredSessionId);

      setSessionId(response.session.sessionId);
      setProvider(response.session.provider as "yandex" | "openrouter");
      setSelectedModel(response.session.model);
      setTemperature(response.session.temperature);
      setCompressionEnabled(response.session.config.compressionEnabled);
      setCompressionThreshold(response.session.config.compressionThreshold);
      setStats(response.stats);

      // Load full message history
      try {
        const history = await getSessionHistory(restoredSessionId);
        const loadedMessages: DialogMessage[] = [];

        for (const summary of history.summaries) {
          loadedMessages.push({
            role: "system",
            content: `📦 Сжатое содержание (${summary.messagesCount} сообщений):\n${summary.content}`,
            timestamp: summary.createdAt,
            tokens: summary.summaryTokens,
          });
        }

        loadedMessages.push(...history.messages);
        setMessages(loadedMessages);

        console.log(
          `[RESTORE] Loaded ${history.messages.length} messages and ${history.summaries.length} summaries`
        );
      } catch (historyError: any) {
        console.error("Failed to load history:", historyError);
        setMessages([]);
      }
    } catch (error: any) {
      alert("Ошибка восстановления: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSession = async (sessionId: string) => {
    try {
      await exportSession(sessionId);
      alert("✅ Сессия экспортирована!");
    } catch (error: any) {
      alert("Ошибка экспорта: " + error.message);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setStats(null);
    setMessage("");
  };

  const getSessionPreview = (session: SavedSessionInfo) => {
    return `${session.model} • ${session.totalMessages} msg`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}д`;
    if (hours > 0) return `${hours}ч`;
    if (minutes > 0) return `${minutes}м`;
    return "сейчас";
  };

  // Load models
  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((error) => {
        alert("Ошибка загрузки моделей: " + error.message);
      });
  }, []);

  // Load saved sessions
  useEffect(() => {
    loadSavedSessions();
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

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <button
              onClick={handleNewSession}
              style={styles.newSessionButton}
              disabled={!sessionId}
            >
              ➕ Новая сессия
            </button>
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.collapseButton}
            title={sidebarCollapsed ? "Развернуть" : "Свернуть"}
          >
            {sidebarCollapsed ? "▶️" : "◀️"}
          </button>

          {!sidebarCollapsed && (
            <div style={styles.sessionsList}>
              {savedSessions.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>💬</div>
                  <div style={styles.emptyText}>Нет сессий</div>
                </div>
              ) : (
                savedSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    style={{
                      ...styles.sessionItem,
                      ...(sessionId === session.sessionId
                        ? styles.sessionItemActive
                        : {}),
                    }}
                    onClick={() => handleRestoreSession(session.sessionId)}
                  >
                    <div style={styles.sessionItemHeader}>
                      <span style={styles.sessionItemIcon}>
                        {session.provider === "yandex" ? "🟣" : "🔵"}
                      </span>
                      <span style={styles.sessionItemTime}>
                        {formatTimeAgo(session.lastActivity)}
                      </span>
                    </div>
                    <div style={styles.sessionItemPreview}>
                      {getSessionPreview(session)}
                    </div>
                    <div style={styles.sessionItemActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSession(session.sessionId);
                        }}
                        style={styles.sessionActionButton}
                        title="Экспорт"
                      >
                        💾
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Удалить эту сессию?")) {
                            deleteSession(session.sessionId).then(
                              loadSavedSessions
                            );
                          }
                        }}
                        style={styles.sessionActionButton}
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div style={styles.mainContent}>
        {!sessionId ? (
          // Session setup
          <div style={styles.setupCard}>
            <h2 style={styles.setupTitle}>🗨️ Новый диалог с памятью</h2>

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

            <div style={styles.controlGroup}>
              <label style={styles.label}>
                Температура:{" "}
                <span style={styles.value}>{temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={styles.slider}
              />
            </div>

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

            <button
              onClick={() => setShowSettings(!showSettings)}
              style={styles.toggleButton}
              type="button"
            >
              ⚙️ {showSettings ? "Скрыть" : "Показать"} настройки сжатия
            </button>

            {showSettings && (
              <div style={styles.settingsBox}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={compressionEnabled}
                    onChange={(e) => setCompressionEnabled(e.target.checked)}
                    style={styles.checkbox}
                  />
                  Включить автоматическое сжатие
                </label>

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
                      max="30"
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
            {/* Header */}
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
                      💾 {stats.savedTokens} токенов ({stats.compressionRatio}%)
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.headerRight}>
                <button
                  onClick={handleManualCompress}
                  disabled={isLoading || messages.length === 0}
                  style={styles.compressButton}
                >
                  🗜️ Сжать
                </button>
                <button
                  onClick={handleEndSession}
                  disabled={isLoading}
                  style={styles.endButton}
                >
                  🗑️ Удалить
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
                      : msg.role === "system"
                      ? styles.systemMessage
                      : styles.assistantMessage),
                  }}
                >
                  <div style={styles.messageHeader}>
                    <div style={styles.messageRole}>
                      {msg.role === "user"
                        ? "👤 Вы"
                        : msg.role === "system"
                        ? "📦 Содержание"
                        : "🤖 Ассистент"}
                    </div>
                    {msg.tokens && (
                      <div style={styles.messageTokens}>
                        {msg.tokens} токенов
                      </div>
                    )}
                  </div>
                  <div style={styles.messageContent}>{msg.content}</div>

                  {/* NEW: Display tools called */}
                  {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                    <details style={styles.toolsDetails}>
                      <summary style={styles.toolsSummary}>
                        🔧 Использовано инструментов: {msg.toolsCalled.length}
                      </summary>
                      <div style={styles.toolsList}>
                        {msg.toolsCalled.map((tool, idx) => (
                          <div key={idx} style={styles.toolItem}>
                            <div style={styles.toolName}>📍 {tool.name}</div>
                            <div style={styles.toolArgs}>
                              <strong>Параметры:</strong>
                              <pre style={styles.toolCode}>
                                {JSON.stringify(tool.arguments, null, 2)}
                              </pre>
                            </div>
                            <details>
                              <summary style={styles.toolResultSummary}>
                                Показать результат
                              </summary>
                              <pre style={styles.toolResult}>{tool.result}</pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}

              {isLoading && (
                <div style={styles.loadingMessage}>⏳ Генерация ответа...</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* UPDATED: Input with tools checkbox */}
            <div style={styles.inputContainer}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Введите сообщение... (Enter для отправки)"
                  rows={3}
                  style={styles.input}
                  disabled={isLoading}
                />

                {/* NEW: Tools checkbox */}
                <label style={styles.toolsCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={useTools}
                    onChange={(e) => setUseTools(e.target.checked)}
                    style={styles.checkbox}
                  />
                  🔧 Разрешить использование инструментов (погода и др.)
                </label>
              </div>

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
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "calc(100vh - 100px)",
    gap: "0",
    backgroundColor: "#0a0a0a",
  },

  // Sidebar
  sidebar: {
    backgroundColor: "#18181b",
    borderRight: "1px solid #27272a",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s ease",
    overflow: "hidden",
    flexShrink: 0,
    borderRadius: "16px",
  },
  sidebarHeader: {
    padding: "16px",
    borderBottom: "1px solid #27272a",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  newSessionButton: {
    flex: 1,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  collapseButton: {
    padding: "8px",
    backgroundColor: "#27272a",
    color: "#fafafa",
    border: "1px solid #3f3f46",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  sessionsList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  },
  sessionItem: {
    padding: "12px",
    marginBottom: "6px",
    backgroundColor: "#27272a",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    border: "1px solid transparent",
  },
  sessionItemActive: {
    backgroundColor: "#3f3f46",
    borderColor: "#6366f1",
    boxShadow: "0 0 0 1px #6366f1",
  },
  sessionItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  sessionItemIcon: {
    fontSize: "14px",
  },
  sessionItemTime: {
    fontSize: "10px",
    color: "#71717a",
    fontWeight: "500",
  },
  sessionItemPreview: {
    fontSize: "12px",
    color: "#a1a1aa",
    marginBottom: "8px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sessionItemActions: {
    display: "flex",
    gap: "4px",
  },
  sessionActionButton: {
    padding: "4px 8px",
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#71717a",
  },
  emptyIcon: {
    fontSize: "32px",
    marginBottom: "8px",
  },
  emptyText: {
    fontSize: "12px",
  },

  // Main content
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "20px", // Отступы вокруг основного контента
  },

  // Setup screen
  setupCard: {
    backgroundColor: "#18181b",
    borderRadius: "16px",
    border: "1px solid #27272a",
    padding: "32px",
    margin: "auto",
    maxWidth: "600px",
    width: "100%",
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
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#fafafa",
    cursor: "pointer",
    marginBottom: "16px",
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
    borderRadius: "16px", // Скругление углов
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
    backgroundColor: "#0a0a0a", // Более темный фон для сообщений
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
  systemMessage: {
    alignSelf: "center",
    backgroundColor: "#3f3f46",
    color: "#d4d4d8",
    maxWidth: "90%",
    fontSize: "12px",
    fontStyle: "italic",
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
    backgroundColor: "#18181b",
    display: "flex",
    gap: "12px",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #27272a",
    backgroundColor: "#0a0a0a",
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

  toolsCheckboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#a1a1aa",
    cursor: "pointer",
    padding: "4px 0",
    userSelect: "none",
  },

  toolsDetails: {
    marginTop: "12px",
    padding: "12px",
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderRadius: "8px",
    border: "1px solid rgba(99, 102, 241, 0.25)",
  },

  toolsSummary: {
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    color: "#8b5cf6",
    padding: "4px 0",
    userSelect: "none",
  },

  toolsList: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  toolItem: {
    padding: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: "6px",
    fontSize: "11px",
    border: "1px solid rgba(99, 102, 241, 0.15)",
  },

  toolName: {
    fontWeight: "700",
    marginBottom: "8px",
    color: "#a78bfa",
    fontSize: "12px",
  },

  toolArgs: {
    marginBottom: "8px",
    color: "#d4d4d8",
  },

  toolCode: {
    marginTop: "4px",
    padding: "8px",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: "4px",
    fontSize: "10px",
    overflow: "auto",
    color: "#fafafa",
    fontFamily: "monospace",
  },

  toolResultSummary: {
    cursor: "pointer",
    fontSize: "11px",
    color: "#a1a1aa",
    marginTop: "6px",
    fontWeight: "600",
    userSelect: "none",
  },

  toolResult: {
    marginTop: "6px",
    padding: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "4px",
    fontSize: "10px",
    overflow: "auto",
    maxHeight: "300px",
    color: "#fafafa",
    fontFamily: "monospace",
    lineHeight: "1.4",
    whiteSpace: "pre-wrap",
  },
};
