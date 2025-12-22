import React from 'react';
import { ArrowRightLeft, ExternalLink, Clock, ArrowUpRight, FileCode } from 'lucide-react';

interface Transaction {
  txId: string;
  type: string;
  timestamp: number;
  sender: string;
  recipient?: string;
  amount?: string;
  amountUsd?: string;
  token?: string;
  contract?: string;
  function?: string;
  status?: string;
  // Legacy swap format
  tokenIn?: {
    symbol: string;
    amount: string;
    amountUsd?: number;
  };
  tokenOut?: {
    symbol: string;
    amount: string;
  };
  dexName?: string;
}

interface SwapTableProps {
  swaps: Transaction[];
  isLive?: boolean;
  showAll?: boolean;
}

export function SwapTable({ swaps, isLive = false, showAll = false }: SwapTableProps) {
  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string | number, decimals = 2) => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transfer':
        return <ArrowUpRight className="w-4 h-4" />;
      case 'contract_call':
        return <FileCode className="w-4 h-4" />;
      default:
        return <ArrowRightLeft className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transfer':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'contract_call':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
      case 'abort_by_response':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const openExplorer = (txId: string) => {
    window.open(`https://explorer.hiro.so/txid/${txId}?chain=mainnet`, '_blank');
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          Recent Activity
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
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Type</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">From</th>
              <th className="text-left p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Details</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">Value</th>
              <th className="text-right p-4 text-gray-500 font-medium text-xs uppercase tracking-wider">TX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <ArrowRightLeft className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500">No transactions yet</p>
                    <p className="text-xs text-gray-600">Loading from blockchain...</p>
                  </div>
                </td>
              </tr>
            ) : (
              swaps.map((tx, index) => (
                <tr 
                  key={`${tx.txId}-${index}`} 
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  onClick={() => openExplorer(tx.txId)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{formatTime(tx.timestamp)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${getTypeColor(tx.type)}`}>
                      {getTypeIcon(tx.type)}
                      {tx.type === 'transfer' ? 'Transfer' : tx.type === 'contract_call' ? 'Contract' : tx.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center text-xs font-bold text-white">
                        {tx.sender?.slice(0, 2) || '??'}
                      </div>
                      <span className="text-sm font-mono text-gray-400 group-hover:text-white transition-colors">
                        {formatAddress(tx.sender)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    {tx.type === 'transfer' && tx.amount ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium font-mono border border-green-500/10">
                          {formatAmount(tx.amount)} {tx.token || 'STX'}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-500 font-mono">
                          {tx.recipient ? formatAddress(tx.recipient) : ''}
                        </span>
                      </div>
                    ) : tx.type === 'contract_call' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-gray-300 font-mono">
                          {tx.function || 'contract call'}
                        </span>
                        <span className="text-xs text-gray-600 font-mono truncate max-w-[200px]">
                          {tx.contract ? formatAddress(tx.contract) : ''}
                        </span>
                      </div>
                    ) : tx.tokenIn && tx.tokenOut ? (
                      // Legacy swap format
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium font-mono border border-red-500/10">
                          -{formatAmount(tx.tokenIn.amount)} {tx.tokenIn.symbol}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-gray-600" />
                        <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium font-mono border border-emerald-500/10">
                          +{formatAmount(tx.tokenOut.amount)} {tx.tokenOut.symbol}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {tx.amountUsd ? (
                      <span className="text-sm font-medium font-mono text-white">
                        ${formatAmount(tx.amountUsd)}
                      </span>
                    ) : tx.tokenIn?.amountUsd ? (
                      <span className="text-sm font-medium font-mono text-white">
                        ${formatAmount(tx.tokenIn.amountUsd)}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs ${getStatusColor(tx.status || 'success')}`}>
                        {tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'}
                      </span>
                      <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                    </div>
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
