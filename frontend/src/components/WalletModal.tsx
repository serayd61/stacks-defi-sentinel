import React from 'react';
import { useWallet, WalletType } from '../contexts/WalletContext';

// Wallet logos as base64 SVG
const WALLET_LOGOS: Record<WalletType, string> = {
  hiro: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkY1NTAwIi8+PHBhdGggZD0iTTEyIDEyaDZ2MTZoLTZWMTJ6bTEwIDBoNnYxNmgtNlYxMnoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=`,
  xverse: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSIyMCIgZmlsbD0iIzFEQThGRiIvPjxwYXRoIGQ9Ik0xMiAyOGw4LTE2IDggMTZIMTJ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+`,
  leather: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjQzI4QjZBIi8+PHBhdGggZD0iTTEwIDEwaDIwdjIwSDEwVjEweiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjMiLz48cGF0aCBkPSJNMTQgMTRoMTJ2MTJIMTRWMTR6IiBmaWxsPSIjZmZmIi8+PC9zdmc+`,
  okx: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMDAwIi8+PHJlY3QgeD0iOCIgeT0iOCIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjI0IiB5PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iOCIgeT0iMjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIyNCIgeT0iMjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48L3N2Zz4=`,
};

const WALLET_INFO: Record<WalletType, { name: string; color: string }> = {
  hiro: { name: 'Hiro Wallet', color: '#FF5500' },
  xverse: { name: 'Xverse', color: '#1DA8FF' },
  leather: { name: 'Leather', color: '#C28B6A' },
  okx: { name: 'OKX Wallet', color: '#000000' },
};

const WalletModal: React.FC = () => {
  const { showWalletModal, setShowWalletModal, connectWallet, installedWallets } = useWallet();

  if (!showWalletModal) return null;

  const handleWalletSelect = (walletType: WalletType) => {
    console.log('Selected wallet:', walletType);
    connectWallet(walletType);
  };

  const handleClose = () => {
    setShowWalletModal(false);
  };

  const walletOrder: WalletType[] = ['xverse', 'leather', 'hiro', 'okx'];

  return (
    <div className="wallet-modal-overlay" onClick={handleClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔗 Connect Wallet</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        
        <p className="modal-subtitle">Choose your preferred wallet to connect</p>
        
        <div className="wallet-list">
          {walletOrder.map((walletId) => {
            const isInstalled = installedWallets.includes(walletId);
            const info = WALLET_INFO[walletId];
            return (
              <button
                key={walletId}
                className={`wallet-option ${isInstalled ? 'installed' : 'not-installed'}`}
                onClick={() => handleWalletSelect(walletId)}
                style={{ '--wallet-color': info.color } as React.CSSProperties}
              >
                <img 
                  src={WALLET_LOGOS[walletId]} 
                  alt={info.name}
                  className="wallet-logo"
                />
                <div className="wallet-info">
                  <span className="wallet-name">{info.name}</span>
                  <span className="wallet-status">
                    {isInstalled ? '✓ Detected' : 'Not installed'}
                  </span>
                </div>
                <span className="arrow">→</span>
              </button>
            );
          })}
        </div>

        <div className="modal-footer">
          <p>Don't have a wallet? Get one below:</p>
          <div className="install-links">
            <a 
              href="https://www.xverse.app/download" 
              target="_blank" 
              rel="noopener noreferrer"
              className="install-link xverse"
            >
              <img src={WALLET_LOGOS.xverse} alt="Xverse" width="20" height="20" />
              Xverse
            </a>
            <a 
              href="https://leather.io/install-extension" 
              target="_blank" 
              rel="noopener noreferrer"
              className="install-link leather"
            >
              <img src={WALLET_LOGOS.leather} alt="Leather" width="20" height="20" />
              Leather
            </a>
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
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .wallet-modal {
          background: linear-gradient(145deg, #1e1e2f 0%, #151520 100%);
          border-radius: 24px;
          padding: 32px;
          max-width: 440px;
          width: 92%;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
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
          margin-bottom: 8px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.6rem;
          color: #fff;
          font-weight: 600;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: #64748b;
          font-size: 24px;
          cursor: pointer;
          padding: 4px 12px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-subtitle {
          color: #94a3b8;
          margin: 0 0 28px 0;
          font-size: 0.95rem;
        }

        .wallet-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wallet-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: left;
          width: 100%;
        }

        .wallet-option:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--wallet-color, rgba(99, 102, 241, 0.4));
          transform: translateX(4px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .wallet-option.installed {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .wallet-option.installed:hover {
          border-color: rgba(34, 197, 94, 0.5);
        }

        .wallet-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .wallet-name {
          color: #fff;
          font-weight: 600;
          font-size: 1.05rem;
        }

        .wallet-status {
          font-size: 0.8rem;
          color: #64748b;
        }

        .wallet-option.installed .wallet-status {
          color: #22c55e;
        }

        .wallet-option.not-installed .wallet-status {
          color: #f59e0b;
        }

        .arrow {
          color: #64748b;
          font-size: 1.3rem;
          transition: transform 0.2s;
        }

        .wallet-option:hover .arrow {
          transform: translateX(4px);
          color: #fff;
        }

        .modal-footer {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          text-align: center;
        }

        .modal-footer p {
          color: #64748b;
          font-size: 0.85rem;
          margin: 0 0 16px 0;
        }

        .install-links {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .install-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.25s ease;
        }

        .install-link img {
          border-radius: 4px;
        }

        .install-link.xverse {
          background: linear-gradient(135deg, #1DA8FF 0%, #0088DD 100%);
          color: white;
        }

        .install-link.xverse:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(29, 168, 255, 0.35);
        }

        .install-link.leather {
          background: linear-gradient(135deg, #C28B6A 0%, #9A6B4A 100%);
          color: white;
        }

        .install-link.leather:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(194, 139, 106, 0.35);
        }
      `}</style>
    </div>
  );
};

export default WalletModal;
