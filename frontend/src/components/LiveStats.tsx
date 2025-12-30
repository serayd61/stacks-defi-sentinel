import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

interface LiveStatsProps {
  data: {
    stxPrice: number;
    stxChange24h: number;
    btcPrice: number;
    btcChange24h: number;
    gasPrice: number;
    blockHeight: number;
  };
}

const LiveStats: React.FC<LiveStatsProps> = ({ data }) => {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setLastUpdate(new Date());
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(timer);
  }, [data]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="flex items-center gap-4 overflow-x-auto py-2 px-4 bg-[#0d0d14]/80 backdrop-blur-xl border-b border-white/5">
      {/* Live Indicator */}
      <div className="flex items-center gap-2 pr-4 border-r border-white/10">
        <span className="relative flex h-2 w-2">
          <span className={`${pulse ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75`}></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">Live Data</span>
      </div>

      {/* STX Price */}
      <div className="flex items-center gap-3 pr-4 border-r border-white/10">
        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-purple-400">STX</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{formatPrice(data.stxPrice)}</div>
          <div className={`text-xs flex items-center gap-1 ${data.stxChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.stxChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatChange(data.stxChange24h)}
          </div>
        </div>
      </div>

      {/* BTC Price */}
      <div className="flex items-center gap-3 pr-4 border-r border-white/10">
        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
          <span className="text-xs font-bold text-orange-400">₿</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{formatPrice(data.btcPrice)}</div>
          <div className={`text-xs flex items-center gap-1 ${data.btcChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.btcChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatChange(data.btcChange24h)}
          </div>
        </div>
      </div>

      {/* Gas Price */}
      <div className="flex items-center gap-3 pr-4 border-r border-white/10">
        <Activity className="w-4 h-4 text-gray-400" />
        <div>
          <div className="text-sm font-semibold text-white">{data.gasPrice} μSTX</div>
          <div className="text-xs text-gray-500">Gas Price</div>
        </div>
      </div>

      {/* Block Height */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-gray-400" />
        <div>
          <div className="text-sm font-mono font-semibold text-white">#{data.blockHeight.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Block</div>
        </div>
      </div>

      {/* Last Update */}
      <div className="ml-auto text-xs text-gray-500 whitespace-nowrap">
        Updated: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default LiveStats;

