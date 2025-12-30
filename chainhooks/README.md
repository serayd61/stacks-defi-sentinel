# Chainhooks Configuration

This directory contains Chainhook predicates for DeFi Sentinel's real-time blockchain monitoring.

## What are Chainhooks?

[Chainhooks](https://docs.hiro.so/chainhooks) by Hiro enable you to trigger actions in response to on-chain Stacks events. They're essential for:

- 🔔 Real-time notifications
- 📊 Transaction monitoring
- 🐋 Whale alerts
- 📈 Analytics tracking

## Predicates

### `defi-sentinel.json`
Monitors SENTINEL token transfers for real-time tracking.

### `staking-events.json`
Tracks staking deposits and withdrawals.

### `whale-alerts.json`
Detects large STX transfers for whale monitoring.

## Usage

### 1. Install Chainhooks CLI
```bash
npm install -g @hirosystems/chainhooks-cli
```

### 2. Register Predicate
```bash
chainhooks predicates register ./predicates/defi-sentinel.json
```

### 3. Start Listening
```bash
chainhooks predicates start
```

## Webhook Endpoints

| Event | Endpoint |
|-------|----------|
| Token Transfers | `/webhooks/token-transfer` |
| Staking | `/webhooks/staking` |
| Whale Alerts | `/webhooks/whale-alerts` |
| Lending | `/webhooks/lending` |

## Event Processing

Events are processed in real-time and:
1. Stored in database for analytics
2. Broadcast via WebSocket to connected clients
3. Trigger notifications for subscribed users

## Integration with WalletConnect

Combined with WalletConnect, Chainhooks enable:
- Instant transaction confirmations
- Real-time balance updates
- Live notification delivery

## Week 3 Builder Challenge

This implementation showcases:
- ✅ Chainhooks integration for real-time events
- ✅ WalletConnect for wallet connections
- ✅ WebSocket for live data streaming
- ✅ Comprehensive DeFi monitoring

## Resources

- [Chainhooks Documentation](https://docs.hiro.so/chainhooks)
- [Stacks API](https://docs.hiro.so/stacks-blockchain-api)
- [WalletConnect Stacks](https://docs.walletconnect.com/)

---

Built for Stacks Builder Challenge 2024 🚀

