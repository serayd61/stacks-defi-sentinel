import React, { useState, useEffect } from 'react';
import { Sprout, TrendingUp, Clock, Coins, ArrowUpRight, ArrowDownRight, Wallet, Zap } from 'lucide-react';

// Yield Farming Dashboard Component
// Stake LP tokens and earn farming rewards

interface FarmPool {
  id: number;
  name: string;
  pair: string;
  tvl: number;
  apr: number;
  dailyReward: number;
  userStaked: number;
  userPending: number;
  multiplier: string;
  hot?: boolean;
}

export const YieldFarmDashboard: React.FC = () => {
  const [pools, setPools] = useState<FarmPool[]>([
    {
      id: 1,
      name: 'STX-USDA',
      pair: 'STX / USDA',
      tvl: 2450000,
      apr: 124.5,
      dailyReward: 1250,
      userStaked: 5000,
      userPending: 45.5,
      multiplier: '40x',
      hot: true
    },
    {
      id: 2,
      name: 'STX-xBTC',
      pair: 'STX / xBTC',
      tvl: 1820000,
      apr: 89.2,
      dailyReward: 980,
      userStaked: 2500,
      userPending: 22.3,
      multiplier: '30x'
    },
    {
      id: 3,
      name: 'ALEX-STX',
      pair: 'ALEX / STX',
      tvl: 980000,
      apr: 156.8,
      dailyReward: 750,
      userStaked: 0,
      userPending: 0,
      multiplier: '50x',
      hot: true
    },
    {
      id: 4,
      name: 'VELAR-STX',
      pair: 'VELAR / STX',
      tvl: 450000,
      apr: 234.5,
      dailyReward: 500,
      userStaked: 1000,
      userPending: 8.7,
      multiplier: '20x'
    }
  ]);

  const [selectedPool, setSelectedPool] = useState<FarmPool | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [action, setAction] = useState<'stake' | 'unstake'>('stake');
  const [totalEarned, setTotalEarned] = useState(234.5);
  const [totalStaked, setTotalStaked] = useState(8500);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const handleStake = (pool: FarmPool) => {
    setSelectedPool(pool);
    setAction('stake');
  };

  const handleUnstake = (pool: FarmPool) => {
    setSelectedPool(pool);
    setAction('unstake');
  };

  const handleHarvest = (poolId: number) => {
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setTotalEarned(prev => prev + pool.userPending);
      setPools(prev => prev.map(p => 
        p.id === poolId ? { ...p, userPending: 0 } : p
      ));
    }
  };

  const handleHarvestAll = () => {
    const totalPending = pools.reduce((sum, p) => sum + p.userPending, 0);
    setTotalEarned(prev => prev + totalPending);
    setPools(prev => prev.map(p => ({ ...p, userPending: 0 })));
  };

  const confirmAction = () => {
    if (!selectedPool || !stakeAmount) return;
    
    const amount = parseFloat(stakeAmount);
    
    if (action === 'stake') {
      setPools(prev => prev.map(p => 
        p.id === selectedPool.id ? { ...p, userStaked: p.userStaked + amount } : p
      ));
      setTotalStaked(prev => prev + amount);
    } else {
      setPools(prev => prev.map(p => 
        p.id === selectedPool.id ? { ...p, userStaked: Math.max(0, p.userStaked - amount) } : p
      ));
      setTotalStaked(prev => Math.max(0, prev - amount));
    }
    
    setSelectedPool(null);
    setStakeAmount('');
  };

  return (
    <div className="yield-farm-dashboard">
      {/* Header Stats */}
      <div className="farm-header">
        <div className="header-title">
          <div className="farm-icon">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h2>Yield Farming</h2>
            <p className="subtitle">Stake LP tokens, earn rewards</p>
          </div>
        </div>
        
        <div className="header-stats">
          <div className="stat-card">
            <Wallet className="w-5 h-5" />
            <div>
              <span className="stat-label">Your Staked</span>
              <span className="stat-value">{totalStaked.toLocaleString()} LP</span>
            </div>
          </div>
          <div className="stat-card highlight">
            <Coins className="w-5 h-5" />
            <div>
              <span className="stat-label">Total Earned</span>
              <span className="stat-value">{totalEarned.toFixed(2)} STX</span>
            </div>
          </div>
          <button onClick={handleHarvestAll} className="harvest-all-btn">
            <Zap className="w-4 h-4" />
            Harvest All
          </button>
        </div>
      </div>

      {/* Farm Pools */}
      <div className="pools-grid">
        {pools.map(pool => (
          <div key={pool.id} className={`pool-card ${pool.hot ? 'hot' : ''}`}>
            {pool.hot && <span className="hot-badge">🔥 HOT</span>}
            
            <div className="pool-header">
              <div className="pool-info">
                <h3>{pool.name}</h3>
                <span className="pool-pair">{pool.pair}</span>
              </div>
              <span className="multiplier-badge">{pool.multiplier}</span>
            </div>

            <div className="pool-stats">
              <div className="pool-stat">
                <span className="label">APR</span>
                <span className="value apr">{pool.apr.toFixed(1)}%</span>
              </div>
              <div className="pool-stat">
                <span className="label">TVL</span>
                <span className="value">{formatNumber(pool.tvl)}</span>
              </div>
              <div className="pool-stat">
                <span className="label">Daily</span>
                <span className="value">{pool.dailyReward} STX</span>
              </div>
            </div>

            {pool.userStaked > 0 && (
              <div className="user-position">
                <div className="position-row">
                  <span className="label">Your Stake</span>
                  <span className="value">{pool.userStaked.toLocaleString()} LP</span>
                </div>
                <div className="position-row">
                  <span className="label">Pending</span>
                  <span className="value pending">{pool.userPending.toFixed(2)} STX</span>
                </div>
              </div>
            )}

            <div className="pool-actions">
              {pool.userStaked > 0 ? (
                <>
                  <button onClick={() => handleHarvest(pool.id)} className="harvest-btn" disabled={pool.userPending === 0}>
                    <Coins className="w-4 h-4" />
                    Harvest
                  </button>
                  <button onClick={() => handleUnstake(pool)} className="unstake-btn">
                    <ArrowDownRight className="w-4 h-4" />
                    Unstake
                  </button>
                  <button onClick={() => handleStake(pool)} className="stake-btn">
                    <ArrowUpRight className="w-4 h-4" />
                    Stake
                  </button>
                </>
              ) : (
                <button onClick={() => handleStake(pool)} className="stake-btn full">
                  <ArrowUpRight className="w-4 h-4" />
                  Stake LP
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stake/Unstake Modal */}
      {selectedPool && (
        <div className="modal-overlay" onClick={() => setSelectedPool(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{action === 'stake' ? 'Stake' : 'Unstake'} {selectedPool.name}</h3>
            
            <div className="modal-info">
              <span>APR: <strong>{selectedPool.apr.toFixed(1)}%</strong></span>
              {action === 'unstake' && (
                <span>Available: <strong>{selectedPool.userStaked.toLocaleString()} LP</strong></span>
              )}
            </div>

            <div className="input-group">
              <input 
                type="number"
                placeholder="0.00"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <span className="input-suffix">LP</span>
              {action === 'unstake' && (
                <button 
                  onClick={() => setStakeAmount(selectedPool.userStaked.toString())}
                  className="max-btn"
                >
                  MAX
                </button>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedPool(null)} className="cancel-btn">Cancel</button>
              <button onClick={confirmAction} className="confirm-btn">
                {action === 'stake' ? 'Stake LP' : 'Unstake LP'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .yield-farm-dashboard {
          background: linear-gradient(180deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 22, 42, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 24px;
        }

        .farm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .farm-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .farm-header h2 {
          margin: 0;
          font-size: 20px;
          color: white;
        }

        .subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }

        .header-stats {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 12px 16px;
          color: rgba(255,255,255,0.7);
        }

        .stat-card.highlight {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10B981;
        }

        .stat-label {
          font-size: 11px;
          opacity: 0.7;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          display: block;
        }

        .harvest-all-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .harvest-all-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(245, 158, 11, 0.3);
        }

        .pools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .pool-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 20px;
          position: relative;
          transition: all 0.3s;
        }

        .pool-card:hover {
          border-color: rgba(16, 185, 129, 0.3);
          transform: translateY(-4px);
        }

        .pool-card.hot {
          border-color: rgba(245, 158, 11, 0.3);
          background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(255,255,255,0.05) 100%);
        }

        .hot-badge {
          position: absolute;
          top: -8px;
          right: 16px;
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .pool-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .pool-info h3 {
          margin: 0;
          font-size: 18px;
          color: white;
        }

        .pool-pair {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .multiplier-badge {
          background: rgba(139, 92, 246, 0.2);
          color: #A78BFA;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .pool-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .pool-stat {
          text-align: center;
        }

        .pool-stat .label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 4px;
        }

        .pool-stat .value {
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .pool-stat .value.apr {
          color: #10B981;
          font-size: 16px;
        }

        .user-position {
          background: rgba(16, 185, 129, 0.1);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .position-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .position-row:not(:last-child) {
          margin-bottom: 8px;
        }

        .position-row .label {
          color: rgba(255,255,255,0.5);
        }

        .position-row .value {
          color: white;
          font-weight: 500;
        }

        .position-row .value.pending {
          color: #F59E0B;
        }

        .pool-actions {
          display: flex;
          gap: 8px;
        }

        .pool-actions button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .harvest-btn {
          background: rgba(245, 158, 11, 0.2);
          color: #F59E0B;
        }

        .harvest-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .unstake-btn {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
        }

        .stake-btn {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .stake-btn.full {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: white;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          width: 100%;
          max-width: 400px;
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 24px;
        }

        .modal-content h3 {
          margin: 0 0 16px;
          color: white;
          text-align: center;
        }

        .modal-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }

        .input-group {
          position: relative;
          margin-bottom: 20px;
        }

        .input-group input {
          width: 100%;
          padding: 16px;
          padding-right: 80px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 18px;
          box-sizing: border-box;
        }

        .input-suffix {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.5);
        }

        .max-btn {
          position: absolute;
          right: 50px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(16, 185, 129, 0.2);
          border: none;
          color: #10B981;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        .cancel-btn {
          flex: 1;
          padding: 14px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
        }

        .confirm-btn {
          flex: 1;
          padding: 14px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default YieldFarmDashboard;

