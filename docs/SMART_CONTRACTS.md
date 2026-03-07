# Smart Contracts Documentation

## Overview

DeFi Sentinel consists of a comprehensive suite of smart contracts deployed on Stacks mainnet. These contracts power various DeFi functionalities including voting, staking, lending, and more.

## Deployed Contracts

### Core Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| voting-dao | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.voting-dao | DAO governance and voting |
| crowdfund | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.crowdfund | Decentralized fundraising |
| tip-jar | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.tip-jar | Creator tipping system |
| nft-marketplace | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-marketplace | NFT trading platform |

### DeFi Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| staking-rewards | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.staking-rewards | Token staking with rewards |
| token-vesting | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-vesting | Vesting schedules |
| airdrop | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.airdrop | Token distribution |
| treasury | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.treasury | DAO treasury management |

### Advanced DeFi Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| multi-sig-wallet | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.multi-sig-wallet | Multi-signature wallet |
| token-swap | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-swap | AMM DEX |
| nft-staking | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-staking | Stake NFTs for rewards |
| flash-loan | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.flash-loan | Flash loan protocol |
| yield-farm | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.yield-farm | Yield farming |

### Utility Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| referral | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.referral | Referral reward system |
| token-burn | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-burn | Deflationary mechanism |
| whitelist | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.whitelist | Access control |
| reputation | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.reputation | User reputation scores |
| achievement-badge | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.achievement-badge | Achievement NFTs |

## Contract Details

### Multi-Sig Wallet

A secure multi-signature wallet requiring multiple approvals for transactions.

**Features:**
- Add/remove signers
- Configurable signature threshold
- Transaction queue with expiration
- Deposit and withdrawal tracking

**Key Functions:**
```clarity
(define-public (submit-transaction (to principal) (amount uint) (memo (string-utf8 256))))
(define-public (sign-transaction (tx-id uint)))
(define-public (execute-transaction (tx-id uint)))
```

### Token Swap (AMM)

Automated Market Maker for token swaps using constant product formula.

**Features:**
- Add/remove liquidity
- Swap with slippage protection
- Configurable swap fees
- LP token tracking

**Key Functions:**
```clarity
(define-public (add-liquidity (stx-amount uint)))
(define-public (swap-stx-for-tokens (stx-amount uint) (min-tokens uint)))
(define-public (remove-liquidity (lp-amount uint)))
```

### NFT Staking

Stake NFTs to earn passive rewards over time.

**Features:**
- Stake multiple NFTs
- Claim rewards anytime
- Compound earnings
- Configurable cooldown period

**Key Functions:**
```clarity
(define-public (stake-nft (nft-id uint)))
(define-public (unstake-nft (nft-id uint)))
(define-public (claim-rewards (nft-id uint)))
```

### Flash Loan

Uncollateralized loans that must be repaid within the same transaction.

**Features:**
- Zero collateral borrowing
- Fixed fee structure
- Loan history tracking
- Emergency controls

**Key Functions:**
```clarity
(define-public (flash-loan (amount uint)))
(define-public (repay-flash-loan (loan-id uint)))
```

### Yield Farm

Stake LP tokens to earn farming rewards.

**Features:**
- Multiple farm pools
- Variable APR based on stake
- Harvest and compound
- Admin controls for rewards

**Key Functions:**
```clarity
(define-public (deposit (amount uint)))
(define-public (withdraw (amount uint)))
(define-public (harvest))
```

## Security Considerations

1. **Access Control**: All admin functions are protected with `contract-owner` checks
2. **Input Validation**: All user inputs are validated before processing
3. **Overflow Protection**: Arithmetic operations are checked for overflow
4. **Reentrancy**: Contracts follow checks-effects-interactions pattern

## Audit Status

| Contract | Audit Status | Date |
|----------|-------------|------|
| voting-dao | Internal Review | Dec 2024 |
| multi-sig-wallet | Internal Review | Dec 2024 |
| flash-loan | Pending | - |

## Integration Guide

### Connecting to Contracts

```typescript
import { callReadOnlyFunction, callPublicFunction } from '@stacks/transactions';

// Read contract state
const result = await callReadOnlyFunction({
  contractAddress: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W',
  contractName: 'flash-loan',
  functionName: 'get-available-liquidity',
  functionArgs: [],
  network: 'mainnet'
});
```

### Making Contract Calls

```typescript
import { openContractCall } from '@stacks/connect';

await openContractCall({
  contractAddress: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W',
  contractName: 'yield-farm',
  functionName: 'deposit',
  functionArgs: [uintCV(1000000)],
  network: 'mainnet'
});
```

## License

MIT License - See LICENSE file for details.

