import { FastifyPluginAsync } from 'fastify';
import { Type, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AnalyticsService } from '../services/analytics';
import { DeFiChainhooksManager } from '../chainhooks/client';
import { EventProcessor } from '../services/event-processor';
import { WebhookPayload } from '../types';
import { logger } from '../utils/logger';

interface RouteOptions {
  analytics: AnalyticsService;
  chainhooksManager: DeFiChainhooksManager;
  eventProcessor: EventProcessor;
}

/**
 * DeFi Monitor API Routes
 */
export const DeFiRoutes: FastifyPluginAsync<RouteOptions> = async (
  fastify,
  opts
) => {
  const { analytics, chainhooksManager, eventProcessor } = opts;

  // ============================================
  // Dashboard & Analytics Endpoints
  // ============================================

  fastify.get(
    '/dashboard',
    {
      schema: {
        summary: 'Get dashboard statistics',
        description: 'Returns aggregated DeFi statistics for the dashboard',
        tags: ['Analytics'],
        response: {
          200: Type.Object({
            totalValueLocked: Type.Number(),
            totalVolume24h: Type.Number(),
            totalTransactions24h: Type.Number(),
            activeWallets24h: Type.Number(),
            topPools: Type.Array(Type.Any()),
            topTokens: Type.Array(Type.Any()),
            recentSwaps: Type.Array(Type.Any()),
            recentAlerts: Type.Array(Type.Any()),
          }),
        },
      },
    },
    async (req, reply) => {
      const stats = analytics.getDashboardStats();
      return reply.send(stats);
    }
  );

  fastify.get(
    '/volume',
    {
      schema: {
        summary: 'Get volume by time period',
        description: 'Returns trading volume aggregated by time period',
        tags: ['Analytics'],
        querystring: Type.Object({
          periodHours: Type.Optional(Type.Number({ default: 1 })),
        }),
      },
    },
    async (req, reply) => {
      const periodHours = (req.query as any).periodHours || 1;
      const volume = analytics.getVolumeByPeriod(periodHours);
      return reply.send({ data: volume });
    }
  );

  // ============================================
  // Swap History Endpoints
  // ============================================

  fastify.get(
    '/swaps',
    {
      schema: {
        summary: 'Get swap history',
        description: 'Returns a list of recent swap transactions',
        tags: ['Swaps'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20 })),
          offset: Type.Optional(Type.Number({ default: 0 })),
          dex: Type.Optional(Type.String()),
          token: Type.Optional(Type.String()),
          minAmount: Type.Optional(Type.Number()),
        }),
      },
    },
    async (req, reply) => {
      const result = analytics.getSwapHistory(req.query as any);
      return reply.send(result);
    }
  );

  // ============================================
  // Liquidity Endpoints
  // ============================================

  fastify.get(
    '/liquidity',
    {
      schema: {
        summary: 'Get liquidity events',
        description: 'Returns a list of liquidity add/remove events',
        tags: ['Liquidity'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20 })),
          offset: Type.Optional(Type.Number({ default: 0 })),
          pool: Type.Optional(Type.String()),
          type: Type.Optional(Type.Union([Type.Literal('add'), Type.Literal('remove')])),
        }),
      },
    },
    async (req, reply) => {
      const result = analytics.getLiquidityHistory(req.query as any);
      return reply.send(result);
    }
  );

  fastify.get(
    '/pools',
    {
      schema: {
        summary: 'Get top liquidity pools',
        description: 'Returns top pools sorted by TVL',
        tags: ['Liquidity'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 10 })),
        }),
      },
    },
    async (req, reply) => {
      const limit = (req.query as any).limit || 10;
      const pools = analytics.getTopPools(limit);
      return reply.send({ pools });
    }
  );

  // ============================================
  // Token & Transfer Endpoints
  // ============================================

  fastify.get(
    '/tokens',
    {
      schema: {
        summary: 'Get top tokens',
        description: 'Returns top tokens sorted by trading volume',
        tags: ['Tokens'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 10 })),
        }),
      },
    },
    async (req, reply) => {
      const limit = (req.query as any).limit || 10;
      const tokens = analytics.getTopTokens(limit);
      return reply.send({ tokens });
    }
  );

  fastify.get(
    '/transfers',
    {
      schema: {
        summary: 'Get token transfers',
        description: 'Returns a list of token transfers with optional filters',
        tags: ['Tokens'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20 })),
          offset: Type.Optional(Type.Number({ default: 0 })),
          address: Type.Optional(Type.String()),
          token: Type.Optional(Type.String()),
          whaleOnly: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (req, reply) => {
      const result = analytics.getTransferHistory(req.query as any);
      return reply.send(result);
    }
  );

  // ============================================
  // Whale Alerts Endpoints
  // ============================================

  fastify.get(
    '/alerts',
    {
      schema: {
        summary: 'Get whale alerts',
        description: 'Returns recent whale activity alerts',
        tags: ['Alerts'],
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20 })),
        }),
      },
    },
    async (req, reply) => {
      const limit = (req.query as any).limit || 20;
      const alerts = analytics.getWhaleAlerts(limit);
      return reply.send({ alerts });
    }
  );

  // ============================================
  // Chainhook Management Endpoints
  // ============================================

  fastify.get(
    '/chainhooks',
    {
      schema: {
        summary: 'List registered chainhooks',
        description: 'Returns all registered chainhooks',
        tags: ['Admin'],
      },
    },
    async (req, reply) => {
      try {
        const hooks = await chainhooksManager.listChainhooks();
        return reply.send({ chainhooks: hooks });
      } catch (error) {
        logger.error('Failed to list chainhooks', error);
        return reply.status(500).send({ error: 'Failed to list chainhooks' });
      }
    }
  );

  fastify.get(
    '/chainhooks/:uuid',
    {
      schema: {
        summary: 'Get chainhook by UUID',
        tags: ['Admin'],
        params: Type.Object({
          uuid: Type.String(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const { uuid } = req.params as { uuid: string };
        const hook = await chainhooksManager.getChainhook(uuid);
        return reply.send(hook);
      } catch (error) {
        logger.error('Failed to get chainhook', error);
        return reply.status(404).send({ error: 'Chainhook not found' });
      }
    }
  );

  fastify.post(
    '/chainhooks/:uuid/toggle',
    {
      schema: {
        summary: 'Enable/disable a chainhook',
        tags: ['Admin'],
        params: Type.Object({
          uuid: Type.String(),
        }),
        body: Type.Object({
          enabled: Type.Boolean(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const { uuid } = req.params as { uuid: string };
        const { enabled } = req.body as { enabled: boolean };
        await chainhooksManager.toggleChainhook(uuid, enabled);
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to toggle chainhook', error);
        return reply.status(500).send({ error: 'Failed to toggle chainhook' });
      }
    }
  );

  // ============================================
  // Webhook Endpoints (receives chainhook events)
  // ============================================

  fastify.post(
    '/webhooks/swaps',
    {
      schema: {
        summary: 'Webhook for swap events',
        description: 'Receives swap events from chainhooks',
        tags: ['Webhooks'],
      },
    },
    async (req, reply) => {
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
    }
  );

  fastify.post(
    '/webhooks/liquidity',
    {
      schema: {
        summary: 'Webhook for liquidity events',
        description: 'Receives liquidity add/remove events from chainhooks',
        tags: ['Webhooks'],
      },
    },
    async (req, reply) => {
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
    }
  );

  fastify.post(
    '/webhooks/transfers',
    {
      schema: {
        summary: 'Webhook for token transfer events',
        description: 'Receives token transfer events from chainhooks',
        tags: ['Webhooks'],
      },
    },
    async (req, reply) => {
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
    }
  );

  fastify.post(
    '/webhooks/stx-transfers',
    {
      schema: {
        summary: 'Webhook for STX transfer events',
        description: 'Receives STX transfer events from chainhooks',
        tags: ['Webhooks'],
      },
    },
    async (req, reply) => {
      try {
        const payload = req.body as WebhookPayload;
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
    }
  );

  // ============================================
  // Health Check
  // ============================================

  fastify.get(
    '/health',
    {
      schema: {
        summary: 'Health check',
        tags: ['System'],
      },
    },
    async (req, reply) => {
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
    }
  );
};

