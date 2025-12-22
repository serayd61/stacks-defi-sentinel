# 🛡️ Stacks DeFi Sentinel

Real-time DeFi monitoring & whale tracking platform for the Stacks blockchain, powered by **@hirosystems/chainhooks-client**.

[![Stacks](https://img.shields.io/badge/Stacks-5546FF?style=for-the-badge&logo=bitcoin&logoColor=white)](https://www.stacks.co/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="https://raw.githubusercontent.com/serkanaydin/stacks-defi-sentinel/main/assets/banner.png" alt="Stacks DeFi Sentinel Banner" width="800"/>
</p>

## ✨ Features

- **🔗 Real-time Event Streaming** - Uses Chainhooks to monitor blockchain events in real-time
- **💱 DEX Swap Tracking** - Monitor swaps across Velar, Arkadiko, ALEX, and other DEXes
- **💧 Liquidity Pool Analytics** - Track liquidity add/remove events and pool TVL
- **🐋 Whale Alerts** - Get notified about large transactions and suspicious activity
- **📊 Dashboard** - Beautiful, responsive dashboard with live updates
- **🔌 WebSocket Support** - Real-time updates pushed to connected clients

## 📦 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Stacks Node    │────▶│   Chainhooks     │────▶│  DeFi Monitor   │
│  (Blockchain)   │     │   (Event Stream) │     │    (Backend)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        │                                 │                                 │
                        ▼                                 ▼                                 ▼
                 ┌──────────────┐                ┌──────────────┐                 ┌──────────────┐
                 │  REST API    │                │  WebSocket   │                 │   Frontend   │
                 │  Endpoints   │                │   Server     │                 │  Dashboard   │
                 └──────────────┘                └──────────────┘                 └──────────────┘
```

## 🛠️ Prerequisites

- Node.js 20+
- A Chainhooks API key (get one at [platform.hiro.so](https://platform.hiro.so))
- (Optional) Redis for caching

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd defi-monitor
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
# Chainhooks API Configuration
CHAINHOOKS_API_KEY=your-api-key-here

# Server Configuration
PORT=4000
HOST=0.0.0.0

# Network
STACKS_NETWORK=mainnet

# Webhook URL (where chainhooks will send events)
WEBHOOK_BASE_URL=https://your-server.com

# Alert Thresholds
WHALE_ALERT_THRESHOLD_STX=100000
LARGE_SWAP_THRESHOLD_USD=50000

# DEX Contracts to Monitor
MONITORED_DEX_CONTRACTS=SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router,SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1

# Token Contracts to Monitor
MONITORED_TOKENS=SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token
```

### 3. Start the Backend

```bash
npm run dev
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 to view the dashboard!

## 📡 API Endpoints

### Dashboard & Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Get aggregated dashboard statistics |
| `GET /api/volume` | Get trading volume by time period |

### Swaps

| Endpoint | Description |
|----------|-------------|
| `GET /api/swaps` | Get recent swap transactions |
| Query params: `limit`, `offset`, `dex`, `token`, `minAmount` |

### Liquidity

| Endpoint | Description |
|----------|-------------|
| `GET /api/liquidity` | Get liquidity add/remove events |
| `GET /api/pools` | Get top pools by TVL |

### Tokens & Transfers

| Endpoint | Description |
|----------|-------------|
| `GET /api/tokens` | Get top tokens by volume |
| `GET /api/transfers` | Get token transfers |

### Alerts

| Endpoint | Description |
|----------|-------------|
| `GET /api/alerts` | Get whale activity alerts |

### WebSocket

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:4000/ws');

// Subscribe to events
ws.send(JSON.stringify({ type: 'subscribe', channel: 'swap' }));
ws.send(JSON.stringify({ type: 'subscribe', channel: 'whale-alert' }));

// Receive events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

Available channels: `all`, `swap`, `liquidity`, `transfer`, `whale-alert`

## 🔧 Using Chainhooks Client

This project uses `@hirosystems/chainhooks-client` to register and manage chainhooks:

```typescript
import { 
  ChainhooksClient, 
  CHAINHOOKS_BASE_URL 
} from '@hirosystems/chainhooks-client';

// Initialize the client
const client = new ChainhooksClient({
  baseUrl: CHAINHOOKS_BASE_URL.mainnet,
  apiKey: process.env.CHAINHOOKS_API_KEY,
});

// Register a swap monitoring chainhook
const chainhook = await client.registerChainhook({
  name: 'DEX Swaps Monitor',
  chain: 'stacks',
  network: 'mainnet',
  version: 1,
  predicate: {
    scope: 'contract_call',
    contract_identifier: {
      values: ['SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router'],
    },
    method: {
      values: ['swap-exact-tokens-for-tokens'],
    },
  },
  action: {
    http_post: {
      url: 'https://your-server.com/webhooks/swaps',
      authorization_header: 'Bearer your-secret',
    },
  },
});

console.log('Registered chainhook:', chainhook.uuid);
```

## 📊 Monitored Events

### DEX Swaps
- Token swap transactions
- Price impact calculation
- Volume tracking

### Liquidity Events
- Add/remove liquidity
- Pool TVL changes
- LP token minting/burning

### Token Transfers
- Large STX transfers
- FT transfers (stSTX, USDA, etc.)
- Whale wallet tracking

### NFT Marketplace (Optional)
- Listings
- Sales
- Offers

## 🏗️ Project Structure

```
defi-monitor/
├── src/
│   ├── index.ts              # Main entry point
│   ├── chainhooks/
│   │   └── client.ts         # Chainhooks manager
│   ├── services/
│   │   ├── event-processor.ts # Event parsing & processing
│   │   └── analytics.ts       # Data aggregation
│   ├── api/
│   │   ├── routes.ts         # REST API endpoints
│   │   └── websocket.ts      # WebSocket server
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── utils/
│       └── logger.ts         # Logging utility
├── frontend/
│   └── src/
│       ├── App.tsx           # Main React app
│       ├── components/       # UI components
│       └── hooks/            # Custom React hooks
├── package.json
└── README.md
```

## 🔐 Security Considerations

1. **API Key Protection** - Never expose your Chainhooks API key in client code
2. **Webhook Verification** - Validate webhook payloads using the authorization header
3. **Rate Limiting** - Implement rate limiting for public endpoints
4. **Input Validation** - Always validate and sanitize user inputs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Chainhooks Documentation](https://docs.hiro.so/chainhooks)
- [Stacks Blockchain](https://www.stacks.co/)
- [Hiro Platform](https://platform.hiro.so/)
- [@hirosystems/chainhooks-client](https://www.npmjs.com/package/@hirosystems/chainhooks-client)

---

Built with ❤️ for the Stacks ecosystem

