// Formatting utilities for DeFi Sentinel

export const formatSTX = (microStx: bigint): string => {
  const stx = Number(microStx) / 1_000_000;
  return stx.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

export const formatUSD = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatBlockHeight = (height: number): string => {
  return height.toLocaleString();
};

export const parseContractId = (contractId: string): { address: string; name: string } => {
  const [address, name] = contractId.split('.');
  return { address, name };
};
