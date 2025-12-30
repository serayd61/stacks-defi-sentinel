# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **DO NOT** create a public GitHub issue
2. Email: security@defi-sentinel.com (or DM on Discord/Twitter)
3. Include detailed description and steps to reproduce

## Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Fix timeline: Depends on severity

## Security Best Practices

### Smart Contracts

- All contracts are deployed on mainnet: `SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB`
- Contracts use Clarity 3 for maximum security
- No `as-contract` usage to prevent potential exploits
- All arithmetic uses unsigned integers to prevent overflow

### Frontend

- No sensitive data stored in localStorage
- All API calls use HTTPS
- Wallet connections use official Stacks Connect

### API

- Rate limiting enabled
- Input validation on all endpoints
- No private keys stored on server

## Deployed Contracts

| Contract | Address | Verified |
|----------|---------|----------|
| sentinel-token | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token | ✅ |
| sentinel-lending | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-lending | ✅ |
| sentinel-oracle | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-oracle | ✅ |
| token-sale-v8 | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.token-sale-v8 | ✅ |
| voting | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.voting | ✅ |
| nft-marketplace | SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.nft-marketplace | ✅ |

## Audit Status

- [ ] Formal audit pending
- [x] Internal code review completed
- [x] Community testing on mainnet


