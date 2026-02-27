import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics';
import { DeFiChainhooksManager } from '../chainhooks/client';
import { EventProcessor } from '../services/event-processor';
import { HiroDataService } from '../services/hiro-data';
import { apiKeyService, ApiTier, TIER_LIMITS, TIER_PRICES } from '../services/api-keys';
import { notificationService, NotificationChannel } from '../services/notifications';
import { getAggregatedQuote, scanArbitrageOpportunities, getSupportedTokens, getDEXInfo } from '../dex-aggregator';
import { WebhookPayload } from '../types';
import { logger } from '../utils/logger';
import {
  recordUserEvent,
  getOverview,
  getAcquisitionFunnel,
  UserEvent,
} from '../services/user-analytics';
import { getHyperbrowserService } from '../services/hyperbrowser';
import { cacheService } from '../utils/cache';

interface RouteOptions {
  analytics: AnalyticsService;
  chainhooksManager: DeFiChainhooksManager;
  eventProcessor: EventProcessor;
  hiroDataService: HiroDataService;
}

// ── AI Insights Store (in-memory, max 100) ──────────────────────────────────
let aiInsights: object[] = [];

export const DeFiRoutes: FastifyPluginAsync<RouteOptions> = async (fastify, opts) => {
  const { analytics, chainhooksManager, eventProcessor, hiroDataService } = opts;

  // AI Insights — GET (frontend reads, filtered for quality)
  fastify.get('/ai-insights', async (_req: FastifyRequest, reply: FastifyReply) => {
    // Filter out error/invalid insights before sending to frontend
    const filtered = aiInsights.filter((ins: Record<string, unknown>) => {
      const content = String(ins['content'] || ins['message'] || ins['analysis'] || '');
      const errorPatterns = [
        'error', 'failed', 'timeout', 'rate limit', 'invalid',
        'could not', 'unable to', 'exception', 'unavailable',
      ];
      const isError = errorPatterns.some((p) => content.toLowerCase().includes(p));
      return !isError || content.length > 200; // Keep long insights even if they mention errors
    });
    return reply.send({ insights: filtered, count: filtered.length, total: aiInsights.length });
  });

  // AI Insights — POST (VPS agents write insights, with validation)
  fastify.post('/ai-insights', async (req: FastifyRequest, reply: FastifyReply) => {
    const insight = req.body as Record<string, unknown>;

    // Basic validation
    if (!insight['agent'] && !insight['type']) {
      return reply.status(400).send({ error: 'agent or type field required' });
    }

    aiInsights.unshift({ ...insight, receivedAt: new Date().toISOString() });
    if (aiInsights.length > 100) aiInsights = aiInsights.slice(0, 100);
    return reply.send({ ok: true });
  });

  // AI Agent Status — GET
  fastify.get('/ai-status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const agents = [
      { name: 'satoshi',  role: 'Whale Tracking & Pattern Analysis', model: 'llama3.2:1b' },
      { name: 'nakamoto', role: 'DEX Arbitrage & Price Analysis',    model: 'llama3.2:1b' },
      { name: 'szabo',    role: 'Contract Security Scanner',         model: 'llama3.2:1b' },
      { name: 'finney',   role: 'User Reports & Notifications',      model: 'llama3.2:1b' },
    ];
    const lastInsight = aiInsights[0] as Record<string, unknown> | undefined;
    return reply.send({
      cluster: 'sentinel-ai',
      inference: 'da-vinci (llama3.2:1b)',
      agents,
      total_insights: aiInsights.length,
      last_activity: lastInsight
        ? (lastInsight['receivedAt'] as string)
        : null,
    });
  });

  // Dashboard
  fastify.get('/dashboard', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await cacheService.getOrSet('dashboard', 10, async () => {
      return analytics.getDashboardStats();
    });
    return reply.send(stats);
  });

  // Pools
  fastify.get('/pools', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 10;
    const pools = await cacheService.getOrSet('pools_' + limit, 15, async () => {
      return analytics.getTopPools(limit);
    });
    return reply.send({ pools });
  });

  // Tokens
  fastify.get('/tokens', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 10;
    const tokens = await cacheService.getOrSet('tokens_' + limit, 15, async () => {
      return analytics.getTopTokens(limit);
    });
    return reply.send({ tokens });
  });

  // Alerts
  fastify.get('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 20;
    const alerts = await cacheService.getOrSet('alerts_' + limit, 5, async () => {
      return analytics.getWhaleAlerts(limit);
    });
    return reply.send({ alerts });
  });

  // Chainhooks list
  fastify.get('/chainhooks', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const hooks = await chainhooksManager.listChainhooks();
      return reply.send({ chainhooks: hooks });
    } catch (error) {
      logger.error('Failed to list chainhooks', error);
      return reply.status(500).send({ error: 'Failed to list chainhooks' });
    }
  });

  // Webhook: Swaps
  fastify.post('/webhooks/swaps', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processSwapEvent(payload);
      
      for (const event of events) {
        analytics.recordSwap(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process swap webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: Liquidity
  fastify.post('/webhooks/liquidity', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processLiquidityEvent(payload);
      
      for (const event of events) {
        analytics.recordLiquidity(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process liquidity webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: Transfers
  fastify.post('/webhooks/transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processTransferEvent(payload);
      
      for (const event of events) {
        analytics.recordTransfer(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: Whale Alerts (STX large transfers)
  fastify.post('/webhooks/whale-alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processTransferEvent(payload);

      for (const event of events) {
        analytics.recordTransfer(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process whale-alerts webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: FT Transfers (fungible token transfers)
  fastify.post('/webhooks/ft-transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processTransferEvent(payload);

      for (const event of events) {
        analytics.recordTransfer(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process ft-transfers webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: NFT Events (mint + transfer)
  fastify.post('/webhooks/nft-events', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      if (!payload?.apply) return reply.send({ success: true, processed: 0 });

      let count = 0;
      for (const block of payload.apply) {
        if (!block?.transactions) continue;
        for (const tx of block.transactions) {
          if (!tx?.metadata?.success) continue;
          count++;
          logger.info(`NFT event: ${tx.transaction_identifier.hash}`);
        }
      }

      return reply.send({ success: true, processed: count });
    } catch (error) {
      logger.error('Failed to process nft-events webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: Staking Events (stake, unstake, claim-rewards)
  fastify.post('/webhooks/staking', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      if (!payload?.apply) return reply.send({ success: true, processed: 0 });

      let count = 0;
      for (const block of payload.apply) {
        if (!block?.transactions) continue;
        for (const tx of block.transactions) {
          if (!tx?.metadata?.success) continue;
          count++;
          logger.info(`Staking event: ${tx.transaction_identifier.hash} by ${tx.metadata.sender}`);
        }
      }

      return reply.send({ success: true, processed: count });
    } catch (error) {
      logger.error('Failed to process staking webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: Token Transfer (sentinel token)
  fastify.post('/webhooks/token-transfer', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      const events = await eventProcessor.processTransferEvent(payload);

      for (const event of events) {
        analytics.recordTransfer(event);
      }

      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process token-transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // ── User & Revenue Analytics ────────────────────────────────────────────────

  // POST /api/events — ingest user events from frontend
  fastify.post('/events', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Partial<UserEvent>;

    if (!body.eventName || !body.timestamp) {
      return reply.status(400).send({ error: 'eventName and timestamp required' });
    }

    const event: UserEvent = {
      id: crypto.randomUUID(),
      eventName: body.eventName,
      walletAddress: body.walletAddress,
      sessionId: body.sessionId,
      value: body.value,
      currency: body.currency ?? 'USD',
      timestamp: body.timestamp,
      context: body.context ?? {},
    };

    recordUserEvent(event);
    return { ok: true };
  });

  // GET /api/analytics/overview — daily metrics + summary
  fastify.get('/analytics/overview', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { from?: string; to?: string };
    const now = new Date();
    const defaultTo = now.toISOString().slice(0, 10);
    const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const from = query.from ?? defaultFrom;
    const to = query.to ?? defaultTo;

    return reply.send(getOverview(from, to));
  });

  // GET /api/analytics/funnel/acquisition — acquisition funnel stats
  fastify.get('/analytics/funnel/acquisition', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { from?: string; to?: string };
    const now = new Date();
    const defaultTo = now.toISOString().slice(0, 10);
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const from = query.from ?? defaultFrom;
    const to = query.to ?? defaultTo;

    return reply.send({ funnelId: 'acquisition', steps: getAcquisitionFunnel(from, to) });
  });

  // Health check
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await chainhooksManager.checkStatus();
      return reply.send({
        status: 'healthy',
        chainhooksApi: status.status,
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.send({
        status: 'healthy',
        chainhooksApi: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API Pricing
  fastify.get('/api-pricing', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      tiers: [
        { name: 'Free', tier: ApiTier.FREE, price: TIER_PRICES[ApiTier.FREE], limit: TIER_LIMITS[ApiTier.FREE] },
        { name: 'Pro', tier: ApiTier.PRO, price: TIER_PRICES[ApiTier.PRO], limit: TIER_LIMITS[ApiTier.PRO] },
        { name: 'Enterprise', tier: ApiTier.ENTERPRISE, price: TIER_PRICES[ApiTier.ENTERPRISE], limit: TIER_LIMITS[ApiTier.ENTERPRISE] },
      ],
    });
  });

  // Generate API key
  fastify.post('/api-keys/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { owner, tier } = req.body as { owner: string; tier?: ApiTier };
      
      if (!owner) {
        return reply.status(400).send({ error: 'Owner address required' });
      }

      const key = apiKeyService.generateApiKey(owner, tier || ApiTier.FREE);
      const info = apiKeyService.getKeyInfo(key);

      return reply.send({ success: true, apiKey: key, ...info });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // Validate API key
  fastify.post('/api-keys/validate', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '') || (req.body as { apiKey?: string })?.apiKey;

    if (!apiKey) {
      return reply.status(400).send({ error: 'API key required' });
    }

    const result = apiKeyService.validateKey(apiKey);
    return reply.send(result);
  });

  // Notifications
  fastify.post('/notifications/subscribe', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { owner, channel, config } = req.body as {
        owner: string;
        channel: NotificationChannel;
        config: { telegramChatId?: string; discordWebhookUrl?: string; webhookUrl?: string };
      };

      if (!owner || !channel || !config) {
        return reply.status(400).send({ error: 'owner, channel, and config are required' });
      }

      const subscription = notificationService.createSubscription(owner, channel, config);
      return reply.send({ success: true, subscriptionId: subscription.id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  fastify.get('/notifications/subscriptions', async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = (req.query as { owner?: string }).owner;
    
    if (!owner) {
      return reply.status(400).send({ error: 'owner query parameter required' });
    }

    const subscriptions = notificationService.getSubscriptionsByOwner(owner);
    return reply.send({ subscriptions });
  });

  fastify.delete('/notifications/subscriptions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const deleted = notificationService.deleteSubscription(id);
    
    if (!deleted) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    return reply.send({ success: true });
  });

  fastify.patch('/notifications/subscriptions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { active } = req.body as { active: boolean };
    
    const updated = notificationService.toggleSubscription(id, active);
    
    if (!updated) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    return reply.send({ success: true, active });
  });

  // ── Agent Data Endpoints (proxy → Hiro Stacks API) ───────────────────────
  const HIRO = 'https://api.hiro.so';
  const WHALE_THRESHOLD_MICRO = 1_000 * 1_000_000; // 1,000 STX in microSTX

  // GET /api/whale-alerts — fetch large STX transfers from Hiro
  fastify.get('/whale-alerts', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/tx?type=token_transfer&limit=50&order=desc&order_by=block_height`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) return reply.send([]);

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const whales = (data.results || [])
        .filter((tx: Record<string, unknown>) => {
          const tt = tx['token_transfer'] as Record<string, unknown> | undefined;
          return tt && Number(tt['amount'] ?? 0) >= WHALE_THRESHOLD_MICRO;
        })
        .map((tx: Record<string, unknown>) => {
          const tt = tx['token_transfer'] as Record<string, unknown>;
          return {
            txid:             tx['tx_id'],
            amount:           Math.round(Number(tt['amount']) / 1_000_000),
            sender:           tx['sender_address'],
            receiver:         tt['recipient_address'],
            timestamp:        tx['burn_block_time_iso'] || new Date().toISOString(),
            sender_tx_count:  0,
          };
        });
      return reply.send(whales);
    } catch (err) {
      logger.error('whale-alerts proxy error:', err);
      return reply.send([]);
    }
  });

  // GET /api/dex — STX price + real DEX pool data from analytics & aggregator
  fastify.get('/dex', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stxPrice = hiroDataService.getStxPrice();
      const stxToken = analytics.getTokenStatsBySymbol('STX');
      const pools = analytics.getAllPoolStats();

      // If no pools from polling yet, try fetching directly
      const poolData = pools.length > 0 ? pools.map((p) => ({
        name: p.name,
        exchange: p.name.includes('alex') ? 'ALEX' : p.name.includes('velar') ? 'Velar' : 'DEX',
        volume_24h: p.volume24h,
        liquidity: p.tvl,
        apr: p.apr,
      })) : [
        { name: 'STX/USDA', exchange: 'Velar', volume_24h: 0, liquidity: 0, apr: 0 },
        { name: 'STX/xBTC', exchange: 'ALEX', volume_24h: 0, liquidity: 0, apr: 0 },
      ];

      return reply.send({
        stx_price_usd: stxPrice,
        change_24h_pct: stxToken?.change24h ?? 0,
        pools: poolData,
        tokens: analytics.getTopTokens(10),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('dex proxy error:', err);
      return reply.send({ stx_price_usd: 0, pools: [], timestamp: new Date().toISOString() });
    }
  });

  // GET /api/dex/quote — aggregated DEX quote
  fastify.get('/dex/quote', async (req: FastifyRequest, reply: FastifyReply) => {
    const { tokenIn, tokenOut, amount } = req.query as {
      tokenIn?: string; tokenOut?: string; amount?: string;
    };
    if (!tokenIn || !tokenOut || !amount) {
      return reply.status(400).send({ error: 'tokenIn, tokenOut, and amount are required' });
    }
    try {
      const quote = await getAggregatedQuote(tokenIn, tokenOut, amount);
      return reply.send(quote || { error: 'No quotes available' });
    } catch (err) {
      logger.error('dex quote error:', err);
      return reply.status(500).send({ error: 'Failed to get quote' });
    }
  });

  // GET /api/dex/arbitrage — scan for arbitrage opportunities
  fastify.get('/dex/arbitrage', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const opportunities = await scanArbitrageOpportunities();
      return reply.send({ opportunities });
    } catch (err) {
      logger.error('arbitrage scan error:', err);
      return reply.send({ opportunities: [] });
    }
  });

  // GET /api/dex/tokens — supported tokens
  fastify.get('/dex/tokens', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ tokens: getSupportedTokens(), dexes: getDEXInfo() });
  });

  // GET /api/stacking — PoX stacking data
  fastify.get('/stacking', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stackingInfo = hiroDataService.getStackingInfo();
      // Also fetch cycle signers
      let signers: unknown[] = [];
      if (stackingInfo?.currentCycle) {
        try {
          const signerRes = await fetch(
            `${HIRO}/signer-metrics/v1/cycles/${stackingInfo.currentCycle}/signers`,
            { headers: { Accept: 'application/json' } }
          );
          if (signerRes.ok) {
            const signerData = await signerRes.json() as { results?: unknown[] };
            signers = signerData.results || [];
          }
        } catch { /* ignore signer fetch errors */ }
      }
      return reply.send({ ...stackingInfo, signers });
    } catch (err) {
      logger.error('stacking error:', err);
      return reply.send({ error: 'Failed to fetch stacking data' });
    }
  });

  // GET /api/supply — STX supply data
  fastify.get('/supply', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(hiroDataService.getSupplyInfo());
    } catch (err) {
      logger.error('supply error:', err);
      return reply.send({ totalSupply: 0, circulatingSupply: 0, lockedSupply: 0 });
    }
  });

  // GET /api/network — network info
  fastify.get('/network', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send(hiroDataService.getNetworkInfo());
    } catch (err) {
      logger.error('network error:', err);
      return reply.send({ stacksHeight: 0, burnHeight: 0, peerCount: 0 });
    }
  });

  // GET /api/blocks — recent blocks
  fastify.get('/blocks', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 20), 50);
    try {
      const res = await fetch(
        `${HIRO}/extended/v2/blocks?limit=${limit}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.send({ results: [] });
      const data = await res.json() as { results?: unknown[] };
      return reply.send({ results: data.results || [] });
    } catch (err) {
      logger.error('blocks error:', err);
      return reply.send({ results: [] });
    }
  });

  // GET /api/address/:address/balances — full address balance
  fastify.get('/address/:address/balances', async (req: FastifyRequest, reply: FastifyReply) => {
    const { address } = req.params as { address: string };
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/address/${address}/balances`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.status(res.status).send({ error: 'Failed to fetch balances' });
      const data = await res.json();
      return reply.send(data);
    } catch (err) {
      logger.error('address balances error:', err);
      return reply.status(500).send({ error: 'Failed to fetch balances' });
    }
  });

  // GET /api/address/:address/transactions — address transaction history
  fastify.get('/address/:address/transactions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { address } = req.params as { address: string };
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 20), 50);
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/address/${address}/transactions_with_transfers?limit=${limit}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.status(res.status).send({ error: 'Failed to fetch transactions' });
      const data = await res.json();
      return reply.send(data);
    } catch (err) {
      logger.error('address transactions error:', err);
      return reply.status(500).send({ error: 'Failed to fetch transactions' });
    }
  });

  // GET /api/nfts/:address — NFT holdings
  fastify.get('/nfts/:address', async (req: FastifyRequest, reply: FastifyReply) => {
    const { address } = req.params as { address: string };
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 50), 200);
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/tokens/nft/holdings?principal=${address}&limit=${limit}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.send({ results: [] });
      const data = await res.json();
      return reply.send(data);
    } catch (err) {
      logger.error('nfts error:', err);
      return reply.send({ results: [] });
    }
  });

  // GET /api/search/:query — universal search
  fastify.get('/search/:query', async (req: FastifyRequest, reply: FastifyReply) => {
    const { query } = req.params as { query: string };
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/search/${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.status(res.status).send({ error: 'Search failed' });
      const data = await res.json();
      return reply.send(data);
    } catch (err) {
      logger.error('search error:', err);
      return reply.status(500).send({ error: 'Search failed' });
    }
  });

  // GET /api/mempool — mempool stats
  fastify.get('/mempool', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const [statsRes, txRes] = await Promise.all([
        fetch(`${HIRO}/extended/v1/tx/mempool/stats`, { headers: { Accept: 'application/json' } }),
        fetch(`${HIRO}/extended/v1/tx/mempool?limit=20`, { headers: { Accept: 'application/json' } }),
      ]);
      const stats = statsRes.ok ? await statsRes.json() : {};
      const txData = txRes.ok ? await txRes.json() as { results?: unknown[] } : { results: [] };
      return reply.send({ stats, transactions: txData.results || [] });
    } catch (err) {
      logger.error('mempool error:', err);
      return reply.send({ stats: {}, transactions: [] });
    }
  });

  // GET /api/contract/:contractId — contract details
  fastify.get('/contract/:contractId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { contractId } = req.params as { contractId: string };
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/contract/${contractId}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return reply.status(res.status).send({ error: 'Contract not found' });
      const data = await res.json();
      return reply.send(data);
    } catch (err) {
      logger.error('contract error:', err);
      return reply.status(500).send({ error: 'Failed to fetch contract' });
    }
  });

  // GET /api/transactions — recent Stacks transactions
  fastify.get('/transactions', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 20), 50);
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/tx?limit=${limit}&order=desc&order_by=block_height`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) return reply.send([]);
      const data = await res.json() as { results?: unknown[] };
      return reply.send(data.results || []);
    } catch (err) {
      logger.error('transactions proxy error:', err);
      return reply.send([]);
    }
  });

  // GET /api/contracts/recent — recently deployed smart contracts
  fastify.get('/contracts/recent', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 10), 20);
    try {
      const res = await fetch(
        `${HIRO}/extended/v1/tx?type=smart_contract&limit=${limit}&order=desc&order_by=block_height`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) return reply.send([]);
      const data = await res.json() as { results?: Record<string, unknown>[] };
      const contracts = (data.results || []).map((tx: Record<string, unknown>) => {
        const sc = tx['smart_contract'] as Record<string, unknown> | undefined;
        return {
          contract_id:  sc?.['contract_id']  ?? '',
          source_code:  sc?.['source_code']  ?? '',
          deployer:     tx['sender_address'] ?? '',
          block_time:   tx['burn_block_time_iso'] ?? '',
        };
      });
      return reply.send(contracts);
    } catch (err) {
      logger.error('contracts/recent proxy error:', err);
      return reply.send([]);
    }
  });

  // ── Web Intelligence (Hyperbrowser) ──────────────────────────────────────

  const hb = getHyperbrowserService();

  // GET /api/web-intel — full web intelligence dashboard data
  fastify.get('/web-intel', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) {
      return reply.send({ dex: [], news: [], credits: { used: 0, limit: 0, remaining: 0, resetAt: '' } });
    }
    try {
      const data = await hb.getWebIntelligence();
      return reply.send(data);
    } catch (err) {
      logger.error('web-intel error:', err);
      return reply.send({ dex: [], news: [], credits: hb.getCreditUsage() });
    }
  });

  // GET /api/web-intel/dex — scraped DEX data only
  fastify.get('/web-intel/dex', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) return reply.send([]);
    try {
      const data = await hb.scrapeDexData();
      return reply.send(data);
    } catch (err) {
      logger.error('web-intel/dex error:', err);
      return reply.send([]);
    }
  });

  // GET /api/web-intel/news — scraped news only
  fastify.get('/web-intel/news', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) return reply.send([]);
    try {
      const data = await hb.scrapeNews();
      return reply.send(data);
    } catch (err) {
      logger.error('web-intel/news error:', err);
      return reply.send([]);
    }
  });

  // GET /api/web-intel/credits — credit usage status
  fastify.get('/web-intel/credits', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(hb.getCreditUsage());
  });

  // ── Whale Intelligence (Hyperbrowser Extract API) ─────────────────────────

  // GET /api/whale-intel — whale wallet intelligence data
  fastify.get('/whale-intel', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) {
      return reply.send({ whales: [], alerts: [], scannedAt: '' });
    }
    try {
      const data = await hb.getWhaleIntelligence();
      return reply.send(data);
    } catch (err) {
      logger.error('whale-intel error:', err);
      return reply.send({ whales: [], alerts: [], scannedAt: '', credits: hb.getCreditUsage() });
    }
  });

  // ── Governance & SIP Tracker ────────────────────────────────────────────────

  // GET /api/governance — SIP proposals & governance data
  fastify.get('/governance', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) {
      return reply.send({ proposals: [], activeCount: 0, totalCount: 0, scannedAt: '' });
    }
    try {
      const data = await hb.getGovernanceData();
      return reply.send(data);
    } catch (err) {
      logger.error('governance error:', err);
      return reply.send({ proposals: [], activeCount: 0, totalCount: 0, scannedAt: '' });
    }
  });

  // ── sBTC Bridge Monitor ────────────────────────────────────────────────────

  fastify.get('/sbtc-bridge', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) return reply.send({ pegInCount: 0, pegOutCount: 0, totalLocked: 0, pegRatio: 1, recentOps: [], scannedAt: '' });
    try {
      return reply.send(await hb.getSbtcBridgeData());
    } catch (err) {
      logger.error('sbtc-bridge error:', err);
      return reply.send({ pegInCount: 0, pegOutCount: 0, totalLocked: 0, pegRatio: 1, recentOps: [], scannedAt: '' });
    }
  });

  // ── Token Launch Scanner ──────────────────────────────────────────────────

  fastify.get('/token-launches', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) return reply.send({ launches: [], scannedAt: '' });
    try {
      return reply.send(await hb.getTokenLaunches());
    } catch (err) {
      logger.error('token-launches error:', err);
      return reply.send({ launches: [], scannedAt: '' });
    }
  });

  // ── Social Pulse ──────────────────────────────────────────────────────────

  fastify.get('/social-pulse', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) return reply.send({ sentiment: 'neutral', mentionCount: 0, topTopics: [], articles: [], scannedAt: '' });
    try {
      return reply.send(await hb.getSocialPulse());
    } catch (err) {
      logger.error('social-pulse error:', err);
      return reply.send({ sentiment: 'neutral', mentionCount: 0, topTopics: [], articles: [], scannedAt: '' });
    }
  });

  // ── DeFi Protocol Scanner (Hyperbrowser Crawl + Extract API) ──────────────

  // GET /api/defi-scan — DeFi protocol comparison report
  fastify.get('/defi-scan', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!hb.isEnabled()) {
      return reply.send({ protocols: [], totalTvl: 0, totalPools: 0, scannedAt: '' });
    }
    try {
      const data = await hb.scanDefiProtocols();
      return reply.send(data);
    } catch (err) {
      logger.error('defi-scan error:', err);
      return reply.send({ protocols: [], totalTvl: 0, totalPools: 0, scannedAt: '', error: 'scan failed' });
    }
  });
};
