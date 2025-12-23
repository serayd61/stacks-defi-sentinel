# Changelog

All notable changes to DeFi Sentinel will be documented in this file.

## [1.2.0] - 2024-12-23

### Added
- 🔗 **Reown AppKit / WalletConnect** integration for mobile wallet support
- 📊 **Real blockchain data** from Hiro API (live transactions, whale alerts)
- 💰 **STX price** fetching from CoinGecko
- 🖱️ **Clickable transactions** - opens Stacks Explorer
- 🔄 **Auto-refresh** every 30 seconds

### Changed
- Upgraded `@stacks/connect` to v8 with new API
- Improved STX address detection from wallet

## [1.1.0] - 2024-12-22

### Added
- 💳 **Subscription system** - Basic (1 STX) and Premium (2.5 STX) plans
- 🪙 **SENTINEL Token (SNTL)** - SIP-010 fungible token
- 🔒 **Team vesting** - 6-month cliff, 12-month linear vesting
- 👛 **Multi-wallet support** - Xverse, Leather, Hiro, OKX
- 🎨 **Wallet selection modal** with logos

### Changed
- Migrated to `@stacks/connect` v8
- Improved error handling in webhook processing

## [1.0.0] - 2024-12-21

### Added
- 🚀 **Initial release**
- 📊 **Dashboard** with real-time statistics
- 🔗 **8 Chainhooks** for DeFi monitoring
- 💱 **DEX swap tracking** (Velar, ALEX, Arkadiko)
- 🐋 **Whale alerts** for large transfers
- 📡 **WebSocket** for live updates
- 🔌 **REST API** for data access

### Smart Contracts
- `defi-sentinel` - Subscription management
- `sentinel-token` - SNTL governance token

---

## Versioning

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes (backward compatible)

