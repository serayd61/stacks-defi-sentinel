import React, { useState, useEffect } from 'react';
import { Wallet, PieChart, Coins, Layers, Lock, Image, RefreshCw, Search, AlertCircle, TrendingUp } from 'lucide-react';

interface TokenBalance {
  contract: string;
  name: string;
  symbol: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
}

interface StackingPosition {
  type: 'pox' | 'liquid';
  protocol: string;
  amountStx: number;
  valueUsd: number;
  unlockHeight?: number;
}

interface NFTHolding {
  contract: string;
  name: string;
  count: number;
}

interface Portfolio {
  address: string;
  totalValueUsd: number;
  stxBalance: number;
  stxValueUsd: number;
  tokens: TokenBalance[];
  stackingPositions: StackingPosition[];
  nfts: NFTHolding[];
  lastUpdated: number;
}

interface PortfolioBreakdown {
  stx: { value: number; percentage: number };
  tokens: { value: number; percentage: number };
  lp: { value: number; percentage: number };
  stacking: { value: number; percentage: number };
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function PortfolioView() {
  const [address, setAddress] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [breakdown, setBreakdown] = useState<PortfolioBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async (addr: string) => {
    if (!addr || addr.length < 30) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [portfolioRes, breakdownRes] = await Promise.all([
        fetch(`${API_BASE}/api/portfolio/${addr}`),
        fetch(`${API_BASE}/api/portfolio/${addr}/breakdown`),
      ]);
      
      if (!portfolioRes.ok) throw new Error('Failed to fetch portfolio');
      
      const portfolioData = await portfolioRes.json();
      const breakdownData = breakdownRes.ok ? await breakdownRes.json() : null;
      
      setPortfolio(portfolioData);
      setBreakdown(breakdownData?.breakdown || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPortfolio(address);
  };

  const formatUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 4) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: 22,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Wallet size={18} color="#22c55e" />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
            Portfolio Tracker
          </h3>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
            View all DeFi positions for any Stacks address
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          gap: 10,
        }}>
          <div style={{
            flex: 1,
            position: 'relative',
          }}>
            <Search size={16} style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b',
            }} />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Stacks address (SP...)"
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || address.length < 30}
            style={{
              padding: '10px 20px',
              background: loading ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: address.length < 30 ? 0.5 : 1,
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            {loading ? 'Loading...' : 'Track'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#f87171',
          fontSize: '0.8rem',
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {portfolio && (
        <>
          {/* Total Value */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.05))',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>Total Portfolio Value</p>
            <p style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#22c55e',
              margin: 0,
              fontFamily: 'monospace',
            }}>
              {formatUsd(portfolio.totalValueUsd)}
            </p>
          </div>

          {/* Breakdown */}
          {breakdown && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}>
              {[
                { label: 'STX', icon: Coins, color: '#818cf8', data: breakdown.stx },
                { label: 'Tokens', icon: Layers, color: '#fb923c', data: breakdown.tokens },
                { label: 'LP', icon: PieChart, color: '#22d3ee', data: breakdown.lp },
                { label: 'Stacking', icon: Lock, color: '#a78bfa', data: breakdown.stacking },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: 12,
                    textAlign: 'center',
                  }}
                >
                  <item.icon size={16} color={item.color} style={{ marginBottom: 6 }} />
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 2 }}>{item.label}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                    {item.data.percentage.toFixed(1)}%
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                    {formatUsd(item.data.value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* STX Balance */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #5546FF, #FC6432)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.7rem',
                color: '#fff',
              }}>
                STX
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                  Stacks
                </p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                  Native token
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', margin: 0, fontFamily: 'monospace' }}>
                {formatNumber(portfolio.stxBalance)} STX
              </p>
              <p style={{ fontSize: '0.75rem', color: '#22c55e', margin: 0 }}>
                {formatUsd(portfolio.stxValueUsd)}
              </p>
            </div>
          </div>

          {/* Token Balances */}
          {portfolio.tokens.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#94a3b8',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Layers size={14} />
                Token Balances ({portfolio.tokens.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portfolio.tokens.map((token) => (
                  <div
                    key={token.contract}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                        {token.symbol}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                        {token.name}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', margin: 0, fontFamily: 'monospace' }}>
                        {formatNumber(token.balance)}
                      </p>
                      {token.valueUsd > 0 && (
                        <p style={{ fontSize: '0.7rem', color: '#22c55e', margin: 0 }}>
                          {formatUsd(token.valueUsd)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stacking Positions */}
          {portfolio.stackingPositions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#94a3b8',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Lock size={14} />
                Stacking Positions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portfolio.stackingPositions.map((pos, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(167,139,250,0.1)',
                      border: '1px solid rgba(167,139,250,0.2)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                        {pos.protocol}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#a78bfa', margin: 0 }}>
                        {pos.type === 'pox' ? 'PoX Stacking' : 'Liquid Stacking'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', margin: 0, fontFamily: 'monospace' }}>
                        {formatNumber(pos.amountStx)} STX
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#22c55e', margin: 0 }}>
                        {formatUsd(pos.valueUsd)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NFTs */}
          {portfolio.nfts.length > 0 && (
            <div>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#94a3b8',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Image size={14} />
                NFT Holdings ({portfolio.nfts.reduce((sum, n) => sum + n.count, 0)})
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
              }}>
                {portfolio.nfts.slice(0, 8).map((nft) => (
                  <div
                    key={nft.contract}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 8,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <p style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#e2e8f0',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {nft.name}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>
                      {nft.count} items
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <p style={{
            marginTop: 16,
            fontSize: '0.7rem',
            color: '#475569',
            textAlign: 'center',
          }}>
            Last updated: {new Date(portfolio.lastUpdated).toLocaleString()}
          </p>
        </>
      )}

      {!portfolio && !loading && !error && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#64748b',
        }}>
          <Wallet size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', marginBottom: 4 }}>Enter a Stacks address to view portfolio</p>
          <p style={{ fontSize: '0.75rem' }}>Track tokens, LP positions, stacking, and NFTs</p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
