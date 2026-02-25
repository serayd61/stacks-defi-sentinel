/**
 * Hyperbrowser Service
 * Browser-as-a-Service integration for web scraping & structured data extraction.
 * Designed for Starter plan (100 credits/day) with aggressive caching.
 *
 * API: https://api.hyperbrowser.ai
 * Auth: x-api-key header
 * Endpoints:
 *   POST /api/scrape       → start scrape job
 *   GET  /api/scrape/:id   → get scrape result
 */

import { logger } from '../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'links')[];
  onlyMainContent?: boolean;
  timeout?: number;
}

export interface ScrapeResult {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: {
    metadata?: { title?: string; description?: string; url?: string };
    markdown?: string;
    html?: string;
    links?: string[];
  };
  error?: string;
}

export interface ExtractedDexData {
  source: string;
  url: string;
  pools: Array<{
    name: string;
    tvl?: number;
    volume24h?: number;
    apr?: number;
    token0?: string;
    token1?: string;
  }>;
  totalTvl?: number;
  scrapedAt: string;
}

export interface ExtractedNewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface CreditUsage {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

// ── Cache Entry ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

// ── Service ────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.hyperbrowser.ai/api';
const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_CACHE_TTL = 1800_000; // 30 minutes in ms
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // 60 seconds max wait

export class HyperbrowserService {
  private apiKey: string;
  private dailyLimit: number;
  private dailyUsed: number = 0;
  private lastResetDate: string = '';
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheTtl: number;

  constructor() {
    this.apiKey = process.env.HYPERBROWSER_API_KEY || '';
    this.dailyLimit = parseInt(process.env.HYPERBROWSER_DAILY_LIMIT || String(DEFAULT_DAILY_LIMIT));
    this.cacheTtl = parseInt(process.env.SCRAPING_CACHE_TTL || '1800') * 1000;

    if (!this.apiKey) {
      logger.warn('HYPERBROWSER_API_KEY not set — web scraping disabled');
    } else {
      logger.info(`Hyperbrowser service initialized (daily limit: ${this.dailyLimit})`);
    }
  }

  // ── Credit Management ──────────────────────────────────────────────────────

  private resetDailyIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastResetDate !== today) {
      this.dailyUsed = 0;
      this.lastResetDate = today;
      logger.info('Hyperbrowser daily credit counter reset');
    }
  }

  private consumeCredit(count: number = 1): boolean {
    this.resetDailyIfNeeded();
    if (this.dailyUsed + count > this.dailyLimit) {
      logger.warn(`Hyperbrowser daily limit reached (${this.dailyUsed}/${this.dailyLimit})`);
      return false;
    }
    this.dailyUsed += count;
    return true;
  }

  getCreditUsage(): CreditUsage {
    this.resetDailyIfNeeded();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      used: this.dailyUsed,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - this.dailyUsed),
      resetAt: tomorrow.toISOString(),
    };
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  // ── Cache ──────────────────────────────────────────────────────────────────

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, { data, cachedAt: Date.now(), ttl: ttl ?? this.cacheTtl });
    // Evict old entries
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now - v.cachedAt > v.ttl) this.cache.delete(k);
      }
    }
  }

  // ── Core API ───────────────────────────────────────────────────────────────

  private async startScrapeJob(url: string, options?: ScrapeOptions): Promise<string | null> {
    if (!this.apiKey) return null;
    if (!this.consumeCredit()) return null;

    try {
      const res = await fetch(`${BASE_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          url,
          scrapeOptions: {
            formats: options?.formats ?? ['markdown'],
            onlyMainContent: options?.onlyMainContent ?? true,
            timeout: options?.timeout ?? 15000,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.error(`Hyperbrowser scrape start failed: ${res.status} ${errText}`);
        return null;
      }

      const body = (await res.json()) as { jobId?: string };
      return body.jobId ?? null;
    } catch (err) {
      logger.error('Hyperbrowser scrape request error:', err);
      return null;
    }
  }

  private async pollScrapeResult(jobId: string): Promise<ScrapeResult | null> {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      try {
        const res = await fetch(`${BASE_URL}/scrape/${jobId}`, {
          headers: { 'x-api-key': this.apiKey },
        });

        if (!res.ok) return null;

        const result = (await res.json()) as ScrapeResult;

        if (result.status === 'completed') return result;
        if (result.status === 'failed') {
          logger.error(`Hyperbrowser scrape failed: ${result.error}`);
          return null;
        }

        // Still pending/running — wait and retry
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      } catch {
        return null;
      }
    }

    logger.warn(`Hyperbrowser scrape timed out for job ${jobId}`);
    return null;
  }

  /**
   * Scrape a webpage. Returns cached result if available.
   */
  async scrapeWebpage(url: string, options?: ScrapeOptions): Promise<ScrapeResult | null> {
    const cacheKey = `scrape:${url}`;
    const cached = this.getCached<ScrapeResult>(cacheKey);
    if (cached) {
      logger.debug(`Hyperbrowser cache hit: ${url}`);
      return cached;
    }

    const jobId = await this.startScrapeJob(url, options);
    if (!jobId) return null;

    const result = await this.pollScrapeResult(jobId);
    if (result) {
      this.setCache(cacheKey, result);
    }
    return result;
  }

  // ── DEX Scraping ──────────────────────────────────────────────────────────

  /**
   * Scrape DEX platform pages and extract pool/TVL data.
   * Uses LLM-friendly markdown parsing.
   */
  async scrapeDexData(): Promise<ExtractedDexData[]> {
    const cacheKey = 'dex:all';
    const cached = this.getCached<ExtractedDexData[]>(cacheKey);
    if (cached) return cached;

    const targets = [
      { name: 'DeFi Llama (Stacks)', url: 'https://defillama.com/chain/Stacks' },
      { name: 'Velar', url: 'https://www.velar.co/pools' },
      { name: 'ALEX', url: 'https://app.alexlab.co/pool' },
      { name: 'STXCity', url: 'https://stxcity.com/' },
    ];

    const results: ExtractedDexData[] = [];

    for (const target of targets) {
      // Check per-URL cache
      const urlCacheKey = `dex:${target.name}`;
      const urlCached = this.getCached<ExtractedDexData>(urlCacheKey);
      if (urlCached) {
        results.push(urlCached);
        continue;
      }

      // Check credit budget
      if (this.getCreditUsage().remaining < 5) {
        logger.warn('Hyperbrowser credits low, skipping remaining DEX scrapes');
        break;
      }

      const scrapeResult = await this.scrapeWebpage(target.url);
      if (!scrapeResult?.data?.markdown) continue;

      const extracted: ExtractedDexData = {
        source: target.name,
        url: target.url,
        pools: [],
        scrapedAt: new Date().toISOString(),
      };

      // Parse TVL numbers from markdown content
      const markdown = scrapeResult.data.markdown;
      const tvlMatch = markdown.match(/\$[\d,.]+[BMK]?\s*(?:TVL|Total Value Locked)/i)
        || markdown.match(/(?:TVL|Total Value Locked)[:\s]*\$[\d,.]+[BMK]?/i);
      if (tvlMatch) {
        extracted.totalTvl = parseMoneyString(tvlMatch[0]);
      }

      // Extract pool data from table-like structures
      const poolLines = markdown.split('\n').filter(
        (line) =>
          line.includes('/') && // Token pairs like STX/USDA
          (line.includes('$') || line.includes('%'))
      );

      for (const line of poolLines.slice(0, 10)) {
        const pairMatch = line.match(/([A-Z]{2,10})\/([A-Z]{2,10})/);
        if (!pairMatch) continue;

        const pool: ExtractedDexData['pools'][0] = {
          name: `${pairMatch[1]}/${pairMatch[2]}`,
          token0: pairMatch[1],
          token1: pairMatch[2],
        };

        // Try extracting dollar amounts
        const dollarAmounts = [...line.matchAll(/\$([\d,.]+[BMK]?)/g)].map((m) =>
          parseMoneyString(m[0])
        );
        if (dollarAmounts.length >= 1) pool.tvl = dollarAmounts[0];
        if (dollarAmounts.length >= 2) pool.volume24h = dollarAmounts[1];

        // Try extracting percentages
        const pctMatch = line.match(/([\d.]+)%/);
        if (pctMatch) pool.apr = parseFloat(pctMatch[1]);

        results.push(extracted);
        extracted.pools.push(pool);
      }

      this.setCache(urlCacheKey, extracted, this.cacheTtl);
      logger.info(`DEX scraped: ${target.name} (${extracted.pools.length} pools)`);
    }

    if (results.length > 0) {
      this.setCache(cacheKey, results, this.cacheTtl);
    }
    return results;
  }

  // ── News Scraping ─────────────────────────────────────────────────────────

  /**
   * Scrape DeFi news sites for Stacks-related articles.
   */
  async scrapeNews(): Promise<ExtractedNewsItem[]> {
    const cacheKey = 'news:all';
    const cached = this.getCached<ExtractedNewsItem[]>(cacheKey);
    if (cached) return cached;

    const sources = [
      { name: 'CoinDesk', url: 'https://www.coindesk.com/tag/stacks/' },
      { name: 'The Block', url: 'https://www.theblock.co/search?query=stacks+stx' },
      { name: 'Stacks Blog', url: 'https://www.stacks.co/blog' },
      { name: 'DeFi Llama News', url: 'https://defillama.com/raises' },
    ];

    const allNews: ExtractedNewsItem[] = [];

    for (const source of sources) {
      if (this.getCreditUsage().remaining < 5) {
        logger.warn('Hyperbrowser credits low, skipping remaining news scrapes');
        break;
      }

      const scrapeResult = await this.scrapeWebpage(source.url, {
        formats: ['markdown'],
        onlyMainContent: true,
      });

      if (!scrapeResult?.data?.markdown) continue;

      const articles = extractArticlesFromMarkdown(scrapeResult.data.markdown, source.name);
      allNews.push(...articles);
      logger.info(`News scraped: ${source.name} (${articles.length} articles)`);
    }

    // Sort by relevance: high first, then medium, then low
    const relevanceOrder = { high: 0, medium: 1, low: 2 };
    allNews.sort((a, b) => relevanceOrder[a.relevance] - relevanceOrder[b.relevance]);

    // Keep top 20
    const trimmed = allNews.slice(0, 20);
    if (trimmed.length > 0) {
      this.setCache(cacheKey, trimmed, this.cacheTtl);
    }
    return trimmed;
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  /**
   * Get all web intelligence data (for the frontend dashboard).
   */
  async getWebIntelligence(): Promise<{
    dex: ExtractedDexData[];
    news: ExtractedNewsItem[];
    credits: CreditUsage;
  }> {
    const [dex, news] = await Promise.all([
      this.scrapeDexData().catch(() => [] as ExtractedDexData[]),
      this.scrapeNews().catch(() => [] as ExtractedNewsItem[]),
    ]);
    return { dex, news, credits: this.getCreditUsage() };
  }
}

// ── Utility Functions ──────────────────────────────────────────────────────────

function parseMoneyString(str: string): number {
  const clean = str.replace(/[^0-9.BMK]/gi, '');
  const numPart = parseFloat(clean.replace(/[BMK]/gi, ''));
  if (isNaN(numPart)) return 0;
  if (/B/i.test(clean)) return numPart * 1_000_000_000;
  if (/M/i.test(clean)) return numPart * 1_000_000;
  if (/K/i.test(clean)) return numPart * 1_000;
  return numPart;
}

function extractArticlesFromMarkdown(
  markdown: string,
  source: string,
): ExtractedNewsItem[] {
  const articles: ExtractedNewsItem[] = [];
  // Split by headings or link patterns
  const lines = markdown.split('\n');
  const stacksKeywords = ['stacks', 'stx', 'sbtc', 'clarity', 'hiro', 'alex', 'velar', 'arkadiko', 'pox'];

  let currentTitle = '';
  let currentSummary = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Heading or bold link = new article title
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/) || trimmed.match(/^\[(.+?)\]/);
    if (headingMatch) {
      // Save previous article if it exists
      if (currentTitle) {
        const item = buildNewsItem(currentTitle, currentSummary, source, stacksKeywords);
        if (item) articles.push(item);
      }
      currentTitle = headingMatch[1].replace(/\[|\]|\(.*?\)/g, '').trim();
      currentSummary = '';
      continue;
    }

    // Accumulate summary text
    if (currentTitle && currentSummary.length < 300) {
      currentSummary += ' ' + trimmed;
    }
  }

  // Last article
  if (currentTitle) {
    const item = buildNewsItem(currentTitle, currentSummary, source, stacksKeywords);
    if (item) articles.push(item);
  }

  return articles.slice(0, 10);
}

function buildNewsItem(
  title: string,
  summary: string,
  source: string,
  keywords: string[],
): ExtractedNewsItem | null {
  if (title.length < 10) return null;

  const combined = (title + ' ' + summary).toLowerCase();
  const matchCount = keywords.filter((k) => combined.includes(k)).length;

  // Skip articles with no relevance to Stacks ecosystem
  if (matchCount === 0 && source !== 'Stacks Blog') return null;

  const relevance: ExtractedNewsItem['relevance'] =
    matchCount >= 3 ? 'high' : matchCount >= 1 ? 'medium' : 'low';

  return {
    title: title.slice(0, 200),
    summary: summary.trim().slice(0, 300),
    source,
    url: '',
    publishedAt: new Date().toISOString(),
    relevance,
  };
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let instance: HyperbrowserService | null = null;

export function getHyperbrowserService(): HyperbrowserService {
  if (!instance) {
    instance = new HyperbrowserService();
  }
  return instance;
}
