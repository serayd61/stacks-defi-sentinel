// Wallet Service for DeFi Sentinel

import { CONTRACTS } from '../utils/constants';

interface WalletBalance {
  stx: bigint;
  tokens: Record<string, bigint>;
}

interface Transaction {
  txId: string;
  type: 'transfer' | 'contract_call' | 'stake' | 'unstake';
  status: 'pending' | 'success' | 'failed';
  amount?: bigint;
  timestamp: number;
}

class WalletService {
  private address: string | null = null;
  private balance: WalletBalance | null = null;
  private transactions: Transaction[] = [];

  setAddress(address: string) {
    this.address = address;
  }

  getAddress(): string | null {
    return this.address;
  }

  isConnected(): boolean {
    return this.address !== null;
  }

  async getBalance(): Promise<WalletBalance> {
    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    // Simulated balance fetch
    this.balance = {
      stx: BigInt(1000000000), // 1000 STX
      tokens: {
        SENTINEL: BigInt(50000000000),
        ALEX: BigInt(100000000),
      }
    };

    return this.balance;
  }

  async getStxBalance(): Promise<string> {
    const balance = await this.getBalance();
    return (Number(balance.stx) / 1_000_000).toFixed(6);
  }

  async getTokenBalance(tokenContract: string): Promise<string> {
    const balance = await this.getBalance();
    const tokenBalance = balance.tokens[tokenContract] || BigInt(0);
    return (Number(tokenBalance) / 1_000_000).toFixed(6);
  }

  async getTransactions(limit = 20): Promise<Transaction[]> {
    if (!this.address) {
      return [];
    }
    return this.transactions.slice(0, limit);
  }

  formatBalance(microAmount: bigint, decimals = 6): string {
    const amount = Number(microAmount) / Math.pow(10, decimals);
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });
  }

  shortenAddress(address: string = this.address || '', chars = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
  }

  disconnect() {
    this.address = null;
    this.balance = null;
    this.transactions = [];
  }
}

export const walletService = new WalletService();
export default walletService;
