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

// ── Whale Intelligence Types ──────────────────────────────────────────────────

export interface WhaleWallet {
  address: string;
  label?: string;
  stxBalance: number;
  topTokens: Array<{ symbol: string; balance: number; valueUsd?: number }>;
  recentActivity: Array<{
    type: 'transfer' | 'swap' | 'stake' | 'contract-call';
    description: string;
    amount?: number;
    timestamp: string;
  }>;
  totalValueUsd?: number;
  lastSeen: string;
}

export interface WhaleIntelligence {
  whales: WhaleWallet[];
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    wallet: string;
    timestamp: string;
  }>;
  scannedAt: string;
}

// ── Extract API Types ─────────────────────────────────────────────────────────

export interface ExtractOptions {
  prompt: string;
  schema?: Record<string, unknown>;
  sessionOptions?: { useProxy?: boolean; solveCaptchas?: boolean };
}

export interface ExtractResult {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: Record<string, unknown>;
  error?: string;
}

// ── DeFi Protocol Scanner Types ───────────────────────────────────────────────

export interface DefiProtocol {
  name: string;
  url: string;
  tvl: number;
  tvlChange24h?: number;
  poolCount: number;
  topPools: Array<{
    name: string;
    tvl: number;
    apr?: number;
    volume24h?: number;
  }>;
  tokens: string[];
  category: 'DEX' | 'Lending' | 'Staking' | 'Bridge' | 'Other';
  riskLevel: 'low' | 'medium' | 'high';
  scrapedAt: string;
}

export interface DefiScanResult {
  protocols: DefiProtocol[];
  totalTvl: number;
  totalPools: number;
  scannedAt: string;
}

// ── Governance & SIP Types ────────────────────────────────────────────────────

export interface SipProposal {
  sipNumber: string;
  title: string;
  status: 'draft' | 'discussion' | 'voting' | 'accepted' | 'rejected' | 'implemented';
  author: string;
  summary: string;
  url: string;
  createdAt?: string;
  votesFor?: number;
  votesAgainst?: number;
}

export interface GovernanceData {
  proposals: SipProposal[];
  activeCount: number;
  totalCount: number;
  scannedAt: string;
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

  // ── Extract API (Structured Data Extraction) ─────────────────────────────

  /**
   * Extract structured data from a URL using AI + JSON schema.
   * Uses Hyperbrowser Extract endpoint: POST /extract
   */
  async extractStructuredData<T = Record<string, unknown>>(
    url: string,
    options: ExtractOptions,
  ): Promise<T | null> {
    const cacheKey = `extract:${url}:${options.prompt.slice(0, 50)}`;
    const cached = this.getCached<T>(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) return null;
    if (!this.consumeCredit()) return null;

    try {
      const res = await fetch(`${BASE_URL}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          urls: [url],
          prompt: options.prompt,
          schema: options.schema,
          sessionOptions: options.sessionOptions,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.error(`Hyperbrowser extract failed: ${res.status} ${errText}`);
        return null;
      }

      const job = (await res.json()) as { jobId?: string };
      if (!job.jobId) return null;

      // Poll for result
      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        const pollRes = await fetch(`${BASE_URL}/extract/${job.jobId}`, {
          headers: { 'x-api-key': this.apiKey },
        });
        if (!pollRes.ok) return null;

        const result = (await pollRes.json()) as ExtractResult;
        if (result.status === 'completed' && result.data) {
          this.setCache(cacheKey, result.data as T);
          return result.data as T;
        }
        if (result.status === 'failed') {
          logger.error(`Extract job failed: ${result.error}`);
          return null;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      return null;
    } catch (err) {
      logger.error('Extract request error:', err);
      return null;
    }
  }

  // ── Whale Intelligence ───────────────────────────────────────────────────

  /**
   * Monitor top whale wallets by scraping Hiro Explorer + extracting data.
   * Uses ~8 credits/day (4 whales, checked every 6 hours).
   */
  async getWhaleIntelligence(): Promise<WhaleIntelligence> {
    const cacheKey = 'whale:intelligence';
    const cached = this.getCached<WhaleIntelligence>(cacheKey);
    if (cached) return cached;

    // Known Stacks whale/notable wallets
    const WHALE_WALLETS = [
      { address: 'SP000000000000000000002Q6VF78', label: 'Stacks Genesis' },
      { address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', label: 'Top Holder #1' },
      { address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', label: 'ALEX Protocol' },
      { address: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', label: 'Arkadiko' },
    ];

    const whales: WhaleWallet[] = [];
    const alerts: WhaleIntelligence['alerts'] = [];

    for (const { address, label } of WHALE_WALLETS) {
      if (this.getCreditUsage().remaining < 10) {
        logger.warn('Credits low, skipping remaining whale scans');
        break;
      }

      // Use Extract API to get structured wallet data from explorer
      const walletData = await this.extractStructuredData<{
        stxBalance?: number;
        tokenBalances?: Array<{ symbol: string; balance: number }>;
        recentTxs?: Array<{ type: string; description: string; amount?: number; time?: string }>;
        totalValue?: number;
      }>(
        `https://explorer.hiro.so/address/${address}?chain=mainnet`,
        {
          prompt: `Extract wallet information from this Stacks blockchain explorer page.
                   Get the STX balance (in STX, not microSTX), list of token holdings with symbols and balances,
                   and the 5 most recent transactions with type (transfer/swap/stake/contract-call),
                   description, amount, and timestamp.`,
          schema: {
            type: 'object',
            properties: {
              stxBalance: { type: 'number', description: 'STX balance' },
              tokenBalances: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    symbol: { type: 'string' },
                    balance: { type: 'number' },
                  },
                },
              },
              recentTxs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['transfer', 'swap', 'stake', 'contract-call'] },
                    description: { type: 'string' },
                    amount: { type: 'number' },
                    time: { type: 'string' },
                  },
                },
              },
              totalValue: { type: 'number', description: 'Total portfolio value in USD' },
            },
          },
        },
      );

      // Fallback: if Extract API fails, try basic scrape + parse
      let wallet: WhaleWallet;
      if (walletData) {
        wallet = {
          address,
          label,
          stxBalance: walletData.stxBalance ?? 0,
          topTokens: (walletData.tokenBalances ?? []).map((t) => ({
            symbol: t.symbol,
            balance: t.balance,
          })),
          recentActivity: (walletData.recentTxs ?? []).map((tx) => ({
            type: (tx.type as WhaleWallet['recentActivity'][0]['type']) || 'contract-call',
            description: tx.description || 'Transaction',
            amount: tx.amount,
            timestamp: tx.time || new Date().toISOString(),
          })),
          totalValueUsd: walletData.totalValue,
          lastSeen: new Date().toISOString(),
        };
        logger.info(`Whale extracted: ${label} (${address.slice(0, 8)}...) — ${wallet.stxBalance} STX`);
      } else {
        // Fallback: basic scrape
        const scrapeResult = await this.scrapeWebpage(
          `https://explorer.hiro.so/address/${address}?chain=mainnet`,
        );
        const md = scrapeResult?.data?.markdown || '';
        const balanceMatch = md.match(/([\d,.]+)\s*STX/);
        wallet = {
          address,
          label,
          stxBalance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0,
          topTokens: [],
          recentActivity: [],
          lastSeen: new Date().toISOString(),
        };
        logger.info(`Whale scraped (fallback): ${label} — ${wallet.stxBalance} STX`);
      }

      // Generate alerts for large balances
      if (wallet.stxBalance > 1_000_000) {
        alerts.push({
          severity: 'info',
          message: `${label} holds ${(wallet.stxBalance / 1_000_000).toFixed(1)}M STX`,
          wallet: address,
          timestamp: new Date().toISOString(),
        });
      }

      whales.push(wallet);
    }

    const result: WhaleIntelligence = {
      whales,
      alerts,
      scannedAt: new Date().toISOString(),
    };

    // Cache for 6 hours (whale data doesn't change fast)
    this.setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    return result;
  }

  // ── Crawl API ─────────────────────────────────────────────────────────────

  /**
   * Crawl a website starting from a URL, following links up to maxPages.
   * Uses Hyperbrowser Crawl endpoint: POST /crawl
   */
  async crawlWebsite(
    url: string,
    maxPages: number = 3,
  ): Promise<Array<{ url: string; markdown: string }> | null> {
    const cacheKey = `crawl:${url}:${maxPages}`;
    const cached = this.getCached<Array<{ url: string; markdown: string }>>(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) return null;
    if (!this.consumeCredit(maxPages)) return null; // crawl costs ~1 credit per page

    try {
      const res = await fetch(`${BASE_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          url,
          maxPages,
          scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
        }),
      });

      if (!res.ok) {
        logger.error(`Hyperbrowser crawl failed: ${res.status}`);
        return null;
      }

      const job = (await res.json()) as { jobId?: string };
      if (!job.jobId) return null;

      // Poll for result
      for (let i = 0; i < MAX_POLL_ATTEMPTS * 2; i++) { // crawl takes longer
        const pollRes = await fetch(`${BASE_URL}/crawl/${job.jobId}`, {
          headers: { 'x-api-key': this.apiKey },
        });
        if (!pollRes.ok) return null;

        const result = (await pollRes.json()) as {
          status: string;
          data?: Array<{ metadata?: { url?: string }; markdown?: string }>;
          error?: string;
        };

        if (result.status === 'completed' && result.data) {
          const pages = result.data
            .filter((p) => p.markdown)
            .map((p) => ({ url: p.metadata?.url || url, markdown: p.markdown! }));
          this.setCache(cacheKey, pages);
          return pages;
        }
        if (result.status === 'failed') {
          logger.error(`Crawl failed: ${result.error}`);
          return null;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 1.5));
      }
      return null;
    } catch (err) {
      logger.error('Crawl request error:', err);
      return null;
    }
  }

  // ── DeFi Protocol Deep Scanner ───────────────────────────────────────────

  /**
   * Scan Stacks DeFi protocols using Crawl + Extract APIs.
   * Generates a protocol comparison report.
   * ~12 credits/day (3 protocols × 4 pages crawl)
   */
  async scanDefiProtocols(): Promise<DefiScanResult> {
    const cacheKey = 'defi:scan';
    const cached = this.getCached<DefiScanResult>(cacheKey);
    if (cached) return cached;

    const PROTOCOLS = [
      {
        name: 'ALEX', url: 'https://app.alexlab.co',
        category: 'DEX' as const, crawlPages: 3,
      },
      {
        name: 'Velar', url: 'https://www.velar.co',
        category: 'DEX' as const, crawlPages: 3,
      },
      {
        name: 'Arkadiko', url: 'https://arkadiko.finance',
        category: 'Lending' as const, crawlPages: 3,
      },
      {
        name: 'STXCity', url: 'https://stxcity.com',
        category: 'DEX' as const, crawlPages: 2,
      },
    ];

    const protocols: DefiProtocol[] = [];

    for (const proto of PROTOCOLS) {
      if (this.getCreditUsage().remaining < 8) {
        logger.warn('Credits low, skipping remaining protocol scans');
        break;
      }

      logger.info(`DeFi scan: crawling ${proto.name}...`);

      // Step 1: Crawl the protocol pages
      const pages = await this.crawlWebsite(proto.url, proto.crawlPages);
      if (!pages || pages.length === 0) {
        logger.warn(`DeFi scan ${proto.name}: no pages crawled`);
        continue;
      }

      logger.info(`DeFi scan ${proto.name}: crawled ${pages.length} pages`);

      // Step 2: Extract structured data using Extract API
      const extracted = await this.extractStructuredData<{
        tvl?: number;
        poolCount?: number;
        topPools?: Array<{ name: string; tvl?: number; apr?: number; volume?: number }>;
        tokens?: string[];
      }>(proto.url, {
        prompt: `Analyze this DeFi protocol page. Extract:
                 1. Total TVL (Total Value Locked) in USD
                 2. Number of liquidity pools
                 3. Top 5 pools with name, TVL, APR%, and 24h volume
                 4. List of supported tokens (symbols only)`,
        schema: {
          type: 'object',
          properties: {
            tvl: { type: 'number', description: 'Total TVL in USD' },
            poolCount: { type: 'number' },
            topPools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  tvl: { type: 'number' },
                  apr: { type: 'number' },
                  volume: { type: 'number' },
                },
              },
            },
            tokens: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      // Step 3: Also parse markdown for TVL if Extract failed
      let tvl = extracted?.tvl ?? 0;
      let poolCount = extracted?.poolCount ?? 0;
      const topPools = (extracted?.topPools ?? []).map((p) => ({
        name: p.name,
        tvl: p.tvl ?? 0,
        apr: p.apr,
        volume24h: p.volume,
      }));
      const tokens = extracted?.tokens ?? [];

      if (tvl === 0) {
        // Fallback: parse from crawled markdown
        for (const page of pages) {
          const tvlMatch = page.markdown.match(/\$([\d,.]+)\s*[BMK]?\s*(?:TVL|Total Value)/i);
          if (tvlMatch) {
            tvl = parseMoneyString(tvlMatch[0]);
            break;
          }
        }
      }

      if (poolCount === 0) {
        // Count pool-like lines
        for (const page of pages) {
          const pairCount = (page.markdown.match(/[A-Z]{2,10}\s*[\/\-]\s*[A-Z]{2,10}/g) || []).length;
          poolCount = Math.max(poolCount, pairCount);
        }
      }

      // Risk assessment
      const riskLevel: DefiProtocol['riskLevel'] =
        tvl > 30_000_000 ? 'low' : tvl > 5_000_000 ? 'medium' : 'high';

      protocols.push({
        name: proto.name,
        url: proto.url,
        tvl,
        poolCount,
        topPools: topPools.slice(0, 5),
        tokens: tokens.slice(0, 20),
        category: proto.category,
        riskLevel,
        scrapedAt: new Date().toISOString(),
      });

      logger.info(`DeFi scan ${proto.name}: TVL=${tvl}, pools=${poolCount}, risk=${riskLevel}`);
    }

    const result: DefiScanResult = {
      protocols,
      totalTvl: protocols.reduce((sum, p) => sum + p.tvl, 0),
      totalPools: protocols.reduce((sum, p) => sum + p.poolCount, 0),
      scannedAt: new Date().toISOString(),
    };

    // Cache for 12 hours
    this.setCache(cacheKey, result, 12 * 60 * 60 * 1000);
    return result;
  }

  // ── Governance & SIP Tracker ──────────────────────────────────────────────

  /**
   * Track Stacks governance proposals (SIPs) from GitHub + Stacks.co.
   * Uses Extract API for structured proposal data. ~4 credits/day.
   */
  async getGovernanceData(): Promise<GovernanceData> {
    const cacheKey = 'governance:data';
    const cached = this.getCached<GovernanceData>(cacheKey);
    if (cached) return cached;

    const proposals: SipProposal[] = [];

    // Source 1: GitHub SIPs repository
    if (this.getCreditUsage().remaining >= 5) {
      const sipData = await this.extractStructuredData<{
        proposals?: Array<{
          number?: string;
          title?: string;
          status?: string;
          author?: string;
          summary?: string;
        }>;
      }>(
        'https://github.com/stacksgov/sips',
        {
          prompt: `Extract all Stacks Improvement Proposals (SIPs) from this GitHub repository page.
                   For each SIP, get: SIP number, title, status (draft/discussion/voting/accepted/rejected/implemented),
                   author name, and a brief 1-line summary.`,
          schema: {
            type: 'object',
            properties: {
              proposals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'string' },
                    title: { type: 'string' },
                    status: { type: 'string' },
                    author: { type: 'string' },
                    summary: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      );

      if (sipData?.proposals) {
        for (const p of sipData.proposals) {
          if (!p.title || !p.number) continue;
          const validStatuses = ['draft', 'discussion', 'voting', 'accepted', 'rejected', 'implemented'];
          const status = validStatuses.includes(p.status?.toLowerCase() ?? '')
            ? (p.status!.toLowerCase() as SipProposal['status'])
            : 'draft';
          proposals.push({
            sipNumber: p.number.startsWith('SIP') ? p.number : `SIP-${p.number}`,
            title: p.title.slice(0, 200),
            status,
            author: p.author || 'Unknown',
            summary: p.summary?.slice(0, 300) || '',
            url: `https://github.com/stacksgov/sips/blob/main/sips/${p.number?.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`,
          });
        }
        logger.info(`Governance: extracted ${proposals.length} SIPs from GitHub`);
      }
    }

    // Source 2: Stacks.co blog/governance page for updates
    if (this.getCreditUsage().remaining >= 3) {
      const govPage = await this.scrapeWebpage('https://www.stacks.co/blog', {
        formats: ['markdown'],
        onlyMainContent: true,
      });

      if (govPage?.data?.markdown) {
        const md = govPage.data.markdown;
        // Look for governance-related articles
        const govKeywords = ['sip', 'governance', 'vote', 'proposal', 'upgrade', 'nakamoto', 'pox'];
        const lines = md.split('\n');
        let currentTitle = '';

        for (const line of lines) {
          const heading = line.match(/^#{1,3}\s+(.+)/);
          if (heading) {
            currentTitle = heading[1].replace(/\[|\]|\(.*?\)/g, '').trim();
            continue;
          }

          if (currentTitle) {
            const combined = (currentTitle + ' ' + line).toLowerCase();
            const isGov = govKeywords.some((k) => combined.includes(k));
            if (isGov && currentTitle.length > 15) {
              // Avoid duplicates
              if (!proposals.some((p) => p.title === currentTitle)) {
                proposals.push({
                  sipNumber: 'Update',
                  title: currentTitle.slice(0, 200),
                  status: 'discussion',
                  author: 'Stacks Foundation',
                  summary: line.trim().slice(0, 300),
                  url: 'https://www.stacks.co/blog',
                });
              }
              currentTitle = '';
            }
          }
        }
        logger.info(`Governance: found gov-related updates from Stacks blog`);
      }
    }

    const activeCount = proposals.filter((p) =>
      ['draft', 'discussion', 'voting'].includes(p.status),
    ).length;

    const result: GovernanceData = {
      proposals,
      activeCount,
      totalCount: proposals.length,
      scannedAt: new Date().toISOString(),
    };

    // Cache for 12 hours
    this.setCache(cacheKey, result, 12 * 60 * 60 * 1000);
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

      // Log scraped content for debugging
      logger.info(`DEX scrape ${target.name}: ${markdown.length} chars`);
      if (markdown.length < 200) {
        logger.warn(`DEX scrape ${target.name}: short content — "${markdown.slice(0, 200)}"`);
      }

      // Extract pool data from table-like structures
      const poolLines = markdown.split('\n').filter(
        (line) =>
          line.includes('/') && // Token pairs like STX/USDA
          (line.includes('$') || line.includes('%'))
      );

      // Fallback: looser matching for token pairs
      if (poolLines.length === 0) {
        const altLines = markdown.split('\n').filter(
          (line) => /[A-Z]{2,10}\s*[\/\-]\s*[A-Z]{2,10}/i.test(line)
        );
        poolLines.push(...altLines.slice(0, 10));
      }

      for (const line of poolLines.slice(0, 10)) {
        const pairMatch = line.match(/([A-Z]{2,10})\s*[\/\-]\s*([A-Z]{2,10})/);
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

        extracted.pools.push(pool);
      }

      // Always push (even with 0 pools — still shows source was scraped)
      results.push(extracted);
      this.setCache(urlCacheKey, extracted, this.cacheTtl);
      logger.info(`DEX scraped: ${target.name} — TVL: ${extracted.totalTvl ?? 'N/A'}, pools: ${extracted.pools.length}`);
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

      if (!scrapeResult?.data?.markdown) {
        logger.warn(`News scrape ${source.name}: no markdown returned`);
        continue;
      }

      logger.info(`News scrape ${source.name}: ${scrapeResult.data.markdown.length} chars`);
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
      this.scrapeDexData().catch((err) => {
        logger.error('scrapeDexData failed:', err);
        return [] as ExtractedDexData[];
      }),
      this.scrapeNews().catch((err) => {
        logger.error('scrapeNews failed:', err);
        return [] as ExtractedNewsItem[];
      }),
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

  // For DeFi Llama raises and Stacks Blog, keep all articles
  // For other sources, require at least one Stacks keyword
  const alwaysInclude = source === 'Stacks Blog' || source === 'DeFi Llama News';
  if (matchCount === 0 && !alwaysInclude) return null;

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
