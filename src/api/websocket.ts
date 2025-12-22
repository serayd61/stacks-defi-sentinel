import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { EventProcessor } from '../services/event-processor';
import { SwapEvent, LiquidityEvent, TokenTransfer, WhaleAlert } from '../types';
import { logger } from '../utils/logger';

interface WebSocketClient {
  socket: WebSocket;
  subscriptions: Set<string>;
}

/**
 * WebSocket Manager for real-time updates
 */
export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private eventProcessor: EventProcessor;

  constructor(eventProcessor: EventProcessor) {
    this.eventProcessor = eventProcessor;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners from event processor
   */
  private setupEventListeners(): void {
    // Listen for swap events
    this.eventProcessor.on('swap', (event: SwapEvent) => {
      this.broadcast('swap', event);
    });

    // Listen for liquidity events
    this.eventProcessor.on('liquidity', (event: LiquidityEvent) => {
      this.broadcast('liquidity', event);
    });

    // Listen for transfer events
    this.eventProcessor.on('transfer', (event: TokenTransfer) => {
      this.broadcast('transfer', event);
    });

    // Listen for whale alerts
    this.eventProcessor.on('whale-alert', (alert: WhaleAlert) => {
      this.broadcast('whale-alert', alert);
      // Also broadcast to 'all' channel
      this.broadcast('all', { type: 'whale-alert', data: alert });
    });

    logger.info('WebSocket event listeners initialized');
  }

  /**
   * Register a new WebSocket client
   */
  registerClient(clientId: string, socket: WebSocket): void {
    const client: WebSocketClient = {
      socket,
      subscriptions: new Set(['all']), // Subscribe to 'all' by default
    };

    this.clients.set(clientId, client);
    logger.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      message: 'Connected to DeFi Monitor WebSocket',
      clientId,
      timestamp: Date.now(),
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Handle client message (for subscriptions)
   */
  handleMessage(clientId: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (data.type) {
        case 'subscribe':
          this.subscribeClient(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.unsubscribeClient(clientId, data.channel);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          logger.warn(`Unknown WebSocket message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', error);
    }
  }

  /**
   * Subscribe client to a channel
   */
  subscribeClient(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = ['all', 'swap', 'liquidity', 'transfer', 'whale-alert'];
    if (!validChannels.includes(channel)) {
      this.sendToClient(clientId, {
        type: 'error',
        message: `Invalid channel: ${channel}. Valid channels: ${validChannels.join(', ')}`,
      });
      return;
    }

    client.subscriptions.add(channel);
    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      timestamp: Date.now(),
    });

    logger.info(`Client ${clientId} subscribed to ${channel}`);
  }

  /**
   * Unsubscribe client from a channel
   */
  unsubscribeClient(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      timestamp: Date.now(),
    });

    logger.info(`Client ${clientId} unsubscribed from ${channel}`);
  }

  /**
   * Broadcast message to all clients subscribed to a channel
   */
  broadcast(channel: string, data: any): void {
    const message = JSON.stringify({
      type: 'event',
      channel,
      data,
      timestamp: Date.now(),
    });

    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (
        client.subscriptions.has(channel) ||
        client.subscriptions.has('all')
      ) {
        try {
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.send(message);
            sentCount++;
          }
        } catch (error) {
          logger.error(`Failed to send to client ${clientId}`, error);
          this.unregisterClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      logger.debug(`Broadcast to ${sentCount} clients on channel: ${channel}`);
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) return;

    try {
      client.socket.send(JSON.stringify(data));
    } catch (error) {
      logger.error(`Failed to send to client ${clientId}`, error);
    }
  }

  /**
   * Get connected clients count
   */
  getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get subscription stats
   */
  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {
      all: 0,
      swap: 0,
      liquidity: 0,
      transfer: 0,
      'whale-alert': 0,
    };

    for (const client of this.clients.values()) {
      for (const sub of client.subscriptions) {
        stats[sub] = (stats[sub] || 0) + 1;
      }
    }

    return stats;
  }
}

/**
 * Setup WebSocket routes for Fastify
 */
export async function setupWebSocket(
  fastify: FastifyInstance,
  eventProcessor: EventProcessor
): Promise<WebSocketManager> {
  const wsManager = new WebSocketManager(eventProcessor);

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const socket = connection.socket;

    wsManager.registerClient(clientId, socket as unknown as WebSocket);

    socket.on('message', (message: Buffer) => {
      wsManager.handleMessage(clientId, message.toString());
    });

    socket.on('close', () => {
      wsManager.unregisterClient(clientId);
    });

    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}`, error);
      wsManager.unregisterClient(clientId);
    });
  });

  // WebSocket stats endpoint
  fastify.get('/ws/stats', async (req, reply) => {
    return reply.send({
      connectedClients: wsManager.getClientsCount(),
      subscriptions: wsManager.getSubscriptionStats(),
    });
  });

  logger.info('WebSocket routes initialized');
  return wsManager;
}

