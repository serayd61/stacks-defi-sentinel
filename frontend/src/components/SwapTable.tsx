import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

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
}

export function SwapTable({ swaps, isLive = false }: SwapTableProps) {
  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string | number, decimals = 6) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(decimals > 4 ? 4 : decimals);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="bg-stacks-bg-card rounded-2xl border border-stacks-border overflow-hidden">
      <div className="p-4 border-b border-stacks-border flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-stacks-purple" />
          Recent Swaps
        </h3>
        {isLive && (
          <span className="flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 live-indicator" />
            Live
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stacks-bg-highlight">
            <tr>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">Time</th>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">From</th>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">Swap</th>
              <th className="text-left p-4 text-stacks-text-muted font-medium text-sm">DEX</th>
              <th className="text-right p-4 text-stacks-text-muted font-medium text-sm">Value</th>
            </tr>
          </thead>
          <tbody>
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-8 text-stacks-text-muted">
                  No swaps yet. Waiting for events...
                </td>
              </tr>
            ) : (
              swaps.map((swap, index) => (
                <tr 
                  key={`${swap.txId}-${index}`} 
                  className="table-row border-t border-stacks-border animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="p-4 text-sm text-stacks-text-muted mono">
                    {formatTime(swap.timestamp)}
                  </td>
                  <td className="p-4">
                    <span className="text-sm mono text-stacks-text-muted">
                      {formatAddress(swap.sender)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium mono">
                        {formatAmount(swap.tokenIn.amount)} {swap.tokenIn.symbol}
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-stacks-text-muted" />
                      <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium mono">
                        {formatAmount(swap.tokenOut.amount)} {swap.tokenOut.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-stacks-purple/10 text-stacks-purple rounded-lg text-sm font-medium">
                      {swap.dexName}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {swap.tokenIn.amountUsd ? (
                      <span className="text-sm font-medium mono">
                        ${formatAmount(swap.tokenIn.amountUsd, 2)}
                      </span>
                    ) : (
                      <span className="text-stacks-text-muted text-sm">-</span>
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

