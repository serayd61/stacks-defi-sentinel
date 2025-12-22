import { useState, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

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
      setError(null);
      const response = await fetch(`${API_URL}/api/dashboard`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDashboardStats(data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      
      // Set mock data on error for demo purposes
      setDashboardStats({
        totalValueLocked: 142_500_000,
        totalVolume24h: 8_750_000,
        totalTransactions24h: 12_450,
        activeWallets24h: 3_280,
        topPools: [
          {
            contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-stx-usda',
            name: 'Velar Finance',
            token0: { symbol: 'STX', reserve: '12500000' },
            token1: { symbol: 'USDA', reserve: '18750000' },
            tvlUsd: 37_500_000,
            volume24h: 2_150_000,
            fees24h: 6_450,
            apr: 32.5,
          },
          {
            contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-stx-usda',
            name: 'Arkadiko',
            token0: { symbol: 'STX', reserve: '8500000' },
            token1: { symbol: 'USDA', reserve: '12750000' },
            tvlUsd: 25_500_000,
            volume24h: 1_850_000,
            fees24h: 5_550,
            apr: 28.2,
          },
          {
            contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.alex-stx-wbtc',
            name: 'ALEX',
            token0: { symbol: 'STX', reserve: '15000000' },
            token1: { symbol: 'aBTC', reserve: '420' },
            tvlUsd: 42_000_000,
            volume24h: 3_200_000,
            fees24h: 9_600,
            apr: 18.7,
          },
        ],
        topTokens: [],
        recentSwaps: [
          {
            txId: '0x1234567890abcdef',
            timestamp: Math.floor(Date.now() / 1000) - 120,
            sender: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
            tokenIn: { symbol: 'STX', amount: '50000', amountUsd: 42500 },
            tokenOut: { symbol: 'USDA', amount: '42350' },
            dexName: 'Velar',
          },
          {
            txId: '0xabcdef1234567890',
            timestamp: Math.floor(Date.now() / 1000) - 360,
            sender: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
            tokenIn: { symbol: 'STX', amount: '25000', amountUsd: 21250 },
            tokenOut: { symbol: 'aBTC', amount: '0.45' },
            dexName: 'ALEX',
          },
          {
            txId: '0xfedcba0987654321',
            timestamp: Math.floor(Date.now() / 1000) - 600,
            sender: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
            tokenIn: { symbol: 'USDA', amount: '100000', amountUsd: 100000 },
            tokenOut: { symbol: 'STX', amount: '117647' },
            dexName: 'Arkadiko',
          },
        ],
        recentAlerts: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboardStats,
    isLoading,
    error,
    fetchDashboard,
  };
}
