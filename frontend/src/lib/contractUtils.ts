/**
 * Contract Utilities
 * Helper functions for interacting with Stacks smart contracts
 */

import {
  fetchCallReadOnlyFunction,
  cvToValue,
  uintCV,
  principalCV,
  stringUtf8CV,
  bufferCV,
  ClarityValue
} from '@stacks/transactions';

// Contract addresses
export const CONTRACT_ADDRESSES = {
  VOTING_DAO: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.voting-dao',
  CROWDFUND: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.crowdfund',
  TIP_JAR: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.tip-jar',
  NFT_MARKETPLACE: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-marketplace',
  STAKING_REWARDS: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.staking-rewards',
  TOKEN_VESTING: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-vesting',
  AIRDROP: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.airdrop',
  TREASURY: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.treasury',
  MULTI_SIG: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.multi-sig-wallet',
  TOKEN_SWAP: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-swap',
  NFT_STAKING: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-staking',
  FLASH_LOAN: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.flash-loan',
  YIELD_FARM: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.yield-farm',
  REFERRAL: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.referral',
  TOKEN_BURN: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-burn',
  WHITELIST: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.whitelist',
  REPUTATION: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.reputation',
  ACHIEVEMENT_BADGE: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.achievement-badge',
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  mainnet: {
    url: 'https://api.mainnet.hiro.so',
    explorer: 'https://explorer.hiro.so',
  },
  testnet: {
    url: 'https://api.testnet.hiro.so',
    explorer: 'https://explorer.hiro.so/?chain=testnet',
  }
};

/**
 * Parse contract identifier into address and name
 */
export function parseContractId(contractId: string): { address: string; name: string } {
  const [address, name] = contractId.split('.');
  return { address, name };
}

/**
 * Call a read-only function on a contract
 */
export async function readContract<T = any>(
  contractId: string,
  functionName: string,
  args: ClarityValue[] = [],
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<T> {
  const { address, name } = parseContractId(contractId);
  
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs: args,
      network: network,
      senderAddress: address,
    });
    
    return cvToValue(result) as T;
  } catch (error) {
    console.error(`Error calling ${contractId}.${functionName}:`, error);
    throw error;
  }
}

/**
 * Format STX amount from microSTX
 */
export function formatSTX(microSTX: number | string): string {
  const amount = typeof microSTX === 'string' ? parseInt(microSTX) : microSTX;
  return (amount / 1_000_000).toFixed(6);
}

/**
 * Convert STX to microSTX
 */
export function toMicroSTX(stx: number): number {
  return Math.floor(stx * 1_000_000);
}

/**
 * Format address for display
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Get contract explorer URL
 */
export function getContractExplorerUrl(
  contractId: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): string {
  const baseUrl = NETWORK_CONFIG[network].explorer;
  return `${baseUrl}/txid/${contractId}?chain=${network}`;
}

/**
 * Get transaction explorer URL
 */
export function getTxExplorerUrl(
  txId: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): string {
  const baseUrl = NETWORK_CONFIG[network].explorer;
  return `${baseUrl}/txid/${txId}?chain=${network}`;
}

/**
 * Voting DAO helpers
 */
export const VotingDAO = {
  async getProposal(proposalId: number) {
    return readContract(CONTRACT_ADDRESSES.VOTING_DAO, 'get-proposal', [uintCV(proposalId)]);
  },
  
  async getUserVote(proposalId: number, voter: string) {
    return readContract(CONTRACT_ADDRESSES.VOTING_DAO, 'get-user-vote', [
      uintCV(proposalId),
      principalCV(voter)
    ]);
  },
  
  async getProposalCount() {
    return readContract(CONTRACT_ADDRESSES.VOTING_DAO, 'get-proposal-count', []);
  }
};

/**
 * Flash Loan helpers
 */
export const FlashLoan = {
  async getAvailableLiquidity() {
    return readContract(CONTRACT_ADDRESSES.FLASH_LOAN, 'get-available-liquidity', []);
  },
  
  async getFlashFee() {
    return readContract(CONTRACT_ADDRESSES.FLASH_LOAN, 'get-flash-fee', []);
  },
  
  async calculateFee(amount: number) {
    const fee = await this.getFlashFee();
    return (amount * fee) / 10000;
  }
};

/**
 * Yield Farm helpers
 */
export const YieldFarm = {
  async getTotalStaked() {
    return readContract(CONTRACT_ADDRESSES.YIELD_FARM, 'get-total-staked', []);
  },
  
  async getUserInfo(user: string) {
    return readContract(CONTRACT_ADDRESSES.YIELD_FARM, 'get-user-info', [principalCV(user)]);
  },
  
  async getPendingReward(user: string) {
    return readContract(CONTRACT_ADDRESSES.YIELD_FARM, 'pending-reward', [principalCV(user)]);
  },
  
  async getFarmInfo() {
    return readContract(CONTRACT_ADDRESSES.YIELD_FARM, 'get-farm-info', []);
  }
};

/**
 * Multi-Sig Wallet helpers
 */
export const MultiSig = {
  async getTransaction(txId: number) {
    return readContract(CONTRACT_ADDRESSES.MULTI_SIG, 'get-transaction', [uintCV(txId)]);
  },
  
  async isSigner(address: string) {
    return readContract(CONTRACT_ADDRESSES.MULTI_SIG, 'is-signer', [principalCV(address)]);
  },
  
  async getRequiredSignatures() {
    return readContract(CONTRACT_ADDRESSES.MULTI_SIG, 'get-required-signatures', []);
  },
  
  async getBalance() {
    return readContract(CONTRACT_ADDRESSES.MULTI_SIG, 'get-balance', []);
  }
};

/**
 * Token Swap (AMM) helpers
 */
export const TokenSwap = {
  async getReserves() {
    return readContract(CONTRACT_ADDRESSES.TOKEN_SWAP, 'get-reserves', []);
  },
  
  async getSwapQuote(inputAmount: number, inputReserve: number, outputReserve: number) {
    return readContract(CONTRACT_ADDRESSES.TOKEN_SWAP, 'get-swap-output', [
      uintCV(inputAmount),
      uintCV(inputReserve),
      uintCV(outputReserve)
    ]);
  },
  
  async getLPBalance(address: string) {
    return readContract(CONTRACT_ADDRESSES.TOKEN_SWAP, 'get-lp-balance', [principalCV(address)]);
  }
};

export default {
  CONTRACT_ADDRESSES,
  NETWORK_CONFIG,
  parseContractId,
  readContract,
  formatSTX,
  toMicroSTX,
  formatAddress,
  getContractExplorerUrl,
  getTxExplorerUrl,
  VotingDAO,
  FlashLoan,
  YieldFarm,
  MultiSig,
  TokenSwap,
};

