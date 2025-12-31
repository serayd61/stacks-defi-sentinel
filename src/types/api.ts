// API Types for DeFi Sentinel

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: number;
}

// Event Types
export interface SwapEvent {
  txId: string;
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  sender: string;
  timestamp: string;
  blockHeight: number;
}

export interface LiquidityEvent {
  txId: string;
  pool: string;
  type: 'add' | 'remove';
  token0Amount: number;
  token1Amount: number;
  lpTokens: number;
  sender: string;
  timestamp: string;
  blockHeight: number;
}

export interface TokenTransfer {
  txId: string;
  token: string;
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  blockHeight: number;
}

export interface WhaleAlert {
  id: string;
  type: 'large_transfer' | 'large_swap' | 'large_liquidity';
  token: string;
  amount: number;
  from?: string;
  to?: string;
  txId: string;
  timestamp: string;
}

// Stats Types
export interface PoolStats {
  name: string;
  tvl: number;
  volume24h: number;
  apr: number;
  token0: string;
  token1: string;
}

export interface TokenStats {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface DashboardStats {
  totalValueLocked: number;
  totalVolume24h: number;
  totalTransactions24h: number;
  activeWallets24h: number;
  topPools: PoolStats[];
  recentSwaps: SwapEvent[];
  recentAlerts: WhaleAlert[];
}

// Webhook Types
export interface WebhookPayload {
  apply: WebhookApply[];
  chainhook: {
    uuid: string;
    predicate: any;
  };
}

export interface WebhookApply {
  block_identifier: {
    index: number;
    hash: string;
  };
  transactions: WebhookTransaction[];
}

export interface WebhookTransaction {
  transaction_identifier: {
    hash: string;
  };
  metadata: {
    success: boolean;
    sender: string;
    fee: number;
    kind: any;
    receipt: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TransactionRequest {
  contractAddress: string;
  functionName: string;
  functionArgs: any[];
  postConditions?: any[];
}

export interface WalletInfo {
  address: string;
  balance: bigint;
  nonce: number;
}

export interface NetworkConfig {
  chainId: number;
  networkUrl: string;
  explorerUrl: string;
}
