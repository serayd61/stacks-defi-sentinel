import React, { useState, useEffect } from 'react';
import { Shield, Users, Send, Check, Clock, Plus, Trash2, RefreshCw } from 'lucide-react';

// Multi-Signature Wallet Component
// Allows multiple signers to approve transactions

interface Transaction {
  id: number;
  to: string;
  amount: number;
  memo: string;
  signatures: number;
  required: number;
  executed: boolean;
  createdAt: string;
}

interface Signer {
  address: string;
  name: string;
  hasSigned: boolean;
}

export const MultiSigWallet: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      to: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
      amount: 1000,
      memo: 'Development Fund',
      signatures: 2,
      required: 3,
      executed: false,
      createdAt: '2024-12-30T10:00:00Z'
    },
    {
      id: 2,
      to: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
      amount: 500,
      memo: 'Marketing Budget',
      signatures: 3,
      required: 3,
      executed: true,
      createdAt: '2024-12-29T15:30:00Z'
    }
  ]);

  const [signers, setSigners] = useState<Signer[]>([
    { address: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB', name: 'Admin', hasSigned: true },
    { address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', name: 'Treasury', hasSigned: true },
    { address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1', name: 'Dev Lead', hasSigned: false },
  ]);

  const [showNewTx, setShowNewTx] = useState(false);
  const [newTx, setNewTx] = useState({ to: '', amount: '', memo: '' });
  const [walletBalance, setWalletBalance] = useState(5000);
  const [requiredSigs, setRequiredSigs] = useState(2);

  const handleSign = (txId: number) => {
    setTransactions(prev => prev.map(tx => 
      tx.id === txId ? { ...tx, signatures: tx.signatures + 1 } : tx
    ));
  };

  const handleExecute = (txId: number) => {
    const tx = transactions.find(t => t.id === txId);
    if (tx && tx.signatures >= tx.required) {
      setTransactions(prev => prev.map(t => 
        t.id === txId ? { ...t, executed: true } : t
      ));
      setWalletBalance(prev => prev - tx.amount);
    }
  };

  const handleSubmitTx = () => {
    if (!newTx.to || !newTx.amount) return;
    
    const tx: Transaction = {
      id: transactions.length + 1,
      to: newTx.to,
      amount: parseFloat(newTx.amount),
      memo: newTx.memo,
      signatures: 1,
      required: requiredSigs,
      executed: false,
      createdAt: new Date().toISOString()
    };
    
    setTransactions(prev => [tx, ...prev]);
    setNewTx({ to: '', amount: '', memo: '' });
    setShowNewTx(false);
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <div className="multi-sig-wallet">
      {/* Header */}
      <div className="wallet-header">
        <div className="header-left">
          <div className="wallet-icon">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2>Multi-Sig Wallet</h2>
            <p className="subtitle">{requiredSigs} of {signers.length} signatures required</p>
          </div>
        </div>
        <div className="header-right">
          <div className="balance-card">
            <span className="balance-label">Wallet Balance</span>
            <span className="balance-value">{walletBalance.toLocaleString()} STX</span>
          </div>
        </div>
      </div>

      {/* Signers */}
      <div className="signers-section">
        <h3><Users className="w-4 h-4" /> Authorized Signers</h3>
        <div className="signers-grid">
          {signers.map((signer, index) => (
            <div key={index} className="signer-card">
              <div className="signer-avatar">{signer.name.charAt(0)}</div>
              <div className="signer-info">
                <span className="signer-name">{signer.name}</span>
                <span className="signer-address">{formatAddress(signer.address)}</span>
              </div>
              <div className={`signer-status ${signer.hasSigned ? 'signed' : 'pending'}`}>
                {signer.hasSigned ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Transaction Button */}
      <button 
        onClick={() => setShowNewTx(!showNewTx)}
        className="new-tx-btn"
      >
        <Plus className="w-5 h-5" />
        New Transaction
      </button>

      {/* New Transaction Form */}
      {showNewTx && (
        <div className="new-tx-form">
          <div className="form-group">
            <label>Recipient Address</label>
            <input 
              type="text"
              placeholder="SP..."
              value={newTx.to}
              onChange={(e) => setNewTx({ ...newTx, to: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount (STX)</label>
              <input 
                type="number"
                placeholder="0.00"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Memo</label>
              <input 
                type="text"
                placeholder="Description..."
                value={newTx.memo}
                onChange={(e) => setNewTx({ ...newTx, memo: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button onClick={() => setShowNewTx(false)} className="cancel-btn">Cancel</button>
            <button onClick={handleSubmitTx} className="submit-btn">Submit Transaction</button>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="transactions-section">
        <h3><Send className="w-4 h-4" /> Pending Transactions</h3>
        <div className="transactions-list">
          {transactions.filter(tx => !tx.executed).map(tx => (
            <div key={tx.id} className="transaction-card">
              <div className="tx-header">
                <span className="tx-id">TX #{tx.id}</span>
                <span className="tx-status pending">
                  <Clock className="w-3 h-3" /> {tx.signatures}/{tx.required} signatures
                </span>
              </div>
              <div className="tx-body">
                <div className="tx-detail">
                  <span className="label">To:</span>
                  <span className="value">{formatAddress(tx.to)}</span>
                </div>
                <div className="tx-detail">
                  <span className="label">Amount:</span>
                  <span className="value amount">{tx.amount} STX</span>
                </div>
                <div className="tx-detail">
                  <span className="label">Memo:</span>
                  <span className="value">{tx.memo}</span>
                </div>
              </div>
              <div className="tx-actions">
                {tx.signatures < tx.required ? (
                  <button onClick={() => handleSign(tx.id)} className="sign-btn">
                    <Check className="w-4 h-4" /> Sign
                  </button>
                ) : (
                  <button onClick={() => handleExecute(tx.id)} className="execute-btn">
                    <Send className="w-4 h-4" /> Execute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Executed Transactions */}
      <div className="transactions-section">
        <h3><Check className="w-4 h-4" /> Executed Transactions</h3>
        <div className="transactions-list">
          {transactions.filter(tx => tx.executed).map(tx => (
            <div key={tx.id} className="transaction-card executed">
              <div className="tx-header">
                <span className="tx-id">TX #{tx.id}</span>
                <span className="tx-status executed">
                  <Check className="w-3 h-3" /> Executed
                </span>
              </div>
              <div className="tx-body">
                <div className="tx-detail">
                  <span className="label">To:</span>
                  <span className="value">{formatAddress(tx.to)}</span>
                </div>
                <div className="tx-detail">
                  <span className="label">Amount:</span>
                  <span className="value amount">{tx.amount} STX</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .multi-sig-wallet {
          background: linear-gradient(180deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 22, 42, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 24px;
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .wallet-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .wallet-header h2 {
          margin: 0;
          font-size: 20px;
          color: white;
        }

        .subtitle {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }

        .balance-card {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 12px;
          padding: 12px 20px;
          display: flex;
          flex-direction: column;
        }

        .balance-label {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
        }

        .balance-value {
          font-size: 20px;
          font-weight: 700;
          color: #10B981;
        }

        .signers-section {
          margin-bottom: 24px;
        }

        .signers-section h3,
        .transactions-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
        }

        .signers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .signer-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 12px;
        }

        .signer-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }

        .signer-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .signer-name {
          font-size: 14px;
          color: white;
          font-weight: 500;
        }

        .signer-address {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          font-family: monospace;
        }

        .signer-status {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .signer-status.signed {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .signer-status.pending {
          background: rgba(245, 158, 11, 0.2);
          color: #F59E0B;
        }

        .new-tx-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 24px;
          transition: all 0.3s;
        }

        .new-tx-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(139, 92, 246, 0.3);
        }

        .new-tx-form {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          margin-bottom: 6px;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #8B5CF6;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }

        .submit-btn {
          flex: 1;
          padding: 12px;
          background: #8B5CF6;
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .transactions-section {
          margin-bottom: 24px;
        }

        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transaction-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 16px;
        }

        .transaction-card.executed {
          opacity: 0.7;
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .tx-id {
          font-weight: 600;
          color: white;
        }

        .tx-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 20px;
        }

        .tx-status.pending {
          background: rgba(245, 158, 11, 0.2);
          color: #F59E0B;
        }

        .tx-status.executed {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .tx-body {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }

        .tx-detail {
          display: flex;
          flex-direction: column;
        }

        .tx-detail .label {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }

        .tx-detail .value {
          font-size: 13px;
          color: white;
          font-family: monospace;
        }

        .tx-detail .value.amount {
          color: #10B981;
          font-weight: 600;
        }

        .tx-actions {
          display: flex;
          gap: 8px;
        }

        .sign-btn, .execute-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sign-btn {
          background: rgba(245, 158, 11, 0.2);
          color: #F59E0B;
        }

        .sign-btn:hover {
          background: rgba(245, 158, 11, 0.3);
        }

        .execute-btn {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
        }

        .execute-btn:hover {
          background: rgba(16, 185, 129, 0.3);
        }
      `}</style>
    </div>
  );
};

export default MultiSigWallet;

