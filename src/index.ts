import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { DeFiChainhooksManager } from './chainhooks/client';
import { EventProcessor } from './services/event-processor';
import { AnalyticsService } from './services/analytics';
import { DeFiRoutes } from './api/routes';
import { setupWebSocket } from './api/websocket';
import { logger } from './utils/logger';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// Configuration
const config = {
  port: parseInt(process.env.PORT || '4000'),
  host: process.env.HOST || '0.0.0.0',
  network: (process.env.STACKS_NETWORK as 'mainnet' | 'testnet') || 'mainnet',
  chainhooksApiKey: process.env.CHAINHOOKS_API_KEY || '',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:4000',
  whaleThresholdStx: parseInt(process.env.WHALE_ALERT_THRESHOLD_STX || '100000'),
  largeSwapThresholdUsd: parseInt(process.env.LARGE_SWAP_THRESHOLD_USD || '50000'),
  
  // DEX contracts to monitor
  dexContracts: (process.env.MONITORED_DEX_CONTRACTS || '').split(',').filter(Boolean),
  
  // Token contracts to monitor
  tokenContracts: (process.env.MONITORED_TOKENS || '').split(',').filter(Boolean),
  
  // Pool contracts (can be same as DEX for many cases)
  poolContracts: (process.env.MONITORED_POOL_CONTRACTS || process.env.MONITORED_DEX_CONTRACTS || '').split(',').filter(Boolean),
};

// Default contracts if none provided
const DEFAULT_DEX_CONTRACTS = [
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router', // Velar
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1', // Arkadiko
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-swap-v1', // ALEX
];

const DEFAULT_TOKEN_CONTRACTS = [
  'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token', // stSTX
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token', // USDA
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-token', // ALEX
  'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.wrapped-stx-token', // wSTX
];

async function main() {
  logger.info('🚀 Starting Stacks DeFi Monitor...');

  // Initialize Fastify
  const fastify = Fastify({
    logger: false,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(websocket);

  // Initialize services
  const eventProcessor = new EventProcessor({
    whaleThresholdStx: config.whaleThresholdStx,
    largeSwapThresholdUsd: config.largeSwapThresholdUsd,
  });

  const analytics = new AnalyticsService();

  // Connect event processor to analytics
  eventProcessor.on('swap', (event) => analytics.recordSwap(event));
  eventProcessor.on('liquidity', (event) => analytics.recordLiquidity(event));
  eventProcessor.on('transfer', (event) => analytics.recordTransfer(event));
  eventProcessor.on('whale-alert', (alert) => analytics.recordAlert(alert));

  // Initialize Chainhooks Manager
  const chainhooksManager = new DeFiChainhooksManager({
    apiKey: config.chainhooksApiKey,
    network: config.network,
    webhookBaseUrl: config.webhookBaseUrl,
  });

  // Register API routes
  await fastify.register(DeFiRoutes, {
    prefix: '/api',
    analytics,
    chainhooksManager,
    eventProcessor,
  });

  // Setup WebSocket
  await setupWebSocket(fastify, eventProcessor);

  // Swagger documentation
  fastify.get('/', async (req, reply) => {
    return reply.send({
      name: 'Stacks DeFi Monitor',
      version: '1.0.0',
      description: 'Real-time DeFi monitoring and analytics for Stacks blockchain',
      endpoints: {
        dashboard: '/api/dashboard',
        swaps: '/api/swaps',
        liquidity: '/api/liquidity',
        pools: '/api/pools',
        tokens: '/api/tokens',
        transfers: '/api/transfers',
        alerts: '/api/alerts',
        health: '/api/health',
        websocket: '/ws',
      },
      websocket: {
        url: '/ws',
        channels: ['all', 'swap', 'liquidity', 'transfer', 'whale-alert'],
        example: {
          subscribe: '{"type":"subscribe","channel":"swap"}',
          unsubscribe: '{"type":"unsubscribe","channel":"swap"}',
        },
      },
    });
  });

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    logger.info(`✅ Server running at http://${config.host}:${config.port}`);
    logger.info(`📊 Dashboard: http://${config.host}:${config.port}/api/dashboard`);
    logger.info(`🔌 WebSocket: ws://${config.host}:${config.port}/ws`);

    // Initialize chainhooks if API key is provided
    if (config.chainhooksApiKey) {
      logger.info('🔗 Initializing Chainhooks...');

      try {
        // Check API status first
        await chainhooksManager.checkStatus();

        // Register all monitoring chainhooks
        await chainhooksManager.initializeAllHooks({
          dexContracts: config.dexContracts.length > 0 
            ? config.dexContracts 
            : DEFAULT_DEX_CONTRACTS,
          poolContracts: config.poolContracts.length > 0 
            ? config.poolContracts 
            : DEFAULT_DEX_CONTRACTS,
          tokenContracts: config.tokenContracts.length > 0 
            ? config.tokenContracts 
            : DEFAULT_TOKEN_CONTRACTS,
          stxMinAmount: config.whaleThresholdStx * 1_000_000, // Convert to microSTX
        });

        logger.info('✅ Chainhooks initialized successfully');
      } catch (error) {
        logger.error('⚠️ Failed to initialize chainhooks:', error);
        logger.warn('Server will continue without real-time chainhook events');
      }
    } else {
      logger.warn('⚠️ CHAINHOOKS_API_KEY not set - chainhooks will not be registered');
      logger.info('ℹ️ To enable real-time events, set CHAINHOOKS_API_KEY in environment');
    }

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('🛑 Shutting down...');

    try {
      // Cleanup chainhooks if they were registered
      if (config.chainhooksApiKey) {
        await chainhooksManager.cleanup();
      }

      await fastify.close();
      logger.info('✅ Server shut down gracefully');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Run the application
main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});

