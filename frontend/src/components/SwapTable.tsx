import React from 'react';
import { ArrowRightLeft, ExternalLink, Clock } from 'lucide-react';

interface Swap {
  txId: string;
  timestamp: number;
  sender: string;
  tokenIn: {
    symbol: string;
    amount: string;
    amountUsd?: number;
  };
  tokenOut: {
    symbol: string;
    amount: string;
  };
  dexName: string;
}

interface SwapTableProps {
  swaps: Swap[];
  isLive?: boolean;
  showAll?: boolean;
}

export function SwapTable({ swaps, isLive = false, showAll = false }: SwapTableProps) {
  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatAmount = (amount: string | number, decimals = 6) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(decimals > 4 ? 4 : decimals);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getDexColor = (dex: string) => {
    const colors: Record<string, string> = {
      'Velar': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'Arkadiko': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'ALEX': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'default': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
    return colors[dex] || colors.default;
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          Recent Swaps
        </h3>
        {isLive && (
          <span className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </span>
        )}
      </div>
      
      <div className={`overflow-x-auto ${showAll ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
        <table className="w-full">
          <thead className="bg-white/[0.02] sticky top-0">
            <tr>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Time</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">From</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Swap</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">DEX</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <ArrowRightLeft className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500">No swaps yet</p>
                    <p className="text-xs text-gray-600">Waiting for transactions...</p>
                  </div>
                </td>
              </tr>
            ) : (
              swaps.map((swap, index) => (
                <tr 
                  key={`${swap.txId}-${index}`} 
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{formatTime(swap.timestamp)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-white">
                        {swap.sender?.slice(0, 2) || '??'}
                      </div>
                      <span className="text-sm font-mono text-gray-400 group-hover:text-white transition-colors">
                        {formatAddress(swap.sender)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium font-mono border border-red-500/10">
                        -{formatAmount(swap.tokenIn.amount)} {swap.tokenIn.symbol}
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-gray-600" />
                      <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium font-mono border border-emerald-500/10">
                        +{formatAmount(swap.tokenOut.amount)} {swap.tokenOut.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getDexColor(swap.dexName)}`}>
                      {swap.dexName}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {swap.tokenIn.amountUsd ? (
                      <span className="text-sm font-medium font-mono text-white">
                        ${formatAmount(swap.tokenIn.amountUsd, 2)}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
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
