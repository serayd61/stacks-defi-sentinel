import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AppConfig, UserSession, showConnect, openContractCall, getSelectedProvider } from '@stacks/connect';
import { STACKS_MAINNET } from '@stacks/network';
import { PostConditionMode } from '@stacks/transactions';

// Contract details
const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'defi-sentinel';

// Supported wallets
export type WalletType = 'hiro' | 'xverse' | 'leather' | 'okx';

export const SUPPORTED_WALLETS = [
  { id: 'hiro' as WalletType, name: 'Hiro Wallet', icon: '🟠', installed: false },
  { id: 'xverse' as WalletType, name: 'Xverse', icon: '🔵', installed: false },
  { id: 'leather' as WalletType, name: 'Leather', icon: '🟤', installed: false },
  { id: 'okx' as WalletType, name: 'OKX Wallet', icon: '⚫', installed: false },
];

// App config - must be created once
const appConfig = new AppConfig(['store_write', 'publish_data']);

// Create userSession only in browser
let userSession: UserSession | null = null;
if (typeof window !== 'undefined') {
  userSession = new UserSession({ appConfig });
}

// Check which wallets are installed
const checkInstalledWallets = (): WalletType[] => {
  if (typeof window === 'undefined') return [];
  
  const installed: WalletType[] = [];
  
  // Check for Hiro/Leather wallet
  if ((window as any).StacksProvider) {
    installed.push('hiro');
    installed.push('leather');
  }
  
  // Check for Xverse
  if ((window as any).XverseProviders?.StacksProvider || (window as any).BitcoinProvider) {
    installed.push('xverse');
  }
  
  // Check for OKX
  if ((window as any).okxwallet?.stacks) {
    installed.push('okx');
  }
  
  return installed;
};

interface WalletContextType {
  // State
  isConnected: boolean;
  userAddress: string | null;
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
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
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
    
    // Check immediately and after a delay (wallets may inject late)
    checkWallets();
    const timer = setTimeout(checkWallets, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Check if already connected on mount
  useEffect(() => {
    if (userSession && userSession.isUserSignedIn()) {
      try {
        const userData = userSession.loadUserData();
        setIsConnected(true);
        setUserAddress(userData.profile.stxAddress.mainnet);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async (walletType?: WalletType) => {
    if (!userSession) {
      console.error('UserSession not available');
      return;
    }

    // If no wallet type specified, show our custom modal
    if (!walletType) {
      setShowWalletModal(true);
      return;
    }

    setSelectedWallet(walletType);
    setShowWalletModal(false);
    setIsLoading(true);

    try {
      // showConnect returns a Promise in v8
      await showConnect({
        appDetails: {
          name: 'DeFi Sentinel',
          icon: window.location.origin + '/favicon.svg',
        },
        userSession,
      });
      
      // After showConnect resolves, check if user is signed in
      if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        setIsConnected(true);
        setUserAddress(userData.profile.stxAddress.mainnet);
        console.log('Wallet connected:', userData.profile.stxAddress.mainnet);
      }
    } catch (error) {
      console.error('Error calling showConnect:', error);
      // User might have cancelled
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    if (userSession) {
      userSession.signUserOut();
    }
    setIsConnected(false);
    setUserAddress(null);
    setIsSubscribed(false);
    setSubscriptionTier('none');
  }, []);

  // Subscribe to basic plan
  const subscribeBasic = useCallback(async () => {
    if (!userAddress) return;
    
    setIsLoading(true);
    
    try {
      await openContractCall({
        network: STACKS_MAINNET,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Subscribe TX:', data.txId);
          setIsSubscribed(true);
          setSubscriptionTier('basic');
        },
        onCancel: () => {
          console.log('Transaction cancelled');
        },
      });
    } catch (error) {
      console.error('Subscribe error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  // Subscribe to premium plan
  const subscribePremium = useCallback(async () => {
    if (!userAddress) return;
    
    setIsLoading(true);
    
    try {
      await openContractCall({
        network: STACKS_MAINNET,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'subscribe-premium',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Premium Subscribe TX:', data.txId);
          setIsSubscribed(true);
          setSubscriptionTier('premium');
        },
        onCancel: () => {
          console.log('Transaction cancelled');
        },
      });
    } catch (error) {
      console.error('Premium subscribe error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!userAddress) return;
    
    try {
      const response = await fetch(
        `https://api.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/is-subscribed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: userAddress,
            arguments: [`0x${Buffer.from(userAddress).toString('hex')}`],
          }),
        }
      );
      
      const data = await response.json();
      if (data.result) {
        // Parse the result to check subscription status
        setIsSubscribed(data.result === '0x03'); // true in Clarity
      }
    } catch (error) {
      console.error('Check subscription error:', error);
    }
  }, [userAddress]);

  // Check subscription when address changes
  React.useEffect(() => {
    if (userAddress) {
      checkSubscription();
    }
  }, [userAddress, checkSubscription]);

  const value: WalletContextType = {
    isConnected,
    userAddress,
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
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;

