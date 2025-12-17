import { useState, useEffect, useRef } from "react";
import { getLatestForecast } from "../api";
import { ForecastLatestResponse } from "../types";

interface UseForecastPollingResult {
  latestForecast: ForecastLatestResponse | null;
  hasNew: boolean;
  isLoading: boolean;
  error: string | null;
  markAsRead: () => void;
  refresh: () => Promise<void>;
}

export const useForecastPolling = (
  intervalMs: number = 60000 // 60 секунд
): UseForecastPollingResult => {
  const [latestForecast, setLatestForecast] =
    useState<ForecastLatestResponse | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  const fetchLatest = async () => {
    try {
      const data = await getLatestForecast();

      if (data.generated && data.id) {
        // Проверяем это новая сводка или нет
        const isNew = lastSeenIdRef.current !== data.id;

        setLatestForecast(data);

        // Если есть новая сводка и мы уже видели хотя бы одну
        if (isNew && lastSeenIdRef.current !== null) {
          setHasNew(true);
        }

        // Если это первая загрузка, не показываем как "новое"
        if (lastSeenIdRef.current === null) {
          lastSeenIdRef.current = data.id;
        }
      } else {
        setLatestForecast(data);
      }

      setError(null);
    } catch (err: any) {
      console.error("[FORECAST POLLING] Error:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = () => {
    if (latestForecast?.id) {
      lastSeenIdRef.current = latestForecast.id;
      setHasNew(false);
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    await fetchLatest();
  };

  // Initial fetch
  useEffect(() => {
    fetchLatest();
  }, []);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLatest();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return {
    latestForecast,
    hasNew,
    isLoading,
    error,
    markAsRead,
    refresh,
  };
};
