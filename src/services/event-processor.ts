import { logger } from '../utils/logger';
import {
  SwapEvent,
  LiquidityEvent,
  TokenTransfer,
  WhaleAlert,
  WebhookPayload,
} from '../types';
import { EventEmitter } from 'events';

/**
 * DeFi Event Processor
 * Processes incoming chainhook events and transforms them into structured data
 */
export class EventProcessor extends EventEmitter {
  private whaleThresholdStx: number;
  private largeSwapThresholdUsd: number;

  constructor(config?: {
    whaleThresholdStx?: number;
    largeSwapThresholdUsd?: number;
  }) {
    super();
    this.whaleThresholdStx = config?.whaleThresholdStx || 100000;
    this.largeSwapThresholdUsd = config?.largeSwapThresholdUsd || 50000;
  }

  /**
   * Process swap events from DEX chainhook
   */
  async processSwapEvent(payload: WebhookPayload): Promise<SwapEvent[]> {
    const swapEvents: SwapEvent[] = [];

    for (const block of payload.apply) {
      for (const tx of block.transactions) {
        if (!tx.metadata.success) continue;

        const swapEvent = this.parseSwapTransaction(tx, block);
        if (swapEvent) {
          swapEvents.push(swapEvent);

          // Emit event for real-time updates
          this.emit('swap', swapEvent);

          // Check for whale activity
          if (swapEvent.tokenIn.amountUsd && swapEvent.tokenIn.amountUsd > this.largeSwapThresholdUsd) {
            const alert = this.createWhaleAlert('large_swap', swapEvent);
            this.emit('whale-alert', alert);
          }

          logger.info(
            `Swap: ${swapEvent.tokenIn.amount} ${swapEvent.tokenIn.symbol} → ${swapEvent.tokenOut.amount} ${swapEvent.tokenOut.symbol}`
          );
        }
      }
    }

    return swapEvents;
  }

  /**
   * Process liquidity events
   */
  async processLiquidityEvent(payload: WebhookPayload): Promise<LiquidityEvent[]> {
    const liquidityEvents: LiquidityEvent[] = [];

    for (const block of payload.apply) {
      for (const tx of block.transactions) {
        if (!tx.metadata.success) continue;

        const liquidityEvent = this.parseLiquidityTransaction(tx, block);
        if (liquidityEvent) {
          liquidityEvents.push(liquidityEvent);

          // Emit event for real-time updates
          this.emit('liquidity', liquidityEvent);

          // Check for large liquidity events
          if (liquidityEvent.totalValueUsd && liquidityEvent.totalValueUsd > this.largeSwapThresholdUsd) {
            const alert = this.createWhaleAlert('large_liquidity', liquidityEvent);
            this.emit('whale-alert', alert);
          }

          logger.info(
            `Liquidity ${liquidityEvent.type}: ${liquidityEvent.pool.name} by ${liquidityEvent.sender}`
          );
        }
      }
    }

    return liquidityEvents;
  }

  /**
   * Process token transfer events
   */
  async processTransferEvent(payload: WebhookPayload): Promise<TokenTransfer[]> {
    const transfers: TokenTransfer[] = [];

    for (const block of payload.apply) {
      for (const tx of block.transactions) {
        const transferEvents = this.parseTransferTransaction(tx, block);
        
        for (const transfer of transferEvents) {
          transfers.push(transfer);

          // Emit event for real-time updates
          this.emit('transfer', transfer);

          // Check for whale transfers
          if (transfer.isWhaleTransaction) {
            const alert = this.createWhaleAlert('large_transfer', transfer);
            this.emit('whale-alert', alert);
          }

          logger.info(
            `Transfer: ${transfer.amount} ${transfer.token.symbol} from ${transfer.sender} to ${transfer.recipient}`
          );
        }
      }
    }

    return transfers;
  }

  /**
   * Process STX transfer events
   */
  async processStxTransferEvent(payload: WebhookPayload): Promise<TokenTransfer[]> {
    const transfers: TokenTransfer[] = [];

    for (const block of payload.apply) {
      for (const tx of block.transactions) {
        // Parse STX transfers from events
        const events = tx.metadata.receipt?.events || [];
        
        for (const event of events) {
          if (event.type === 'stx_transfer_event') {
            const amount = BigInt(event.data.amount);
            const amountStx = Number(amount) / 1_000_000; // Convert to STX
            const isWhale = amountStx >= this.whaleThresholdStx;

            const transfer: TokenTransfer = {
              txId: tx.transaction_identifier.hash,
              blockHeight: block.block_identifier.index,
              blockHash: block.block_identifier.hash,
              timestamp: block.timestamp,
              sender: event.data.sender,
              recipient: event.data.recipient,
              token: {
                contract: 'STX',
                symbol: 'STX',
                decimals: 6,
              },
              amount: amountStx.toString(),
              isWhaleTransaction: isWhale,
            };

            transfers.push(transfer);
            this.emit('transfer', transfer);

            if (isWhale) {
              const alert = this.createWhaleAlert('large_transfer', transfer);
              this.emit('whale-alert', alert);
              logger.warn(`🐋 Whale Alert: ${amountStx} STX transferred!`);
            }
          }
        }
      }
    }

    return transfers;
  }

  /**
   * Parse a swap transaction
   */
  private parseSwapTransaction(
    tx: WebhookPayload['apply'][0]['transactions'][0],
    block: WebhookPayload['apply'][0]
  ): SwapEvent | null {
    try {
      const events = tx.metadata.receipt?.events || [];
      
      // Find FT transfer events to determine token in/out
      const ftTransfers = events.filter((e: any) => e.type === 'ft_transfer_event');
      
      if (ftTransfers.length < 2) return null;

      // First transfer is token in, last is token out (simplified logic)
      const tokenInEvent = ftTransfers[0];
      const tokenOutEvent = ftTransfers[ftTransfers.length - 1];

      return {
        txId: tx.transaction_identifier.hash,
        blockHeight: block.block_identifier.index,
        blockHash: block.block_identifier.hash,
        timestamp: block.timestamp,
        sender: tx.metadata.sender,
        tokenIn: {
          contract: tokenInEvent.data.asset_identifier,
          symbol: this.extractSymbol(tokenInEvent.data.asset_identifier),
          amount: tokenInEvent.data.amount,
        },
        tokenOut: {
          contract: tokenOutEvent.data.asset_identifier,
          symbol: this.extractSymbol(tokenOutEvent.data.asset_identifier),
          amount: tokenOutEvent.data.amount,
        },
        dexContract: tx.metadata.kind?.data?.contract_identifier || 'unknown',
        dexName: this.getDexName(tx.metadata.kind?.data?.contract_identifier),
      };
    } catch (error) {
      logger.error('Failed to parse swap transaction', error);
      return null;
    }
  }

  /**
   * Parse a liquidity transaction
   */
  private parseLiquidityTransaction(
    tx: WebhookPayload['apply'][0]['transactions'][0],
    block: WebhookPayload['apply'][0]
  ): LiquidityEvent | null {
    try {
      const methodName = tx.metadata.kind?.data?.method || '';
      const isAdd = ['add-liquidity', 'deposit', 'mint'].some((m) =>
        methodName.includes(m)
      );

      const events = tx.metadata.receipt?.events || [];
      const ftTransfers = events.filter((e: any) => e.type === 'ft_transfer_event');

      return {
        txId: tx.transaction_identifier.hash,
        blockHeight: block.block_identifier.index,
        blockHash: block.block_identifier.hash,
        timestamp: block.timestamp,
        sender: tx.metadata.sender,
        type: isAdd ? 'add' : 'remove',
        pool: {
          contract: tx.metadata.kind?.data?.contract_identifier || 'unknown',
          name: this.getPoolName(tx.metadata.kind?.data?.contract_identifier),
          token0: ftTransfers[0]?.data?.asset_identifier || 'unknown',
          token1: ftTransfers[1]?.data?.asset_identifier || 'unknown',
        },
        amounts: {
          token0Amount: ftTransfers[0]?.data?.amount || '0',
          token1Amount: ftTransfers[1]?.data?.amount || '0',
          lpTokenAmount: ftTransfers[2]?.data?.amount || '0',
        },
      };
    } catch (error) {
      logger.error('Failed to parse liquidity transaction', error);
      return null;
    }
  }

  /**
   * Parse transfer transactions
   */
  private parseTransferTransaction(
    tx: WebhookPayload['apply'][0]['transactions'][0],
    block: WebhookPayload['apply'][0]
  ): TokenTransfer[] {
    const transfers: TokenTransfer[] = [];

    try {
      const events = tx.metadata.receipt?.events || [];

      for (const event of events) {
        if (event.type === 'ft_transfer_event') {
          const amount = BigInt(event.data.amount);
          // Simplified whale detection - should use price feed
          const isWhale = amount > BigInt(1_000_000_000_000); // Arbitrary threshold

          transfers.push({
            txId: tx.transaction_identifier.hash,
            blockHeight: block.block_identifier.index,
            blockHash: block.block_identifier.hash,
            timestamp: block.timestamp,
            sender: event.data.sender,
            recipient: event.data.recipient,
            token: {
              contract: event.data.asset_identifier,
              symbol: this.extractSymbol(event.data.asset_identifier),
              decimals: 6, // Default, should be fetched from token metadata
            },
            amount: event.data.amount,
            isWhaleTransaction: isWhale,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to parse transfer transaction', error);
    }

    return transfers;
  }

  /**
   * Create a whale alert
   */
  private createWhaleAlert(
    type: WhaleAlert['type'],
    event: SwapEvent | LiquidityEvent | TokenTransfer
  ): WhaleAlert {
    const messages: Record<WhaleAlert['type'], string> = {
      large_transfer: `Large token transfer detected`,
      large_swap: `Large swap detected on DEX`,
      large_liquidity: `Large liquidity event detected`,
      new_wallet_activity: `New wallet with significant activity detected`,
    };

    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      severity: 'warning',
      event,
      message: messages[type],
      timestamp: Date.now(),
    };
  }

  /**
   * Extract token symbol from asset identifier
   */
  private extractSymbol(assetIdentifier: string): string {
    // Format: SP...contract-name::token-name
    const parts = assetIdentifier.split('::');
    return parts[1] || 'UNKNOWN';
  }

  /**
   * Get DEX name from contract
   */
  private getDexName(contract: string): string {
    const dexNames: Record<string, string> = {
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router': 'Velar',
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1': 'Arkadiko',
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-swap': 'ALEX',
      'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M.stx-dex': 'STX DEX',
    };
    return dexNames[contract] || 'Unknown DEX';
  }

  /**
   * Get pool name from contract
   */
  private getPoolName(contract: string): string {
    // Extract meaningful name from contract identifier
    const parts = contract?.split('.') || [];
    return parts[1] || 'Unknown Pool';
  }
}

