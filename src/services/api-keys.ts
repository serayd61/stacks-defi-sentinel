import { logger } from '../utils/logger';
import crypto from 'crypto';

// API Key tiers
export enum ApiTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

// Rate limits per tier (requests per day)
export const TIER_LIMITS: Record<ApiTier, number> = {
  [ApiTier.FREE]: 100,
  [ApiTier.PRO]: 1000,
  [ApiTier.ENTERPRISE]: 10000,
};

// Price per tier (in STX)
export const TIER_PRICES: Record<ApiTier, number> = {
  [ApiTier.FREE]: 0,
  [ApiTier.PRO]: 5,
  [ApiTier.ENTERPRISE]: 25,
};

interface ApiKeyData {
  key: string;
  owner: string; // Stacks address
  tier: ApiTier;
  createdAt: number;
  expiresAt: number;
  requestCount: number;
  lastRequestDate: string; // YYYY-MM-DD
}

/**
 * API Key Management Service
 */
export class ApiKeyService {
  private keys: Map<string, ApiKeyData> = new Map();
  private ownerKeys: Map<string, string> = new Map(); // owner -> key

  constructor() {
    // Initialize with some demo keys
    this.createDemoKeys();
  }

  private createDemoKeys(): void {
    // Demo API key for testing
    const demoKey: ApiKeyData = {
      key: 'demo_api_key_12345',
      owner: 'SP000000000000000000002Q6VF78',
      tier: ApiTier.PRO,
      createdAt: Date.now(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      requestCount: 0,
      lastRequestDate: new Date().toISOString().split('T')[0],
    };
    this.keys.set(demoKey.key, demoKey);
    this.ownerKeys.set(demoKey.owner, demoKey.key);
  }

  /**
   * Generate a new API key
   */
  generateApiKey(owner: string, tier: ApiTier = ApiTier.FREE): string {
    // Check if owner already has a key
    if (this.ownerKeys.has(owner)) {
      throw new Error('Owner already has an API key');
    }

    // Generate unique key
    const prefix = tier === ApiTier.ENTERPRISE ? 'ent_' : tier === ApiTier.PRO ? 'pro_' : 'free_';
    const key = prefix + crypto.randomBytes(24).toString('hex');

    // Calculate expiry (30 days for free, 365 for paid)
    const expiryDays = tier === ApiTier.FREE ? 30 : 365;
    const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;

    const keyData: ApiKeyData = {
      key,
      owner,
      tier,
      createdAt: Date.now(),
      expiresAt,
      requestCount: 0,
      lastRequestDate: new Date().toISOString().split('T')[0],
    };

    this.keys.set(key, keyData);
    this.ownerKeys.set(owner, key);

    logger.info(`Generated ${tier} API key for ${owner}`);
    return key;
  }

  /**
   * Validate API key and check rate limits
   */
  validateKey(key: string): { valid: boolean; error?: string; tier?: ApiTier; remaining?: number } {
    const keyData = this.keys.get(key);

    if (!keyData) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiry
    if (Date.now() > keyData.expiresAt) {
      return { valid: false, error: 'API key expired' };
    }

    // Check rate limit
    const today = new Date().toISOString().split('T')[0];
    if (keyData.lastRequestDate !== today) {
      // Reset daily counter
      keyData.requestCount = 0;
      keyData.lastRequestDate = today;
    }

    const limit = TIER_LIMITS[keyData.tier];
    if (keyData.requestCount >= limit) {
      return { 
        valid: false, 
        error: `Rate limit exceeded. Limit: ${limit} requests/day`,
        tier: keyData.tier,
        remaining: 0,
      };
    }

    // Increment counter
    keyData.requestCount++;
    this.keys.set(key, keyData);

    return { 
      valid: true, 
      tier: keyData.tier,
      remaining: limit - keyData.requestCount,
    };
  }

  /**
   * Get key info (without exposing sensitive data)
   */
  getKeyInfo(key: string): Partial<ApiKeyData> | null {
    const keyData = this.keys.get(key);
    if (!keyData) return null;

    const today = new Date().toISOString().split('T')[0];
    const requestCount = keyData.lastRequestDate === today ? keyData.requestCount : 0;

    return {
      tier: keyData.tier,
      createdAt: keyData.createdAt,
      expiresAt: keyData.expiresAt,
      requestCount,
    };
  }

  /**
   * Upgrade API key tier
   */
  upgradeTier(key: string, newTier: ApiTier): boolean {
    const keyData = this.keys.get(key);
    if (!keyData) return false;

    keyData.tier = newTier;
    // Extend expiry for paid tiers
    if (newTier !== ApiTier.FREE) {
      keyData.expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    }

    this.keys.set(key, keyData);
    logger.info(`Upgraded API key to ${newTier}`);
    return true;
  }

  /**
   * Revoke API key
   */
  revokeKey(key: string): boolean {
    const keyData = this.keys.get(key);
    if (!keyData) return false;

    this.ownerKeys.delete(keyData.owner);
    this.keys.delete(key);
    logger.info(`Revoked API key for ${keyData.owner}`);
    return true;
  }

  /**
   * Get key by owner
   */
  getKeyByOwner(owner: string): string | null {
    return this.ownerKeys.get(owner) || null;
  }

  /**
   * Get all keys (admin only)
   */
  getAllKeys(): ApiKeyData[] {
    return Array.from(this.keys.values());
  }
}

// Singleton instance
export const apiKeyService = new ApiKeyService();

