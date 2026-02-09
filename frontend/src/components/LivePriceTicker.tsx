import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Zap, Bitcoin, Coins, DollarSign, Activity } from 'lucide-react';

interface TokenPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  sparkline: number[];
  icon: React.ReactNode;
}

const LivePriceTicker: React.FC = () => {
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPrices = async () => {
    try {
      // Fetch from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=blockstack,bitcoin,alex-lab,velar&order=market_cap_desc&sparkline=true&price_change_percentage=24h'
      );
      const data = await response.json();

      const tokenIcons: Record<string, React.ReactNode> = {
        blockstack: <Coins className="w-5 h-5 text-purple-400" />,
        bitcoin: <Bitcoin className="w-5 h-5 text-orange-400" />,
        'alex-lab': <Zap className="w-5 h-5 text-blue-400" />,
        velar: <Activity className="w-5 h-5 text-green-400" />,
      };

      const formattedPrices: TokenPrice[] = data.map((coin: any) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
        volume24h: coin.total_volume,
        marketCap: coin.market_cap,
        sparkline: coin.sparkline_in_7d?.price?.slice(-24) || [],
        icon: tokenIcons[coin.id] || <Coins className="w-5 h-5 text-gray-400" />,
      }));

      // Add sBTC (simulated based on BTC)
      const btcPrice = data.find((c: any) => c.id === 'bitcoin');
      if (btcPrice) {
        formattedPrices.splice(1, 0, {
          symbol: 'sBTC',
          name: 'Stacks Bitcoin',
          price: btcPrice.current_price * 0.9998,
          change24h: btcPrice.price_change_percentage_24h || 0,
          volume24h: btcPrice.total_volume * 0.001,
          marketCap: btcPrice.market_cap * 0.0001,
          sparkline: btcPrice.sparkline_in_7d?.price?.slice(-24) || [],
          icon: <Bitcoin className="w-5 h-5 text-orange-500" />,
        });
      }

      setPrices(formattedPrices);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  // Mini sparkline component
  const Sparkline: React.FC<{ data: number[]; positive: boolean }> = ({ data, positive }) => {
    if (!data.length) return null;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * 60;
      const y = 20 - ((val - min) / range) * 18;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="60" height="24" className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={positive ? '#22c55e' : '#ef4444'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-500/5 to-orange-500/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 bg-white/10 rounded-full" />
          <div className="h-4 w-24 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-500/5 via-transparent to-orange-500/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Scrolling ticker */}
      <div className="relative overflow-hidden">
        <div className="flex animate-scroll hover:pause-animation">
          {[...prices, ...prices].map((token, idx) => (
            <div
              key={`${token.symbol}-${idx}`}
              className="flex items-center gap-4 px-6 py-3 border-r border-white/5 min-w-fit hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {token.icon}
                <div>
                  <span className="font-semibold text-white">{token.symbol}</span>
                  <span className="text-xs text-gray-500 ml-1 hidden sm:inline">{token.name}</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-mono font-bold text-white">{formatPrice(token.price)}</div>
                <div className={`flex items-center gap-1 text-xs ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(token.change24h).toFixed(2)}%
                </div>
              </div>

              <div className="hidden md:block">
                <Sparkline data={token.sparkline} positive={token.change24h >= 0} />
              </div>

              <div className="hidden lg:block text-right">
                <div className="text-xs text-gray-500">Vol 24h</div>
                <div className="text-sm text-gray-300 font-mono">{formatVolume(token.volume24h)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Update indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Live prices
        </div>
        <div className="text-xs text-gray-600">
          Updated {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default LivePriceTicker;
