import React from "react";
import { SavedSessionInfo } from "../types";

interface SavedSessionsListProps {
  sessions: SavedSessionInfo[];
  onRestore: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export const SavedSessionsList: React.FC<SavedSessionsListProps> = ({
  sessions,
  onRestore,
  onExport,
  onDelete,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeSince = (dateStr: string) => {
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}д назад`;
    if (hours > 0) return `${hours}ч назад`;
    if (minutes > 0) return `${minutes}м назад`;
    return "только что";
  };

  if (sessions.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>💾</div>
        <div style={styles.emptyText}>Нет сохранённых сессий</div>
        <div style={styles.emptyHint}>
          Создайте диалог, и он автоматически сохранится
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>💾 Сохранённые сессии ({sessions.length})</h3>
      </div>
      <div style={styles.list}>
        {sessions.map((session) => (
          <div key={session.sessionId} style={styles.sessionCard}>
            <div style={styles.sessionInfo}>
              <div style={styles.sessionHeader}>
                <span style={styles.sessionId}>
                  {session.sessionId.substring(0, 8)}...
                </span>
                <span style={styles.timeSince}>
                  {getTimeSince(session.lastActivity)}
                </span>
              </div>
              <div style={styles.sessionMeta}>
                <span style={styles.provider}>
                  {session.provider === "yandex" ? "🟣" : "🔵"} {session.model}
                </span>
                <span style={styles.messages}>
                  💬 {session.totalMessages} сообщений
                </span>
              </div>
              <div style={styles.sessionDate}>
                Создана: {formatDate(session.createdAt)}
              </div>
            </div>
            <div style={styles.actions}>
              <button
                onClick={() => onRestore(session.sessionId)}
                style={styles.actionButton}
                title="Восстановить сессию"
              >
                ▶️
              </button>
              <button
                onClick={() => onExport(session.sessionId)}
                style={styles.actionButton}
                title="Экспортировать в JSON"
              >
                📥
              </button>
              <button
                onClick={() => onDelete(session.sessionId)}
                style={{ ...styles.actionButton, ...styles.deleteButton }}
                title="Удалить сессию"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: "20px",
  },
  header: {
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#fafafa",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "300px",
    overflowY: "auto",
    padding: "2px",
  },
  sessionCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    transition: "all 0.2s",
  },
  sessionInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sessionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionId: {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#a1a1aa",
    fontWeight: "600",
  },
  timeSince: {
    fontSize: "11px",
    color: "#71717a",
  },
  sessionMeta: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
  },
  provider: {
    color: "#e4e4e7",
    fontWeight: "500",
  },
  messages: {
    color: "#a1a1aa",
  },
  sessionDate: {
    fontSize: "11px",
    color: "#71717a",
  },
  actions: {
    display: "flex",
    gap: "6px",
    marginLeft: "12px",
  },
  actionButton: {
    padding: "8px 12px",
    backgroundColor: "#27272a",
    border: "1px solid #3f3f46",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  emptyState: {
    padding: "40px 20px",
    textAlign: "center",
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "12px",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "12px",
  },
  emptyText: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fafafa",
    marginBottom: "8px",
  },
  emptyHint: {
    fontSize: "13px",
    color: "#71717a",
  },
};
