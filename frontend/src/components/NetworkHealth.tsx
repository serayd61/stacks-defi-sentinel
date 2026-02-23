import React, { useState, useEffect } from 'react';
import { Activity, Clock, Cpu, Database, Layers, Server, Wifi, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

interface NetworkStats {
  currentBlock: number;
  avgBlockTime: number;
  mempoolSize: number;
  mempoolFees: number;
  tps: number;
  difficulty: string;
  hashRate: string;
  peerCount: number;
  chainTip: string;
  burnBlockHeight: number;
  stxSupply: number;
  networkHealth: 'healthy' | 'degraded' | 'issues';
}

interface SignerMetrics {
  totalSigners: number;
  activeSigners: number;
  participationRate: number;
  avgAcceptanceRate: number;
  avgLatencyMs: number;
}

const NetworkHealth: React.FC = () => {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [signerMetrics, setSignerMetrics] = useState<SignerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentBlocks, setRecentBlocks] = useState<any[]>([]);

  const fetchSignerMetrics = async () => {
    try {
      // Get current PoX cycle first
      const cycleRes = await fetch('https://api.hiro.so/extended/v2/pox/cycles?limit=1');
      if (!cycleRes.ok) return;
      const cycleData = await cycleRes.json();
      const currentCycle = cycleData.results?.[0]?.cycle_number;
      if (!currentCycle) return;

      const signersRes = await fetch(
        `https://api.hiro.so/signer-metrics/v1/signers/${currentCycle}?limit=100`
      );
      if (!signersRes.ok) return;
      const signersData = await signersRes.json();
      const signers: any[] = signersData.results || [];
      if (signers.length === 0) return;

      const total = signers.length;
      const active = signers.filter((s: any) => (s.proposals_accepted_count || 0) > 0).length;
      const participationRate = total > 0 ? (active / total) * 100 : 0;
      const avgAcceptance = signers.reduce((sum: number, s: any) => {
        const accepted = s.proposals_accepted_count || 0;
        const total_p = (s.proposals_accepted_count || 0) + (s.proposals_rejected_count || 0) + (s.proposals_missed_count || 0);
        return sum + (total_p > 0 ? (accepted / total_p) * 100 : 0);
      }, 0) / total;

      setSignerMetrics({
        totalSigners: total,
        activeSigners: active,
        participationRate: parseFloat(participationRate.toFixed(1)),
        avgAcceptanceRate: parseFloat(avgAcceptance.toFixed(1)),
        avgLatencyMs: 0,
      });
    } catch (e) {
      console.error('Signer metrics error:', e);
    }
  };

  const fetchNetworkStats = async () => {
    try {
      // Fetch multiple endpoints in parallel
      const [infoRes, blocksRes, mempoolRes, supplyRes] = await Promise.all([
        fetch('https://api.hiro.so/v2/info'),
        fetch('https://api.hiro.so/extended/v2/blocks?limit=10'),
        fetch('https://api.hiro.so/extended/v1/tx/mempool/stats'),
        fetch('https://api.hiro.so/extended/v1/stx_supply'),
      ]);

      const [info, blocks, mempool, supply] = await Promise.all([
        infoRes.json(),
        blocksRes.json(),
        mempoolRes.json(),
        supplyRes.json(),
      ]);

      // Calculate average block time from recent blocks
      const blockTimes = blocks.results?.slice(0, 5).map((b: any, i: number, arr: any[]) => {
        if (i === 0) return 0;
        return b.burn_block_time - arr[i - 1]?.burn_block_time || 0;
      }).filter((t: number) => t > 0) || [];
      
      const avgBlockTime = blockTimes.length > 0 
        ? blockTimes.reduce((a: number, b: number) => a + b, 0) / blockTimes.length 
        : 600;

      // Calculate TPS from recent transactions
      const recentTxCount = blocks.results?.slice(0, 3).reduce((sum: number, b: any) => sum + (b.txs?.length || 0), 0) || 0;
      const tps = recentTxCount / (avgBlockTime * 3) || 0;

      // Determine network health
      let networkHealth: 'healthy' | 'degraded' | 'issues' = 'healthy';
      if (avgBlockTime > 900) networkHealth = 'degraded';
      if (avgBlockTime > 1200 || mempool.tx_count > 5000) networkHealth = 'issues';

      setStats({
        currentBlock: info.stacks_tip_height || 0,
        avgBlockTime: Math.round(avgBlockTime),
        mempoolSize: mempool.tx_count || 0,
        mempoolFees: mempool.tx_total_fees ? parseInt(mempool.tx_total_fees) / 1e6 : 0,
        tps: parseFloat(tps.toFixed(2)),
        difficulty: 'N/A',
        hashRate: 'N/A',
        peerCount: info.peer_count || 0,
        chainTip: info.stacks_tip || '',
        burnBlockHeight: info.burn_block_height || 0,
        stxSupply: supply.total_stx ? parseFloat(supply.total_stx) / 1e6 : 0,
        networkHealth,
      });

      setRecentBlocks(blocks.results?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching network stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkStats();
    fetchSignerMetrics();
    const interval = setInterval(() => {
      fetchNetworkStats();
      fetchSignerMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const healthColors = {
    healthy: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
    degraded: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-500' },
    issues: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const health = healthColors[stats.networkHealth];

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Stacks Network</h3>
            <p className="text-xs text-gray-500">Real-time network statistics</p>
          </div>
        </div>
        
        {/* Health Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${health.bg} ${health.border} border`}>
          <span className={`w-2 h-2 rounded-full ${health.dot} animate-pulse`} />
          <span className={`text-sm font-medium ${health.text} capitalize`}>
            {stats.networkHealth}
          </span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Block Height */}
        <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl p-3 border border-purple-500/20">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Layers className="w-3.5 h-3.5" />
            Block Height
          </div>
          <div className="font-mono font-bold text-xl text-white">
            #{stats.currentBlock.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            BTC: {stats.burnBlockHeight.toLocaleString()}
          </div>
        </div>

        {/* Block Time */}
        <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl p-3 border border-blue-500/20">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            Avg Block Time
          </div>
          <div className="font-mono font-bold text-xl text-white">
            {formatTime(stats.avgBlockTime)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Target: ~10 min
          </div>
        </div>

        {/* Mempool */}
        <div className="bg-gradient-to-br from-orange-500/10 to-transparent rounded-xl p-3 border border-orange-500/20">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Database className="w-3.5 h-3.5" />
            Mempool
          </div>
          <div className="font-mono font-bold text-xl text-white">
            {formatNumber(stats.mempoolSize)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.mempoolFees.toFixed(2)} STX fees
          </div>
        </div>

        {/* TPS */}
        <div className="bg-gradient-to-br from-green-500/10 to-transparent rounded-xl p-3 border border-green-500/20">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Zap className="w-3.5 h-3.5" />
            Throughput
          </div>
          <div className="font-mono font-bold text-xl text-white">
            {stats.tps} TPS
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.peerCount} peers
          </div>
        </div>
      </div>

      {/* Recent Blocks */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-400">Recent Blocks</span>
          <span className="text-xs text-gray-500">{recentBlocks.length} blocks</span>
        </div>
        <div className="space-y-2">
          {recentBlocks.slice(0, 3).map((block, idx) => (
            <a
              key={block.hash}
              href={`https://explorer.hiro.so/block/${block.hash}?chain=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  idx === 0 ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono text-sm text-white group-hover:text-purple-400 transition-colors">
                    #{block.height?.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {block.txs?.length || 0} txs
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {new Date(block.burn_block_time * 1000).toLocaleTimeString()}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {block.hash?.slice(0, 8)}...
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* STX Supply */}
      <div className="p-4 bg-gradient-to-r from-purple-500/5 to-orange-500/5 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">Total STX Supply</span>
          </div>
          <div className="font-mono font-bold text-white">
            {formatNumber(stats.stxSupply)} STX
          </div>
        </div>
      </div>

      {/* Signer Metrics */}
      {signerMetrics && (
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">PoX Signer Consensus</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              HIRO METRICS API
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Participation */}
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">Participation</div>
              <div className={`text-lg font-bold font-mono ${
                signerMetrics.participationRate >= 80 ? 'text-green-400'
                : signerMetrics.participationRate >= 60 ? 'text-yellow-400'
                : 'text-red-400'
              }`}>
                {signerMetrics.participationRate}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    signerMetrics.participationRate >= 80 ? 'bg-green-400'
                    : signerMetrics.participationRate >= 60 ? 'bg-yellow-400'
                    : 'bg-red-400'
                  }`}
                  style={{ width: `${signerMetrics.participationRate}%` }}
                />
              </div>
            </div>
            {/* Acceptance Rate */}
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">Acceptance Rate</div>
              <div className={`text-lg font-bold font-mono ${
                signerMetrics.avgAcceptanceRate >= 90 ? 'text-green-400'
                : signerMetrics.avgAcceptanceRate >= 70 ? 'text-yellow-400'
                : 'text-red-400'
              }`}>
                {signerMetrics.avgAcceptanceRate}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${signerMetrics.avgAcceptanceRate}%` }}
                />
              </div>
            </div>
            {/* Active Signers */}
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">Active Signers</div>
              <div className="text-lg font-bold font-mono text-purple-400">
                {signerMetrics.activeSigners}
                <span className="text-sm text-gray-600">/{signerMetrics.totalSigners}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-400 transition-all"
                  style={{ width: `${(signerMetrics.activeSigners / signerMetrics.totalSigners) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkHealth;
