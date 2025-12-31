import { logger } from '../utils/logger';
import {
  SwapEvent,
  LiquidityEvent,
  TokenTransfer,
  WhaleAlert,
  WebhookPayload,
} from '../types';
import { EventEmitter } from 'events';
import { notificationService } from './notifications';

export class EventProcessor extends EventEmitter {
  private whaleThresholdStx: number;
  private largeSwapThreshold: number;

  constructor(config?: { whaleThresholdStx?: number; largeSwapThreshold?: number }) {
    super();
    this.whaleThresholdStx = config?.whaleThresholdStx || 100000;
    this.largeSwapThreshold = config?.largeSwapThreshold || 50000;
  }

  async processSwapEvent(payload: WebhookPayload): Promise<SwapEvent[]> {
    const swapEvents: SwapEvent[] = [];

    if (!payload?.apply) return swapEvents;

    for (const block of payload.apply) {
      if (!block?.transactions) continue;
      
      for (const tx of block.transactions) {
        if (!tx?.metadata?.success) continue;

        const swapEvent: SwapEvent = {
          txId: tx.transaction_identifier.hash,
          pool: 'unknown',
          tokenIn: 'STX',
          tokenOut: 'USDA',
          amountIn: 0,
          amountOut: 0,
          sender: tx.metadata.sender,
          timestamp: new Date().toISOString(),
          blockHeight: block.block_identifier.index,
        };

        swapEvents.push(swapEvent);
        this.emit('swap', swapEvent);

        logger.info(`Swap: ${swapEvent.amountIn} ${swapEvent.tokenIn} → ${swapEvent.amountOut} ${swapEvent.tokenOut}`);
      }
    }

    return swapEvents;
  }

  async processLiquidityEvent(payload: WebhookPayload): Promise<LiquidityEvent[]> {
    const liquidityEvents: LiquidityEvent[] = [];

    if (!payload?.apply) return liquidityEvents;

    for (const block of payload.apply) {
      if (!block?.transactions) continue;
      
      for (const tx of block.transactions) {
        if (!tx?.metadata?.success) continue;

        const liquidityEvent: LiquidityEvent = {
          txId: tx.transaction_identifier.hash,
          pool: 'unknown',
          type: 'add',
          token0Amount: 0,
          token1Amount: 0,
          lpTokens: 0,
          sender: tx.metadata.sender,
          timestamp: new Date().toISOString(),
          blockHeight: block.block_identifier.index,
        };

        liquidityEvents.push(liquidityEvent);
        this.emit('liquidity', liquidityEvent);
      }
    }

    return liquidityEvents;
  }

  async processTransferEvent(payload: WebhookPayload): Promise<TokenTransfer[]> {
    const transfers: TokenTransfer[] = [];

    if (!payload?.apply) return transfers;

    for (const block of payload.apply) {
      if (!block?.transactions) continue;
      
      for (const tx of block.transactions) {
        const events = tx.metadata?.receipt?.events || [];
        
        for (const event of events) {
          if (event?.type === 'stx_transfer_event' && event?.data) {
            const amount = Number(event.data.amount || 0) / 1_000_000;
            const isWhale = amount >= this.whaleThresholdStx;

            const transfer: TokenTransfer = {
              txId: tx.transaction_identifier.hash,
              token: 'STX',
              from: event.data.sender || 'unknown',
              to: event.data.recipient || 'unknown',
              amount,
              timestamp: new Date().toISOString(),
              blockHeight: block.block_identifier.index,
            };

            transfers.push(transfer);
            this.emit('transfer', transfer);

            if (isWhale) {
              const alert = this.createWhaleAlert('large_transfer', transfer);
              this.emit('whale-alert', alert);
              notificationService.notifyWhaleAlert(alert);
            }
          }
        }
      }
    }

    return transfers;
  }

  private createWhaleAlert(type: WhaleAlert['type'], event: TokenTransfer): WhaleAlert {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      token: event.token,
      amount: event.amount,
      from: event.from,
      to: event.to,
      txId: event.txId,
      timestamp: new Date().toISOString(),
    };
  }
}
