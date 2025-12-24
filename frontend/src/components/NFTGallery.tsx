import React, { useState, useEffect } from 'react';

interface NFTCollection {
  name: string;
  contractId: string;
  floorPrice: number;
  volume24h: number;
  items: number;
  owners: number;
  image: string;
  verified: boolean;
}

interface NFTSale {
  collection: string;
  tokenId: string;
  price: number;
  from: string;
  to: string;
  timestamp: string;
  image: string;
}

const NFTGallery: React.FC = () => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [recentSales, setRecentSales] = useState<NFTSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'collections' | 'sales'>('collections');

  useEffect(() => {
    fetchNFTData();
    const interval = setInterval(fetchNFTData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNFTData = async () => {
    try {
      // In a real implementation, we'd fetch from Gamma API or similar
      // For now, using demo data for popular Stacks NFT collections
      setCollections([
        {
          name: 'Bitcoin Monkeys',
          contractId: 'SP2BE8TZATXEVPGZ8HAFZYE5GKZ02X0YDKAN7ZTGW.bitcoin-monkeys',
          floorPrice: 450,
          volume24h: 12500,
          items: 2500,
          owners: 1850,
          image: '🐵',
          verified: true,
        },
        {
          name: 'Megapont Apes',
          contractId: 'SP3D03Y9MW4H3MPHSAM4T41FWJJQZXJQB8QMT10ZM.megapont-apes',
          floorPrice: 280,
          volume24h: 8400,
          items: 3000,
          owners: 2100,
          image: '🦍',
          verified: true,
        },
        {
          name: 'Satoshibles',
          contractId: 'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.satoshibles',
          floorPrice: 125,
          volume24h: 4200,
          items: 5000,
          owners: 3200,
          image: '👾',
          verified: true,
        },
        {
          name: 'Stacks Punks',
          contractId: 'SPNWZ5V2TPWGQGVDR6T7B6RQ4XMGZ4PXTEE0VQ0S.stacks-punks',
          floorPrice: 85,
          volume24h: 2100,
          items: 10000,
          owners: 4500,
          image: '😎',
          verified: true,
        },
        {
          name: 'Crash Punks',
          contractId: 'SP3QSAJQ4EA8WXEDSRRKMZZ29NH91VZ6C5X88FGZQ.crash-punks',
          floorPrice: 65,
          volume24h: 1800,
          items: 9999,
          owners: 3800,
          image: '💥',
          verified: true,
        },
        {
          name: 'Bitcoin Birds',
          contractId: 'SPJW1XE278YMCEYMXB8ZFGJMH8ZVAAEDP2S2PJYG.bitcoin-birds',
          floorPrice: 42,
          volume24h: 950,
          items: 4444,
          owners: 2200,
          image: '🐦',
          verified: false,
        },
      ]);

      // Recent sales demo data
      setRecentSales([
        {
          collection: 'Bitcoin Monkeys',
          tokenId: '#1234',
          price: 520,
          from: 'SP2BE...TGW',
          to: 'SP3K8...R9',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          image: '🐵',
        },
        {
          collection: 'Megapont Apes',
          tokenId: '#567',
          price: 310,
          from: 'SP3D0...ZM',
          to: 'SP1Y5...A1',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          image: '🦍',
        },
        {
          collection: 'Satoshibles',
          tokenId: '#2891',
          price: 145,
          from: 'SP6P4...C',
          to: 'SP2C2...ZR',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          image: '👾',
        },
        {
          collection: 'Stacks Punks',
          tokenId: '#4521',
          price: 95,
          from: 'SPNWZ...0S',
          to: 'SP3NE...G3',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          image: '😎',
        },
        {
          collection: 'Crash Punks',
          tokenId: '#7890',
          price: 78,
          from: 'SP3QS...YQ',
          to: 'SP2PA...G9',
          timestamp: new Date(Date.now() - 5400000).toISOString(),
          image: '💥',
        },
      ]);
    } catch (error) {
      console.error('Error fetching NFT data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-pink-900/20 to-rose-900/20 rounded-xl p-6 border border-pink-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-pink-500/20 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-pink-500/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-pink-900/20 to-rose-900/20 rounded-xl p-6 border border-pink-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-xl">
            🖼️
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">NFT Gallery</h2>
            <p className="text-sm text-pink-300/70">Stacks NFT Collections</p>
          </div>
        </div>
        <a
          href="https://gamma.io"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 rounded-lg text-pink-300 text-sm transition-colors"
        >
          View on Gamma ↗
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('collections')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'collections'
              ? 'bg-pink-500 text-white'
              : 'bg-pink-500/10 text-pink-300 hover:bg-pink-500/20'
          }`}
        >
          Top Collections
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'sales'
              ? 'bg-pink-500 text-white'
              : 'bg-pink-500/10 text-pink-300 hover:bg-pink-500/20'
          }`}
        >
          Recent Sales
        </button>
      </div>

      {/* Collections Tab */}
      {activeTab === 'collections' && (
        <div className="space-y-3">
          {collections.map((collection, index) => (
            <div
              key={collection.contractId}
              className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-pink-500/10 hover:border-pink-500/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-pink-300/50 w-5">#{index + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-2xl">
                  {collection.image}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{collection.name}</p>
                    {collection.verified && (
                      <span className="text-blue-400 text-xs">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-pink-300/50">
                    {collection.items.toLocaleString()} items • {collection.owners.toLocaleString()} owners
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{collection.floorPrice} STX</p>
                <p className="text-xs text-pink-300/50">
                  Vol: {collection.volume24h.toLocaleString()} STX
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-3">
          {recentSales.map((sale, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-pink-500/10"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-2xl">
                  {sale.image}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {sale.collection} {sale.tokenId}
                  </p>
                  <p className="text-xs text-pink-300/50">
                    {sale.from} → {sale.to}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold">{sale.price} STX</p>
                <p className="text-xs text-pink-300/50">{formatTime(sale.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-pink-500/20">
        <div className="text-center">
          <p className="text-lg font-bold text-white">
            {collections.reduce((acc, c) => acc + c.volume24h, 0).toLocaleString()}
          </p>
          <p className="text-xs text-pink-300/50">24h Volume (STX)</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">
            {collections.reduce((acc, c) => acc + c.items, 0).toLocaleString()}
          </p>
          <p className="text-xs text-pink-300/50">Total NFTs</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">
            {collections.length}
          </p>
          <p className="text-xs text-pink-300/50">Collections</p>
        </div>
      </div>
    </div>
  );
};

export default NFTGallery;


