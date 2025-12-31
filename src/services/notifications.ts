import { logger } from '../utils/logger';
import { WhaleAlert, SwapEvent } from '../types';

export enum NotificationChannel {
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
  WEBHOOK = 'webhook',
}

interface NotificationSubscription {
  id: string;
  owner: string;
  channel: NotificationChannel;
  config: {
    telegramChatId?: string;
    discordWebhookUrl?: string;
    webhookUrl?: string;
  };
  active: boolean;
}

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export class NotificationService {
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';

  createSubscription(
    owner: string,
    channel: NotificationChannel,
    config: NotificationSubscription['config']
  ): NotificationSubscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: NotificationSubscription = {
      id,
      owner,
      channel,
      config,
      active: true,
    };

    this.subscriptions.set(id, subscription);
    logger.info(`Created ${channel} notification subscription for ${owner}`);
    
    return subscription;
  }

  async notifyWhaleAlert(alert: WhaleAlert): Promise<void> {
    const payload: NotificationPayload = {
      type: 'whale_alert',
      title: '🐋 Whale Alert!',
      message: `Large ${alert.type} detected: ${alert.amount} tokens`,
      data: alert,
      timestamp: Date.now(),
    };

    await this.broadcast(payload);
  }

  async notifySwap(swap: SwapEvent): Promise<void> {
    const payload: NotificationPayload = {
      type: 'swap',
      title: '🔄 Large Swap Detected',
      message: `${swap.amountIn} ${swap.tokenIn} → ${swap.amountOut} ${swap.tokenOut}`,
      data: swap,
      timestamp: Date.now(),
    };

    await this.broadcast(payload);
  }

  private async broadcast(payload: NotificationPayload): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values()).filter(sub => sub.active);

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
}

export const notificationService = new NotificationService();

