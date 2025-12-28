# 🛡️ Stacks DeFi Sentinel

Real-time DeFi monitoring & whale tracking platform for the Stacks blockchain, powered by **Chainhooks** and **Reown AppKit**.

[![Stacks](https://img.shields.io/badge/Stacks-5546FF?style=for-the-badge&logo=bitcoin&logoColor=white)](https://www.stacks.co/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![WalletConnect](https://img.shields.io/badge/WalletConnect-3B99FC?style=for-the-badge&logo=walletconnect&logoColor=white)](https://walletconnect.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](https://opensource.org/licenses/MIT)

## 🌐 Live Demo

- **Dashboard:** [https://defi-sentinel.xyz](https://defi-sentinel.xyz)
- **API:** [https://stacks-defi-sentinel-production.up.railway.app](https://stacks-defi-sentinel-production.up.railway.app)

## 🏆 Stacks Builder Challenge

This project is built for the **Stacks Builder Challenge** and demonstrates:

- ✅ **WalletKit SDK / Reown AppKit** integration
- ✅ **On-chain smart contracts** with real users and fees
- ✅ **Active GitHub development** with multiple contributions

## ✨ Features

### Core Features
- **🔗 Real-time Event Streaming** - Uses Chainhooks to monitor blockchain events
- **💱 DEX Swap Tracking** - Monitor swaps across Velar, Arkadiko, ALEX
- **💧 Liquidity Pool Analytics** - Track liquidity events and pool TVL
- **🐋 Whale Alerts** - Large transaction notifications (10K+ STX)
- **📊 Live Dashboard** - Beautiful, responsive UI with real-time updates

### Web3 Integration
- **🔐 Reown AppKit / WalletConnect** - Connect with any Stacks wallet
- **📱 Multi-wallet Support** - Xverse, Leather, Hiro Wallet, OKX
- **⚡ Mobile Wallet Support** - WalletConnect QR code for mobile

### Subscription System
- **💳 On-chain Subscriptions** - Pay with STX for premium features
- **🎟️ Basic Plan** - 1 STX/month for standard alerts
- **👑 Premium Plan** - 2.5 STX/month for whale alerts + API access

### SENTINEL Token (SNTL)
- **🪙 Governance Token** - Vote on platform decisions
- **📈 Staking Rewards** - Earn SNTL by staking
- **🎁 Airdrops** - Early adopter rewards
- **🔒 Team Vesting** - 6-month cliff, 12-month vesting

### NEW: Advanced Features
- **🏆 Builder Leaderboard** - Track your rank in Stacks Builder Challenge
- **💼 Portfolio Tracker** - Monitor your tokens and NFTs
- **⛽ Gas Tracker** - Real-time transaction fee monitoring
- **🗳️ DAO Voting** - On-chain governance proposals
- **🎁 Referral System** - Earn rewards by inviting friends
- **📊 Advanced Analytics** - Portfolio allocation & performance

## 📜 Smart Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| `defi-sentinel` | `SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB` | Subscription & alerts |
| `sentinel-token` | `SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB` | SNTL token (SIP-010) |
| `sentinel-staking` | `SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB` | Staking with tiered APY |
| `sentinel-dao` | `SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB` | DAO governance voting |

### Contract Functions

**defi-sentinel:**
```clarity
(define-public (subscribe)) ;; Subscribe for 1 STX/month
(define-public (subscribe-premium)) ;; Premium for 2.5 STX/month
(define-read-only (is-subscribed (user principal)))
(define-read-only (get-subscription (user principal)))
```

**sentinel-token:**
```clarity
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)))))
(define-public (mint (amount uint) (to principal))) ;; Owner only
(define-public (init-vesting)) ;; Start team vesting
(define-public (claim-vested)) ;; Claim vested tokens
```

**sentinel-staking:**
```clarity
(define-public (stake (amount uint) (lock-period uint) (referrer (optional principal))))
(define-public (claim-rewards)) ;; Claim staking rewards
(define-public (unstake)) ;; Withdraw staked tokens
(define-public (add-to-stake (additional-amount uint))) ;; Add more tokens
(define-read-only (get-stake (staker principal))) ;; Get stake info
(define-read-only (calculate-pending-rewards (staker principal))) ;; Calculate rewards
```

**sentinel-dao:**
```clarity
(define-public (create-proposal (title ...) (description ...) (proposal-type uint)))
(define-public (cast-vote (proposal-id uint) (vote-for bool)))
(define-public (execute-proposal (proposal-id uint)))
(define-public (delegate-voting-power (delegate principal)))
(define-read-only (get-proposal (proposal-id uint)))
(define-read-only (is-proposal-passed (proposal-id uint)))
```

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
                                                                                          │
                                                                                          ▼
                                                                                 ┌──────────────┐
                                                                                 │ Reown AppKit │
                                                                                 │ WalletConnect│
                                                                                 └──────────────┘
```

## 🛠️ Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** Fastify, Node.js, TypeScript
- **Blockchain:** Stacks, Clarity Smart Contracts
- **Wallet:** @stacks/connect, Reown AppKit, WalletConnect
- **Deployment:** Vercel (frontend), Railway (backend)
- **Monitoring:** Hiro Chainhooks

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/serayd61/stacks-defi-sentinel.git
cd stacks-defi-sentinel/defi-monitor
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

# Webhook URL
WEBHOOK_BASE_URL=https://your-server.com

# Alert Thresholds
WHALE_ALERT_THRESHOLD_STX=100000
LARGE_SWAP_THRESHOLD_USD=50000
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

## 📡 Active Chainhooks

| Hook Name | Status | Description |
|-----------|--------|-------------|
| USDA Stablecoin Tracker | ✅ Active | Track USDA transfers |
| VELAR Token Tracker | ✅ Active | Monitor VELAR activity |
| DeFi Sentinel Subscriptions | ✅ Active | Track subscription events |
| Arkadiko Swaps | ✅ Active | Monitor Arkadiko DEX |
| ALEX DEX Swaps | ✅ Active | Monitor ALEX DEX |
| NFT Transfer Monitor | ✅ Active | Track NFT transfers |
| Liquidity Pool Events | ✅ Active | Monitor liquidity |
| DEX Swap Monitor | ✅ Active | General DEX tracking |

## 📊 API Endpoints

### Dashboard & Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Aggregated statistics |
| `GET /api/volume` | Trading volume by period |

### Swaps & Liquidity

| Endpoint | Description |
|----------|-------------|
| `GET /api/swaps` | Recent swap transactions |
| `GET /api/liquidity` | Liquidity events |
| `GET /api/pools` | Top pools by TVL |

### Tokens & Alerts

| Endpoint | Description |
|----------|-------------|
| `GET /api/tokens` | Top tokens by volume |
| `GET /api/transfers` | Token transfers |
| `GET /api/alerts` | Whale activity alerts |

### WebSocket

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('wss://stacks-defi-sentinel-production.up.railway.app/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

## 🔐 Security

1. **API Key Protection** - Never expose Chainhooks API key
2. **Webhook Verification** - Validate webhook payloads
3. **Rate Limiting** - Implemented for public endpoints
4. **Smart Contract Auditing** - Clarity best practices

## 🗺️ Roadmap

### Phase 1 - Core ✅
- [x] Real-time dashboard
- [x] Chainhooks integration
- [x] Multi-wallet support
- [x] Subscription system
- [x] SENTINEL token
- [x] Reown AppKit integration

### Phase 2 - Advanced Features ✅
- [x] Builder Challenge Leaderboard
- [x] Portfolio Tracker with NFT support
- [x] Gas/Fee Tracker
- [x] DAO Governance Voting
- [x] Referral Reward System
- [x] Advanced Staking Contract
- [x] DEX Aggregator

### Phase 3 - Expansion 🚀
- [ ] Telegram/Discord bot notifications
- [ ] DEX listing (ALEX, Velar)
- [ ] Mobile app (React Native)
- [ ] Cross-chain analytics
- [ ] AI-powered alerts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [Live Dashboard](https://defi-sentinel.xyz)
- [GitHub Repository](https://github.com/serayd61/stacks-defi-sentinel)
- [Chainhooks Documentation](https://docs.hiro.so/chainhooks)
- [Stacks Blockchain](https://www.stacks.co/)
- [Hiro Platform](https://platform.hiro.so/)
- [Reown AppKit](https://docs.reown.com/)

---

Built with ❤️ for the Stacks ecosystem | Stacks Builder Challenge 2024
