import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AppConfig, UserSession, showConnect, disconnect } from '@stacks/connect';

// Contract details
const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'defi-sentinel';

// App config
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Supported wallets
export type WalletType = 'leather' | 'xverse' | 'hiro' | 'okx' | 'asigna' | 'orange';

export const SUPPORTED_WALLETS = [
  { id: 'leather' as WalletType, name: 'Leather', color: '#12100D' },
  { id: 'xverse' as WalletType, name: 'Xverse', color: '#EE7242' },
  { id: 'hiro' as WalletType, name: 'Hiro Wallet', color: '#FF5500' },
  { id: 'okx' as WalletType, name: 'OKX Wallet', color: '#000000' },
  { id: 'asigna' as WalletType, name: 'Asigna', color: '#6B46C1' },
  { id: 'orange' as WalletType, name: 'Orange Wallet', color: '#F97316' },
];

// Check which wallets are installed
const checkInstalledWallets = (): WalletType[] => {
  if (typeof window === 'undefined') return [];
  
  const installed: WalletType[] = [];
  const win = window as any;
  
  // Leather (also provides StacksProvider)
  if (win.LeatherProvider || win.StacksProvider) {
    installed.push('leather');
  }
  
  // Xverse
  if (win.XverseProviders?.StacksProvider || win.BitcoinProvider) {
    installed.push('xverse');
  }
  
  // Hiro Wallet
  if (win.HiroWalletProvider) {
    installed.push('hiro');
  }
  
  // OKX
  if (win.okxwallet?.stacks) {
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
  
  return installed;
};

interface WalletContextType {
  // State
  isConnected: boolean;
  userAddress: string | null;
  balance: string | null;
  isSubscribed: boolean;
  subscriptionTier: 'none' | 'basic' | 'premium';
  isLoading: boolean;
  installedWallets: WalletType[];
  selectedWallet: WalletType | null;
  showWalletModal: boolean;
  
  // Actions
  connectWallet: (walletType?: WalletType) => Promise<void>;
  disconnectWallet: () => void;
  subscribeBasic: () => Promise<void>;
  subscribePremium: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  setShowWalletModal: (show: boolean) => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'none' | 'basic' | 'premium'>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [installedWallets, setInstalledWallets] = useState<WalletType[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Check installed wallets on mount
  useEffect(() => {
    const checkWallets = () => {
      const installed = checkInstalledWallets();
      setInstalledWallets(installed);
    };
    
    checkWallets();
    // Check again after a delay (wallets may inject late)
    const timer = setTimeout(checkWallets, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check if already connected on mount
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      const address = userData.profile.stxAddress?.mainnet || userData.profile.stxAddress?.testnet;
      if (address) {
        setWalletConnected(true);
        setUserAddress(address);
        fetchBalance(address);
      }
    }
  }, []);

  // Fetch balance
  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${address}/balances`);
      const data = await response.json();
      const stxBalance = (parseInt(data.stx?.balance || '0') / 1_000_000).toFixed(2);
      setBalance(stxBalance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (userAddress) {
      await fetchBalance(userAddress);
    }
  }, [userAddress]);

  // Connect wallet
  const connectWallet = useCallback(async (_walletType?: WalletType) => {
    setShowWalletModal(false);
    setIsLoading(true);

    try {
      showConnect({
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.svg',
        },
        redirectTo: window.location.origin,
        onFinish: () => {
          const userData = userSession.loadUserData();
          const address = userData.profile.stxAddress?.mainnet;
          if (address) {
            setWalletConnected(true);
            setUserAddress(address);
            fetchBalance(address);
          }
          setIsLoading(false);
        },
        onCancel: () => {
          setIsLoading(false);
        },
        userSession,
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setIsLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    try {
      disconnect();
      userSession.signUserOut();
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
    setWalletConnected(false);
    setUserAddress(null);
    setBalance(null);
    setIsSubscribed(false);
    setSubscriptionTier('none');
    setSelectedWallet(null);
  }, []);

  // Subscribe to basic plan
  const subscribeBasic = useCallback(async () => {
    if (!userAddress) return;
    
    setIsLoading(true);
    
    try {
      const { openContractCall } = await import('@stacks/connect');
      
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe',
        functionArgs: [],
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.svg',
        },
        onFinish: (data: any) => {
          console.log('Subscribe TX:', data);
          setIsSubscribed(true);
          setSubscriptionTier('basic');
          setIsLoading(false);
        },
        onCancel: () => {
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Subscribe error:', error);
      setIsLoading(false);
    }
  }, [userAddress]);

  // Subscribe to premium plan
  const subscribePremium = useCallback(async () => {
    if (!userAddress) return;
    
    setIsLoading(true);
    
    try {
      const { openContractCall } = await import('@stacks/connect');
      
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe-premium',
        functionArgs: [],
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.svg',
        },
        onFinish: (data: any) => {
          console.log('Premium Subscribe TX:', data);
          setIsSubscribed(true);
          setSubscriptionTier('premium');
          setIsLoading(false);
        },
        onCancel: () => {
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Premium subscribe error:', error);
      setIsLoading(false);
    }
  }, [userAddress]);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      // Check via transaction history
      const txResponse = await fetch(
        `https://api.hiro.so/extended/v1/address/${userAddress}/transactions?limit=50`
      );
      const txData = await txResponse.json();
      
      // Look for successful subscribe transactions to our contract
      const subscriptions = txData.results?.filter((tx: any) => 
        tx.tx_status === 'success' &&
        tx.tx_type === 'contract_call' &&
        tx.contract_call?.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        (tx.contract_call?.function_name === 'subscribe' || tx.contract_call?.function_name === 'subscribe-premium')
      );
      
      if (subscriptions && subscriptions.length > 0) {
        setIsSubscribed(true);
        const latestSub = subscriptions[0];
        if (latestSub.contract_call?.function_name === 'subscribe-premium') {
          setSubscriptionTier('premium');
        } else {
          setSubscriptionTier('basic');
        }
      }
    } catch (error) {
      console.error('Check subscription error:', error);
    }
  }, [userAddress]);

  // Check subscription when address changes
  useEffect(() => {
    if (userAddress) {
      checkSubscription();
    }
  }, [userAddress, checkSubscription]);

  const value: WalletContextType = {
    isConnected: walletConnected,
    userAddress,
    balance,
    isSubscribed,
    subscriptionTier,
    isLoading,
    installedWallets,
    selectedWallet,
    showWalletModal,
    connectWallet,
    disconnectWallet,
    subscribeBasic,
    subscribePremium,
    checkSubscription,
    setShowWalletModal,
    refreshBalance,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;
