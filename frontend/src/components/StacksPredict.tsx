import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, cvToJSON, fetchCallReadOnlyFunction, principalCV } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';
const CONTRACT_NAME = 'stacks-predict';
const NETWORK = 'mainnet';

const PREDICT_UP = 1;
const PREDICT_DOWN = 2;

interface RoundInfo {
  startBlock: number;
  endBlock: number;
  lockPrice: number;
  closePrice: number;
  totalUpAmount: number;
  totalDownAmount: number;
  totalParticipants: number;
  isResolved: boolean;
  winningDirection: number;
  prizePool: number;
}

interface UserPrediction {
  direction: number;
  amount: number;
  claimed: boolean;
}

interface UserStats {
  totalBets: number;
  totalWins: number;
  totalWagered: number;
  totalWon: number;
  currentStreak: number;
  bestStreak: number;
}

const StacksPredict: React.FC = () => {
  const { isConnected, userAddress } = useWallet();
  const [currentRound, setCurrentRound] = useState(0);
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [userPrediction, setUserPrediction] = useState<UserPrediction | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [betAmount, setBetAmount] = useState('10');
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stxPrice, setStxPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [countdown, setCountdown] = useState('');
  const [platformStats, setPlatformStats] = useState({ totalVolume: 0, totalFees: 0 });

  // Fetch STX price from CoinGecko
  const fetchStxPrice = useCallback(async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd&include_24hr_change=true'
      );
      const data = await response.json();
      if (data.blockstack) {
        setStxPrice(data.blockstack.usd);
        setPriceChange(data.blockstack.usd_24h_change || 0);
      }
    } catch (error) {
      console.error('Error fetching STX price:', error);
    }
  }, []);

  const fetchRoundInfo = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      // Get current round
      const currentRoundResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-current-round',
        functionArgs: [],
        network: NETWORK,
        senderAddress: userAddress,
      });
      const roundData = cvToJSON(currentRoundResult);
      const roundId = parseInt(roundData.value) || 1;
      setCurrentRound(roundId);

      // Get round info
      const roundInfoResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-current-round-info',
        functionArgs: [],
        network: NETWORK,
        senderAddress: userAddress,
      });
      const roundInfoData = cvToJSON(roundInfoResult);
      
      if (roundInfoData.value) {
        const info = roundInfoData.value;
        setRoundInfo({
          startBlock: parseInt(info['start-block']?.value) || 0,
          endBlock: parseInt(info['end-block']?.value) || 0,
          lockPrice: parseInt(info['lock-price']?.value) || 0,
          closePrice: parseInt(info['close-price']?.value) || 0,
          totalUpAmount: parseInt(info['total-up-amount']?.value) || 0,
          totalDownAmount: parseInt(info['total-down-amount']?.value) || 0,
          totalParticipants: parseInt(info['total-participants']?.value) || 0,
          isResolved: info['is-resolved']?.value === true,
          winningDirection: parseInt(info['winning-direction']?.value) || 0,
          prizePool: parseInt(info['prize-pool']?.value) || 0,
        });
      }

      // Get user prediction for current round
      if (isConnected) {
        const userPredResult = await fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'get-user-prediction',
          functionArgs: [uintCV(roundId), principalCV(userAddress)],
          network: NETWORK,
          senderAddress: userAddress,
        });
        const userPredData = cvToJSON(userPredResult);
        
        if (userPredData.value) {
          const pred = userPredData.value;
          setUserPrediction({
            direction: parseInt(pred['direction']?.value) || 0,
            amount: parseInt(pred['amount']?.value) || 0,
            claimed: pred['claimed']?.value === true,
          });
        } else {
          setUserPrediction(null);
        }

        // Get user stats
        const userStatsResult = await fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'get-user-stats',
          functionArgs: [principalCV(userAddress)],
          network: NETWORK,
          senderAddress: userAddress,
        });
        const statsData = cvToJSON(userStatsResult);
        
        if (statsData.value) {
          const stats = statsData.value;
          setUserStats({
            totalBets: parseInt(stats['total-bets']?.value) || 0,
            totalWins: parseInt(stats['total-wins']?.value) || 0,
            totalWagered: parseInt(stats['total-wagered']?.value) || 0,
            totalWon: parseInt(stats['total-won']?.value) || 0,
            currentStreak: parseInt(stats['current-streak']?.value) || 0,
            bestStreak: parseInt(stats['best-streak']?.value) || 0,
          });
        }
      }

      // Get platform stats
      const platformResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-platform-stats',
        functionArgs: [],
        network: NETWORK,
        senderAddress: userAddress,
      });
      const platformData = cvToJSON(platformResult);
      
      if (platformData.value) {
        setPlatformStats({
          totalVolume: parseInt(platformData.value['total-volume']?.value) || 0,
          totalFees: parseInt(platformData.value['total-fees']?.value) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching round info:', error);
    }
  }, [userAddress, isConnected]);

  useEffect(() => {
    fetchStxPrice();
    fetchRoundInfo();
    
    const priceInterval = setInterval(fetchStxPrice, 30000);
    const roundInterval = setInterval(fetchRoundInfo, 60000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(roundInterval);
    };
  }, [fetchStxPrice, fetchRoundInfo]);

  // Countdown timer
  useEffect(() => {
    if (!roundInfo) return;
    
    const updateCountdown = () => {
      const currentBlock = Math.floor(Date.now() / 600000); // Approximate block
      const blocksRemaining = roundInfo.endBlock - currentBlock;
      
      if (blocksRemaining <= 0) {
        setCountdown('Round Ended');
      } else {
        const minutes = blocksRemaining * 10;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        setCountdown(`${hours}h ${mins}m`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [roundInfo]);

  const handlePredict = async (direction: number) => {
    if (!isConnected) return;
    
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 1) {
      alert('Minimum bet is 1 STX');
      return;
    }
    
    setLoading(true);
    setSelectedDirection(direction);
    
    try {
      await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'predict',
          functionArgs: [uintCV(direction), uintCV(Math.floor(amount * 1000000))],
          postConditionMode: 'allow',
        }
      );
      
      setTimeout(() => {
        fetchRoundInfo();
      }, 3000);
    } catch (error) {
      console.error('Error placing prediction:', error);
    } finally {
      setLoading(false);
      setSelectedDirection(null);
    }
  };

  const handleClaimWinnings = async () => {
    if (!isConnected || !currentRound) return;
    
    setLoading(true);
    
    try {
      await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'claim-winnings',
          functionArgs: [uintCV(currentRound)],
          postConditionMode: 'allow',
        }
      );
      
      setTimeout(() => {
        fetchRoundInfo();
      }, 3000);
    } catch (error) {
      console.error('Error claiming winnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSTX = (microStx: number) => {
    return (microStx / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const upPercentage = roundInfo 
    ? (roundInfo.totalUpAmount + roundInfo.totalDownAmount) > 0
      ? (roundInfo.totalUpAmount / (roundInfo.totalUpAmount + roundInfo.totalDownAmount)) * 100
      : 50
    : 50;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0f0f2f 100%)',
      borderRadius: '20px',
      padding: '30px',
      margin: '20px 0',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: 0,
            background: 'linear-gradient(90deg, #00FF7F, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            🎲 StacksPredict
          </h2>
          <p style={{ color: '#888', margin: '5px 0 0 0' }}>
            Predict STX price movement and win!
          </p>
        </div>

        {/* Live Price */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '15px 25px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '5px' }}>STX Price</div>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: 'bold',
            color: priceChange >= 0 ? '#00FF7F' : '#FF4757',
          }}>
            ${stxPrice.toFixed(4)}
          </div>
          <div style={{
            color: priceChange >= 0 ? '#00FF7F' : '#FF4757',
            fontSize: '14px',
          }}>
            {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px',
        marginBottom: '30px',
      }}>
        <div style={{
          background: 'rgba(0,255,127,0.1)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#00FF7F', fontSize: '20px', fontWeight: 'bold' }}>
            {formatSTX(platformStats.totalVolume)} STX
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>Total Volume</div>
        </div>
        <div style={{
          background: 'rgba(0,212,255,0.1)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#00D4FF', fontSize: '20px', fontWeight: 'bold' }}>
            #{currentRound}
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>Current Round</div>
        </div>
        <div style={{
          background: 'rgba(255,215,0,0.1)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>
            {countdown}
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>Time Left</div>
        </div>
        <div style={{
          background: 'rgba(147,51,234,0.1)',
          padding: '15px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#9333ea', fontSize: '20px', fontWeight: 'bold' }}>
            {roundInfo?.totalParticipants || 0}
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>Players</div>
        </div>
      </div>

      {/* Main Prediction Card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '16px',
        padding: '25px',
        marginBottom: '25px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>
            Round #{currentRound} Prize Pool
          </h3>
          <div style={{
            fontSize: '36px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {formatSTX(roundInfo?.prizePool || 0)} STX
          </div>
        </div>

        {/* Odds Bar */}
        <div style={{ marginBottom: '25px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: '#00FF7F' }}>
              📈 UP: {formatSTX(roundInfo?.totalUpAmount || 0)} STX
            </span>
            <span style={{ color: '#FF4757' }}>
              📉 DOWN: {formatSTX(roundInfo?.totalDownAmount || 0)} STX
            </span>
          </div>
          <div style={{
            height: '12px',
            background: '#1a1a2e',
            borderRadius: '6px',
            overflow: 'hidden',
            display: 'flex',
          }}>
            <div style={{
              width: `${upPercentage}%`,
              background: 'linear-gradient(90deg, #00FF7F, #00D4FF)',
              transition: 'width 0.5s ease',
            }} />
            <div style={{
              width: `${100 - upPercentage}%`,
              background: 'linear-gradient(90deg, #FF4757, #FF6B6B)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '5px',
            fontSize: '12px',
            color: '#888',
          }}>
            <span>{upPercentage.toFixed(1)}%</span>
            <span>{(100 - upPercentage).toFixed(1)}%</span>
          </div>
        </div>

        {!isConnected ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔐</div>
            <p style={{ color: '#888' }}>Connect your wallet to place predictions</p>
          </div>
        ) : userPrediction ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            background: userPrediction.direction === PREDICT_UP 
              ? 'rgba(0,255,127,0.1)' 
              : 'rgba(255,71,87,0.1)',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>
              {userPrediction.direction === PREDICT_UP ? '📈' : '📉'}
            </div>
            <div style={{ color: '#fff', fontSize: '18px', marginBottom: '5px' }}>
              Your Prediction: <strong>{userPrediction.direction === PREDICT_UP ? 'UP' : 'DOWN'}</strong>
            </div>
            <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}>
              {formatSTX(userPrediction.amount)} STX
            </div>
            {roundInfo?.isResolved && !userPrediction.claimed && (
              <button
                onClick={handleClaimWinnings}
                disabled={loading}
                style={{
                  marginTop: '15px',
                  padding: '12px 30px',
                  borderRadius: '10px',
                  border: 'none',
                  background: userPrediction.direction === roundInfo.winningDirection
                    ? 'linear-gradient(90deg, #00FF7F, #00D4FF)'
                    : 'rgba(255,255,255,0.1)',
                  color: userPrediction.direction === roundInfo.winningDirection ? '#000' : '#666',
                  fontWeight: 'bold',
                  cursor: userPrediction.direction === roundInfo.winningDirection ? 'pointer' : 'not-allowed',
                }}
              >
                {userPrediction.direction === roundInfo.winningDirection 
                  ? '🎉 Claim Winnings!' 
                  : '❌ Better luck next time'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Bet Amount */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#888', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                Bet Amount (STX)
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  min="1"
                  style={{
                    flex: 1,
                    padding: '15px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '18px',
                  }}
                />
                {[5, 10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt.toString())}
                    style={{
                      padding: '15px 20px',
                      borderRadius: '10px',
                      border: betAmount === amt.toString() 
                        ? '2px solid #00D4FF' 
                        : '1px solid rgba(255,255,255,0.1)',
                      background: betAmount === amt.toString()
                        ? 'rgba(0,212,255,0.2)'
                        : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Prediction Buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px',
            }}>
              <button
                onClick={() => handlePredict(PREDICT_UP)}
                disabled={loading}
                style={{
                  padding: '25px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #00FF7F, #00D4FF)',
                  color: '#000',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: loading && selectedDirection === PREDICT_UP ? 0.7 : 1,
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📈</div>
                {loading && selectedDirection === PREDICT_UP ? 'Placing...' : 'PREDICT UP'}
              </button>
              <button
                onClick={() => handlePredict(PREDICT_DOWN)}
                disabled={loading}
                style={{
                  padding: '25px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #FF4757, #FF6B6B)',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: loading && selectedDirection === PREDICT_DOWN ? 0.7 : 1,
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📉</div>
                {loading && selectedDirection === PREDICT_DOWN ? 'Placing...' : 'PREDICT DOWN'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* User Stats */}
      {isConnected && userStats && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <h4 style={{ color: '#FFD700', margin: '0 0 15px 0' }}>📊 Your Stats</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '15px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                {userStats.totalBets}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Total Bets</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#00FF7F', fontSize: '20px', fontWeight: 'bold' }}>
                {userStats.totalWins}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Wins</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#00D4FF', fontSize: '20px', fontWeight: 'bold' }}>
                {userStats.totalBets > 0 
                  ? ((userStats.totalWins / userStats.totalBets) * 100).toFixed(1) 
                  : 0}%
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Win Rate</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>
                {formatSTX(userStats.totalWon)} STX
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Total Won</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#9333ea', fontSize: '20px', fontWeight: 'bold' }}>
                🔥 {userStats.currentStreak}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Current Streak</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#FF6B6B', fontSize: '20px', fontWeight: 'bold' }}>
                👑 {userStats.bestStreak}
              </div>
              <div style={{ color: '#888', fontSize: '12px' }}>Best Streak</div>
            </div>
          </div>
        </div>
      )}

      {/* How it Works */}
      <div style={{
        marginTop: '25px',
        padding: '20px',
        background: 'rgba(0,212,255,0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(0,212,255,0.2)',
      }}>
        <h4 style={{ color: '#00D4FF', margin: '0 0 10px 0' }}>🎮 How it Works</h4>
        <div style={{ color: '#888', fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 10px 0' }}>
            1. <strong style={{ color: '#fff' }}>Choose a direction</strong> - Predict if STX price will go UP or DOWN by round end
          </p>
          <p style={{ margin: '0 0 10px 0' }}>
            2. <strong style={{ color: '#fff' }}>Place your bet</strong> - Minimum 1 STX, no maximum
          </p>
          <p style={{ margin: '0' }}>
            3. <strong style={{ color: '#fff' }}>Win the pool!</strong> - Winners share the entire pool proportionally (3% platform fee)
          </p>
        </div>
      </div>
    </div>
  );
};

export default StacksPredict;

