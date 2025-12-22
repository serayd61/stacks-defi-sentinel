import { useState, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
const HIRO_API = 'https://api.hiro.so';

interface DashboardStats {
  totalValueLocked: number;
  totalVolume24h: number;
  totalTransactions24h: number;
  activeWallets24h: number;
  topPools: any[];
  topTokens: any[];
  recentSwaps: any[];
  recentAlerts: any[];
  recentTransactions: any[];
  stxPrice: number;
}

// Fetch STX price from CoinGecko
async function fetchStxPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd');
    const data = await response.json();
    return data.blockstack?.usd || 0.85; // fallback price
  } catch {
    return 0.85; // fallback
  }
}

// Fetch recent transactions from Hiro API
async function fetchRecentTransactions(): Promise<any[]> {
  try {
    const response = await fetch(`${HIRO_API}/extended/v1/tx?limit=20&type=contract_call,token_transfer`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Fetch mempool transactions (pending)
async function fetchMempoolTransactions(): Promise<any[]> {
  try {
    const response = await fetch(`${HIRO_API}/extended/v1/tx/mempool?limit=10`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching mempool:', error);
    return [];
  }
}

// Fetch large STX transfers (whale activity)
async function fetchLargeTransfers(): Promise<any[]> {
  try {
    const response = await fetch(`${HIRO_API}/extended/v1/tx?limit=50&type=token_transfer`);
    const data = await response.json();
    
    // Filter for large transfers (> 10,000 STX)
    const largeTransfers = (data.results || []).filter((tx: any) => {
      if (tx.tx_type === 'token_transfer' && tx.token_transfer) {
        const amount = parseInt(tx.token_transfer.amount) / 1_000_000; // Convert from micro-STX
        return amount >= 10000; // 10k+ STX
      }
      return false;
    });
    
    return largeTransfers;
  } catch (error) {
    console.error('Error fetching large transfers:', error);
    return [];
  }
}

// Fetch DEX contract calls
async function fetchDexActivity(): Promise<any[]> {
  try {
    // Known DEX contracts
    const dexContracts = [
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-v2',
      'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-swap-pool-v1-1',
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1',
    ];
    
    const response = await fetch(`${HIRO_API}/extended/v1/tx?limit=30&type=contract_call`);
    const data = await response.json();
    
    // Filter for swap-related transactions
    const swaps = (data.results || []).filter((tx: any) => {
      if (tx.tx_type === 'contract_call' && tx.contract_call) {
        const contractId = tx.contract_call.contract_id;
        const functionName = tx.contract_call.function_name?.toLowerCase() || '';
        
        // Check if it's a swap function
        return functionName.includes('swap') || 
               functionName.includes('exchange') ||
               dexContracts.some(dex => contractId.includes(dex.split('.')[0]));
      }
      return false;
    });
    
    return swaps;
  } catch (error) {
    console.error('Error fetching DEX activity:', error);
    return [];
  }
}

// Format transaction for display
function formatTransaction(tx: any, stxPrice: number): any {
  const timestamp = tx.burn_block_time || tx.receipt_time || Math.floor(Date.now() / 1000);
  
  if (tx.tx_type === 'token_transfer' && tx.token_transfer) {
    const amount = parseInt(tx.token_transfer.amount) / 1_000_000;
    return {
      txId: tx.tx_id,
      type: 'transfer',
      timestamp,
      sender: tx.sender_address,
      recipient: tx.token_transfer.recipient_address,
      amount: amount.toLocaleString(),
      amountUsd: (amount * stxPrice).toFixed(2),
      token: 'STX',
      status: tx.tx_status,
    };
  }
  
  if (tx.tx_type === 'contract_call' && tx.contract_call) {
    return {
      txId: tx.tx_id,
      type: 'contract_call',
      timestamp,
      sender: tx.sender_address,
      contract: tx.contract_call.contract_id,
      function: tx.contract_call.function_name,
      status: tx.tx_status,
    };
  }
  
  return {
    txId: tx.tx_id,
    type: tx.tx_type,
    timestamp,
    sender: tx.sender_address,
    status: tx.tx_status,
  };
}

export function useApi() {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Fetch data in parallel
      const [stxPrice, recentTxs, largeTransfers, dexActivity, mempoolTxs] = await Promise.all([
        fetchStxPrice(),
        fetchRecentTransactions(),
        fetchLargeTransfers(),
        fetchDexActivity(),
        fetchMempoolTransactions(),
      ]);
      
      // Format transactions
      const formattedTxs = recentTxs.map(tx => formatTransaction(tx, stxPrice));
      const formattedLargeTxs = largeTransfers.map(tx => formatTransaction(tx, stxPrice));
      const formattedSwaps = dexActivity.map(tx => formatTransaction(tx, stxPrice));
      
      // Calculate stats
      const uniqueWallets = new Set([
        ...recentTxs.map((tx: any) => tx.sender_address),
        ...recentTxs.filter((tx: any) => tx.token_transfer).map((tx: any) => tx.token_transfer?.recipient_address),
      ]);
      
      // Calculate 24h volume from transfers
      const volume24h = recentTxs
        .filter((tx: any) => tx.tx_type === 'token_transfer' && tx.token_transfer)
        .reduce((sum: number, tx: any) => {
          const amount = parseInt(tx.token_transfer.amount) / 1_000_000;
          return sum + (amount * stxPrice);
        }, 0);
      
      // Try to fetch from our backend too
      let backendData = null;
      try {
        const backendResponse = await fetch(`${API_URL}/api/dashboard`);
        if (backendResponse.ok) {
          backendData = await backendResponse.json();
        }
      } catch {
        console.log('Backend not available, using Hiro API data');
      }
      
      setDashboardStats({
        totalValueLocked: backendData?.totalValueLocked || 0,
        totalVolume24h: volume24h || backendData?.totalVolume24h || 0,
        totalTransactions24h: recentTxs.length + mempoolTxs.length,
        activeWallets24h: uniqueWallets.size,
        stxPrice,
        topPools: backendData?.topPools || [
          {
            contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-v2',
            name: 'Velar Finance',
            token0: { symbol: 'STX' },
            token1: { symbol: 'USDA' },
            tvlUsd: 0,
            volume24h: 0,
            apr: 0,
          },
          {
            contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-swap-pool',
            name: 'ALEX',
            token0: { symbol: 'STX' },
            token1: { symbol: 'aBTC' },
            tvlUsd: 0,
            volume24h: 0,
            apr: 0,
          },
        ],
        topTokens: backendData?.topTokens || [],
        recentSwaps: formattedSwaps,
        recentTransactions: formattedTxs,
        recentAlerts: formattedLargeTxs.map(tx => ({
          id: tx.txId,
          type: 'whale_transfer',
          message: `Large STX transfer: ${tx.amount} STX ($${tx.amountUsd})`,
          timestamp: tx.timestamp,
          txId: tx.txId,
          sender: tx.sender,
          recipient: tx.recipient,
        })),
      });
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return {
    dashboardStats,
    isLoading,
    error,
    fetchDashboard,
  };
}
