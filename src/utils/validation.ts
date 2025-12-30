// Validation utilities for DeFi Sentinel

export const isValidStxAddress = (address: string): boolean => {
  return /^S[PM][0-9A-Z]{38,39}$/.test(address);
};

export const isValidContractId = (contractId: string): boolean => {
  const parts = contractId.split('.');
  return parts.length === 2 && isValidStxAddress(parts[0]) && /^[a-z][a-z0-9-]*$/.test(parts[1]);
};

export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && isFinite(num);
};

export const validateTransactionParams = (params: {
  amount?: number;
  recipient?: string;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (params.amount !== undefined && !isValidAmount(params.amount)) {
    errors.push('Invalid amount');
  }
  
  if (params.recipient !== undefined && !isValidStxAddress(params.recipient)) {
    errors.push('Invalid recipient address');
  }
  
  return { valid: errors.length === 0, errors };
};
