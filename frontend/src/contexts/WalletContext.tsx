import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  AppConfig, 
  UserSession, 
  showConnect,
  disconnect as stacksDisconnect,
  openContractCall,
} from '@stacks/connect';
import { 
  uintCV, 
  PostConditionMode,
  Pc,
} from '@stacks/transactions';

// Types
export type WalletType = 'leather' | 'xverse' | 'hiro' | 'okx' | 'asigna' | 'orange';

interface WalletContextType {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  userAddress: string | null;
  balance: string | null;
  
  // Wallet detection
  installedWallets: WalletType[];
  detectedWallet: string | null;
  hasProvider: boolean;
  
  // Modal state
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
  
  // Actions
  connectWallet: (walletType?: WalletType) => void;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  refreshDetection: () => void;
  
  // Subscription
  isSubscribed: boolean;
  subscribeBasic: () => Promise<void>;
  subscribePremium: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  
  // User session
  userSession: UserSession;
}

// App config - StackPay style
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Contract details
const CONTRACT_ADDRESS = 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9';
const CONTRACT_NAME = 'defi-sentinel';

// Check which wallets are installed
const checkInstalledWallets = (): WalletType[] => {
  if (typeof window === 'undefined') return [];
  
  const installed: WalletType[] = [];
  const win = window as any;
  
  try {
    // Leather
    if (win.LeatherProvider || (win.StacksProvider && !win.XverseProviders) || win.btc?.request) {
      installed.push('leather');
    }
    
    // Xverse
    if (win.XverseProviders || win.BitcoinProvider?.request || (win.StacksProvider && win.BitcoinProvider)) {
      installed.push('xverse');
    }
    
    // Hiro (legacy, now Leather)
    if (win.HiroWalletProvider || win.StacksProvider) {
      installed.push('hiro');
    }
    
    // OKX
    if (win.okxwallet?.stacks || win.okxwallet?.bitcoin) {
      installed.push('okx');
    }
    
    // Asigna
    if (win.AsignaProvider) {
      installed.push('asigna');
    }
    
    // Orange
    if (win.OrangeStacksProvider) {
      installed.push('orange');
    }
  } catch (error) {
    console.error('Error checking wallets:', error);
  }
  
  return installed;
};

// Check if any Stacks provider is available
const hasStacksProvider = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return !!(
    win.StacksProvider ||
    win.LeatherProvider ||
    win.XverseProviders?.StacksProvider ||
    win.BitcoinProvider ||
    win.btc ||
    win.HiroWalletProvider
  );
};

// Get detected wallet name
const getDetectedWallet = (): string | null => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  
  if (win.LeatherProvider || (win.StacksProvider && !win.XverseProviders && !win.BitcoinProvider)) {
    return 'Leather';
  }
  if (win.XverseProviders || (win.StacksProvider && win.BitcoinProvider)) {
    return 'Xverse';
  }
  if (win.HiroWalletProvider) {
    return 'Hiro';
  }
  if (win.okxwallet) {
    return 'OKX';
  }
  if (win.StacksProvider) {
    return 'Stacks Wallet';
  }
  return null;
};

// Create context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider component
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<WalletType[]>([]);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Refresh wallet detection
  const refreshDetection = useCallback(() => {
    const installed = checkInstalledWallets();
    setInstalledWallets(installed);
    setHasProvider(hasStacksProvider());
    setDetectedWallet(getDetectedWallet());
    
    console.log('=== Wallet Detection ===');
    console.log('Installed wallets:', installed);
    console.log('Has provider:', hasStacksProvider());
    console.log('Detected wallet:', getDetectedWallet());
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      refreshDetection();
      
      if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        const address = userData.profile?.stxAddress?.mainnet || 
                       userData.profile?.stxAddress?.testnet ||
                       null;
        
        if (address) {
          setIsConnected(true);
          setUserAddress(address);
          refreshBalance();
        }
      }
    };

    checkSession();
    
    // Recheck after delays
    const t1 = setTimeout(checkSession, 500);
    const t2 = setTimeout(checkSession, 1500);
    const t3 = setTimeout(checkSession, 3000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [refreshDetection]);

  // Fetch balance
  const refreshBalance = useCallback(async () => {
    const address = userAddress || (userSession.isUserSignedIn() 
      ? userSession.loadUserData().profile?.stxAddress?.mainnet 
      : null);
    
    if (!address) return;
    
    try {
      const response = await fetch(
        `https://api.hiro.so/extended/v1/address/${address}/balances`
      );
      if (response.ok) {
        const data = await response.json();
        const stxBalance = (parseInt(data.stx?.balance || '0') / 1_000_000).toFixed(2);
        setBalance(stxBalance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, [userAddress]);

  // Connect wallet - StackPay style
  const connectWallet = useCallback((walletType?: WalletType) => {
    setIsLoading(true);
    setShowWalletModal(false);

    showConnect({
      appDetails: {
        name: 'DeFi Sentinel',
        icon: window.location.origin + '/logo.png',
      },
      onFinish: () => {
        const userData = userSession.loadUserData();
        const address = userData.profile?.stxAddress?.mainnet || 
                       userData.profile?.stxAddress?.testnet ||
                       null;
        
        if (address) {
          setIsConnected(true);
          setUserAddress(address);
          setIsLoading(false);
          refreshBalance();
          checkSubscription();
        }
      },
      onCancel: () => {
        setIsLoading(false);
      },
      userSession,
    });
  }, [refreshBalance]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    stacksDisconnect();
    userSession.signUserOut();
    setIsConnected(false);
    setUserAddress(null);
    setBalance(null);
    setIsSubscribed(false);
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      // Check transaction history for subscription
      const response = await fetch(
        `https://api.hiro.so/extended/v1/address/${userAddress}/transactions?limit=50`
      );
      
      if (response.ok) {
        const data = await response.json();
        const hasSubscription = data.results?.some((tx: any) => 
          tx.contract_call?.contract_id?.includes(CONTRACT_NAME) &&
          (tx.contract_call?.function_name === 'subscribe-basic' ||
           tx.contract_call?.function_name === 'subscribe-premium')
        );
        setIsSubscribed(hasSubscription);
      }
    } catch (error) {
      console.error('Failed to check subscription:', error);
    }
  }, [userAddress]);

  // Subscribe basic
  const subscribeBasic = useCallback(async () => {
    if (!isConnected || !userAddress) {
      setShowWalletModal(true);
      return;
    }

    const amount = 10_000_000; // 10 STX

    await openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'subscribe-basic',
      functionArgs: [],
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        Pc.principal(userAddress).willSendEq(amount).ustx(),
      ],
      onFinish: (data) => {
        console.log('Basic subscription tx:', data);
        setIsSubscribed(true);
        refreshBalance();
      },
      onCancel: () => {
        console.log('Subscription cancelled');
      },
    });
  }, [isConnected, userAddress, refreshBalance]);

  // Subscribe premium
  const subscribePremium = useCallback(async () => {
    if (!isConnected || !userAddress) {
      setShowWalletModal(true);
      return;
    }

    const amount = 50_000_000; // 50 STX

    await openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'subscribe-premium',
      functionArgs: [],
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        Pc.principal(userAddress).willSendEq(amount).ustx(),
      ],
      onFinish: (data) => {
        console.log('Premium subscription tx:', data);
        setIsSubscribed(true);
        refreshBalance();
      },
      onCancel: () => {
        console.log('Subscription cancelled');
      },
    });
  }, [isConnected, userAddress, refreshBalance]);

  const value: WalletContextType = {
    isConnected,
    isLoading,
    userAddress,
    balance,
    installedWallets,
    detectedWallet,
    hasProvider,
    showWalletModal,
    setShowWalletModal,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    refreshDetection,
    isSubscribed,
    subscribeBasic,
    subscribePremium,
    checkSubscription,
    userSession,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Hook
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export default WalletContext;
