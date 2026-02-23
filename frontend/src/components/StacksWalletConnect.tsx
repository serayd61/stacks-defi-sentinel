import React, { useState, useEffect, useRef } from 'react';
import { useWallet, WalletType } from '../contexts/WalletContext';

interface WalletInfo {
  id: WalletType;
  name: string;
  color: string;
  downloadUrl: string;
  description: string;
  icon: React.ReactNode;
}

const WalletIcon: React.FC<{ id: string }> = ({ id }) => {
  if (id === 'leather') return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#12100D"/>
      <rect x="14" y="14" width="20" height="20" rx="2" fill="#F5F5F4"/>
      <rect x="20" y="20" width="8" height="8" rx="1" fill="#12100D"/>
    </svg>
  );
  if (id === 'xverse') return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="24" fill="#1E293B"/>
      <path d="M14 34L24 22L34 34H14Z" fill="#EE7242"/>
      <rect x="16" y="14" width="16" height="5" rx="1" fill="#EE7242"/>
    </svg>
  );
  if (id === 'hiro') return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#FF5500"/>
      <rect x="12" y="12" width="9" height="24" rx="2" fill="white"/>
      <rect x="27" y="12" width="9" height="24" rx="2" fill="white"/>
      <rect x="21" y="20" width="6" height="8" rx="1" fill="white"/>
    </svg>
  );
  if (id === 'okx') return (
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="#000"/>
      <rect x="10" y="10" width="9" height="9" fill="white"/>
      <rect x="20" y="20" width="8" height="8" fill="white"/>
      <rect x="29" y="10" width="9" height="9" fill="white"/>
      <rect x="10" y="29" width="9" height="9" fill="white"/>
      <rect x="29" y="29" width="9" height="9" fill="white"/>
    </svg>
  );
  return null;
};

const WALLETS: WalletInfo[] = [
  {
    id: 'leather',
    name: 'Leather',
    color: '#12100D',
    downloadUrl: 'https://leather.io/install-extension',
    description: 'Most popular Stacks wallet',
    icon: <WalletIcon id="leather" />,
  },
  {
    id: 'xverse',
    name: 'Xverse',
    color: '#EE7242',
    downloadUrl: 'https://www.xverse.app/download',
    description: 'Bitcoin & Stacks wallet',
    icon: <WalletIcon id="xverse" />,
  },
  {
    id: 'hiro',
    name: 'Hiro Wallet',
    color: '#FF5500',
    downloadUrl: 'https://wallet.hiro.so/',
    description: 'Developer-focused wallet',
    icon: <WalletIcon id="hiro" />,
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    color: '#000000',
    downloadUrl: 'https://www.okx.com/web3',
    description: 'Multi-chain wallet',
    icon: <WalletIcon id="okx" />,
  },
];

const StacksWalletConnect: React.FC = () => {
  // Use WalletContext — single source of truth
  const {
    isConnected,
    isLoading,
    userAddress,
    balance,
    hasProvider,
    detectedWallet,
    connectWallet,
    disconnectWallet,
    refreshDetection,
    refreshBalance,
  } = useWallet();

  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Lock scroll when modal is open
  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleCopy = () => {
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShowDropdown(false);
  };

  const handleExplorer = () => {
    if (userAddress) {
      window.open(`https://explorer.hiro.so/address/${userAddress}?chain=mainnet`, '_blank');
    }
    setShowDropdown(false);
  };

  const handleConnect = (wallet: WalletInfo) => {
    if (hasProvider) {
      connectWallet(wallet.id);
      setShowModal(false);
    } else {
      window.open(wallet.downloadUrl, '_blank');
    }
  };

  return (
    <>
      {/* ─── CONNECTED STATE ─── */}
      {isConnected && userAddress ? (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 30, height: 30,
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M19 7H5C3.9 7 3 7.9 3 9v9c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" stroke="white" strokeWidth="2"/>
                <circle cx="15" cy="14" r="1.5" fill="white"/>
                <path d="M3 9l9-5 9 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', letterSpacing: '-0.01em' }}>
                {formatAddress(userAddress)}
              </span>
              {balance && (
                <span style={{ fontSize: '0.72rem', color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
                  {parseFloat(balance).toFixed(2)} STX
                </span>
              )}
            </div>
            {/* Chevron */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ transition: 'transform 0.2s', transform: showDropdown ? 'rotate(180deg)' : 'none', opacity: 0.5 }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#16161f', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, minWidth: 210,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              zIndex: 10000, overflow: 'hidden',
              animation: 'dsDropFade 0.15s ease',
            }}>
              {/* Address header */}
              <div style={{
                padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>Connected Wallet</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  {userAddress.slice(0, 12)}...{userAddress.slice(-8)}
                </div>
              </div>

              {[
                {
                  label: copied ? 'Copied!' : 'Copy Address',
                  icon: copied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>
                  ),
                  onClick: handleCopy, color: copied ? '#22c55e' : '#e2e8f0'
                },
                {
                  label: 'View on Explorer',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                  onClick: handleExplorer, color: '#e2e8f0'
                },
                {
                  label: 'Refresh Balance',
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.76 0 5.23 1.24 6.9 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                  onClick: () => { refreshBalance(); setShowDropdown(false); }, color: '#e2e8f0'
                },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '11px 16px',
                  background: 'none', border: 'none', color: item.color,
                  fontSize: '0.88rem', cursor: 'pointer', transition: 'background 0.15s',
                  fontFamily: 'inherit',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {item.icon} {item.label}
                </button>
              ))}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

              <button onClick={() => { disconnectWallet(); setShowDropdown(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '11px 16px',
                background: 'none', border: 'none', color: '#ef4444',
                fontSize: '0.88rem', cursor: 'pointer', transition: 'background 0.15s',
                fontFamily: 'inherit',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Disconnect
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ─── CONNECT BUTTON ─── */
        <button
          onClick={() => setShowModal(true)}
          disabled={isLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #5546FF 0%, #7c3aed 100%)',
            color: 'white', border: 'none',
            padding: '9px 18px', borderRadius: 12,
            fontWeight: 600, fontSize: '0.88rem', cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(85,70,255,0.35)',
            opacity: isLoading ? 0.75 : 1, fontFamily: 'inherit', letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(85,70,255,0.5)'; }}}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(85,70,255,0.35)'; }}
        >
          {isLoading ? (
            <>
              <div style={{
                width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%', animation: 'dsWalletSpin 0.7s linear infinite',
              }} />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 7H5C3.9 7 3 7.9 3 9v9c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z" stroke="white" strokeWidth="2"/>
                <circle cx="15" cy="14" r="1.5" fill="white"/>
                <path d="M3 9l9-5 9 5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Connect Wallet
            </>
          )}
        </button>
      )}

      {/* ─── WALLET SELECTION MODAL ─── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, backdropFilter: 'blur(10px)',
            padding: 16, animation: 'dsWalletFadeIn 0.15s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #18182a 0%, #111119 100%)',
              borderRadius: 24, maxWidth: 440, width: '100%',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              animation: 'dsWalletSlideUp 0.2s ease', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: 'linear-gradient(135deg,rgba(85,70,255,0.2),rgba(124,58,237,0.2))',
                  border: '1px solid rgba(85,70,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#5546FF"/>
                    <path d="M2 17l10 5 10-5" stroke="#5546FF" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M2 12l10 5 10-5" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.02em' }}>
                    Connect to DeFi Sentinel
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                    Select a Stacks wallet to connect
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b',
                cursor: 'pointer', padding: 10, borderRadius: 10,
                display: 'flex', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Detection Status */}
            <div style={{
              margin: '14px 16px 0',
              padding: '10px 14px',
              borderRadius: 10,
              background: hasProvider ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${hasProvider ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: '0.8rem',
              color: hasProvider ? '#22c55e' : '#f59e0b',
            }}>
              {hasProvider ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
              <span style={{ flex: 1 }}>
                {hasProvider ? `${detectedWallet || 'Stacks Wallet'} detected` : 'No wallet detected — install one below'}
              </span>
              <button onClick={() => refreshDetection()} style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: 'inherit', padding: '4px 8px', borderRadius: 6,
                cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.76 0 5.23 1.24 6.9 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Retry
              </button>
            </div>

            {/* Wallet List */}
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {WALLETS.map(wallet => (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14, cursor: 'pointer',
                    transition: 'all 0.18s ease', textAlign: 'left', width: '100%',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = `${wallet.color}55`;
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.transform = '';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: wallet.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {wallet.icon}
                  </div>
                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#fff', marginBottom: 2 }}>
                      {wallet.name}
                    </div>
                    <div style={{ fontSize: '0.77rem', color: '#64748b' }}>
                      {wallet.description}
                    </div>
                  </div>
                  {/* Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#64748b' }}>
                    <span style={{ color: hasProvider ? '#22c55e' : '#f59e0b' }}>
                      {hasProvider ? 'Connect' : 'Install'}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: '0.8rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New to Stacks? We recommend{' '}
                <strong style={{ color: '#94a3b8' }}>Leather</strong> or{' '}
                <strong style={{ color: '#94a3b8' }}>Xverse</strong>
              </div>
              <a
                href="https://www.stacks.co/explore/discover-apps"
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#5546FF', fontSize: '0.8rem', textDecoration: 'none' }}
              >
                Learn more about Stacks wallets
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dsWalletSpin { to { transform: rotate(360deg); } }
        @keyframes dsWalletFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes dsWalletSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dsDropFade { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </>
  );
};

export default StacksWalletConnect;
