import { AnalyticsService } from '../src/services/analytics';
import { SwapEvent, WhaleAlert, PoolStats, TokenStats } from '../src/types';

describe('AnalyticsService', () => {
    let analytics: AnalyticsService;

    beforeEach(() => {
        // Reset service before each test
        analytics = new AnalyticsService();
    });

    const mockSwap: SwapEvent = {
        txId: 'tx123',
        timestamp: new Date().toISOString(),
        sender: 'user1',
        dex: 'velar',
        pool: 'pool1',
        tokenIn: 'tokenA',
        tokenOut: 'tokenB',
        amountIn: 100,
        amountOut: 98,
        priceImpact: 0.1,
        fee: 1,
    };

    const mockWhaleAlert: WhaleAlert = {
        id: 'alert1',
        timestamp: new Date().toISOString(),
        type: 'large_swap',
        severity: 'high',
        message: 'Large swap detected',
        txId: 'tx123',
        valueUsd: 150000,
    };

    test('should record and retrieve a swap', () => {
        analytics.recordSwap(mockSwap);
        const stats = analytics.getDashboardStats();
        expect(stats.recentSwaps).toHaveLength(1);
        expect(stats.recentSwaps[0].txId).toBe('tx123');
    });

    test('should record and retrieve a whale alert', () => {
        analytics.recordAlert(mockWhaleAlert);
        const alerts = analytics.getWhaleAlerts(10);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].id).toBe('alert1');
    });

    test('should calculcate 24h dashboard stats properly', () => {
        analytics.recordSwap(mockSwap);

        // Create an old swap
        const oldSwap = { ...mockSwap, txId: 'tx456', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() };
        analytics.recordSwap(oldSwap);

        const stats = analytics.getDashboardStats();

        // Only the recent swap should be in 24h volume
        expect(stats.totalVolume24h).toBe(100);
        expect(stats.totalTransactions24h).toBe(1);
        expect(stats.activeWallets24h).toBe(1);
    });

    test('should manage pool and token stats', () => {
        const pStats: PoolStats = {
            id: 'p1', name: 'Pool 1', dex: 'velar', tvl: 1000, volume24h: 500, apr: 10,
            token0: 't1', token1: 't2',
            reserve0: 100, reserve1: 900
        };
        const tStats: TokenStats = {
            id: 't1', symbol: 'T1', name: 'Token 1', price: 1, change24h: 5, volume24h: 200, liquidity: 1000
        };

        analytics.updatePoolStats('p1', pStats);
        analytics.updateTokenStats('T1', tStats);

        const topPools = analytics.getTopPools(1);
        expect(topPools).toHaveLength(1);
        expect(topPools[0].tvl).toBe(1000);

        const topTokens = analytics.getTopTokens(1);
        expect(topTokens).toHaveLength(1);
        expect(topTokens[0].symbol).toBe('T1');
    });

});
