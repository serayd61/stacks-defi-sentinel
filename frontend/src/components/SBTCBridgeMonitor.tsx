import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownLeft, Activity, Shield, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';

interface SBTCStats {
  totalSupply: string;
  totalSupplyBTC: number;
  totalDeposits24h: string;
  totalWithdrawals24h: string;
  depositsCount24h: number;
  withdrawalsCount24h: number;
  pegRatio: number;
  bridgeHealth: 'healthy' | 'degraded' | 'critical';
  lastUpdate: number;
}

interface SBTCEvent {
  type: 'deposit' | 'withdrawal' | 'transfer';
  txId: string;
  blockHeight: number;
  timestamp: number;
  amount: string;
  amountBTC: number;
  sender?: string;
  recipient?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

interface PegStatus {
  btcPrice: number;
  sbtcPrice: number;
  pegRatio: number;
  deviation: number;
  status: 'pegged' | 'slight_deviation' | 'major_deviation';
}

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

export const SBTCBridgeMonitor: React.FC = () => {
  const [stats, setStats] = useState<SBTCStats | null>(null);
  const [events, setEvents] = useState<SBTCEvent[]>([]);
  const [pegStatus, setPegStatus] = useState<PegStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch sBTC stats from our API
      const [statsRes, pegRes] = await Promise.all([
        fetch(`${API_URL}/api/sbtc/stats`).catch(() => null),
        fetch(`${API_URL}/api/sbtc/peg`).catch(() => null),
      ]);

      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (pegRes?.ok) {
        const pegData = await pegRes.json();
        setPegStatus(pegData);
      }

      // Fetch recent events from Hiro API
      const eventsRes = await fetch(
        'https://api.hiro.so/extended/v1/address/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token/transactions?limit=20'
      );
      
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const parsedEvents: SBTCEvent[] = (eventsData.results || [])
          .filter((tx: any) => tx.tx_type === 'contract_call')
          .map((tx: any) => {
            const functionName = tx.contract_call?.function_name || '';
            let eventType: 'deposit' | 'withdrawal' | 'transfer' = 'transfer';
            if (functionName.includes('deposit') || functionName.includes('mint')) {
              eventType = 'deposit';
            } else if (functionName.includes('withdraw') || functionName.includes('burn')) {
              eventType = 'withdrawal';
            }

            const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
            const amount = amountArg?.repr?.replace('u', '') || '0';
            const amountNum = parseInt(amount) || 0;

            return {
              type: eventType,
              txId: tx.tx_id,
              blockHeight: tx.block_height,
              timestamp: new Date(tx.burn_block_time_iso).getTime(),
              amount,
              amountBTC: amountNum / 100_000_000,
              sender: tx.sender_address,
              status: tx.tx_status === 'success' ? 'confirmed' : 'pending',
            };
          });
        setEvents(parsedEvents);
      }
    } catch (error) {
      console.error('Error fetching sBTC data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatBTC = (amount: number) => {
    if (amount >= 1) return `${amount.toFixed(4)} BTC`;
    return `${(amount * 100_000_000).toFixed(0)} sats`;
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getHealthBg = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-500/20 border-green-500/30';
      case 'degraded': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'critical': return 'bg-red-500/20 border-red-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-orange-900/20 to-yellow-900/10 rounded-2xl p-6 border border-orange-500/20">
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-2xl">
            ₿
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">sBTC Bridge Monitor</h2>
            <p className="text-gray-400 text-sm">Real-time Bitcoin ↔ Stacks bridge tracking</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bridge Health & Peg Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bridge Health */}
        <div className={`rounded-xl p-4 border ${getHealthBg(stats?.bridgeHealth || 'healthy')}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className={`w-5 h-5 ${getHealthColor(stats?.bridgeHealth || 'healthy')}`} />
            <span className="text-sm text-gray-400">Bridge Health</span>
          </div>
          <div className={`text-2xl font-bold capitalize ${getHealthColor(stats?.bridgeHealth || 'healthy')}`}>
            {stats?.bridgeHealth || 'Healthy'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {stats?.bridgeHealth === 'healthy' 
              ? 'All systems operational' 
              : stats?.bridgeHealth === 'degraded'
                ? 'Minor peg deviation detected'
                : 'Major issues detected'}
          </p>
        </div>

        {/* Peg Ratio */}
        <div className="rounded-xl p-4 border bg-blue-500/10 border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">BTC/sBTC Peg</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {(pegStatus?.pegRatio || 1).toFixed(4)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pegStatus?.deviation !== undefined 
              ? `${pegStatus.deviation.toFixed(2)}% deviation from 1:1`
              : 'Checking peg status...'}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/30 rounded-xl p-4 border border-orange-500/20">
          <div className="text-sm text-gray-400 mb-1">Total Supply</div>
          <div className="text-xl font-bold text-orange-400">
            {stats?.totalSupplyBTC?.toFixed(2) || '0'} BTC
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-green-500/20">
          <div className="text-sm text-gray-400 mb-1">Deposits (24h)</div>
          <div className="text-xl font-bold text-green-400 flex items-center gap-1">
            <ArrowDownLeft className="w-4 h-4" />
            {stats?.depositsCount24h || 0}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-red-500/20">
          <div className="text-sm text-gray-400 mb-1">Withdrawals (24h)</div>
          <div className="text-xl font-bold text-red-400 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            {stats?.withdrawalsCount24h || 0}
          </div>
        </div>

        <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20">
          <div className="text-sm text-gray-400 mb-1">BTC Price</div>
          <div className="text-xl font-bold text-purple-400">
            ${pegStatus?.btcPrice?.toLocaleString() || '0'}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-black/30 rounded-xl border border-orange-500/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-orange-500/20 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-white">Recent sBTC Transactions</h3>
        </div>
        
        <div className="divide-y divide-orange-500/10">
          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No recent transactions found
            </div>
          ) : (
            events.slice(0, 10).map((event) => (
              <div key={event.txId} className="px-4 py-3 hover:bg-orange-500/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      event.type === 'deposit' 
                        ? 'bg-green-500/20 text-green-400' 
                        : event.type === 'withdrawal'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {event.type === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : event.type === 'withdrawal' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white capitalize">
                        {event.type}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatAddress(event.sender || '')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-mono text-orange-400">
                      {formatBTC(event.amountBTC)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Block #{event.blockHeight}
                    </div>
                  </div>

                  <a
                    href={`https://explorer.stacks.co/txid/${event.txId}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-orange-500/20 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-500 hover:text-orange-400" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Official Bridge Link */}
      <a
        href="https://sbtc.stacks.co/"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-4 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl border border-orange-500/30 hover:border-orange-500/50 transition-colors text-center"
      >
        <span className="text-orange-400 font-semibold">🌉 Use Official sBTC Bridge →</span>
      </a>
    </div>
  );
};

export default SBTCBridgeMonitor;

