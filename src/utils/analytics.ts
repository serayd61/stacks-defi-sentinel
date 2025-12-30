// Analytics utilities for DeFi Sentinel

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private userId: string | null = null;

  identify(userId: string) {
    this.userId = userId;
    this.track('user_identified', { userId });
  }

  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        userId: this.userId,
        url: window.location.href,
        referrer: document.referrer,
      },
      timestamp: Date.now(),
    };

    this.events.push(analyticsEvent);
    console.log('[Analytics]', event, properties);
  }

  // Pre-defined events
  pageView(page: string) {
    this.track('page_view', { page });
  }

  walletConnected(address: string) {
    this.track('wallet_connected', { address: address.slice(0, 10) + '...' });
  }

  swapInitiated(params: { fromToken: string; toToken: string; amount: number }) {
    this.track('swap_initiated', params);
  }

  stakeDeposit(amount: number) {
    this.track('stake_deposit', { amount });
  }

  tokenPurchase(amount: number, price: number) {
    this.track('token_purchase', { amount, price, total: amount * price });
  }

  error(errorType: string, message: string) {
    this.track('error', { errorType, message });
  }

  getEvents() {
    return [...this.events];
  }
}

export const analytics = new Analytics();
export default analytics;
