// Contract Types for DeFi Sentinel

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

export interface StakeInfo {
  amount: bigint;
  startBlock: number;
  rewards: bigint;
}

export interface LendingPosition {
  deposited: bigint;
  borrowed: bigint;
  collateralRatio: number;
}

export interface OraclePrice {
  asset: string;
  price: bigint;
  timestamp: number;
  reporter: string;
}

export interface ProposalInfo {
  id: number;
  title: string;
  votesFor: bigint;
  votesAgainst: bigint;
  status: 'active' | 'passed' | 'rejected' | 'executed';
}

export type ContractCallResult<T> = {
  success: true;
  value: T;
} | {
  success: false;
  error: string;
};
