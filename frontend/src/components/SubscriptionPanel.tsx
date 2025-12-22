import React from 'react';
import { useWallet } from '../contexts/WalletContext';

const SubscriptionPanel: React.FC = () => {
  const {
    isConnected,
    userAddress,
    isSubscribed,
    subscriptionTier,
    isLoading,
    connectWallet,
    disconnectWallet,
    subscribeBasic,
    subscribePremium,
  } = useWallet();

  // Truncate address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="subscription-panel">
      <div className="panel-header">
        <h2>🔐 Subscription</h2>
        {isConnected && (
          <span className="wallet-badge">
            {truncateAddress(userAddress || '')}
          </span>
        )}
      </div>

      {!isConnected ? (
        // Not connected - show connect button
        <div className="connect-section">
          <div className="connect-info">
            <h3>Connect Your Wallet</h3>
            <p>Subscribe to unlock premium features:</p>
            <ul>
              <li>🐋 Real-time whale alerts</li>
              <li>📊 Advanced analytics</li>
              <li>🔔 Custom notifications</li>
              <li>📈 Historical data access</li>
            </ul>
          </div>
          <button className="btn-connect" onClick={() => connectWallet()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
            Connect Wallet
          </button>
        </div>
      ) : !isSubscribed ? (
        // Connected but not subscribed - show plans
        <div className="plans-section">
          <h3>Choose Your Plan</h3>
          
          <div className="plans-grid">
            {/* Basic Plan */}
            <div className="plan-card basic">
              <div className="plan-badge">Basic</div>
              <div className="plan-price">
                <span className="amount">1</span>
                <span className="currency">STX</span>
                <span className="period">/month</span>
              </div>
              <ul className="plan-features">
                <li>✅ Whale alerts (100K+ STX)</li>
                <li>✅ DEX swap monitoring</li>
                <li>✅ Dashboard access</li>
                <li>❌ Custom thresholds</li>
                <li>❌ API access</li>
              </ul>
              <button 
                className="btn-subscribe basic"
                onClick={subscribeBasic}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Subscribe Basic'}
              </button>
            </div>

            {/* Premium Plan */}
            <div className="plan-card premium">
              <div className="plan-badge popular">Most Popular</div>
              <div className="plan-price">
                <span className="amount">2.5</span>
                <span className="currency">STX</span>
                <span className="period">/month</span>
              </div>
              <ul className="plan-features">
                <li>✅ All Basic features</li>
                <li>✅ Custom whale thresholds</li>
                <li>✅ Telegram/Discord alerts</li>
                <li>✅ API access (1000 req/day)</li>
                <li>✅ Priority support</li>
              </ul>
              <button 
                className="btn-subscribe premium"
                onClick={subscribePremium}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Subscribe Premium'}
              </button>
            </div>
          </div>

          <button className="btn-disconnect" onClick={disconnectWallet}>
            Disconnect Wallet
          </button>
        </div>
      ) : (
        // Subscribed - show status
        <div className="subscribed-section">
          <div className="status-badge active">
            ✅ Active Subscription
          </div>
          
          <div className="subscription-info">
            <div className="tier">
              <span className="label">Plan:</span>
              <span className={`value ${subscriptionTier}`}>
                {subscriptionTier === 'premium' ? '👑 Premium' : '⭐ Basic'}
              </span>
            </div>
            <div className="address">
              <span className="label">Wallet:</span>
              <span className="value">{truncateAddress(userAddress || '')}</span>
            </div>
          </div>

          <div className="features-unlocked">
            <h4>🎉 Features Unlocked</h4>
            <ul>
              <li>🐋 Real-time whale alerts</li>
              <li>📊 Full dashboard access</li>
              {subscriptionTier === 'premium' && (
                <>
                  <li>🔔 Custom notifications</li>
                  <li>🔑 API access</li>
                </>
              )}
            </ul>
          </div>

          <button className="btn-disconnect" onClick={disconnectWallet}>
            Disconnect Wallet
          </button>
        </div>
      )}

      <style>{`
        .subscription-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #fff;
        }

        .wallet-badge {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-family: monospace;
        }

        .connect-section {
          text-align: center;
        }

        .connect-info h3 {
          color: #fff;
          margin-bottom: 12px;
        }

        .connect-info p {
          color: #94a3b8;
          margin-bottom: 16px;
        }

        .connect-info ul {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          text-align: left;
        }

        .connect-info li {
          color: #cbd5e1;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .btn-connect {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-connect:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
        }

        .plans-section h3 {
          color: #fff;
          text-align: center;
          margin-bottom: 20px;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        @media (max-width: 600px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }
        }

        .plan-card {
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          position: relative;
        }

        .plan-card.premium {
          border-color: #f59e0b;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0.3) 100%);
        }

        .plan-badge {
          background: #374151;
          color: #fff;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 12px;
        }

        .plan-badge.popular {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .plan-price {
          margin-bottom: 16px;
        }

        .plan-price .amount {
          font-size: 2rem;
          font-weight: 700;
          color: #fff;
        }

        .plan-price .currency {
          font-size: 1rem;
          color: #818cf8;
          margin-left: 4px;
        }

        .plan-price .period {
          font-size: 0.85rem;
          color: #64748b;
        }

        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 16px 0;
        }

        .plan-features li {
          color: #cbd5e1;
          padding: 6px 0;
          font-size: 0.85rem;
        }

        .btn-subscribe {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-subscribe.basic {
          background: #374151;
          color: #fff;
        }

        .btn-subscribe.basic:hover {
          background: #4b5563;
        }

        .btn-subscribe.premium {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #000;
        }

        .btn-subscribe.premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        }

        .btn-subscribe:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-disconnect {
          width: 100%;
          padding: 10px;
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #ef4444;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 12px;
        }

        .btn-disconnect:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .subscribed-section {
          text-align: center;
        }

        .status-badge {
          display: inline-block;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .status-badge.active {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .subscription-info {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .subscription-info > div {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
        }

        .subscription-info .label {
          color: #64748b;
        }

        .subscription-info .value {
          color: #fff;
          font-weight: 500;
        }

        .subscription-info .value.premium {
          color: #f59e0b;
        }

        .subscription-info .value.basic {
          color: #6366f1;
        }

        .features-unlocked {
          text-align: left;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .features-unlocked h4 {
          color: #22c55e;
          margin: 0 0 12px 0;
        }

        .features-unlocked ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .features-unlocked li {
          color: #cbd5e1;
          padding: 4px 0;
        }
      `}</style>
    </div>
  );
};

export default SubscriptionPanel;

