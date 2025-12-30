/**
 * Analytics Module
 * Track user interactions and performance metrics
 */

type EventType = 
  | 'page_view'
  | 'wallet_connect'
  | 'wallet_disconnect'
  | 'swap_initiated'
  | 'swap_completed'
  | 'stake_initiated'
  | 'stake_completed'
  | 'unstake_initiated'
  | 'unstake_completed'
  | 'harvest_rewards'
  | 'flash_loan_requested'
  | 'flash_loan_completed'
  | 'vote_cast'
  | 'proposal_created'
  | 'contract_interaction'
  | 'error';

interface AnalyticsEvent {
  type: EventType;
  properties?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class Analytics {
  private static instance: Analytics;
  private sessionId: string;
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private isEnabled: boolean = true;
  private flushInterval: number = 10000; // 10 seconds
  private maxQueueSize: number = 100;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushInterval();
    this.trackPageView();
  }

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushInterval(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Enable or disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track an event
   */
  track(type: EventType, properties?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      type,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId || undefined,
    };

    this.eventQueue.push(event);

    // Flush if queue is full
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Track page view
   */
  trackPageView(page?: string): void {
    this.track('page_view', {
      page: page || window.location.pathname,
      referrer: document.referrer,
      title: document.title,
    });
  }

  /**
   * Track wallet connection
   */
  trackWalletConnect(walletType: string, address: string): void {
    this.track('wallet_connect', {
      walletType,
      address: address.slice(0, 10) + '...',
    });
  }

  /**
   * Track swap initiation
   */
  trackSwapInitiated(tokenIn: string, tokenOut: string, amountIn: number): void {
    this.track('swap_initiated', {
      tokenIn,
      tokenOut,
      amountIn,
    });
  }

  /**
   * Track swap completion
   */
  trackSwapCompleted(
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    amountOut: number,
    txId: string
  ): void {
    this.track('swap_completed', {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      txId,
    });
  }

  /**
   * Track staking
   */
  trackStake(pool: string, amount: number, txId?: string): void {
    this.track('stake_completed', {
      pool,
      amount,
      txId,
    });
  }

  /**
   * Track rewards harvest
   */
  trackHarvest(pool: string, amount: number, txId?: string): void {
    this.track('harvest_rewards', {
      pool,
      amount,
      txId,
    });
  }

  /**
   * Track flash loan
   */
  trackFlashLoan(amount: number, purpose: string, success: boolean): void {
    this.track(success ? 'flash_loan_completed' : 'error', {
      amount,
      purpose,
      success,
    });
  }

  /**
   * Track vote
   */
  trackVote(proposalId: number, vote: string): void {
    this.track('vote_cast', {
      proposalId,
      vote,
    });
  }

  /**
   * Track errors
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(name: string, value: number): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
    };

    // Send performance metrics immediately
    this.sendPerformanceMetric(metric);
  }

  /**
   * Flush event queue
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(events);
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue = [...events, ...this.eventQueue].slice(0, this.maxQueueSize);
      console.error('Failed to flush analytics:', error);
    }
  }

  /**
   * Send events to analytics endpoint
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    // In production, this would send to an analytics service
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', events);
      return;
    }

    // Example: Send to analytics API
    // await fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ events }),
    // });
  }

  /**
   * Send performance metric
   */
  private async sendPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Performance]', metric);
      return;
    }
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    const sessionStart = parseInt(this.sessionId.split('-')[0]);
    return Date.now() - sessionStart;
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.eventQueue.length;
  }
}

// Export singleton instance
export const analytics = Analytics.getInstance();

// Convenience exports
export const trackEvent = analytics.track.bind(analytics);
export const trackPageView = analytics.trackPageView.bind(analytics);
export const trackWalletConnect = analytics.trackWalletConnect.bind(analytics);
export const trackSwapInitiated = analytics.trackSwapInitiated.bind(analytics);
export const trackSwapCompleted = analytics.trackSwapCompleted.bind(analytics);
export const trackStake = analytics.trackStake.bind(analytics);
export const trackHarvest = analytics.trackHarvest.bind(analytics);
export const trackFlashLoan = analytics.trackFlashLoan.bind(analytics);
export const trackVote = analytics.trackVote.bind(analytics);
export const trackError = analytics.trackError.bind(analytics);
export const trackPerformance = analytics.trackPerformance.bind(analytics);

export default analytics;

