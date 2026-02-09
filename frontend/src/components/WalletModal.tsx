import React from 'react';
import { useWallet, WalletType } from '../contexts/WalletContext';

// Wallet configurations with logos
const WALLETS: { id: WalletType; name: string; icon: string; color: string; downloadUrl: string }[] = [
  {
    id: 'leather',
    name: 'Leather',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iIzEyMTAwRCIvPjxwYXRoIGQ9Ik0xNiAxNkgzMlYzMkgxNlYxNloiIGZpbGw9IiNGNUY1RjQiLz48cGF0aCBkPSJNMjAgMjBIMjhWMjhIMjBWMjBaIiBmaWxsPSIjMTIxMDBEIi8+PC9zdmc+',
    color: '#12100D',
    downloadUrl: 'https://leather.io/install-extension',
  },
  {
    id: 'xverse',
    name: 'Xverse',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iIzFFMjkzQiIvPjxwYXRoIGQ9Ik0xNCAzMkwyNCAyMEwzNCAzMkgxNFoiIGZpbGw9IiNFRTcyNDIiLz48cGF0aCBkPSJNMTggMTZIMzBWMjBIMThWMTZaIiBmaWxsPSIjRUU3MjQyIi8+PC9zdmc+',
    color: '#EE7242',
    downloadUrl: 'https://www.xverse.app/download',
  },
  {
    id: 'hiro',
    name: 'Hiro Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iI0ZGNTUwMCIvPjxwYXRoIGQ9Ik0xNCAxNEgyMlYzNEgxNFYxNFoiIGZpbGw9IndoaXRlIi8+PHBhdGggZD0iTTI2IDE0SDM0VjM0SDI2VjE0WiIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNMjIgMjJIMjZWMjZIMjJWMjJaIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
    color: '#FF5500',
    downloadUrl: 'https://wallet.hiro.so/',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxOSIgeT0iMTkiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIyOCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxMCIgeT0iMjgiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIyOCIgeT0iMjgiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
    color: '#000000',
    downloadUrl: 'https://www.okx.com/web3',
  },
  {
    id: 'asigna',
    name: 'Asigna',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMiIgZmlsbD0iIzZCNDZDMSIvPjxwYXRoIGQ9Ik0yNCAxMkwzNCAzNkgxNEwyNCAxMloiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
    color: '#6B46C1',
    downloadUrl: 'https://asigna.io/',
  },
  {
    id: 'orange',
    name: 'Orange Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iI0Y5NzMxNiIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjEyIiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjYiIGZpbGw9IiNGOTczMTYiLz48L3N2Zz4=',
    color: '#F97316',
    downloadUrl: 'https://orangecrypto.com/',
  },
];

const WalletModal: React.FC = () => {
  const { showWalletModal, setShowWalletModal, connectWallet, installedWallets } = useWallet();

  if (!showWalletModal) return null;

  const handleWalletSelect = (walletId: WalletType, isInstalled: boolean, downloadUrl: string) => {
    if (isInstalled) {
      connectWallet(walletId);
    } else {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleClose = () => {
    setShowWalletModal(false);
  };

  return (
    <div className="wallet-modal-overlay" onClick={handleClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <div className="stacks-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#5546FF"/>
                <path d="M2 17L12 22L22 17" stroke="#5546FF" strokeWidth="2"/>
                <path d="M2 12L12 17L22 12" stroke="#5546FF" strokeWidth="2"/>
              </svg>
            </div>
            <h2>Connect to Stacks</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        
        <p className="modal-subtitle">Select your wallet to connect to DeFi Sentinel</p>
        
        <div className="wallet-list">
          {WALLETS.map((wallet) => {
            const isInstalled = installedWallets.includes(wallet.id);
            return (
              <button
                key={wallet.id}
                className={`wallet-option ${isInstalled ? 'installed' : 'not-installed'}`}
                onClick={() => handleWalletSelect(wallet.id, isInstalled, wallet.downloadUrl)}
                style={{ '--wallet-color': wallet.color } as React.CSSProperties}
              >
                <img 
                  src={wallet.icon} 
                  alt={wallet.name}
                  className="wallet-logo"
                />
                <div className="wallet-info">
                  <span className="wallet-name">{wallet.name}</span>
                  <span className={`wallet-status ${isInstalled ? 'detected' : ''}`}>
                    {isInstalled ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Detected
                      </>
                    ) : (
                      'Click to install'
                    )}
                  </span>
                </div>
                <span className="arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
            );
          })}
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>New to Stacks? We recommend <strong>Leather</strong> or <strong>Xverse</strong></span>
          </div>
        </div>
      </div>

      <style>{`
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

        .wallet-modal {
          background: linear-gradient(180deg, #1a1a24 0%, #13131a 100%);
          border-radius: 24px;
          max-width: 440px;
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6);
          animation: slideUp 0.2s ease;
          overflow: hidden;
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(16px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stacks-logo {
          width: 40px;
          height: 40px;
          background: rgba(85, 70, 255, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #fff;
          font-weight: 600;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 8px;
          border-radius: 10px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-subtitle {
          color: #94a3b8;
          margin: 0;
          padding: 16px 24px 8px;
          font-size: 0.9rem;
        }

        .wallet-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 16px;
          max-height: 360px;
          overflow-y: auto;
        }

        .wallet-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
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

        .wallet-option.installed {
          border-color: rgba(34, 197, 94, 0.15);
        }

        .wallet-option.installed:hover {
          border-color: rgba(34, 197, 94, 0.4);
        }

        .wallet-logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .wallet-name {
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
        }

        .wallet-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: #f59e0b;
        }

        .wallet-status.detected {
          color: #22c55e;
        }

        .arrow {
          color: #64748b;
          transition: all 0.2s;
        }

        .wallet-option:hover .arrow {
          transform: translateX(4px);
          color: #fff;
        }

        .modal-footer {
          padding: 16px 24px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .footer-info {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #64748b;
          font-size: 0.85rem;
        }

        .footer-info strong {
          color: #94a3b8;
        }

        /* Scrollbar styling */
        .wallet-list::-webkit-scrollbar {
          width: 6px;
        }

        .wallet-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .wallet-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .wallet-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default WalletModal;
