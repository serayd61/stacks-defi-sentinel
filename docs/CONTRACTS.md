# Smart Contracts Reference

## Deployed Contracts on Mainnet

All contracts are deployed at: `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`

### Core Contracts

#### sentinel-token
SIP-010 compliant fungible token.

**Functions:**
- `transfer(amount, sender, recipient, memo)` - Transfer tokens
- `mint(amount, recipient)` - Mint new tokens (owner only)
- `burn(amount)` - Burn tokens
- `get-balance(owner)` - Get balance
- `get-total-supply()` - Get total supply

**Explorer:** [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token?chain=mainnet)

---

#### sentinel-lending
Collateral-based lending protocol.

**Functions:**
- `add-collateral(amount)` - Deposit collateral
- `borrow(amount)` - Borrow against collateral
- `repay(amount)` - Repay borrowed amount
- `liquidate(user)` - Liquidate undercollateralized position

**Parameters:**
- Collateral ratio: 150%
- Liquidation threshold: 125%
- Interest rate: 5% APY

---

#### sentinel-oracle
Price feed oracle for DeFi protocols.

**Functions:**
- `get-stx-price()` - Get STX/USD price
- `get-sbtc-price()` - Get sBTC/USD price
- `update-price(asset, price)` - Update price (oracle only)

---

#### token-sale-v8
Token sale contract for SNTL distribution.

**Functions:**
- `buy-tokens(amount)` - Purchase tokens with STX
- `initialize-sale(start, end)` - Initialize sale period
- `get-sale-info()` - Get sale status

**Tiers:**
- Tier 1: 0.1 STX per 1000 SNTL
- Tier 2: 0.2 STX per 1000 SNTL
- Tier 3: 0.3 STX per 1000 SNTL

---

### DeFi Contracts

#### amm-pool-v2
Constant product AMM (x*y=k).

**Functions:**
- `create-pool(initial-x, initial-y)` - Create new pool
- `add-liquidity(pool-id, amount-x, amount-y, min-lp)` - Add liquidity
- `remove-liquidity(pool-id, lp-amount, min-x, min-y)` - Remove liquidity
- `swap-x-for-y(pool-id, amount-in, min-out)` - Swap tokens
- `swap-y-for-x(pool-id, amount-in, min-out)` - Swap tokens

---

#### voting
DAO governance voting.

**Functions:**
- `create-proposal(title, description, duration)` - Create a proposal
- `vote(proposal-id, option-id, weight)` - Cast a vote
- `execute-proposal(proposal-id)` - Execute after voting

---

#### nft-marketplace
NFT trading platform.

**Functions:**
- `list-nft(nft-contract, token-id, price, duration)` - List for sale
- `buy-nft(listing-id)` - Purchase NFT
- `create-auction(...)` - Start an auction
- `place-bid(auction-id, amount)` - Bid on auction

---

### Utility Contracts

#### subscription
SaaS subscription management.

#### lottery
Decentralized lottery.

#### timelock
Time-locked transactions.

#### tipjar
Creator monetization.

#### crowdfund
Crowdfunding platform.

---

## Contract Addresses

| Contract | Address |
|----------|---------|
| sentinel-token | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token` |
| sentinel-lending | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-lending` |
| sentinel-oracle | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-oracle` |
| token-sale-v8 | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-sale-v8` |
| amm-pool-v2 | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.amm-pool-v2` |
| voting | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.voting` |
| nft-marketplace | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-marketplace` |
| subscription | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.subscription` |
| lottery | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.lottery` |
| timelock | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.timelock` |
| tipjar | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.tipjar` |
| crowdfund | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.crowdfund` |
| name-registry | `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.name-registry` |
