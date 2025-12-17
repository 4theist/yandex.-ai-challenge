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
} from "antd";
import {
  CloudOutlined,
  SettingOutlined,
  ReloadOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useForecastPolling } from "../hooks/useForecastPolling";
import {
  getForecastConfig,
  updateForecastConfig,
  generateForecastNow,
  getForecastHistory,
} from "../api";
import { ForecastConfig, ForecastHistoryResponse } from "../types";

export const ForecastWidget: React.FC = () => {
  const { latestForecast, hasNew, isLoading, markAsRead, refresh } =
    useForecastPolling();
  const [config, setConfig] = useState<ForecastConfig | null>(null);
  const [history, setHistory] = useState<ForecastHistoryResponse | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Show notification when new forecast arrives
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

  const handleTimeChange = async (time: dayjs.Dayjs | null) => {
    if (!time) return;

    const hour = time.hour();
    const minute = time.minute();
    const newSchedule = `${minute} ${hour} * * *`;

    try {
      await updateForecastConfig({ schedule: newSchedule });
      await loadConfig();
      notification.success({
        message: "Расписание обновлено",
        description: `Прогноз будет генерироваться в ${time.format("HH:mm")}`,
        duration: 3,
      });
    } catch (error: any) {
      notification.error({
        message: "Ошибка",
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
        message: "Прогноз сгенерирован",
        duration: 3,
      });
    } catch (error: any) {
      notification.error({
        message: "Ошибка генерации",
        description: error.message,
      });
    } finally {
      setGenerating(false);
    }
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
        width: 350,
        padding: 16,
        backgroundColor: "#18181b",
        borderRadius: 8,
      }}
    >
      {/* Latest Forecast */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 8,
            color: "#fafafa",
          }}
        >
          📍 Последний прогноз
        </div>
        {isLoading ? (
          <Spin size="small" />
        ) : latestForecast?.generated ? (
          <>
            {Object.entries(latestForecast.summaries || {}).map(
              ([city, summary]) => (
                <div
                  key={city}
                  style={{
                    padding: 8,
                    backgroundColor: "#27272a",
                    borderRadius: 6,
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#fafafa",
                  }}
                >
                  {summary}
                </div>
              )
            )}
            <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>
              {formatDate(latestForecast.createdAt!)} •{" "}
              {latestForecast.tokensUsed} токенов
            </div>
          </>
        ) : (
          <Empty
            description="Прогнозов пока нет"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>

      {/* Settings */}
      {showSettings && (
        <div
          style={{
            marginBottom: 16,
            paddingTop: 16,
            borderTop: "1px solid #27272a",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              color: "#fafafa",
            }}
          >
            ⚙️ Настройки
          </div>
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 4 }}>
                Время уведомления:
              </div>
              <TimePicker
                value={getCurrentTime()}
                onChange={handleTimeChange}
                format="HH:mm"
                style={{ width: "100%" }}
              />
            </div>
            {config?.nextRun && (
              <div style={{ fontSize: 11, color: "#71717a" }}>
                Следующий прогноз: {formatDate(config.nextRun)}
              </div>
            )}
          </Space>
        </div>
      )}

      {/* History */}
      {history && (
        <div
          style={{
            marginBottom: 16,
            paddingTop: 16,
            borderTop: "1px solid #27272a",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
              color: "#fafafa",
            }}
          >
            📜 История (последние {history.count})
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {history.forecasts.map((forecast) => (
              <div
                key={forecast.id}
                style={{
                  padding: 6,
                  backgroundColor: "#27272a",
                  borderRadius: 4,
                  marginBottom: 4,
                  fontSize: 11,
                  color: "#d4d4d8",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {formatDate(forecast.date)}
                </div>
                {Object.values(forecast.summaries).map((summary, idx) => (
                  <div key={idx} style={{ color: "#a1a1aa" }}>
                    {summary}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Button
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => {
            if (history) {
              setHistory(null);
            } else {
              loadHistory();
            }
          }}
        >
          {history ? "Скрыть" : "История"}
        </Button>
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? "Скрыть" : "Настройки"}
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<ReloadOutlined />}
          loading={generating}
          onClick={handleGenerateNow}
        >
          Обновить
        </Button>
      </Space>
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
          icon={<CloudOutlined style={{ fontSize: 18 }} />}
          style={{ color: hasNew ? "#6366f1" : "#fafafa" }}
        />
      </Badge>
    </Dropdown>
  );
};
