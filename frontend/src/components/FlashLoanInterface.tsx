import React, { useState } from 'react';
import { Zap, Info, AlertTriangle, ArrowRight, Clock, DollarSign, Percent, Activity } from 'lucide-react';

// Flash Loan Interface Component
// Execute uncollateralized loans within a single transaction

interface LoanHistory {
  id: number;
  amount: number;
  fee: number;
  purpose: string;
  status: 'success' | 'failed';
  timestamp: string;
  txHash: string;
}

export const FlashLoanInterface: React.FC = () => {
  const [loanAmount, setLoanAmount] = useState('');
  const [purpose, setPurpose] = useState<'arbitrage' | 'liquidation' | 'collateral-swap' | 'custom'>('arbitrage');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [stats, setStats] = useState({
    availableLiquidity: 1250000,
    flashFee: 0.09,
    totalLoans: 1847,
    totalVolume: 45600000
  });

  const [history, setHistory] = useState<LoanHistory[]>([
    {
      id: 1,
      amount: 50000,
      fee: 45,
      purpose: 'Arbitrage',
      status: 'success',
      timestamp: '2024-12-30T12:30:00Z',
      txHash: '0x1234...5678'
    },
    {
      id: 2,
      amount: 100000,
      fee: 90,
      purpose: 'Liquidation',
      status: 'success',
      timestamp: '2024-12-30T11:15:00Z',
      txHash: '0x9abc...def0'
    },
    {
      id: 3,
      amount: 25000,
      fee: 22.5,
      purpose: 'Collateral Swap',
      status: 'failed',
      timestamp: '2024-12-30T10:00:00Z',
      txHash: '0xfedc...ba98'
    }
  ]);

  const calculateFee = () => {
    const amount = parseFloat(loanAmount) || 0;
    return (amount * stats.flashFee / 100).toFixed(2);
  };

  const calculateTotal = () => {
    const amount = parseFloat(loanAmount) || 0;
    const fee = amount * stats.flashFee / 100;
    return (amount + fee).toFixed(2);
  };

  const handleExecuteLoan = async () => {
    if (!loanAmount || parseFloat(loanAmount) <= 0) return;
    
    setIsLoading(true);
    
    // Simulate loan execution
    setTimeout(() => {
      const amount = parseFloat(loanAmount);
      const fee = amount * stats.flashFee / 100;
      
      const newLoan: LoanHistory = {
        id: history.length + 1,
        amount,
        fee,
        purpose: purpose.charAt(0).toUpperCase() + purpose.slice(1).replace('-', ' '),
        status: Math.random() > 0.1 ? 'success' : 'failed',
        timestamp: new Date().toISOString(),
        txHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`
      };
      
      setHistory(prev => [newLoan, ...prev]);
      setStats(prev => ({
        ...prev,
        totalLoans: prev.totalLoans + 1,
        totalVolume: prev.totalVolume + amount
      }));
      setLoanAmount('');
      setIsLoading(false);
    }, 2000);
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="flash-loan-interface">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="flash-icon">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2>Flash Loans</h2>
            <p className="subtitle">Borrow without collateral</p>
          </div>
        </div>
        <div className="header-badge">
          <Activity className="w-4 h-4" />
          <span>Live</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <DollarSign className="w-5 h-5" />
          <div>
            <span className="stat-label">Available Liquidity</span>
            <span className="stat-value">${formatNumber(stats.availableLiquidity)}</span>
          </div>
        </div>
        <div className="stat-card">
          <Percent className="w-5 h-5" />
          <div>
            <span className="stat-label">Flash Fee</span>
            <span className="stat-value">{stats.flashFee}%</span>
          </div>
        </div>
        <div className="stat-card">
          <Activity className="w-5 h-5" />
          <div>
            <span className="stat-label">Total Loans</span>
            <span className="stat-value">{formatNumber(stats.totalLoans)}</span>
          </div>
        </div>
        <div className="stat-card">
          <DollarSign className="w-5 h-5" />
          <div>
            <span className="stat-label">Total Volume</span>
            <span className="stat-value">${formatNumber(stats.totalVolume)}</span>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="warning-box">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <strong>Important:</strong> Flash loans must be repaid within the same transaction. 
          Failure to repay will revert the entire transaction.
        </div>
      </div>

      {/* Loan Form */}
      <div className="loan-form">
        <div className="form-section">
          <label>Loan Amount (STX)</label>
          <div className="input-wrapper">
            <input 
              type="number"
              placeholder="0.00"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
            />
            <button 
              onClick={() => setLoanAmount(stats.availableLiquidity.toString())}
              className="max-btn"
            >
              MAX
            </button>
          </div>
          <span className="input-hint">Max: {formatNumber(stats.availableLiquidity)} STX</span>
        </div>

        <div className="form-section">
          <label>Purpose</label>
          <div className="purpose-grid">
            {[
              { id: 'arbitrage', label: 'Arbitrage', icon: '📈' },
              { id: 'liquidation', label: 'Liquidation', icon: '⚡' },
              { id: 'collateral-swap', label: 'Collateral Swap', icon: '🔄' },
              { id: 'custom', label: 'Custom', icon: '⚙️' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPurpose(item.id as any)}
                className={`purpose-btn ${purpose === item.id ? 'active' : ''}`}
              >
                <span className="purpose-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="fee-breakdown">
          <div className="fee-row">
            <span>Loan Amount</span>
            <span>{parseFloat(loanAmount || '0').toLocaleString()} STX</span>
          </div>
          <div className="fee-row">
            <span>Flash Fee ({stats.flashFee}%)</span>
            <span>{calculateFee()} STX</span>
          </div>
          <div className="fee-row total">
            <span>Total to Repay</span>
            <span>{calculateTotal()} STX</span>
          </div>
        </div>

        <button 
          onClick={handleExecuteLoan}
          disabled={!loanAmount || parseFloat(loanAmount) <= 0 || isLoading}
          className="execute-btn"
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Execute Flash Loan
            </>
          )}
        </button>
      </div>

      {/* Loan History */}
      <div className="history-section">
        <h3><Clock className="w-4 h-4" /> Recent Flash Loans</h3>
        <div className="history-list">
          {history.map(loan => (
            <div key={loan.id} className={`history-item ${loan.status}`}>
              <div className="history-main">
                <div className="history-amount">
                  <span className="amount">{loan.amount.toLocaleString()} STX</span>
                  <span className="purpose">{loan.purpose}</span>
                </div>
                <div className="history-fee">
                  <span className="fee-label">Fee:</span>
                  <span className="fee-value">{loan.fee} STX</span>
                </div>
              </div>
              <div className="history-meta">
                <span className={`status-badge ${loan.status}`}>
                  {loan.status === 'success' ? '✓ Success' : '✗ Failed'}
                </span>
                <span className="tx-hash">{loan.txHash}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .flash-loan-interface {
          background: linear-gradient(180deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 22, 42, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 24px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .flash-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .header h2 {
          margin: 0;
          font-size: 20px;
          color: white;
        }

        .subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }

        .header-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 20px;
          color: #10B981;
          font-size: 13px;
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 14px;
          color: rgba(255,255,255,0.7);
        }

        .stat-label {
          font-size: 11px;
          opacity: 0.7;
          display: block;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: white;
          display: block;
        }

        .warning-box {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 24px;
          color: #F59E0B;
          font-size: 13px;
        }

        .loan-form {
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .form-section {
          margin-bottom: 20px;
        }

        .form-section label {
          display: block;
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
        }

        .input-wrapper input {
          width: 100%;
          padding: 16px;
          padding-right: 70px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 18px;
          box-sizing: border-box;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: #F59E0B;
        }

        .max-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(245, 158, 11, 0.2);
          border: none;
          color: #F59E0B;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .input-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          margin-top: 6px;
          display: block;
        }

        .purpose-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .purpose-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .purpose-btn:hover {
          border-color: rgba(245, 158, 11, 0.3);
        }

        .purpose-btn.active {
          background: rgba(245, 158, 11, 0.1);
          border-color: #F59E0B;
          color: #F59E0B;
        }

        .purpose-icon {
          font-size: 20px;
        }

        .fee-breakdown {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .fee-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          padding: 8px 0;
        }

        .fee-row.total {
          border-top: 1px solid rgba(255,255,255,0.1);
          margin-top: 8px;
          padding-top: 16px;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .execute-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .execute-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(245, 158, 11, 0.3);
        }

        .execute-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .history-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-item {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 14px;
        }

        .history-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .history-amount .amount {
          font-size: 16px;
          font-weight: 600;
          color: white;
          display: block;
        }

        .history-amount .purpose {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .history-fee {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }

        .fee-value {
          color: #F59E0B;
          font-weight: 500;
        }

        .history-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-badge {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 20px;
        }

        .status-badge.success {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .status-badge.failed {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
        }

        .tx-hash {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          font-family: monospace;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .purpose-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default FlashLoanInterface;

