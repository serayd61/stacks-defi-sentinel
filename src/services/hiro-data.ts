/**
 * Hiro Data Service
 * Actively polls Hiro Stacks API to populate analytics with real blockchain data.
 * Replaces the "wait for webhooks" model with active polling.
 */

import { logger } from '../utils/logger';
import { AnalyticsService } from './analytics';
import { EventProcessor } from './event-processor';
import {
  SwapEvent,
  TokenTransfer,
  WhaleAlert,
  PoolStats,
  TokenStats,
} from '../types';

const HIRO_API = 'https://api.hiro.so';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Known DEX contracts and their swap function names
const DEX_SWAP_FUNCTIONS = [
  'swap-exact-tokens-for-tokens',
  'swap-tokens-for-exact-tokens',
  'swap-helper',
  'swap-x-for-y',
  'swap-y-for-x',
  'execute-swaps',
  'swap',
];

const KNOWN_DEX_CONTRACTS = [
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router',     // Velar
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1', // Arkadiko
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01',    // ALEX
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-swap-v1',     // ALEX legacy
];

// Token contract addresses for balance lookups
const MONITORED_TOKEN_CONTRACTS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token': { symbol: 'stSTX', name: 'Stacked STX', decimals: 6 },
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token': { symbol: 'USDA', name: 'Arkadiko USDA', decimals: 6 },
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex': { symbol: 'ALEX', name: 'ALEX Token', decimals: 8 },
  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': { symbol: 'sBTC', name: 'Stacks Bitcoin', decimals: 8 },
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token': { symbol: 'VELAR', name: 'Velar', decimals: 8 },
  'SP3NE50GEXFG9SZGFPWX4MPNMGVVQZ3SCDX5TQMB2.welshcorgicoin-token': { symbol: 'WELSH', name: 'Welsh Corgi', decimals: 6 },
};

// CoinGecko ID mapping
const GECKO_IDS: Record<string, string> = {
  STX: 'blockstack',
  BTC: 'bitcoin',
  sBTC: 'bitcoin',
};

export interface HiroDataServiceOptions {
  pollIntervalMs?: number;
  whaleThresholdStx?: number;
}

export class HiroDataService {
  private analytics: AnalyticsService;
  private eventProcessor: EventProcessor;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs: number;
  private whaleThresholdMicro: number;
  private lastSeenTxIds: Set<string> = new Set();
  private stxPriceUsd = 0;
  private btcPriceUsd = 0;

  // Cached network info
  private networkInfo: {
    stacksHeight: number;
    burnHeight: number;
    peerCount: number;
  } = { stacksHeight: 0, burnHeight: 0, peerCount: 0 };

  private supplyInfo: {
    totalSupply: number;
    circulatingSupply: number;
    lockedSupply: number;
  } = { totalSupply: 0, circulatingSupply: 0, lockedSupply: 0 };

  private stackingInfo: {
    currentCycle: number;
    totalStacked: number;
    rewardCycleLengthBlocks: number;
    minAmountUstx: number;
    nextCycleInBlocks: number;
  } | null = null;

  constructor(
    analytics: AnalyticsService,
    eventProcessor: EventProcessor,
    options: HiroDataServiceOptions = {}
  ) {
    this.analytics = analytics;
    this.eventProcessor = eventProcessor;
    this.pollIntervalMs = options.pollIntervalMs || 30_000; // 30 seconds default
    this.whaleThresholdMicro = (options.whaleThresholdStx || 10_000) * 1_000_000;
  }

  async start(): Promise<void> {
    logger.info('Starting Hiro Data Service...');

    // Initial data fetch
    await this.pollAll();

    // Start periodic polling
    this.pollInterval = setInterval(() => {
      this.pollAll().catch((err) => logger.error('Hiro polling error:', err));
    }, this.pollIntervalMs);

    logger.info(`Hiro Data Service started (polling every ${this.pollIntervalMs / 1000}s)`);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('Hiro Data Service stopped');
  }

  async pollAll(): Promise<void> {
    const start = Date.now();

    await Promise.allSettled([
      this.fetchPrices(),
      this.fetchRecentTransfers(),
      this.fetchDexSwaps(),
      this.fetchNetworkInfo(),
      this.fetchSupplyData(),
      this.fetchStackingInfo(),
      this.fetchTokenMetadata(),
      this.fetchPoolData(),
    ]);

    logger.debug(`Hiro poll completed in ${Date.now() - start}ms`);
  }

  // ── Price Data ─────────────────────────────────────────────────────────────

  private async fetchPrices(): Promise<void> {
    try {
      const res = await fetch(
        `${COINGECKO_API}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );
      if (!res.ok) return;

      const data = await res.json() as Record<string, {
        usd?: number;
        usd_24h_change?: number;
        usd_market_cap?: number;
        usd_24h_vol?: number;
      }>;

      const stx = data['blockstack'];
      const btc = data['bitcoin'];

      if (stx?.usd) {
        this.stxPriceUsd = stx.usd;
        this.analytics.updateTokenStats('STX', {
          symbol: 'STX',
          name: 'Stacks',
          price: stx.usd,
          change24h: stx.usd_24h_change || 0,
          volume24h: stx.usd_24h_vol || 0,
          marketCap: stx.usd_market_cap || 0,
        });
      }

      if (btc?.usd) {
        this.btcPriceUsd = btc.usd;
        this.analytics.updateTokenStats('BTC', {
          symbol: 'BTC',
          name: 'Bitcoin',
          price: btc.usd,
          change24h: btc.usd_24h_change || 0,
          volume24h: btc.usd_24h_vol || 0,
          marketCap: btc.usd_market_cap || 0,
        });
      }
    } catch (err) {
      logger.warn('Failed to fetch prices:', err);
    }
  }

  // ── Large STX Transfers (Whale Alerts) ─────────────────────────────────────

  private async fetchRecentTransfers(): Promise<void> {
    try {
      const res = await fetch(
        `${HIRO_API}/extended/v1/tx?type=token_transfer&limit=50&order=desc&order_by=block_height`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return;

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const txs = data.results || [];

      for (const tx of txs) {
        const txId = tx['tx_id'] as string;
        if (!txId || this.lastSeenTxIds.has(txId)) continue;

        const tt = tx['token_transfer'] as Record<string, unknown> | undefined;
        if (!tt) continue;

        const amountMicro = Number(tt['amount'] ?? 0);
        const amountStx = amountMicro / 1_000_000;

        // Record all transfers
        const transfer: TokenTransfer = {
          txId,
          token: 'STX',
          from: tx['sender_address'] as string || '',
          to: (tt['recipient_address'] as string) || '',
          amount: amountStx,
          timestamp: (tx['burn_block_time_iso'] as string) || new Date().toISOString(),
          blockHeight: (tx['block_height'] as number) || 0,
        };
        this.analytics.recordTransfer(transfer);

        // Whale alerts for large transfers
        if (amountMicro >= this.whaleThresholdMicro) {
          const alert: WhaleAlert = {
            id: `whale-${txId}`,
            type: 'large_transfer',
            token: 'STX',
            amount: amountStx,
            from: transfer.from,
            to: transfer.to,
            txId,
            timestamp: transfer.timestamp,
          };
          this.analytics.recordAlert(alert);
          this.eventProcessor.emit('whale-alert', alert);
        }

        this.lastSeenTxIds.add(txId);
      }

      // Keep set manageable
      if (this.lastSeenTxIds.size > 1000) {
        const arr = Array.from(this.lastSeenTxIds);
        this.lastSeenTxIds = new Set(arr.slice(-500));
      }
    } catch (err) {
      logger.warn('Failed to fetch transfers:', err);
    }
  }

  // ── DEX Swap Activity ──────────────────────────────────────────────────────

  private async fetchDexSwaps(): Promise<void> {
    try {
      const res = await fetch(
        `${HIRO_API}/extended/v1/tx?type=contract_call&limit=50&order=desc&order_by=block_height`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return;

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const txs = data.results || [];

      let swapCount = 0;

      for (const tx of txs) {
        const txId = tx['tx_id'] as string;
        if (!txId || this.lastSeenTxIds.has(txId)) continue;

        const cc = tx['contract_call'] as Record<string, unknown> | undefined;
        if (!cc) continue;

        const contractId = cc['contract_id'] as string || '';
        const functionName = cc['function_name'] as string || '';

        // Check if this is a DEX swap
        const isDexSwap = KNOWN_DEX_CONTRACTS.some((c) => contractId.includes(c.split('.')[0])) &&
          DEX_SWAP_FUNCTIONS.some((f) => functionName.toLowerCase().includes(f.replace(/-/g, '').toLowerCase()) ||
            functionName.toLowerCase().includes('swap'));

        if (isDexSwap) {
          const swap: SwapEvent = {
            txId,
            pool: contractId,
            tokenIn: 'STX',
            tokenOut: 'Token',
            amountIn: this.stxPriceUsd > 0 ? (Number(tx['fee_rate'] || 0) / 1_000_000) : 0,
            amountOut: 0,
            sender: tx['sender_address'] as string || '',
            timestamp: (tx['burn_block_time_iso'] as string) || new Date().toISOString(),
            blockHeight: (tx['block_height'] as number) || 0,
          };
          this.analytics.recordSwap(swap);
          this.eventProcessor.emit('swap', swap);
          swapCount++;
        }

        this.lastSeenTxIds.add(txId);
      }

      if (swapCount > 0) {
        logger.debug(`Recorded ${swapCount} new DEX swaps`);
      }
    } catch (err) {
      logger.warn('Failed to fetch DEX swaps:', err);
    }
  }

  // ── Network Info ───────────────────────────────────────────────────────────

  private async fetchNetworkInfo(): Promise<void> {
    try {
      const res = await fetch(`${HIRO_API}/v2/info`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json() as Record<string, unknown>;
      this.networkInfo = {
        stacksHeight: (data['stacks_tip_height'] as number) || 0,
        burnHeight: (data['burn_block_height'] as number) || 0,
        peerCount: (data['peer_count'] as number) || 0,
      };
    } catch (err) {
      logger.warn('Failed to fetch network info:', err);
    }
  }

  // ── STX Supply ─────────────────────────────────────────────────────────────

  private async fetchSupplyData(): Promise<void> {
    try {
      const res = await fetch(`${HIRO_API}/extended/v1/stx_supply`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json() as Record<string, unknown>;
      this.supplyInfo = {
        totalSupply: parseFloat(data['total_stx'] as string || '0'),
        circulatingSupply: parseFloat(data['unlocked_stx'] as string || '0'),
        lockedSupply: parseFloat(data['locked_stx'] as string || '0'),
      };
    } catch (err) {
      logger.warn('Failed to fetch supply data:', err);
    }
  }

  // ── Stacking (PoX) Info ────────────────────────────────────────────────────

  private async fetchStackingInfo(): Promise<void> {
    try {
      const res = await fetch(`${HIRO_API}/v2/pox`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json() as Record<string, unknown>;
      const currentCycle = data['current_cycle'] as Record<string, unknown> | undefined;

      this.stackingInfo = {
        currentCycle: (currentCycle?.['id'] as number) || 0,
        totalStacked: Number(currentCycle?.['stacked_ustx'] || 0) / 1_000_000,
        rewardCycleLengthBlocks: (data['reward_cycle_length'] as number) || 2100,
        minAmountUstx: Number(data['min_amount_ustx'] || 0),
        nextCycleInBlocks: (data['next_cycle'] as Record<string, unknown>)?.['blocks_until_reward_phase'] as number || 0,
      };
    } catch (err) {
      logger.warn('Failed to fetch stacking info:', err);
    }
  }

  // ── Token Metadata ─────────────────────────────────────────────────────────

  private async fetchTokenMetadata(): Promise<void> {
    try {
      const res = await fetch(`${HIRO_API}/metadata/v1/ft?limit=50`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const tokens = data.results || [];

      for (const token of tokens) {
        const symbol = (token['symbol'] as string) || '';
        const name = (token['name'] as string) || '';
        if (!symbol) continue;

        // Only update if we don't have price data already (prices come from CoinGecko)
        const existing = this.analytics.getTokenStatsBySymbol(symbol);
        if (!existing) {
          this.analytics.updateTokenStats(symbol, {
            symbol,
            name,
            price: 0,
            change24h: 0,
            volume24h: 0,
            marketCap: 0,
          });
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch token metadata:', err);
    }
  }

  // ── Pool Data (DEX TVL) ────────────────────────────────────────────────────

  private async fetchPoolData(): Promise<void> {
    // Fetch from ALEX API
    try {
      const alexRes = await fetch('https://api.alexgo.io/v1/pool_token_stats');
      if (alexRes.ok) {
        const alexData = await alexRes.json() as { data?: Record<string, unknown>[] };
        const pools = alexData.data || [];

        for (const pool of pools.slice(0, 10)) {
          const tokenX = (pool['token_x_symbol'] as string) || 'Token0';
          const tokenY = (pool['token_y_symbol'] as string) || 'Token1';
          const name = `${tokenX}/${tokenY}`;
          const tvl = Number(pool['total_tvl'] || pool['tvl'] || 0);
          const volume = Number(pool['volume_24h'] || 0);
          const apr = Number(pool['apr'] || pool['apy'] || 0);

          if (tvl > 0 || volume > 0) {
            this.analytics.updatePoolStats(`alex-${name}`, {
              name,
              tvl: tvl * (this.stxPriceUsd || 1),
              volume24h: volume * (this.stxPriceUsd || 1),
              apr,
              token0: tokenX,
              token1: tokenY,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch ALEX pool data:', err);
    }

    // Fetch from Velar API
    try {
      const velarRes = await fetch('https://api.velar.co/pools');
      if (velarRes.ok) {
        const velarData = await velarRes.json() as Record<string, unknown>[] | { data?: Record<string, unknown>[] };
        const pools = Array.isArray(velarData) ? velarData : (velarData.data || []);

        for (const pool of pools.slice(0, 10)) {
          const token0 = pool['token0'] as Record<string, unknown> | undefined;
          const token1 = pool['token1'] as Record<string, unknown> | undefined;
          const tokenX = (token0?.['symbol'] as string) || 'Token0';
          const tokenY = (token1?.['symbol'] as string) || 'Token1';
          const name = `${tokenX}/${tokenY}`;
          const tvl = Number(pool['tvl'] || 0);
          const volume = Number(pool['volume24h'] || pool['volume_24h'] || 0);

          if (tvl > 0 || volume > 0) {
            this.analytics.updatePoolStats(`velar-${name}`, {
              name,
              tvl,
              volume24h: volume,
              apr: Number(pool['apr'] || 0),
              token0: tokenX,
              token1: tokenY,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch Velar pool data:', err);
    }
  }

  // ── Public Getters ─────────────────────────────────────────────────────────

  getStxPrice(): number {
    return this.stxPriceUsd;
  }

  getBtcPrice(): number {
    return this.btcPriceUsd;
  }

  getNetworkInfo() {
    return this.networkInfo;
  }

  getSupplyInfo() {
    return this.supplyInfo;
  }

  getStackingInfo() {
    return this.stackingInfo;
  }
}
