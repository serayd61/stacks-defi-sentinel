// WalletConnect Configuration for DeFi Sentinel
// Week 3 Challenge - WalletConnect Integration

export const WALLETCONNECT_PROJECT_ID = 'defi-sentinel-stacks';

export const walletConnectConfig = {
  // Project metadata
  metadata: {
    name: 'DeFi Sentinel',
    description: 'Comprehensive DeFi monitoring platform on Stacks',
    url: 'https://defi-sentinel.xyz',
    icons: ['https://defi-sentinel.xyz/logo.png'],
  },

  // Supported chains
  chains: {
    stacks: {
      chainId: 'stacks:1',
      name: 'Stacks Mainnet',
      rpcUrl: 'https://stacks-node-api.mainnet.stacks.co',
      explorerUrl: 'https://explorer.hiro.so',
    },
    stacksTestnet: {
      chainId: 'stacks:2147483648',
      name: 'Stacks Testnet',
      rpcUrl: 'https://stacks-node-api.testnet.stacks.co',
      explorerUrl: 'https://explorer.hiro.so/?chain=testnet',
    },
  },

  // Supported methods
  methods: [
    'stx_signTransaction',
    'stx_signMessage',
    'stx_transferStx',
    'stx_callContract',
    'stx_deployContract',
  ],

  // Supported events
  events: [
    'accountsChanged',
    'chainChanged',
    'disconnect',
  ],
};

// Wallet registry
export const supportedWallets = [
  {
    id: 'xverse',
    name: 'Xverse',
    icon: '/wallets/xverse.png',
    type: 'mobile',
    deepLink: 'xverse://',
    downloadUrl: 'https://www.xverse.app/',
    description: 'Most popular Stacks mobile wallet',
  },
  {
    id: 'leather',
    name: 'Leather',
    icon: '/wallets/leather.png',
    type: 'extension',
    downloadUrl: 'https://leather.io/',
    description: 'Secure browser extension wallet',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: '/wallets/okx.png',
    type: 'mobile',
    deepLink: 'okx://',
    downloadUrl: 'https://www.okx.com/web3',
    description: 'Multi-chain mobile wallet',
  },
  {
    id: 'asigna',
    name: 'Asigna',
    icon: '/wallets/asigna.png',
    type: 'extension',
    downloadUrl: 'https://asigna.io/',
    description: 'Multisig wallet for teams',
  },
];

// Session storage keys
export const STORAGE_KEYS = {
  SESSION: 'wc_session',
  CONNECTED_WALLET: 'wc_connected_wallet',
  LAST_ADDRESS: 'wc_last_address',
};

// Connection helpers
export const getWalletById = (id: string) => {
  return supportedWallets.find(w => w.id === id);
};

export const getWalletsByType = (type: 'mobile' | 'extension') => {
  return supportedWallets.filter(w => w.type === type);
};

// Format functions
export const formatWalletAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const isValidStacksAddress = (address: string): boolean => {
  return /^S[PM][0-9A-Z]{38,39}$/.test(address);
};

export default walletConnectConfig;

