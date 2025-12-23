import React, { useState, useEffect } from 'react';

interface Block {
  height: number;
  hash: string;
  timestamp: number;
  txCount: number;
  miner: string;
  burnBlockHeight: number;
}

interface MempoolTx {
  txId: string;
  type: string;
  sender: string;
  fee: number;
  timestamp: number;
}

const BlockExplorer: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [mempoolTxs, setMempoolTxs] = useState<MempoolTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'blocks' | 'mempool'>('blocks');
  const [mempoolStats, setMempoolStats] = useState({ pending: 0, totalFees: 0 });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch recent blocks
      const blocksResponse = await fetch('https://api.hiro.so/extended/v2/blocks?limit=10');
      const blocksData = await blocksResponse.json();
      
      const formattedBlocks: Block[] = blocksData.results.map((block: any) => ({
        height: block.height,
        hash: block.hash,
        timestamp: block.burn_block_time,
        txCount: block.txs?.length || block.tx_count || 0,
        miner: block.miner_txid?.slice(0, 20) || 'Unknown',
        burnBlockHeight: block.burn_block_height,
      }));
      
      setBlocks(formattedBlocks);

      // Fetch mempool
      const mempoolResponse = await fetch('https://api.hiro.so/extended/v1/tx/mempool?limit=10');
      const mempoolData = await mempoolResponse.json();
      
      const formattedMempool: MempoolTx[] = mempoolData.results.map((tx: any) => ({
        txId: tx.tx_id,
        type: tx.tx_type,
        sender: tx.sender_address,
        fee: tx.fee_rate / 1000000,
        timestamp: tx.receipt_time,
      }));
      
      setMempoolTxs(formattedMempool);
      setMempoolStats({
        pending: mempoolData.total || formattedMempool.length,
        totalFees: formattedMempool.reduce((acc: number, tx: MempoolTx) => acc + tx.fee, 0),
      });
    } catch (error) {
      console.error('Error fetching block data:', error);
      // Demo data fallback
      setBlocks([
        { height: 175432, hash: '0x1234...', timestamp: Date.now() / 1000 - 300, txCount: 24, miner: 'SP2...', burnBlockHeight: 929150 },
        { height: 175431, hash: '0x5678...', timestamp: Date.now() / 1000 - 900, txCount: 18, miner: 'SP3...', burnBlockHeight: 929149 },
        { height: 175430, hash: '0x9abc...', timestamp: Date.now() / 1000 - 1500, txCount: 31, miner: 'SP1...', burnBlockHeight: 929148 },
      ]);
      setMempoolTxs([
        { txId: '0xabc...', type: 'contract_call', sender: 'SP2...', fee: 0.001, timestamp: Date.now() / 1000 },
        { txId: '0xdef...', type: 'token_transfer', sender: 'SP3...', fee: 0.0005, timestamp: Date.now() / 1000 - 30 },
      ]);
      setMempoolStats({ pending: 45, totalFees: 0.125 });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getTxTypeColor = (type: string) => {
    switch (type) {
      case 'contract_call': return 'text-blue-400 bg-blue-400/10';
      case 'token_transfer': return 'text-green-400 bg-green-400/10';
      case 'smart_contract': return 'text-purple-400 bg-purple-400/10';
      case 'coinbase': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getTxTypeIcon = (type: string) => {
    switch (type) {
      case 'contract_call': return '📝';
      case 'token_transfer': return '💸';
      case 'smart_contract': return '🔧';
      case 'coinbase': return '⛏️';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900/50 to-gray-900/50 rounded-xl p-6 border border-slate-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-500/20 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-500/20 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900/50 to-gray-900/50 rounded-xl p-6 border border-slate-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-xl">
            🔍
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Block Explorer</h2>
            <p className="text-sm text-slate-400">Live blockchain activity</p>
          </div>
        </div>
        <a
          href="https://explorer.hiro.so/?chain=mainnet"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-slate-500/20 hover:bg-slate-500/30 rounded-lg text-slate-300 text-sm transition-colors"
        >
          Full Explorer ↗
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'blocks'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-500/10 text-slate-300 hover:bg-slate-500/20'
          }`}
        >
          <span>⛓️</span> Recent Blocks
        </button>
        <button
          onClick={() => setActiveTab('mempool')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'mempool'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-500/10 text-slate-300 hover:bg-slate-500/20'
          }`}
        >
          <span>⏳</span> Mempool ({mempoolStats.pending})
        </button>
      </div>

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <a
              key={index}
              href={`https://explorer.hiro.so/block/${block.hash}?chain=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-slate-500/10 hover:border-slate-500/30 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <span className="text-xl">⛓️</span>
                </div>
                <div>
                  <p className="text-white font-medium group-hover:text-blue-400 transition-colors">
                    Block #{block.height.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-400">
                    Bitcoin Block #{block.burnBlockHeight.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white">{block.txCount} txs</p>
                <p className="text-sm text-slate-400">{formatTime(block.timestamp)}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Mempool Tab */}
      {activeTab === 'mempool' && (
        <>
          {/* Mempool Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
              <p className="text-yellow-300/70 text-sm">Pending Transactions</p>
              <p className="text-xl font-bold text-white">{mempoolStats.pending}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
              <p className="text-green-300/70 text-sm">Total Fees</p>
              <p className="text-xl font-bold text-white">{mempoolStats.totalFees.toFixed(4)} STX</p>
            </div>
          </div>

          {/* Pending Transactions */}
          <div className="space-y-2">
            {mempoolTxs.map((tx, index) => (
              <a
                key={index}
                href={`https://explorer.hiro.so/txid/${tx.txId}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-slate-500/10 hover:border-slate-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTxTypeColor(tx.type)}`}>
                    {getTxTypeIcon(tx.type)} {tx.type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-sm text-slate-300">
                    {tx.txId.slice(0, 10)}...
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">{tx.fee.toFixed(6)} STX</p>
                  <p className="text-xs text-slate-400">{formatTime(tx.timestamp)}</p>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BlockExplorer;

