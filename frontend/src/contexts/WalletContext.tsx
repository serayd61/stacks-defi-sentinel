import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect';
import { STACKS_MAINNET } from '@stacks/network';
import {
  principalCV,
  PostConditionMode,
  Pc,
} from '@stacks/transactions';

// Contract details
const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'defi-sentinel';

// Subscription prices in microSTX
const BASIC_PRICE = 1_000_000; // 1 STX
const PREMIUM_PRICE = 2_500_000; // 2.5 STX

// App config
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface WalletContextType {
  // State
  isConnected: boolean;
  userAddress: string | null;
  isSubscribed: boolean;
  subscriptionTier: 'none' | 'basic' | 'premium';
  isLoading: boolean;
  
  // Actions
  connectWallet: () => void;
  disconnectWallet: () => void;
  subscribeBasic: () => Promise<void>;
  subscribePremium: () => Promise<void>;
  checkSubscription: () => Promise<void>;
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

  // Check if already connected on mount
  React.useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setIsConnected(true);
      setUserAddress(userData.profile.stxAddress.mainnet);
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(() => {
    showConnect({
      appDetails: {
        name: 'DeFi Sentinel',
        icon: 'https://stacks-defi-sentinel-production.up.railway.app/logo.png',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        setIsConnected(true);
        setUserAddress(userData.profile.stxAddress.mainnet);
      },
      userSession,
    });
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    userSession.signUserOut('/');
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
    connectWallet,
    disconnectWallet,
    subscribeBasic,
    subscribePremium,
    checkSubscription,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;

