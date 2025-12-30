/**
 * useContract Hook
 * Custom hook for interacting with Stacks smart contracts
 */

import { useState, useCallback } from 'react';
import { openContractCall } from '@stacks/connect';
import { 
  ClarityValue, 
  PostConditionMode,
  uintCV,
  principalCV,
  stringUtf8CV,
  bufferCV,
  boolCV,
  tupleCV,
  listCV,
  noneCV,
  someCV
} from '@stacks/transactions';
import { readContract, parseContractId } from '../lib/contractUtils';

interface ContractCallOptions {
  contractId: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions?: any[];
  postConditionMode?: PostConditionMode;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseContractReturn {
  call: (options: ContractCallOptions) => Promise<void>;
  read: <T>(contractId: string, functionName: string, args?: ClarityValue[]) => Promise<T>;
  isLoading: boolean;
  error: Error | null;
  txId: string | null;
}

export function useContract(): UseContractReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const call = useCallback(async (options: ContractCallOptions) => {
    const {
      contractId,
      functionName,
      functionArgs,
      postConditions = [],
      postConditionMode = PostConditionMode.Deny,
      onSuccess,
      onError,
    } = options;

    setIsLoading(true);
    setError(null);
    setTxId(null);

    const { address, name } = parseContractId(contractId);

    try {
      await openContractCall({
        contractAddress: address,
        contractName: name,
        functionName,
        functionArgs,
        postConditions,
        postConditionMode,
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.ico',
        },
        onFinish: (data) => {
          setTxId(data.txId);
          setIsLoading(false);
          onSuccess?.(data);
        },
        onCancel: () => {
          setIsLoading(false);
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      onError?.(error);
    }
  }, []);

  const read = useCallback(async <T,>(
    contractId: string,
    functionName: string,
    args: ClarityValue[] = []
  ): Promise<T> => {
    return readContract<T>(contractId, functionName, args);
  }, []);

  return {
    call,
    read,
    isLoading,
    error,
    txId,
  };
}

/**
 * Hook for Voting DAO interactions
 */
export function useVotingDAO() {
  const { call, read, isLoading, error, txId } = useContract();
  const contractId = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.voting-dao';

  const vote = useCallback(async (proposalId: number, voteChoice: string) => {
    await call({
      contractId,
      functionName: 'vote',
      functionArgs: [uintCV(proposalId), stringUtf8CV(voteChoice)],
    });
  }, [call]);

  const createProposal = useCallback(async (title: string, description: string) => {
    await call({
      contractId,
      functionName: 'create-proposal',
      functionArgs: [stringUtf8CV(title), stringUtf8CV(description)],
    });
  }, [call]);

  const getProposal = useCallback(async (proposalId: number) => {
    return read(contractId, 'get-proposal', [uintCV(proposalId)]);
  }, [read]);

  return {
    vote,
    createProposal,
    getProposal,
    isLoading,
    error,
    txId,
  };
}

/**
 * Hook for Yield Farm interactions
 */
export function useYieldFarm() {
  const { call, read, isLoading, error, txId } = useContract();
  const contractId = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.yield-farm';

  const deposit = useCallback(async (amount: number) => {
    await call({
      contractId,
      functionName: 'deposit',
      functionArgs: [uintCV(amount)],
    });
  }, [call]);

  const withdraw = useCallback(async (amount: number) => {
    await call({
      contractId,
      functionName: 'withdraw',
      functionArgs: [uintCV(amount)],
    });
  }, [call]);

  const harvest = useCallback(async () => {
    await call({
      contractId,
      functionName: 'harvest',
      functionArgs: [],
    });
  }, [call]);

  const getUserInfo = useCallback(async (user: string) => {
    return read(contractId, 'get-user-info', [principalCV(user)]);
  }, [read]);

  const getPendingReward = useCallback(async (user: string) => {
    return read(contractId, 'pending-reward', [principalCV(user)]);
  }, [read]);

  return {
    deposit,
    withdraw,
    harvest,
    getUserInfo,
    getPendingReward,
    isLoading,
    error,
    txId,
  };
}

/**
 * Hook for Flash Loan interactions
 */
export function useFlashLoan() {
  const { call, read, isLoading, error, txId } = useContract();
  const contractId = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.flash-loan';

  const flashLoan = useCallback(async (amount: number) => {
    await call({
      contractId,
      functionName: 'flash-loan',
      functionArgs: [uintCV(amount)],
    });
  }, [call]);

  const repay = useCallback(async (loanId: number) => {
    await call({
      contractId,
      functionName: 'repay-flash-loan',
      functionArgs: [uintCV(loanId)],
    });
  }, [call]);

  const getAvailableLiquidity = useCallback(async () => {
    return read<number>(contractId, 'get-available-liquidity', []);
  }, [read]);

  const getFlashFee = useCallback(async () => {
    return read<number>(contractId, 'get-flash-fee', []);
  }, [read]);

  return {
    flashLoan,
    repay,
    getAvailableLiquidity,
    getFlashFee,
    isLoading,
    error,
    txId,
  };
}

/**
 * Hook for Multi-Sig Wallet interactions
 */
export function useMultiSig() {
  const { call, read, isLoading, error, txId } = useContract();
  const contractId = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.multi-sig-wallet';

  const submitTransaction = useCallback(async (to: string, amount: number, memo: string) => {
    await call({
      contractId,
      functionName: 'submit-transaction',
      functionArgs: [principalCV(to), uintCV(amount), stringUtf8CV(memo)],
    });
  }, [call]);

  const signTransaction = useCallback(async (txId: number) => {
    await call({
      contractId,
      functionName: 'sign-transaction',
      functionArgs: [uintCV(txId)],
    });
  }, [call]);

  const executeTransaction = useCallback(async (txIdNum: number) => {
    await call({
      contractId,
      functionName: 'execute-transaction',
      functionArgs: [uintCV(txIdNum)],
    });
  }, [call]);

  const getTransaction = useCallback(async (txIdNum: number) => {
    return read(contractId, 'get-transaction', [uintCV(txIdNum)]);
  }, [read]);

  return {
    submitTransaction,
    signTransaction,
    executeTransaction,
    getTransaction,
    isLoading,
    error,
    txId,
  };
}

/**
 * Hook for Token Swap (AMM) interactions
 */
export function useTokenSwap() {
  const { call, read, isLoading, error, txId } = useContract();
  const contractId = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.token-swap';

  const addLiquidity = useCallback(async (amount: number) => {
    await call({
      contractId,
      functionName: 'add-liquidity',
      functionArgs: [uintCV(amount)],
    });
  }, [call]);

  const removeLiquidity = useCallback(async (lpAmount: number) => {
    await call({
      contractId,
      functionName: 'remove-liquidity',
      functionArgs: [uintCV(lpAmount)],
    });
  }, [call]);

  const swapSTXForTokens = useCallback(async (stxAmount: number, minTokens: number) => {
    await call({
      contractId,
      functionName: 'swap-stx-for-tokens',
      functionArgs: [uintCV(stxAmount), uintCV(minTokens)],
    });
  }, [call]);

  const getReserves = useCallback(async () => {
    return read(contractId, 'get-reserves', []);
  }, [read]);

  const getSwapQuote = useCallback(async (amount: number) => {
    return read(contractId, 'get-stx-to-token-quote', [uintCV(amount)]);
  }, [read]);

  return {
    addLiquidity,
    removeLiquidity,
    swapSTXForTokens,
    getReserves,
    getSwapQuote,
    isLoading,
    error,
    txId,
  };
}

export default useContract;

