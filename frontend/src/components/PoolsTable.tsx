import React, { useEffect, useState } from 'react';
import { Droplets, TrendingUp } from 'lucide-react';

interface Pool {
  contract: string;
  name: string;
  token0: { symbol: string; reserve: string };
  token1: { symbol: string; reserve: string };
  tvlUsd: number;
  volume24h: number;
  fees24h: number;
  apr: number;
}

interface PoolsTableProps {
  pools: Pool[];
}

// symbol → image URL cache from Token Metadata API
type TokenImageMap = Record<string, string>;

const FALLBACK_COLORS = [
  'from-purple-500 to-purple-600',
  'from-orange-500 to-orange-600',
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-pink-500 to-pink-600',
];

function TokenAvatar({ symbol, imageUrl, colorIndex }: { symbol: string; imageUrl?: string; colorIndex: number }) {
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={symbol}
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-xl object-cover ring-2 ring-[#0a0a0f]"
      />
    );
  }

  return (
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length]} flex items-center justify-center text-xs font-bold text-white shadow-lg ring-2 ring-[#0a0a0f]`}>
      {symbol.charAt(0)}
    </div>
  );
}

export function PoolsTable({ pools }: PoolsTableProps) {
  const [tokenImages, setTokenImages] = useState<TokenImageMap>({});

  // Fetch token metadata from Hiro Token Metadata API
  useEffect(() => {
    const fetchTokenMetadata = async () => {
      try {
        const res = await fetch('https://api.hiro.so/metadata/v1/ft?limit=200');
        if (!res.ok) return;
        const data = await res.json();
        const map: TokenImageMap = {};
        for (const token of data.results || []) {
          const sym: string = (token.symbol || '').toUpperCase();
          const img: string = token.image_thumbnail_uri || token.image_uri || '';
          if (sym && img) map[sym] = img;
        }
        setTokenImages(map);
      } catch (e) {
        console.error('Token metadata fetch error:', e);
      }
    };
    fetchTokenMetadata();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000)     return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Droplets className="w-5 h-5" />
          </div>
          Top Liquidity Pools
        </h3>
        {Object.keys(tokenImages).length > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            HIRO METADATA API
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">#</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Pool</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">TVL</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Volume 24h</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Fees 24h</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">APR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pools.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <Droplets className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500">No pool data available</p>
                    <p className="text-xs text-gray-600">Pool statistics will appear here</p>
                  </div>
                </td>
              </tr>
            ) : (
              pools.map((pool, index) => {
                const sym0 = pool.token0.symbol.toUpperCase();
                const sym1 = pool.token1.symbol.toUpperCase();
                return (
                  <tr key={pool.contract} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <span className="text-gray-500 font-medium">{index + 1}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <TokenAvatar symbol={sym0} imageUrl={tokenImages[sym0]} colorIndex={index} />
                          <TokenAvatar symbol={sym1} imageUrl={tokenImages[sym1]} colorIndex={index + 1} />
                        </div>
                        <div>
                          <span className="font-medium text-white group-hover:text-purple-300 transition-colors">
                            {pool.token0.symbol}/{pool.token1.symbol}
                          </span>
                          <p className="text-xs text-gray-500">{pool.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono font-medium text-white">{formatNumber(pool.tvlUsd)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-gray-400">{formatNumber(pool.volume24h)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-emerald-400">{formatNumber(pool.fees24h)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg font-medium border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3" />
                        {pool.apr.toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
