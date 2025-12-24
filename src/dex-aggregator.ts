/**
 * DEX Aggregator
 * Aggregates prices from multiple Stacks DEXes and finds best routes
 * Supports: ALEX, Velar, Arkadiko
 */

import { logger } from './logger';

// DEX Contract Addresses
export const DEX_CONTRACTS = {
  alex: {
    name: 'ALEX',
    router: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01',
    factory: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-registry-v2-01',
    logo: '🔷',
  },
  velar: {
    name: 'Velar',
    router: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router',
    factory: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core',
    logo: '🟣',
  },
  arkadiko: {
    name: 'Arkadiko',
    router: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1',
    factory: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-registry-v1-1',
    logo: '🏛️',
  },
};

// Common tokens on Stacks
export const TOKENS = {
  STX: {
    symbol: 'STX',
    name: 'Stacks',
    contract: 'native',
    decimals: 6,
    logo: '⚡',
  },
  sBTC: {
    symbol: 'sBTC',
    name: 'Stacks Bitcoin',
    contract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    decimals: 8,
    logo: '₿',
  },
  ALEX: {
    symbol: 'ALEX',
    name: 'ALEX Token',
    contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
    decimals: 8,
    logo: '🔷',
  },
  USDA: {
    symbol: 'USDA',
    name: 'Arkadiko USDA',
    contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
    decimals: 6,
    logo: '💵',
  },
  xBTC: {
    symbol: 'xBTC',
    name: 'Wrapped Bitcoin',
    contract: 'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin',
    decimals: 8,
    logo: '🟠',
  },
  WELSH: {
    symbol: 'WELSH',
    name: 'Welsh Corgi',
    contract: 'SP3NE50GEXFG9SZGFPWX4MPNMGVVQZ3SCDX5TQMB2.welshcorgicoin-token',
    decimals: 6,
    logo: '🐕',
  },
  VELAR: {
    symbol: 'VELAR',
    name: 'Velar Token',
    contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
    decimals: 8,
    logo: '🟣',
  },
};

export interface PriceQuote {
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

export interface AggregatedQuote {
  bestQuote: PriceQuote;
  allQuotes: PriceQuote[];
  savings: number; // % savings vs worst quote
  arbitrageOpportunity?: ArbitrageOpportunity;
}

export interface ArbitrageOpportunity {
  buyDex: string;
  sellDex: string;
  token: string;
  buyPrice: number;
  sellPrice: number;
  profitPercent: number;
  estimatedProfit: number;
}

// Cache for price data
const priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_TTL = 10000; // 10 seconds

/**
 * Fetch price from ALEX DEX
 */
async function fetchALEXPrice(tokenIn: string, tokenOut: string, amount: string): Promise<PriceQuote | null> {
  try {
    // ALEX uses pool-based pricing
    const response = await fetch('https://api.alexgo.io/v1/pool_token_stats');
    const data = await response.json();
    
    // Find relevant pool
    const pools = data.data || [];
    const relevantPool = pools.find((p: any) => 
      (p.token_x_symbol === tokenIn && p.token_y_symbol === tokenOut) ||
      (p.token_y_symbol === tokenIn && p.token_x_symbol === tokenOut)
    );

    if (relevantPool) {
      const isReverse = relevantPool.token_y_symbol === tokenIn;
      const price = isReverse ? 1 / relevantPool.price : relevantPool.price;
      const inputNum = parseFloat(amount);
      const outputNum = inputNum * price;

      return {
        dex: 'ALEX',
        dexLogo: '🔷',
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: amount,
        outputAmount: outputNum.toFixed(6),
        price,
        priceImpact: inputNum > 1000 ? 0.5 : 0.1, // Estimated
        fee: 0.3, // 0.3% fee
        route: [tokenIn, tokenOut],
        estimatedGas: 0.01,
      };
    }
    return null;
  } catch (error) {
    logger.error('Error fetching ALEX price:', error);
    return null;
  }
}

/**
 * Fetch price from Velar DEX
 */
async function fetchVelarPrice(tokenIn: string, tokenOut: string, amount: string): Promise<PriceQuote | null> {
  try {
    const response = await fetch('https://api.velar.co/pools');
    const data = await response.json();
    
    const pools = data.data || data || [];
    const relevantPool = pools.find((p: any) => 
      (p.token0?.symbol === tokenIn && p.token1?.symbol === tokenOut) ||
      (p.token1?.symbol === tokenIn && p.token0?.symbol === tokenOut)
    );

    if (relevantPool) {
      const reserve0 = parseFloat(relevantPool.reserve0 || '0');
      const reserve1 = parseFloat(relevantPool.reserve1 || '0');
      const isReverse = relevantPool.token1?.symbol === tokenIn;
      
      let price = 0;
      if (isReverse && reserve0 > 0) {
        price = reserve1 / reserve0;
      } else if (reserve1 > 0) {
        price = reserve0 / reserve1;
      }

      const inputNum = parseFloat(amount);
      const outputNum = inputNum * price;

      return {
        dex: 'Velar',
        dexLogo: '🟣',
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: amount,
        outputAmount: outputNum.toFixed(6),
        price,
        priceImpact: inputNum > 1000 ? 0.8 : 0.2,
        fee: 0.3,
        route: [tokenIn, tokenOut],
        estimatedGas: 0.01,
      };
    }
    return null;
  } catch (error) {
    logger.error('Error fetching Velar price:', error);
    return null;
  }
}

/**
 * Fetch price from Arkadiko DEX
 */
async function fetchArkadikoPrice(tokenIn: string, tokenOut: string, amount: string): Promise<PriceQuote | null> {
  try {
    // Arkadiko API for swap quotes
    const response = await fetch('https://api.arkadiko.finance/api/v1/pools');
    const data = await response.json();
    
    const pools = data || [];
    const relevantPool = pools.find((p: any) => 
      (p.token_x === tokenIn && p.token_y === tokenOut) ||
      (p.token_y === tokenIn && p.token_x === tokenOut)
    );

    if (relevantPool) {
      const isReverse = relevantPool.token_y === tokenIn;
      const price = isReverse 
        ? relevantPool.balance_y / relevantPool.balance_x 
        : relevantPool.balance_x / relevantPool.balance_y;

      const inputNum = parseFloat(amount);
      const outputNum = inputNum * price;

      return {
        dex: 'Arkadiko',
        dexLogo: '🏛️',
        inputToken: tokenIn,
        outputToken: tokenOut,
        inputAmount: amount,
        outputAmount: outputNum.toFixed(6),
        price,
        priceImpact: inputNum > 1000 ? 0.6 : 0.15,
        fee: 0.3,
        route: [tokenIn, tokenOut],
        estimatedGas: 0.01,
      };
    }
    return null;
  } catch (error) {
    logger.error('Error fetching Arkadiko price:', error);
    return null;
  }
}

/**
 * Get aggregated quote from all DEXes
 */
export async function getAggregatedQuote(
  tokenIn: string,
  tokenOut: string,
  amount: string
): Promise<AggregatedQuote | null> {
  try {
    const [alexQuote, velarQuote, arkadikoQuote] = await Promise.all([
      fetchALEXPrice(tokenIn, tokenOut, amount),
      fetchVelarPrice(tokenIn, tokenOut, amount),
      fetchArkadikoPrice(tokenIn, tokenOut, amount),
    ]);

    const allQuotes = [alexQuote, velarQuote, arkadikoQuote].filter(
      (q): q is PriceQuote => q !== null
    );

    if (allQuotes.length === 0) {
      return null;
    }

    // Sort by output amount (highest first)
    allQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    const bestQuote = allQuotes[0];
    const worstQuote = allQuotes[allQuotes.length - 1];
    
    const bestOutput = parseFloat(bestQuote.outputAmount);
    const worstOutput = parseFloat(worstQuote.outputAmount);
    const savings = worstOutput > 0 ? ((bestOutput - worstOutput) / worstOutput) * 100 : 0;

    // Check for arbitrage opportunities
    const arbitrageOpportunity = detectArbitrage(allQuotes, tokenIn, tokenOut);

    return {
      bestQuote,
      allQuotes,
      savings,
      arbitrageOpportunity,
    };
  } catch (error) {
    logger.error('Error getting aggregated quote:', error);
    return null;
  }
}

/**
 * Detect arbitrage opportunities between DEXes
 */
function detectArbitrage(
  quotes: PriceQuote[],
  tokenIn: string,
  tokenOut: string
): ArbitrageOpportunity | null {
  if (quotes.length < 2) return null;

  const prices = quotes.map(q => ({
    dex: q.dex,
    price: q.price,
  }));

  const highestPrice = prices.reduce((max, p) => p.price > max.price ? p : max);
  const lowestPrice = prices.reduce((min, p) => p.price < min.price ? p : min);

  const profitPercent = ((highestPrice.price - lowestPrice.price) / lowestPrice.price) * 100;

  // Only report if profit > 0.5% (accounting for fees)
  if (profitPercent > 0.5) {
    return {
      buyDex: lowestPrice.dex,
      sellDex: highestPrice.dex,
      token: tokenOut,
      buyPrice: lowestPrice.price,
      sellPrice: highestPrice.price,
      profitPercent,
      estimatedProfit: profitPercent - 0.6, // Subtract fees
    };
  }

  return null;
}

/**
 * Get all arbitrage opportunities across token pairs
 */
export async function scanArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
  const opportunities: ArbitrageOpportunity[] = [];
  
  const pairs = [
    ['STX', 'sBTC'],
    ['STX', 'ALEX'],
    ['STX', 'USDA'],
    ['STX', 'xBTC'],
    ['sBTC', 'USDA'],
    ['ALEX', 'USDA'],
  ];

  for (const [tokenIn, tokenOut] of pairs) {
    try {
      const quote = await getAggregatedQuote(tokenIn, tokenOut, '1000');
      if (quote?.arbitrageOpportunity) {
        opportunities.push(quote.arbitrageOpportunity);
      }
    } catch (error) {
      // Continue with next pair
    }
  }

  // Sort by profit
  opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  
  return opportunities;
}

/**
 * Get token price in USD
 */
export async function getTokenPriceUSD(token: string): Promise<number> {
  const cacheKey = `price_${token}`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    // Map token symbols to CoinGecko IDs
    const geckoIds: Record<string, string> = {
      STX: 'blockstack',
      sBTC: 'bitcoin',
      xBTC: 'bitcoin',
      ALEX: 'alex-lab',
      USDA: 'usd-coin', // Approximation
    };

    const geckoId = geckoIds[token];
    if (!geckoId) return 0;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`
    );
    const data = await response.json();
    const price = data[geckoId]?.usd || 0;

    priceCache.set(cacheKey, { price, timestamp: Date.now() });
    
    return price;
  } catch (error) {
    logger.error(`Error fetching ${token} price:`, error);
    return 0;
  }
}

/**
 * Get all supported tokens
 */
export function getSupportedTokens() {
  return Object.values(TOKENS);
}

/**
 * Get all DEX info
 */
export function getDEXInfo() {
  return Object.values(DEX_CONTRACTS);
}

export default {
  getAggregatedQuote,
  scanArbitrageOpportunities,
  getTokenPriceUSD,
  getSupportedTokens,
  getDEXInfo,
  DEX_CONTRACTS,
  TOKENS,
};

