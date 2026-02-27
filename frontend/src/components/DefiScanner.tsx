import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Shield,
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Layers,
  ChevronDown,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface PoolData {
  name: string;
  tvl: number;
  apr?: number;
  volume24h?: number;
}

interface DefiProtocol {
  name: string;
  url: string;
  tvl: number;
  tvlChange24h?: number;
  poolCount: number;
  topPools: PoolData[];
  tokens: string[];
  category: 'DEX' | 'Lending' | 'Staking' | 'Bridge' | 'Other';
  riskLevel: 'low' | 'medium' | 'high';
  scrapedAt: string;
}

interface ScanResult {
  protocols: DefiProtocol[];
  totalTvl: number;
  totalPools: number;
  scannedAt: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const DefiScanner: React.FC = () => {
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProto, setExpandedProto] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/defi-scan`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 900_000); // 15 min
    return () => clearInterval(interval);
  }, [fetchData]);

  const fmtUsd = (n: number) => {
    if (n === 0) return '—';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const getRiskBadge = (risk: string) => {
    const styles = {
      low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
      medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
      high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
    }[risk] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' };

    return (
      <span className={`${styles.bg} ${styles.text} border ${styles.border} px-2 py-0.5 rounded-md text-xs font-medium uppercase`}>
        {risk}
      </span>
    );
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'DEX': return 'text-purple-400 bg-purple-500/10';
      case 'Lending': return 'text-blue-400 bg-blue-500/10';
      case 'Staking': return 'text-green-400 bg-green-500/10';
      case 'Bridge': return 'text-orange-400 bg-orange-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl">
            <Search className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">DeFi Protocol Scanner</h2>
            <p className="text-sm text-gray-500">Crawling Stacks DeFi protocols...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
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
          <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Search className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">DeFi Protocol Scanner</h2>
            <p className="text-sm text-gray-500">
              Deep analysis via Hyperbrowser Crawl + Extract APIs
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

      {/* Summary Cards */}
      {data && data.protocols.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{fmtUsd(data.totalTvl)}</p>
            <p className="text-xs text-gray-500">Total TVL</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <Layers className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data.totalPools}</p>
            <p className="text-xs text-gray-500">Total Pools</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <Shield className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data.protocols.length}</p>
            <p className="text-xs text-gray-500">Protocols Scanned</p>
          </div>
        </div>
      )}

      {/* Protocol Comparison Table */}
      {data && data.protocols.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Protocol Comparison</h3>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-gray-500 border-b border-white/[0.04]">
            <div className="col-span-3">Protocol</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2 text-right">TVL</div>
            <div className="col-span-2 text-right">Pools</div>
            <div className="col-span-2 text-right">Risk</div>
            <div className="col-span-1"></div>
          </div>

          {/* Protocol Rows */}
          {data.protocols
            .sort((a, b) => b.tvl - a.tvl)
            .map((proto) => {
              const isExpanded = expandedProto === proto.name;
              return (
                <div key={proto.name} className="border-b border-white/[0.04] last:border-0">
                  <button
                    onClick={() => setExpandedProto(isExpanded ? null : proto.name)}
                    className="w-full grid grid-cols-12 gap-2 px-4 py-3.5 items-center hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{proto.name.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{proto.name}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className={`${getCategoryColor(proto.category)} text-xs px-2 py-0.5 rounded-md`}>
                        {proto.category}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-medium text-white">{fmtUsd(proto.tvl)}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm text-gray-300">{proto.poolCount}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      {getRiskBadge(proto.riskLevel)}
                    </div>
                    <div className="col-span-1 text-right">
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform inline ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Top Pools */}
                      {proto.topPools.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">Top Pools</h4>
                          <div className="space-y-1.5">
                            {proto.topPools.map((pool, i) => (
                              <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2">
                                <span className="text-sm text-white">{pool.name}</span>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-gray-400">TVL: {fmtUsd(pool.tvl)}</span>
                                  {pool.apr !== undefined && (
                                    <span className="text-green-400 flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" />
                                      {pool.apr.toFixed(1)}%
                                    </span>
                                  )}
                                  {pool.volume24h !== undefined && (
                                    <span className="text-gray-500">Vol: {fmtUsd(pool.volume24h)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tokens */}
                      {proto.tokens.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">Supported Tokens</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {proto.tokens.map((t, i) => (
                              <span key={i} className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Link */}
                      <a
                        href={proto.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Visit {proto.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : !error ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No protocol data available yet</p>
          <p className="text-gray-500 text-xs mt-1">DeFi scanner runs every 12 hours</p>
        </div>
      ) : null}

      {/* Info Footer */}
      <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-purple-500/10 rounded-lg">
            <Search className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white mb-1">How DeFi Scanner Works</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Uses Hyperbrowser's <strong className="text-purple-400">Crawl API</strong> to navigate through multiple pages
              of each DeFi protocol, then applies the <strong className="text-purple-400">Extract API</strong> with JSON schemas
              to pull structured TVL, pool, and token data. Risk levels are auto-calculated based on TVL thresholds.
              Scans every 12 hours using ~12 credits/day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefiScanner;
