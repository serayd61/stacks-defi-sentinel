/**
 * Hiro WebSocket Service
 * Connects to Hiro's Stacks Blockchain API WebSocket for real-time events.
 * Supplements the polling-based HiroDataService with instant notifications.
 */

import { logger } from '../utils/logger';
import { EventProcessor } from './event-processor';
import { AnalyticsService } from './analytics';

const HIRO_WS_URL = 'wss://api.hiro.so';

// Monitored DEX contract principals (for address_tx_update subscriptions)
const MONITORED_ADDRESSES = [
  'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1', // Velar
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM', // ALEX
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', // Arkadiko
  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', // sBTC
];

type WebSocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

export class HiroWebSocketService {
  private ws: WebSocketLike | null = null;
  private eventProcessor: EventProcessor;
  private analytics: AnalyticsService;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 60_000; // Max 60 seconds between retries
  private isRunning = false;

  constructor(eventProcessor: EventProcessor, analytics: AnalyticsService) {
    this.eventProcessor = eventProcessor;
    this.analytics = analytics;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    await this.connect();
  }

  stop(): void {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('Hiro WebSocket service stopped');
  }

  private async connect(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Dynamic import for WebSocket (works in Node.js)
      const { default: WebSocket } = await import('ws');
      this.ws = new WebSocket(HIRO_WS_URL) as unknown as WebSocketLike;

      this.ws.on('open', () => {
        logger.info('Connected to Hiro WebSocket');
        this.reconnectAttempts = 0;

        // Subscribe to transaction updates
        this.subscribe({ event: 'tx_update' });

        // Subscribe to address updates for monitored DEX contracts
        for (const address of MONITORED_ADDRESSES) {
          this.subscribe({
            event: 'address_tx_update',
            address,
          });
        }
      });

      this.ws.on('message', (data: unknown) => {
        try {
          const msg = JSON.parse(String(data));
          this.handleMessage(msg);
        } catch (err) {
          logger.debug('Failed to parse Hiro WS message');
        }
      });

      this.ws.on('close', () => {
        logger.warn('Hiro WebSocket disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: unknown) => {
        logger.warn('Hiro WebSocket error:', err);
      });
    } catch (err) {
      logger.warn('Failed to connect to Hiro WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private subscribe(subscription: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: subscription,
        id: Date.now(),
      }));
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    // Handle subscription confirmations
    if (msg['id'] && msg['result']) {
      logger.debug('Hiro WS subscription confirmed');
      return;
    }

    // Handle event notifications
    const params = msg['params'] as Record<string, unknown> | undefined;
    if (!params) return;

    const event = params['event'] as string | undefined;
    const result = params['result'] as Record<string, unknown> | undefined;
    if (!event || !result) return;

    switch (event) {
      case 'tx_update':
        this.handleTxUpdate(result);
        break;
      case 'address_tx_update':
        this.handleAddressTxUpdate(result);
        break;
    }
  }

  private handleTxUpdate(tx: Record<string, unknown>): void {
    const txType = tx['tx_type'] as string;
    const txStatus = tx['tx_status'] as string;

    // Only process successful transactions
    if (txStatus !== 'success') return;

    // Emit for WebSocket broadcast to frontend clients
    if (txType === 'token_transfer') {
      const tt = tx['token_transfer'] as Record<string, unknown> | undefined;
      if (tt) {
        const amount = Number(tt['amount'] || 0) / 1_000_000;
        if (amount >= 10_000) {
          this.eventProcessor.emit('whale-alert', {
            id: `ws-whale-${tx['tx_id']}`,
            type: 'large_transfer',
            token: 'STX',
            amount,
            from: tx['sender_address'],
            to: tt['recipient_address'],
            txId: tx['tx_id'],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  private handleAddressTxUpdate(data: Record<string, unknown>): void {
    const tx = data['tx'] as Record<string, unknown> | undefined;
    if (!tx) return;

    const txType = tx['tx_type'] as string;
    if (txType === 'contract_call') {
      // This is likely a DEX interaction
      this.eventProcessor.emit('swap', {
        txId: tx['tx_id'] as string,
        pool: (tx['contract_call'] as Record<string, unknown>)?.['contract_id'] as string || '',
        tokenIn: 'STX',
        tokenOut: 'Token',
        amountIn: 0,
        amountOut: 0,
        sender: tx['sender_address'] as string || '',
        timestamp: new Date().toISOString(),
        blockHeight: (tx['block_height'] as number) || 0,
      });
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    logger.info(`Reconnecting to Hiro WebSocket in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
