import { Type, Static } from '@sinclair/typebox';

// ============================================
// DeFi Event Types
// ============================================

export const SwapEventSchema = Type.Object({
  txId: Type.String(),
  blockHeight: Type.Number(),
  blockHash: Type.String(),
  timestamp: Type.Number(),
  sender: Type.String(),
  tokenIn: Type.Object({
    contract: Type.String(),
    symbol: Type.String(),
    amount: Type.String(),
    amountUsd: Type.Optional(Type.Number()),
  }),
  tokenOut: Type.Object({
    contract: Type.String(),
    symbol: Type.String(),
    amount: Type.String(),
    amountUsd: Type.Optional(Type.Number()),
  }),
  dexContract: Type.String(),
  dexName: Type.String(),
  priceImpact: Type.Optional(Type.Number()),
});

export type SwapEvent = Static<typeof SwapEventSchema>;

export const LiquidityEventSchema = Type.Object({
  txId: Type.String(),
  blockHeight: Type.Number(),
  blockHash: Type.String(),
  timestamp: Type.Number(),
  sender: Type.String(),
  type: Type.Union([Type.Literal('add'), Type.Literal('remove')]),
  pool: Type.Object({
    contract: Type.String(),
    name: Type.String(),
    token0: Type.String(),
    token1: Type.String(),
  }),
  amounts: Type.Object({
    token0Amount: Type.String(),
    token1Amount: Type.String(),
    lpTokenAmount: Type.String(),
  }),
  totalValueUsd: Type.Optional(Type.Number()),
});

export type LiquidityEvent = Static<typeof LiquidityEventSchema>;

export const TokenTransferSchema = Type.Object({
  txId: Type.String(),
  blockHeight: Type.Number(),
  blockHash: Type.String(),
  timestamp: Type.Number(),
  sender: Type.String(),
  recipient: Type.String(),
  token: Type.Object({
    contract: Type.String(),
    symbol: Type.String(),
    decimals: Type.Number(),
  }),
  amount: Type.String(),
  amountUsd: Type.Optional(Type.Number()),
  isWhaleTransaction: Type.Boolean(),
});

export type TokenTransfer = Static<typeof TokenTransferSchema>;

export const WhaleAlertSchema = Type.Object({
  id: Type.String(),
  type: Type.Union([
    Type.Literal('large_transfer'),
    Type.Literal('large_swap'),
    Type.Literal('large_liquidity'),
    Type.Literal('new_wallet_activity'),
  ]),
  severity: Type.Union([
    Type.Literal('info'),
    Type.Literal('warning'),
    Type.Literal('critical'),
  ]),
  event: Type.Any(),
  message: Type.String(),
  timestamp: Type.Number(),
});

export type WhaleAlert = Static<typeof WhaleAlertSchema>;

// ============================================
// Pool & Token Types
// ============================================

export const PoolStatsSchema = Type.Object({
  contract: Type.String(),
  name: Type.String(),
  token0: Type.Object({
    contract: Type.String(),
    symbol: Type.String(),
    reserve: Type.String(),
    reserveUsd: Type.Optional(Type.Number()),
  }),
  token1: Type.Object({
    contract: Type.String(),
    symbol: Type.String(),
    reserve: Type.String(),
    reserveUsd: Type.Optional(Type.Number()),
  }),
  tvlUsd: Type.Number(),
  volume24h: Type.Number(),
  fees24h: Type.Number(),
  apr: Type.Number(),
  priceToken0InToken1: Type.Number(),
  priceToken1InToken0: Type.Number(),
});

export type PoolStats = Static<typeof PoolStatsSchema>;

export const TokenStatsSchema = Type.Object({
  contract: Type.String(),
  symbol: Type.String(),
  name: Type.String(),
  decimals: Type.Number(),
  priceUsd: Type.Number(),
  priceChange24h: Type.Number(),
  volume24h: Type.Number(),
  marketCap: Type.Optional(Type.Number()),
  totalSupply: Type.String(),
  holders: Type.Optional(Type.Number()),
});

export type TokenStats = Static<typeof TokenStatsSchema>;

// ============================================
// Chainhook Definition Types
// ============================================

export interface DeFiChainhookConfig {
  name: string;
  description: string;
  network: 'mainnet' | 'testnet';
  contracts: string[];
  functionNames?: string[];
  startBlockHeight?: number;
}

export interface WebhookPayload {
  chainhook: {
    uuid: string;
    predicate: {
      scope: string;
    };
  };
  apply: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    timestamp: number;
    transactions: Array<{
      transaction_identifier: {
        hash: string;
      };
      operations: any[];
      metadata: {
        success: boolean;
        sender: string;
        fee: number;
        kind: {
          type: string;
          data?: any;
        };
        receipt: {
          events: any[];
        };
      };
    }>;
  }>;
  rollback: any[];
}

// ============================================
// API Response Types
// ============================================

export const DashboardStatsSchema = Type.Object({
  totalValueLocked: Type.Number(),
  totalVolume24h: Type.Number(),
  totalTransactions24h: Type.Number(),
  activeWallets24h: Type.Number(),
  topPools: Type.Array(PoolStatsSchema),
  topTokens: Type.Array(TokenStatsSchema),
  recentSwaps: Type.Array(SwapEventSchema),
  recentAlerts: Type.Array(WhaleAlertSchema),
});

export type DashboardStats = Static<typeof DashboardStatsSchema>;

