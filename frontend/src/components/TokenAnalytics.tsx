import React, { useState, useEffect } from 'react';

interface Token {
  name: string;
  symbol: string;
  contractId: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  totalSupply: string;
  icon: string;
}

const TokenAnalytics: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume' | 'change'>('marketCap');

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokenData = async () => {
    try {
      // Fetch popular Stacks tokens
      const tokenList: Token[] = [
        {
          name: 'Stacks',
          symbol: 'STX',
          contractId: 'native',
          price: 0.24,
          priceChange24h: 2.45,
          volume24h: 45000000,
          marketCap: 350000000,
          holders: 450000,
          totalSupply: '1,818,000,000',
          icon: '🟠',
        },
        {
          name: 'ALEX',
          symbol: 'ALEX',
          contractId: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.age000-governance-token',
          price: 0.012,
          priceChange24h: -1.23,
          volume24h: 2500000,
          marketCap: 15000000,
          holders: 25000,
          totalSupply: '1,000,000,000',
          icon: '🔵',
        },
        {
          name: 'Velar',
          symbol: 'VELAR',
          contractId: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
          price: 0.008,
          priceChange24h: 5.67,
          volume24h: 1200000,
          marketCap: 8000000,
          holders: 18000,
          totalSupply: '1,000,000,000',
          icon: '🟣',
        },
        {
          name: 'USDA',
          symbol: 'USDA',
          contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
          price: 1.00,
          priceChange24h: 0.01,
          volume24h: 500000,
          marketCap: 5000000,
          holders: 8000,
          totalSupply: '5,000,000',
          icon: '💵',
        },
        {
          name: 'sBTC',
          symbol: 'sBTC',
          contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
          price: 97500,
          priceChange24h: 2.15,
          volume24h: 8500000,
          marketCap: 2100000000,
          holders: 1200,
          totalSupply: '21.5',
          icon: '₿',
        },
        {
          name: 'WELSH',
          symbol: 'WELSH',
          contractId: 'SP3NE50GEXFG9SZGTT5P3G5TJS6T6LBF3TWAQCDG3.welshcorgicoin-token',
          price: 0.000045,
          priceChange24h: 12.34,
          volume24h: 350000,
          marketCap: 4500000,
          holders: 35000,
          totalSupply: '100,000,000,000',
          icon: '🐕',
        },
        {
          name: 'NOT',
          symbol: 'NOT',
          contractId: 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
          price: 0.00002,
          priceChange24h: -5.43,
          volume24h: 180000,
          marketCap: 2000000,
          holders: 22000,
          totalSupply: '100,000,000,000',
          icon: '🚫',
        },
        {
          name: 'SENTINEL',
          symbol: 'SNTL',
          contractId: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token',
          price: 0.001,
          priceChange24h: 0,
          volume24h: 0,
          marketCap: 100000,
          holders: 1,
          totalSupply: '100,000,000',
          icon: '🛡️',
        },
      ];

      setTokens(tokenList);
    } catch (error) {
      console.error('Error fetching token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedTokens = [...tokens].sort((a, b) => {
    switch (sortBy) {
      case 'marketCap':
        return b.marketCap - a.marketCap;
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'change':
        return b.priceChange24h - a.priceChange24h;
      default:
        return 0;
    }
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString()}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(8)}`;
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 rounded-xl p-6 border border-cyan-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-cyan-500/20 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-cyan-500/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 rounded-xl p-6 border border-cyan-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-xl">
            📈
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Token Analytics</h2>
            <p className="text-sm text-cyan-300/70">Top Stacks Tokens</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['marketCap', 'volume', 'change'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === option
                  ? 'bg-cyan-500 text-white'
                  : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
              }`}
            >
              {option === 'marketCap' ? 'Market Cap' : option === 'volume' ? 'Volume' : '24h Change'}
            </button>
          ))}
        </div>
      </div>

      {/* Token List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-cyan-300/70 text-sm border-b border-cyan-500/20">
              <th className="pb-3 pl-2">#</th>
              <th className="pb-3">Token</th>
              <th className="pb-3 text-right">Price</th>
              <th className="pb-3 text-right">24h</th>
              <th className="pb-3 text-right hidden md:table-cell">Volume</th>
              <th className="pb-3 text-right hidden md:table-cell">Market Cap</th>
              <th className="pb-3 text-right hidden lg:table-cell">Holders</th>
            </tr>
          </thead>
          <tbody>
            {sortedTokens.map((token, index) => (
              <tr
                key={token.symbol}
                className="border-b border-cyan-500/10 hover:bg-cyan-500/5 transition-colors"
              >
                <td className="py-4 pl-2 text-cyan-300/50">{index + 1}</td>
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{token.icon}</span>
                    <div>
                      <p className="text-white font-medium">{token.name}</p>
                      <p className="text-sm text-cyan-300/50">{token.symbol}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 text-right">
                  <p className="text-white font-mono">{formatPrice(token.price)}</p>
                </td>
                <td className="py-4 text-right">
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${
                      token.priceChange24h >= 0
                        ? 'text-green-400 bg-green-400/10'
                        : 'text-red-400 bg-red-400/10'
                    }`}
                  >
                    {token.priceChange24h >= 0 ? '+' : ''}
                    {token.priceChange24h.toFixed(2)}%
                  </span>
                </td>
                <td className="py-4 text-right hidden md:table-cell">
                  <p className="text-cyan-300/70">{formatNumber(token.volume24h)}</p>
                </td>
                <td className="py-4 text-right hidden md:table-cell">
                  <p className="text-cyan-300/70">{formatNumber(token.marketCap)}</p>
                </td>
                <td className="py-4 text-right hidden lg:table-cell">
                  <p className="text-cyan-300/70">{token.holders.toLocaleString()}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-cyan-500/20 flex justify-between items-center">
        <p className="text-sm text-cyan-300/50">
          Data updates every minute
        </p>
        <a
          href="https://www.coingecko.com/en/categories/stacks-ecosystem"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View on CoinGecko ↗
        </a>
      </div>
    </div>
  );
};

export default TokenAnalytics;

