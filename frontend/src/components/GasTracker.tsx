import React, { useState, useEffect } from 'react';
import { Gauge, TrendingUp, TrendingDown, Clock, Zap, AlertTriangle, Info } from 'lucide-react';

interface GasData {
  currentFee: number;
  fastFee: number;
  standardFee: number;
  slowFee: number;
  avgFee24h: number;
  feeChange24h: number;
  pendingTxCount: number;
  avgBlockTime: number;
  lastBlockFees: BlockFee[];
}

interface BlockFee {
  blockHeight: number;
  avgFee: number;
  txCount: number;
  timestamp: string;
}

const GasTracker: React.FC = () => {
  const [gasData, setGasData] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSpeed, setSelectedSpeed] = useState<'slow' | 'standard' | 'fast'>('standard');

  useEffect(() => {
    fetchGasData();
    const interval = setInterval(fetchGasData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchGasData = async () => {
    try {
      const [mempoolRes, blockRes, feeRes, blocksV2Res] = await Promise.all([
        fetch('https://api.hiro.so/extended/v1/tx/mempool/stats'),
        fetch('https://api.hiro.so/extended/v1/block?limit=10'),
        fetch('https://api.hiro.so/v2/fees/transfer'),
        fetch('https://api.hiro.so/extended/v2/blocks?limit=5'),
      ]);

      // --- Mempool stats (real fee percentiles from Hiro) ---
      let pendingTxCount = 0;
      let slowFee = 50;
      let standardFee = 100;
      let fastFee = 200;

      if (mempoolRes.ok) {
        const m = await mempoolRes.json();
        pendingTxCount = m.tx_count || 0;
        const p = m.tx_fee_percentiles || {};
        // p50 = slow, p75 = standard, p95 = fast (in microSTX)
        if (p.p50) slowFee     = Math.round(p.p50);
        if (p.p75) standardFee = Math.round(p.p75);
        if (p.p95) fastFee     = Math.round(p.p95);
      }

      // --- Real fee rate from /v2/fees/transfer ---
      let currentFee = standardFee;
      if (feeRes.ok) {
        const f = await feeRes.json();
        // fee_rate is microSTX per byte; typical token transfer ~180 bytes
        if (f.fee_rate) currentFee = Math.round(f.fee_rate * 180);
      }

      // --- Recent blocks with real tx counts (v2) ---
      const lastBlockFees: BlockFee[] = [];
      if (blocksV2Res.ok) {
        const bd = await blocksV2Res.json();
        (bd.results || []).slice(0, 5).forEach((block: any) => {
          lastBlockFees.push({
            blockHeight: block.height,
            avgFee: standardFee, // best approximation without per-block fee index
            txCount: block.tx_count || 0,
            timestamp: block.burn_block_time_iso || new Date().toISOString(),
          });
        });
      } else if (blockRes.ok) {
        const bd = await blockRes.json();
        (bd.results || []).slice(0, 5).forEach((block: any) => {
          lastBlockFees.push({
            blockHeight: block.height,
            avgFee: standardFee,
            txCount: block.txs?.length || 0,
            timestamp: block.burn_block_time_iso || new Date().toISOString(),
          });
        });
      }

      // --- Block time from v2 blocks ---
      let avgBlockTime = 10.5;
      if (blocksV2Res.ok) {
        const bd = await blocksV2Res.json();
        const results = bd.results || [];
        if (results.length >= 2) {
          const diffs: number[] = [];
          for (let i = 0; i < results.length - 1; i++) {
            const d = results[i].burn_block_time - results[i + 1].burn_block_time;
            if (d > 0) diffs.push(d);
          }
          if (diffs.length > 0) {
            avgBlockTime = diffs.reduce((a, b) => a + b, 0) / diffs.length / 60;
          }
        }
      }

      const avgFee24h = standardFee;
      const feeChange24h = currentFee > 0 && avgFee24h > 0
        ? ((currentFee - avgFee24h) / avgFee24h) * 100
        : 0;

      setGasData({
        currentFee,
        fastFee,
        standardFee,
        slowFee,
        avgFee24h,
        feeChange24h,
        pendingTxCount,
        avgBlockTime: parseFloat(avgBlockTime.toFixed(1)),
        lastBlockFees,
      });
    } catch (error) {
      console.error('Error fetching gas data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFee = (microStx: number) => {
    const stx = microStx / 1_000_000;
    if (stx < 0.001) return `${microStx.toFixed(0)} µSTX`;
    if (stx < 1)     return `${stx.toFixed(4)} STX`;
    return `${stx.toFixed(2)} STX`;
  };

  const getNetworkStatus = () => {
    if (!gasData) return { status: 'unknown', color: 'gray', message: 'Loading...' };
    if (gasData.pendingTxCount < 50)  return { status: 'Low',    color: 'green',  message: 'Network is clear' };
    if (gasData.pendingTxCount < 150) return { status: 'Normal', color: 'yellow', message: 'Normal congestion' };
    return { status: 'High', color: 'red', message: 'High congestion' };
  };

  const networkStatus = getNetworkStatus();

  const getSpeedInfo = (speed: 'slow' | 'standard' | 'fast') => {
    switch (speed) {
      case 'fast':     return { time: '~1 block',     fee: gasData?.fastFee     || 0, color: 'from-orange-500 to-red-500' };
      case 'standard': return { time: '~2-3 blocks',  fee: gasData?.standardFee || 0, color: 'from-blue-500 to-purple-500' };
      case 'slow':     return { time: '~5-10 blocks', fee: gasData?.slowFee     || 0, color: 'from-green-500 to-teal-500' };
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 rounded-2xl p-6 border border-cyan-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-cyan-500/20 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-cyan-500/20 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 rounded-2xl p-6 border border-cyan-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Gauge className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gas Tracker</h2>
            <p className="text-sm text-cyan-300/70">Live fee data · Hiro API</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
          ${networkStatus.color === 'green'  ? 'bg-green-500/20  text-green-400  border border-green-500/30'  : ''}
          ${networkStatus.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
          ${networkStatus.color === 'red'    ? 'bg-red-500/20    text-red-400    border border-red-500/30'    : ''}
          ${networkStatus.color === 'gray'   ? 'bg-gray-500/20   text-gray-400   border border-gray-500/30'   : ''}
        `}>
          <span className={`w-2 h-2 rounded-full animate-pulse
            ${networkStatus.color === 'green'  ? 'bg-green-400'  : ''}
            ${networkStatus.color === 'yellow' ? 'bg-yellow-400' : ''}
            ${networkStatus.color === 'red'    ? 'bg-red-400'    : ''}
            ${networkStatus.color === 'gray'   ? 'bg-gray-400'   : ''}
          `} />
          {networkStatus.status} Traffic
        </div>
      </div>

      {gasData && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyan-300/70">Current Fee</span>
              </div>
              <p className="text-lg font-bold text-white">{formatFee(gasData.currentFee)}</p>
              <p className={`text-xs flex items-center gap-1 ${gasData.feeChange24h >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {gasData.feeChange24h >= 0
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />}
                {gasData.feeChange24h >= 0 ? '+' : ''}{gasData.feeChange24h.toFixed(1)}% vs avg
              </p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyan-300/70">Pending Txs</span>
              </div>
              <p className="text-lg font-bold text-white">{gasData.pendingTxCount.toLocaleString()}</p>
              <p className="text-xs text-cyan-300/50">in mempool</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyan-300/70">Block Time</span>
              </div>
              <p className="text-lg font-bold text-white">{gasData.avgBlockTime.toFixed(1)}min</p>
              <p className="text-xs text-cyan-300/50">average</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyan-300/70">Slow (p50)</span>
              </div>
              <p className="text-lg font-bold text-white">{formatFee(gasData.slowFee)}</p>
              <p className="text-xs text-cyan-300/50">mempool p50</p>
            </div>
          </div>

          {/* Fee tiers */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              Select Transaction Speed
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {(['slow', 'standard', 'fast'] as const).map((speed) => {
                const info = getSpeedInfo(speed);
                const isSelected = selectedSpeed === speed;
                return (
                  <button
                    key={speed}
                    onClick={() => setSelectedSpeed(speed)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `bg-gradient-to-r ${info.color} border-transparent`
                        : 'bg-black/20 border-cyan-500/20 hover:border-cyan-500/40'
                    }`}
                  >
                    <p className={`text-sm font-medium mb-1 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {speed === 'slow' ? '🐢 Slow' : speed === 'standard' ? '⚡ Standard' : '🚀 Fast'}
                    </p>
                    <p className="text-lg font-bold text-white">{formatFee(info.fee)}</p>
                    <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>{info.time}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent blocks */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Recent Blocks</h4>
            <div className="space-y-2">
              {gasData.lastBlockFees.map((block, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-cyan-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs font-mono text-cyan-300">
                      #{block.blockHeight.toString().slice(-4)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Block {block.blockHeight.toLocaleString()}</p>
                      <p className="text-xs text-cyan-300/50">{block.txCount} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatFee(block.avgFee)}</p>
                    <p className="text-xs text-cyan-300/50">
                      {new Date(block.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-cyan-300/70">
              <strong className="text-cyan-300">Live data</strong> from Hiro API — fee tiers based on real mempool percentiles (p50 / p75 / p95).
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GasTracker;
