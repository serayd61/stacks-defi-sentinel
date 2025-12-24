# Railway Deployment Setup

## Environment Variables

Railway'de aşağıdaki environment variable'ları ekleyin:

### Required Variables:
- `CHAINHOOKS_API_KEY` - Chainhooks API key (opsiyonel, boş bırakılabilir)
- `PORT` - Server port (default: 4000)
- `HOST` - Server host (default: 0.0.0.0)
- `STACKS_NETWORK` - Network (mainnet/testnet, default: mainnet)

### Optional Variables:
- `WEBHOOK_BASE_URL` - Webhook base URL
- `WHALE_ALERT_THRESHOLD_STX` - Whale alert threshold (default: 100000)
- `LARGE_SWAP_THRESHOLD_USD` - Large swap threshold (default: 50000)
- `MONITORED_DEX_CONTRACTS` - Comma-separated DEX contracts
- `MONITORED_TOKENS` - Comma-separated token contracts
- `MONITORED_POOL_CONTRACTS` - Comma-separated pool contracts

## Railway Setup Steps:

1. Railway Dashboard'a gidin
2. Projenize gidin: `stacks-defi-sentinel`
3. **Settings** > **Variables** sekmesine gidin
4. **New Variable** butonuna tıklayın
5. Şu variable'ı ekleyin:
   - **Name**: `CHAINHOOKS_API_KEY`
   - **Value**: (boş bırakabilirsiniz veya gerçek API key'inizi girin)
6. **Add** butonuna tıklayın
7. **Redeploy** butonuna tıklayın

## Not:
`CHAINHOOKS_API_KEY` opsiyoneldir. Eğer set edilmezse, server çalışmaya devam eder ancak real-time chainhook events aktif olmaz.

