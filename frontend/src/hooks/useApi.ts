import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface DashboardStats {
  totalValueLocked: number;
  totalVolume24h: number;
  totalTransactions24h: number;
  activeWallets24h: number;
  topPools: any[];
  topTokens: any[];
  recentSwaps: any[];
  recentAlerts: any[];
}

export function useApi() {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const data = await response.json();
      setDashboardStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSwaps = useCallback(async (params?: {
    limit?: number;
    offset?: number;
    dex?: string;
    token?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.dex) queryParams.set('dex', params.dex);
    if (params?.token) queryParams.set('token', params.token);

    const response = await fetch(`${API_BASE_URL}/swaps?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch swaps');
    return response.json();
  }, []);

  const fetchPools = useCallback(async (limit = 10) => {
    const response = await fetch(`${API_BASE_URL}/pools?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch pools');
    return response.json();
  }, []);

  const fetchTokens = useCallback(async (limit = 10) => {
    const response = await fetch(`${API_BASE_URL}/tokens?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch tokens');
    return response.json();
  }, []);

  const fetchAlerts = useCallback(async (limit = 20) => {
    const response = await fetch(`${API_BASE_URL}/alerts?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  }, []);

  const fetchHealth = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error('API is unhealthy');
    return response.json();
  }, []);

  useEffect(() => {
    fetchDashboard();
    
    // Refresh dashboard every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return {
    dashboardStats,
    isLoading,
    error,
    fetchDashboard,
    fetchSwaps,
    fetchPools,
    fetchTokens,
    fetchAlerts,
    fetchHealth,
  };
}

