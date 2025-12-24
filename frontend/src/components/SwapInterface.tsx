import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { request } from '@stacks/connect';
import { uintCV, standardPrincipalCV, PostConditionMode } from '@stacks/transactions';

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

// DEX Router Contracts
const DEX_ROUTERS = {
  alex: {
    contract: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
    name: 'alex-swap-v1',
    swapFunction: 'swap',
  },
  velar: {
    contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
    name: 'univ2-router',
    swapFunction: 'swap-exact-tokens-for-tokens',
  },
  arkadiko: {
    contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
    name: 'arkadiko-swap-v2-1',
    swapFunction: 'swap',
  },
};

const DEX_LIST = [
  { id: 'alex', name: 'ALEX', icon: '🔵', router: DEX_ROUTERS.alex },
  { id: 'velar', name: 'Velar', icon: '🟣', router: DEX_ROUTERS.velar },
  { id: 'arkadiko', name: 'Arkadiko', icon: '🟢', router: DEX_ROUTERS.arkadiko },
];

const SwapInterface: React.FC = () => {
  const { isConnected, userAddress, connectWallet } = useWallet();
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(TOKENS[2]);
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [showFromTokenList, setShowFromTokenList] = useState(false);
  const [showToTokenList, setShowToTokenList] = useState(false);
  const [selectedDex, setSelectedDex] = useState(DEX_LIST[0]);
  const [slippage, setSlippage] = useState(0.5);
  const [txStatus, setTxStatus] = useState<{ txId?: string; error?: string } | null>(null);
  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [toBalance, setToBalance] = useState<number | null>(null);

  // Calculate quote when amount changes
  const calculateQuote = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      setQuote(null);
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const fromValue = parseFloat(fromAmount) * fromToken.price;
    const outputAmount = fromValue / toToken.price;
    const priceImpact = parseFloat(fromAmount) > 1000 ? 0.5 + Math.random() * 1 : 0.1 + Math.random() * 0.2;
    const adjustedOutput = outputAmount * (1 - priceImpact / 100);
    
    // Format output based on value size
    let formattedOutput: string;
    if (adjustedOutput >= 1000000) {
      formattedOutput = adjustedOutput.toFixed(2);
    } else if (adjustedOutput >= 1) {
      formattedOutput = adjustedOutput.toFixed(4);
    } else {
      formattedOutput = adjustedOutput.toFixed(6);
    }
    
    setToAmount(formattedOutput);
    setQuote({
      inputAmount: fromAmount,
      outputAmount: formattedOutput,
      priceImpact,
      fee: parseFloat(fromAmount) * 0.003,
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

  // Get token balance
  const getTokenBalance = useCallback(async (token: Token): Promise<number> => {
    if (!userAddress) return 0;
    
    if (token.contractId === 'native') {
      // STX balance
      try {
        const response = await fetch(`https://api.hiro.so/v2/accounts/${userAddress}?proof=0`);
        const data = await response.json();
        return parseFloat(data.balance) / 1_000_000; // Convert from microSTX
      } catch (error) {
        console.error('Error fetching STX balance:', error);
        return 0;
      }
    } else {
      // Token balance (SIP-010)
      try {
        const [contractAddress, contractName] = token.contractId.split('.');
        const response = await fetch(
          `https://api.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/get-balance`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: userAddress,
              arguments: [`0x0516${userAddress.slice(2)}`],
            }),
          }
        );
        const data = await response.json();
        if (data.okay && data.result) {
          const balance = parseInt(data.result.replace('0x', ''), 16);
          return balance / Math.pow(10, token.decimals);
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
      }
      return 0;
    }
  }, [userAddress]);

  // Fetch token balances when wallet is connected
  useEffect(() => {
    if (isConnected && userAddress) {
      const fetchBalances = async () => {
        const fromBal = await getTokenBalance(fromToken);
        const toBal = await getTokenBalance(toToken);
        setFromBalance(fromBal);
        setToBalance(toBal);
      };
      fetchBalances();
    } else {
      setFromBalance(null);
      setToBalance(null);
    }
  }, [isConnected, userAddress, fromToken, toToken, getTokenBalance]);

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
    setToAmount('');
  };

  // Execute swap transaction
  const handleSwap = async () => {
    if (!isConnected || !userAddress) {
      connectWallet();
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      return;
    }

    setSwapping(true);
    setTxStatus(null);

    try {
      const inputAmount = parseFloat(fromAmount);
      const inputAmountMicro = BigInt(Math.floor(inputAmount * Math.pow(10, fromToken.decimals)));
      const minOutputAmount = BigInt(Math.floor(parseFloat(toAmount) * (1 - slippage / 100) * Math.pow(10, toToken.decimals)));

      // Check balance
      const balance = await getTokenBalance(fromToken);
      if (balance < inputAmount) {
        setTxStatus({ error: `Insufficient balance. You have ${balance.toFixed(4)} ${fromToken.symbol}` });
        setSwapping(false);
        return;
      }

      const router = selectedDex.router;
      const contractId = `${router.contract}.${router.name}`;

      // Prepare function arguments based on DEX
      // Note: Each DEX has different swap function signatures
      // This is a simplified version - you may need to adjust based on actual contract ABIs
      let functionArgs: any[] = [];
      let contractCallOptions: any = {
        contract: contractId,
        functionName: router.swapFunction,
        functionArgs: functionArgs,
        postConditionMode: PostConditionMode.Allow,
        network: 'mainnet' as any,
      };

      if (selectedDex.id === 'alex') {
        // ALEX swap - simplified, may need adjustment based on actual ALEX contract
        functionArgs = [
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
        ];
        // For STX swaps, include STX amount
        if (fromToken.contractId === 'native') {
          contractCallOptions.stxAmount = inputAmountMicro.toString();
        }
      } else if (selectedDex.id === 'velar') {
        // Velar Uniswap V2 style - simplified
        functionArgs = [
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
          standardPrincipalCV(userAddress),
          uintCV(Math.floor(Date.now() / 1000) + 1800), // Deadline (30 min)
        ];
      } else {
        // Arkadiko format - simplified
        functionArgs = [
          uintCV(inputAmountMicro.toString()),
          uintCV(minOutputAmount.toString()),
        ];
      }

      contractCallOptions.functionArgs = functionArgs;

      // Execute swap via wallet
      const result = await request(
        {
          walletConnect: {
            projectId: 'e5f06d0d893851277f61878bdf812cbd',
          },
        },
        'stx_callContract',
        contractCallOptions
      );

      console.log('Swap transaction result:', result);
      
      if (result && result.txid) {
        setTxStatus({ txId: result.txid });
        // Reset form after successful transaction
        setTimeout(() => {
          setFromAmount('');
          setToAmount('');
          setTxStatus(null);
        }, 3000);
      } else {
        setTxStatus({ error: 'Transaction failed. Please try again.' });
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      setTxStatus({ 
        error: error?.message || 'Failed to execute swap. Please check your wallet and try again.' 
      });
    } finally {
      setSwapping(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.0001) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatAmount = (amount: string, price: number) => {
    const value = parseFloat(amount || '0') * price;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-xl p-4 border border-blue-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-lg">
            🔄
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Swap</h2>
            <p className="text-xs text-blue-300/70">Trade tokens</p>
          </div>
        </div>
        {/* Slippage */}
        <div className="flex items-center gap-1">
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

      {/* DEX Selector */}
      <div className="flex gap-1 mb-3">
        {DEX_LIST.map((dex) => (
          <button
            key={dex.id}
            onClick={() => setSelectedDex(dex)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
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

      {/* Transaction Status */}
      {txStatus && (
        <div className={`mb-3 p-3 rounded-lg border ${
          txStatus.txId 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {txStatus.txId ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-sm text-green-400 flex-1">
                Transaction submitted!
              </span>
              <a
                href={`https://explorer.stacks.co/txid/${txStatus.txId}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                View on Explorer
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-red-400">✗</span>
              <span className="text-sm text-red-400">{txStatus.error}</span>
            </div>
          )}
        </div>
      )}

      {/* From Token */}
      <div className="bg-black/30 rounded-xl p-3 border border-blue-500/20 mb-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-blue-300/70">From</span>
          {isConnected && fromBalance !== null && (
            <span className="text-xs text-blue-300/50">
              Bal: {fromBalance.toFixed(4)} {fromToken.symbol}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setShowFromTokenList(!showFromTokenList);
                setShowToTokenList(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-colors min-w-[90px]"
            >
              <span className="text-lg">{fromToken.icon}</span>
              <span className="font-medium text-white text-sm">{fromToken.symbol}</span>
              <span className="text-blue-300 text-xs">▼</span>
            </button>
            {showFromTokenList && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-gray-900 rounded-lg border border-blue-500/30 shadow-xl z-50 max-h-48 overflow-y-auto">
                {TOKENS.filter(t => t.symbol !== toToken.symbol).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setFromToken(token);
                      setShowFromTokenList(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-lg">{token.icon}</span>
                    <span className="text-white text-sm">{token.symbol}</span>
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
            className="flex-1 bg-transparent text-right text-lg font-bold text-white outline-none placeholder-blue-300/30 min-w-0"
          />
        </div>
        <div className="text-right text-xs text-blue-300/50 mt-1">
          ≈ {formatAmount(fromAmount, fromToken.price)}
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={swapTokens}
          className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg"
        >
          <span className="text-white text-sm">↕️</span>
        </button>
      </div>

      {/* To Token */}
      <div className="bg-black/30 rounded-xl p-3 border border-blue-500/20 mt-1 mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-blue-300/70">To</span>
          {isConnected && toBalance !== null && (
            <span className="text-xs text-blue-300/50">
              Bal: {toBalance.toFixed(4)} {toToken.symbol}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setShowToTokenList(!showToTokenList);
                setShowFromTokenList(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-500/20 rounded-lg hover:bg-blue-500/30 transition-colors min-w-[90px]"
            >
              <span className="text-lg">{toToken.icon}</span>
              <span className="font-medium text-white text-sm">{toToken.symbol}</span>
              <span className="text-blue-300 text-xs">▼</span>
            </button>
            {showToTokenList && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-gray-900 rounded-lg border border-blue-500/30 shadow-xl z-50 max-h-48 overflow-y-auto">
                {TOKENS.filter(t => t.symbol !== fromToken.symbol).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setToToken(token);
                      setShowToTokenList(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-lg">{token.icon}</span>
                    <span className="text-white text-sm">{token.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 text-right min-w-0">
            {loading ? (
              <div className="animate-pulse h-6 bg-blue-500/20 rounded w-20 ml-auto"></div>
            ) : (
              <p className="text-lg font-bold text-white truncate">{toAmount || '0.00'}</p>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-blue-300/50 mt-1">
          ≈ {formatAmount(toAmount, toToken.price)}
        </div>
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="bg-black/20 rounded-lg p-2 mb-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-blue-300/70">Rate</span>
            <span className="text-white truncate ml-2">
              1 {fromToken.symbol} = {(fromToken.price / toToken.price).toFixed(4)} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-300/70">Impact</span>
            <span className={quote.priceImpact > 1 ? 'text-yellow-400' : 'text-green-400'}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-300/70">Route</span>
            <span className="text-white">{quote.route.join(' → ')}</span>
          </div>
        </div>
      )}

      {/* Wallet Status & Swap Button */}
      {!isConnected ? (
        <button
          onClick={() => connectWallet()}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg transition-all"
        >
          🔗 Connect Wallet
        </button>
      ) : (
        <div className="space-y-2">
          {/* Connected Address */}
          <div className="flex items-center justify-center gap-2 py-2 px-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-green-400 font-mono truncate">
              {userAddress?.slice(0, 8)}...{userAddress?.slice(-4)}
            </span>
          </div>
          
          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapping}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
              !fromAmount || parseFloat(fromAmount) <= 0 || swapping
                ? 'bg-blue-500/20 text-blue-300/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-lg'
            }`}
          >
            {swapping ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Processing...
              </span>
            ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
              'Enter Amount'
            ) : (
              `Swap via ${selectedDex.name}`
            )}
          </button>
        </div>
      )}

      {/* Network Badge */}
      <div className="flex justify-center mt-3">
        <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs border border-green-500/20">
          ● Mainnet
        </span>
      </div>
    </div>
  );
};

export default SwapInterface;
