import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';

interface Token {
  symbol: string;
  name: string;
  contractId: string;
  decimals: number;
  icon: string;
  price: number;
}

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: number;
  route: string[];
  dex: string;
}

const TOKENS: Token[] = [
  { symbol: 'STX', name: 'Stacks', contractId: 'native', decimals: 6, icon: '🟠', price: 0.24 },
  { symbol: 'sBTC', name: 'sBTC', contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', decimals: 8, icon: '₿', price: 97500 },
  { symbol: 'ALEX', name: 'ALEX', contractId: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.age000-governance-token', decimals: 8, icon: '🔵', price: 0.012 },
  { symbol: 'VELAR', name: 'Velar', contractId: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token', decimals: 8, icon: '🟣', price: 0.008 },
  { symbol: 'USDA', name: 'USDA', contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token', decimals: 6, icon: '💵', price: 1.00 },
  { symbol: 'WELSH', name: 'Welsh', contractId: 'SP3NE50GEXFG9SZGTT5P3G5TJS6T6LBF3TWAQCDG3.welshcorgicoin-token', decimals: 6, icon: '🐕', price: 0.000045 },
  { symbol: 'SNTL', name: 'Sentinel', contractId: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token', decimals: 6, icon: '🛡️', price: 0.001 },
];

const DEX_LIST = [
  { id: 'alex', name: 'ALEX', icon: '🔵', url: 'https://app.alexlab.co' },
  { id: 'velar', name: 'Velar', icon: '🟣', url: 'https://app.velar.co' },
  { id: 'stxcity', name: 'STX.City', icon: '🏙️', url: 'https://stx.city' },
];

const SwapInterface: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(TOKENS[2]);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFromTokenList, setShowFromTokenList] = useState(false);
  const [showToTokenList, setShowToTokenList] = useState(false);
  const [selectedDex, setSelectedDex] = useState(DEX_LIST[0]);
  const [slippage, setSlippage] = useState(0.5);

  // Calculate quote when amount changes
  const calculateQuote = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      setQuote(null);
      return;
    }

    setLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Calculate based on token prices (simplified)
    const fromValue = parseFloat(fromAmount) * fromToken.price;
    const outputAmount = fromValue / toToken.price;
    
    // Add some randomness to simulate price impact
    const priceImpact = parseFloat(fromAmount) > 1000 ? 0.5 + Math.random() * 1.5 : 0.1 + Math.random() * 0.3;
    const adjustedOutput = outputAmount * (1 - priceImpact / 100);
    
    setToAmount(adjustedOutput.toFixed(toToken.decimals > 6 ? 8 : 6));
    setQuote({
      inputAmount: fromAmount,
      outputAmount: adjustedOutput.toFixed(toToken.decimals > 6 ? 8 : 6),
      priceImpact,
      fee: parseFloat(fromAmount) * 0.003, // 0.3% fee
      route: [fromToken.symbol, toToken.symbol],
      dex: selectedDex.name,
    });
    
    setLoading(false);
  }, [fromAmount, fromToken, toToken, selectedDex]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      calculateQuote();
    }, 300);
    return () => clearTimeout(debounce);
  }, [calculateQuote]);

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    // Open the selected DEX in a new tab with swap parameters
    const dexUrl = `${selectedDex.url}/swap?from=${fromToken.symbol}&to=${toToken.symbol}&amount=${fromAmount}`;
    window.open(dexUrl, '_blank');
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString()}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(8)}`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-xl p-6 border border-blue-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-xl">
            🔄
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Swap</h2>
            <p className="text-sm text-blue-300/70">Trade tokens instantly</p>
          </div>
        </div>
        {/* Slippage Settings */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-300/50">Slippage:</span>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  slippage === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DEX Selector */}
      <div className="flex gap-2 mb-4">
        {DEX_LIST.map((dex) => (
          <button
            key={dex.id}
            onClick={() => setSelectedDex(dex)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedDex.id === dex.id
                ? 'bg-blue-500/30 text-white border border-blue-500/50'
                : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-transparent'
            }`}
          >
            <span>{dex.icon}</span>
            <span>{dex.name}</span>
          </button>
        ))}
      </div>

      {/* From Token */}
      <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20 mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-blue-300/70">From</span>
          <span className="text-xs text-blue-300/50">
            Balance: {isConnected ? '1,234.56' : '---'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowFromTokenList(!showFromTokenList)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <span className="text-xl">{fromToken.icon}</span>
              <span className="font-medium text-white">{fromToken.symbol}</span>
              <span className="text-blue-300">▼</span>
            </button>
            {showFromTokenList && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 rounded-xl border border-blue-500/30 shadow-xl z-50 max-h-64 overflow-y-auto">
                {TOKENS.filter(t => t.symbol !== toToken.symbol).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setFromToken(token);
                      setShowFromTokenList(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-xl">{token.icon}</span>
                    <div className="text-left">
                      <p className="text-white font-medium">{token.symbol}</p>
                      <p className="text-xs text-blue-300/50">{token.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-right text-2xl font-bold text-white outline-none placeholder-blue-300/30"
          />
        </div>
        <div className="text-right text-sm text-blue-300/50 mt-1">
          ≈ {fromAmount ? formatPrice(parseFloat(fromAmount) * fromToken.price) : '$0.00'}
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center -my-3 relative z-10">
        <button
          onClick={swapTokens}
          className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg"
        >
          <span className="text-white text-lg">↕️</span>
        </button>
      </div>

      {/* To Token */}
      <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20 mt-2 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-blue-300/70">To</span>
          <span className="text-xs text-blue-300/50">
            Balance: {isConnected ? '567.89' : '---'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowToTokenList(!showToTokenList)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <span className="text-xl">{toToken.icon}</span>
              <span className="font-medium text-white">{toToken.symbol}</span>
              <span className="text-blue-300">▼</span>
            </button>
            {showToTokenList && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 rounded-xl border border-blue-500/30 shadow-xl z-50 max-h-64 overflow-y-auto">
                {TOKENS.filter(t => t.symbol !== fromToken.symbol).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setToToken(token);
                      setShowToTokenList(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-xl">{token.icon}</span>
                    <div className="text-left">
                      <p className="text-white font-medium">{token.symbol}</p>
                      <p className="text-xs text-blue-300/50">{token.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 text-right">
            {loading ? (
              <div className="animate-pulse h-8 bg-blue-500/20 rounded"></div>
            ) : (
              <p className="text-2xl font-bold text-white">{toAmount || '0.00'}</p>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-blue-300/50 mt-1">
          ≈ {toAmount ? formatPrice(parseFloat(toAmount) * toToken.price) : '$0.00'}
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-black/20 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/70">Rate</span>
            <span className="text-white">
              1 {fromToken.symbol} = {(fromToken.price / toToken.price).toFixed(6)} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/70">Price Impact</span>
            <span className={quote.priceImpact > 1 ? 'text-yellow-400' : 'text-green-400'}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/70">Fee</span>
            <span className="text-white">
              {quote.fee.toFixed(6)} {fromToken.symbol} (0.3%)
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/70">Route</span>
            <span className="text-white">
              {quote.route.join(' → ')} via {quote.dex}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-300/70">Min. Received</span>
            <span className="text-white">
              {(parseFloat(quote.outputAmount) * (1 - slippage / 100)).toFixed(6)} {toToken.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!fromAmount || parseFloat(fromAmount) <= 0}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
          !fromAmount || parseFloat(fromAmount) <= 0
            ? 'bg-blue-500/20 text-blue-300/50 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25'
        }`}
      >
        {!isConnected
          ? 'Connect Wallet'
          : !fromAmount || parseFloat(fromAmount) <= 0
          ? 'Enter Amount'
          : `Swap on ${selectedDex.name}`}
      </button>

      {/* Powered By */}
      <p className="text-center text-xs text-blue-300/30 mt-4">
        Powered by {selectedDex.name} • Best rates aggregated
      </p>
    </div>
  );
};

export default SwapInterface;

