# Integration Guide

## Integrating with DeFi Sentinel

### JavaScript/TypeScript

```typescript
import { request } from '@stacks/connect';
import { uintCV, stringAsciiCV, cvToJSON, hexToCV } from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';

// Buy tokens
async function buyTokens(amount: number) {
  const result = await request(
    { walletConnect: { projectId: 'your-project-id' } },
    'stx_callContract',
    {
      contract: `${CONTRACT_ADDRESS}.token-sale-v8`,
      functionName: 'buy-tokens',
      functionArgs: [uintCV(amount)],
      network: 'mainnet',
    }
  );
  return result;
}

// Read balance
async function getBalance(address: string) {
  const response = await fetch(
    `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/sentinel-token/get-balance`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: CONTRACT_ADDRESS,
        arguments: [cvToHex(principalCV(address))],
      }),
    }
  );
  const data = await response.json();
  return cvToJSON(hexToCV(data.result));
}
```

### React Hook

```typescript
import { useState, useEffect } from 'react';

export function useSentinelToken(address: string) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      const bal = await getBalance(address);
      setBalance(parseInt(bal.value) / 1_000_000);
      setLoading(false);
    }
    if (address) fetchBalance();
  }, [address]);

  return { balance, loading };
}
```

### Chainhook Integration

```json
{
  "name": "sentinel-swap-monitor",
  "version": 1,
  "chain": "stacks",
  "networks": {
    "mainnet": {
      "start_block": 160000,
      "if_this": {
        "scope": "contract_call",
        "contract_identifier": "SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.amm-pool-v2",
        "method": "swap-x-for-y"
      },
      "then_that": {
        "http_post": {
          "url": "https://your-webhook.com/swap",
          "authorization_header": "Bearer token"
        }
      }
    }
  }
}
```

## Webhooks

Register for events:

```bash
curl -X POST https://stacks-defi-sentinel-production.up.railway.app/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["swap", "whale_alert", "price_update"]
  }'
```

## SDK (Coming Soon)

```typescript
import { DeFiSentinel } from '@defi-sentinel/sdk';

const sentinel = new DeFiSentinel({ network: 'mainnet' });

// Get token price
const price = await sentinel.getPrice('SNTL');

// Monitor swaps
sentinel.on('swap', (event) => {
  console.log('New swap:', event);
});

// Get lending pool stats
const pool = await sentinel.getLendingPool();
console.log('TVL:', pool.totalCollateral);
```

