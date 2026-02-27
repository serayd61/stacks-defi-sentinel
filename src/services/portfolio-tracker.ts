/**
 * Portfolio Tracker Service
 * Aggregates user's DeFi positions across Stacks ecosystem:
 * - Token balances (STX, SIP-010 tokens)
 * - LP positions (ALEX, Velar, Arkadiko)
 * - Stacking positions (PoX, Liquid Stacking)
 * - NFT holdings
 */

import { logger } from '../utils/logger';
import { getOracleService } from './oracle-aggregator';

const HIRO_API = 'https://api.mainnet.hiro.so';

// Known token contracts
const KNOWN_TOKENS: Record<string, { name: string; symbol: string; decimals: number }> = {
  'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token': { name: 'Stacked STX', symbol: 'stSTX', decimals: 6 },
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token': { name: 'USDA', symbol: 'USDA', decimals: 6 },
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.age000-governance-token': { name: 'ALEX', symbol: 'ALEX', decimals: 8 },
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token': { name: 'DIKO', symbol: 'DIKO', decimals: 6 },
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token': { name: 'VELAR', symbol: 'VELAR', decimals: 6 },
  'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': { name: 'Welsh Corgi', symbol: 'WELSH', decimals: 6 },
  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': { name: 'sBTC', symbol: 'sBTC', decimals: 8 },
};

// LP Token contracts
const LP_TOKENS: Record<string, { dex: string; pair: string }> = {
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.fwp-wstx-alex-50-50-v1-01': { dex: 'ALEX', pair: 'STX-ALEX' },
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.fwp-wstx-usda-50-50-v1-01': { dex: 'ALEX', pair: 'STX-USDA' },
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-token-wstx-usda': { dex: 'Arkadiko', pair: 'STX-USDA' },
};

interface TokenBalance {
  contract: string;
  name: string;
  symbol: string;
  balance: number;
  balanceRaw: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}

interface LPPosition {
  contract: string;
  dex: string;
  pair: string;
  lpTokens: number;
  valueUsd: number;
  token0Amount: number;
  token1Amount: number;
}

interface StackingPosition {
  type: 'pox' | 'liquid';
  protocol: string;
  amountStx: number;
  valueUsd: number;
  unlockHeight?: number;
  rewards?: number;
}

interface NFTHolding {
  contract: string;
  name: string;
  count: number;
  floorPrice?: number;
  totalValue?: number;
}

interface PortfolioSummary {
  address: string;
  totalValueUsd: number;
  stxBalance: number;
  stxValueUsd: number;
  tokens: TokenBalance[];
  lpPositions: LPPosition[];
  stackingPositions: StackingPosition[];
  nfts: NFTHolding[];
  lastUpdated: number;
}

export class PortfolioTrackerService {
  private cache: Map<string, { data: PortfolioSummary; expires: number }> = new Map();
  private cacheTtlMs = 60000; // 1 minute cache

  async getPortfolio(address: string): Promise<PortfolioSummary> {
    // Check cache
    const cached = this.cache.get(address);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    logger.info(`Fetching portfolio for ${address}`);

    const [stxBalance, tokenBalances, nfts, stackingInfo] = await Promise.all([
      this.fetchSTXBalance(address),
      this.fetchTokenBalances(address),
      this.fetchNFTs(address),
      this.fetchStackingInfo(address),
    ]);

    const oracleService = getOracleService();
    const stxPrice = oracleService.getPrice('STX')?.price || 0;

    // Calculate token values
    const tokens = tokenBalances.map(token => {
      const price = oracleService.getPrice(token.symbol)?.price || 0;
      return {
        ...token,
        priceUsd: price,
        valueUsd: token.balance * price,
      };
    });

    // Calculate LP positions (simplified - would need DEX-specific APIs for accurate values)
    const lpPositions: LPPosition[] = [];

    // Calculate stacking positions
    const stackingPositions: StackingPosition[] = [];
    if (stackingInfo.locked > 0) {
      stackingPositions.push({
        type: 'pox',
        protocol: 'PoX',
        amountStx: stackingInfo.locked / 1_000_000,
        valueUsd: (stackingInfo.locked / 1_000_000) * stxPrice,
        unlockHeight: stackingInfo.unlockHeight,
      });
    }

    // Check for liquid staking (stSTX)
    const stSTX = tokens.find(t => t.symbol === 'stSTX');
    if (stSTX && stSTX.balance > 0) {
      stackingPositions.push({
        type: 'liquid',
        protocol: 'StackingDAO',
        amountStx: stSTX.balance,
        valueUsd: stSTX.balance * stxPrice,
      });
    }

    const stxValueUsd = (stxBalance / 1_000_000) * stxPrice;
    const tokensValueUsd = tokens.reduce((sum, t) => sum + t.valueUsd, 0);
    const lpValueUsd = lpPositions.reduce((sum, lp) => sum + lp.valueUsd, 0);
    const stackingValueUsd = stackingPositions.reduce((sum, s) => sum + s.valueUsd, 0);

    const portfolio: PortfolioSummary = {
      address,
      totalValueUsd: stxValueUsd + tokensValueUsd + lpValueUsd,
      stxBalance: stxBalance / 1_000_000,
      stxValueUsd,
      tokens: tokens.filter(t => t.balance > 0),
      lpPositions,
      stackingPositions,
      nfts,
      lastUpdated: Date.now(),
    };

    // Cache result
    this.cache.set(address, {
      data: portfolio,
      expires: Date.now() + this.cacheTtlMs,
    });

    return portfolio;
  }

  private async fetchSTXBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json() as { stx?: { balance?: string } };
      return parseInt(data.stx?.balance || '0');
    } catch (error) {
      logger.error(`Failed to fetch STX balance for ${address}:`, error);
      return 0;
    }
  }

  private async fetchTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const response = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json() as { fungible_tokens?: Record<string, { balance?: string }> };
      const tokens: TokenBalance[] = [];

      // Process fungible tokens
      for (const [contract, info] of Object.entries(data.fungible_tokens || {})) {
        const tokenInfo = KNOWN_TOKENS[contract];
        const balance = parseInt(info.balance || '0');
        
        if (balance > 0) {
          tokens.push({
            contract,
            name: tokenInfo?.name || contract.split('.')[1] || 'Unknown',
            symbol: tokenInfo?.symbol || '???',
            balance: balance / Math.pow(10, tokenInfo?.decimals || 6),
            balanceRaw: balance.toString(),
            decimals: tokenInfo?.decimals || 6,
            priceUsd: 0,
            valueUsd: 0,
          });
        }
      }

      return tokens;
    } catch (error) {
      logger.error(`Failed to fetch token balances for ${address}:`, error);
      return [];
    }
  }

  private async fetchNFTs(address: string): Promise<NFTHolding[]> {
    try {
      const response = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json() as { non_fungible_tokens?: Record<string, { count?: string }> };
      const nfts: NFTHolding[] = [];

      // Process NFTs
      for (const [contract, info] of Object.entries(data.non_fungible_tokens || {})) {
        const count = parseInt(info.count || '0');
        
        if (count > 0) {
          nfts.push({
            contract,
            name: contract.split('.')[1] || 'Unknown NFT',
            count,
          });
        }
      }

      return nfts;
    } catch (error) {
      logger.error(`Failed to fetch NFTs for ${address}:`, error);
      return [];
    }
  }

  private async fetchStackingInfo(address: string): Promise<{ locked: number; unlockHeight?: number }> {
    try {
      const response = await fetch(`${HIRO_API}/extended/v1/address/${address}/stx`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json() as { locked?: string; unlock_height?: number };
      return {
        locked: parseInt(data.locked || '0'),
        unlockHeight: data.unlock_height,
      };
    } catch (error) {
      logger.error(`Failed to fetch stacking info for ${address}:`, error);
      return { locked: 0 };
    }
  }

  // Get portfolio breakdown by category
  getPortfolioBreakdown(portfolio: PortfolioSummary): {
    stx: { value: number; percentage: number };
    tokens: { value: number; percentage: number };
    lp: { value: number; percentage: number };
    stacking: { value: number; percentage: number };
  } {
    const total = portfolio.totalValueUsd || 1;
    const tokensValue = portfolio.tokens.reduce((sum, t) => sum + t.valueUsd, 0);
    const lpValue = portfolio.lpPositions.reduce((sum, lp) => sum + lp.valueUsd, 0);
    const stackingValue = portfolio.stackingPositions.reduce((sum, s) => sum + s.valueUsd, 0);

    return {
      stx: {
        value: portfolio.stxValueUsd,
        percentage: (portfolio.stxValueUsd / total) * 100,
      },
      tokens: {
        value: tokensValue,
        percentage: (tokensValue / total) * 100,
      },
      lp: {
        value: lpValue,
        percentage: (lpValue / total) * 100,
      },
      stacking: {
        value: stackingValue,
        percentage: (stackingValue / total) * 100,
      },
    };
  }

  clearCache(address?: string): void {
    if (address) {
      this.cache.delete(address);
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
let portfolioService: PortfolioTrackerService | null = null;

export function getPortfolioService(): PortfolioTrackerService {
  if (!portfolioService) {
    portfolioService = new PortfolioTrackerService();
  }
  return portfolioService;
}
