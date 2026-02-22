import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AnalyticsService } from '../services/analytics';
import { DeFiChainhooksManager } from '../chainhooks/client';
import { EventProcessor } from '../services/event-processor';
import { apiKeyService, ApiTier, TIER_LIMITS, TIER_PRICES } from '../services/api-keys';
import { notificationService, NotificationChannel } from '../services/notifications';
import { WebhookPayload } from '../types';
import { logger } from '../utils/logger';

interface RouteOptions {
  analytics: AnalyticsService;
  chainhooksManager: DeFiChainhooksManager;
  eventProcessor: EventProcessor;
}

// ── AI Insights Store (in-memory, max 100) ──────────────────────────────────
let aiInsights: object[] = [];

export const DeFiRoutes: FastifyPluginAsync<RouteOptions> = async (fastify, opts) => {
  const { analytics, chainhooksManager, eventProcessor } = opts;

  // AI Insights — GET (frontend okur)
  fastify.get('/ai-insights', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ insights: aiInsights, count: aiInsights.length });
  });

  // AI Insights — POST (VPS agentları yazar)
  fastify.post('/ai-insights', async (req: FastifyRequest, reply: FastifyReply) => {
    const insight = req.body as object;
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
    const stats = analytics.getDashboardStats();
    return reply.send(stats);
  });

  // Pools
  fastify.get('/pools', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 10;
    const pools = analytics.getTopPools(limit);
    return reply.send({ pools });
  });

  // Tokens
  fastify.get('/tokens', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 10;
    const tokens = analytics.getTopTokens(limit);
    return reply.send({ tokens });
  });

  // Alerts
  fastify.get('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as { limit?: number }).limit || 20;
    const alerts = analytics.getWhaleAlerts(limit);
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
};
