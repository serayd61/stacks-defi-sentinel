// API Types for DeFi Sentinel

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: number;
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
