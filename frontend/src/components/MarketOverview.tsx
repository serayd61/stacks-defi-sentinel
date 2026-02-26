import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Zap,
  Globe,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';

interface MarketData {
  stxPrice: number;
  stxChange24h: number;
  stxVolume24h: number;
  stxMarketCap: number;
  btcPrice: number;
  btcChange24h: number;
  totalTvl: number;
  tvlChange24h: number;
  activeWallets24h: number;
  transactions24h: number;
  avgGasPrice: number;
  blockHeight: number;
}

interface TopToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  logo?: string;
}

// CoinGecko IDs for Stacks ecosystem tokens
const COINGECKO_IDS: Record<string, { id: string; symbol: string; name: string }> = {
  stx: { id: 'blockstack', symbol: 'STX', name: 'Stacks' },
  btc: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  sbtc: { id: 'sbtc', symbol: 'sBTC', name: 'Stacks Bitcoin' },
  alex: { id: 'alex-lab', symbol: 'ALEX', name: 'ALEX Token' },
  velar: { id: 'velar', symbol: 'VELAR', name: 'Velar' },
  usda: { id: 'arkadiko-protocol', symbol: 'USDA', name: 'Arkadiko USD' },
};

const ALL_IDS = Object.values(COINGECKO_IDS).map(t => t.id).join(',');

const MarketOverview: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData>({
    stxPrice: 0,
    stxChange24h: 0,
    stxVolume24h: 0,
    stxMarketCap: 0,
    btcPrice: 0,
    btcChange24h: 0,
    totalTvl: 0,
    tvlChange24h: 0,
    activeWallets24h: 0,
    transactions24h: 0,
    avgGasPrice: 0.001,
    blockHeight: 0,
  });

  const [topTokens, setTopTokens] = useState<TopToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // ── Fetch all market data from real APIs ────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Run all fetches in parallel
      const [priceRes, tvlRes, networkRes] = await Promise.allSettled([
        // 1) CoinGecko — all token prices
        fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
        ).then(r => r.ok ? r.json() : null),

        // 2) DeFi Llama — Stacks TVL
        fetch('https://api.llama.fi/v2/chains').then(r => r.ok ? r.json() : null),

        // 3) Hiro API — block height & network info
        fetch('https://api.hiro.so/extended/v1/info/network_block_times').then(r => r.ok ? r.json() : null),
      ]);

      // Also fetch block height separately
      const blockRes = await fetch('https://api.hiro.so/extended/v1/block?limit=1')
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

      // ── Process CoinGecko prices ──
      const prices = priceRes.status === 'fulfilled' ? priceRes.value : null;
      if (prices) {
        const stx = prices.blockstack || {};
        const btc = prices.bitcoin || {};

        setMarketData(prev => ({
          ...prev,
          stxPrice: stx.usd ?? prev.stxPrice,
          stxChange24h: stx.usd_24h_change ?? prev.stxChange24h,
          stxVolume24h: stx.usd_24h_vol ?? prev.stxVolume24h,
          stxMarketCap: stx.usd_market_cap ?? prev.stxMarketCap,
          btcPrice: btc.usd ?? prev.btcPrice,
          btcChange24h: btc.usd_24h_change ?? prev.btcChange24h,
        }));

        // Build top tokens from real data
        const tokens: TopToken[] = [];
        for (const [, info] of Object.entries(COINGECKO_IDS)) {
          const d = prices[info.id];
          if (!d || info.symbol === 'BTC') continue; // Skip BTC from token list
          tokens.push({
            symbol: info.symbol,
            name: info.name,
            price: d.usd ?? 0,
            change24h: d.usd_24h_change ?? 0,
            volume24h: d.usd_24h_vol ?? 0,
          });
        }
        // Sort by volume descending
        tokens.sort((a, b) => b.volume24h - a.volume24h);
        if (tokens.length > 0) setTopTokens(tokens);
      }

      // ── Process DeFi Llama TVL ──
      const chains = tvlRes.status === 'fulfilled' ? tvlRes.value : null;
      if (Array.isArray(chains)) {
        const stacks = chains.find((c: { name: string }) =>
          c.name.toLowerCase() === 'stacks'
        );
        if (stacks) {
          setMarketData(prev => ({
            ...prev,
            totalTvl: stacks.tvl ?? prev.totalTvl,
            tvlChange24h: stacks.change_1d ?? prev.tvlChange24h,
          }));
        }
      }

      // ── Process Hiro block height ──
      if (blockRes?.results?.[0]) {
        const latestBlock = blockRes.results[0];
        setMarketData(prev => ({
          ...prev,
          blockHeight: latestBlock.height ?? prev.blockHeight,
          transactions24h: latestBlock.txs?.length ?? prev.transactions24h,
        }));
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Initial load + 60s polling ──
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  const formatPrice = (price: number) => {
    if (price === 0) return '—';
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-7 h-7 text-purple-400" />
            Market Overview
          </h2>
          <p className="text-gray-400 mt-1">Real-time Stacks ecosystem metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STX Price */}
        <div className="bg-gradient-to-br from-purple-500/10 to-orange-500/5 rounded-2xl p-5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-purple-400">STX</span>
              </div>
              <div>
                <p className="text-sm text-gray-400">Stacks</p>
                <p className="text-2xl font-bold text-white">{formatPrice(marketData.stxPrice)}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              marketData.stxChange24h >= 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {marketData.stxChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-medium">{Math.abs(marketData.stxChange24h).toFixed(2)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Volume 24h</p>
              <p className="text-white font-medium">{marketData.stxVolume24h > 0 ? formatNumber(marketData.stxVolume24h) : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Market Cap</p>
              <p className="text-white font-medium">{marketData.stxMarketCap > 0 ? formatNumber(marketData.stxMarketCap) : '—'}</p>
            </div>
          </div>
        </div>

        {/* BTC Price */}
        <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/5 rounded-2xl p-5 border border-orange-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-orange-400">₿</span>
              </div>
              <div>
                <p className="text-sm text-gray-400">Bitcoin</p>
                <p className="text-2xl font-bold text-white">{formatPrice(marketData.btcPrice)}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              marketData.btcChange24h >= 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {marketData.btcChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-medium">{Math.abs(marketData.btcChange24h).toFixed(2)}%</span>
            </div>
          </div>
          <div className="text-sm">
            <p className="text-gray-500">STX/BTC Ratio</p>
            <p className="text-white font-medium">
              {marketData.btcPrice > 0 ? (marketData.stxPrice / marketData.btcPrice * 100000000).toFixed(0) : '—'} sats
            </p>
          </div>
        </div>

        {/* Total TVL */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 rounded-2xl p-5 border border-blue-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total TVL</p>
                <p className="text-2xl font-bold text-white">{marketData.totalTvl > 0 ? formatNumber(marketData.totalTvl) : '—'}</p>
              </div>
            </div>
            {marketData.tvlChange24h !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                marketData.tvlChange24h >= 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {marketData.tvlChange24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span className="text-sm font-medium">{Math.abs(marketData.tvlChange24h).toFixed(2)}%</span>
              </div>
            )}
          </div>
          <div className="text-sm">
            <p className="text-gray-500">Stacks chain TVL</p>
            <p className="text-white font-medium">via DeFi Llama</p>
          </div>
        </div>

        {/* Network Stats */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-5 border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Network</p>
                <p className="text-2xl font-bold text-white">
                  {marketData.blockHeight > 0 ? `#${marketData.blockHeight.toLocaleString()}` : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Block Height</p>
              <p className="text-white font-medium">Latest</p>
            </div>
            <div>
              <p className="text-gray-500">Block Time</p>
              <p className="text-white font-medium">~10 min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Tokens Table */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Top Tokens by Volume
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-white/5">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">24h Change</th>
                <th className="px-4 py-3 text-right">Volume 24h</th>
              </tr>
            </thead>
            <tbody>
              {topTokens.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading market data...
                  </td>
                </tr>
              ) : (
                topTokens.map((token, index) => (
                  <tr key={token.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{token.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{token.symbol}</p>
                          <p className="text-xs text-gray-500">{token.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-white font-medium">
                      {formatPrice(token.price)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm ${
                        token.change24h >= 0
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(token.change24h).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400">
                      {token.volume24h > 0 ? formatNumber(token.volume24h) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-400">Avg Gas</span>
          </div>
          <p className="text-xl font-bold text-white">{marketData.avgGasPrice} STX</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">TPS</span>
          </div>
          <p className="text-xl font-bold text-white">~50</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Block Time</span>
          </div>
          <p className="text-xl font-bold text-white">~10 min</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">Data Source</span>
          </div>
          <p className="text-lg font-bold text-white">CoinGecko</p>
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;
