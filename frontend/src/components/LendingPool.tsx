import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, cvToJSON, hexToCV, principalCV } from '@stacks/transactions';

interface ProtocolInfo {
  paused: boolean;
  minCollateral: string;
  maxLtv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  interestRate: number;
  stxPrice: string;
  sntlPrice: string;
  totalCollateral: string;
  totalBorrowed: string;
  totalLoans: number;
}

interface UserLoan {
  collateralAmount: string;
  borrowedAmount: string;
  borrowBlock: number;
  accruedInterest: string;
}

interface UserStats {
  totalBorrowed: string;
  totalRepaid: string;
  totalLiquidated: string;
  loanCount: number;
}

const CONTRACT_ADDRESS = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';
const CONTRACT_NAME = 'sentinel-lending';

const LendingPool: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [protocolInfo, setProtocolInfo] = useState<ProtocolInfo | null>(null);
  const [userLoan, setUserLoan] = useState<UserLoan | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [healthFactor, setHealthFactor] = useState<number>(0);
  
  // Form states
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [borrowAmount, setBorrowAmount] = useState<string>('');
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [addCollateralAmount, setAddCollateralAmount] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'borrow' | 'repay' | 'add'>('borrow');

  // Fetch protocol info
  const fetchProtocolInfo = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-protocol-info`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: CONTRACT_ADDRESS,
            arguments: [],
          }),
        }
      );
      const data = await response.json();
      
      if (data.okay && data.result) {
        const cv = hexToCV(data.result);
        const result = cvToJSON(cv);
        const getValue = (key: string) => result?.value?.[key]?.value ?? '0';
        
        setProtocolInfo({
          paused: getValue('paused') === true,
          minCollateral: getValue('min-collateral'),
          maxLtv: parseInt(getValue('max-ltv')),
          liquidationThreshold: parseInt(getValue('liquidation-threshold')),
          liquidationBonus: parseInt(getValue('liquidation-bonus')),
          interestRate: parseInt(getValue('interest-rate')),
          stxPrice: getValue('stx-price'),
          sntlPrice: getValue('sntl-price'),
          totalCollateral: getValue('total-collateral'),
          totalBorrowed: getValue('total-borrowed'),
          totalLoans: parseInt(getValue('total-loans')),
        });
      }
    } catch (error) {
      console.error('Error fetching protocol info:', error);
    }
  }, []);

  // Fetch user loan
  const fetchUserLoan = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-loan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: userAddress,
            arguments: [cvToJSON(principalCV(userAddress)).value],
          }),
        }
      );
      const data = await response.json();
      
      if (data.okay && data.result) {
        const cv = hexToCV(data.result);
        const result = cvToJSON(cv);
        
        if (result?.value) {
          const getValue = (key: string) => result?.value?.[key]?.value ?? '0';
          setUserLoan({
            collateralAmount: getValue('collateral-amount'),
            borrowedAmount: getValue('borrowed-amount'),
            borrowBlock: parseInt(getValue('borrow-block')),
            accruedInterest: getValue('accrued-interest'),
          });
        } else {
          setUserLoan(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user loan:', error);
    }
  }, [userAddress]);

  // Fetch health factor
  const fetchHealthFactor = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-health-factor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: userAddress,
            arguments: [cvToJSON(principalCV(userAddress)).value],
          }),
        }
      );
      const data = await response.json();
      
      if (data.okay && data.result) {
        const cv = hexToCV(data.result);
        const result = cvToJSON(cv);
        setHealthFactor(parseInt(result?.value ?? '0'));
      }
    } catch (error) {
      console.error('Error fetching health factor:', error);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchProtocolInfo();
    const interval = setInterval(fetchProtocolInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchProtocolInfo]);

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchUserLoan();
      fetchHealthFactor();
    }
  }, [isConnected, userAddress, fetchUserLoan, fetchHealthFactor]);

  // Calculate max borrow based on collateral
  const calculateMaxBorrow = (collateralStx: number) => {
    if (!protocolInfo) return 0;
    const collateralValue = (collateralStx * parseInt(protocolInfo.stxPrice)) / 1_000_000;
    const maxBorrowValue = (collateralValue * protocolInfo.maxLtv) / 10000;
    const sntlAmount = (maxBorrowValue * 1_000_000) / parseInt(protocolInfo.sntlPrice || '1');
    return sntlAmount;
  };

  // Handle borrow
  const handleBorrow = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!collateralAmount || !borrowAmount) {
      setTxStatus({ error: 'Please enter collateral and borrow amounts' });
      return;
    }

    setLoading(true);
    setTxStatus(null);

    try {
      const collateralMicro = BigInt(Math.floor(parseFloat(collateralAmount) * 1_000_000));
      const borrowMicro = BigInt(Math.floor(parseFloat(borrowAmount) * 1_000_000));

      const result = await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'borrow',
          functionArgs: [uintCV(collateralMicro.toString()), uintCV(borrowMicro.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      if (result?.txid) {
        setTxStatus({ txId: result.txid });
        setCollateralAmount('');
        setBorrowAmount('');
        setTimeout(() => {
          fetchProtocolInfo();
          fetchUserLoan();
          fetchHealthFactor();
        }, 5000);
      }
    } catch (error: any) {
      setTxStatus({ error: error?.message || 'Borrow failed' });
    } finally {
      setLoading(false);
    }
  };

  // Handle add collateral
  const handleAddCollateral = async () => {
    if (!isConnected || !userAddress || !addCollateralAmount) return;

    setLoading(true);
    setTxStatus(null);

    try {
      const amount = BigInt(Math.floor(parseFloat(addCollateralAmount) * 1_000_000));

      const result = await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'add-collateral',
          functionArgs: [uintCV(amount.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      if (result?.txid) {
        setTxStatus({ txId: result.txid });
        setAddCollateralAmount('');
        setTimeout(() => {
          fetchUserLoan();
          fetchHealthFactor();
        }, 5000);
      }
    } catch (error: any) {
      setTxStatus({ error: error?.message || 'Add collateral failed' });
    } finally {
      setLoading(false);
    }
  };

  // Handle repay
  const handleRepay = async () => {
    if (!isConnected || !userAddress || !repayAmount) return;

    setLoading(true);
    setTxStatus(null);

    try {
      const amount = BigInt(Math.floor(parseFloat(repayAmount) * 1_000_000));

      const result = await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'record-repayment',
          functionArgs: [uintCV(amount.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      if (result?.txid) {
        setTxStatus({ txId: result.txid });
        setRepayAmount('');
        setTimeout(() => {
          fetchUserLoan();
          fetchHealthFactor();
        }, 5000);
      }
    } catch (error: any) {
      setTxStatus({ error: error?.message || 'Repay failed' });
    } finally {
      setLoading(false);
    }
  };

  const formatSTX = (micro: string) => (parseInt(micro) / 1_000_000).toFixed(2);
  const formatSNTL = (micro: string) => (parseInt(micro) / 1_000_000).toLocaleString();
  const formatPercent = (bps: number) => (bps / 100).toFixed(2);

  const getHealthColor = (hf: number) => {
    if (hf >= 15000) return 'text-green-400';
    if (hf >= 10000) return 'text-yellow-400';
    if (hf >= 8500) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthStatus = (hf: number) => {
    if (hf >= 15000) return 'Excellent';
    if (hf >= 10000) return 'Good';
    if (hf >= 8500) return 'At Risk';
    return 'Liquidatable!';
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-xl p-6 border border-blue-500/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">🏦 Lending Protocol</h2>
          <p className="text-sm text-blue-300/70">Deposit STX as collateral, borrow SNTL tokens</p>
        </div>
        {protocolInfo && (
          <div className={`px-4 py-2 rounded-lg ${
            !protocolInfo.paused
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {!protocolInfo.paused ? '● Active' : '⏸ Paused'}
          </div>
        )}
      </div>

      {/* Protocol Stats */}
      {protocolInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-sm text-blue-300/70 mb-1">Total Collateral</div>
            <div className="text-xl font-bold text-white">{formatSTX(protocolInfo.totalCollateral)} STX</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-sm text-blue-300/70 mb-1">Total Borrowed</div>
            <div className="text-xl font-bold text-white">{formatSNTL(protocolInfo.totalBorrowed)} SNTL</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-sm text-blue-300/70 mb-1">Max LTV</div>
            <div className="text-xl font-bold text-cyan-400">{formatPercent(protocolInfo.maxLtv)}%</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-sm text-blue-300/70 mb-1">Interest Rate</div>
            <div className="text-xl font-bold text-yellow-400">{formatPercent(protocolInfo.interestRate)}% APR</div>
          </div>
        </div>
      )}

      {/* User Loan Status */}
      {isConnected && userLoan && (
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-4 mb-6 border border-blue-500/20">
          <h3 className="text-lg font-bold text-white mb-3">📊 Your Active Loan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-blue-300/70">Collateral</div>
              <div className="text-lg font-bold text-white">{formatSTX(userLoan.collateralAmount)} STX</div>
            </div>
            <div>
              <div className="text-sm text-blue-300/70">Borrowed</div>
              <div className="text-lg font-bold text-white">{formatSNTL(userLoan.borrowedAmount)} SNTL</div>
            </div>
            <div>
              <div className="text-sm text-blue-300/70">Interest Owed</div>
              <div className="text-lg font-bold text-yellow-400">{formatSNTL(userLoan.accruedInterest)} SNTL</div>
            </div>
            <div>
              <div className="text-sm text-blue-300/70">Health Factor</div>
              <div className={`text-lg font-bold ${getHealthColor(healthFactor)}`}>
                {(healthFactor / 100).toFixed(2)}% - {getHealthStatus(healthFactor)}
              </div>
            </div>
          </div>
          
          {/* Health Bar */}
          <div className="mt-4">
            <div className="h-3 bg-black/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  healthFactor >= 10000 ? 'bg-gradient-to-r from-green-500 to-cyan-500' :
                  healthFactor >= 8500 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-red-500 to-pink-500'
                }`}
                style={{ width: `${Math.min(100, healthFactor / 200)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-red-400">Liquidation (85%)</span>
              <span className="text-green-400">Safe (100%+)</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Tabs */}
      <div className="flex gap-2 mb-4">
        {['borrow', 'repay', 'add'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-black/30 text-blue-300 hover:bg-blue-500/20'
            }`}
          >
            {tab === 'borrow' ? '💰 Borrow' : tab === 'repay' ? '💸 Repay' : '➕ Add Collateral'}
          </button>
        ))}
      </div>

      {/* Borrow Form */}
      {activeTab === 'borrow' && (
        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-blue-300/70 mb-2">Collateral (STX)</label>
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                placeholder="10.0"
                min="1"
                className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-300/70 mb-2">Borrow (SNTL)</label>
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="1000"
                className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          
          {collateralAmount && protocolInfo && (
            <div className="text-sm text-blue-400 mb-4">
              Max borrowable: ~{calculateMaxBorrow(parseFloat(collateralAmount)).toLocaleString()} SNTL (at {formatPercent(protocolInfo.maxLtv)}% LTV)
            </div>
          )}

          {!isConnected ? (
            <button
              onClick={() => connectWallet()}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <button
              onClick={handleBorrow}
              disabled={loading || !collateralAmount || !borrowAmount || userLoan !== null}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                loading || !collateralAmount || !borrowAmount || userLoan !== null
                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
              }`}
            >
              {loading ? 'Processing...' : userLoan ? 'Already have active loan' : '💰 Deposit & Borrow'}
            </button>
          )}
        </div>
      )}

      {/* Repay Form */}
      {activeTab === 'repay' && (
        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
          <div className="mb-4">
            <label className="block text-sm text-blue-300/70 mb-2">Repay Amount (SNTL)</label>
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="1000"
              className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
            {userLoan && (
              <div className="text-sm text-blue-400 mt-2">
                Total owed: {formatSNTL((parseInt(userLoan.borrowedAmount) + parseInt(userLoan.accruedInterest)).toString())} SNTL
              </div>
            )}
          </div>
          
          <button
            onClick={handleRepay}
            disabled={loading || !repayAmount || !userLoan}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              loading || !repayAmount || !userLoan
                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
            }`}
          >
            {loading ? 'Processing...' : '💸 Repay Loan'}
          </button>
        </div>
      )}

      {/* Add Collateral Form */}
      {activeTab === 'add' && (
        <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
          <div className="mb-4">
            <label className="block text-sm text-blue-300/70 mb-2">Additional Collateral (STX)</label>
            <input
              type="number"
              value={addCollateralAmount}
              onChange={(e) => setAddCollateralAmount(e.target.value)}
              placeholder="5.0"
              className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <button
            onClick={handleAddCollateral}
            disabled={loading || !addCollateralAmount || !userLoan}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              loading || !addCollateralAmount || !userLoan
                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
            }`}
          >
            {loading ? 'Processing...' : '➕ Add Collateral'}
          </button>
        </div>
      )}

      {/* Transaction Status */}
      {txStatus && (
        <div className={`mt-4 p-3 rounded-lg ${
          txStatus.txId
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          {txStatus.txId ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm text-green-400 flex-1">Transaction submitted!</span>
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

      {/* Protocol Parameters */}
      {protocolInfo && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/20 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-300/70">Min Collateral</div>
            <div className="text-sm font-bold text-white">{formatSTX(protocolInfo.minCollateral)} STX</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-300/70">Liquidation Threshold</div>
            <div className="text-sm font-bold text-orange-400">{formatPercent(protocolInfo.liquidationThreshold)}%</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-300/70">Liquidation Bonus</div>
            <div className="text-sm font-bold text-green-400">{formatPercent(protocolInfo.liquidationBonus)}%</div>
          </div>
          <div className="bg-black/20 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-300/70">Active Loans</div>
            <div className="text-sm font-bold text-white">{protocolInfo.totalLoans}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LendingPool;

