import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Users, DollarSign, Activity, ExternalLink, Star, Zap, Droplets, Landmark, ArrowUpRight } from 'lucide-react';

interface Protocol {
  id: string;
  name: string;
  logo: string;
  category: string;
  tvl: number;
  tvlChange24h: number;
  volume24h: number;
  users24h: number;
  fees24h: number;
  website: string;
  description: string;
  chains: string[];
  featured?: boolean;
}

const ProtocolRankings: React.FC = () => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'tvl' | 'volume' | 'users' | 'fees'>('tvl');
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    // Simulated protocol data - in production, fetch from DeFiLlama or similar
    const mockProtocols: Protocol[] = [
      {
        id: 'alex',
        name: 'ALEX',
        logo: '🔷',
        category: 'DEX',
        tvl: 45_000_000,
        tvlChange24h: 5.2,
        volume24h: 2_500_000,
        users24h: 1250,
        fees24h: 12500,
        website: 'https://alexgo.io',
        description: 'The DeFi way on Bitcoin via Stacks',
        chains: ['Stacks'],
        featured: true,
      },
      {
        id: 'velar',
        name: 'Velar',
        logo: '🟢',
        category: 'DEX',
        tvl: 28_000_000,
        tvlChange24h: -2.1,
        volume24h: 1_800_000,
        users24h: 890,
        fees24h: 9000,
        website: 'https://velar.co',
        description: 'Multi-chain DeFi protocol',
        chains: ['Stacks'],
        featured: true,
      },
      {
        id: 'arkadiko',
        name: 'Arkadiko',
        logo: '🏛️',
        category: 'Lending',
        tvl: 22_000_000,
        tvlChange24h: 1.8,
        volume24h: 500_000,
        users24h: 450,
        fees24h: 2500,
        website: 'https://arkadiko.finance',
        description: 'Stablecoin & Lending Protocol',
        chains: ['Stacks'],
      },
      {
        id: 'stackswap',
        name: 'StackSwap',
        logo: '🔄',
        category: 'DEX',
        tvl: 15_000_000,
        tvlChange24h: 3.5,
        volume24h: 900_000,
        users24h: 620,
        fees24h: 4500,
        website: 'https://stackswap.org',
        description: 'Decentralized Exchange on Stacks',
        chains: ['Stacks'],
      },
      {
        id: 'stx-city',
        name: 'STX.City',
        logo: '🏙️',
        category: 'Launchpad',
        tvl: 8_000_000,
        tvlChange24h: 12.5,
        volume24h: 1_200_000,
        users24h: 2100,
        fees24h: 6000,
        website: 'https://stx.city',
        description: 'Token Launchpad & DEX',
        chains: ['Stacks'],
        featured: true,
      },
      {
        id: 'zest',
        name: 'Zest Protocol',
        logo: '💧',
        category: 'Lending',
        tvl: 12_000_000,
        tvlChange24h: 8.3,
        volume24h: 300_000,
        users24h: 280,
        fees24h: 1500,
        website: 'https://zestprotocol.com',
        description: 'Bitcoin-backed Lending',
        chains: ['Stacks'],
      },
      {
        id: 'gamma',
        name: 'Gamma.io',
        logo: '🎨',
        category: 'NFT',
        tvl: 5_000_000,
        tvlChange24h: -1.2,
        volume24h: 150_000,
        users24h: 3500,
        fees24h: 750,
        website: 'https://gamma.io',
        description: 'NFT Marketplace on Stacks',
        chains: ['Stacks'],
      },
      {
        id: 'stackingdao',
        name: 'StackingDAO',
        logo: '🔒',
        category: 'Liquid Staking',
        tvl: 35_000_000,
        tvlChange24h: 2.1,
        volume24h: 800_000,
        users24h: 520,
        fees24h: 4000,
        website: 'https://stackingdao.com',
        description: 'Liquid Stacking Protocol',
        chains: ['Stacks'],
        featured: true,
      },
    ];

    setTimeout(() => {
      setProtocols(mockProtocols);
      setLoading(false);
    }, 500);
  }, []);

  const categories = ['all', 'DEX', 'Lending', 'Liquid Staking', 'NFT', 'Launchpad'];

  const filteredProtocols = protocols
    .filter(p => category === 'all' || p.category === category)
    .sort((a, b) => {
      switch (sortBy) {
        case 'volume': return b.volume24h - a.volume24h;
        case 'users': return b.users24h - a.users24h;
        case 'fees': return b.fees24h - a.fees24h;
        default: return b.tvl - a.tvl;
      }
    });

  const totalTVL = protocols.reduce((sum, p) => sum + p.tvl, 0);
  const totalVolume = protocols.reduce((sum, p) => sum + p.volume24h, 0);
  const totalUsers = protocols.reduce((sum, p) => sum + p.users24h, 0);

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    DEX: <ArrowUpRight className="w-3.5 h-3.5" />,
    Lending: <Landmark className="w-3.5 h-3.5" />,
    'Liquid Staking': <Droplets className="w-3.5 h-3.5" />,
    NFT: <Star className="w-3.5 h-3.5" />,
    Launchpad: <Zap className="w-3.5 h-3.5" />,
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">DeFi Protocol Rankings</h3>
              <p className="text-xs text-gray-500">Stacks ecosystem protocols</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
            <div className="text-xs text-gray-400 mb-1">Total TVL</div>
            <div className="font-bold text-white">{formatNumber(totalTVL)}</div>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
            <div className="text-xs text-gray-400 mb-1">24h Volume</div>
            <div className="font-bold text-white">{formatNumber(totalVolume)}</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
            <div className="text-xs text-gray-400 mb-1">Active Users</div>
            <div className="font-bold text-white">{totalUsers.toLocaleString()}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                category === cat
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div className="px-4 py-2 bg-black/20 border-b border-white/5 flex gap-4">
        {[
          { key: 'tvl', label: 'TVL' },
          { key: 'volume', label: 'Volume' },
          { key: 'users', label: 'Users' },
          { key: 'fees', label: 'Fees' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key as any)}
            className={`text-xs font-medium transition-colors ${
              sortBy === opt.key ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Protocol List */}
      <div className="divide-y divide-white/5">
        {filteredProtocols.map((protocol, idx) => (
          <a
            key={protocol.id}
            href={protocol.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group"
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
              idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
              idx === 1 ? 'bg-gray-400/20 text-gray-300' :
              idx === 2 ? 'bg-orange-600/20 text-orange-400' :
              'bg-white/5 text-gray-500'
            }`}>
              {idx + 1}
            </div>

            {/* Logo & Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                {protocol.logo}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white group-hover:text-purple-400 transition-colors truncate">
                    {protocol.name}
                  </span>
                  {protocol.featured && (
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {categoryIcons[protocol.category]}
                  <span>{protocol.category}</span>
                </div>
              </div>
            </div>

            {/* TVL */}
            <div className="text-right hidden sm:block">
              <div className="font-mono font-bold text-white">{formatNumber(protocol.tvl)}</div>
              <div className={`flex items-center justify-end gap-1 text-xs ${
                protocol.tvlChange24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {protocol.tvlChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(protocol.tvlChange24h).toFixed(1)}%
              </div>
            </div>

            {/* Volume */}
            <div className="text-right hidden md:block w-24">
              <div className="text-sm text-gray-300">{formatNumber(protocol.volume24h)}</div>
              <div className="text-xs text-gray-500">volume</div>
            </div>

            {/* Users */}
            <div className="text-right hidden lg:block w-20">
              <div className="text-sm text-gray-300">{protocol.users24h.toLocaleString()}</div>
              <div className="text-xs text-gray-500">users</div>
            </div>

            {/* Link */}
            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
          </a>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gradient-to-r from-purple-500/5 to-orange-500/5 border-t border-white/5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Data updates every 30 seconds</span>
          <span>{protocols.length} protocols tracked</span>
        </div>
      </div>
    </div>
  );
};

export default ProtocolRankings;
