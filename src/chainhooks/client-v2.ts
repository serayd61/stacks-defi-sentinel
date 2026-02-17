import { logger } from '../utils/logger';

/**
 * Chainhooks V2 API Client
 * Updated for Chainhooks V2 migration (deadline: March 9th, 2026)
 * 
 * Key differences from V1:
 * - New endpoint: https://api.hiro.so/chainhooks/v1/me/
 * - Filters use 'events' array with 'type' field
 * - No more 'if_this/then_that' structure
 * - Secrets managed automatically via rotateConsumerSecret()
 */

const CHAINHOOKS_V2_API = 'https://api.hiro.so/chainhooks/v1/me';
const PLATFORM_API = 'https://api.platform.hiro.so/v1/ext';

// V2 Event Types
export type ChainhookEventType = 
  | 'stx_transfer'
  | 'ft_transfer'
  | 'ft_mint'
  | 'ft_burn'
  | 'nft_transfer'
  | 'nft_mint'
  | 'nft_burn'
  | 'contract_call'
  | 'contract_deployment'
  | 'print_event';

export interface ChainhookV2Event {
  type: ChainhookEventType;
  contract_identifier?: string;
  function_name?: string;
  asset_identifier?: string;
  sender?: string;
  recipient?: string;
}

export interface ChainhookV2Definition {
  version: '1';
  name: string;
  chain: 'stacks' | 'bitcoin';
  network: 'mainnet' | 'testnet';
  filters: {
    events: ChainhookV2Event[];
  };
  action: {
    type: 'http_post';
    url: string;
  };
  options?: {
    decode_clarity_values?: boolean;
    enable_on_registration?: boolean;
  };
}

export interface ChainhookV2Response {
  uuid: string;
  name: string;
  status: {
    enabled: boolean;
  };
  created_at: string;
}

export interface ChainhookV2Status {
  uuid: string;
  name: string;
  status: {
    enabled: boolean;
    last_triggered?: string;
    trigger_count?: number;
  };
}

/**
 * Chainhooks V2 Manager
 * Handles all V2 chainhook operations
 */
export class ChainhooksV2Manager {
  private apiKey: string;
  private webhookBaseUrl: string;
  private network: 'mainnet' | 'testnet';
  private registeredHooks: Map<string, ChainhookV2Response> = new Map();

  constructor(config: {
    apiKey: string;
    webhookBaseUrl: string;
    network?: 'mainnet' | 'testnet';
  }) {
    this.apiKey = config.apiKey;
    this.webhookBaseUrl = config.webhookBaseUrl;
    this.network = config.network || 'mainnet';

    logger.info(`Chainhooks V2 Manager initialized for ${this.network}`);
  }

  /**
   * Register a new V2 chainhook
   */
  async registerChainhook(definition: ChainhookV2Definition): Promise<ChainhookV2Response> {
    try {
      const response = await fetch(CHAINHOOKS_V2_API, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(definition),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to register chainhook: ${response.status} - ${error}`);
      }

      const hook = await response.json() as ChainhookV2Response;
      this.registeredHooks.set(hook.uuid, hook);
      logger.info(`Registered V2 chainhook: ${hook.name} (${hook.uuid})`);
      
      return hook;
    } catch (error) {
      logger.error('Failed to register V2 chainhook', error);
      throw error;
    }
  }

  /**
   * Get a specific chainhook by UUID
   */
  async getChainhook(uuid: string): Promise<ChainhookV2Status> {
    try {
      const response = await fetch(`${CHAINHOOKS_V2_API}/${uuid}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get chainhook: ${response.status}`);
      }

      return await response.json() as ChainhookV2Status;
    } catch (error) {
      logger.error(`Failed to get chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * List all V2 chainhooks
   */
  async listChainhooks(): Promise<ChainhookV2Status[]> {
    try {
      const response = await fetch(CHAINHOOKS_V2_API, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list chainhooks: ${response.status}`);
      }

      const data = await response.json();
      return data.results || data;
    } catch (error) {
      logger.error('Failed to list V2 chainhooks', error);
      throw error;
    }
  }

  /**
   * Enable or disable a chainhook
   */
  async toggleChainhook(uuid: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`${CHAINHOOKS_V2_API}/${uuid}`, {
        method: 'PATCH',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle chainhook: ${response.status}`);
      }

      logger.info(`Chainhook ${uuid} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error(`Failed to toggle chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Delete a V2 chainhook
   */
  async deleteChainhook(uuid: string): Promise<void> {
    try {
      const response = await fetch(`${CHAINHOOKS_V2_API}/${uuid}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete chainhook: ${response.status}`);
      }

      this.registeredHooks.delete(uuid);
      logger.info(`Deleted V2 chainhook: ${uuid}`);
    } catch (error) {
      logger.error(`Failed to delete chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Rotate webhook consumer secret
   */
  async rotateConsumerSecret(uuid: string): Promise<string> {
    try {
      const response = await fetch(`${CHAINHOOKS_V2_API}/${uuid}/rotate-secret`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to rotate secret: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`Rotated consumer secret for chainhook: ${uuid}`);
      return data.secret;
    } catch (error) {
      logger.error(`Failed to rotate secret for ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Replay a specific block through the chainhook
   */
  async replayBlock(uuid: string, blockHeight: number): Promise<void> {
    try {
      const response = await fetch(`${CHAINHOOKS_V2_API}/${uuid}/replay`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ block_height: blockHeight }),
      });

      if (!response.ok) {
        throw new Error(`Failed to replay block: ${response.status}`);
      }

      logger.info(`Requested block ${blockHeight} replay for chainhook: ${uuid}`);
    } catch (error) {
      logger.error(`Failed to replay block for ${uuid}`, error);
      throw error;
    }
  }

  // ============================================
  // Helper methods for creating common hooks
  // ============================================

  /**
   * Create STX transfer monitoring hook
   */
  async registerStxTransferHook(name: string): Promise<ChainhookV2Response> {
    const definition: ChainhookV2Definition = {
      version: '1',
      name,
      chain: 'stacks',
      network: this.network,
      filters: {
        events: [{ type: 'stx_transfer' }],
      },
      action: {
        type: 'http_post',
        url: `${this.webhookBaseUrl}/webhooks/stx-transfers`,
      },
      options: {
        decode_clarity_values: true,
        enable_on_registration: true,
      },
    };

    return this.registerChainhook(definition);
  }

  /**
   * Create contract call monitoring hook
   */
  async registerContractCallHook(
    name: string,
    contractIdentifier: string,
    functionNames: string[]
  ): Promise<ChainhookV2Response> {
    const events: ChainhookV2Event[] = functionNames.map(fn => ({
      type: 'contract_call',
      contract_identifier: contractIdentifier,
      function_name: fn,
    }));

    const definition: ChainhookV2Definition = {
      version: '1',
      name,
      chain: 'stacks',
      network: this.network,
      filters: { events },
      action: {
        type: 'http_post',
        url: `${this.webhookBaseUrl}/webhooks/contract-calls`,
      },
      options: {
        decode_clarity_values: true,
        enable_on_registration: true,
      },
    };

    return this.registerChainhook(definition);
  }

  /**
   * Create FT transfer monitoring hook
   */
  async registerFtTransferHook(
    name: string,
    assetIdentifiers: string[]
  ): Promise<ChainhookV2Response> {
    const events: ChainhookV2Event[] = assetIdentifiers.map(asset => ({
      type: 'ft_transfer',
      asset_identifier: asset,
    }));

    const definition: ChainhookV2Definition = {
      version: '1',
      name,
      chain: 'stacks',
      network: this.network,
      filters: { events },
      action: {
        type: 'http_post',
        url: `${this.webhookBaseUrl}/webhooks/ft-transfers`,
      },
      options: {
        decode_clarity_values: true,
        enable_on_registration: true,
      },
    };

    return this.registerChainhook(definition);
  }

  /**
   * Create NFT event monitoring hook
   */
  async registerNftEventHook(name: string): Promise<ChainhookV2Response> {
    const definition: ChainhookV2Definition = {
      version: '1',
      name,
      chain: 'stacks',
      network: this.network,
      filters: {
        events: [
          { type: 'nft_transfer' },
          { type: 'nft_mint' },
        ],
      },
      action: {
        type: 'http_post',
        url: `${this.webhookBaseUrl}/webhooks/nft-events`,
      },
      options: {
        decode_clarity_values: true,
        enable_on_registration: true,
      },
    };

    return this.registerChainhook(definition);
  }

  /**
   * Get registered hooks map
   */
  getRegisteredHooks(): Map<string, ChainhookV2Response> {
    return this.registeredHooks;
  }
}

// ============================================
// V1 to V2 Migration Helpers
// ============================================

export interface V1Chainhook {
  uuid: string;
  name: string;
  version: number;
  chain: string;
  networks: {
    mainnet?: {
      if_this: {
        scope: string;
        contract_identifier?: string;
        method?: string;
        actions?: string[];
        asset_identifier?: string;
      };
      then_that: {
        http_post: {
          url: string;
          authorization_header?: string;
        };
      };
    };
    testnet?: any;
  };
}

/**
 * Convert V1 chainhook to V2 format
 */
export function convertV1ToV2(v1Hook: V1Chainhook, network: 'mainnet' | 'testnet' = 'mainnet'): ChainhookV2Definition {
  const networkConfig = v1Hook.networks[network];
  if (!networkConfig) {
    throw new Error(`No ${network} configuration found in V1 hook`);
  }

  const { if_this, then_that } = networkConfig;
  const events: ChainhookV2Event[] = [];

  // Map V1 scope to V2 event type
  switch (if_this.scope) {
    case 'stx_event':
      if (if_this.actions?.includes('transfer')) {
        events.push({ type: 'stx_transfer' });
      }
      break;

    case 'contract_call':
      events.push({
        type: 'contract_call',
        contract_identifier: if_this.contract_identifier,
        function_name: if_this.method,
      });
      break;

    case 'ft_event':
      if (if_this.actions?.includes('transfer')) {
        events.push({
          type: 'ft_transfer',
          asset_identifier: if_this.asset_identifier,
        });
      }
      if (if_this.actions?.includes('mint')) {
        events.push({
          type: 'ft_mint',
          asset_identifier: if_this.asset_identifier,
        });
      }
      if (if_this.actions?.includes('burn')) {
        events.push({
          type: 'ft_burn',
          asset_identifier: if_this.asset_identifier,
        });
      }
      break;

    case 'nft_event':
      if (if_this.actions?.includes('transfer')) {
        events.push({
          type: 'nft_transfer',
          asset_identifier: if_this.asset_identifier,
        });
      }
      if (if_this.actions?.includes('mint')) {
        events.push({
          type: 'nft_mint',
          asset_identifier: if_this.asset_identifier,
        });
      }
      break;

    default:
      logger.warn(`Unknown V1 scope: ${if_this.scope}`);
  }

  return {
    version: '1',
    name: v1Hook.name,
    chain: 'stacks',
    network,
    filters: { events },
    action: {
      type: 'http_post',
      url: then_that.http_post.url,
    },
    options: {
      decode_clarity_values: true,
      enable_on_registration: true,
    },
  };
}

/**
 * Fetch all V1 chainhooks from Platform API
 */
export async function fetchV1Chainhooks(apiKey: string): Promise<V1Chainhook[]> {
  try {
    const response = await fetch(`${PLATFORM_API}/${apiKey}/chainhooks`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch V1 chainhooks: ${response.status}`);
    }

    const data = await response.json();
    return data.results || data;
  } catch (error) {
    logger.error('Failed to fetch V1 chainhooks', error);
    throw error;
  }
}

/**
 * Delete a V1 chainhook
 */
export async function deleteV1Chainhook(apiKey: string, uuid: string): Promise<void> {
  try {
    const response = await fetch(`${PLATFORM_API}/${apiKey}/chainhooks/${uuid}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete V1 chainhook: ${response.status}`);
    }

    logger.info(`Deleted V1 chainhook: ${uuid}`);
  } catch (error) {
    logger.error(`Failed to delete V1 chainhook ${uuid}`, error);
    throw error;
  }
}
