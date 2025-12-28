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
      // Builder Challenge leaderboard data
      const mockLeaderboard: LeaderboardEntry[] = [
        {
          rank: 1,
          address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
          ensName: 'debielily',
          avatar: '👑',
          githubProgress: 95.5,
          onchainProgress: 88.2,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Built Stacks DeFi Protocol with 50+ commits',
          badges: ['🏆', '⭐', '🔥'],
        },
        {
          rank: 2,
          address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KR9H',
          ensName: 'investorphem.base.eth',
          avatar: '🦍',
          githubProgress: 82.3,
          onchainProgress: 91.5,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Created NFT marketplace and staking contracts',
          badges: ['🥈', '💎'],
        },
        {
          rank: 3,
          address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
          ensName: 'devqueen.base.eth',
          avatar: '👸',
          githubProgress: 78.9,
          onchainProgress: 85.4,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Developed DAO governance tools',
          badges: ['🥉', '🚀'],
        },
        {
          rank: 4,
          address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          ensName: 'winsznx',
          avatar: '🎯',
          githubProgress: 75.2,
          onchainProgress: 82.1,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Built analytics dashboard with real-time data',
          badges: ['⚡'],
        },
        {
          rank: 5,
          address: 'SP3NE8YJHGX32GNGZ9NPDH0M65YWB3PFCN5J3PX9Z',
          ensName: 'sanmipaul',
          avatar: '🔮',
          githubProgress: 71.8,
          onchainProgress: 79.3,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Contributed to RenV Protocol',
          badges: ['💫'],
        },
        {
          rank: 6,
          address: 'SP2PA9S93VBG8ZJE5T78Z45G7X0D4EXRQ8VG4WN8K',
          ensName: 'masaun',
          avatar: '🧙',
          githubProgress: 68.5,
          onchainProgress: 76.8,
          rewards: 600,
          weeklyChange: 0,
          activitySummary: 'Built cross-chain bridge integration',
          badges: ['🌉'],
        },
        {
          rank: 7,
          address: 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE',
          ensName: 'rampop',
          avatar: '🎮',
          githubProgress: 65.2,
          onchainProgress: 73.9,
          rewards: 600,
          weeklyChange: 2,
          activitySummary: 'Created Quest system smart contracts',
          badges: ['🎯'],
        },
        {
          rank: 8,
          address: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ',
          ensName: 'bamzzz',
          avatar: '💥',
          githubProgress: 62.1,
          onchainProgress: 71.2,
          rewards: 600,
          weeklyChange: 1,
          activitySummary: 'Made significant changes to smart contracts',
          badges: ['🔧'],
        },
        // Your position (serayd61)
        {
          rank: 41,
          address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
          ensName: 'serayd61.base.eth',
          avatar: '🛡️',
          githubProgress: 3.18,
          onchainProgress: 17.93,
          rewards: 120,
          weeklyChange: 15,
          activitySummary: 'Built Stacks DeFi Sentinel with Chainhooks',
          badges: ['🚀', '⚡'],
        },
      ];

      setLeaderboard(mockLeaderboard);
      setStats({
        totalParticipants: 1250,
        totalRewardsDistributed: 125000,
        yourRank: 41,
        yourRewards: 120,
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
            <h2 className="text-xl font-bold text-white">Builder Challenge</h2>
            <p className="text-sm text-yellow-300/70">Weekly Leaderboard</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-300/70">Participants</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.totalParticipants.toLocaleString()}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-300/70">Total Rewards</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.totalRewardsDistributed.toLocaleString()} $STX</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500/20 to-orange-500/20 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-300/70">Your Rank</span>
            </div>
            <p className="text-lg font-bold text-white">#{stats.yourRank}</p>
          </div>
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-300/70">Your Rewards</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.yourRewards?.toFixed(2)} $STX</p>
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
        {leaderboard.slice(0, 8).map((entry, index) => (
          <div
            key={index}
            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
              entry.rank === 41
                ? 'bg-gradient-to-r from-purple-500/20 to-orange-500/20 border-2 border-purple-500/50'
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

        {/* Show "You" separator if not in top 8 */}
        {leaderboard.find(e => e.rank === 41) && (
          <>
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 border-t border-dashed border-yellow-500/30"></div>
              <span className="text-yellow-300/50 text-sm">• • •</span>
              <div className="flex-1 border-t border-dashed border-yellow-500/30"></div>
            </div>
            <div
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-orange-500/20 border-2 border-purple-500/50"
            >
              {/* Your entry highlighted */}
              <div className="w-10 flex justify-center">
                <span className="text-purple-400 font-mono font-bold">#41</span>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-xl">
                  🛡️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">serayd61.base.eth</span>
                    <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full">You</span>
                    <span>🚀</span>
                    <span>⚡</span>
                  </div>
                  <p className="text-xs text-purple-300/70">Built Stacks DeFi Sentinel with Chainhooks</p>
                </div>
              </div>
              <div className="hidden md:flex gap-4">
                <div className="w-24">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">GitHub</span>
                    <span className="text-white">3.18%</span>
                  </div>
                  <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: '3.18%' }} />
                  </div>
                </div>
                <div className="w-24">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Onchain</span>
                    <span className="text-white">17.93%</span>
                  </div>
                  <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: '17.93%' }} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">120.00 $STX</p>
                <p className="text-xs text-green-400 flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +15 ranks
                </p>
              </div>
            </div>
          </>
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

