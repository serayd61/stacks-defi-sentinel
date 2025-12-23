# Contributing to DeFi Sentinel

Thank you for your interest in contributing to DeFi Sentinel! This document provides guidelines and information for contributors.

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/stacks-defi-sentinel.git
   cd stacks-defi-sentinel/defi-monitor
   ```
3. **Install dependencies:**
   ```bash
   npm install
   cd frontend && npm install
   ```
4. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📁 Project Structure

```
defi-monitor/
├── src/                    # Backend source code
│   ├── index.ts           # Main entry point
│   ├── chainhooks/        # Chainhooks client
│   ├── services/          # Business logic
│   ├── api/               # REST API & WebSocket
│   └── types/             # TypeScript types
├── frontend/              # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main React app
│   │   ├── components/    # UI components
│   │   ├── contexts/      # React contexts
│   │   └── hooks/         # Custom hooks
│   └── public/            # Static assets
├── clarity-contracts/     # Smart contracts
│   └── defi-sentinel-contracts/
│       └── contracts/     # Clarity source files
└── package.json
```

## 🛠️ Development

### Backend

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Frontend

```bash
cd frontend

# Development mode
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

### Smart Contracts

```bash
cd clarity-contracts/defi-sentinel-contracts

# Check contracts
clarinet check

# Run tests
clarinet test

# Deploy to testnet
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

## 📝 Code Style

- **TypeScript:** Use strict mode, avoid `any` when possible
- **React:** Functional components with hooks
- **Clarity:** Follow Clarity best practices
- **Formatting:** Use Prettier with default settings
- **Commits:** Use conventional commit messages

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(dashboard): add whale alert notifications`
- `fix(wallet): resolve Xverse connection issue`
- `docs(readme): update installation instructions`

## 🧪 Testing

- Write tests for new features
- Ensure existing tests pass
- Test on both testnet and mainnet

## 🔐 Security

- Never commit API keys or secrets
- Use environment variables
- Report security issues privately

## 📋 Pull Request Process

1. Update README.md if needed
2. Ensure all tests pass
3. Update documentation
4. Request review from maintainers

## 💬 Communication

- **Issues:** Bug reports and feature requests
- **Discussions:** Questions and ideas
- **Discord:** [Stacks Discord](https://discord.gg/stacks)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
