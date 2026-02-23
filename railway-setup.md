# Railway Deployment Setup

## Environment Variables

Add the following environment variables in Railway:

### Required Variables:
- `CHAINHOOKS_API_KEY` - Chainhooks API key (optional, can be left empty)
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

1. Go to the Railway Dashboard
2. Navigate to your project: `stacks-defi-sentinel`
3. Go to the **Settings** > **Variables** tab
4. Click the **New Variable** button
5. Add the following variable:
   - **Name**: `CHAINHOOKS_API_KEY`
   - **Value**: (you can leave it empty or enter your actual API key)
6. Click the **Add** button
7. Click the **Redeploy** button

## Note:
`CHAINHOOKS_API_KEY` is optional. If not set, the server will continue to run but real-time chainhook events will not be active.




