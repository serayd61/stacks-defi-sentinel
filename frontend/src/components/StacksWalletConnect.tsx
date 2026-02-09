import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppConfig, 
  UserSession, 
  showConnect,
  disconnect as stacksDisconnect,
} from '@stacks/connect';

// Wallet Types
type WalletType = 'leather' | 'xverse' | 'hiro' | 'okx' | 'asigna' | 'orange';

interface WalletInfo {
  id: WalletType;
  name: string;
  icon: string;
  color: string;
  downloadUrl: string;
  description: string;
}

// Wallet configurations - StackPay style
const WALLETS: WalletInfo[] = [
  {
    id: 'leather',
    name: 'Leather',
    icon: 'https://leather.io/leather-logo.svg',
    color: '#12100D',
    downloadUrl: 'https://leather.io/install-extension',
    description: 'Most popular Stacks wallet',
  },
  {
    id: 'xverse',
    name: 'Xverse',
    icon: 'https://www.xverse.app/assets/xverse-logo.svg',
    color: '#EE7242',
    downloadUrl: 'https://www.xverse.app/download',
    description: 'Bitcoin & Stacks wallet',
  },
  {
    id: 'hiro',
    name: 'Hiro Wallet',
    icon: 'https://wallet.hiro.so/hiro-wallet-logo.svg',
    color: '#FF5500',
    downloadUrl: 'https://wallet.hiro.so/',
    description: 'Developer-focused wallet',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: 'https://static.okx.com/cdn/assets/imgs/226/8AB3CAE2F5E0F8F6.png',
    color: '#000000',
    downloadUrl: 'https://www.okx.com/web3',
    description: 'Multi-chain wallet',
  },
];

// App config for Stacks Connect - StackPay style
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

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

// Get detected wallet info
const getDetectedWallet = (): string | null => {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  
  if (win.LeatherProvider || (win.StacksProvider && !win.XverseProviders)) {
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

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

const StacksWalletConnect: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    isLoading: false,
    error: null,
  });
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  // Check for existing session and providers
  useEffect(() => {
    const checkSession = () => {
      // Check providers
      const providerAvailable = hasStacksProvider();
      setHasProvider(providerAvailable);
      setDetectedWallet(getDetectedWallet());
      
      console.log('=== Wallet Provider Check ===');
      console.log('Provider available:', providerAvailable);
      console.log('Detected wallet:', getDetectedWallet());
      
      // Check existing session
      if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        const address = userData.profile?.stxAddress?.mainnet || 
                       userData.profile?.stxAddress?.testnet ||
                       null;
        
        if (address) {
          setWalletState(prev => ({
            ...prev,
            isConnected: true,
            address,
          }));
          fetchBalance(address);
        }
      }
    };

    checkSession();
    
    // Recheck after delays (wallets inject at different times)
    const t1 = setTimeout(checkSession, 500);
    const t2 = setTimeout(checkSession, 1500);
    const t3 = setTimeout(checkSession, 3000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Fetch STX balance
  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(
        `https://api.hiro.so/extended/v1/address/${address}/balances`
      );
      if (response.ok) {
        const data = await response.json();
        const stxBalance = (parseInt(data.stx?.balance || '0') / 1_000_000).toFixed(2);
        setWalletState(prev => ({ ...prev, balance: stxBalance }));
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  // Connect wallet - StackPay style using showConnect
  const connectWallet = useCallback(() => {
    setWalletState(prev => ({ ...prev, isLoading: true, error: null }));
    setShowModal(false);

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
          setWalletState({
            isConnected: true,
            address,
            balance: null,
            isLoading: false,
            error: null,
          });
          fetchBalance(address);
        }
      },
      onCancel: () => {
        setWalletState(prev => ({ 
          ...prev, 
          isLoading: false,
          error: 'Connection cancelled'
        }));
      },
      userSession,
    });
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    stacksDisconnect();
    userSession.signUserOut();
    setWalletState({
      isConnected: false,
      address: null,
      balance: null,
      isLoading: false,
      error: null,
    });
    setShowDropdown(false);
  }, []);

  // Copy address to clipboard
  const copyAddress = () => {
    if (walletState.address) {
      navigator.clipboard.writeText(walletState.address);
      setShowDropdown(false);
    }
  };

  // View on explorer
  const viewOnExplorer = () => {
    if (walletState.address) {
      window.open(`https://explorer.hiro.so/address/${walletState.address}?chain=mainnet`, '_blank');
      setShowDropdown(false);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Refresh provider detection
  const refreshDetection = () => {
    setHasProvider(hasStacksProvider());
    setDetectedWallet(getDetectedWallet());
  };

  return (
    <>
      {/* Main Button */}
      {walletState.isConnected ? (
        <div className="wallet-connected-container">
          <button 
            className="wallet-connected-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="wallet-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 14C16 14.5523 15.5523 15 15 15C14.4477 15 14 14.5523 14 14C14 13.4477 14.4477 13 15 13C15.5523 13 16 13.4477 16 14Z" fill="currentColor"/>
                <path d="M3 9L12 4L21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="wallet-info">
              <span className="wallet-address">{formatAddress(walletState.address!)}</span>
              {walletState.balance && (
                <span className="wallet-balance">{walletState.balance} STX</span>
              )}
            </div>
            <svg className={`dropdown-arrow ${showDropdown ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="wallet-dropdown">
              <button onClick={copyAddress}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Copy Address
              </button>
              <button onClick={viewOnExplorer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View on Explorer
              </button>
              <div className="dropdown-divider"></div>
              <button onClick={disconnectWallet} className="disconnect-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        <button 
          className="connect-wallet-btn"
          onClick={() => setShowModal(true)}
          disabled={walletState.isLoading}
        >
          {walletState.isLoading ? (
            <>
              <div className="spinner"></div>
              Connecting...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M19 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 14C16 14.5523 15.5523 15 15 15C14.4477 15 14 14.5523 14 14C14 13.4477 14.4477 13 15 13C15.5523 13 16 13.4477 16 14Z" fill="currentColor"/>
                <path d="M3 9L12 4L21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      )}

      {/* Wallet Selection Modal - StackPay Style */}
      {showModal && (
        <div className="wallet-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="wallet-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div className="header-left">
                <div className="stacks-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#5546FF"/>
                    <path d="M2 17L12 22L22 17" stroke="#5546FF" strokeWidth="2"/>
                    <path d="M2 12L12 17L22 12" stroke="#5546FF" strokeWidth="2"/>
                  </svg>
                </div>
                <div>
                  <h2>Connect to Stacks</h2>
                  <p className="header-subtitle">Select your preferred wallet</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Provider Status */}
            <div className={`provider-status ${hasProvider ? 'detected' : 'not-detected'}`}>
              <div className="status-icon">
                {hasProvider ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <span>
                {hasProvider 
                  ? `${detectedWallet || 'Stacks Wallet'} detected` 
                  : 'No wallet detected - Install one below'}
              </span>
              <button className="refresh-btn" onClick={refreshDetection} title="Refresh detection">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M21 3V8H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Wallet List */}
            <div className="wallet-list">
              {WALLETS.map((wallet) => (
                <button
                  key={wallet.id}
                  className="wallet-option"
                  onClick={() => hasProvider ? connectWallet() : window.open(wallet.downloadUrl, '_blank')}
                  style={{ '--wallet-color': wallet.color } as React.CSSProperties}
                >
                  <div className="wallet-icon-wrapper">
                    <div className="wallet-icon" style={{ backgroundColor: wallet.color }}>
                      {wallet.id === 'leather' && (
                        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                          <rect width="48" height="48" rx="12" fill="#12100D"/>
                          <path d="M16 16H32V32H16V16Z" fill="#F5F5F4"/>
                          <path d="M20 20H28V28H20V20Z" fill="#12100D"/>
                        </svg>
                      )}
                      {wallet.id === 'xverse' && (
                        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                          <rect width="48" height="48" rx="24" fill="#1E293B"/>
                          <path d="M14 32L24 20L34 32H14Z" fill="#EE7242"/>
                          <path d="M18 16H30V20H18V16Z" fill="#EE7242"/>
                        </svg>
                      )}
                      {wallet.id === 'hiro' && (
                        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                          <rect width="48" height="48" rx="12" fill="#FF5500"/>
                          <path d="M14 14H22V34H14V14Z" fill="white"/>
                          <path d="M26 14H34V34H26V14Z" fill="white"/>
                          <path d="M22 22H26V26H22V22Z" fill="white"/>
                        </svg>
                      )}
                      {wallet.id === 'okx' && (
                        <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                          <rect width="48" height="48" rx="12" fill="black"/>
                          <rect x="10" y="10" width="10" height="10" fill="white"/>
                          <rect x="19" y="19" width="10" height="10" fill="white"/>
                          <rect x="28" y="10" width="10" height="10" fill="white"/>
                          <rect x="10" y="28" width="10" height="10" fill="white"/>
                          <rect x="28" y="28" width="10" height="10" fill="white"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="wallet-details">
                    <span className="wallet-name">{wallet.name}</span>
                    <span className="wallet-desc">{wallet.description}</span>
                  </div>
                  <div className="wallet-action">
                    {hasProvider ? (
                      <span className="connect-text">Connect</span>
                    ) : (
                      <span className="install-text">Install</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <div className="footer-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>New to Stacks? We recommend <strong>Leather</strong> or <strong>Xverse</strong></span>
              </div>
              <a href="https://www.stacks.co/explore/discover-apps" target="_blank" rel="noopener noreferrer" className="learn-more">
                Learn more about Stacks wallets
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Connect Button */
        .connect-wallet-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #5546FF 0%, #7B68EE 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(85, 70, 255, 0.4);
        }

        .connect-wallet-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(85, 70, 255, 0.5);
        }

        .connect-wallet-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Connected State */
        .wallet-connected-container {
          position: relative;
        }

        .wallet-connected-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: white;
          padding: 8px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .wallet-connected-btn:hover {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.5);
        }

        .wallet-avatar {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wallet-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .wallet-address {
          font-weight: 600;
          font-size: 0.85rem;
        }

        .wallet-balance {
          font-size: 0.75rem;
          color: #22c55e;
        }

        .dropdown-arrow {
          transition: transform 0.2s;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        /* Dropdown */
        .wallet-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #1a1a24;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          min-width: 200px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          z-index: 100;
          overflow: hidden;
          animation: dropdownFade 0.15s ease;
        }

        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .wallet-dropdown button {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          color: #e2e8f0;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .wallet-dropdown button:hover {
          background: rgba(255,255,255,0.05);
        }

        .wallet-dropdown .disconnect-btn {
          color: #ef4444;
        }

        .wallet-dropdown .disconnect-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .dropdown-divider {
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 4px 0;
        }

        /* Modal Overlay */
        .wallet-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.15s ease;
          padding: 16px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Modal */
        .wallet-modal {
          background: linear-gradient(180deg, #1a1a24 0%, #13131a 100%);
          border-radius: 24px;
          max-width: 420px;
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6);
          animation: slideUp 0.2s ease;
          overflow: hidden;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .stacks-icon {
          width: 48px;
          height: 48px;
          background: rgba(85, 70, 255, 0.1);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.2rem;
          color: #fff;
          font-weight: 600;
        }

        .header-subtitle {
          margin: 2px 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 10px;
          border-radius: 10px;
          transition: all 0.2s;
          display: flex;
        }

        .close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* Provider Status */
        .provider-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.85rem;
        }

        .provider-status.detected {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .provider-status.not-detected {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .status-icon {
          display: flex;
        }

        .provider-status .refresh-btn {
          margin-left: auto;
          background: rgba(255,255,255,0.1);
          border: none;
          color: inherit;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          transition: all 0.2s;
        }

        .provider-status .refresh-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        /* Wallet List */
        .wallet-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 16px 16px;
        }

        .wallet-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        }

        .wallet-option:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--wallet-color, rgba(85, 70, 255, 0.4));
          transform: translateX(4px);
        }

        .wallet-icon-wrapper {
          flex-shrink: 0;
        }

        .wallet-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .wallet-icon svg {
          width: 44px;
          height: 44px;
        }

        .wallet-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wallet-name {
          color: #fff;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .wallet-desc {
          color: #64748b;
          font-size: 0.8rem;
        }

        .wallet-action {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #64748b;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .wallet-option:hover .wallet-action {
          color: #fff;
          transform: translateX(4px);
        }

        .connect-text {
          color: #22c55e;
        }

        .install-text {
          color: #f59e0b;
        }

        /* Footer */
        .modal-footer {
          padding: 16px 24px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-content {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #64748b;
          font-size: 0.85rem;
        }

        .footer-content strong {
          color: #94a3b8;
        }

        .learn-more {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #5546FF;
          font-size: 0.85rem;
          text-decoration: none;
          transition: color 0.2s;
        }

        .learn-more:hover {
          color: #7B68EE;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .wallet-modal {
            max-width: 100%;
            margin: 8px;
          }
          
          .modal-header {
            padding: 16px;
          }
          
          .wallet-list {
            padding: 0 12px 12px;
          }
        }
      `}</style>
    </>
  );
};

export default StacksWalletConnect;
