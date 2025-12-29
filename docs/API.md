# DeFi Sentinel API Documentation

## Base URL

```
https://stacks-defi-sentinel-production.up.railway.app
```

## Endpoints

### Dashboard

#### GET /api/dashboard
Get overall DeFi statistics.

**Response:**
```json
{
  "totalValueLocked": 1500000000,
  "totalVolume24h": 50000000,
  "totalTransactions24h": 1234,
  "activeWallets24h": 567,
  "topPools": [...],
  "recentSwaps": [...],
  "recentAlerts": [...]
}
```

### Pools

#### GET /api/pools
Get liquidity pool information.

**Response:**
```json
[
  {
    "name": "STX-USDA",
    "tvl": 500000000,
    "volume24h": 10000000,
    "apy": 12.5
  }
]
```

### Swaps

#### GET /api/swaps/recent
Get recent swap transactions.

**Query Parameters:**
- `limit`: Number of swaps (default: 20)

**Response:**
```json
[
  {
    "txId": "0x...",
    "from": "STX",
    "to": "USDA",
    "amount": 1000000000,
    "timestamp": "2024-12-29T12:00:00Z"
  }
]
```

### Whale Alerts

#### GET /api/alerts
Get whale transaction alerts.

**Query Parameters:**
- `minAmount`: Minimum STX amount (default: 10000)

**Response:**
```json
[
  {
    "txId": "0x...",
    "type": "transfer",
    "amount": 50000000000,
    "from": "SP...",
    "to": "SP...",
    "timestamp": "2024-12-29T12:00:00Z"
  }
]
```

## WebSocket

### Connect
```javascript
const ws = new WebSocket('wss://stacks-defi-sentinel-production.up.railway.app/ws');
```

### Events

#### swap
New swap detected.
```json
{
  "type": "swap",
  "data": {
    "txId": "0x...",
    "from": "STX",
    "to": "USDA",
    "amount": 1000000000
  }
}
```

#### alert
Whale transaction detected.
```json
{
  "type": "alert",
  "data": {
    "txId": "0x...",
    "amount": 50000000000,
    "severity": "high"
  }
}
```

## Rate Limiting

- 100 requests per minute per IP
- WebSocket: 1 connection per client

## Error Responses

```json
{
  "error": "Error message",
  "code": 400
}
```

