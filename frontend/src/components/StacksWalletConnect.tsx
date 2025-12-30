import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppConfig, 
  UserSession, 
  showConnect, 
  disconnect,
  openSTXTransfer,
  openContractCall,
  openSignatureRequestPopup
} from '@stacks/connect';
import { 
  stringUtf8CV,
  uintCV,
  PostConditionMode
} from '@stacks/transactions';

// Week 3 Builder Challenge - Full WalletConnect Integration for Stacks
// Features: Connect, Transfer, Contract Call, Sign Message

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  network: string;
}

type ModalType = 'none' | 'transfer' | 'contract' | 'sign';

export const StacksWalletConnect: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    network: 'mainnet'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Transfer form state
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  
  // Sign message state
  const [messageToSign, setMessageToSign] = useState('');

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      const address = userData.profile.stxAddress?.mainnet || userData.profile.stxAddress?.testnet;
      setWallet({
        isConnected: true,
        address: address,
        balance: null,
        network: 'mainnet'
      });
      if (address) {
        fetchBalance(address);
      }
    }
  }, []);

  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${address}/balances`);
      const data = await response.json();
      const stxBalance = (parseInt(data.stx.balance) / 1000000).toFixed(2);
      setWallet(prev => ({ ...prev, balance: stxBalance }));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleConnect = useCallback(() => {
    setIsLoading(true);
    
    showConnect({
      appDetails: {
        name: 'DeFi Sentinel',
        icon: 'https://defi-sentinel.xyz/favicon.ico',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        const address = userData.profile.stxAddress?.mainnet;
        setWallet({
          isConnected: true,
          address: address,
          balance: null,
          network: 'mainnet'
        });
        if (address) {
          fetchBalance(address);
        }
        setIsLoading(false);
      },
      onCancel: () => {
        setIsLoading(false);
      },
      userSession,
    });
  }, []);

  const handleDisconnect = () => {
    disconnect();
    userSession.signUserOut();
    setWallet({
      isConnected: false,
      address: null,
      balance: null,
      network: 'mainnet'
    });
    setShowDropdown(false);
  };

  // STX Transfer Function
  const handleTransfer = async () => {
    if (!transferTo || !transferAmount || !wallet.address) return;
    
    setTxStatus('pending');
    
    try {
      const amountInMicroSTX = Math.floor(parseFloat(transferAmount) * 1000000);
      
      await openSTXTransfer({
        recipient: transferTo,
        amount: amountInMicroSTX.toString(),
        memo: 'DeFi Sentinel Transfer',
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.ico',
        },
        onFinish: (data) => {
          console.log('Transfer successful:', data);
          setTxStatus('success');
          setActiveModal('none');
          setTransferTo('');
          setTransferAmount('');
          // Refresh balance
          if (wallet.address) fetchBalance(wallet.address);
        },
        onCancel: () => {
          setTxStatus(null);
        },
      });
    } catch (error) {
      console.error('Transfer failed:', error);
      setTxStatus('error');
    }
  };

  // Contract Call Function - Example: Vote on DAO
  const handleContractCall = async () => {
    if (!wallet.address) return;
    
    setTxStatus('pending');
    
    try {
      await openContractCall({
        contractAddress: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
        contractName: 'voting-dao',
        functionName: 'vote',
        functionArgs: [
          uintCV(1), // proposal_id
          stringUtf8CV('yes') // vote
        ],
        postConditionMode: PostConditionMode.Allow,
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.ico',
        },
        onFinish: (data) => {
          console.log('Contract call successful:', data);
          setTxStatus('success');
          setActiveModal('none');
        },
        onCancel: () => {
          setTxStatus(null);
        },
      });
    } catch (error) {
      console.error('Contract call failed:', error);
      setTxStatus('error');
    }
  };

  // Sign Message Function
  const handleSignMessage = async () => {
    if (!messageToSign || !wallet.address) return;
    
    setTxStatus('pending');
    
    try {
      await openSignatureRequestPopup({
        message: messageToSign,
        network: 'mainnet',
        appDetails: {
          name: 'DeFi Sentinel',
          icon: 'https://defi-sentinel.xyz/favicon.ico',
        },
        onFinish: (data: { signature: string; publicKey: string }) => {
          console.log('Message signed:', data);
          setTxStatus('success');
          setActiveModal('none');
          setMessageToSign('');
          alert(`İmza başarılı!\nPublic Key: ${data.publicKey.slice(0, 20)}...`);
        },
        onCancel: () => {
          setTxStatus(null);
        },
      });
    } catch (error) {
      console.error('Signing failed:', error);
      setTxStatus('error');
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
    }
  };

  return (
    <div className="stacks-wallet-connect">
      {!wallet.isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="connect-btn"
        >
          {isLoading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6.5C3 5.11929 4.11929 4 5.5 4H18.5C19.8807 4 21 5.11929 21 6.5V17.5C21 18.8807 19.8807 20 18.5 20H5.5C4.11929 20 3 18.8807 3 17.5V6.5Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 12C16 13.1046 15.1046 14 14 14C12.8954 14 12 13.1046 12 12C12 10.8954 12.8954 10 14 10C15.1046 10 16 10.8954 16 12Z" fill="currentColor"/>
                <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Cüzdan Bağla
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
                <circle cx="12" cy="12" r="10" fill="#FC6432"/>
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
                  <span className="network-dot"></span>
                  Stacks Mainnet
                </span>
              </div>
              
              <div className="dropdown-address">
                <span>{wallet.address}</span>
                <button onClick={copyAddress} className="copy-btn" title="Adresi kopyala">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="dropdown-quick-actions">
                <button 
                  onClick={() => { setActiveModal('transfer'); setShowDropdown(false); }}
                  className="quick-action-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Transfer
                </button>
                <button 
                  onClick={() => { setActiveModal('contract'); setShowDropdown(false); }}
                  className="quick-action-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Contract
                </button>
                <button 
                  onClick={() => { setActiveModal('sign'); setShowDropdown(false); }}
                  className="quick-action-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M15.2322 5.23223L18.7678 8.76777M16.7322 3.73223C17.7085 2.75592 19.2915 2.75592 20.2678 3.73223C21.2441 4.70854 21.2441 6.29146 20.2678 7.26777L6.5 21.0355H3V17.4644L16.7322 3.73223Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  İmzala
                </button>
              </div>

              <div className="dropdown-divider"></div>

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
                  Explorer'da Görüntüle
                </a>

                <button onClick={handleDisconnect} className="dropdown-action disconnect">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Bağlantıyı Kes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transfer Modal */}
      {activeModal === 'transfer' && (
        <div className="modal-overlay" onClick={() => setActiveModal('none')}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>STX Transfer</h3>
              <button onClick={() => setActiveModal('none')} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Alıcı Adresi</label>
                <input 
                  type="text" 
                  placeholder="SP... veya SM..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Miktar (STX)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
                <span className="balance-hint">Bakiye: {wallet.balance} STX</span>
              </div>
              <button 
                onClick={handleTransfer}
                disabled={!transferTo || !transferAmount || txStatus === 'pending'}
                className="modal-submit-btn"
              >
                {txStatus === 'pending' ? (
                  <span className="loading-spinner small"></span>
                ) : (
                  'Transfer Gönder'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Call Modal */}
      {activeModal === 'contract' && (
        <div className="modal-overlay" onClick={() => setActiveModal('none')}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contract Call</h3>
              <button onClick={() => setActiveModal('none')} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="contract-info">
                <div className="contract-detail">
                  <span className="label">Contract:</span>
                  <span className="value">voting-dao</span>
                </div>
                <div className="contract-detail">
                  <span className="label">Function:</span>
                  <span className="value">vote</span>
                </div>
                <div className="contract-detail">
                  <span className="label">Args:</span>
                  <span className="value">proposal_id: 1, vote: "yes"</span>
                </div>
              </div>
              <button 
                onClick={handleContractCall}
                disabled={txStatus === 'pending'}
                className="modal-submit-btn"
              >
                {txStatus === 'pending' ? (
                  <span className="loading-spinner small"></span>
                ) : (
                  'Execute Contract'
                )}
              </button>
              <p className="modal-hint">Bu işlem DAO oylamasına katılmanızı sağlar.</p>
            </div>
          </div>
        </div>
      )}

      {/* Sign Message Modal */}
      {activeModal === 'sign' && (
        <div className="modal-overlay" onClick={() => setActiveModal('none')}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mesaj İmzala</h3>
              <button onClick={() => setActiveModal('none')} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>İmzalanacak Mesaj</label>
                <textarea 
                  placeholder="Mesajınızı girin..."
                  value={messageToSign}
                  onChange={(e) => setMessageToSign(e.target.value)}
                  rows={4}
                />
              </div>
              <button 
                onClick={handleSignMessage}
                disabled={!messageToSign || txStatus === 'pending'}
                className="modal-submit-btn"
              >
                {txStatus === 'pending' ? (
                  <span className="loading-spinner small"></span>
                ) : (
                  'İmzala'
                )}
              </button>
              <p className="modal-hint">Bu işlem hiçbir token transferi yapmaz, sadece mesajı imzalar.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .stacks-wallet-connect {
          position: relative;
          font-family: 'Space Grotesk', sans-serif;
        }

        .connect-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #FC6432 0%, #FF8C5A 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(252, 100, 50, 0.3);
        }

        .connect-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(252, 100, 50, 0.4);
        }

        .connect-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-spinner.small {
          width: 16px;
          height: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .wallet-info-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(252, 100, 50, 0.1);
          border: 1px solid rgba(252, 100, 50, 0.3);
          border-radius: 12px;
          color: #FC6432;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .wallet-info-btn:hover {
          background: rgba(252, 100, 50, 0.15);
          border-color: rgba(252, 100, 50, 0.5);
        }

        .wallet-avatar {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #FC6432 0%, #FF8C5A 100%);
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
          font-size: 14px;
        }

        .wallet-balance {
          font-size: 12px;
          opacity: 0.8;
        }

        .dropdown-arrow {
          transition: transform 0.3s ease;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .wallet-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          width: 320px;
          background: #1a1a2e;
          border: 1px solid rgba(252, 100, 50, 0.2);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          z-index: 100;
          animation: dropdownFade 0.2s ease;
        }

        @keyframes dropdownFade {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-header {
          margin-bottom: 12px;
        }

        .network-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 20px;
          font-size: 12px;
          color: #10B981;
        }

        .network-dot {
          width: 8px;
          height: 8px;
          background: #10B981;
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
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 11px;
          color: rgba(255,255,255,0.7);
          word-break: break-all;
        }

        .copy-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
          flex-shrink: 0;
        }

        .copy-btn:hover {
          color: #FC6432;
        }

        .dropdown-quick-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .quick-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          background: rgba(252, 100, 50, 0.1);
          border: 1px solid rgba(252, 100, 50, 0.2);
          border-radius: 12px;
          color: #FC6432;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-action-btn:hover {
          background: rgba(252, 100, 50, 0.2);
          border-color: rgba(252, 100, 50, 0.4);
          transform: translateY(-2px);
        }

        .dropdown-divider {
          height: 1px;
          background: rgba(255,255,255,0.1);
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
          padding: 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .dropdown-action:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }

        .dropdown-action.disconnect {
          color: #EF4444;
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
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          width: 100%;
          max-width: 420px;
          background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
          border: 1px solid rgba(252, 100, 50, 0.2);
          border-radius: 24px;
          overflow: hidden;
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
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
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
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: white;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #FC6432;
          background: rgba(252, 100, 50, 0.05);
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: rgba(255,255,255,0.3);
        }

        .balance-hint {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .modal-submit-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #FC6432 0%, #FF8C5A 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .modal-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(252, 100, 50, 0.4);
        }

        .modal-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-hint {
          margin-top: 16px;
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          text-align: center;
        }

        .contract-info {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .contract-detail {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .contract-detail:last-child {
          border-bottom: none;
        }

        .contract-detail .label {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }

        .contract-detail .value {
          font-size: 13px;
          color: #FC6432;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};

export default StacksWalletConnect;
