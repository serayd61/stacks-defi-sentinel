import { logger } from '../utils/logger';
import { WhaleAlert, SwapEvent } from '../types';

export enum NotificationChannel {
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  EMAIL = 'email',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface NotificationFilter {
  minAmount?: number;
  tokens?: string[];
  types?: string[];
  priority?: NotificationPriority;
}

interface NotificationSubscription {
  id: string;
  owner: string;
  channel: NotificationChannel;
  config: {
    telegramChatId?: string;
    discordWebhookUrl?: string;
    webhookUrl?: string;
    slackWebhookUrl?: string;
    email?: string;
  };
  filters?: NotificationFilter;
  active: boolean;
  createdAt: number;
  lastNotified?: number;
}

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: unknown;
  timestamp: number;
  priority: NotificationPriority;
  txHash?: string;
  explorerUrl?: string;
}

export class NotificationService {
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  private notificationHistory: NotificationPayload[] = [];
  private rateLimitWindow = 60000; // 1 minute
  private maxNotificationsPerWindow = 10;

  createSubscription(
    owner: string,
    channel: NotificationChannel,
    config: NotificationSubscription['config'],
    filters?: NotificationFilter
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
   * Update subscription filters
   */
  updateFilters(id: string, filters: NotificationFilter): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    sub.filters = { ...sub.filters, ...filters };
    logger.info(`Updated filters for subscription ${id}`);
    return true;
  }

  /**
   * Check if notification passes subscription filters
   */
  private passesFilters(sub: NotificationSubscription, payload: NotificationPayload): boolean {
    if (!sub.filters) return true;

    const { minAmount, tokens, types, priority } = sub.filters;

    // Check minimum amount
    if (minAmount && payload.data) {
      const amount = (payload.data as any).amount || 0;
      if (amount < minAmount) return false;
    }

    // Check token filter
    if (tokens && tokens.length > 0 && payload.data) {
      const token = (payload.data as any).token || (payload.data as any).tokenIn;
      if (token && !tokens.includes(token)) return false;
    }

    // Check type filter
    if (types && types.length > 0) {
      if (!types.includes(payload.type)) return false;
    }

    // Check priority filter
    if (priority) {
      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      if (priorityOrder[payload.priority] < priorityOrder[priority]) return false;
    }

    return true;
  }

  /**
   * Rate limiting check
   */
  private isRateLimited(subId: string): boolean {
    const sub = this.subscriptions.get(subId);
    if (!sub || !sub.lastNotified) return false;

    const recentNotifications = this.notificationHistory.filter(
      n => n.timestamp > Date.now() - this.rateLimitWindow
    );

    return recentNotifications.length >= this.maxNotificationsPerWindow;
  }

  async notifyWhaleAlert(alert: WhaleAlert): Promise<void> {
    const priority = this.calculatePriority(alert.amount);
    const payload: NotificationPayload = {
      type: 'whale_alert',
      title: '🐋 Whale Alert!',
      message: `Large ${alert.type} detected: ${this.formatAmount(alert.amount)} tokens`,
      data: alert,
      timestamp: Date.now(),
      priority,
      txHash: alert.txId,
      explorerUrl: `https://explorer.hiro.so/txid/${alert.txId}?chain=mainnet`,
    };

    await this.broadcast(payload);
  }

  async notifySwap(swap: SwapEvent): Promise<void> {
    const priority = this.calculateSwapPriority(swap);
    const payload: NotificationPayload = {
      type: 'swap',
      title: '🔄 Large Swap Detected',
      message: `${this.formatAmount(swap.amountIn)} ${swap.tokenIn} → ${this.formatAmount(swap.amountOut)} ${swap.tokenOut}`,
      data: swap,
      timestamp: Date.now(),
      priority,
      txHash: swap.txId,
      explorerUrl: `https://explorer.hiro.so/txid/${swap.txId}?chain=mainnet`,
    };

    await this.broadcast(payload);
  }

  /**
   * Notify price alert
   */
  async notifyPriceAlert(token: string, price: number, change: number, threshold: number): Promise<void> {
    const direction = change > 0 ? '📈' : '📉';
    const priority = Math.abs(change) > 10 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM;
    
    const payload: NotificationPayload = {
      type: 'price_alert',
      title: `${direction} Price Alert: ${token}`,
      message: `${token} price ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(2)}% to $${price.toFixed(4)}`,
      data: { token, price, change, threshold },
      timestamp: Date.now(),
      priority,
    };

    await this.broadcast(payload);
  }

  /**
   * Notify liquidity change
   */
  async notifyLiquidityChange(pool: string, change: number, newTvl: number): Promise<void> {
    const direction = change > 0 ? '💧' : '🔻';
    const priority = Math.abs(change) > 20 ? NotificationPriority.HIGH : NotificationPriority.LOW;
    
    const payload: NotificationPayload = {
      type: 'liquidity_change',
      title: `${direction} Liquidity ${change > 0 ? 'Added' : 'Removed'}`,
      message: `${pool}: ${change > 0 ? '+' : ''}${change.toFixed(2)}% | New TVL: $${this.formatAmount(newTvl)}`,
      data: { pool, change, newTvl },
      timestamp: Date.now(),
      priority,
    };

    await this.broadcast(payload);
  }

  /**
   * Calculate priority based on amount
   */
  private calculatePriority(amount: number): NotificationPriority {
    if (amount >= 1000000) return NotificationPriority.CRITICAL;
    if (amount >= 100000) return NotificationPriority.HIGH;
    if (amount >= 10000) return NotificationPriority.MEDIUM;
    return NotificationPriority.LOW;
  }

  /**
   * Calculate swap priority
   */
  private calculateSwapPriority(swap: SwapEvent): NotificationPriority {
    const amount = Math.max(swap.amountIn, swap.amountOut);
    return this.calculatePriority(amount);
  }

  /**
   * Format large numbers
   */
  private formatAmount(amount: number): string {
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toFixed(2);
  }

  private async broadcast(payload: NotificationPayload): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values()).filter(sub => sub.active);

    // Store in history for rate limiting
    this.notificationHistory.push(payload);
    
    // Clean old history
    this.notificationHistory = this.notificationHistory.filter(
      n => n.timestamp > Date.now() - this.rateLimitWindow * 10
    );

    let sentCount = 0;
    for (const sub of subscriptions) {
      try {
        // Check filters
        if (!this.passesFilters(sub, payload)) {
          continue;
        }

        // Check rate limit
        if (this.isRateLimited(sub.id)) {
          logger.warn(`Rate limited notification for subscription ${sub.id}`);
          continue;
        }

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
          case NotificationChannel.SLACK:
            await this.sendSlack(sub.config.slackWebhookUrl!, payload);
            break;
        }

        // Update last notified
        sub.lastNotified = Date.now();
        sentCount++;
      } catch (error) {
        logger.error(`Failed to send ${sub.channel} notification`, error);
      }
    }

    logger.info(`Broadcast ${payload.type} notification to ${sentCount} subscribers`);
  }

  private async sendTelegram(chatId: string, payload: NotificationPayload): Promise<void> {
    if (!this.telegramBotToken) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${payload.title}\n\n${payload.message}`,
          parse_mode: 'Markdown',
        }),
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification', error);
    }
  }

  private async sendDiscord(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: payload.title,
            description: payload.message,
            timestamp: new Date(payload.timestamp).toISOString(),
          }],
        }),
      });
    } catch (error) {
      logger.error('Failed to send Discord notification', error);
    }
  }

  private async sendWebhook(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.error('Failed to send webhook notification', error);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(webhookUrl: string, payload: NotificationPayload): Promise<void> {
    try {
      const priorityEmoji = {
        [NotificationPriority.LOW]: '🟢',
        [NotificationPriority.MEDIUM]: '🟡',
        [NotificationPriority.HIGH]: '🟠',
        [NotificationPriority.CRITICAL]: '🔴',
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${priorityEmoji[payload.priority]} ${payload.title}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: payload.message,
              },
            },
            ...(payload.explorerUrl ? [{
              type: 'actions',
              elements: [{
                type: 'button',
                text: { type: 'plain_text', text: 'View on Explorer' },
                url: payload.explorerUrl,
              }],
            }] : []),
          ],
        }),
      });
    } catch (error) {
      logger.error('Failed to send Slack notification', error);
    }
  }

  deleteSubscription(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  getSubscriptionsByOwner(owner: string): NotificationSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.owner === owner);
  }

  toggleSubscription(id: string, active: boolean): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    sub.active = active;
    return true;
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    recentNotifications: number;
    byChannel: Record<string, number>;
  } {
    const subscriptions = Array.from(this.subscriptions.values());
    const byChannel: Record<string, number> = {};

    for (const sub of subscriptions) {
      byChannel[sub.channel] = (byChannel[sub.channel] || 0) + 1;
    }

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.active).length,
      recentNotifications: this.notificationHistory.filter(
        n => n.timestamp > Date.now() - 3600000 // Last hour
      ).length,
      byChannel,
    };
  }

  /**
   * Get recent notification history
   */
  getHistory(limit = 50): NotificationPayload[] {
    return this.notificationHistory
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear all subscriptions for an owner
   */
  clearSubscriptions(owner: string): number {
    const toDelete = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.owner === owner)
      .map(([id]) => id);

    toDelete.forEach(id => this.subscriptions.delete(id));
    return toDelete.length;
  }
}

export const notificationService = new NotificationService();

