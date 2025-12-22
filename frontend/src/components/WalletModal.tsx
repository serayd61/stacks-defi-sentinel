import React from 'react';
import { useWallet, SUPPORTED_WALLETS, WalletType } from '../contexts/WalletContext';

const WalletModal: React.FC = () => {
  const { showWalletModal, setShowWalletModal, connectWallet, installedWallets } = useWallet();

  if (!showWalletModal) return null;

  const handleWalletSelect = (walletType: WalletType) => {
    connectWallet(walletType);
  };

  const handleClose = () => {
    setShowWalletModal(false);
  };

  return (
    <div className="wallet-modal-overlay" onClick={handleClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔗 Connect Wallet</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>
        
        <p className="modal-subtitle">Choose your preferred wallet to connect</p>
        
        <div className="wallet-list">
          {SUPPORTED_WALLETS.map((wallet) => {
            const isInstalled = installedWallets.includes(wallet.id);
            return (
              <button
                key={wallet.id}
                className={`wallet-option ${isInstalled ? 'installed' : 'not-installed'}`}
                onClick={() => handleWalletSelect(wallet.id)}
              >
                <span className="wallet-icon">{wallet.icon}</span>
                <div className="wallet-info">
                  <span className="wallet-name">{wallet.name}</span>
                  <span className="wallet-status">
                    {isInstalled ? '✅ Detected' : '📥 Install'}
                  </span>
                </div>
                <span className="arrow">→</span>
              </button>
            );
          })}
        </div>

        <div className="modal-footer">
          <p>Don't have a wallet?</p>
          <div className="install-links">
            <a 
              href="https://www.xverse.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="install-link xverse"
            >
              Get Xverse
            </a>
            <a 
              href="https://leather.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="install-link leather"
            >
              Get Leather
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
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .wallet-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 20px;
          padding: 28px;
          max-width: 420px;
          width: 90%;
          border: 1px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #fff;
        }

        .close-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #fff;
        }

        .modal-subtitle {
          color: #94a3b8;
          margin: 0 0 24px 0;
          font-size: 0.9rem;
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
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        }

        .wallet-option:hover {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateX(4px);
        }

        .wallet-option.installed {
          border-color: rgba(34, 197, 94, 0.3);
        }

        .wallet-option.installed:hover {
          border-color: rgba(34, 197, 94, 0.6);
        }

        .wallet-icon {
          font-size: 28px;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }

        .wallet-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .wallet-name {
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
        }

        .wallet-status {
          color: #64748b;
          font-size: 0.8rem;
        }

        .wallet-option.installed .wallet-status {
          color: #22c55e;
        }

        .arrow {
          color: #64748b;
          font-size: 1.2rem;
        }

        .modal-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
        }

        .modal-footer p {
          color: #64748b;
          font-size: 0.85rem;
          margin: 0 0 12px 0;
        }

        .install-links {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .install-link {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .install-link.xverse {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
        }

        .install-link.xverse:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .install-link.leather {
          background: linear-gradient(135deg, #92400e 0%, #78350f 100%);
          color: white;
        }

        .install-link.leather:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(146, 64, 14, 0.4);
        }
      `}</style>
    </div>
  );
};

export default WalletModal;

