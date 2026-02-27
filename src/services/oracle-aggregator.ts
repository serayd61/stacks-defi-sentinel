/**
 * Oracle Aggregator Service
 * Fetches real-time prices from multiple oracle sources:
 * - Pyth Network (via Hermes API)
 * - DIA Oracle (on-chain)
 * - CoinGecko (off-chain backup)
 * - ALEX DEX (on-chain prices)
 */

import { logger } from '../utils/logger';

// Pyth Price Feed IDs
const PYTH_FEED_IDS = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  STX: '0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17',
  USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

// DIA Oracle contract
const DIA_ORACLE = 'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle';

// ALEX API
const ALEX_API = 'https://api.alexgo.io';

interface PriceData {
  symbol: string;
  price: number;
  priceUsd: number;
  change24h: number;
  source: string;
  confidence: number;
  timestamp: number;
  sources: {
    pyth?: number;
    dia?: number;
    coingecko?: number;
    alex?: number;
  };
}

interface OracleConfig {
  enablePyth: boolean;
  enableDIA: boolean;
  enableCoinGecko: boolean;
  enableALEX: boolean;
  updateIntervalMs: number;
}

export class OracleAggregatorService {
  private prices: Map<string, PriceData> = new Map();
  private config: OracleConfig;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<OracleConfig> = {}) {
    this.config = {
      enablePyth: config.enablePyth ?? true,
      enableDIA: config.enableDIA ?? true,
      enableCoinGecko: config.enableCoinGecko ?? true,
      enableALEX: config.enableALEX ?? true,
      updateIntervalMs: config.updateIntervalMs ?? 30000, // 30 seconds
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🔮 Oracle Aggregator Service starting...');
    
    // Initial fetch
    await this.updateAllPrices();
    
    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateAllPrices().catch(err => {
        logger.error('Oracle update error:', err);
      });
    }, this.config.updateIntervalMs);
    
    logger.info('✅ Oracle Aggregator Service started');
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Oracle Aggregator Service stopped');
  }

  async updateAllPrices(): Promise<void> {
    const symbols = ['BTC', 'ETH', 'STX', 'ALEX', 'USDA', 'sBTC', 'WELSH', 'VELAR'];
    
    await Promise.all([
      this.config.enablePyth && this.fetchPythPrices(),
      this.config.enableCoinGecko && this.fetchCoinGeckoPrices(symbols),
      this.config.enableALEX && this.fetchALEXPrices(),
    ]);
    
    // Aggregate prices from all sources
    this.aggregatePrices();
  }

  private async fetchPythPrices(): Promise<void> {
    try {
      const feedIds = Object.values(PYTH_FEED_IDS);
      const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedIds.join('&ids[]=')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Pyth API error: ${response.status}`);
      
      const data = await response.json() as { parsed?: Array<{ id: string; price: { price: string; expo: number } }> };
      
      for (const feed of data.parsed || []) {
        const symbol = Object.entries(PYTH_FEED_IDS).find(
          ([, id]) => id === `0x${feed.id}`
        )?.[0];
        
        if (symbol) {
          const price = parseFloat(feed.price.price) * Math.pow(10, feed.price.expo);
          const existing = this.prices.get(symbol) || this.createEmptyPrice(symbol);
          existing.sources.pyth = price;
          existing.timestamp = Date.now();
          this.prices.set(symbol, existing);
        }
      }
      
      logger.debug('Pyth prices updated');
    } catch (error) {
      logger.warn('Failed to fetch Pyth prices:', error);
    }
  }

  private async fetchCoinGeckoPrices(symbols: string[]): Promise<void> {
    try {
      const coinIds = {
        BTC: 'bitcoin',
        ETH: 'ethereum',
        STX: 'blockstack',
        ALEX: 'alex-lab',
        USDA: 'usda',
        sBTC: 'bitcoin', // sBTC pegged to BTC
        WELSH: 'welsh-corgi-coin',
        VELAR: 'velar',
      };
      
      const ids = symbols
        .map(s => coinIds[s as keyof typeof coinIds])
        .filter(Boolean)
        .join(',');
      
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
      
      const data = await response.json();
      
      for (const [symbol, coinId] of Object.entries(coinIds)) {
        if (data[coinId]) {
          const existing = this.prices.get(symbol) || this.createEmptyPrice(symbol);
          existing.sources.coingecko = data[coinId].usd;
          existing.change24h = data[coinId].usd_24h_change || 0;
          existing.timestamp = Date.now();
          this.prices.set(symbol, existing);
        }
      }
      
      logger.debug('CoinGecko prices updated');
    } catch (error) {
      logger.warn('Failed to fetch CoinGecko prices:', error);
    }
  }

  private async fetchALEXPrices(): Promise<void> {
    try {
      // Fetch ALEX token prices
      const response = await fetch(`${ALEX_API}/v1/price_history?token=age000-governance-token&limit=1`);
      
      if (response.ok) {
        const data = await response.json() as Array<{ avg_price_usd?: number }>;
        if (data.length > 0 && data[0].avg_price_usd) {
          const existing = this.prices.get('ALEX') || this.createEmptyPrice('ALEX');
          existing.sources.alex = data[0].avg_price_usd;
          existing.timestamp = Date.now();
          this.prices.set('ALEX', existing);
        }
      }
      
      // Fetch STX price from ALEX
      const stxResponse = await fetch(`${ALEX_API}/v1/stats`);
      if (stxResponse.ok) {
        const stats = await stxResponse.json() as { stx_price?: number };
        if (stats.stx_price) {
          const existing = this.prices.get('STX') || this.createEmptyPrice('STX');
          existing.sources.alex = stats.stx_price;
          existing.timestamp = Date.now();
          this.prices.set('STX', existing);
        }
      }
      
      logger.debug('ALEX prices updated');
    } catch (error) {
      logger.warn('Failed to fetch ALEX prices:', error);
    }
  }

  private aggregatePrices(): void {
    for (const [symbol, priceData] of this.prices.entries()) {
      const sources = priceData.sources;
      const validPrices = Object.values(sources).filter(p => p && p > 0);
      
      if (validPrices.length > 0) {
        // Calculate weighted average (Pyth has highest weight)
        let totalWeight = 0;
        let weightedSum = 0;
        
        if (sources.pyth) {
          weightedSum += sources.pyth * 3;
          totalWeight += 3;
        }
        if (sources.dia) {
          weightedSum += sources.dia * 2;
          totalWeight += 2;
        }
        if (sources.coingecko) {
          weightedSum += sources.coingecko * 1;
          totalWeight += 1;
        }
        if (sources.alex) {
          weightedSum += sources.alex * 1;
          totalWeight += 1;
        }
        
        priceData.price = weightedSum / totalWeight;
        priceData.priceUsd = priceData.price;
        priceData.confidence = Math.min(100, validPrices.length * 25);
        priceData.source = validPrices.length > 1 ? 'aggregated' : 
          sources.pyth ? 'pyth' : 
          sources.dia ? 'dia' : 
          sources.coingecko ? 'coingecko' : 'alex';
      }
    }
  }

  private createEmptyPrice(symbol: string): PriceData {
    return {
      symbol,
      price: 0,
      priceUsd: 0,
      change24h: 0,
      source: 'none',
      confidence: 0,
      timestamp: Date.now(),
      sources: {},
    };
  }

  // Public API methods
  
  getPrice(symbol: string): PriceData | null {
    return this.prices.get(symbol.toUpperCase()) || null;
  }

  getAllPrices(): PriceData[] {
    return Array.from(this.prices.values());
  }

  getPriceMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [symbol, data] of this.prices.entries()) {
      map[symbol] = data.price;
    }
    return map;
  }

  getFormattedPrices(): Array<{
    symbol: string;
    price: string;
    change24h: string;
    confidence: number;
    sources: string[];
  }> {
    return this.getAllPrices().map(p => ({
      symbol: p.symbol,
      price: `$${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      change24h: `${p.change24h >= 0 ? '+' : ''}${p.change24h.toFixed(2)}%`,
      confidence: p.confidence,
      sources: Object.entries(p.sources)
        .filter(([, v]) => v && v > 0)
        .map(([k]) => k),
    }));
  }
}

// Singleton instance
let oracleService: OracleAggregatorService | null = null;

export function getOracleService(): OracleAggregatorService {
  if (!oracleService) {
    oracleService = new OracleAggregatorService();
  }
  return oracleService;
}
