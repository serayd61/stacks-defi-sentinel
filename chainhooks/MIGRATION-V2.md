# Chainhooks V1 → V2 Migration Guide

> ⚠️ **DEADLINE: March 9th, 2026** - V1 chainhooks will be deprecated!

## Overview

Hiro is deprecating Chainhooks V1 and migrating to V2. This guide covers the migration process for the DeFi Sentinel project.

## Key Changes in V2

| Aspect | V1 | V2 |
|--------|----|----|
| Structure | `if_this` / `then_that` | `filters.events[]` / `action` |
| Scope | `scope: "stx_event"` | `type: "stx_transfer"` |
| Network | Nested under `networks.mainnet` | Top-level `network: "mainnet"` |
| Auth | `authorization_header` in config | Managed via `rotateConsumerSecret()` |
| Block Replay | `start_block` in config | Separate Replay Block API |

## Migration Steps

### 1. Review Current V1 Hooks

Our current V1 chainhooks:
- `defi-sentinel-main` - Token transfers
- `defi-sentinel-whale-alerts` - STX whale movements
- `defi-sentinel-staking` - Staking events

### 2. Run Migration Script

```bash
# Preview changes (dry run)
HIRO_API_KEY=your_key DRY_RUN=true npx ts-node scripts/migrate-chainhooks-v2.ts

# Execute migration
HIRO_API_KEY=your_key npx ts-node scripts/migrate-chainhooks-v2.ts
```

### 3. Verify V2 Hooks

Monitor both V1 and V2 hooks for a few days to ensure:
- Webhook deliveries match
- No missed events
- Payload format is handled correctly

### 4. Update Webhook Handlers

V2 payloads have a slightly different structure. Update handlers if needed:

```typescript
// V1 payload structure
interface V1Payload {
  apply: Array<{
    transactions: Array<{
      metadata: any;
      operations: any[];
    }>;
  }>;
}

// V2 payload structure  
interface V2Payload {
  chainhook: {
    uuid: string;
    predicate: any;
  };
  apply: Array<{
    block_identifier: { hash: string; index: number };
    transactions: Array<{
      transaction_identifier: { hash: string };
      metadata: any;
      operations: any[];
    }>;
  }>;
}
```

### 5. Cleanup V1 Hooks

After verification:

```bash
# Preview deletions
HIRO_API_KEY=your_key npx ts-node scripts/cleanup-v1-chainhooks.ts

# Confirm deletions
HIRO_API_KEY=your_key CONFIRM_DELETE=yes npx ts-node scripts/cleanup-v1-chainhooks.ts
```

## V2 Predicate Files

New V2 predicate files are in `chainhooks/predicates-v2/`:

- `defi-sentinel.json` - Token transfer monitoring
- `whale-alerts.json` - STX transfer monitoring
- `staking-events.json` - Staking contract calls
- `dex-swaps.json` - DEX swap monitoring
- `ft-transfers.json` - Fungible token transfers
- `nft-events.json` - NFT mint/transfer events

## V2 Event Types Reference

| V1 Scope | V1 Actions | V2 Event Type |
|----------|------------|---------------|
| `stx_event` | `transfer` | `stx_transfer` |
| `contract_call` | n/a | `contract_call` |
| `ft_event` | `transfer` | `ft_transfer` |
| `ft_event` | `mint` | `ft_mint` |
| `ft_event` | `burn` | `ft_burn` |
| `nft_event` | `transfer` | `nft_transfer` |
| `nft_event` | `mint` | `nft_mint` |

## Block Replay (New in V2)

V2 doesn't support `start_block` in configuration. Use the Replay Block API instead:

```typescript
// Replay a specific block
await v2Manager.replayBlock(chainhookUuid, blockHeight);
```

## Troubleshooting

### Webhook Not Receiving Events

1. Check chainhook is enabled:
```typescript
const status = await v2Manager.getChainhook(uuid);
console.log(status.status.enabled);
```

2. Verify webhook URL is accessible
3. Check filter configuration matches expected events

### Authentication Issues

V2 manages secrets automatically. Rotate if needed:
```typescript
const newSecret = await v2Manager.rotateConsumerSecret(uuid);
```

## Resources

- [Hiro Migration Guide](https://docs.hiro.so/tools/chainhooks/migration)
- [V2 Filters Reference](https://docs.hiro.so/tools/chainhooks/reference/filters)
- [Chainhooks FAQ](https://docs.hiro.so/tools/chainhooks/faq)

## Timeline

- **Now**: Start migration, run both V1 and V2 in parallel
- **February 2026**: Complete verification, delete V1 hooks
- **March 9, 2026**: V1 shutdown - all hooks must be on V2!
