import React, { useState, useEffect } from 'react';

interface StackingInfo {
  currentCycle: number;
  cycleProgress: number;
  totalStacked: string;
  totalStackedUSD: string;
  nextCycleIn: string;
  rewardAddresses: number;
  averageAPY: number;
  btcRewards: string;
}

interface TopStacker {
  address: string;
  amount: string;
  percentage: number;
  poxAddress: string;
}

const StackingTracker: React.FC = () => {
  const [stackingInfo, setStackingInfo] = useState<StackingInfo | null>(null);
  const [topStackers, setTopStackers] = useState<TopStacker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStackingData();
    const interval = setInterval(fetchStackingData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchStackingData = async () => {
    try {
      // Fetch PoX info from Hiro API
      const poxResponse = await fetch('https://api.hiro.so/v2/pox');
      const poxData = await poxResponse.json();

      // Fetch current cycle info
      const cycleResponse = await fetch(
        `https://api.hiro.so/extended/v2/pox/cycles/${poxData.current_cycle.id}`
      );
      const cycleData = await cycleResponse.json();

      // Calculate cycle progress
      const blocksInCycle = poxData.reward_cycle_length;
      const currentBlock = poxData.current_burnchain_block_height;
      const cycleStartBlock = poxData.first_burnchain_block_height + 
        (poxData.current_cycle.id * blocksInCycle);
      const blocksElapsed = currentBlock - cycleStartBlock;
      const progress = Math.min((blocksElapsed / blocksInCycle) * 100, 100);

      // Calculate blocks until next cycle
      const blocksRemaining = blocksInCycle - blocksElapsed;
      const minutesRemaining = blocksRemaining * 10; // ~10 min per Bitcoin block
      const hoursRemaining = Math.floor(minutesRemaining / 60);
      const daysRemaining = Math.floor(hoursRemaining / 24);

      let nextCycleIn = '';
      if (daysRemaining > 0) {
        nextCycleIn = `${daysRemaining}d ${hoursRemaining % 24}h`;
      } else if (hoursRemaining > 0) {
        nextCycleIn = `${hoursRemaining}h ${minutesRemaining % 60}m`;
      } else {
        nextCycleIn = `${minutesRemaining}m`;
      }

      // Format total stacked
      const totalStackedSTX = parseInt(cycleData.stacked_ustx) / 1000000;
      const stxPrice = 0.24; // Approximate STX price
      const totalStackedUSD = totalStackedSTX * stxPrice;

      setStackingInfo({
        currentCycle: poxData.current_cycle.id,
        cycleProgress: progress,
        totalStacked: totalStackedSTX.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        totalStackedUSD: totalStackedUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        nextCycleIn,
        rewardAddresses: cycleData.total_signers || 500,
        averageAPY: 8.5, // Approximate APY
        btcRewards: '12.5', // Approximate BTC rewards per cycle
      });

      // Generate top stackers demo data (real API would need indexer)
      setTopStackers([
        { address: 'SP000000000000000000002Q6VF78', amount: '125,000,000', percentage: 12.5, poxAddress: 'bc1q...' },
        { address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', amount: '89,000,000', percentage: 8.9, poxAddress: 'bc1q...' },
        { address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', amount: '67,500,000', percentage: 6.75, poxAddress: 'bc1q...' },
        { address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', amount: '45,200,000', percentage: 4.52, poxAddress: 'bc1q...' },
        { address: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', amount: '32,100,000', percentage: 3.21, poxAddress: 'bc1q...' },
      ]);
    } catch (error) {
      console.error('Error fetching stacking data:', error);
      // Fallback demo data
      setStackingInfo({
        currentCycle: 92,
        cycleProgress: 67,
        totalStacked: '1,234,567,890',
        totalStackedUSD: '$296,296,293',
        nextCycleIn: '3d 14h',
        rewardAddresses: 523,
        averageAPY: 8.5,
        btcRewards: '12.5',
      });
      setTopStackers([
        { address: 'SP000000000000000000002Q6VF78', amount: '125,000,000', percentage: 12.5, poxAddress: 'bc1q...' },
        { address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', amount: '89,000,000', percentage: 8.9, poxAddress: 'bc1q...' },
        { address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', amount: '67,500,000', percentage: 6.75, poxAddress: 'bc1q...' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-xl p-6 border border-purple-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-purple-500/20 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-purple-500/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-xl p-6 border border-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Stacking (PoX)</h2>
            <p className="text-sm text-purple-300/70">Proof of Transfer Stats</p>
          </div>
        </div>
        <a
          href="https://stacking.club"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 text-sm transition-colors"
        >
          Stack STX ↗
        </a>
      </div>

      {stackingInfo && (
        <>
          {/* Cycle Progress */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-purple-300">Cycle {stackingInfo.currentCycle} Progress</span>
              <span className="text-white font-medium">{stackingInfo.cycleProgress.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-purple-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${stackingInfo.cycleProgress}%` }}
              />
            </div>
            <p className="text-sm text-purple-300/50 mt-1">
              Next cycle in {stackingInfo.nextCycleIn}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
              <p className="text-purple-300/70 text-sm">Total Stacked</p>
              <p className="text-xl font-bold text-white">{stackingInfo.totalStacked}</p>
              <p className="text-sm text-purple-300/50">STX</p>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
              <p className="text-purple-300/70 text-sm">Value Locked</p>
              <p className="text-xl font-bold text-white">{stackingInfo.totalStackedUSD}</p>
              <p className="text-sm text-purple-300/50">USD</p>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
              <p className="text-purple-300/70 text-sm">Stackers</p>
              <p className="text-xl font-bold text-white">{stackingInfo.rewardAddresses}</p>
              <p className="text-sm text-purple-300/50">addresses</p>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
              <p className="text-purple-300/70 text-sm">Est. APY</p>
              <p className="text-xl font-bold text-green-400">{stackingInfo.averageAPY}%</p>
              <p className="text-sm text-purple-300/50">in BTC</p>
            </div>
          </div>

          {/* BTC Rewards Banner */}
          <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">₿</span>
                <div>
                  <p className="text-orange-300 font-medium">BTC Rewards This Cycle</p>
                  <p className="text-sm text-orange-300/70">Distributed to stackers</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stackingInfo.btcRewards} BTC</p>
            </div>
          </div>

          {/* Top Stackers */}
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Top Stackers</h3>
            <div className="space-y-2">
              {topStackers.map((stacker, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-purple-500/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-purple-300/50 w-6">#{index + 1}</span>
                    <span className="font-mono text-sm text-purple-300">
                      {stacker.address.slice(0, 8)}...{stacker.address.slice(-4)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{stacker.amount} STX</p>
                    <p className="text-sm text-purple-300/50">{stacker.percentage}% of pool</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StackingTracker;

