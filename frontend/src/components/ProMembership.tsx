import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, principalCV, cvToValue, fetchCallReadOnlyFunction } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'token-sale-v2';

interface TierInfo {
  tier: number;
  name: string;
  staked: number;
  required: number;
}

interface TierThresholds {
  pro: number;
  vip: number;
  whale: number;
}

const TIER_BENEFITS = {
  basic: {
    name: 'Basic',
    color: 'from-gray-500 to-gray-600',
    badge: '🌱',
    benefits: [
      'Standard swap interface',
      'Basic whale alerts',
      'Public pool data'
    ]
  },
  pro: {
    name: 'Pro',
    color: 'from-blue-500 to-cyan-500',
    badge: '⚡',
    benefits: [
      'All Basic features',
      'Real-time whale alerts',
      'Advanced analytics',
      'Priority notifications',
      'Custom alert thresholds'
    ]
  },
  vip: {
    name: 'VIP',
    color: 'from-purple-500 to-pink-500',
    badge: '👑',
    benefits: [
      'All Pro features',
      'Exclusive whale data',
      'Early access to features',
      'Direct support channel',
      'API access',
      'Custom dashboards'
    ]
  },
  whale: {
    name: 'Whale',
    color: 'from-amber-500 to-orange-500',
    badge: '🐋',
    benefits: [
      'All VIP features',
      'Governance voting power',
      'Revenue sharing',
      'Private whale network',
      'Institutional features',
      'White-glove support'
    ]
  }
};

export const ProMembership: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [userTier, setUserTier] = useState<TierInfo | null>(null);
  const [thresholds, setThresholds] = useState<TierThresholds | null>(null);
  const [sntlBalance, setSntlBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [stakeAmount, setStakeAmount] = useState('');
  const [staking, setStaking] = useState(false);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [userAddress]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tier thresholds
      const thresholdsResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-tier-thresholds',
        functionArgs: [],
        network: 'mainnet',
        senderAddress: CONTRACT_ADDRESS,
      });
      
      if (thresholdsResult) {
        const thresholdsValue = cvToValue(thresholdsResult);
        setThresholds({
          pro: Number(thresholdsValue.pro) / 1_000_000,
          vip: Number(thresholdsValue.vip) / 1_000_000,
          whale: Number(thresholdsValue.whale) / 1_000_000,
        });
      }

      if (userAddress) {
        // Fetch user tier
        const tierResult = await fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'get-user-tier',
          functionArgs: [principalCV(userAddress)],
          network: 'mainnet',
          senderAddress: userAddress,
        });
        
        if (tierResult) {
          const tierValue = cvToValue(tierResult);
          setUserTier({
            tier: Number(tierValue.tier),
            name: tierValue.name,
            staked: Number(tierValue.staked) / 1_000_000,
            required: Number(tierValue.required) / 1_000_000,
          });
        }

        // Fetch SNTL balance
        const balanceResult = await fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: 'sentinel-token',
          functionName: 'get-balance',
          functionArgs: [principalCV(userAddress)],
          network: 'mainnet',
          senderAddress: userAddress,
        });
        
        if (balanceResult) {
          const balanceValue = cvToValue(balanceResult);
          setSntlBalance(Number(balanceValue.value || balanceValue) / 1_000_000);
        }
      }
    } catch (error) {
      console.error('Error fetching membership data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setTxStatus({ error: 'Please enter a valid amount' });
      return;
    }

    setStaking(true);
    setTxStatus(null);

    try {
      const amount = BigInt(Math.floor(parseFloat(stakeAmount) * 1_000_000));
      
      const result = await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'stake-tokens',
          functionArgs: [uintCV(amount.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      if (result && result.txid) {
        setTxStatus({ txId: result.txid });
        setStakeAmount('');
        setTimeout(fetchData, 3000);
      } else {
        setTxStatus({ error: 'Transaction failed' });
      }
    } catch (error: any) {
      setTxStatus({ error: error?.message || 'Failed to stake' });
    } finally {
      setStaking(false);
    }
  };

  const getTierKey = (name: string): keyof typeof TIER_BENEFITS => {
    return (name?.toLowerCase() || 'basic') as keyof typeof TIER_BENEFITS;
  };

  const currentTierKey = getTierKey(userTier?.name || 'basic');
  const currentTierInfo = TIER_BENEFITS[currentTierKey];

  const getNextTier = (): { name: string; required: number } | null => {
    if (!userTier || !thresholds) return null;
    
    if (userTier.tier === 0) return { name: 'Pro', required: thresholds.pro };
    if (userTier.tier === 1) return { name: 'VIP', required: thresholds.vip };
    if (userTier.tier === 2) return { name: 'Whale', required: thresholds.whale };
    return null;
  };

  const nextTier = getNextTier();
  const progressToNext = nextTier 
    ? Math.min((userTier?.staked || 0) / nextTier.required * 100, 100)
    : 100;

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Tier Card */}
      <div className={`bg-gradient-to-r ${currentTierInfo.color} rounded-2xl p-1`}>
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{currentTierInfo.badge}</span>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentTierInfo.name} Member</h2>
                <p className="text-gray-400">
                  {userTier?.staked?.toLocaleString() || 0} SNTL staked
                </p>
              </div>
            </div>
            {userTier && userTier.tier > 0 && (
              <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${currentTierInfo.color} text-white font-bold`}>
                {currentTierInfo.name.toUpperCase()}
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
            {currentTierInfo.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            Progress to {nextTier.name}
          </h3>
          <div className="relative w-full bg-slate-700 rounded-full h-4 mb-2">
            <div 
              className={`absolute top-0 left-0 h-4 rounded-full bg-gradient-to-r ${TIER_BENEFITS[nextTier.name.toLowerCase() as keyof typeof TIER_BENEFITS]?.color || 'from-blue-500 to-cyan-500'}`}
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>{userTier?.staked?.toLocaleString() || 0} SNTL</span>
            <span>{nextTier.required.toLocaleString()} SNTL needed</span>
          </div>
          <p className="text-gray-400 mt-2">
            Stake {(nextTier.required - (userTier?.staked || 0)).toLocaleString()} more SNTL to unlock {nextTier.name} benefits
          </p>
        </div>
      )}

      {/* Stake More Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Stake SNTL for Pro Access</h3>
        
        {!isConnected ? (
          <button
            onClick={() => connectWallet()}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 text-gray-400">
              <span>Available:</span>
              <span className="text-white font-semibold">{sntlBalance.toLocaleString()} SNTL</span>
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="Amount to stake"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleStake}
                disabled={staking}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {staking ? 'Staking...' : 'Stake'}
              </button>
            </div>

            {/* Quick stake buttons */}
            <div className="flex gap-2 mt-3">
              {thresholds && [
                { label: 'Pro', amount: thresholds.pro },
                { label: 'VIP', amount: thresholds.vip },
                { label: 'Whale', amount: thresholds.whale },
              ].map((tier) => (
                <button
                  key={tier.label}
                  onClick={() => setStakeAmount(tier.amount.toString())}
                  className="px-3 py-1 rounded-lg bg-slate-700 text-gray-300 text-sm hover:bg-slate-600 transition-colors"
                >
                  {tier.label}: {tier.amount.toLocaleString()}
                </button>
              ))}
            </div>
          </>
        )}

        {txStatus && (
          <div className={`mt-4 p-4 rounded-xl ${txStatus.error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {txStatus.error ? (
              txStatus.error
            ) : (
              <>
                ✅ Transaction submitted!{' '}
                <a 
                  href={`https://explorer.stacks.co/txid/${txStatus.txId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View on Explorer
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* All Tiers Comparison */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Membership Tiers</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(TIER_BENEFITS).map(([key, tier]) => {
            const isCurrentTier = key === currentTierKey;
            const threshold = key === 'basic' ? 0 : 
              key === 'pro' ? thresholds?.pro :
              key === 'vip' ? thresholds?.vip :
              thresholds?.whale;

            return (
              <div 
                key={key}
                className={`relative rounded-xl p-4 border-2 transition-all ${
                  isCurrentTier 
                    ? `border-transparent bg-gradient-to-b ${tier.color} bg-opacity-20` 
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-500 text-white text-xs font-bold">
                    CURRENT
                  </div>
                )}
                <div className="text-center mb-3">
                  <span className="text-3xl">{tier.badge}</span>
                  <h4 className="text-lg font-bold text-white mt-2">{tier.name}</h4>
                  <p className="text-gray-400 text-sm">
                    {threshold === 0 ? 'Free' : `${threshold?.toLocaleString()} SNTL`}
                  </p>
                </div>
                <ul className="space-y-1">
                  {tier.benefits.slice(0, 3).map((benefit, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-center gap-1">
                      <span className="text-green-400 text-xs">✓</span>
                      {benefit}
                    </li>
                  ))}
                  {tier.benefits.length > 3 && (
                    <li className="text-sm text-gray-500">
                      +{tier.benefits.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProMembership;

