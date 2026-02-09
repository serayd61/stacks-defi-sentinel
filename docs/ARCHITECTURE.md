# DeFi Sentinel Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DeFi Sentinel                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Frontend   │    │   Backend    │    │  Chainhooks  │              │
│  │   (React)    │◄──►│  (Node.js)   │◄──►│  (Hiro)      │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    Stacks Blockchain                          │      │
│  ├──────────────────────────────────────────────────────────────┤      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │      │
│  │  │ SNTL Token  │  │  Lending    │  │   Oracle    │          │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │      │
│  │  │ Token Sale  │  │  Multisig   │  │   Voting    │          │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │      │
│  │  │  Staking    │  │    DAO      │  │ Marketplace │          │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (React + TypeScript)

- **Dashboard**: Real-time DeFi metrics
- **DEX Aggregator**: Best swap rates
- **Whale Alerts**: Large transaction notifications
- **Lending Pool**: Collateral and borrowing UI
- **Token Sale**: ICO participation
- **Portfolio Tracker**: Asset management

### Backend (Node.js + Express)

- **REST API**: Dashboard data endpoints
- **WebSocket**: Real-time updates
- **Chainhooks**: Blockchain event processing
- **Rate Limiting**: API protection

### Smart Contracts (Clarity)

| Contract | Purpose |
|----------|---------|
| sentinel-token | SIP-010 fungible token |
| sentinel-lending | Collateral-based lending |
| sentinel-oracle | Price feeds |
| sentinel-multisig-v2 | Treasury management |
| token-sale-v8 | Token distribution |
| voting | DAO governance |
| nft-marketplace | NFT trading |

## Data Flow

1. **User Action** → Frontend
2. **Wallet Sign** → Stacks Connect
3. **Transaction** → Stacks Blockchain
4. **Event** → Chainhooks
5. **Update** → Backend WebSocket
6. **Refresh** → Frontend UI

## Deployment

- **Frontend**: Vercel (https://defi-sentinel.xyz)
- **Backend**: Railway
- **Contracts**: Stacks Mainnet

## Security

- No private keys in code
- All transfers require user signature
- Rate limiting on API
- Input validation everywhere


