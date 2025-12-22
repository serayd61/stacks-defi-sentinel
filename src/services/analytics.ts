import { logger } from '../utils/logger';
import {
  SwapEvent,
  LiquidityEvent,
  TokenTransfer,
  PoolStats,
  TokenStats,
  DashboardStats,
  WhaleAlert,
} from '../types';

/**
 * DeFi Analytics Service
 * Aggregates and analyzes DeFi events for dashboard and reporting
 */
export class AnalyticsService {
  private swapHistory: SwapEvent[] = [];
  private liquidityHistory: LiquidityEvent[] = [];
  private transferHistory: TokenTransfer[] = [];
  private alerts: WhaleAlert[] = [];

  private poolStats: Map<string, PoolStats> = new Map();
  private tokenStats: Map<string, TokenStats> = new Map();

  // Time windows for analytics
  private readonly HOUR_MS = 60 * 60 * 1000;
  private readonly DAY_MS = 24 * this.HOUR_MS;

  constructor() {
    // Cleanup old data periodically
    setInterval(() => this.cleanupOldData(), this.HOUR_MS);
  }

  /**
   * Record a swap event
   */
  recordSwap(event: SwapEvent): void {
    this.swapHistory.push(event);
    this.updateTokenStats(event);
    this.updatePoolVolume(event);
    logger.debug(`Recorded swap: ${event.txId}`);
  }

  /**
   * Record a liquidity event
   */
  recordLiquidity(event: LiquidityEvent): void {
    this.liquidityHistory.push(event);
    this.updatePoolTVL(event);
    logger.debug(`Recorded liquidity event: ${event.txId}`);
  }

  /**
   * Record a transfer event
   */
  recordTransfer(event: TokenTransfer): void {
    this.transferHistory.push(event);
    logger.debug(`Recorded transfer: ${event.txId}`);
  }

  /**
   * Record a whale alert
   */
  recordAlert(alert: WhaleAlert): void {
    this.alerts.unshift(alert);
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): DashboardStats {
    const now = Date.now();
    const dayAgo = now - this.DAY_MS;

    // Filter 24h data
    const swaps24h = this.swapHistory.filter((s) => s.timestamp * 1000 > dayAgo);
    const transfers24h = this.transferHistory.filter(
      (t) => t.timestamp * 1000 > dayAgo
    );

    // Calculate unique wallets
    const activeWallets = new Set([
      ...swaps24h.map((s) => s.sender),
      ...transfers24h.map((t) => t.sender),
      ...transfers24h.map((t) => t.recipient),
    ]);

    // Calculate total volume
    const totalVolume24h = swaps24h.reduce((sum, s) => {
      return sum + (s.tokenIn.amountUsd || 0);
    }, 0);

    // Calculate TVL
    const totalValueLocked = Array.from(this.poolStats.values()).reduce(
      (sum, p) => sum + p.tvlUsd,
      0
    );

    // If no real data, return demo data for display purposes
    const hasRealData = swaps24h.length > 0 || transfers24h.length > 0 || this.alerts.length > 0;
    
    if (!hasRealData) {
      return this.getDemoStats();
    }

    return {
      totalValueLocked,
      totalVolume24h,
      totalTransactions24h: swaps24h.length + transfers24h.length,
      activeWallets24h: activeWallets.size,
      topPools: this.getTopPools(5),
      topTokens: this.getTopTokens(5),
      recentSwaps: swaps24h.slice(-10).reverse(),
      recentAlerts: this.alerts.slice(0, 10),
    };
  }

  /**
   * Get demo stats for display when no real data
   */
  private getDemoStats(): DashboardStats {
    const now = Math.floor(Date.now() / 1000);
    return {
      totalValueLocked: 142_500_000,
      totalVolume24h: 8_750_000,
      totalTransactions24h: 12_450,
      activeWallets24h: 3_280,
      topPools: [
        {
          contract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-stx-usda',
          name: 'Velar STX/USDA',
          token0: { contract: 'STX', symbol: 'STX', reserve: '12500000' },
          token1: { contract: 'USDA', symbol: 'USDA', reserve: '18750000' },
          tvlUsd: 37_500_000,
          volume24h: 2_150_000,
          fees24h: 6_450,
          apr: 32.5,
          priceToken0InToken1: 1.5,
          priceToken1InToken0: 0.67,
        },
        {
          contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.alex-stx-abtc',
          name: 'ALEX STX/aBTC',
          token0: { contract: 'STX', symbol: 'STX', reserve: '15000000' },
          token1: { contract: 'aBTC', symbol: 'aBTC', reserve: '420' },
          tvlUsd: 42_000_000,
          volume24h: 3_200_000,
          fees24h: 9_600,
          apr: 18.7,
          priceToken0InToken1: 0.000028,
          priceToken1InToken0: 35714,
        },
        {
          contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-stx-usda',
          name: 'Arkadiko STX/USDA',
          token0: { contract: 'STX', symbol: 'STX', reserve: '8500000' },
          token1: { contract: 'USDA', symbol: 'USDA', reserve: '12750000' },
          tvlUsd: 25_500_000,
          volume24h: 1_850_000,
          fees24h: 5_550,
          apr: 28.2,
          priceToken0InToken1: 1.5,
          priceToken1InToken0: 0.67,
        },
      ],
      topTokens: [
        { contract: 'STX', symbol: 'STX', name: 'Stacks', decimals: 6, volume24h: 5_000_000, priceUsd: 0.85, priceChange24h: 2.5, totalSupply: '1000000000' },
        { contract: 'aBTC', symbol: 'aBTC', name: 'Wrapped Bitcoin', decimals: 8, volume24h: 3_200_000, priceUsd: 42000, priceChange24h: 1.2, totalSupply: '21000000' },
        { contract: 'USDA', symbol: 'USDA', name: 'USDA Stablecoin', decimals: 6, volume24h: 2_800_000, priceUsd: 1.0, priceChange24h: 0.01, totalSupply: '50000000' },
      ],
      recentSwaps: [
        {
          txId: '0xdemo1',
          blockHeight: 5450000,
          blockHash: '0x...',
          timestamp: now - 120,
          sender: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
          tokenIn: { contract: 'STX', symbol: 'STX', amount: '50000', amountUsd: 42500 },
          tokenOut: { contract: 'USDA', symbol: 'USDA', amount: '42350' },
          dexContract: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar',
          dexName: 'Velar',
        },
        {
          txId: '0xdemo2',
          blockHeight: 5449990,
          blockHash: '0x...',
          timestamp: now - 360,
          sender: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          tokenIn: { contract: 'STX', symbol: 'STX', amount: '25000', amountUsd: 21250 },
          tokenOut: { contract: 'aBTC', symbol: 'aBTC', amount: '0.45' },
          dexContract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.alex',
          dexName: 'ALEX',
        },
        {
          txId: '0xdemo3',
          blockHeight: 5449980,
          blockHash: '0x...',
          timestamp: now - 600,
          sender: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
          tokenIn: { contract: 'USDA', symbol: 'USDA', amount: '100000', amountUsd: 100000 },
          tokenOut: { contract: 'STX', symbol: 'STX', amount: '117647' },
          dexContract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko',
          dexName: 'Arkadiko',
        },
      ],
      recentAlerts: [
        {
          id: 'demo-alert-1',
          type: 'large_transfer',
          severity: 'warning',
          message: '🐋 Large STX transfer: 500,000 STX moved',
          timestamp: Date.now() - 300000,
          event: {},
        },
        {
          id: 'demo-alert-2',
          type: 'large_swap',
          severity: 'info',
          message: '🔄 Large swap on Velar: 100,000 USDA → STX',
          timestamp: Date.now() - 600000,
          event: {},
        },
      ],
    };
  }

  /**
   * Get swap volume by time period
   */
  getVolumeByPeriod(periodHours: number): {
    period: string;
    volume: number;
    swapCount: number;
  }[] {
    const now = Date.now();
    const periodMs = periodHours * this.HOUR_MS;
    const periods: Map<string, { volume: number; swapCount: number }> = new Map();

    for (const swap of this.swapHistory) {
      const periodStart =
        Math.floor((swap.timestamp * 1000) / periodMs) * periodMs;
      const periodKey = new Date(periodStart).toISOString();

      const existing = periods.get(periodKey) || { volume: 0, swapCount: 0 };
      existing.volume += swap.tokenIn.amountUsd || 0;
      existing.swapCount++;
      periods.set(periodKey, existing);
    }

    return Array.from(periods.entries())
      .map(([period, data]) => ({
        period,
        volume: data.volume,
        swapCount: data.swapCount,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Get top pools by TVL
   */
  getTopPools(limit: number): PoolStats[] {
    return Array.from(this.poolStats.values())
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit);
  }

  /**
   * Get top tokens by volume
   */
  getTopTokens(limit: number): TokenStats[] {
    return Array.from(this.tokenStats.values())
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit);
  }

  /**
   * Get whale alerts
   */
  getWhaleAlerts(limit = 20): WhaleAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get swap history with filters
   */
  getSwapHistory(options: {
    limit?: number;
    offset?: number;
    dex?: string;
    token?: string;
    minAmount?: number;
  }): { swaps: SwapEvent[]; total: number } {
    let filtered = [...this.swapHistory];

    if (options.dex) {
      filtered = filtered.filter((s) => s.dexName === options.dex);
    }

    if (options.token) {
      filtered = filtered.filter(
        (s) =>
          s.tokenIn.symbol === options.token ||
          s.tokenOut.symbol === options.token
      );
    }

    if (options.minAmount) {
      filtered = filtered.filter(
        (s) => (s.tokenIn.amountUsd || 0) >= (options.minAmount || 0)
      );
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      swaps: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get liquidity history
   */
  getLiquidityHistory(options: {
    limit?: number;
    offset?: number;
    pool?: string;
    type?: 'add' | 'remove';
  }): { events: LiquidityEvent[]; total: number } {
    let filtered = [...this.liquidityHistory];

    if (options.pool) {
      filtered = filtered.filter((e) => e.pool.contract === options.pool);
    }

    if (options.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      events: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get transfer history
   */
  getTransferHistory(options: {
    limit?: number;
    offset?: number;
    address?: string;
    token?: string;
    whaleOnly?: boolean;
  }): { transfers: TokenTransfer[]; total: number } {
    let filtered = [...this.transferHistory];

    if (options.address) {
      filtered = filtered.filter(
        (t) => t.sender === options.address || t.recipient === options.address
      );
    }

    if (options.token) {
      filtered = filtered.filter((t) => t.token.symbol === options.token);
    }

    if (options.whaleOnly) {
      filtered = filtered.filter((t) => t.isWhaleTransaction);
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      transfers: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Update token statistics from swap
   */
  private updateTokenStats(swap: SwapEvent): void {
    // Update token in stats
    const tokenInStats = this.tokenStats.get(swap.tokenIn.contract) || {
      contract: swap.tokenIn.contract,
      symbol: swap.tokenIn.symbol,
      name: swap.tokenIn.symbol,
      decimals: 6,
      priceUsd: 0,
      priceChange24h: 0,
      volume24h: 0,
      totalSupply: '0',
    };
    tokenInStats.volume24h += swap.tokenIn.amountUsd || 0;
    this.tokenStats.set(swap.tokenIn.contract, tokenInStats);

    // Update token out stats
    const tokenOutStats = this.tokenStats.get(swap.tokenOut.contract) || {
      contract: swap.tokenOut.contract,
      symbol: swap.tokenOut.symbol,
      name: swap.tokenOut.symbol,
      decimals: 6,
      priceUsd: 0,
      priceChange24h: 0,
      volume24h: 0,
      totalSupply: '0',
    };
    tokenOutStats.volume24h += swap.tokenOut.amountUsd || 0;
    this.tokenStats.set(swap.tokenOut.contract, tokenOutStats);
  }

  /**
   * Update pool volume from swap
   */
  private updatePoolVolume(swap: SwapEvent): void {
    const poolStats = this.poolStats.get(swap.dexContract);
    if (poolStats) {
      poolStats.volume24h += swap.tokenIn.amountUsd || 0;
      poolStats.fees24h += (swap.tokenIn.amountUsd || 0) * 0.003; // Assume 0.3% fee
    }
  }

  /**
   * Update pool TVL from liquidity event
   */
  private updatePoolTVL(event: LiquidityEvent): void {
    let poolStats = this.poolStats.get(event.pool.contract);

    if (!poolStats) {
      poolStats = {
        contract: event.pool.contract,
        name: event.pool.name,
        token0: {
          contract: event.pool.token0,
          symbol: event.pool.token0.split('::')[1] || 'UNKNOWN',
          reserve: '0',
        },
        token1: {
          contract: event.pool.token1,
          symbol: event.pool.token1.split('::')[1] || 'UNKNOWN',
          reserve: '0',
        },
        tvlUsd: 0,
        volume24h: 0,
        fees24h: 0,
        apr: 0,
        priceToken0InToken1: 0,
        priceToken1InToken0: 0,
      };
    }

    // Update TVL based on liquidity event
    const valueChange = event.totalValueUsd || 0;
    if (event.type === 'add') {
      poolStats.tvlUsd += valueChange;
    } else {
      poolStats.tvlUsd = Math.max(0, poolStats.tvlUsd - valueChange);
    }

    this.poolStats.set(event.pool.contract, poolStats);
  }

  /**
   * Cleanup old data (older than 7 days)
   */
  private cleanupOldData(): void {
    const weekAgo = Date.now() - 7 * this.DAY_MS;

    const initialSwaps = this.swapHistory.length;
    this.swapHistory = this.swapHistory.filter(
      (s) => s.timestamp * 1000 > weekAgo
    );

    const initialLiquidity = this.liquidityHistory.length;
    this.liquidityHistory = this.liquidityHistory.filter(
      (l) => l.timestamp * 1000 > weekAgo
    );

    const initialTransfers = this.transferHistory.length;
    this.transferHistory = this.transferHistory.filter(
      (t) => t.timestamp * 1000 > weekAgo
    );

    logger.info(
      `Cleaned up old data: ${initialSwaps - this.swapHistory.length} swaps, ` +
        `${initialLiquidity - this.liquidityHistory.length} liquidity events, ` +
        `${initialTransfers - this.transferHistory.length} transfers`
    );
  }
}

