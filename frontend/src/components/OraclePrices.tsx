import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Database, Shield, AlertCircle } from 'lucide-react';

interface PriceData {
  symbol: string;
  price: string;
  change24h: string;
  confidence: number;
  sources: string[];
}

interface OraclePricesProps {
  refreshInterval?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function OraclePrices({ refreshInterval = 30000 }: OraclePricesProps) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/oracle/prices`);
      if (!res.ok) throw new Error('Failed to fetch prices');
      const data = await res.json();
      setPrices(data.prices || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return '#22c55e';
    if (confidence >= 50) return '#eab308';
    return '#ef4444';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'pyth': return '🔮';
      case 'dia': return '💎';
      case 'coingecko': return '🦎';
      case 'alex': return '⚡';
      default: return '📊';
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} color="#818cf8" />
      </div>
    );
  }

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
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Database size={18} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              Oracle Price Feeds
            </h3>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
              Aggregated from Pyth, DIA, CoinGecko, ALEX
            </p>
          </div>
        </div>
        <button
          onClick={fetchPrices}
          style={{
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#a78bfa',
            fontSize: '0.75rem',
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

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

      {/* Price Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {prices.map((token) => {
          const isPositive = token.change24h.startsWith('+');
          const changeColor = isPositive ? '#22c55e' : '#ef4444';

          return (
            <div
              key={token.symbol}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: 14,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              {/* Token Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: '#e2e8f0',
                }}>
                  {token.symbol}
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${changeColor}15`,
                }}>
                  {isPositive ? <TrendingUp size={10} color={changeColor} /> : <TrendingDown size={10} color={changeColor} />}
                  <span style={{ fontSize: '0.7rem', color: changeColor, fontWeight: 600 }}>
                    {token.change24h}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'monospace',
                marginBottom: 10,
              }}>
                {token.price}
              </div>

              {/* Confidence & Sources */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Shield size={10} color={getConfidenceColor(token.confidence)} />
                  <span style={{
                    fontSize: '0.65rem',
                    color: getConfidenceColor(token.confidence),
                  }}>
                    {token.confidence}%
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: 2,
                }}>
                  {token.sources.map((source) => (
                    <span
                      key={source}
                      title={source}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {getSourceIcon(source)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <div style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: '#475569',
        }}>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span>🔮 Pyth</span>
            <span>💎 DIA</span>
            <span>🦎 CoinGecko</span>
            <span>⚡ ALEX</span>
          </div>
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
