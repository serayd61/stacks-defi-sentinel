import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, TrendingUp, Zap, RefreshCw, ChevronDown, ExternalLink, AlertTriangle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

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
  const { isConnected, connectWallet } = useWallet();
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

  const handleSwap = () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    // In production, this would execute the swap via the best DEX
    alert(`Would swap ${amount} ${fromToken.symbol} for ~${bestQuote?.outputAmount} ${toToken.symbol} on ${bestQuote?.dex}`);
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
            <span>Balance: --</span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            <span>Balance: --</span>
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
          disabled={!bestQuote || loading}
          className={`w-full mt-4 py-4 rounded-xl font-bold text-lg transition-all ${
            bestQuote && !loading
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
          }`}
        >
          {!isConnected ? 'Connect Wallet' : loading ? 'Finding Best Price...' : 'Swap'}
        </button>
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

