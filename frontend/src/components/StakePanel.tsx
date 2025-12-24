import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV } from '@stacks/transactions';

interface StakeInfo {
  staked: string;
  startBlock: string;
  blocksStaked: string;
  totalRewardsEarned: string;
  rewardPool: string;
}

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'token-sale-v2';
const SENTINEL_TOKEN = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token';

const StakePanel: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [sntlBalance, setSntlBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string; type?: 'stake' | 'unstake' } | null>(null);

  // Fetch stake info
  const fetchStakeInfo = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-stake-info`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: userAddress,
            arguments: [`0x0516${userAddress.slice(2)}`],
          }),
        }
      );
      const data = await response.json();
      if (data.okay && data.result) {
        const result = data.result.value;
        setStakeInfo({
          staked: result?.['staked']?.value || '0',
          startBlock: result?.['start-block']?.value || '0',
          blocksStaked: result?.['blocks-staked']?.value || '0',
          totalRewardsEarned: result?.['total-rewards-earned']?.value || '0',
          rewardPool: result?.['reward-pool']?.value || '0',
        });
      }
    } catch (error) {
      console.error('Error fetching stake info:', error);
    }
  }, [userAddress]);

  // Fetch SNTL balance
  const fetchBalance = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${SENTINEL_TOKEN}/get-balance`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: userAddress,
            arguments: [`0x0516${userAddress.slice(2)}`],
          }),
        }
      );
      const data = await response.json();
      if (data.okay && data.result) {
        setSntlBalance(data.result.value || '0');
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, [userAddress]);

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchStakeInfo();
      fetchBalance();
      const interval = setInterval(() => {
        fetchStakeInfo();
        fetchBalance();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, userAddress, fetchStakeInfo, fetchBalance]);

  const handleStake = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setTxStatus({ error: 'Please enter a valid amount (minimum 1000 SNTL)', type: 'stake' });
      return;
    }

    const amountMicro = BigInt(Math.floor(parseFloat(stakeAmount) * 1_000_000));
    if (amountMicro < BigInt(1_000_000_000)) {
      setTxStatus({ error: 'Minimum stake amount is 1000 SNTL', type: 'stake' });
      return;
    }

    setStaking(true);
    setTxStatus(null);

    try {
      const result = await request(
        {
          walletConnect: {
            projectId: 'e5f06d0d893851277f61878bdf812cbd',
          },
        },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'stake-tokens',
          functionArgs: [uintCV(amountMicro.toString())],
          postConditionMode: 'deny',
          network: 'mainnet' as any,
        }
      );

      console.log('Stake result:', result);

      if (result && result.txid) {
        setTxStatus({ txId: result.txid, type: 'stake' });
        setStakeAmount('');
        setTimeout(() => {
          fetchStakeInfo();
          fetchBalance();
          setTxStatus(null);
        }, 5000);
      } else {
        setTxStatus({ error: 'Transaction failed. Please try again.', type: 'stake' });
      }
    } catch (error: any) {
      console.error('Stake error:', error);
      setTxStatus({
        error: error?.message || 'Failed to stake tokens. Please check your wallet and try again.',
        type: 'stake',
      });
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      setTxStatus({ error: 'Please enter a valid amount', type: 'unstake' });
      return;
    }

    const amountMicro = BigInt(Math.floor(parseFloat(unstakeAmount) * 1_000_000));
    const stakedMicro = BigInt(parseInt(stakeInfo?.staked || '0'));

    if (amountMicro > stakedMicro) {
      setTxStatus({ error: 'Cannot unstake more than you have staked', type: 'unstake' });
      return;
    }

    setUnstaking(true);
    setTxStatus(null);

    try {
      const result = await request(
        {
          walletConnect: {
            projectId: 'e5f06d0d893851277f61878bdf812cbd',
          },
        },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'unstake-tokens',
          functionArgs: [uintCV(amountMicro.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      console.log('Unstake result:', result);

      if (result && result.txid) {
        setTxStatus({ txId: result.txid, type: 'unstake' });
        setUnstakeAmount('');
        setTimeout(() => {
          fetchStakeInfo();
          fetchBalance();
          setTxStatus(null);
        }, 5000);
      } else {
        setTxStatus({ error: 'Transaction failed. Please try again.', type: 'unstake' });
      }
    } catch (error: any) {
      console.error('Unstake error:', error);
      setTxStatus({
        error: error?.message || 'Failed to unstake tokens. Please check your wallet and try again.',
        type: 'unstake',
      });
    } finally {
      setUnstaking(false);
    }
  };

  const formatSNTL = (microSntl: string) => {
    const sntl = parseInt(microSntl) / 1_000_000;
    return sntl.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatSTX = (microStx: string) => {
    const stx = parseInt(microStx) / 1_000_000;
    return stx.toFixed(4);
  };

  const calculateRewards = () => {
    if (!stakeInfo || parseInt(stakeInfo.staked) === 0) return { daily: 0, weekly: 0, monthly: 0 };
    
    const staked = parseInt(stakeInfo.staked) / 1_000_000;
    const rewardPool = parseInt(stakeInfo.rewardPool) / 1_000_000;
    const blocksPerDay = 144;
    const rewardRate = 0.001; // 0.1% per 1000 blocks
    
    // Simplified calculation
    const dailyReward = (staked * rewardRate * blocksPerDay) / 1000;
    const weeklyReward = dailyReward * 7;
    const monthlyReward = dailyReward * 30;
    
    return {
      daily: Math.min(dailyReward, rewardPool * 0.1), // Cap at 10% of pool per day
      weekly: Math.min(weeklyReward, rewardPool * 0.3),
      monthly: Math.min(monthlyReward, rewardPool),
    };
  };

  const rewards = calculateRewards();
  const stakedAmount = stakeInfo ? formatSNTL(stakeInfo.staked) : '0';
  const pendingRewards = stakeInfo ? formatSTX(stakeInfo.totalRewardsEarned) : '0';
  const rewardPool = stakeInfo ? formatSTX(stakeInfo.rewardPool) : '0';

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-xl p-6 border border-blue-500/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">💰 Stake & Earn</h2>
          <p className="text-sm text-blue-300/70">Stake SNTL tokens to earn STX rewards</p>
        </div>
        <div className="px-4 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <div className="text-xs text-blue-300/70 mb-1">Reward Pool</div>
          <div className="text-lg font-bold text-white">{rewardPool} STX</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70 mb-1">Your Staked</div>
          <div className="text-2xl font-bold text-white">{stakedAmount} SNTL</div>
          {stakeInfo && parseInt(stakeInfo.blocksStaked) > 0 && (
            <div className="text-xs text-blue-400 mt-1">
              {Math.floor(parseInt(stakeInfo.blocksStaked) / 144)} days staked
            </div>
          )}
        </div>
        <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70 mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-green-400">{pendingRewards} STX</div>
          <div className="text-xs text-blue-400 mt-1">All-time rewards</div>
        </div>
        <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
          <div className="text-sm text-blue-300/70 mb-1">Available Balance</div>
          <div className="text-2xl font-bold text-white">{formatSNTL(sntlBalance)} SNTL</div>
          <div className="text-xs text-blue-400 mt-1">Ready to stake</div>
        </div>
      </div>

      {/* Estimated Rewards */}
      {parseInt(stakeInfo?.staked || '0') > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 mb-6 border border-green-500/20">
          <div className="text-sm text-green-300/70 mb-3">Estimated Rewards</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-green-300/50 mb-1">Daily</div>
              <div className="text-lg font-bold text-green-400">~{rewards.daily.toFixed(4)} STX</div>
            </div>
            <div>
              <div className="text-xs text-green-300/50 mb-1">Weekly</div>
              <div className="text-lg font-bold text-green-400">~{rewards.weekly.toFixed(4)} STX</div>
            </div>
            <div>
              <div className="text-xs text-green-300/50 mb-1">Monthly</div>
              <div className="text-lg font-bold text-green-400">~{rewards.monthly.toFixed(4)} STX</div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Status */}
      {txStatus && (
        <div className={`mb-4 p-3 rounded-lg ${
          txStatus.txId
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          {txStatus.txId ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm text-green-400 flex-1">
                {txStatus.type === 'stake' ? 'Stake' : 'Unstake'} successful!
              </span>
              <a
                href={`https://explorer.stacks.co/txid/${txStatus.txId}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                View TX
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-red-400">✗</span>
              <span className="text-sm text-red-400">{txStatus.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Stake Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stake */}
        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
          <h3 className="text-lg font-semibold text-white mb-4">Stake SNTL</h3>
          <div className="mb-4">
            <label className="block text-sm text-blue-300/70 mb-2">Amount (SNTL)</label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="1000"
              min="1000"
              className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-2 text-xs text-blue-400">
              Available: {formatSNTL(sntlBalance)} SNTL
            </div>
          </div>
          {!isConnected ? (
            <button
              onClick={() => connectWallet()}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handleStake}
              disabled={!stakeAmount || parseFloat(stakeAmount) < 1000 || staking || parseFloat(stakeAmount) > parseFloat(formatSNTL(sntlBalance))}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                !stakeAmount || parseFloat(stakeAmount) < 1000 || staking || parseFloat(stakeAmount) > parseFloat(formatSNTL(sntlBalance))
                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
              }`}
            >
              {staking ? 'Staking...' : 'Stake Tokens'}
            </button>
          )}
        </div>

        {/* Unstake */}
        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
          <h3 className="text-lg font-semibold text-white mb-4">Unstake SNTL</h3>
          <div className="mb-4">
            <label className="block text-sm text-blue-300/70 mb-2">Amount (SNTL)</label>
            <input
              type="number"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="1000"
              min="1"
              className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-2 text-xs text-blue-400">
              Staked: {stakedAmount} SNTL
            </div>
          </div>
          {!isConnected ? (
            <button
              onClick={() => connectWallet()}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handleUnstake}
              disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || unstaking || parseFloat(unstakeAmount) > parseFloat(stakedAmount) || parseInt(stakeInfo?.staked || '0') === 0}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                !unstakeAmount || parseFloat(unstakeAmount) <= 0 || unstaking || parseFloat(unstakeAmount) > parseFloat(stakedAmount) || parseInt(stakeInfo?.staked || '0') === 0
                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
              }`}
            >
              {unstaking ? 'Unstaking...' : 'Unstake & Claim Rewards'}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
        <div className="text-sm text-blue-300/70 space-y-1">
          <div>• Minimum stake: 1,000 SNTL</div>
          <div>• Rewards are distributed from the STX reward pool</div>
          <div>• 50% of token sale proceeds go to the reward pool</div>
          <div>• Unstaking claims your STX rewards automatically</div>
        </div>
      </div>
    </div>
  );
};

export default StakePanel;

