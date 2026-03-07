// Chainhooks Service for DeFi Sentinel
// Real-time blockchain event monitoring using Hiro Chainhooks

export interface ChainhookPredicate {
  uuid: string;
  name: string;
  version: number;
  chain: 'stacks';
  networks: {
    mainnet: {
      if_this: ChainhookCondition;
      then_that: ChainhookAction;
    };
  };
}

export interface ChainhookCondition {
  scope: 'contract_call' | 'stx_event' | 'ft_event' | 'nft_event' | 'block';
  contract_identifier?: string;
  method?: string;
  actions?: string[];
}

export interface ChainhookAction {
  http_post: {
    url: string;
    authorization_header?: string;
  };
}

export interface ChainhookEvent {
  apply: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    transactions: Array<{
      transaction_identifier: {
        hash: string;
      };
      metadata: {
        success: boolean;
        sender: string;
        fee: number;
      };
      operations: Array<{
        type: string;
        account: { address: string };
        amount?: { value: string; currency: { symbol: string } };
      }>;
    }>;
  }>;
}

class ChainhooksService {
  private predicates: Map<string, ChainhookPredicate> = new Map();
  private eventHandlers: Map<string, ((event: any) => void)[]> = new Map();

  // Create a chainhook predicate for contract calls
  createContractCallPredicate(
    name: string,
    contractId: string,
    method: string,
    webhookUrl: string
  ): ChainhookPredicate {
    const predicate: ChainhookPredicate = {
      uuid: crypto.randomUUID(),
      name,
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'contract_call',
            contract_identifier: contractId,
            method,
          },
          then_that: {
            http_post: {
              url: webhookUrl,
            },
          },
        },
      },
    };

    this.predicates.set(predicate.uuid, predicate);
    return predicate;
  }

  // Create a chainhook for STX transfers
  createSTXTransferPredicate(
    name: string,
    webhookUrl: string,
    actions: string[] = ['transfer']
  ): ChainhookPredicate {
    const predicate: ChainhookPredicate = {
      uuid: crypto.randomUUID(),
      name,
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'stx_event',
            actions,
          },
          then_that: {
            http_post: {
              url: webhookUrl,
            },
          },
        },
      },
    };

    this.predicates.set(predicate.uuid, predicate);
    return predicate;
  }

  // Create a chainhook for token transfers (FT)
  createFTTransferPredicate(
    name: string,
    contractId: string,
    webhookUrl: string
  ): ChainhookPredicate {
    const predicate: ChainhookPredicate = {
      uuid: crypto.randomUUID(),
      name,
      version: 1,
      chain: 'stacks',
      networks: {
        mainnet: {
          if_this: {
            scope: 'ft_event',
            contract_identifier: contractId,
            actions: ['transfer', 'mint', 'burn'],
          },
          then_that: {
            http_post: {
              url: webhookUrl,
            },
          },
        },
      },
    };

    this.predicates.set(predicate.uuid, predicate);
    return predicate;
  }

  // Register event handler
  onEvent(predicateId: string, handler: (event: any) => void): () => void {
    if (!this.eventHandlers.has(predicateId)) {
      this.eventHandlers.set(predicateId, []);
    }
    this.eventHandlers.get(predicateId)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(predicateId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  // Process incoming chainhook event
  processEvent(predicateId: string, event: ChainhookEvent): void {
    const handlers = this.eventHandlers.get(predicateId) || [];
    handlers.forEach(handler => handler(event));
  }

  // Get all registered predicates
  getPredicates(): ChainhookPredicate[] {
    return Array.from(this.predicates.values());
  }

  // Export predicate as JSON (for Chainhooks API)
  exportPredicate(predicateId: string): string | null {
    const predicate = this.predicates.get(predicateId);
    return predicate ? JSON.stringify(predicate, null, 2) : null;
  }

  // DeFi Sentinel specific predicates
  setupDeFiSentinelPredicates(webhookBaseUrl: string): void {
    const CONTRACT_OWNER = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';

    // Token transfers
    this.createFTTransferPredicate(
      'SENTINEL Token Transfers',
      `${CONTRACT_OWNER}.sentinel-token`,
      `${webhookBaseUrl}/webhooks/token-transfers`
    );

    // Staking events
    this.createContractCallPredicate(
      'Staking Deposits',
      `${CONTRACT_OWNER}.sentinel-staking-v2`,
      'stake',
      `${webhookBaseUrl}/webhooks/staking`
    );

    // Lending events
    this.createContractCallPredicate(
      'Lending Deposits',
      `${CONTRACT_OWNER}.sentinel-lending`,
      'deposit',
      `${webhookBaseUrl}/webhooks/lending`
    );

    // Whale alerts (large STX transfers)
    this.createSTXTransferPredicate(
      'Whale Alerts',
      `${webhookBaseUrl}/webhooks/whale-alerts`
    );

    console.log('[Chainhooks] DeFi Sentinel predicates configured');
  }
}

export const chainhooksService = new ChainhooksService();
export default chainhooksService;

