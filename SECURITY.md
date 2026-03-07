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

- All contracts are deployed on mainnet: `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`
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
| sentinel-token | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token | ✅ |
| sentinel-lending | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-lending | ✅ |
| sentinel-oracle | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-oracle | ✅ |
| token-sale-v8 | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.token-sale-v8 | ✅ |
| voting | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.voting | ✅ |
| nft-marketplace | SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.nft-marketplace | ✅ |

## Audit Status

- [ ] Formal audit pending
- [x] Internal code review completed
- [x] Community testing on mainnet


