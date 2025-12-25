import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, TrendingUp, Zap, RefreshCw, ChevronDown, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, contractPrincipalCV } from '@stacks/transactions';

interface Token {
  symbol: string;
  name: string;
  contract: string;
  decimals: number;
  logo: string;
}

interface PriceQuote {
  dex: string;
  dexLogo: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  price: number;
  priceImpact: number;
  fee: number;
  route: string[];
  estimatedGas: number;
}

interface ArbitrageOpportunity {
  buyDex: string;
  sellDex: string;
  token: string;
  buyPrice: number;
  sellPrice: number;
  profitPercent: number;
  estimatedProfit: number;
}

const TOKENS: Token[] = [
  { symbol: 'STX', name: 'Stacks', contract: 'native', decimals: 6, logo: '⚡' },
  { symbol: 'sBTC', name: 'Stacks Bitcoin', contract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', decimals: 8, logo: '₿' },
  { symbol: 'ALEX', name: 'ALEX Token', contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex', decimals: 8, logo: '🔷' },
  { symbol: 'USDA', name: 'Arkadiko USDA', contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token', decimals: 6, logo: '💵' },
  { symbol: 'xBTC', name: 'Wrapped Bitcoin', contract: 'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin', decimals: 8, logo: '🟠' },
  { symbol: 'WELSH', name: 'Welsh Corgi', contract: 'SP3NE50GEXFG9SZGFPWX4MPNMGVVQZ3SCDX5TQMB2.welshcorgicoin-token', decimals: 6, logo: '🐕' },
];

const DEXES = [
  { name: 'ALEX', logo: '🔷', color: 'from-blue-500 to-cyan-500' },
  { name: 'Velar', logo: '🟣', color: 'from-purple-500 to-pink-500' },
  { name: 'Arkadiko', logo: '🏛️', color: 'from-green-500 to-emerald-500' },
];

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

export const DEXAggregator: React.FC = () => {
  const { isConnected, connectWallet, userAddress } = useWallet();
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(TOKENS[1]);
  const [amount, setAmount] = useState('100');
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [bestQuote, setBestQuote] = useState<PriceQuote | null>(null);
  const [savings, setSavings] = useState(0);
  const [arbitrageOpps, setArbitrageOpps] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFromTokens, setShowFromTokens] = useState(false);
  const [showToTokens, setShowToTokens] = useState(false);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [swapping, setSwapping] = useState(false);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string } | null>(null);

  // Fetch token balances
  const fetchBalances = useCallback(async () => {
    if (!userAddress) return;
    
    const newBalances: Record<string, string> = {};
    
    try {
      // Fetch STX balance
      const stxResponse = await fetch(
        `https://api.hiro.so/extended/v1/address/${userAddress}/stx`
      );
      if (stxResponse.ok) {
        const stxData = await stxResponse.json();
        newBalances['STX'] = (parseInt(stxData.balance) / 1_000_000).toFixed(2);
      }
      
      // Fetch SIP-010 token balances
      for (const token of TOKENS.filter(t => t.contract !== 'native')) {
        try {
          const [contractAddress, contractName] = token.contract.split('.');
          const response = await fetch(
            `https://api.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/get-balance`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sender: userAddress,
                arguments: [`0x0516${userAddress.slice(2).padStart(40, '0')}`],
              }),
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.okay && data.result) {
              const hexValue = data.result.replace(/^0x0[0-9a-f]/, '');
              const balance = parseInt(hexValue, 16) || 0;
              newBalances[token.symbol] = (balance / Math.pow(10, token.decimals)).toFixed(4);
            }
          }
        } catch (e) {
          // Token balance fetch failed, continue
        }
      }
      
      setBalances(newBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [userAddress]);

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchBalances();
    }
  }, [isConnected, userAddress, fetchBalances]);

  const fetchQuotes = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    try {
      // Fetch aggregated quotes from our API
      const response = await fetch(
        `${API_URL}/api/dex/quote?from=${fromToken.symbol}&to=${toToken.symbol}&amount=${amount}`
      ).catch(() => null);

      if (response?.ok) {
        const data = await response.json();
        setQuotes(data.allQuotes || []);
        setBestQuote(data.bestQuote || null);
        setSavings(data.savings || 0);
      } else {
        // Generate mock quotes for demo
        const mockQuotes: PriceQuote[] = DEXES.map((dex, i) => {
          const basePrice = fromToken.symbol === 'STX' && toToken.symbol === 'sBTC' 
            ? 0.000015 + (Math.random() * 0.000002 - 0.000001)
            : 1 + (Math.random() * 0.1 - 0.05);
          const inputNum = parseFloat(amount);
          const outputNum = inputNum * basePrice * (1 - 0.003); // 0.3% fee

          return {
            dex: dex.name,
            dexLogo: dex.logo,
            inputToken: fromToken.symbol,
            outputToken: toToken.symbol,
            inputAmount: amount,
            outputAmount: outputNum.toFixed(6),
            price: basePrice,
            priceImpact: 0.1 + Math.random() * 0.5,
            fee: 0.3,
            route: [fromToken.symbol, toToken.symbol],
            estimatedGas: 0.01,
          };
        });

        mockQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));
        setQuotes(mockQuotes);
        setBestQuote(mockQuotes[0] || null);
        
        const best = parseFloat(mockQuotes[0]?.outputAmount || '0');
        const worst = parseFloat(mockQuotes[mockQuotes.length - 1]?.outputAmount || '0');
        setSavings(worst > 0 ? ((best - worst) / worst) * 100 : 0);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  }, [fromToken, toToken, amount]);

  const fetchArbitrage = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/dex/arbitrage`).catch(() => null);
      
      if (response?.ok) {
        const data = await response.json();
        setArbitrageOpps(data || []);
      } else {
        // Mock arbitrage opportunities
        const mockArb: ArbitrageOpportunity[] = [
          {
            buyDex: 'Velar',
            sellDex: 'ALEX',
            token: 'sBTC',
            buyPrice: 0.0000148,
            sellPrice: 0.0000152,
            profitPercent: 2.7,
            estimatedProfit: 2.1,
          },
        ];
        setArbitrageOpps(Math.random() > 0.5 ? mockArb : []);
      }
    } catch (error) {
      console.error('Error fetching arbitrage:', error);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchArbitrage();
    const interval = setInterval(() => {
      fetchQuotes();
      fetchArbitrage();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchQuotes, fetchArbitrage]);

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const handleSwap = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) {
      setTxStatus({ error: 'Please enter a valid positive amount' });
      return;
    }

    if (!bestQuote) {
      setTxStatus({ error: 'No route available for this swap' });
      return;
    }

    setSwapping(true);
    setTxStatus(null);

    try {
      const inputAmountMicro = BigInt(Math.floor(inputAmount * Math.pow(10, fromToken.decimals)));
      const minOutputAmount = BigInt(Math.floor(parseFloat(bestQuote.outputAmount) * 0.97 * Math.pow(10, toToken.decimals))); // 3% slippage

      // DEX Router contracts
      const DEX_ROUTERS: Record<string, { contract: string; name: string; swapFunction: string }> = {
        'ALEX': {
          contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM',
          name: 'amm-swap-pool-v1-1',
          swapFunction: 'swap-helper',
        },
        'Velar': {
          contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
          name: 'velar-v2',
          swapFunction: 'swap',
        },
        'Arkadiko': {
          contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          name: 'arkadiko-swap-v2-1',
          swapFunction: 'swap-x-for-y',
        },
      };

      const router = DEX_ROUTERS[bestQuote.dex];
      if (!router) {
        throw new Error(`Unsupported DEX: ${bestQuote.dex}`);
      }

      const contractId = `${router.contract}.${router.name}`;
      
      // Build function args based on DEX
      let functionArgs: any[] = [];
      
      if (bestQuote.dex === 'ALEX') {
        functionArgs = [
          contractPrincipalCV(fromToken.contract.split('.')[0], fromToken.contract.split('.')[1] || 'wrapped-stx-token'),
          contractPrincipalCV(toToken.contract.split('.')[0], toToken.contract.split('.')[1] || 'token-alex'),
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
        ];
      } else if (bestQuote.dex === 'Arkadiko') {
        functionArgs = [
          contractPrincipalCV(router.contract, 'arkadiko-token'),
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
        ];
      } else {
        functionArgs = [
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
        ];
      }

      const result = await request(
        { walletConnect: { projectId: 'e5f06d0d893851277f61878bdf812cbd' } },
        'stx_callContract',
        {
          contract: contractId as `${string}.${string}`,
          functionName: router.swapFunction,
          functionArgs: functionArgs,
          postConditionMode: 'allow' as const,
          network: 'mainnet' as any,
        }
      );

      if (result && result.txid) {
        setTxStatus({ txId: result.txid });
        setAmount('');
        // Refresh balances
        setTimeout(() => fetchBalances(), 5000);
      } else {
        setTxStatus({ error: 'Transaction failed or was cancelled' });
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      setTxStatus({ error: error?.message || 'Failed to execute swap' });
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">DEX Aggregator</h2>
            <p className="text-gray-400 text-sm">Best prices across ALEX, Velar & Arkadiko</p>
          </div>
        </div>
        <div className="flex gap-2">
          {DEXES.map((dex) => (
            <div key={dex.name} className="px-3 py-1 bg-black/30 rounded-full text-sm flex items-center gap-1">
              <span>{dex.logo}</span>
              <span className="text-gray-400">{dex.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Swap Interface */}
      <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 rounded-2xl p-6 border border-purple-500/20">
        {/* From Token */}
        <div className="bg-black/30 rounded-xl p-4 mb-2">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>From</span>
            <div className="flex items-center gap-2">
              <span>Balance: {balances[fromToken.symbol] || '--'} {fromToken.symbol}</span>
              {balances[fromToken.symbol] && (
                <button
                  onClick={() => setAmount(balances[fromToken.symbol])}
                  className="text-xs px-2 py-0.5 bg-purple-500/30 rounded text-purple-300 hover:bg-purple-500/50"
                >
                  MAX
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || parseFloat(val) >= 0) {
                  setAmount(val);
                }
              }}
              className="flex-1 bg-transparent text-3xl font-bold text-white outline-none"
              placeholder="0.0"
            />
            <button
              onClick={() => setShowFromTokens(!showFromTokens)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-xl hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-xl">{fromToken.logo}</span>
              <span className="font-semibold text-white">{fromToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          {showFromTokens && (
            <div className="absolute mt-2 bg-slate-800 rounded-xl border border-purple-500/30 shadow-xl z-10 min-w-[200px]">
              {TOKENS.filter(t => t.symbol !== toToken.symbol).map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => {
                    setFromToken(token);
                    setShowFromTokens(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-500/20 transition-colors"
                >
                  <span className="text-xl">{token.logo}</span>
                  <div className="text-left">
                    <div className="font-semibold text-white">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-4 relative z-10">
          <button
            onClick={swapTokens}
            className="w-10 h-10 rounded-xl bg-purple-500 hover:bg-purple-600 transition-colors flex items-center justify-center"
          >
            <ArrowRightLeft className="w-5 h-5 text-white rotate-90" />
          </button>
        </div>

        {/* To Token */}
        <div className="bg-black/30 rounded-xl p-4 mt-2">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>To (estimated)</span>
            <span>Balance: {balances[toToken.symbol] || '--'} {toToken.symbol}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-3xl font-bold text-white">
              {loading ? (
                <span className="text-gray-500">Loading...</span>
              ) : bestQuote ? (
                parseFloat(bestQuote.outputAmount).toFixed(6)
              ) : (
                '0.0'
              )}
            </div>
            <button
              onClick={() => setShowToTokens(!showToTokens)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-xl hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-xl">{toToken.logo}</span>
              <span className="font-semibold text-white">{toToken.symbol}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {showToTokens && (
            <div className="absolute mt-2 bg-slate-800 rounded-xl border border-purple-500/30 shadow-xl z-10 min-w-[200px]">
              {TOKENS.filter(t => t.symbol !== fromToken.symbol).map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => {
                    setToToken(token);
                    setShowToTokens(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-500/20 transition-colors"
                >
                  <span className="text-xl">{token.logo}</span>
                  <div className="text-left">
                    <div className="font-semibold text-white">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Best Route Info */}
        {bestQuote && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">Best Route: {bestQuote.dex}</span>
              </div>
              {savings > 0 && (
                <span className="text-sm text-green-400 font-semibold">
                  Save {savings.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Price: 1 {fromToken.symbol} = {bestQuote.price.toFixed(8)} {toToken.symbol} • 
              Impact: {bestQuote.priceImpact.toFixed(2)}% • 
              Fee: {bestQuote.fee}%
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!bestQuote || loading || swapping || parseFloat(amount) <= 0}
          className={`w-full mt-4 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
            bestQuote && !loading && !swapping && parseFloat(amount) > 0
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
          }`}
        >
          {swapping && <Loader2 className="w-5 h-5 animate-spin" />}
          {!isConnected ? 'Connect Wallet' : swapping ? 'Swapping...' : loading ? 'Finding Best Price...' : 'Swap'}
        </button>

        {/* Transaction Status */}
        {txStatus && (
          <div className={`mt-4 p-4 rounded-xl ${txStatus.error ? 'bg-red-500/20 border border-red-500/30' : 'bg-green-500/20 border border-green-500/30'}`}>
            {txStatus.error ? (
              <p className="text-red-400 text-sm">{txStatus.error}</p>
            ) : (
              <div className="text-green-400 text-sm">
                <p className="font-semibold">Swap submitted! 🎉</p>
                <a
                  href={`https://explorer.stacks.co/txid/${txStatus.txId}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-green-300 hover:text-green-200"
                >
                  View on Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All Quotes Comparison */}
      {quotes.length > 0 && (
        <div className="bg-black/30 rounded-2xl border border-purple-500/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-500/20">
            <h3 className="font-semibold text-white">Price Comparison</h3>
          </div>
          <div className="divide-y divide-purple-500/10">
            {quotes.map((quote, index) => (
              <div
                key={quote.dex}
                className={`px-4 py-3 flex items-center justify-between ${
                  index === 0 ? 'bg-green-500/10' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{quote.dexLogo}</span>
                  <div>
                    <div className="font-semibold text-white">{quote.dex}</div>
                    <div className="text-xs text-gray-400">
                      Fee: {quote.fee}% • Impact: {quote.priceImpact.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono ${index === 0 ? 'text-green-400' : 'text-white'}`}>
                    {parseFloat(quote.outputAmount).toFixed(6)} {toToken.symbol}
                  </div>
                  {index === 0 && (
                    <div className="text-xs text-green-400">Best Price ✓</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arbitrage Opportunities */}
      {arbitrageOpps.length > 0 && (
        <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/10 rounded-2xl p-6 border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-yellow-400">🔥 Arbitrage Opportunities</h3>
          </div>
          
          {arbitrageOpps.map((opp, index) => (
            <div key={index} className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-semibold">{opp.token}</div>
                <div className="text-green-400 font-bold">+{opp.estimatedProfit.toFixed(2)}% profit</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <div className="text-gray-400">Buy on</div>
                  <div className="text-white">{opp.buyDex} @ {opp.buyPrice.toFixed(8)}</div>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-yellow-400" />
                <div className="flex-1 text-right">
                  <div className="text-gray-400">Sell on</div>
                  <div className="text-white">{opp.sellDex} @ {opp.sellPrice.toFixed(8)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DEXAggregator;

