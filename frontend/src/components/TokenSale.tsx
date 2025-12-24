import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV } from '@stacks/transactions';

interface SaleInfo {
  active: boolean;
  paused: boolean;
  startBlock: number;
  endBlock: number;
  totalAmount: string;
  sold: string;
  remaining: string;
  stxCollected: string;
  tier1: {
    price: string;
    total: string;
    sold: string;
    remaining: string;
  };
  tier2: {
    price: string;
    total: string;
    sold: string;
    remaining: string;
  };
  tier3: {
    price: string;
    total: string;
    sold: string;
    remaining: string;
  };
}

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'token-sale';
const CONTRACT_OWNER = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB'; // Contract owner address

const TokenSale: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string } | null>(null);
  const [userPurchase, setUserPurchase] = useState<{ stxSpent: string; tokensPurchased: string } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [initStartBlock, setInitStartBlock] = useState<string>('');
  const [initEndBlock, setInitEndBlock] = useState<string>('');
  const [initializing, setInitializing] = useState(false);

  // Fetch sale info
  const fetchSaleInfo = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-sale-info`,
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
        // Parse Clarity response
        const result = data.result;
        setSaleInfo({
          active: result.value?.['active']?.value === 'true',
          paused: result.value?.['paused']?.value === 'true',
          startBlock: parseInt(result.value?.['start-block']?.value || '0'),
          endBlock: parseInt(result.value?.['end-block']?.value || '0'),
          totalAmount: result.value?.['total-amount']?.value || '0',
          sold: result.value?.['sold']?.value || '0',
          remaining: result.value?.['remaining']?.value || '0',
          stxCollected: result.value?.['stx-collected']?.value || '0',
          tier1: {
            price: result.value?.['tier1']?.value?.['price']?.value || '0',
            total: result.value?.['tier1']?.value?.['total']?.value || '0',
            sold: result.value?.['tier1']?.value?.['sold']?.value || '0',
            remaining: result.value?.['tier1']?.value?.['remaining']?.value || '0',
          },
          tier2: {
            price: result.value?.['tier2']?.value?.['price']?.value || '0',
            total: result.value?.['tier2']?.value?.['total']?.value || '0',
            sold: result.value?.['tier2']?.value?.['sold']?.value || '0',
            remaining: result.value?.['tier2']?.value?.['remaining']?.value || '0',
          },
          tier3: {
            price: result.value?.['tier3']?.value?.['price']?.value || '0',
            total: result.value?.['tier3']?.value?.['total']?.value || '0',
            sold: result.value?.['tier3']?.value?.['sold']?.value || '0',
            remaining: result.value?.['tier3']?.value?.['remaining']?.value || '0',
          },
        });
      }
    } catch (error) {
      console.error('Error fetching sale info:', error);
    }
  }, []);

  // Fetch user purchase info
  const fetchUserPurchase = useCallback(async () => {
    if (!userAddress) return;
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-user-purchase`,
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
        setUserPurchase({
          stxSpent: result?.['stx-spent']?.value || '0',
          tokensPurchased: result?.['tokens-purchased']?.value || '0',
        });
      }
    } catch (error) {
      console.error('Error fetching user purchase:', error);
    }
  }, [userAddress]);

  // Fetch current block height
  const fetchCurrentBlock = useCallback(async () => {
    try {
      const response = await fetch('https://api.hiro.so/v2/info');
      const data = await response.json();
      if (data.stacks_tip_height) {
        setCurrentBlock(data.stacks_tip_height);
        // Set default start block (current + 1) and end block (30 days later, ~4320 blocks)
        if (!initStartBlock) {
          setInitStartBlock((data.stacks_tip_height + 1).toString());
          setInitEndBlock((data.stacks_tip_height + 4320).toString());
        }
      }
    } catch (error) {
      console.error('Error fetching current block:', error);
    }
  }, [initStartBlock]);

  useEffect(() => {
    fetchSaleInfo();
    fetchCurrentBlock();
    const interval = setInterval(() => {
      fetchSaleInfo();
      fetchCurrentBlock();
    }, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchSaleInfo, fetchCurrentBlock]);

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchUserPurchase();
      setIsOwner(userAddress === CONTRACT_OWNER);
    } else {
      setIsOwner(false);
    }
  }, [isConnected, userAddress, fetchUserPurchase]);

  const handlePurchase = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!purchaseAmount || parseFloat(purchaseAmount) <= 0) {
      setTxStatus({ error: 'Please enter a valid amount' });
      return;
    }

    setPurchasing(true);
    setTxStatus(null);

    try {
      const stxAmount = BigInt(Math.floor(parseFloat(purchaseAmount) * 1_000_000));

      const result = await request(
        {
          walletConnect: {
            projectId: 'e5f06d0d893851277f61878bdf812cbd',
          },
        },
        'stx_callContract',
        {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'purchase-tokens',
          functionArgs: [uintCV(stxAmount.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      console.log('Purchase result:', result);

      if (result && result.txid) {
        setTxStatus({ txId: result.txid });
        setPurchaseAmount('');
        setTimeout(() => {
          fetchSaleInfo();
          fetchUserPurchase();
          setTxStatus(null);
        }, 5000);
      } else {
        setTxStatus({ error: 'Transaction failed. Please try again.' });
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      setTxStatus({
        error: error?.message || 'Failed to purchase tokens. Please check your wallet and try again.',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toLocaleString();
  };

  const formatSTX = (microStx: string) => {
    const stx = parseInt(microStx) / 1_000_000;
    return stx.toFixed(2);
  };

  // Initialize sale (owner only)
  const handleInitializeSale = async () => {
    if (!isConnected || !userAddress || !isOwner) {
      setTxStatus({ error: 'Only contract owner can initialize sale' });
      return;
    }

    if (!initStartBlock || !initEndBlock) {
      setTxStatus({ error: 'Please enter start and end block numbers' });
      return;
    }

    const startBlock = parseInt(initStartBlock);
    const endBlock = parseInt(initEndBlock);

    if (startBlock <= currentBlock || endBlock <= startBlock) {
      setTxStatus({ error: 'Invalid block numbers. Start must be > current block, end must be > start' });
      return;
    }

    setInitializing(true);
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
          functionName: 'initialize-sale',
          functionArgs: [uintCV(startBlock.toString()), uintCV(endBlock.toString())],
          postConditionMode: 'allow',
          network: 'mainnet' as any,
        }
      );

      if (result && result.txid) {
        setTxStatus({ txId: result.txid });
        setTimeout(() => {
          fetchSaleInfo();
          setTxStatus(null);
        }, 5000);
      } else {
        setTxStatus({ error: 'Transaction failed. Please try again.' });
      }
    } catch (error: any) {
      console.error('Initialize sale error:', error);
      setTxStatus({
        error: error?.message || 'Failed to initialize sale. Please check your wallet and try again.',
      });
    } finally {
      setInitializing(false);
    }
  };

  const formatSNTL = (microSntl: string) => {
    const sntl = parseInt(microSntl) / 1_000_000;
    return sntl.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const getCurrentTier = () => {
    if (!saleInfo) return null;
    if (parseInt(saleInfo.tier1.remaining) > 0) return { tier: 1, ...saleInfo.tier1 };
    if (parseInt(saleInfo.tier2.remaining) > 0) return { tier: 2, ...saleInfo.tier2 };
    return { tier: 3, ...saleInfo.tier3 };
  };

  const currentTier = getCurrentTier();
  const pricePer1000 = currentTier ? parseInt(currentTier.price) / 1_000_000 : 0;

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-orange-900/20 rounded-xl p-6 border border-purple-500/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">🪙 SNTL Token Sale</h2>
          <p className="text-sm text-purple-300/70">Purchase Sentinel tokens and stake to earn STX</p>
        </div>
        {saleInfo && (
          <div className={`px-4 py-2 rounded-lg ${
            saleInfo.active && !saleInfo.paused
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {saleInfo.active && !saleInfo.paused ? '● Active' : saleInfo.paused ? '⏸ Paused' : '● Ended'}
          </div>
        )}
      </div>

      {/* Admin Panel - Initialize Sale */}
      {isOwner && !saleInfo?.active && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-bold text-yellow-400 mb-3">🔧 Admin Panel - Initialize Sale</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-yellow-300/70 mb-1">Current Block: {currentBlock}</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-yellow-300/70 mb-1">Start Block</label>
                <input
                  type="number"
                  value={initStartBlock}
                  onChange={(e) => setInitStartBlock(e.target.value)}
                  placeholder={`${currentBlock + 1}`}
                  className="w-full bg-black/50 rounded-lg px-3 py-2 text-white border border-yellow-500/30 focus:border-yellow-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-yellow-300/70 mb-1">End Block</label>
                <input
                  type="number"
                  value={initEndBlock}
                  onChange={(e) => setInitEndBlock(e.target.value)}
                  placeholder={`${currentBlock + 4320}`}
                  className="w-full bg-black/50 rounded-lg px-3 py-2 text-white border border-yellow-500/30 focus:border-yellow-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleInitializeSale}
              disabled={initializing}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {initializing ? 'Initializing...' : 'Initialize Sale'}
            </button>
            {txStatus && (
              <div className={`p-2 rounded ${
                txStatus.txId ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {txStatus.txId ? (
                  <a
                    href={`https://explorer.stacks.co/txid/${txStatus.txId}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View Transaction
                  </a>
                ) : (
                  txStatus.error
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sale Stats */}
      {saleInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-sm text-purple-300/70 mb-1">Total Sold</div>
            <div className="text-2xl font-bold text-white">{formatSNTL(saleInfo.sold)} SNTL</div>
            <div className="text-xs text-purple-400 mt-1">
              {((parseInt(saleInfo.sold) / parseInt(saleInfo.totalAmount)) * 100).toFixed(1)}% of supply
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-sm text-purple-300/70 mb-1">STX Collected</div>
            <div className="text-2xl font-bold text-white">{formatSTX(saleInfo.stxCollected)} STX</div>
            <div className="text-xs text-purple-400 mt-1">For liquidity & rewards</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/20">
            <div className="text-sm text-purple-300/70 mb-1">Remaining</div>
            <div className="text-2xl font-bold text-white">{formatSNTL(saleInfo.remaining)} SNTL</div>
            <div className="text-xs text-purple-400 mt-1">Available for purchase</div>
          </div>
        </div>
      )}

      {/* Current Tier Info */}
      {currentTier && (
        <div className="bg-gradient-to-r from-purple-500/10 to-orange-500/10 rounded-lg p-4 mb-6 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-purple-300/70 mb-1">Current Tier: Tier {currentTier.tier}</div>
              <div className="text-lg font-bold text-white">
                {pricePer1000.toFixed(4)} STX per 1,000 SNTL
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-purple-300/70 mb-1">Remaining in Tier</div>
              <div className="text-lg font-bold text-orange-400">{formatSNTL(currentTier.remaining)} SNTL</div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Form */}
      <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20 mb-4">
        <div className="mb-4">
          <label className="block text-sm text-purple-300/70 mb-2">Amount to Spend (STX)</label>
          <input
            type="number"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
            placeholder="1.0"
            min="1"
            max="100"
            className="w-full bg-black/50 rounded-lg px-4 py-3 text-white border border-purple-500/30 focus:border-purple-500 focus:outline-none"
          />
          {purchaseAmount && currentTier && (
            <div className="mt-2 text-sm text-purple-400">
              You will receive: ~{formatSNTL((BigInt(Math.floor(parseFloat(purchaseAmount) * 1_000_000)) * BigInt(1_000_000) / BigInt(parseInt(currentTier.price))).toString())} SNTL
            </div>
          )}
        </div>

        {txStatus && (
          <div className={`mb-4 p-3 rounded-lg ${
            txStatus.txId
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {txStatus.txId ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-sm text-green-400 flex-1">Purchase successful!</span>
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

        {!isConnected ? (
          <button
            onClick={() => connectWallet()}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:from-purple-600 hover:to-orange-600 transition-all"
          >
            🔗 Connect Wallet to Purchase
          </button>
        ) : (
          <button
            onClick={handlePurchase}
            disabled={!purchaseAmount || parseFloat(purchaseAmount) <= 0 || purchasing || !saleInfo?.active || saleInfo?.paused}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              !purchaseAmount || parseFloat(purchaseAmount) <= 0 || purchasing || !saleInfo?.active || saleInfo?.paused
                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:from-purple-600 hover:to-orange-600'
            }`}
          >
            {purchasing ? 'Processing...' : 'Purchase SNTL Tokens'}
          </button>
        )}
      </div>

      {/* User Purchase Info */}
      {userPurchase && parseInt(userPurchase.tokensPurchased) > 0 && (
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
          <div className="text-sm text-green-300/70 mb-2">Your Purchase</div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-bold text-white">{formatSNTL(userPurchase.tokensPurchased)} SNTL</div>
              <div className="text-xs text-green-400">Tokens purchased</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white">{formatSTX(userPurchase.stxSpent)} STX</div>
              <div className="text-xs text-green-400">Total spent</div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Breakdown */}
      {saleInfo && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Sale Tiers</h3>
          {[
            { num: 1, tier: saleInfo.tier1 },
            { num: 2, tier: saleInfo.tier2 },
            { num: 3, tier: saleInfo.tier3 },
          ].map(({ num, tier }) => (
            <div key={num} className="bg-black/20 rounded-lg p-3 border border-purple-500/10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">Tier {num}</span>
                  <span className="text-xs text-purple-300/70">
                    {(parseInt(tier.price) / 1_000_000).toFixed(4)} STX per 1K SNTL
                  </span>
                </div>
                <div className="text-sm text-white">
                  {formatSNTL(tier.sold)} / {formatSNTL(tier.total)} sold
                </div>
              </div>
              <div className="mt-2 h-2 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-orange-500"
                  style={{
                    width: `${(parseInt(tier.sold) / parseInt(tier.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TokenSale;

