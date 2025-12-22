import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
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
};
