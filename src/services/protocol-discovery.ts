/**
 * Protocol Discovery Service
 * Auto-discovers new DeFi protocols on Stacks by scanning for contracts
 * implementing known traits (SIP-010 FT, SIP-009 NFT, DEX swap traits).
 */

import { logger } from '../utils/logger';

const HIRO_API = 'https://api.hiro.so';

// Known DeFi-related trait identifiers
const DEFI_TRAITS = [
  // SIP-010 Fungible Token Standard
  'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait',
  // SIP-009 NFT Standard
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait',
];

export interface DiscoveredProtocol {
  contractId: string;
  name: string;
  trait: string;
  deployedAt: string;
  deployer: string;
}

export class ProtocolDiscoveryService {
  private discoveredProtocols: Map<string, DiscoveredProtocol> = new Map();
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private scanIntervalMs: number;

  constructor(scanIntervalMs = 3600_000) { // Default: 1 hour
    this.scanIntervalMs = scanIntervalMs;
  }

  async start(): Promise<void> {
    logger.info('Starting Protocol Discovery Service...');

    // Initial scan
    await this.scanAll();

    // Periodic scanning
    this.scanInterval = setInterval(() => {
      this.scanAll().catch((err) => logger.error('Protocol scan error:', err));
    }, this.scanIntervalMs);

    logger.info(`Protocol Discovery Service started (scanning every ${this.scanIntervalMs / 60000}min)`);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    logger.info('Protocol Discovery Service stopped');
  }

  private async scanAll(): Promise<void> {
    for (const trait of DEFI_TRAITS) {
      await this.scanByTrait(trait);
    }

    // Also scan recent smart contract deployments
    await this.scanRecentDeployments();

    logger.info(`Protocol Discovery: ${this.discoveredProtocols.size} protocols tracked`);
  }

  private async scanByTrait(traitId: string): Promise<void> {
    try {
      const res = await fetch(
        `${HIRO_API}/extended/v1/contract/by_trait?trait_abi=${encodeURIComponent(traitId)}&limit=50`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return;

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const contracts = data.results || [];

      for (const contract of contracts) {
        const contractId = contract['contract_id'] as string;
        if (!contractId || this.discoveredProtocols.has(contractId)) continue;

        this.discoveredProtocols.set(contractId, {
          contractId,
          name: contractId.split('.')[1] || contractId,
          trait: traitId.split('.').pop() || traitId,
          deployedAt: (contract['block_time'] as string) || '',
          deployer: contractId.split('.')[0] || '',
        });
      }
    } catch (err) {
      logger.warn(`Failed to scan trait ${traitId}:`, err);
    }
  }

  private async scanRecentDeployments(): Promise<void> {
    try {
      const res = await fetch(
        `${HIRO_API}/extended/v1/tx?type=smart_contract&limit=20&order=desc&order_by=block_height`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return;

      const data = await res.json() as { results?: Record<string, unknown>[] };
      const txs = data.results || [];

      for (const tx of txs) {
        const sc = tx['smart_contract'] as Record<string, unknown> | undefined;
        if (!sc) continue;

        const contractId = sc['contract_id'] as string;
        if (!contractId || this.discoveredProtocols.has(contractId)) continue;

        // Check if source code contains DeFi-related patterns
        const source = (sc['source_code'] as string) || '';
        const isDeFi = this.isDeFiContract(source);

        if (isDeFi) {
          this.discoveredProtocols.set(contractId, {
            contractId,
            name: contractId.split('.')[1] || contractId,
            trait: 'smart_contract',
            deployedAt: (tx['burn_block_time_iso'] as string) || '',
            deployer: (tx['sender_address'] as string) || '',
          });
        }
      }
    } catch (err) {
      logger.warn('Failed to scan recent deployments:', err);
    }
  }

  private isDeFiContract(sourceCode: string): boolean {
    const defiKeywords = [
      'swap', 'liquidity', 'pool', 'stake', 'staking',
      'lend', 'borrow', 'collateral', 'oracle', 'amm',
      'dex', 'yield', 'farm', 'vault', 'bridge',
      'sip-010', 'ft-trait', 'transfer',
    ];
    const lower = sourceCode.toLowerCase();
    return defiKeywords.some((kw) => lower.includes(kw));
  }

  getDiscoveredProtocols(): DiscoveredProtocol[] {
    return Array.from(this.discoveredProtocols.values());
  }

  getProtocolCount(): number {
    return this.discoveredProtocols.size;
  }
}
