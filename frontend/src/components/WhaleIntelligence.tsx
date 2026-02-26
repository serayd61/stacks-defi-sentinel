import React, { useState, useEffect, useCallback } from 'react';
import {
  Fish,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft,
  Coins,
  Clock,
  Shield,
  TrendingUp,
  Activity,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface WhaleToken {
  symbol: string;
  balance: number;
  valueUsd?: number;
}

interface WhaleActivity {
  type: 'transfer' | 'swap' | 'stake' | 'contract-call';
  description: string;
  amount?: number;
  timestamp: string;
}

interface WhaleWallet {
  address: string;
  label?: string;
  stxBalance: number;
  topTokens: WhaleToken[];
  recentActivity: WhaleActivity[];
  totalValueUsd?: number;
  lastSeen: string;
}

interface WhaleAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  wallet: string;
  timestamp: string;
}

interface WhaleIntelData {
  whales: WhaleWallet[];
  alerts: WhaleAlert[];
  scannedAt: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const WhaleIntelligence: React.FC = () => {
  const [data, setData] = useState<WhaleIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/whale-intel`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch whale data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600_000); // 10 min
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  const formatSTX = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };
  const formatUsd = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'transfer': return <ArrowRightLeft className="w-3.5 h-3.5" />;
      case 'swap': return <TrendingUp className="w-3.5 h-3.5" />;
      case 'stake': return <Shield className="w-3.5 h-3.5" />;
      default: return <Activity className="w-3.5 h-3.5" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' };
      case 'warning': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' };
      default: return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-xl">
            <Fish className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Whale Intelligence</h2>
            <p className="text-sm text-gray-500">Scanning whale wallets...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <Fish className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Whale Intelligence</h2>
            <p className="text-sm text-gray-500">
              Powered by Hyperbrowser Extract API — AI-structured wallet analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data?.scannedAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(data.scannedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Active Alerts</h3>
          {data.alerts.map((alert, i) => {
            const s = getSeverityStyles(alert.severity);
            return (
              <div key={i} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <div className={`w-2 h-2 rounded-full ${s.dot} ${alert.severity === 'critical' ? 'animate-pulse' : ''}`} />
                <span className={`text-sm ${s.text} flex-1`}>{alert.message}</span>
                <a
                  href={`https://explorer.hiro.so/address/${alert.wallet}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Whale Cards */}
      {data?.whales && data.whales.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Monitored Wallets ({data.whales.length})
          </h3>
          {data.whales.map((whale) => {
            const isExpanded = expandedWallet === whale.address;
            return (
              <div
                key={whale.address}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-cyan-500/20 transition-colors"
              >
                {/* Wallet Header */}
                <button
                  onClick={() => setExpandedWallet(isExpanded ? null : whale.address)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Fish className="w-5 h-5 text-cyan-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{whale.label || 'Unknown'}</span>
                      <span className="text-xs text-gray-500 font-mono">{formatAddress(whale.address)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-cyan-400 font-medium">
                        <Coins className="w-3.5 h-3.5 inline mr-1" />
                        {formatSTX(whale.stxBalance)} STX
                      </span>
                      {whale.totalValueUsd && (
                        <span className="text-xs text-gray-500">
                          ≈ {formatUsd(whale.totalValueUsd)}
                        </span>
                      )}
                      {whale.topTokens.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {whale.topTokens.length} tokens
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-4 pb-4">
                    {/* Token Holdings */}
                    {whale.topTokens.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">Token Holdings</h4>
                        <div className="flex flex-wrap gap-2">
                          {whale.topTokens.map((token, i) => (
                            <span
                              key={i}
                              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs"
                            >
                              <span className="text-white font-medium">{token.symbol}</span>
                              <span className="text-gray-400 ml-1.5">{formatSTX(token.balance)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Activity */}
                    {whale.recentActivity.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">Recent Activity</h4>
                        <div className="space-y-1.5">
                          {whale.recentActivity.slice(0, 5).map((act, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{getActivityIcon(act.type)}</span>
                              <span className="text-gray-300 flex-1 truncate">{act.description}</span>
                              {act.amount && (
                                <span className="text-cyan-400 font-mono">{formatSTX(act.amount)} STX</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Explorer Link */}
                    <a
                      href={`https://explorer.hiro.so/address/${whale.address}?chain=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      View on Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !error ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Fish className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No whale data available yet</p>
          <p className="text-gray-500 text-xs mt-1">Whale scanner runs every 6 hours</p>
        </div>
      ) : null}

      {/* Info Footer */}
      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg">
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white mb-1">How Whale Intelligence Works</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Uses Hyperbrowser's <strong className="text-cyan-400">Extract API</strong> to analyze whale wallet pages
              on Hiro Explorer with AI. Structured data (balances, tokens, transactions) is extracted using
              JSON schemas — not just raw scraping. Scans top wallets every 6 hours using ~8 credits/day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhaleIntelligence;
