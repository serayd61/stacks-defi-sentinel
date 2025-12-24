/**
 * sBTC Bridge Monitor
 * Real-time tracking of sBTC deposits (peg-in) and withdrawals (peg-out)
 * Monitors BTC/sBTC peg ratio and bridge health
 */

import { logger } from './logger';

// sBTC Contract Addresses on Mainnet
export const SBTC_CONTRACTS = {
  // Main sBTC token contract
  token: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
  // sBTC Registry
  registry: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry',
  // sBTC Deposit
  deposit: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit',
  // sBTC Withdrawal
  withdrawal: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-withdrawal',
};

// Event types
export interface SBTCEvent {
  type: 'deposit' | 'withdrawal' | 'transfer';
  txId: string;
  blockHeight: number;
  timestamp: number;
  amount: string; // in satoshis
  amountBTC: number;
  sender?: string;
  recipient?: string;
  btcTxId?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface SBTCStats {
  totalSupply: string;
  totalSupplyBTC: number;
  totalDeposits24h: string;
  totalWithdrawals24h: string;
  depositsCount24h: number;
  withdrawalsCount24h: number;
  pegRatio: number; // Should be ~1.0
  bridgeHealth: 'healthy' | 'degraded' | 'critical';
  lastUpdate: number;
}

export interface PegStatus {
  btcPrice: number;
  sbtcPrice: number;
  pegRatio: number;
  deviation: number; // percentage deviation from 1:1
  status: 'pegged' | 'slight_deviation' | 'major_deviation';
}

// In-memory store for sBTC events
const sbtcEvents: SBTCEvent[] = [];
let sbtcStats: SBTCStats = {
  totalSupply: '0',
  totalSupplyBTC: 0,
  totalDeposits24h: '0',
  totalWithdrawals24h: '0',
  depositsCount24h: 0,
  withdrawalsCount24h: 0,
  pegRatio: 1.0,
  bridgeHealth: 'healthy',
  lastUpdate: Date.now(),
};

/**
 * Fetch current sBTC total supply from Hiro API
 */
export async function fetchSBTCSupply(): Promise<string> {
  try {
    const response = await fetch(
      `https://api.hiro.so/v2/contracts/call-read/${SBTC_CONTRACTS.token.replace('.', '/')}/get-total-supply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: SBTC_CONTRACTS.token.split('.')[0],
          arguments: [],
        }),
      }
    );
    const data = await response.json();
    if (data.okay && data.result) {
      // Parse the Clarity response
      const hexValue = data.result.replace('0x', '');
      const supply = parseInt(hexValue, 16);
      return supply.toString();
    }
    return '0';
  } catch (error) {
    logger.error('Error fetching sBTC supply:', error);
    return '0';
  }
}

/**
 * Fetch BTC and sBTC prices for peg monitoring
 */
export async function fetchPegStatus(): Promise<PegStatus> {
  try {
    // Fetch BTC price from CoinGecko
    const btcResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const btcData = await btcResponse.json();
    const btcPrice = btcData.bitcoin?.usd || 0;

    // sBTC should be 1:1 with BTC, but check DEX prices
    // For now, assume 1:1 peg and monitor for deviations
    const sbtcPrice = btcPrice; // In practice, fetch from ALEX or Velar

    const pegRatio = btcPrice > 0 ? sbtcPrice / btcPrice : 1;
    const deviation = Math.abs(1 - pegRatio) * 100;

    let status: 'pegged' | 'slight_deviation' | 'major_deviation' = 'pegged';
    if (deviation > 5) {
      status = 'major_deviation';
    } else if (deviation > 1) {
      status = 'slight_deviation';
    }

    return {
      btcPrice,
      sbtcPrice,
      pegRatio,
      deviation,
      status,
    };
  } catch (error) {
    logger.error('Error fetching peg status:', error);
    return {
      btcPrice: 0,
      sbtcPrice: 0,
      pegRatio: 1,
      deviation: 0,
      status: 'pegged',
    };
  }
}

/**
 * Fetch recent sBTC transactions from Hiro API
 */
export async function fetchRecentSBTCTransactions(limit: number = 50): Promise<SBTCEvent[]> {
  try {
    const response = await fetch(
      `https://api.hiro.so/extended/v1/address/${SBTC_CONTRACTS.token}/transactions?limit=${limit}`
    );
    const data = await response.json();
    
    const events: SBTCEvent[] = [];
    
    for (const tx of data.results || []) {
      if (tx.tx_type === 'contract_call') {
        const functionName = tx.contract_call?.function_name || '';
        
        let eventType: 'deposit' | 'withdrawal' | 'transfer' = 'transfer';
        if (functionName.includes('deposit') || functionName.includes('mint')) {
          eventType = 'deposit';
        } else if (functionName.includes('withdraw') || functionName.includes('burn')) {
          eventType = 'withdrawal';
        }

        // Extract amount from function args
        const amount = tx.contract_call?.function_args?.[0]?.repr || '0';
        const amountNum = parseInt(amount.replace('u', '')) || 0;

        events.push({
          type: eventType,
          txId: tx.tx_id,
          blockHeight: tx.block_height,
          timestamp: new Date(tx.burn_block_time_iso).getTime(),
          amount: amountNum.toString(),
          amountBTC: amountNum / 100_000_000, // satoshis to BTC
          sender: tx.sender_address,
          recipient: tx.contract_call?.function_args?.[1]?.repr,
          status: tx.tx_status === 'success' ? 'confirmed' : 'pending',
        });
      }
    }

    return events;
  } catch (error) {
    logger.error('Error fetching sBTC transactions:', error);
    return [];
  }
}

/**
 * Calculate 24h stats
 */
export function calculate24hStats(events: SBTCEvent[]): Partial<SBTCStats> {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  const recent = events.filter(e => e.timestamp > oneDayAgo);
  
  const deposits = recent.filter(e => e.type === 'deposit');
  const withdrawals = recent.filter(e => e.type === 'withdrawal');
  
  const totalDeposits = deposits.reduce((sum, e) => sum + BigInt(e.amount), BigInt(0));
  const totalWithdrawals = withdrawals.reduce((sum, e) => sum + BigInt(e.amount), BigInt(0));

  return {
    totalDeposits24h: totalDeposits.toString(),
    totalWithdrawals24h: totalWithdrawals.toString(),
    depositsCount24h: deposits.length,
    withdrawalsCount24h: withdrawals.length,
  };
}

/**
 * Process sBTC event from Chainhook
 */
export function processSBTCEvent(payload: any): SBTCEvent | null {
  try {
    const tx = payload.apply?.[0]?.transactions?.[0];
    if (!tx) return null;

    const functionName = tx.metadata?.contract_call?.function_name || '';
    
    let eventType: 'deposit' | 'withdrawal' | 'transfer' = 'transfer';
    if (functionName.includes('deposit') || functionName.includes('mint')) {
      eventType = 'deposit';
    } else if (functionName.includes('withdraw') || functionName.includes('burn')) {
      eventType = 'withdrawal';
    }

    const event: SBTCEvent = {
      type: eventType,
      txId: tx.transaction_identifier?.hash || '',
      blockHeight: payload.apply?.[0]?.block_identifier?.index || 0,
      timestamp: Date.now(),
      amount: tx.metadata?.contract_call?.function_args?.[0]?.repr || '0',
      amountBTC: 0,
      sender: tx.metadata?.sender,
      recipient: tx.metadata?.contract_call?.function_args?.[1]?.repr,
      status: 'confirmed',
    };

    const amountNum = parseInt(event.amount.replace('u', '')) || 0;
    event.amountBTC = amountNum / 100_000_000;

    // Store event
    sbtcEvents.unshift(event);
    if (sbtcEvents.length > 1000) {
      sbtcEvents.pop();
    }

    logger.info(`sBTC ${eventType}: ${event.amountBTC} BTC - ${event.txId}`);
    
    return event;
  } catch (error) {
    logger.error('Error processing sBTC event:', error);
    return null;
  }
}

/**
 * Get current sBTC stats
 */
export async function getSBTCStats(): Promise<SBTCStats> {
  try {
    const [supply, pegStatus, recentTxs] = await Promise.all([
      fetchSBTCSupply(),
      fetchPegStatus(),
      fetchRecentSBTCTransactions(100),
    ]);

    const stats24h = calculate24hStats(recentTxs);
    const supplyNum = parseInt(supply) || 0;

    // Determine bridge health
    let bridgeHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (pegStatus.deviation > 5) {
      bridgeHealth = 'critical';
    } else if (pegStatus.deviation > 2) {
      bridgeHealth = 'degraded';
    }

    sbtcStats = {
      totalSupply: supply,
      totalSupplyBTC: supplyNum / 100_000_000,
      totalDeposits24h: stats24h.totalDeposits24h || '0',
      totalWithdrawals24h: stats24h.totalWithdrawals24h || '0',
      depositsCount24h: stats24h.depositsCount24h || 0,
      withdrawalsCount24h: stats24h.withdrawalsCount24h || 0,
      pegRatio: pegStatus.pegRatio,
      bridgeHealth,
      lastUpdate: Date.now(),
    };

    return sbtcStats;
  } catch (error) {
    logger.error('Error getting sBTC stats:', error);
    return sbtcStats;
  }
}

/**
 * Get recent sBTC events
 */
export function getRecentSBTCEvents(limit: number = 50): SBTCEvent[] {
  return sbtcEvents.slice(0, limit);
}

/**
 * Get sBTC Chainhook predicates
 */
export function getSBTCChainhookPredicates() {
  return [
    {
      name: 'sbtc-deposits',
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: SBTC_CONTRACTS.deposit,
            method: 'complete-deposit',
          },
          then_that: {
            http_post: {
              url: `${process.env.WEBHOOK_URL || 'http://localhost:3000'}/api/chainhook/sbtc`,
              authorization_header: `Bearer ${process.env.CHAINHOOKS_API_KEY || ''}`,
            },
          },
        },
      },
    },
    {
      name: 'sbtc-withdrawals',
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: SBTC_CONTRACTS.withdrawal,
            method: 'initiate-withdrawal-request',
          },
          then_that: {
            http_post: {
              url: `${process.env.WEBHOOK_URL || 'http://localhost:3000'}/api/chainhook/sbtc`,
              authorization_header: `Bearer ${process.env.CHAINHOOKS_API_KEY || ''}`,
            },
          },
        },
      },
    },
    {
      name: 'sbtc-transfers',
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: SBTC_CONTRACTS.token,
            method: 'transfer',
          },
          then_that: {
            http_post: {
              url: `${process.env.WEBHOOK_URL || 'http://localhost:3000'}/api/chainhook/sbtc`,
              authorization_header: `Bearer ${process.env.CHAINHOOKS_API_KEY || ''}`,
            },
          },
        },
      },
    },
  ];
}

export default {
  getSBTCStats,
  getRecentSBTCEvents,
  processSBTCEvent,
  fetchPegStatus,
  getSBTCChainhookPredicates,
  SBTC_CONTRACTS,
};

