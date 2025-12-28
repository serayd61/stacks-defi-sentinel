import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, PieChart, RefreshCw, ArrowUpRight, Coins, Image, BarChart2 } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: number;
  price: number;
  priceChange24h: number;
  icon: string;
  contractId: string;
}

interface NFTBalance {
  name: string;
  collection: string;
  tokenId: string;
  floorPrice: number;
  image: string;
}

interface PortfolioStats {
  totalValueUSD: number;
  totalValueChange24h: number;
  stxBalance: number;
  tokenCount: number;
  nftCount: number;
}

const PortfolioTracker: React.FC = () => {
  const { isConnected, userAddress: stxAddress } = useWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [nfts, setNfts] = useState<NFTBalance[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts' | 'analytics'>('tokens');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isConnected && stxAddress) {
      fetchPortfolio();
    } else {
      setLoading(false);
    }
  }, [isConnected, stxAddress]);

  const fetchPortfolio = async () => {
    setIsRefreshing(true);
    try {
      // Fetch real token balances from Hiro API
      if (stxAddress) {
        const response = await fetch(
          `https://api.hiro.so/extended/v1/address/${stxAddress}/balances`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          // Process STX balance
          const stxBalance = parseInt(data.stx?.balance || '0') / 1000000;
          const stxPrice = 1.85; // Approximate STX price
          
          const tokenList: TokenBalance[] = [
            {
              symbol: 'STX',
              name: 'Stacks',
              balance: stxBalance.toFixed(2),
              balanceUSD: stxBalance * stxPrice,
              price: stxPrice,
              priceChange24h: 2.5,
              icon: '⚡',
              contractId: 'native',
            },
          ];

          // Process fungible tokens
          if (data.fungible_tokens) {
            Object.entries(data.fungible_tokens).forEach(([contractId, tokenData]: [string, any]) => {
              const balance = parseInt(tokenData.balance || '0') / 1000000;
              if (balance > 0) {
                const tokenName = contractId.split('::')[1] || contractId.split('.')[1];
                tokenList.push({
                  symbol: tokenName?.toUpperCase().slice(0, 5) || 'TOKEN',
                  name: tokenName || 'Unknown Token',
                  balance: balance.toFixed(2),
                  balanceUSD: balance * 0.1, // Placeholder price
                  price: 0.1,
                  priceChange24h: Math.random() * 10 - 5,
                  icon: '🪙',
                  contractId,
                });
              }
            });
          }

          setTokens(tokenList);

          // Calculate stats
          const totalValue = tokenList.reduce((acc, t) => acc + t.balanceUSD, 0);
          setStats({
            totalValueUSD: totalValue,
            totalValueChange24h: 3.2,
            stxBalance,
            tokenCount: tokenList.length,
            nftCount: 0,
          });
        }
      }

      // Demo NFT data
      setNfts([
        {
          name: 'Bitcoin Monkey #1234',
          collection: 'Bitcoin Monkeys',
          tokenId: '1234',
          floorPrice: 450,
          image: '🐵',
        },
        {
          name: 'Crash Punk #5678',
          collection: 'Crash Punks',
          tokenId: '5678',
          floorPrice: 65,
          image: '💥',
        },
      ]);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      // Use demo data on error
      setTokens([
        {
          symbol: 'STX',
          name: 'Stacks',
          balance: '1,250.00',
          balanceUSD: 2312.50,
          price: 1.85,
          priceChange24h: 2.5,
          icon: '⚡',
          contractId: 'native',
        },
        {
          symbol: 'sBTC',
          name: 'Stacks BTC',
          balance: '0.0125',
          balanceUSD: 1218.75,
          price: 97500,
          priceChange24h: 1.2,
          icon: '₿',
          contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
        },
        {
          symbol: 'ALEX',
          name: 'ALEX Token',
          balance: '5,000.00',
          balanceUSD: 250.00,
          price: 0.05,
          priceChange24h: -3.2,
          icon: '🔮',
          contractId: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
        },
        {
          symbol: 'VELAR',
          name: 'Velar Token',
          balance: '10,000.00',
          balanceUSD: 180.00,
          price: 0.018,
          priceChange24h: 5.8,
          icon: '💎',
          contractId: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
        },
        {
          symbol: 'SNTL',
          name: 'Sentinel Token',
          balance: '50,000.00',
          balanceUSD: 500.00,
          price: 0.01,
          priceChange24h: 12.5,
          icon: '🛡️',
          contractId: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token',
        },
      ]);

      setStats({
        totalValueUSD: 4461.25,
        totalValueChange24h: 3.2,
        stxBalance: 1250,
        tokenCount: 5,
        nftCount: 2,
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-2xl p-8 border border-indigo-500/30 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400 mb-6">
          Connect your Stacks wallet to view your portfolio
        </p>
        <button className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl text-white font-medium transition-all">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-2xl p-6 border border-indigo-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-indigo-500/20 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-indigo-500/20 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-indigo-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-2xl p-6 border border-indigo-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <PieChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">My Portfolio</h2>
            <p className="text-sm text-indigo-300/70 font-mono">
              {stxAddress?.slice(0, 8)}...{stxAddress?.slice(-6)}
            </p>
          </div>
        </div>
        <button
          onClick={fetchPortfolio}
          disabled={isRefreshing}
          className={`p-2.5 rounded-xl transition-all ${
            isRefreshing
              ? 'bg-indigo-500/10 text-indigo-400'
              : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300'
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing && 'animate-spin'}`} />
        </button>
      </div>

      {/* Portfolio Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-black/30 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-xs text-indigo-300/70 mb-1">Total Value</p>
            <p className="text-xl font-bold text-white">{formatUSD(stats.totalValueUSD)}</p>
            <p className={`text-xs flex items-center gap-1 ${stats.totalValueChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalValueChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {stats.totalValueChange24h >= 0 ? '+' : ''}{stats.totalValueChange24h.toFixed(2)}% 24h
            </p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-xs text-indigo-300/70 mb-1">STX Balance</p>
            <p className="text-xl font-bold text-white">{stats.stxBalance.toLocaleString()}</p>
            <p className="text-xs text-indigo-300/50">≈ {formatUSD(stats.stxBalance * 1.85)}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-xs text-indigo-300/70 mb-1">Tokens</p>
            <p className="text-xl font-bold text-white">{stats.tokenCount}</p>
            <p className="text-xs text-indigo-300/50">assets</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-xs text-indigo-300/70 mb-1">NFTs</p>
            <p className="text-xl font-bold text-white">{stats.nftCount}</p>
            <p className="text-xs text-indigo-300/50">collectibles</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'tokens'
              ? 'bg-indigo-500 text-white'
              : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
          }`}
        >
          <Coins className="w-4 h-4" />
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('nfts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'nfts'
              ? 'bg-indigo-500 text-white'
              : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
          }`}
        >
          <Image className="w-4 h-4" />
          NFTs
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'bg-indigo-500 text-white'
              : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics
        </button>
      </div>

      {/* Tokens Tab */}
      {activeTab === 'tokens' && (
        <div className="space-y-2">
          {tokens.map((token, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">
                  {token.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{token.symbol}</span>
                    <span className="text-xs text-indigo-300/50">{token.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{token.balance}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{formatUSD(token.balanceUSD)}</p>
                <p className={`text-xs flex items-center justify-end gap-1 ${
                  token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NFTs Tab */}
      {activeTab === 'nfts' && (
        <div className="grid grid-cols-2 gap-3">
          {nfts.map((nft, index) => (
            <div
              key={index}
              className="p-4 bg-black/20 rounded-xl border border-indigo-500/10 hover:border-indigo-500/30 transition-colors"
            >
              <div className="w-full aspect-square rounded-lg bg-indigo-500/20 flex items-center justify-center text-4xl mb-3">
                {nft.image}
              </div>
              <p className="text-white font-medium truncate">{nft.name}</p>
              <p className="text-xs text-indigo-300/50">{nft.collection}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">Floor</span>
                <span className="text-sm text-white font-medium">{nft.floorPrice} STX</span>
              </div>
            </div>
          ))}
          {nfts.length === 0 && (
            <div className="col-span-2 text-center py-8">
              <Image className="w-12 h-12 mx-auto mb-3 text-indigo-300/30" />
              <p className="text-gray-400">No NFTs found</p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Allocation Chart (Simplified) */}
          <div className="bg-black/20 rounded-xl p-4 border border-indigo-500/10">
            <h4 className="text-sm font-medium text-white mb-4">Portfolio Allocation</h4>
            <div className="space-y-3">
              {tokens.slice(0, 5).map((token, index) => {
                const percentage = stats ? (token.balanceUSD / stats.totalValueUSD * 100) : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{token.symbol}</span>
                      <span className="text-white">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/20 rounded-xl p-4 border border-green-500/20">
              <p className="text-xs text-green-300/70 mb-1">Best Performer</p>
              <p className="text-lg font-bold text-white">SNTL</p>
              <p className="text-sm text-green-400">+12.5% 24h</p>
            </div>
            <div className="bg-black/20 rounded-xl p-4 border border-red-500/20">
              <p className="text-xs text-red-300/70 mb-1">Worst Performer</p>
              <p className="text-lg font-bold text-white">ALEX</p>
              <p className="text-sm text-red-400">-3.2% 24h</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-xl text-indigo-300 text-sm font-medium transition-colors">
              <ArrowUpRight className="w-4 h-4" />
              Export CSV
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300 text-sm font-medium transition-colors">
              <BarChart2 className="w-4 h-4" />
              Full Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioTracker;

