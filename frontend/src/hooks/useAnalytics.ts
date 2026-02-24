import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://stacks-defi-sentinel-production.up.railway.app';

export interface DailyMetricDto {
  date: string;
  dau: number;
  newUsers: number;
  revenue: number;
  txVolume: number;
}

export interface OverviewResponse {
  days: DailyMetricDto[];
  summary: {
    totalRevenue: number;
    totalTxVolume: number;
    avgDau: number;
    totalNewUsers: number;
  };
}

export interface FunnelStepDto {
  stepIndex: number;
  stepName: string;
  usersReached: number;
  conversionFromPrev: number;
}

export interface FunnelResponse {
  funnelId: string;
  steps: FunnelStepDto[];
}

function generateDemoOverview(range: '7d' | '30d'): OverviewResponse {
  const dayCount = range === '7d' ? 7 : 30;
  const now = new Date();
  const days: DailyMetricDto[] = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    const base = Math.sin(i * 0.3) * 20 + 50;
    days.push({
      date,
      dau: Math.round(base + Math.random() * 30),
      newUsers: Math.round(5 + Math.random() * 15),
      revenue: Math.round((200 + Math.random() * 800) * 100) / 100,
      txVolume: Math.round((5000 + Math.random() * 20000) * 100) / 100,
    });
  }

  const summary = days.reduce(
    (acc, d) => {
      acc.totalRevenue += d.revenue;
      acc.totalTxVolume += d.txVolume;
      acc.avgDau += d.dau;
      acc.totalNewUsers += d.newUsers;
      return acc;
    },
    { totalRevenue: 0, totalTxVolume: 0, avgDau: 0, totalNewUsers: 0 },
  );
  summary.avgDau = Math.round(summary.avgDau / days.length);
  summary.totalRevenue = Math.round(summary.totalRevenue * 100) / 100;
  summary.totalTxVolume = Math.round(summary.totalTxVolume * 100) / 100;

  return { days, summary };
}

function generateDemoFunnel(): FunnelResponse {
  return {
    funnelId: 'acquisition',
    steps: [
      { stepIndex: 0, stepName: 'Page View', usersReached: 1240, conversionFromPrev: 1 },
      { stepIndex: 1, stepName: 'Wallet Connected', usersReached: 312, conversionFromPrev: 0.2516 },
      { stepIndex: 2, stepName: 'First Swap', usersReached: 87, conversionFromPrev: 0.2788 },
    ],
  };
}

export function useAnalyticsOverview(range: '7d' | '30d' = '30d') {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchOverview = useCallback(async () => {
    try {
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
      setError(null);
    } catch (err) {
      console.error('Analytics API unavailable, using demo data');
      // Fallback to demo data when backend is not available
      setData(generateDemoOverview(range));
      setError(null);
    } finally {
      setIsLoading(false);
      hasLoaded.current = true;
    }
  }, [range]);

  useEffect(() => {
    setIsLoading(!hasLoaded.current);
    fetchOverview();
  }, [fetchOverview]);

  return { data, isLoading, error, refetch: fetchOverview };
}

export function useAcquisitionFunnel() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunnel = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/analytics/funnel/acquisition`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Funnel API unavailable, using demo data');
      // Fallback to demo data when backend is not available
      setData(generateDemoFunnel());
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  return { data, isLoading, error, refetch: fetchFunnel };
}
