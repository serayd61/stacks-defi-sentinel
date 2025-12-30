// Price Service for DeFi Sentinel

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: number;
}

interface PriceCache {
  [symbol: string]: PriceData;
}

class PriceService {
  private cache: PriceCache = {};
  private updateInterval: NodeJS.Timer | null = null;

  async getPrice(symbol: string): Promise<number> {
    const cached = this.cache[symbol];
    if (cached && Date.now() - cached.lastUpdated < 60000) {
      return cached.price;
    }

    await this.fetchPrices([symbol]);
    return this.cache[symbol]?.price || 0;
  }

  async getPrices(symbols: string[]): Promise<PriceCache> {
    const needsUpdate = symbols.filter(s => {
      const cached = this.cache[s];
      return !cached || Date.now() - cached.lastUpdated > 60000;
    });

    if (needsUpdate.length > 0) {
      await this.fetchPrices(needsUpdate);
    }

    return symbols.reduce((acc, symbol) => {
      if (this.cache[symbol]) {
        acc[symbol] = this.cache[symbol];
      }
      return acc;
    }, {} as PriceCache);
  }

  private async fetchPrices(symbols: string[]): Promise<void> {
    // Simulated price fetch - replace with actual API
    const mockPrices: Record<string, number> = {
      STX: 1.85,
      BTC: 95000,
      ETH: 3400,
      ALEX: 0.45,
      VELAR: 0.12,
    };

    symbols.forEach(symbol => {
      this.cache[symbol] = {
        symbol,
        price: mockPrices[symbol] || Math.random() * 100,
        change24h: (Math.random() - 0.5) * 10,
        volume24h: Math.random() * 10000000,
        marketCap: Math.random() * 1000000000,
        lastUpdated: Date.now(),
      };
    });
  }

  formatPrice(price: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    }).format(price);
  }

  formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  startAutoUpdate(interval = 60000) {
    this.stopAutoUpdate();
    this.updateInterval = setInterval(() => {
      this.fetchPrices(Object.keys(this.cache));
    }, interval);
  }

  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const priceService = new PriceService();
export default priceService;
