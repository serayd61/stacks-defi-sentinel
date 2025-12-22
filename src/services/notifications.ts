import { logger } from '../utils/logger';
import { WhaleAlert, SwapEvent, TokenTransfer } from '../types';

// Notification channels
export enum NotificationChannel {
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
  WEBHOOK = 'webhook',
  EMAIL = 'email',
}

interface NotificationSubscription {
  id: string;
  owner: string; // Stacks address
  channel: NotificationChannel;
  config: {
    telegramChatId?: string;
    discordWebhookUrl?: string;
    webhookUrl?: string;
    email?: string;
  };
  filters: {
    minStxAmount?: number;
    tokens?: string[];
    alertTypes?: string[];
  };
  active: boolean;
  createdAt: number;
}

interface NotificationPayload {
  type: 'whale_alert' | 'swap' | 'transfer' | 'custom';
  title: string;
  message: string;
  data?: any;
  timestamp: number;
}

/**
 * Notification Service
 * Handles multi-channel notifications for whale alerts and trading signals
 */
export class NotificationService {
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private notificationQueue: NotificationPayload[] = [];
  
  // Telegram Bot Token (set via env)
  private telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  
  constructor() {
    // Process notification queue every 5 seconds
    setInterval(() => this.processQueue(), 5000);
  }

  /**
   * Create notification subscription
   */
  createSubscription(
    owner: string,
    channel: NotificationChannel,
    config: NotificationSubscription['config'],
    filters: NotificationSubscription['filters'] = {}
  ): NotificationSubscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: NotificationSubscription = {
      id,
      owner,
      channel,
      config,
      filters,
      active: true,
      createdAt: Date.now(),
    };

    this.subscriptions.set(id, subscription);
    logger.info(`Created ${channel} notification subscription for ${owner}`);
    
    return subscription;
  }

  /**
   * Send whale alert notification
   */
  async notifyWhaleAlert(alert: WhaleAlert): Promise<void> {
    const amount = (alert.event as any)?.amount || 'Unknown';
    const sender = (alert.event as any)?.sender || 'Unknown';
    const recipient = (alert.event as any)?.recipient || 'Unknown';

    const payload: NotificationPayload = {
      type: 'whale_alert',
      title: '🐋 Whale Alert!',
      message: `
**Large ${(alert.event as any)?.token?.symbol || 'Token'} Transfer Detected**

💰 Amount: ${Number(amount).toLocaleString()} ${(alert.event as any)?.token?.symbol || 'tokens'}
📤 From: \`${this.truncateAddress(sender)}\`
📥 To: \`${this.truncateAddress(recipient)}\`
⏰ Time: ${new Date(alert.timestamp).toLocaleString()}

🔗 [View Transaction](https://explorer.stacks.co/txid/${(alert.event as any)?.txId}?chain=mainnet)
      `.trim(),
      data: alert,
      timestamp: Date.now(),
    };

    await this.broadcast(payload);
  }

  /**
   * Send swap notification
   */
  async notifySwap(swap: SwapEvent): Promise<void> {
    const payload: NotificationPayload = {
      type: 'swap',
      title: '🔄 Large Swap Detected',
      message: `
**DEX Swap on ${swap.dexName}**

💱 ${swap.tokenIn.amount} ${swap.tokenIn.symbol} → ${swap.tokenOut.amount} ${swap.tokenOut.symbol}
💵 Value: $${swap.tokenIn.amountUsd?.toLocaleString() || 'N/A'}
👤 Trader: \`${this.truncateAddress(swap.sender)}\`

🔗 [View Transaction](https://explorer.stacks.co/txid/${swap.txId}?chain=mainnet)
      `.trim(),
      data: swap,
      timestamp: Date.now(),
    };

    await this.broadcast(payload);
  }

  /**
   * Broadcast notification to all matching subscriptions
   */
  private async broadcast(payload: NotificationPayload): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.active)
      .filter(sub => this.matchesFilters(payload, sub.filters));

    for (const sub of subscriptions) {
      try {
        switch (sub.channel) {
          case NotificationChannel.TELEGRAM:
            await this.sendTelegram(sub.config.telegramChatId!, payload);
            break;
          case NotificationChannel.DISCORD:
            await this.sendDiscord(sub.config.discordWebhookUrl!, payload);
            break;
          case NotificationChannel.WEBHOOK:
            await this.sendWebhook(sub.config.webhookUrl!, payload);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send ${sub.channel} notification`, error);
      }
    }
  }

  /**
   * Send Telegram message
   */
  private async sendTelegram(chatId: string, payload: NotificationPayload): Promise<void> {
    if (!this.telegramBotToken) {
      logger.warn('Telegram bot token not configured');
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${payload.title}\n\n${payload.message}`,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      logger.debug(`Sent Telegram notification to ${chatId}`);
    } catch (error) {
      logger.error('Failed to send Telegram notification', error);
    }
  }

  /**
   * Send Discord webhook
   */
  private async sendDiscord(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    try {
      const color = payload.type === 'whale_alert' ? 0xfbbf24 : 0x6366f1;
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: payload.title,
            description: payload.message.replace(/\*\*/g, '**'),
            color,
            timestamp: new Date(payload.timestamp).toISOString(),
            footer: {
              text: 'DeFi Sentinel | Stacks Blockchain',
            },
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status}`);
      }

      logger.debug('Sent Discord notification');
    } catch (error) {
      logger.error('Failed to send Discord notification', error);
    }
  }

  /**
   * Send custom webhook
   */
  private async sendWebhook(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data,
          timestamp: payload.timestamp,
          source: 'defi-sentinel',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      logger.debug(`Sent webhook notification to ${webhookUrl}`);
    } catch (error) {
      logger.error('Failed to send webhook notification', error);
    }
  }

  /**
   * Check if payload matches subscription filters
   */
  private matchesFilters(
    payload: NotificationPayload,
    filters: NotificationSubscription['filters']
  ): boolean {
    if (filters.alertTypes && filters.alertTypes.length > 0) {
      if (!filters.alertTypes.includes(payload.type)) {
        return false;
      }
    }

    if (filters.minStxAmount && payload.data?.event?.amount) {
      const amount = Number(payload.data.event.amount);
      if (amount < filters.minStxAmount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process notification queue
   */
  private processQueue(): void {
    if (this.notificationQueue.length === 0) return;

    const batch = this.notificationQueue.splice(0, 10);
    for (const notification of batch) {
      this.broadcast(notification);
    }
  }

  /**
   * Truncate address for display
   */
  private truncateAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  /**
   * Get subscription by owner
   */
  getSubscriptionsByOwner(owner: string): NotificationSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.owner === owner);
  }

  /**
   * Delete subscription
   */
  deleteSubscription(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Toggle subscription active state
   */
  toggleSubscription(id: string, active: boolean): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    
    sub.active = active;
    this.subscriptions.set(id, sub);
    return true;
  }
}

// Singleton instance
export const notificationService = new NotificationService();

