import React, { useState, useEffect, useRef } from 'react';
import { Code, Activity, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink, Zap, TrendingUp, Filter, Search } from 'lucide-react';

interface ContractCall {
  txId: string;
  contractId: string;
  contractName: string;
  functionName: string;
  sender: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: number;
  fee: number;
  args?: string[];
}

const ContractActivityMonitor: React.FC = () => {
  const [calls, setCalls] = useState<ContractCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'defi' | 'nft' | 'token'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total24h: 0,
    successRate: 0,
    avgFee: 0,
    topContracts: [] as { name: string; calls: number }[],
  });
  const listRef = useRef<HTMLDivElement>(null);

  // Known contract categories
  const contractCategories: Record<string, string> = {
    'velar': 'defi',
    'alex': 'defi',
    'arkadiko': 'defi',
    'stackswap': 'defi',
    'stx-city': 'defi',
    'gamma': 'nft',
    'megapont': 'nft',
    'satoshibles': 'nft',
    'sip-010': 'token',
    'token': 'token',
  };

  const getCategory = (contractId: string): string => {
    const lower = contractId.toLowerCase();
    for (const [key, cat] of Object.entries(contractCategories)) {
      if (lower.includes(key)) return cat;
    }
    return 'other';
  };

  const fetchContractCalls = async () => {
    try {
      const response = await fetch('https://api.hiro.so/extended/v1/tx?limit=50&type=contract_call');
      const data = await response.json();

      const formattedCalls: ContractCall[] = (data.results || []).map((tx: any) => ({
        txId: tx.tx_id,
        contractId: tx.contract_call?.contract_id || '',
        contractName: tx.contract_call?.contract_id?.split('.')[1] || 'Unknown',
        functionName: tx.contract_call?.function_name || 'unknown',
        sender: tx.sender_address,
        status: tx.tx_status === 'success' ? 'success' : tx.tx_status === 'pending' ? 'pending' : 'failed',
        timestamp: tx.burn_block_time || tx.receipt_time || Math.floor(Date.now() / 1000),
        fee: tx.fee_rate ? parseInt(tx.fee_rate) / 1e6 : 0,
        args: tx.contract_call?.function_args?.map((a: any) => a.repr) || [],
      }));

      setCalls(formattedCalls);

      // Calculate stats
      const successCount = formattedCalls.filter(c => c.status === 'success').length;
      const totalFees = formattedCalls.reduce((sum, c) => sum + c.fee, 0);
      
      // Count calls per contract
      const contractCounts: Record<string, number> = {};
      formattedCalls.forEach(c => {
        const name = c.contractName;
        contractCounts[name] = (contractCounts[name] || 0) + 1;
      });

      const topContracts = Object.entries(contractCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, calls]) => ({ name, calls }));

      setStats({
        total24h: formattedCalls.length,
        successRate: formattedCalls.length > 0 ? (successCount / formattedCalls.length) * 100 : 0,
        avgFee: formattedCalls.length > 0 ? totalFees / formattedCalls.length : 0,
        topContracts,
      });
    } catch (error) {
      console.error('Error fetching contract calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractCalls();
    const interval = setInterval(fetchContractCalls, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredCalls = calls.filter(call => {
    if (filter !== 'all' && getCategory(call.contractId) !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        call.contractName.toLowerCase().includes(query) ||
        call.functionName.toLowerCase().includes(query) ||
        call.sender.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryColor = (contractId: string) => {
    const cat = getCategory(contractId);
    switch (cat) {
      case 'defi': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'nft': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case 'token': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
              <Code className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Smart Contract Activity</h3>
              <p className="text-xs text-gray-500">Real-time contract calls on Stacks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-white">{stats.total24h}</div>
            <div className="text-xs text-gray-500">Calls</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-green-400">{stats.successRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Success</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-white">{stats.avgFee.toFixed(4)}</div>
            <div className="text-xs text-gray-500">Avg Fee</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-purple-400">{stats.topContracts[0]?.name.slice(0, 8) || '-'}</div>
            <div className="text-xs text-gray-500">Top Contract</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search contracts, functions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'defi', 'nft', 'token'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                }`}
              >
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contract Calls List */}
      <div ref={listRef} className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
        {filteredCalls.map((call, idx) => (
          <a
            key={`${call.txId}-${idx}`}
            href={`https://explorer.hiro.so/txid/${call.txId}?chain=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group"
          >
            {/* Status */}
            <div className="flex-shrink-0">
              {getStatusIcon(call.status)}
            </div>

            {/* Contract Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-white group-hover:text-purple-400 transition-colors truncate">
                  {call.contractName}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getCategoryColor(call.contractId)}`}>
                  {getCategory(call.contractId).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Code className="w-3 h-3" />
                <span className="font-mono text-purple-400">{call.functionName}()</span>
                <span className="text-gray-600">•</span>
                <span className="truncate">{call.sender.slice(0, 8)}...{call.sender.slice(-4)}</span>
              </div>
            </div>

            {/* Time & Fee */}
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-gray-400">{formatTime(call.timestamp)}</div>
              <div className="text-xs text-gray-500 font-mono">{call.fee.toFixed(4)} STX</div>
            </div>

            <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0" />
          </a>
        ))}

        {filteredCalls.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No contract calls found</p>
          </div>
        )}
      </div>

      {/* Top Contracts */}
      <div className="p-4 bg-gradient-to-r from-green-500/5 to-blue-500/5 border-t border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400">Most Active Contracts</span>
          <Activity className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.topContracts.map((contract, idx) => (
            <div
              key={contract.name}
              className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg"
            >
              <span className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center ${
                idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                'bg-white/10 text-gray-400'
              }`}>
                {idx + 1}
              </span>
              <span className="text-xs text-gray-300 font-mono">{contract.name.slice(0, 12)}</span>
              <span className="text-xs text-gray-500">({contract.calls})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContractActivityMonitor;
