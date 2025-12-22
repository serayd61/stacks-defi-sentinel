import {
  ChainhooksClient,
  ChainhookDefinition,
  CHAINHOOKS_BASE_URL,
  Chainhook,
} from '@hirosystems/chainhooks-client';
import { logger } from '../utils/logger';

/**
 * DeFi Chainhooks Manager
 * Manages all chainhook registrations for DeFi monitoring
 */
export class DeFiChainhooksManager {
  private client: ChainhooksClient;
  private registeredHooks: Map<string, Chainhook> = new Map();
  private webhookBaseUrl: string;
  private network: 'mainnet' | 'testnet';

  constructor(config: {
    apiKey: string;
    network?: 'mainnet' | 'testnet';
    webhookBaseUrl: string;
  }) {
    this.network = config.network || 'mainnet';
    this.webhookBaseUrl = config.webhookBaseUrl;

    this.client = new ChainhooksClient({
      baseUrl:
        this.network === 'mainnet'
          ? CHAINHOOKS_BASE_URL.mainnet
          : CHAINHOOKS_BASE_URL.testnet,
      apiKey: config.apiKey,
    });

    logger.info(`DeFi Chainhooks Manager initialized for ${this.network}`);
  }

  /**
   * Check API status
   */
  async checkStatus() {
    try {
      const status = await this.client.getStatus();
      logger.info(`Chainhooks API Status: ${status.status}`);
      return status;
    } catch (error) {
      logger.error('Failed to get Chainhooks API status', error);
      throw error;
    }
  }

  /**
   * Register a DEX swap monitoring chainhook
   */
  async registerDexSwapHook(dexContracts: string[]): Promise<Chainhook> {
    const definition: ChainhookDefinition = {
      name: 'DeFi Monitor - DEX Swaps',
      chain: 'stacks',
      network: this.network,
      version: 1,
      // Filter for contract calls to DEX contracts
      predicate: {
        scope: 'contract_call',
        contract_identifier: {
          // Watch all provided DEX contracts
          values: dexContracts,
        },
        method: {
          // Common swap function names across DEXes
          values: [
            'swap-exact-tokens-for-tokens',
            'swap-tokens-for-exact-tokens',
            'swap-helper',
            'swap',
            'swap-x-for-y',
            'swap-y-for-x',
          ],
        },
      },
      action: {
        http_post: {
          url: `${this.webhookBaseUrl}/webhooks/swaps`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`,
        },
      },
    };

    try {
      const hook = await this.client.registerChainhook(definition);
      this.registeredHooks.set('dex-swaps', hook);
      logger.info(`Registered DEX swap chainhook: ${hook.uuid}`);
      return hook;
    } catch (error) {
      logger.error('Failed to register DEX swap chainhook', error);
      throw error;
    }
  }

  /**
   * Register liquidity pool events monitoring
   */
  async registerLiquidityHook(poolContracts: string[]): Promise<Chainhook> {
    const definition: ChainhookDefinition = {
      name: 'DeFi Monitor - Liquidity Events',
      chain: 'stacks',
      network: this.network,
      version: 1,
      predicate: {
        scope: 'contract_call',
        contract_identifier: {
          values: poolContracts,
        },
        method: {
          values: [
            'add-liquidity',
            'remove-liquidity',
            'deposit',
            'withdraw',
            'mint',
            'burn',
          ],
        },
      },
      action: {
        http_post: {
          url: `${this.webhookBaseUrl}/webhooks/liquidity`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`,
        },
      },
    };

    try {
      const hook = await this.client.registerChainhook(definition);
      this.registeredHooks.set('liquidity', hook);
      logger.info(`Registered liquidity chainhook: ${hook.uuid}`);
      return hook;
    } catch (error) {
      logger.error('Failed to register liquidity chainhook', error);
      throw error;
    }
  }

  /**
   * Register token transfer monitoring for whale alerts
   */
  async registerTokenTransferHook(tokenContracts: string[]): Promise<Chainhook> {
    const definition: ChainhookDefinition = {
      name: 'DeFi Monitor - Token Transfers',
      chain: 'stacks',
      network: this.network,
      version: 1,
      predicate: {
        scope: 'ft_event',
        asset_identifier: {
          values: tokenContracts.map((c) => `${c}::*`),
        },
        actions: ['transfer', 'mint', 'burn'],
      },
      action: {
        http_post: {
          url: `${this.webhookBaseUrl}/webhooks/transfers`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`,
        },
      },
    };

    try {
      const hook = await this.client.registerChainhook(definition);
      this.registeredHooks.set('token-transfers', hook);
      logger.info(`Registered token transfer chainhook: ${hook.uuid}`);
      return hook;
    } catch (error) {
      logger.error('Failed to register token transfer chainhook', error);
      throw error;
    }
  }

  /**
   * Register STX transfer monitoring for large transactions
   */
  async registerStxTransferHook(minAmount?: number): Promise<Chainhook> {
    const definition: ChainhookDefinition = {
      name: 'DeFi Monitor - STX Whale Transfers',
      chain: 'stacks',
      network: this.network,
      version: 1,
      predicate: {
        scope: 'stx_event',
        actions: ['transfer'],
        // Optional: filter by minimum amount
        ...(minAmount && { amount: { greater_than: minAmount } }),
      },
      action: {
        http_post: {
          url: `${this.webhookBaseUrl}/webhooks/stx-transfers`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`,
        },
      },
    };

    try {
      const hook = await this.client.registerChainhook(definition);
      this.registeredHooks.set('stx-transfers', hook);
      logger.info(`Registered STX transfer chainhook: ${hook.uuid}`);
      return hook;
    } catch (error) {
      logger.error('Failed to register STX transfer chainhook', error);
      throw error;
    }
  }

  /**
   * Register NFT marketplace monitoring
   */
  async registerNftMarketplaceHook(marketplaceContracts: string[]): Promise<Chainhook> {
    const definition: ChainhookDefinition = {
      name: 'DeFi Monitor - NFT Marketplace',
      chain: 'stacks',
      network: this.network,
      version: 1,
      predicate: {
        scope: 'contract_call',
        contract_identifier: {
          values: marketplaceContracts,
        },
        method: {
          values: ['list-asset', 'buy-asset', 'accept-offer', 'make-offer'],
        },
      },
      action: {
        http_post: {
          url: `${this.webhookBaseUrl}/webhooks/nft-sales`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'default-secret'}`,
        },
      },
    };

    try {
      const hook = await this.client.registerChainhook(definition);
      this.registeredHooks.set('nft-marketplace', hook);
      logger.info(`Registered NFT marketplace chainhook: ${hook.uuid}`);
      return hook;
    } catch (error) {
      logger.error('Failed to register NFT marketplace chainhook', error);
      throw error;
    }
  }

  /**
   * Get all registered chainhooks
   */
  async listChainhooks(limit = 50): Promise<Chainhook[]> {
    try {
      const response = await this.client.getChainhooks({ limit });
      return response.results;
    } catch (error) {
      logger.error('Failed to list chainhooks', error);
      throw error;
    }
  }

  /**
   * Get a specific chainhook by UUID
   */
  async getChainhook(uuid: string): Promise<Chainhook> {
    try {
      return await this.client.getChainhook(uuid);
    } catch (error) {
      logger.error(`Failed to get chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Enable or disable a chainhook
   */
  async toggleChainhook(uuid: string, enabled: boolean): Promise<void> {
    try {
      await this.client.enableChainhook(uuid, enabled);
      logger.info(`Chainhook ${uuid} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error(`Failed to toggle chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Delete a chainhook
   */
  async deleteChainhook(uuid: string): Promise<void> {
    try {
      await this.client.deleteChainhook(uuid);
      logger.info(`Deleted chainhook ${uuid}`);
    } catch (error) {
      logger.error(`Failed to delete chainhook ${uuid}`, error);
      throw error;
    }
  }

  /**
   * Get registered hooks map
   */
  getRegisteredHooks(): Map<string, Chainhook> {
    return this.registeredHooks;
  }

  /**
   * Initialize all DeFi monitoring chainhooks
   */
  async initializeAllHooks(config: {
    dexContracts: string[];
    poolContracts: string[];
    tokenContracts: string[];
    nftMarketplaces?: string[];
    stxMinAmount?: number;
  }): Promise<void> {
    logger.info('Initializing all DeFi chainhooks...');

    try {
      // Register all hooks in parallel
      await Promise.all([
        this.registerDexSwapHook(config.dexContracts),
        this.registerLiquidityHook(config.poolContracts),
        this.registerTokenTransferHook(config.tokenContracts),
        this.registerStxTransferHook(config.stxMinAmount),
        ...(config.nftMarketplaces
          ? [this.registerNftMarketplaceHook(config.nftMarketplaces)]
          : []),
      ]);

      logger.info(
        `Successfully initialized ${this.registeredHooks.size} chainhooks`
      );
    } catch (error) {
      logger.error('Failed to initialize chainhooks', error);
      throw error;
    }
  }

  /**
   * Cleanup all registered chainhooks
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up chainhooks...');

    for (const [name, hook] of this.registeredHooks) {
      try {
        await this.deleteChainhook(hook.uuid);
        logger.info(`Cleaned up chainhook: ${name}`);
      } catch (error) {
        logger.error(`Failed to cleanup chainhook ${name}`, error);
      }
    }

    this.registeredHooks.clear();
  }
}

