import { useState, useEffect, useCallback } from 'react';
import {
  Globe, TrendingUp, Newspaper, BarChart2, RefreshCw,
  ExternalLink, Clock, Zap, AlertTriangle, ChevronDown,
  ChevronUp, Database, Cpu
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DexPool {
  name: string;
  tvl?: number;
  volume24h?: number;
  apr?: number;
  token0?: string;
  token1?: string;
}

interface DexData {
  source: string;
  url: string;
  pools: DexPool[];
  totalTvl?: number;
  scrapedAt: string;
}

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  relevance: 'high' | 'medium' | 'low';
  scrapedAt?: string;
}

interface CreditUsage {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface WebIntelData {
  dex: DexData[];
  news: NewsItem[];
  credits: CreditUsage;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function WebIntelligence() {
  const [data, setData] = useState<WebIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedDex, setExpandedDex] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/web-intel`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300_000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="ml-3 text-gray-400">Loading Web Intelligence...</span>
      </div>
    );
  }

  const credits = data?.credits || { used: 0, limit: 100, remaining: 100, resetAt: '' };
  const creditPct = credits.limit > 0 ? (credits.used / credits.limit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Globe className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Web Intelligence</h2>
            <p className="text-sm text-gray-400">
              Powered by Hyperbrowser — live web scraping for DeFi data & news
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Credit Usage Bar */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Daily Credit Usage
          </span>
          <span className="text-sm font-mono text-white">
            {credits.used} / {credits.limit}
          </span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              creditPct > 80 ? 'bg-red-500' : creditPct > 50 ? 'bg-yellow-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.min(creditPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {credits.remaining} credits remaining — resets daily at midnight UTC
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DEX Data Panel */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-400" />
              Live DEX Data
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Scraped from DeFi platforms — updated every 4 hours
            </p>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {(!data?.dex || data.dex.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No DEX data available yet</p>
                <p className="text-xs mt-1">Data will appear after first scrape cycle</p>
              </div>
            ) : (
              data.dex.map((dex) => (
                <div
                  key={dex.source}
                  className="bg-gray-900/50 border border-gray-700/30 rounded-lg"
                >
                  <button
                    onClick={() => setExpandedDex(expandedDex === dex.source ? null : dex.source)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-blue-500/10 rounded">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <span className="text-white font-medium text-sm">{dex.source}</span>
                        {dex.totalTvl && (
                          <span className="ml-2 text-green-400 text-xs">
                            TVL: ${formatNumber(dex.totalTvl)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {dex.pools.length} pools
                      </span>
                      {expandedDex === dex.source ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {expandedDex === dex.source && dex.pools.length > 0 && (
                    <div className="px-3 pb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700/30">
                            <th className="text-left py-1.5">Pool</th>
                            <th className="text-right py-1.5">TVL</th>
                            <th className="text-right py-1.5">Volume 24h</th>
                            <th className="text-right py-1.5">APR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dex.pools.map((pool, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-1.5 text-white font-mono">{pool.name}</td>
                              <td className="py-1.5 text-right text-gray-300">
                                {pool.tvl ? `$${formatNumber(pool.tvl)}` : '—'}
                              </td>
                              <td className="py-1.5 text-right text-gray-300">
                                {pool.volume24h ? `$${formatNumber(pool.volume24h)}` : '—'}
                              </td>
                              <td className="py-1.5 text-right text-green-400">
                                {pool.apr ? `${pool.apr.toFixed(1)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30">
                        <span className="text-xs text-gray-500">
                          Scraped: {new Date(dex.scrapedAt).toLocaleString()}
                        </span>
                        <a
                          href={dex.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          Visit <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* News Panel */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="p-4 border-b border-gray-700/50">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-green-400" />
              DeFi News Feed
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Stacks ecosystem news — updated every 6 hours
            </p>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {(!data?.news || data.news.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No news articles yet</p>
                <p className="text-xs mt-1">Articles will appear after first scrape cycle</p>
              </div>
            ) : (
              data.news.map((article, i) => (
                <div
                  key={i}
                  className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <RelevanceBadge relevance={article.relevance} />
                        <span className="text-xs text-gray-500">{article.source}</span>
                      </div>
                      <h4 className="text-sm font-medium text-white leading-snug">
                        {article.title}
                      </h4>
                      {article.summary && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {article.summary}
                        </p>
                      )}
                    </div>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {article.scrapedAt
                      ? new Date(article.scrapedAt).toLocaleString()
                      : new Date(article.publishedAt).toLocaleString()
                    }
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Integration Info */}
      <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-300">How it works</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Web Intelligence uses Hyperbrowser.ai to scrape DeFi platforms and news sites.
          Data is cached for 30 minutes to optimize credit usage. DEX data refreshes every 4 hours,
          news every 6 hours. The Nakamoto agent uses scraped DEX data for enhanced arbitrage detection,
          while Finney includes news in daily reports.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function RelevanceBadge({ relevance }: { relevance: string }) {
  const config = {
    high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
    low: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  }[relevance] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${config.bg} ${config.text} ${config.border}`}>
      {relevance.toUpperCase()}
    </span>
  );
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toFixed(0);
}
