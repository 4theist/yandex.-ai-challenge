import React from "react";

interface TokenUsageBarProps {
  label: string;
  used: number;
  limit: number;
  percent: number;
}

export const TokenUsageBar: React.FC<TokenUsageBarProps> = ({
  label,
  used,
  limit,
  percent,
}) => {
  const getColor = () => {
    if (percent >= 90) return "#ef4444"; // красный
    if (percent >= 70) return "#f59e0b"; // оранжевый
    return "#22c55e"; // зелёный
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        <span style={styles.value}>
          {used} / {limit} ({percent}%)
        </span>
      </div>
      <div style={styles.barBackground}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: "8px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    fontSize: "11px",
  },
  label: {
    color: "#a1a1aa",
    fontWeight: "500",
  },
  value: {
    color: "#fafafa",
    fontFamily: "monospace",
    fontWeight: "600",
  },
  barBackground: {
    height: "6px",
    backgroundColor: "#27272a",
    borderRadius: "3px",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    transition: "width 0.3s ease, background-color 0.3s ease",
    borderRadius: "3px",
  },
};
