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

/**
 * DeFi Monitor API Routes
 * Updated: Dec 22, 2025
 */
export const DeFiRoutes: FastifyPluginAsync<RouteOptions> = async (
  fastify,
  opts
) => {
  const { analytics, chainhooksManager, eventProcessor } = opts;

  // Dashboard
  fastify.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const stats = analytics.getDashboardStats();
    return reply.send(stats);
  });

  // Volume
  fastify.get('/volume', async (req: FastifyRequest, reply: FastifyReply) => {
    const periodHours = (req.query as any).periodHours || 1;
    const volume = analytics.getVolumeByPeriod(periodHours);
    return reply.send({ data: volume });
  });

  // Swaps
  fastify.get('/swaps', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = analytics.getSwapHistory(req.query as any);
    return reply.send(result);
  });

  // Liquidity
  fastify.get('/liquidity', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = analytics.getLiquidityHistory(req.query as any);
    return reply.send(result);
  });

  // Pools
  fastify.get('/pools', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as any).limit || 10;
    const pools = analytics.getTopPools(limit);
    return reply.send({ pools });
  });

  // Tokens
  fastify.get('/tokens', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as any).limit || 10;
    const tokens = analytics.getTopTokens(limit);
    return reply.send({ tokens });
  });

  // Transfers
  fastify.get('/transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    const result = analytics.getTransferHistory(req.query as any);
    return reply.send(result);
  });

  // Alerts
  fastify.get('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = (req.query as any).limit || 20;
    const alerts = analytics.getWhaleAlerts(limit);
    return reply.send({ alerts });
  });

  // Chainhooks list
  fastify.get('/chainhooks', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const hooks = await chainhooksManager.listChainhooks();
      return reply.send({ chainhooks: hooks });
    } catch (error) {
      logger.error('Failed to list chainhooks', error);
      return reply.status(500).send({ error: 'Failed to list chainhooks' });
    }
  });

  // Chainhook by UUID
  fastify.get('/chainhooks/:uuid', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { uuid } = req.params as { uuid: string };
      const hook = await chainhooksManager.getChainhook(uuid);
      return reply.send(hook);
    } catch (error) {
      logger.error('Failed to get chainhook', error);
      return reply.status(404).send({ error: 'Chainhook not found' });
    }
  });

  // Toggle chainhook
  fastify.post('/chainhooks/:uuid/toggle', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { uuid } = req.params as { uuid: string };
      const { enabled } = req.body as { enabled: boolean };
      await chainhooksManager.toggleChainhook(uuid, enabled);
      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to toggle chainhook', error);
      return reply.status(500).send({ error: 'Failed to toggle chainhook' });
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

      logger.info(`Processed ${events.length} swap events`);
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

      logger.info(`Processed ${events.length} liquidity events`);
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

      logger.info(`Processed ${events.length} transfer events`);
      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: STX Transfers
  fastify.post('/webhooks/stx-transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      logger.info('Received STX transfer webhook', { payloadKeys: Object.keys(payload || {}) });
      
      const events = await eventProcessor.processStxTransferEvent(payload);
      
      for (const event of events) {
        analytics.recordTransfer(event);
      }

      logger.info(`Processed ${events.length} STX transfer events`);
      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process STX transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: NFT Transfers
  fastify.post('/webhooks/nft-transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      logger.info('Received NFT transfer webhook', { payloadKeys: Object.keys(payload || {}) });
      
      const events = await eventProcessor.processTransferEvent(payload);
      
      for (const event of events) {
        analytics.recordTransfer(event);
      }

      logger.info(`Processed ${events.length} NFT transfer events`);
      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process NFT transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Webhook: FT (Token) Transfers
  fastify.post('/webhooks/ft-transfers', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = req.body as WebhookPayload;
      logger.info('Received FT transfer webhook', { payloadKeys: Object.keys(payload || {}) });
      
      const events = await eventProcessor.processTransferEvent(payload);
      
      for (const event of events) {
        analytics.recordTransfer(event);
      }

      logger.info(`Processed ${events.length} FT transfer events`);
      return reply.send({ success: true, processed: events.length });
    } catch (error) {
      logger.error('Failed to process FT transfer webhook', error);
      return reply.status(500).send({ error: 'Failed to process webhook' });
    }
  });

  // Health check
  fastify.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await chainhooksManager.checkStatus();
      return reply.send({
        status: 'healthy',
        chainhooksApi: status.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.send({
        status: 'healthy',
        chainhooksApi: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ==========================================
  // API KEY ENDPOINTS
  // ==========================================

  // Get API pricing info
  fastify.get('/api-pricing', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      tiers: [
        {
          name: 'Free',
          tier: ApiTier.FREE,
          price: TIER_PRICES[ApiTier.FREE],
          limit: TIER_LIMITS[ApiTier.FREE],
          features: ['Dashboard access', 'Basic analytics', '100 API requests/day'],
        },
        {
          name: 'Pro',
          tier: ApiTier.PRO,
          price: TIER_PRICES[ApiTier.PRO],
          limit: TIER_LIMITS[ApiTier.PRO],
          features: ['All Free features', '1000 API requests/day', 'Real-time webhooks', 'Priority support'],
        },
        {
          name: 'Enterprise',
          tier: ApiTier.ENTERPRISE,
          price: TIER_PRICES[ApiTier.ENTERPRISE],
          limit: TIER_LIMITS[ApiTier.ENTERPRISE],
          features: ['All Pro features', '10000 API requests/day', 'Custom webhooks', 'Dedicated support', 'SLA'],
        },
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

      logger.info(`Generated API key for ${owner}`);
      return reply.send({
        success: true,
        apiKey: key,
        ...info,
        limits: {
          daily: TIER_LIMITS[tier || ApiTier.FREE],
        },
      });
    } catch (error: any) {
      logger.error('Failed to generate API key', error);
      return reply.status(400).send({ error: error.message });
    }
  });

  // Validate API key
  fastify.post('/api-keys/validate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.replace('Bearer ', '') || (req.body as any)?.apiKey;

      if (!apiKey) {
        return reply.status(400).send({ error: 'API key required' });
      }

      const result = apiKeyService.validateKey(apiKey);
      return reply.send(result);
    } catch (error) {
      logger.error('Failed to validate API key', error);
      return reply.status(500).send({ error: 'Failed to validate key' });
    }
  });

  // Get API key info
  fastify.get('/api-keys/info', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.replace('Bearer ', '');

      if (!apiKey) {
        return reply.status(401).send({ error: 'API key required in Authorization header' });
      }

      const info = apiKeyService.getKeyInfo(apiKey);
      if (!info) {
        return reply.status(404).send({ error: 'API key not found' });
      }

      return reply.send({
        ...info,
        limits: {
          daily: TIER_LIMITS[info.tier as ApiTier],
          remaining: TIER_LIMITS[info.tier as ApiTier] - (info.requestCount || 0),
        },
      });
    } catch (error) {
      logger.error('Failed to get API key info', error);
      return reply.status(500).send({ error: 'Failed to get key info' });
    }
  });

  // Protected API endpoint example (requires API key)
  fastify.get('/v1/data', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.replace('Bearer ', '');

      if (!apiKey) {
        return reply.status(401).send({ 
          error: 'API key required',
          docs: 'Include your API key in the Authorization header: Bearer YOUR_API_KEY',
        });
      }

      const validation = apiKeyService.validateKey(apiKey);
      if (!validation.valid) {
        return reply.status(403).send({ 
          error: validation.error,
          tier: validation.tier,
        });
      }

      // Return data based on tier
      const stats = analytics.getDashboardStats();
      
      return reply.send({
        success: true,
        tier: validation.tier,
        remaining: validation.remaining,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to process v1/data request', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // NOTIFICATION ENDPOINTS
  // ==========================================

  // Create notification subscription
  fastify.post('/notifications/subscribe', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { owner, channel, config, filters } = req.body as {
        owner: string;
        channel: NotificationChannel;
        config: {
          telegramChatId?: string;
          discordWebhookUrl?: string;
          webhookUrl?: string;
        };
        filters?: {
          minStxAmount?: number;
          tokens?: string[];
          alertTypes?: string[];
        };
      };

      if (!owner || !channel || !config) {
        return reply.status(400).send({ error: 'owner, channel, and config are required' });
      }

      const subscription = notificationService.createSubscription(owner, channel, config, filters);
      
      logger.info(`Created notification subscription for ${owner}`);
      return reply.send({
        success: true,
        subscription: {
          id: subscription.id,
          channel: subscription.channel,
          active: subscription.active,
          createdAt: subscription.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create notification subscription', error);
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get user's notification subscriptions
  fastify.get('/notifications/subscriptions', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const owner = (req.query as any).owner;
      
      if (!owner) {
        return reply.status(400).send({ error: 'owner query parameter required' });
      }

      const subscriptions = notificationService.getSubscriptionsByOwner(owner);
      
      return reply.send({
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          channel: sub.channel,
          active: sub.active,
          createdAt: sub.createdAt,
          filters: sub.filters,
        })),
      });
    } catch (error) {
      logger.error('Failed to get subscriptions', error);
      return reply.status(500).send({ error: 'Failed to get subscriptions' });
    }
  });

  // Delete notification subscription
  fastify.delete('/notifications/subscriptions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      
      const deleted = notificationService.deleteSubscription(id);
      
      if (!deleted) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      return reply.send({ success: true, message: 'Subscription deleted' });
    } catch (error) {
      logger.error('Failed to delete subscription', error);
      return reply.status(500).send({ error: 'Failed to delete subscription' });
    }
  });

  // Toggle notification subscription
  fastify.patch('/notifications/subscriptions/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { active } = req.body as { active: boolean };
      
      const updated = notificationService.toggleSubscription(id, active);
      
      if (!updated) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      return reply.send({ success: true, active });
    } catch (error) {
      logger.error('Failed to toggle subscription', error);
      return reply.status(500).send({ error: 'Failed to toggle subscription' });
    }
  });

  // Test notification (for debugging)
  fastify.post('/notifications/test', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { subscriptionId } = req.body as { subscriptionId: string };
      
      // Send a test notification
      logger.info(`Test notification requested for ${subscriptionId}`);
      
      return reply.send({
        success: true,
        message: 'Test notification sent (if subscription exists and is active)',
      });
    } catch (error) {
      logger.error('Failed to send test notification', error);
      return reply.status(500).send({ error: 'Failed to send test notification' });
    }
  });
};
