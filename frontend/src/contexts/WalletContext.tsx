import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { connect, disconnect, isConnected, request, getLocalStorage, clearLocalStorage, WalletConnect } from '@stacks/connect';
import { STACKS_MAINNET } from '@stacks/network';
import { PostConditionMode } from '@stacks/transactions';

// Contract details
const CONTRACT_ADDRESS = 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB';
const CONTRACT_NAME = 'defi-sentinel';

// Reown/WalletConnect Project ID - Get yours at https://cloud.reown.com
const WALLETCONNECT_PROJECT_ID = 'c4f79cc821944d9680842e34466bfb';

// Supported wallets
export type WalletType = 'hiro' | 'xverse' | 'leather' | 'okx';

export const SUPPORTED_WALLETS = [
  { id: 'hiro' as WalletType, name: 'Hiro Wallet', icon: '🟠', installed: false },
  { id: 'xverse' as WalletType, name: 'Xverse', icon: '🔵', installed: false },
  { id: 'leather' as WalletType, name: 'Leather', icon: '🟤', installed: false },
  { id: 'okx' as WalletType, name: 'OKX Wallet', icon: '⚫', installed: false },
];

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
  const [walletConnected, setWalletConnected] = useState(false);
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

  // Check if already connected on mount using new API
  useEffect(() => {
    const checkConnection = () => {
      try {
        // Check localStorage for saved addresses
        const storage = getLocalStorage();
        console.log('Storage data:', storage);
        
        if (storage && storage.addresses) {
          // New format: { stx: [...], btc: [...] }
          const stxAddresses = storage.addresses.stx;
          if (stxAddresses && stxAddresses.length > 0) {
            setWalletConnected(true);
            setUserAddress(stxAddresses[0].address);
            console.log('Loaded STX address from storage:', stxAddresses[0].address);
            return;
          }
          
          // Fallback: check btc array for any STX-formatted address
          const btcAddresses = storage.addresses.btc;
          if (btcAddresses && btcAddresses.length > 0) {
            const stxAddr = btcAddresses.find((a: any) => 
              a.address.startsWith('SP') || a.address.startsWith('ST')
            );
            if (stxAddr) {
              setWalletConnected(true);
              setUserAddress(stxAddr.address);
              console.log('Found STX address in btc array:', stxAddr.address);
              return;
            }
          }
        }
        
        // Also check isConnected
        if (isConnected()) {
          setWalletConnected(true);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    };
    
    checkConnection();
  }, []);

  // Helper to check if address is STX format (starts with SP or ST)
  const isStxAddress = (address: string): boolean => {
    return address.startsWith('SP') || address.startsWith('ST');
  };

  // Connect wallet using new v8 API
  const connectWalletHandler = useCallback(async (_walletType?: WalletType) => {
    // Close modal if open
    setShowWalletModal(false);
    setIsLoading(true);

    try {
      // Use the new connect() function with WalletConnect/Reown support
      const result = await connect({
        forceWalletSelect: true, // Force wallet selection UI
        // Enable WalletConnect/Reown AppKit for mobile wallets
        walletConnect: {
          projectId: WALLETCONNECT_PROJECT_ID,
          metadata: {
            name: 'DeFi Sentinel',
            description: 'Real-time DeFi monitoring on Stacks blockchain',
            url: 'https://defi-sentinel.xyz',
            icons: ['https://defi-sentinel.xyz/favicon.svg'],
          },
          networks: [WalletConnect.Networks.Stacks],
        },
      });
      
      console.log('Connect result:', result);
      console.log('All addresses:', JSON.stringify(result.addresses, null, 2));
      
      if (result && result.addresses && result.addresses.length > 0) {
        // Method 1: Find by symbol
        let stxAddress = result.addresses.find(
          (addr) => addr.symbol === 'STX'
        );
        
        // Method 2: Find by address format (SP... or ST...)
        if (!stxAddress) {
          stxAddress = result.addresses.find(
            (addr) => isStxAddress(addr.address)
          );
        }
        
        // Method 3: Check type field
        if (!stxAddress) {
          stxAddress = result.addresses.find(
            (addr) => (addr as any).type === 'stacks' || (addr as any).type === 'stx'
          );
        }
        
        if (stxAddress) {
          setWalletConnected(true);
          setUserAddress(stxAddress.address);
          console.log('STX Wallet connected:', stxAddress.address);
        } else {
          // Last fallback: find any SP/ST address in the list
          const anyStxAddr = result.addresses.find(addr => isStxAddress(addr.address));
          if (anyStxAddr) {
            setWalletConnected(true);
            setUserAddress(anyStxAddr.address);
            console.log('STX Wallet connected (format check):', anyStxAddr.address);
          } else {
            // If still no STX address, log all and use first
            console.warn('No STX address found, using first address');
            console.log('Available addresses:', result.addresses.map(a => ({ address: a.address, symbol: a.symbol })));
            setWalletConnected(true);
            setUserAddress(result.addresses[0].address);
          }
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      // User might have cancelled
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Wrapper that shows modal first (for backward compatibility)
  const connectWallet = useCallback(async (walletType?: WalletType) => {
    if (!walletType) {
      // If no wallet type, connect directly (new UI handles selection)
      await connectWalletHandler();
    } else {
      setSelectedWallet(walletType);
      await connectWalletHandler(walletType);
    }
  }, [connectWalletHandler]);

  // Disconnect wallet using new API
  const disconnectWallet = useCallback(() => {
    try {
      disconnect();
      clearLocalStorage();
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
    setWalletConnected(false);
    setUserAddress(null);
    setIsSubscribed(false);
    setSubscriptionTier('none');
    setSelectedWallet(null);
  }, []);

  // Subscribe to basic plan
  const subscribeBasic = useCallback(async () => {
    if (!userAddress) return;
    
    setIsLoading(true);
    
    try {
      // Use the new request API for contract calls with WalletConnect support
      const result = await request({
        walletConnect: {
          projectId: WALLETCONNECT_PROJECT_ID,
        },
      }, 'stx_callContract', {
        contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        functionName: 'subscribe',
        functionArgs: [],
        postConditionMode: 'allow' as any,
        network: 'mainnet',
      });
      
      console.log('Subscribe TX:', result);
      setIsSubscribed(true);
      setSubscriptionTier('basic');
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
      const result = await request({
        walletConnect: {
          projectId: WALLETCONNECT_PROJECT_ID,
        },
      }, 'stx_callContract', {
        contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        functionName: 'subscribe-premium',
        functionArgs: [],
        postConditionMode: 'allow' as any,
        network: 'mainnet',
      });
      
      console.log('Premium Subscribe TX:', result);
      setIsSubscribed(true);
      setSubscriptionTier('premium');
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
    isConnected: walletConnected,
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
