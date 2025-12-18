import React, { useState, useEffect } from "react";
import {
  notification,
  Badge,
  Dropdown,
  Button,
  TimePicker,
  Space,
  Spin,
  Empty,
  Tabs,
} from "antd";
import {
  CloudOutlined,
  SettingOutlined,
  ReloadOutlined,
  HistoryOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useForecastPolling } from "../hooks/useForecastPolling";
import {
  getForecastConfig,
  updateForecastConfig,
  generateForecastNow,
  getForecastHistory,
  downloadSummary,
  listSummaries,
  runMCPPipeline,
} from "../api";
import {
  ForecastConfig,
  ForecastHistoryResponse,
  SummaryResponse,
} from "../types";

const { TabPane } = Tabs;

export const ForecastWidget: React.FC = () => {
  const { latestForecast, hasNew, isLoading, markAsRead, refresh } =
    useForecastPolling();
  const [config, setConfig] = useState<ForecastConfig | null>(null);
  const [history, setHistory] = useState<ForecastHistoryResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Summary state
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [latestSummary, setLatestSummary] = useState<SummaryResponse | null>(
    null
  );
  const [summaryFiles, setSummaryFiles] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
    loadSummaryFiles();
  }, []);

  useEffect(() => {
    if (hasNew && latestForecast?.generated && latestForecast.summaries) {
      notification.open({
        message: "🌤️ Новый прогноз погоды",
        description: (
          <div style={{ fontSize: "13px" }}>
            {Object.entries(latestForecast.summaries).map(([city, summary]) => (
              <div key={city} style={{ marginBottom: "4px" }}>
                {summary}
              </div>
            ))}
          </div>
        ),
        duration: 10,
        placement: "topRight",
        onClick: () => {
          markAsRead();
          setDropdownOpen(true);
        },
      });
    }
  }, [hasNew, latestForecast]);

  const loadConfig = async () => {
    try {
      const cfg = await getForecastConfig();
      setConfig(cfg);
    } catch (error: any) {
      console.error("Failed to load config:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const hist = await getForecastHistory(7);
      setHistory(hist);
    } catch (error: any) {
      console.error("Failed to load history:", error);
    }
  };

  const loadSummaryFiles = async () => {
    try {
      const response = await listSummaries();
      setSummaryFiles(response.files);
    } catch (error: any) {
      console.error("Failed to load summary files:", error);
    }
  };

  const handleTimeChange = async (time: dayjs.Dayjs | null) => {
    if (!time) return;

    const hour = time.hour();
    const minute = time.minute();
    const newSchedule = `${minute} ${hour} * * *`;

    try {
      await updateForecastConfig({ schedule: newSchedule });
      await loadConfig();
      notification.success({
        message: "✅ Расписание обновлено",
        description: `Прогноз будет генерироваться в ${time.format("HH:mm")}`,
        duration: 3,
      });
    } catch (error: any) {
      notification.error({
        message: "❌ Ошибка",
        description: error.message,
      });
    }
  };

  const handleGenerateNow = async () => {
    setGenerating(true);
    try {
      await generateForecastNow();
      await refresh();
      notification.success({
        message: "✅ Прогноз обновлен",
        duration: 3,
      });
    } catch (error: any) {
      notification.error({
        message: "❌ Ошибка",
        description: error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRetrospective = async () => {
    setGeneratingSummary(true);
    try {
      const result = await runMCPPipeline({
        query: "Weather retrospective analysis",
        days: 7,
        searchType: "forecasts",
        fileFormat: "md",
      });

      setLatestSummary({
        success: true,
        summary: result.summary.text,
        tokensUsed: result.summary.tokens_used,
        forecastsAnalyzed: result.search.found,
        savedFile: {
          filename: result.file.filename,
          path: result.file.filepath,
          size: result.file.size,
        },
      });

      await loadSummaryFiles();
      notification.success({
        message: "✅ Сводка создана через MCP",
        description: `🔧 Pipeline: Search → Summarize → Save | ${result.summary.tokens_used} токенов`,
        duration: 5,
      });
    } catch (error: any) {
      notification.error({
        message: "❌ Ошибка MCP Pipeline",
        description: error.message,
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleGenerateForecast = async () => {
    setGeneratingSummary(true);
    try {
      const result = await runMCPPipeline({
        query: "Weather forecast summary for next week",
        days: 7,
        searchType: "forecasts",
        fileFormat: "md",
      });

      setLatestSummary({
        success: true,
        summary: result.summary.text,
        tokensUsed: result.summary.tokens_used,
        daysAnalyzed: result.search.found,
        savedFile: {
          filename: result.file.filename,
          path: result.file.filepath,
          size: result.file.size,
        },
      });

      await loadSummaryFiles();
      notification.success({
        message: "✅ Прогноз создан через MCP",
        description: `🔧 Композиция 3 MCP серверов | ${result.summary.tokens_used} токенов`,
        duration: 5,
      });
    } catch (error: any) {
      notification.error({
        message: "❌ Ошибка MCP Pipeline",
        description: error.message,
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleDownloadSummary = (filename: string) => {
    downloadSummary(filename);
  };

  const getCurrentTime = () => {
    if (!config?.schedule) return dayjs();
    const parts = config.schedule.split(" ");
    const hour = parseInt(parts[1] || "8");
    const minute = parseInt(parts[0] || "0");
    return dayjs().hour(hour).minute(minute);
  };

  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format("DD.MM.YYYY HH:mm");
  };

  const dropdownContent = (
    <div
      style={{
        width: 440,
        maxHeight: 600,
        overflowY: "auto",
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        borderRadius: 12,
        padding: 0,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(100, 116, 139, 0.2)",
      }}
    >
      <Tabs
        defaultActiveKey="latest"
        size="small"
        style={{
          padding: "12px 16px 0",
        }}
        tabBarStyle={{
          marginBottom: 0,
          borderBottom: "1px solid rgba(100, 116, 139, 0.2)",
        }}
      >
        {/* Вкладка: Последний прогноз */}
        <TabPane
          tab={
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              <CloudOutlined style={{ marginRight: 6 }} />
              Прогноз
            </span>
          }
          key="latest"
        >
          <div style={{ padding: "16px 0 12px" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Spin size="large" />
              </div>
            ) : latestForecast?.generated ? (
              <>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    marginBottom: 12,
                    color: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  🌍 Последний прогноз
                </div>

                {Object.entries(latestForecast.summaries || {}).map(
                  ([city, summary]) => (
                    <div
                      key={city}
                      style={{
                        padding: 14,
                        background:
                          "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))",
                        borderRadius: 10,
                        marginBottom: 10,
                        fontSize: 13,
                        color: "#e2e8f0",
                        lineHeight: 1.6,
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                      }}
                    >
                      {summary}
                    </div>
                  )
                )}

                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    marginTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0 4px",
                  }}
                >
                  <span>🕐 {formatDate(latestForecast.createdAt!)}</span>
                  <span>⚡ {latestForecast.tokensUsed} токенов</span>
                </div>

                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={generating}
                  onClick={handleGenerateNow}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    height: 38,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 500,
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  }}
                >
                  Обновить прогноз
                </Button>
              </>
            ) : (
              <Empty
                description={
                  <span style={{ color: "#94a3b8" }}>Прогнозов пока нет</span>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: "40px 0" }}
              >
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleGenerateNow}
                  loading={generating}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: 8,
                  }}
                >
                  Создать первый прогноз
                </Button>
              </Empty>
            )}
          </div>
        </TabPane>

        {/* Вкладка: История */}
        <TabPane
          tab={
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              <HistoryOutlined style={{ marginRight: 6 }} />
              История
            </span>
          }
          key="history"
        >
          <div style={{ padding: "16px 0 12px" }}>
            {!history ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Button
                  type="primary"
                  onClick={loadHistory}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    borderRadius: 8,
                  }}
                >
                  Загрузить историю
                </Button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    marginBottom: 12,
                    color: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  📜 История ({history.count})
                </div>
                <div
                  style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}
                >
                  {history.forecasts.map((forecast, idx) => (
                    <div
                      key={forecast.id}
                      style={{
                        padding: 12,
                        background:
                          idx % 2 === 0
                            ? "rgba(51, 65, 85, 0.4)"
                            : "rgba(30, 41, 59, 0.4)",
                        borderRadius: 8,
                        marginBottom: 8,
                        fontSize: 12,
                        color: "#cbd5e1",
                        border: "1px solid rgba(71, 85, 105, 0.3)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 6,
                          color: "#e2e8f0",
                        }}
                      >
                        {formatDate(forecast.date)}
                      </div>
                      {Object.values(forecast.summaries).map((summary, idx) => (
                        <div
                          key={idx}
                          style={{ color: "#94a3b8", marginTop: 4 }}
                        >
                          {summary}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabPane>

        {/* Вкладка: Сводки */}
        <TabPane
          tab={
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              <FileTextOutlined style={{ marginRight: 6 }} />
              Сводки
            </span>
          }
          key="summaries"
        >
          <div style={{ padding: "16px 0 12px" }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: 16,
                color: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📊 Погодные сводки
            </div>

            {/* Кнопки генерации */}
            <Space
              direction="vertical"
              style={{ width: "100%", marginBottom: 20 }}
            >
              <div>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={handleGenerateRetrospective}
                  loading={generatingSummary}
                  style={{
                    width: "100%",
                    height: 40,
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 500,
                    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  📈 Сводка за неделю
                </Button>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    marginTop: 6,
                    paddingLeft: 4,
                  }}
                >
                  Анализ погоды за последние 7 дней
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={handleGenerateForecast}
                  loading={generatingSummary}
                  style={{
                    width: "100%",
                    height: 40,
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 500,
                    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                  }}
                >
                  🔮 Прогноз на неделю
                </Button>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    marginTop: 6,
                    paddingLeft: 4,
                  }}
                >
                  Прогноз погоды на следующие 7 дней
                </div>
              </div>
            </Space>

            {/* Последняя сводка */}
            {latestSummary?.success && (
              <div
                style={{
                  marginTop: 20,
                  padding: 14,
                  background: "rgba(99, 102, 241, 0.08)",
                  borderRadius: 10,
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "#c7d2fe",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ✨ Последняя сводка
                </div>
                <div
                  style={{
                    padding: 14,
                    background: "rgba(30, 41, 59, 0.6)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#e2e8f0",
                    whiteSpace: "pre-line",
                    lineHeight: 1.6,
                    marginBottom: 10,
                    border: "1px solid rgba(71, 85, 105, 0.3)",
                  }}
                >
                  {latestSummary.summary}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    marginBottom: 10,
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <span>⚡ {latestSummary.tokensUsed} токенов</span>
                  <span>
                    📊{" "}
                    {latestSummary.forecastsAnalyzed ||
                      latestSummary.daysAnalyzed}{" "}
                    дней
                  </span>
                </div>
                {latestSummary.savedFile && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      handleDownloadSummary(latestSummary.savedFile!.filename)
                    }
                    style={{
                      width: "100%",
                      background: "rgba(99, 102, 241, 0.2)",
                      color: "#c7d2fe",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      borderRadius: 6,
                    }}
                  >
                    Скачать MD файл
                  </Button>
                )}
              </div>
            )}

            {/* Список файлов */}
            {summaryFiles.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📁 Файлы ({summaryFiles.length})
                </div>
                <div
                  style={{ maxHeight: 160, overflowY: "auto", paddingRight: 4 }}
                >
                  {summaryFiles.slice(0, 8).map((file, idx) => (
                    <div
                      key={file}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        background:
                          idx % 2 === 0
                            ? "rgba(51, 65, 85, 0.3)"
                            : "rgba(30, 41, 59, 0.3)",
                        borderRadius: 6,
                        marginBottom: 6,
                        fontSize: 11,
                        border: "1px solid rgba(71, 85, 105, 0.2)",
                      }}
                    >
                      <span
                        style={{
                          color: "#cbd5e1",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📄 {file}
                      </span>
                      <Button
                        size="small"
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadSummary(file)}
                        style={{
                          color: "#818cf8",
                          padding: "0 8px",
                          minWidth: 32,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabPane>

        {/* Вкладка: Настройки */}
        <TabPane
          tab={
            <span style={{ fontSize: "13px", fontWeight: 500 }}>
              <SettingOutlined style={{ marginRight: 6 }} />
              Настройки
            </span>
          }
          key="settings"
        >
          <div style={{ padding: "16px 0 12px" }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: 16,
                color: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⚙️ Настройки
            </div>

            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#cbd5e1",
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  🕐 Время уведомления
                </div>
                <TimePicker
                  value={getCurrentTime()}
                  onChange={handleTimeChange}
                  format="HH:mm"
                  style={{ width: "100%", borderRadius: 8 }}
                  size="large"
                />
              </div>

              {config?.nextRun && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    marginTop: 8,
                    padding: 10,
                    background: "rgba(51, 65, 85, 0.3)",
                    borderRadius: 6,
                    border: "1px solid rgba(71, 85, 105, 0.3)",
                  }}
                >
                  📅 Следующий прогноз:{" "}
                  <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                    {formatDate(config.nextRun)}
                  </span>
                </div>
              )}
            </Space>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={(open) => {
        setDropdownOpen(open);
        if (open) {
          markAsRead();
        }
      }}
      dropdownRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
    >
      <Badge dot={hasNew} offset={[-5, 5]}>
        <Button
          type="text"
          icon={<CloudOutlined style={{ fontSize: 20 }} />}
          style={{
            color: hasNew ? "#818cf8" : "#cbd5e1",
            transition: "all 0.3s ease",
          }}
        />
      </Badge>
    </Dropdown>
  );
};
