import React from 'react';
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

export function PoolsTable({ pools }: PoolsTableProps) {
  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="bg-stacks-bg-card rounded-2xl border border-stacks-border overflow-hidden">
      <div className="p-4 border-b border-stacks-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-400" />
          Top Liquidity Pools
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stacks-bg-highlight">
            <tr>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">#</th>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">Pool</th>
              <th className="text-right p-4 text-stacks-text-muted font-medium text-sm">TVL</th>
              <th className="text-right p-4 text-stacks-text-muted font-medium text-sm">Volume 24h</th>
              <th className="text-right p-4 text-stacks-text-muted font-medium text-sm">Fees 24h</th>
              <th className="text-right p-4 text-stacks-text-muted font-medium text-sm">APR</th>
            </tr>
          </thead>
          <tbody>
            {pools.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-stacks-text-muted">
                  No pool data available
                </td>
              </tr>
            ) : (
              pools.map((pool, index) => (
                <tr 
                  key={pool.contract} 
                  className="table-row border-t border-stacks-border"
                >
                  <td className="p-4 text-stacks-text-muted">{index + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-stacks-purple flex items-center justify-center text-xs font-bold">
                          {pool.token0.symbol.charAt(0)}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-stacks-orange flex items-center justify-center text-xs font-bold">
                          {pool.token1.symbol.charAt(0)}
                        </div>
                      </div>
                      <span className="font-medium">
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right mono font-medium">
                    {formatNumber(pool.tvlUsd)}
                  </td>
                  <td className="p-4 text-right mono text-stacks-text-muted">
                    {formatNumber(pool.volume24h)}
                  </td>
                  <td className="p-4 text-right mono text-green-400">
                    {formatNumber(pool.fees24h)}
                  </td>
                  <td className="p-4 text-right">
                    <span className="flex items-center justify-end gap-1 text-green-400 font-medium">
                      <TrendingUp className="w-4 h-4" />
                      {pool.apr.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

