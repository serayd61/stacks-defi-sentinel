import React, { useState, useEffect } from 'react';
import { Wallet, Search, Activity, TrendingUp, TrendingDown, Clock, ExternalLink, Copy, CheckCircle, Coins, ArrowUpRight, ArrowDownLeft, Layers, Award } from 'lucide-react';

interface WalletData {
  address: string;
  balance: number;
  balanceUsd: number;
  nonce: number;
  totalSent: number;
  totalReceived: number;
  txCount: number;
  firstActivity: number;
  lastActivity: number;
  tokens: TokenBalance[];
  recentTxs: Transaction[];
  nfts: number;
}

interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  value: number;
}

interface Transaction {
  txId: string;
  type: 'sent' | 'received' | 'contract';
  amount: number;
  token: string;
  timestamp: number;
  counterparty: string;
  status: string;
}

const WalletAnalytics: React.FC = () => {
  const [searchAddress, setSearchAddress] = useState('');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stxPrice, setStxPrice] = useState(0.85);

  // Fetch STX price
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setStxPrice(data.blockstack?.usd || 0.85))
      .catch(() => {});
  }, []);

  const analyzeWallet = async (address: string) => {
    if (!address || !address.startsWith('SP') && !address.startsWith('ST')) {
      setError('Please enter a valid Stacks address (starts with SP or ST)');
      return;
    }

    setLoading(true);
    setError(null);
    setWalletData(null);

    try {
      // Fetch wallet data in parallel
      const [balanceRes, txsRes, nftsRes] = await Promise.all([
        fetch(`https://api.hiro.so/extended/v1/address/${address}/balances`),
        fetch(`https://api.hiro.so/extended/v1/address/${address}/transactions?limit=20`),
        fetch(`https://api.hiro.so/extended/v1/address/${address}/nft_events?limit=1`),
      ]);

      const [balanceData, txsData, nftsData] = await Promise.all([
        balanceRes.json(),
        txsRes.json(),
        nftsRes.json(),
      ]);

      // Parse STX balance
      const stxBalance = parseInt(balanceData.stx?.balance || '0') / 1e6;
      
      // Parse token balances
      const tokens: TokenBalance[] = [];
      if (balanceData.fungible_tokens) {
        Object.entries(balanceData.fungible_tokens).forEach(([key, value]: [string, any]) => {
          const balance = parseInt(value.balance || '0');
          if (balance > 0) {
            const symbol = key.split('::')[1] || key.split('.')[1]?.split('::')[0] || 'TOKEN';
            tokens.push({
              symbol: symbol.toUpperCase(),
              name: symbol,
              balance: balance / 1e6,
              value: 0, // Would need price API
            });
          }
        });
      }

      // Parse transactions
      const recentTxs: Transaction[] = (txsData.results || []).slice(0, 10).map((tx: any) => {
        let type: 'sent' | 'received' | 'contract' = 'contract';
        let amount = 0;
        let counterparty = '';
        let token = 'STX';

        if (tx.tx_type === 'token_transfer') {
          const isSender = tx.sender_address === address;
          type = isSender ? 'sent' : 'received';
          amount = parseInt(tx.token_transfer?.amount || '0') / 1e6;
          counterparty = isSender ? tx.token_transfer?.recipient_address : tx.sender_address;
        } else if (tx.tx_type === 'contract_call') {
          type = 'contract';
          counterparty = tx.contract_call?.contract_id || '';
        }

        return {
          txId: tx.tx_id,
          type,
          amount,
          token,
          timestamp: tx.burn_block_time || tx.receipt_time || 0,
          counterparty,
          status: tx.tx_status,
        };
      });

      // Calculate totals
      const sentTxs = recentTxs.filter(tx => tx.type === 'sent');
      const receivedTxs = recentTxs.filter(tx => tx.type === 'received');
      const totalSent = sentTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const totalReceived = receivedTxs.reduce((sum, tx) => sum + tx.amount, 0);

      // Get first and last activity
      const timestamps = recentTxs.map(tx => tx.timestamp).filter(t => t > 0);
      const firstActivity = timestamps.length > 0 ? Math.min(...timestamps) : 0;
      const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0;

      setWalletData({
        address,
        balance: stxBalance,
        balanceUsd: stxBalance * stxPrice,
        nonce: balanceData.stx?.nonce || 0,
        totalSent,
        totalReceived,
        txCount: txsData.total || 0,
        firstActivity,
        lastActivity,
        tokens,
        recentTxs,
        nfts: nftsData.total || 0,
      });
    } catch (err) {
      console.error('Error analyzing wallet:', err);
      setError('Failed to fetch wallet data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (walletData) {
      navigator.clipboard.writeText(walletData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  // Example addresses for quick analysis
  const exampleAddresses = [
    { label: 'ALEX Treasury', address: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM' },
    { label: 'Velar', address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1' },
  ];

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Wallet Analytics</h3>
            <p className="text-xs text-gray-500">Deep dive into any Stacks wallet</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Enter Stacks address (SP... or ST...)"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeWallet(searchAddress)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <button
            onClick={() => analyzeWallet(searchAddress)}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Quick Examples */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-gray-500">Try:</span>
          {exampleAddresses.map(ex => (
            <button
              key={ex.address}
              onClick={() => {
                setSearchAddress(ex.address);
                analyzeWallet(ex.address);
              }}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-500">Analyzing wallet...</p>
        </div>
      )}

      {/* Wallet Data */}
      {walletData && !loading && (
        <div className="p-4">
          {/* Address Header */}
          <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-mono text-sm text-white">
                  {walletData.address.slice(0, 12)}...{walletData.address.slice(-8)}
                </div>
                <div className="text-xs text-gray-500">
                  {walletData.txCount} transactions
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <a
                href={`https://explorer.hiro.so/address/${walletData.address}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>

          {/* Balance Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Coins className="w-3.5 h-3.5" />
                STX Balance
              </div>
              <div className="font-bold text-lg text-white">{formatNumber(walletData.balance)}</div>
              <div className="text-xs text-gray-500">${formatNumber(walletData.balanceUsd)}</div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-transparent rounded-xl p-3 border border-green-500/20">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Total Received
              </div>
              <div className="font-bold text-lg text-green-400">{formatNumber(walletData.totalReceived)}</div>
              <div className="text-xs text-gray-500">STX</div>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-transparent rounded-xl p-3 border border-red-500/20">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Total Sent
              </div>
              <div className="font-bold text-lg text-red-400">{formatNumber(walletData.totalSent)}</div>
              <div className="text-xs text-gray-500">STX</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl p-3 border border-blue-500/20">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Award className="w-3.5 h-3.5" />
                NFTs Owned
              </div>
              <div className="font-bold text-lg text-blue-400">{walletData.nfts}</div>
              <div className="text-xs text-gray-500">collections</div>
            </div>
          </div>

          {/* Token Holdings */}
          {walletData.tokens.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Token Holdings</h4>
              <div className="flex flex-wrap gap-2">
                {walletData.tokens.slice(0, 8).map((token, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{token.symbol}</div>
                      <div className="text-[10px] text-gray-500">{formatNumber(token.balance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Activity</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {walletData.recentTxs.map((tx, idx) => (
                <a
                  key={idx}
                  href={`https://explorer.hiro.so/txid/${tx.txId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === 'received' ? 'bg-green-500/20' :
                      tx.type === 'sent' ? 'bg-red-500/20' :
                      'bg-purple-500/20'
                    }`}>
                      {tx.type === 'received' ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-400" />
                      ) : tx.type === 'sent' ? (
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                      ) : (
                        <Layers className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-white capitalize">{tx.type}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {tx.counterparty.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.amount > 0 && (
                      <div className={`text-sm font-mono ${
                        tx.type === 'received' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'received' ? '+' : '-'}{formatNumber(tx.amount)} {tx.token}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">{formatTime(tx.timestamp)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-500">First Activity:</span>
                <span className="text-white ml-2">{formatTime(walletData.firstActivity)}</span>
              </div>
              <div>
                <span className="text-gray-500">Last Activity:</span>
                <span className="text-white ml-2">{formatTime(walletData.lastActivity)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!walletData && !loading && !error && (
        <div className="p-8 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500">Enter a Stacks address to analyze</p>
          <p className="text-xs text-gray-600 mt-1">View balances, transactions, and token holdings</p>
        </div>
      )}
    </div>
  );
};

export default WalletAnalytics;
