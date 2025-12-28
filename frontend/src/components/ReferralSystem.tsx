import React, { useState, useEffect } from 'react';
import { Share2, Copy, CheckCircle, Users, Gift, TrendingUp, Link, Award, Sparkles } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

interface ReferralStats {
  totalReferrals: number;
  pendingRewards: number;
  claimedRewards: number;
  referralCode: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierProgress: number;
}

interface ReferralUser {
  address: string;
  joinedAt: string;
  status: 'active' | 'pending';
  rewardEarned: number;
}

const ReferralSystem: React.FC = () => {
  const { isConnected, stxAddress } = useWallet();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchReferralData();
    } else {
      setLoading(false);
    }
  }, [isConnected]);

  const fetchReferralData = async () => {
    try {
      // Generate unique referral code from address
      const code = stxAddress 
        ? `SNTL-${stxAddress.slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        : 'SNTL-DEMO-CODE';

      setStats({
        totalReferrals: 7,
        pendingRewards: 35,
        claimedRewards: 120,
        referralCode: code,
        tier: 'silver',
        nextTierProgress: 70,
      });

      setReferrals([
        {
          address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KR9H',
          joinedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'active',
          rewardEarned: 10,
        },
        {
          address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
          joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          status: 'active',
          rewardEarned: 10,
        },
        {
          address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          joinedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          status: 'active',
          rewardEarned: 10,
        },
        {
          address: 'SP3NE8YJHGX32GNGZ9NPDH0M65YWB3PFCN5J3PX9Z',
          joinedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          status: 'pending',
          rewardEarned: 0,
        },
      ]);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!stats) return;
    
    const link = `https://defi-sentinel.xyz?ref=${stats.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const claimRewards = async () => {
    if (!stats || stats.pendingRewards <= 0) return;
    
    setIsClaiming(true);
    try {
      // Simulate claiming
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStats(prev => prev ? {
        ...prev,
        claimedRewards: prev.claimedRewards + prev.pendingRewards,
        pendingRewards: 0,
      } : null);
    } catch (error) {
      console.error('Claim failed:', error);
    } finally {
      setIsClaiming(false);
    }
  };

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return { color: 'from-amber-700 to-amber-900', icon: '🥉', bonus: '5%', nextReq: 5 };
      case 'silver':
        return { color: 'from-gray-400 to-gray-600', icon: '🥈', bonus: '10%', nextReq: 10 };
      case 'gold':
        return { color: 'from-yellow-400 to-yellow-600', icon: '🥇', bonus: '15%', nextReq: 25 };
      case 'platinum':
        return { color: 'from-cyan-300 to-blue-500', icon: '💎', bonus: '20%', nextReq: 50 };
      default:
        return { color: 'from-gray-500 to-gray-700', icon: '⭐', bonus: '5%', nextReq: 5 };
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-br from-rose-900/20 to-pink-900/20 rounded-2xl p-8 border border-rose-500/30 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/20 flex items-center justify-center">
          <Share2 className="w-8 h-8 text-rose-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Referral Program</h3>
        <p className="text-gray-400 mb-6">
          Connect your wallet to get your unique referral link and start earning rewards
        </p>
        <button className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-xl text-white font-medium transition-all">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-rose-900/20 to-pink-900/20 rounded-2xl p-6 border border-rose-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-rose-500/20 rounded w-1/3 mb-6"></div>
          <div className="h-24 bg-rose-500/20 rounded-xl mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-rose-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tierInfo = stats ? getTierInfo(stats.tier) : getTierInfo('bronze');

  return (
    <div className="bg-gradient-to-br from-rose-900/20 to-pink-900/20 rounded-2xl p-6 border border-rose-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Referral Program</h2>
            <p className="text-sm text-rose-300/70">Earn SNTL for every referral</p>
          </div>
        </div>
        {stats && (
          <div className={`flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${tierInfo.color} rounded-xl`}>
            <span className="text-lg">{tierInfo.icon}</span>
            <span className="text-white font-medium capitalize">{stats.tier}</span>
          </div>
        )}
      </div>

      {stats && (
        <>
          {/* Referral Link Card */}
          <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-rose-400" />
                <span className="text-sm text-rose-300/70">Your Referral Link</span>
              </div>
              <span className="text-xs text-rose-300/50">+10 SNTL per referral</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-black/50 rounded-lg px-4 py-3 font-mono text-sm text-white truncate">
                https://defi-sentinel.xyz?ref={stats.referralCode}
              </div>
              <button
                onClick={copyReferralLink}
                className={`px-4 py-3 rounded-lg transition-all flex items-center gap-2 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-rose-300/70">Referrals</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalReferrals}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-rose-300/70">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{stats.pendingRewards} SNTL</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-green-400" />
                <span className="text-xs text-rose-300/70">Claimed</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{stats.claimedRewards} SNTL</p>
            </div>
          </div>

          {/* Tier Progress */}
          <div className="bg-black/30 rounded-xl p-4 border border-rose-500/20 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <span className="text-sm text-white font-medium">Tier Progress</span>
              </div>
              <span className="text-sm text-rose-300/70">
                {stats.tier !== 'platinum' && `Next: ${tierInfo.nextReq} referrals`}
              </span>
            </div>
            <div className="h-3 bg-black/50 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full bg-gradient-to-r ${tierInfo.color} rounded-full transition-all`}
                style={{ width: `${stats.nextTierProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-rose-300/50">{stats.tier.charAt(0).toUpperCase() + stats.tier.slice(1)}</span>
              <span className="text-rose-300/50">{stats.nextTierProgress}%</span>
              {stats.tier !== 'platinum' && (
                <span className="text-rose-300/50">
                  {stats.tier === 'bronze' ? 'Silver' : stats.tier === 'silver' ? 'Gold' : 'Platinum'}
                </span>
              )}
            </div>
          </div>

          {/* Tier Benefits */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { tier: 'bronze', icon: '🥉', bonus: '5%' },
              { tier: 'silver', icon: '🥈', bonus: '10%' },
              { tier: 'gold', icon: '🥇', bonus: '15%' },
              { tier: 'platinum', icon: '💎', bonus: '20%' },
            ].map((t) => (
              <div
                key={t.tier}
                className={`p-3 rounded-lg text-center ${
                  stats.tier === t.tier
                    ? 'bg-rose-500/30 border border-rose-500/50'
                    : 'bg-black/20 border border-rose-500/10'
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <p className="text-xs text-white mt-1 capitalize">{t.tier}</p>
                <p className="text-xs text-rose-300/70">+{t.bonus}</p>
              </div>
            ))}
          </div>

          {/* Claim Button */}
          {stats.pendingRewards > 0 && (
            <button
              onClick={claimRewards}
              disabled={isClaiming}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isClaiming ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Claim {stats.pendingRewards} SNTL
                </>
              )}
            </button>
          )}

          {/* Referral List */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-400" />
              Your Referrals
            </h4>
            <div className="space-y-2">
              {referrals.map((ref, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-rose-500/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-sm">
                      {ref.status === 'active' ? '✅' : '⏳'}
                    </div>
                    <div>
                      <p className="text-white font-mono text-sm">{formatAddress(ref.address)}</p>
                      <p className="text-xs text-rose-300/50">{formatDate(ref.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ref.status === 'active' ? (
                      <p className="text-green-400 font-medium">+{ref.rewardEarned} SNTL</p>
                    ) : (
                      <p className="text-yellow-400 text-sm">Pending</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Share Options */}
          <div className="mt-6 pt-4 border-t border-rose-500/20">
            <p className="text-sm text-rose-300/70 text-center mb-3">Share with friends</p>
            <div className="flex justify-center gap-3">
              <button className="p-3 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 rounded-xl text-[#1DA1F2] transition-colors">
                𝕏
              </button>
              <button className="p-3 bg-[#5865F2]/20 hover:bg-[#5865F2]/30 rounded-xl text-[#5865F2] transition-colors">
                Discord
              </button>
              <button className="p-3 bg-[#0088cc]/20 hover:bg-[#0088cc]/30 rounded-xl text-[#0088cc] transition-colors">
                Telegram
              </button>
              <button className="p-3 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl text-rose-400 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReferralSystem;

