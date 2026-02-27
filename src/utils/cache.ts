import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class CacheService {
    private client: Redis | null = null;
    private isConnected = false;

    constructor() {
        try {
            this.client = new Redis(REDIS_URL, {
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn('Redis connection failed, falling back to memory cache.');
                        return null; // Stop retrying
                    }
                    return Math.min(times * 50, 2000);
                },
                maxRetriesPerRequest: 1,
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                logger.info('Connected to Redis cache');
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                logger.warn(`Redis connection error: ${err.message}`);
            });
        } catch (error) {
            logger.warn('Failed to initialize Redis, passing through.');
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.isConnected || !this.client) return null;
        try {
            const data = await this.client.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            logger.warn(`Cache get error for key ${key}`);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
        if (!this.isConnected || !this.client) return;
        try {
            await this.client.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (error) {
            logger.warn(`Cache set error for key ${key}`);
        }
    }

    /**
     * Helper to fetch data or fallback to a function
     */
    async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached) return cached;

        const freshData = await fetchFn();
        await this.set(key, freshData, ttlSeconds);
        return freshData;
    }
}

export const cacheService = new CacheService();
