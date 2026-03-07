# API Reference

## Overview

DeFi Sentinel provides a comprehensive REST API for accessing DeFi data, analytics, and real-time updates.

**Base URL:** `https://stacks-defi-sentinel-production.up.railway.app`

## Authentication

Currently, the API is open and does not require authentication. Rate limiting applies:
- 100 requests per minute for read endpoints
- 10 requests per minute for write endpoints

## Endpoints

### Dashboard

#### Get Dashboard Stats
```http
GET /api/dashboard
```

Returns overall DeFi statistics.

**Response:**
```json
{
  "totalValueLocked": 142500000,
  "totalVolume24h": 8750000,
  "totalTransactions24h": 15420,
  "activeWallets24h": 3254,
  "topPools": [...],
  "recentSwaps": [...],
  "recentAlerts": [...]
}
```

### Swaps

#### Get Recent Swaps
```http
GET /api/swaps?limit=50&offset=0
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |
| pool | string | Filter by pool name |

**Response:**
```json
{
  "swaps": [
    {
      "txId": "0x...",
      "pool": "STX-USDA",
      "tokenIn": "STX",
      "tokenOut": "USDA",
      "amountIn": 1000,
      "amountOut": 2150,
      "timestamp": "2024-12-30T10:00:00Z",
      "sender": "SP..."
    }
  ],
  "total": 1500,
  "hasMore": true
}
```

### Pools

#### Get All Pools
```http
GET /api/pools
```

**Response:**
```json
{
  "pools": [
    {
      "name": "STX-USDA",
      "tvl": 12500000,
      "volume24h": 850000,
      "apr": 45.5,
      "token0": "STX",
      "token1": "USDA",
      "reserves": {
        "token0": 5000000,
        "token1": 10750000
      }
    }
  ]
}
```

#### Get Pool Details
```http
GET /api/pools/:poolName
```

### Whale Alerts

#### Get Whale Alerts
```http
GET /api/alerts?type=large_transfer&limit=20
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| type | string | Alert type filter |
| limit | number | Max results |
| minAmount | number | Minimum STX amount |

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123",
      "type": "large_transfer",
      "amount": 500000,
      "token": "STX",
      "from": "SP...",
      "to": "SP...",
      "timestamp": "2024-12-30T10:00:00Z",
      "txId": "0x..."
    }
  ]
}
```

### Token Analytics

#### Get Token Info
```http
GET /api/tokens/:symbol
```

**Response:**
```json
{
  "symbol": "STX",
  "name": "Stacks",
  "price": 2.15,
  "change24h": 5.2,
  "marketCap": 2850000000,
  "volume24h": 125000000,
  "circulatingSupply": 1425000000
}
```

### Contract Interactions

#### Get Contract Stats
```http
GET /api/contracts/:contractName
```

**Response:**
```json
{
  "name": "yield-farm",
  "address": "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.yield-farm",
  "totalCalls": 1547,
  "uniqueUsers": 324,
  "tvl": 450000,
  "lastActivity": "2024-12-30T12:00:00Z"
}
```

## WebSocket API

Connect to real-time updates:

```javascript
const ws = new WebSocket('wss://stacks-defi-sentinel-production.up.railway.app/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```

### Event Types

| Type | Description |
|------|-------------|
| `swap` | New swap executed |
| `alert` | Whale alert triggered |
| `block` | New block mined |
| `price` | Price update |

## Error Handling

All errors return JSON with the following format:

```json
{
  "error": true,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_PARAMS` | Invalid request parameters |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Server error |

## SDKs

### JavaScript/TypeScript

```bash
npm install @defi-sentinel/sdk
```

```typescript
import { DeFiSentinel } from '@defi-sentinel/sdk';

const client = new DeFiSentinel();
const stats = await client.getDashboard();
```

### Python

```bash
pip install defi-sentinel
```

```python
from defi_sentinel import Client

client = Client()
stats = client.get_dashboard()
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| GET /api/* | 100/min |
| POST /api/* | 10/min |
| WebSocket | 5 connections |

## Changelog

### v1.2.0 (Dec 2024)
- Added yield farming endpoints
- Added flash loan stats
- WebSocket improvements

### v1.1.0 (Dec 2024)
- Added whale alerts
- Added pool analytics

### v1.0.0 (Dec 2024)
- Initial release

