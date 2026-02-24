import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Medal, Star, Users, Zap, Award, Crown } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  address: string;
  ensName?: string;
  avatar?: string;
  githubProgress: number;
  onchainProgress: number;
  rewards: number;
  weeklyChange: number;
  activitySummary: string;
  badges: string[];
}

interface LeaderboardStats {
  totalParticipants: number;
  totalRewardsDistributed: number;
  yourRank?: number;
  yourRewards?: number;
}

const StacksLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'allTime'>('weekly');
  const [category, setCategory] = useState<'all' | 'github' | 'onchain'>('all');

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [timeframe, category]);

  const fetchLeaderboard = async () => {
    try {
      const API = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
      const HIRO = 'https://api.hiro.so';

      // Fetch recent high-value transfers to identify most active addresses
      const res = await fetch(
        `${HIRO}/extended/v1/tx?type=token_transfer&limit=50&order=desc&order_by=block_height`,
        { headers: { Accept: 'application/json' } }
      );

      const activityMap = new Map<string, { txCount: number; totalAmount: number; lastTx: string }>();
      const avatars = ['🔷', '🟣', '🟠', '⚡', '🔮', '🎯', '💎', '🧙', '🎮', '💥', '🦍', '🌟'];

      if (res.ok) {
        const data = await res.json() as { results?: Record<string, unknown>[] };
        const txs = data.results || [];

        for (const tx of txs) {
          const sender = tx['sender_address'] as string;
          const tt = tx['token_transfer'] as Record<string, unknown> | undefined;
          if (!sender || !tt) continue;

          const amount = Number(tt['amount'] || 0) / 1_000_000;
          const existing = activityMap.get(sender) || { txCount: 0, totalAmount: 0, lastTx: '' };
          existing.txCount++;
          existing.totalAmount += amount;
          existing.lastTx = (tx['burn_block_time_iso'] as string) || '';
          activityMap.set(sender, existing);
        }
      }

      // Sort by total amount and convert to leaderboard entries
      const sorted = Array.from(activityMap.entries())
        .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
        .slice(0, 10);

      const entries: LeaderboardEntry[] = sorted.map(([address, data], index) => ({
        rank: index + 1,
        address,
        avatar: avatars[index % avatars.length],
        githubProgress: 0,
        onchainProgress: Math.min(data.totalAmount / 10_000 * 100, 100),
        rewards: 0,
        weeklyChange: 0,
        activitySummary: `${data.txCount} transactions, ${Math.round(data.totalAmount).toLocaleString()} STX transferred`,
        badges: data.totalAmount >= 100_000 ? ['🐋'] : data.totalAmount >= 10_000 ? ['🦈'] : [],
      }));

      setLeaderboard(entries);
      setStats({
        totalParticipants: activityMap.size,
        totalRewardsDistributed: 0,
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-400 font-mono">#{rank}</span>;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/20 rounded-2xl p-6 border border-yellow-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-yellow-500/20 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-yellow-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/20 rounded-2xl p-6 border border-yellow-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/25">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">On-Chain Leaderboard</h2>
            <p className="text-sm text-yellow-300/70">Top Active Addresses (Live)</p>
          </div>
        </div>
        <a
          href="https://talent.app/~/earn/stacks-challenge-3"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-xl text-yellow-300 text-sm font-medium transition-colors flex items-center gap-2"
        >
          View Full ↗
        </a>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-300/70">Active Addresses</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.totalParticipants.toLocaleString()}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-300/70">Data Source</span>
            </div>
            <p className="text-lg font-bold text-white">Hiro API</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-black/30 p-1 rounded-xl">
          {(['weekly', 'monthly', 'allTime'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-yellow-500 text-black'
                  : 'text-yellow-300/70 hover:text-yellow-300'
              }`}
            >
              {tf === 'weekly' ? 'Weekly' : tf === 'monthly' ? 'Monthly' : 'All Time'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-black/30 p-1 rounded-xl">
          {(['all', 'github', 'onchain'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-yellow-500 text-black'
                  : 'text-yellow-300/70 hover:text-yellow-300'
              }`}
            >
              {cat === 'all' ? 'All' : cat === 'github' ? 'GitHub' : 'On-chain'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-2">
        {leaderboard.slice(0, 10).map((entry, index) => (
          <div
            key={index}
            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
              entry.rank <= 3
                ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30'
                : 'bg-black/20 border border-yellow-500/10 hover:border-yellow-500/30'
            }`}
          >
            {/* Rank */}
            <div className="w-10 flex justify-center">
              {getRankBadge(entry.rank)}
            </div>

            {/* Avatar & Name */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-xl">
                {entry.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{entry.ensName || formatAddress(entry.address)}</span>
                  {entry.badges.map((badge, i) => (
                    <span key={i} className="text-sm">{badge}</span>
                  ))}
                </div>
                <p className="text-xs text-yellow-300/50 truncate max-w-[200px]">{entry.activitySummary}</p>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="hidden md:flex gap-4">
              <div className="w-24">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">GitHub</span>
                  <span className="text-white">{entry.githubProgress.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(entry.githubProgress)} rounded-full transition-all`}
                    style={{ width: `${entry.githubProgress}%` }}
                  />
                </div>
              </div>
              <div className="w-24">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Onchain</span>
                  <span className="text-white">{entry.onchainProgress.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(entry.onchainProgress)} rounded-full transition-all`}
                    style={{ width: `${entry.onchainProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Rewards */}
            <div className="text-right">
              <p className="text-white font-bold">{entry.rewards.toFixed(2)} $STX</p>
              {entry.weeklyChange !== 0 && (
                <p className={`text-xs flex items-center justify-end gap-1 ${
                  entry.weeklyChange > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${entry.weeklyChange < 0 && 'rotate-180'}`} />
                  {entry.weeklyChange > 0 ? '+' : ''}{entry.weeklyChange} ranks
                </p>
              )}
            </div>
          </div>
        ))}

        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No recent activity data available. Leaderboard updates every 60 seconds.</p>
          </div>
        )}
      </div>

      {/* Tips to improve */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          Tips to Climb the Leaderboard
        </h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <span className="text-blue-300">GitHub:</span> Make commits, open PRs, resolve issues</li>
          <li>• <span className="text-purple-300">Onchain:</span> Deploy contracts, make transactions, use WalletKit</li>
          <li>• <span className="text-green-300">Build:</span> Create useful tools for the Stacks ecosystem</li>
          <li>• <span className="text-orange-300">Share:</span> Document your work, create tutorials</li>
        </ul>
      </div>
    </div>
  );
};

export default StacksLeaderboard;

