import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  checkInstalled: () => boolean;
}

// Wallet configurations with real logos
const WALLETS: WalletInfo[] = [
  {
    id: 'leather',
    name: 'Leather',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iIzEyMTAwRCIvPjxwYXRoIGQ9Ik0xNiAxNkgzMlYzMkgxNlYxNloiIGZpbGw9IiNGNUY1RjQiLz48cGF0aCBkPSJNMjAgMjBIMjhWMjhIMjBWMjBaIiBmaWxsPSIjMTIxMDBEIi8+PC9zdmc+',
    color: '#12100D',
    downloadUrl: 'https://leather.io/install-extension',
    checkInstalled: () => !!(window as any).LeatherProvider || !!(window as any).StacksProvider,
  },
  {
    id: 'xverse',
    name: 'Xverse',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iIzFFMjkzQiIvPjxwYXRoIGQ9Ik0xNCAzMkwyNCAyMEwzNCAzMkgxNFoiIGZpbGw9IiNFRTcyNDIiLz48cGF0aCBkPSJNMTggMTZIMzBWMjBIMThWMTZaIiBmaWxsPSIjRUU3MjQyIi8+PC9zdmc+',
    color: '#EE7242',
    downloadUrl: 'https://www.xverse.app/download',
    checkInstalled: () => !!(window as any).XverseProviders?.StacksProvider || !!(window as any).BitcoinProvider,
  },
  {
    id: 'hiro',
    name: 'Hiro Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iI0ZGNTUwMCIvPjxwYXRoIGQ9Ik0xNCAxNEgyMlYzNEgxNFYxNFoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI2IDE0SDM0VjM0SDI2VjE0WiIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNMjIgMjJIMjZWMjZIMjJWMjJaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
    color: '#FF5500',
    downloadUrl: 'https://wallet.hiro.so/',
    checkInstalled: () => !!(window as any).HiroWalletProvider,
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxOSIgeT0iMTkiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIyOCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxMCIgeT0iMjgiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIyOCIgeT0iMjgiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
    color: '#000000',
    downloadUrl: 'https://www.okx.com/web3',
    checkInstalled: () => !!(window as any).okxwallet?.stacks,
  },
  {
    id: 'asigna',
    name: 'Asigna',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iIzZCNDZDMSIvPjxwYXRoIGQ9Ik0yNCAxMkwzNCAzNkgxNEwyNCAxMloiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
    color: '#6B46C1',
    downloadUrl: 'https://asigna.io/',
    checkInstalled: () => !!(window as any).AsignaProvider,
  },
  {
    id: 'orange',
    name: 'Orange Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iI0Y5NzMxNiIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjEyIiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjYiIGZpbGw9IiNGOTczMTYiLz48L3N2Zz4=',
    color: '#F97316',
    downloadUrl: 'https://orangecrypto.com/',
    checkInstalled: () => !!(window as any).OrangeStacksProvider,
  },
];

// App config for Stacks Connect
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
}

export const StacksWalletConnect: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [installedWallets, setInstalledWallets] = useState<WalletType[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check installed wallets
  useEffect(() => {
    const checkWallets = () => {
      const installed = WALLETS.filter(w => w.checkInstalled()).map(w => w.id);
      setInstalledWallets(installed);
    };
    
    checkWallets();
    // Check again after a delay (some wallets inject late)
    const timer = setTimeout(checkWallets, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check if already connected
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      const address = userData.profile.stxAddress?.mainnet || userData.profile.stxAddress?.testnet;
      if (address) {
        setWallet({
          isConnected: true,
          address: address,
          balance: null,
        });
        fetchBalance(address);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${address}/balances`);
      const data = await response.json();
      const stxBalance = (parseInt(data.stx?.balance || '0') / 1_000_000).toFixed(2);
      setWallet(prev => ({ ...prev, balance: stxBalance }));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleConnect = useCallback(() => {
    setShowWalletModal(true);
  }, []);

  const connectWithWallet = useCallback(async (walletId: WalletType) => {
    setIsLoading(true);
    setShowWalletModal(false);

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
            setWallet({
              isConnected: true,
              address: address,
              balance: null,
            });
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
      console.error('Wallet connect error:', error);
      setIsLoading(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    try {
      stacksDisconnect();
      userSession.signUserOut();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    setWallet({
      isConnected: false,
      address: null,
      balance: null,
    });
    setShowDropdown(false);
  }, []);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="stacks-wallet-connect" ref={dropdownRef}>
      {!wallet.isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="connect-btn"
        >
          {isLoading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="16" cy="12" r="2" fill="currentColor"/>
                <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      ) : (
        <div className="wallet-connected">
          <button 
            className="wallet-info-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="wallet-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#5546FF"/>
                <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="wallet-details">
              <span className="wallet-address">{formatAddress(wallet.address!)}</span>
              {wallet.balance && (
                <span className="wallet-balance">{wallet.balance} STX</span>
              )}
            </div>
            <svg className={`dropdown-arrow ${showDropdown ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {showDropdown && (
            <div className="wallet-dropdown">
              <div className="dropdown-header">
                <span className="network-badge">
                  <span className="network-dot" />
                  Stacks Mainnet
                </span>
              </div>
              
              <div className="dropdown-address">
                <span>{wallet.address}</span>
                <button onClick={copyAddress} className="copy-btn" title="Copy address">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>

              <div className="dropdown-divider" />

              <div className="dropdown-actions">
                <a 
                  href={`https://explorer.hiro.so/address/${wallet.address}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dropdown-action"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11" stroke="currentColor" strokeWidth="2"/>
                    <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  View on Explorer
                </a>

                <button onClick={handleDisconnect} className="dropdown-action disconnect">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Connect Wallet</h3>
              <button onClick={() => setShowWalletModal(false)} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <p className="modal-subtitle">Choose your preferred Stacks wallet</p>
            
            <div className="wallet-list">
              {WALLETS.map((w) => {
                const isInstalled = installedWallets.includes(w.id);
                return (
                  <button
                    key={w.id}
                    className={`wallet-option ${isInstalled ? 'installed' : ''}`}
                    onClick={() => isInstalled ? connectWithWallet(w.id) : window.open(w.downloadUrl, '_blank')}
                    style={{ '--wallet-color': w.color } as React.CSSProperties}
                  >
                    <img src={w.icon} alt={w.name} className="wallet-logo" />
                    <div className="wallet-info">
                      <span className="wallet-name">{w.name}</span>
                      <span className={`wallet-status ${isInstalled ? 'detected' : 'not-installed'}`}>
                        {isInstalled ? '✓ Detected' : 'Click to install'}
                      </span>
                    </div>
                    <span className="arrow">→</span>
                  </button>
                );
              })}
            </div>

            <div className="modal-footer">
              <p>New to Stacks? We recommend</p>
              <div className="recommended-wallets">
                <a href="https://leather.io/install-extension" target="_blank" rel="noopener noreferrer" className="rec-wallet leather">
                  <img src={WALLETS[0].icon} alt="Leather" width="24" height="24" />
                  Leather
                </a>
                <a href="https://www.xverse.app/download" target="_blank" rel="noopener noreferrer" className="rec-wallet xverse">
                  <img src={WALLETS[1].icon} alt="Xverse" width="24" height="24" />
                  Xverse
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .stacks-wallet-connect {
          position: relative;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .connect-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #5546FF 0%, #7C3AED 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(85, 70, 255, 0.3);
        }

        .connect-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(85, 70, 255, 0.4);
        }

        .connect-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .wallet-info-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: rgba(85, 70, 255, 0.1);
          border: 1px solid rgba(85, 70, 255, 0.3);
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .wallet-info-btn:hover {
          background: rgba(85, 70, 255, 0.15);
          border-color: rgba(85, 70, 255, 0.5);
        }

        .wallet-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #5546FF 0%, #7C3AED 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wallet-details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .wallet-address {
          font-weight: 600;
          font-size: 13px;
          color: white;
        }

        .wallet-balance {
          font-size: 11px;
          color: rgba(255,255,255,0.6);
        }

        .dropdown-arrow {
          transition: transform 0.2s ease;
          color: rgba(255,255,255,0.6);
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .wallet-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          width: 300px;
          background: #13131a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          z-index: 100;
          animation: dropdownFade 0.15s ease;
        }

        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          margin-bottom: 12px;
        }

        .network-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 20px;
          font-size: 12px;
          color: #22c55e;
        }

        .network-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .dropdown-address {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          font-size: 10px;
          color: rgba(255,255,255,0.6);
          word-break: break-all;
        }

        .copy-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
          flex-shrink: 0;
        }

        .copy-btn:hover {
          color: #5546FF;
        }

        .dropdown-divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 12px 0;
        }

        .dropdown-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dropdown-action {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: rgba(255,255,255,0.8);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .dropdown-action:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }

        .dropdown-action.disconnect {
          color: #ef4444;
        }

        .dropdown-action.disconnect:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Modal Styles */
        .modal-overlay {
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
          backdrop-filter: blur(4px);
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          width: 100%;
          max-width: 420px;
          margin: 16px;
          background: linear-gradient(180deg, #1a1a24 0%, #13131a 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          overflow: hidden;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: white;
        }

        .modal-subtitle {
          padding: 0 24px;
          margin: 16px 0;
          color: rgba(255,255,255,0.5);
          font-size: 14px;
        }

        .wallet-list {
          padding: 0 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 320px;
          overflow-y: auto;
        }

        .wallet-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        }

        .wallet-option:hover {
          background: rgba(255,255,255,0.06);
          border-color: var(--wallet-color, rgba(85, 70, 255, 0.4));
          transform: translateX(2px);
        }

        .wallet-option.installed {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .wallet-option.installed:hover {
          border-color: rgba(34, 197, 94, 0.4);
        }

        .wallet-logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wallet-name {
          color: white;
          font-weight: 600;
          font-size: 15px;
        }

        .wallet-status {
          font-size: 12px;
        }

        .wallet-status.detected {
          color: #22c55e;
        }

        .wallet-status.not-installed {
          color: #f59e0b;
        }

        .arrow {
          color: rgba(255,255,255,0.3);
          font-size: 18px;
          transition: transform 0.2s;
        }

        .wallet-option:hover .arrow {
          transform: translateX(3px);
          color: rgba(255,255,255,0.6);
        }

        .modal-footer {
          padding: 16px 24px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }

        .modal-footer p {
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          margin: 0 0 12px;
        }

        .recommended-wallets {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .rec-wallet {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .rec-wallet img {
          border-radius: 6px;
        }

        .rec-wallet.leather {
          background: #12100D;
          color: white;
        }

        .rec-wallet.leather:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(18, 16, 13, 0.4);
        }

        .rec-wallet.xverse {
          background: linear-gradient(135deg, #EE7242 0%, #D65A2A 100%);
          color: white;
        }

        .rec-wallet.xverse:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(238, 114, 66, 0.4);
        }
      `}</style>
    </div>
  );
};

export default StacksWalletConnect;
