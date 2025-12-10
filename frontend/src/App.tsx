import React, { useState, useEffect } from "react";
import { checkHealth } from "./api";
import { SingleModelView } from "./components/SingleModelView";
import { CompareView } from "./components/CompareView";

function App() {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth()
      .then((data) => setIsApiHealthy(data.status === "OK"))
      .catch(() => setIsApiHealthy(false));
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          {/* Left: Title */}
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>🤖 AI Models Comparison</h1>
          </div>

          {/* Center: Mode switcher */}
          <div style={styles.modeSwitcher}>
            <label
              style={{
                ...styles.modeLabel,
                ...(mode === "single" && {
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  fontWeight: "600",
                }),
              }}
            >
              <input
                type="radio"
                value="single"
                checked={mode === "single"}
                onChange={() => setMode("single")}
                style={styles.radio}
              />
              <span>Одна модель</span>
            </label>
            <label
              style={{
                ...styles.modeLabel,
                ...(mode === "compare" && {
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  fontWeight: "600",
                }),
              }}
            >
              <input
                type="radio"
                value="compare"
                checked={mode === "compare"}
                onChange={() => setMode("compare")}
                style={styles.radio}
              />
              <span>Сравнение</span>
            </label>
          </div>

          {/* Right: Health indicator */}
          <div style={styles.headerRight}>
            <div
              style={{
                ...styles.healthIndicator,
                ...(isApiHealthy === true && styles.healthOk),
                ...(isApiHealthy === false && styles.healthError),
              }}
            >
              {isApiHealthy === null && "⏳"}
              {isApiHealthy === true && "✓ API"}
              {isApiHealthy === false && "✗ API"}
            </div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {mode === "single" ? <SingleModelView /> : <CompareView />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    background:
      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
    color: "white",
    padding: "12px 24px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1400px",
    margin: "0 auto",
    gap: "20px",
  },
  headerLeft: {
    flex: "0 0 auto",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
  },
  subtitle: {
    display: "none", // Убираем subtitle
  },
  headerInfo: {
    display: "none", // Убираем отдельный блок
  },
  headerRight: {
    flex: "0 0 auto",
  },
  healthIndicator: {
    fontSize: "12px",
    fontWeight: "500",
    padding: "6px 12px",
    borderRadius: "12px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    whiteSpace: "nowrap",
  },
  healthOk: {
    backgroundColor: "rgba(34, 197, 94, 0.3)",
    color: "#d1fae5",
  },
  healthError: {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    color: "#fecaca",
  },
  modeSwitcher: {
    display: "flex",
    gap: "4px",
    padding: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: "10px",
    flex: "0 0 auto",
  },
  modeLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    padding: "6px 16px",
    borderRadius: "8px",
    transition: "all 0.2s",
    backgroundColor: "transparent",
    whiteSpace: "nowrap",
  },
  radio: {
    display: "none",
  },
  main: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
    maxWidth: "1400px",
    margin: "0 auto",
    width: "100%",
  },
};

export default App;
