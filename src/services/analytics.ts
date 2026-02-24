import { logger } from '../utils/logger';
import {
  SwapEvent,
  LiquidityEvent,
  TokenTransfer,
  PoolStats,
  TokenStats,
  DashboardStats,
  WhaleAlert,
  WalletCluster,
  ClusterSummary,
  DivergenceSignal,
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
  private clusterData: WalletCluster[] = [];
  private clusterSummary: ClusterSummary | null = null;
  private divergenceSignals: DivergenceSignal[] = [];

  private readonly HOUR_MS = 60 * 60 * 1000;
  private readonly DAY_MS = 24 * this.HOUR_MS;

  constructor() {
    setInterval(() => this.cleanupOldData(), this.HOUR_MS);
  }

  recordSwap(event: SwapEvent): void {
    this.swapHistory.push(event);
    logger.debug(`Recorded swap: ${event.txId}`);
  }

  recordLiquidity(event: LiquidityEvent): void {
    this.liquidityHistory.push(event);
    logger.debug(`Recorded liquidity event: ${event.txId}`);
  }

  recordTransfer(event: TokenTransfer): void {
    this.transferHistory.push(event);
    logger.debug(`Recorded transfer: ${event.txId}`);
  }

  recordAlert(alert: WhaleAlert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
  }

  getDashboardStats(): DashboardStats {
    const now = Date.now();
    const dayAgo = now - this.DAY_MS;

    const swaps24h = this.swapHistory.filter((s) => new Date(s.timestamp).getTime() > dayAgo);
    const transfers24h = this.transferHistory.filter((t) => new Date(t.timestamp).getTime() > dayAgo);

    const activeWallets = new Set([
      ...swaps24h.map((s) => s.sender),
      ...transfers24h.map((t) => t.from),
      ...transfers24h.map((t) => t.to),
    ]);

    const totalVolume24h = swaps24h.reduce((sum, s) => sum + s.amountIn, 0);
    const totalValueLocked = Array.from(this.poolStats.values()).reduce((sum, p) => sum + p.tvl, 0);

    return {
      totalValueLocked,
      totalVolume24h,
      totalTransactions24h: swaps24h.length + transfers24h.length,
      activeWallets24h: activeWallets.size,
      topPools: this.getTopPools(5),
      recentSwaps: swaps24h.slice(-10).reverse(),
      recentAlerts: this.alerts.slice(0, 10),
    };
  }

  getTopPools(limit: number): PoolStats[] {
    return Array.from(this.poolStats.values())
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit);
  }

  getTopTokens(limit: number): TokenStats[] {
    return Array.from(this.tokenStats.values())
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit);
  }

  getWhaleAlerts(limit = 20): WhaleAlert[] {
    return this.alerts.slice(0, limit);
  }

  // ── Cluster Data ────────────────────────────────────
  recordClusterUpdate(summary: ClusterSummary, clusters: WalletCluster[]): void {
    this.clusterSummary = summary;
    this.clusterData = clusters;
    logger.info(`Cluster data updated: ${clusters.length} clusters`);
  }

  getClusters(): ClusterSummary & { clusters: WalletCluster[] } {
    return {
      ...(this.clusterSummary || {
        totalClusters: 0, whaleGroups: 0, botNetworks: 0, exchanges: 0,
        marketMakers: 0, retail: 0, smartMoneyCount: 0, smartMoneyClusters: [],
        topAccumulators: [], topDistributors: [], totalWallets: 0,
        lastUpdate: '',
      }),
      clusters: this.clusterData,
    };
  }

  getClusterById(id: string): WalletCluster | undefined {
    return this.clusterData.find((c) => c.id === id);
  }

  getClusterByWallet(address: string): WalletCluster | undefined {
    return this.clusterData.find((c) => c.wallets.includes(address));
  }

  // ── Divergence Signals ──────────────────────────────
  recordDivergenceSignal(signal: DivergenceSignal): void {
    this.divergenceSignals.unshift(signal);
    if (this.divergenceSignals.length > 50) {
      this.divergenceSignals = this.divergenceSignals.slice(0, 50);
    }
    logger.info(`Divergence signal: ${signal.type} strength=${signal.strength}`);
  }

  getDivergenceSignals(limit = 20): DivergenceSignal[] {
    return this.divergenceSignals.slice(0, limit);
  }

  private cleanupOldData(): void {
    const weekAgo = Date.now() - 7 * this.DAY_MS;

    this.swapHistory = this.swapHistory.filter((s) => new Date(s.timestamp).getTime() > weekAgo);
    this.liquidityHistory = this.liquidityHistory.filter((l) => new Date(l.timestamp).getTime() > weekAgo);
    this.transferHistory = this.transferHistory.filter((t) => new Date(t.timestamp).getTime() > weekAgo);

    logger.info('Cleaned up old analytics data');
  }
}
