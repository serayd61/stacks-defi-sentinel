import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DailyMetric {
  date: string;
  dau: number;
  newUsers: number;
  revenue: number;
  txVolume: number;
}

export interface OverviewResponse {
  days: DailyMetric[];
  summary: {
    totalRevenue: number;
    totalTxVolume: number;
    avgDau: number;
    totalNewUsers: number;
  };
}

export interface FunnelStep {
  stepIndex: number;
  stepName: string;
  usersReached: number;
  conversionFromPrev: number;
}

export interface FunnelResponse {
  funnelId: string;
  steps: FunnelStep[];
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useAnalyticsOverview(range: '7d' | '30d' = '30d') {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!hasLoaded.current) setIsLoading(true);
      setError(null);

      const now = new Date();
      const to = now.toISOString().slice(0, 10);
      const days = range === '7d' ? 6 : 29;
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const res = await fetch(
        `${API_URL}/api/analytics/overview?from=${from}&to=${to}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setData(json);
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    hasLoaded.current = false;
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useAcquisitionFunnel() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(
        `${API_URL}/api/analytics/funnel/acquisition`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
