// Constants for DeFi Sentinel

export const CONTRACT_OWNER = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';

export const CONTRACTS = {
  SENTINEL_TOKEN: `${CONTRACT_OWNER}.sentinel-token`,
  TOKEN_SALE: `${CONTRACT_OWNER}.token-sale-v8`,
  STAKING: `${CONTRACT_OWNER}.sentinel-staking-v2`,
  LENDING: `${CONTRACT_OWNER}.sentinel-lending`,
  ORACLE: `${CONTRACT_OWNER}.sentinel-oracle`,
  MULTISIG: `${CONTRACT_OWNER}.sentinel-multisig-v2`,
  DAO: `${CONTRACT_OWNER}.sentinel-dao-v2`,
  AIRDROP: `${CONTRACT_OWNER}.airdrop`,
  REFERRAL: `${CONTRACT_OWNER}.referral`,
  REPUTATION: `${CONTRACT_OWNER}.reputation`,
  TREASURY: `${CONTRACT_OWNER}.treasury`,
} as const;

export const NETWORK = {
  MAINNET: 'https://stacks-node-api.mainnet.stacks.co',
  TESTNET: 'https://stacks-node-api.testnet.stacks.co',
} as const;

export const TOKEN_DECIMALS = 6;
export const STX_DECIMALS = 6;
export const DEFAULT_FEE = 50000;
export const MAX_UINT = BigInt('340282366920938463463374607431768211455');
