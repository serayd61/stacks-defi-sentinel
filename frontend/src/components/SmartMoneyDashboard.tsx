import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Users,
  RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, GitBranch, Zap,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WalletCluster {
  id: string;
  wallets: string[];
  walletCount: number;
  type: 'whale_group' | 'bot_network' | 'exchange' | 'market_maker' | 'retail';
  totalVolume: number;
  avgTxSize: number;
  accumulationScore: number;
  scoreTrend: number[];
  lastActivity: string;
  dominantDex: string;
  updatedAt: string;
}

interface ClusterData {
  totalClusters: number;
  whaleGroups: number;
  botNetworks: number;
  exchanges: number;
  marketMakers: number;
  retail: number;
  smartMoneyCount: number;
  smartMoneyClusters: string[];
  topAccumulators: WalletCluster[];
  topDistributors: WalletCluster[];
  totalWallets: number;
  lastUpdate: string;
  clusters: WalletCluster[];
}

interface DivergenceSignal {
  id: string;
  type: 'bullish_divergence' | 'bearish_divergence' | 'confirmation';
  strength: number;
  smartMoneyAction: 'accumulating' | 'distributing' | 'neutral';
  priceTrend: 'rising' | 'falling' | 'sideways';
  affectedClusters: string[];
  stxPrice: number;
  timestamp: string;
  description: string;
  avgAccumulationScore: number;
  priceChange6hPct: number;
  smartMoneyCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  whale_group:  { label: 'Whale',         color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  bot_network:  { label: 'Bot',           color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  exchange:     { label: 'Exchange',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  market_maker: { label: 'Market Maker',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  retail:       { label: 'Retail',         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  bullish_divergence:  { label: 'Bullish Divergence',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: TrendingUp },
  bearish_divergence:  { label: 'Bearish Divergence',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: TrendingDown },
  confirmation:        { label: 'Confirmation',        color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', icon: CheckCircle },
};

function formatVolume(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Accumulation Bar ────────────────────────────────────────────────────────

function AccumulationBar({ score }: { score: number }) {
  const pct = ((score + 100) / 200) * 100;
  const color = score > 30 ? '#22c55e' : score < -30 ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, width: 28, textAlign: 'right' }}>-100</span>
      <div style={{
        flex: 1, height: 6, background: 'rgba(255,255,255,0.06)',
        borderRadius: 3, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: `${Math.min(pct, 50)}%`,
          width: `${Math.abs(pct - 50)}%`,
          height: '100%', borderRadius: 3,
          background: color,
          transition: 'all 0.3s ease',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: -1,
          width: 1, height: 8, background: 'rgba(255,255,255,0.2)',
        }} />
      </div>
      <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 600, width: 28 }}>+100</span>
      <span style={{
        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem',
        color, width: 40, textAlign: 'right',
      }}>
        {score > 0 ? '+' : ''}{score}
      </span>
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span style={{ color: '#475569', fontSize: '0.7rem' }}>-</span>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 20;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = data[data.length - 1];
  const color = lastVal > 0 ? '#22c55e' : lastVal < 0 ? '#ef4444' : '#f59e0b';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SmartMoneyDashboard() {
  const [clusterData, setClusterData] = useState<ClusterData | null>(null);
  const [signals, setSignals] = useState<DivergenceSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [clusterRes, signalRes] = await Promise.all([
        fetch(`${API_URL}/api/clusters`),
        fetch(`${API_URL}/api/divergence-signals`),
      ]);

      if (clusterRes.ok) {
        const data = await clusterRes.json();
        setClusterData(data);
      }
      if (signalRes.ok) {
        const data = await signalRes.json();
        setSignals(data.signals || []);
      }
    } catch (err) {
      console.error('Smart Money fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const cardStyle = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '18px 20px',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={24} color="#818cf8" style={{ animation: 'spinCW 0.8s linear infinite', marginBottom: 12 }} />
          <p style={{ color: '#475569', fontSize: '0.85rem' }}>Loading Smart Money data...</p>
        </div>
      </div>
    );
  }

  const summary = clusterData;
  const clusters = clusterData?.clusters || [];

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Smart Money Tracker
            </h2>
            <p style={{ fontSize: '0.73rem', color: '#475569', margin: 0 }}>
              GAUSS Agent - Wallet Clustering & Divergence Detection
            </p>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Total Clusters', value: summary?.totalClusters || 0, icon: <GitBranch size={16} />, color: '#06b6d4' },
          { label: 'Whale Groups',   value: summary?.whaleGroups || 0,   icon: <Activity size={16} />,  color: '#fb923c' },
          { label: 'Bot Networks',   value: summary?.botNetworks || 0,   icon: <Zap size={16} />,       color: '#f87171' },
          { label: 'Smart Money',    value: summary?.smartMoneyCount || 0, icon: <TrendingUp size={16} />, color: '#22c55e' },
          { label: 'Total Wallets',  value: summary?.totalWallets || 0,  icon: <Users size={16} />,     color: '#818cf8' },
        ].map(s => (
          <div key={s.label} style={{
            ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Divergence Signals ─── */}
      <div style={{ ...cardStyle, marginBottom: 22 }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#f59e0b" /> Divergence Signals
        </h3>

        {signals.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
            No divergence signals detected yet. GAUSS agent needs ~6 hours of data to detect divergences.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {signals.slice(0, 5).map(signal => {
              const cfg = SIGNAL_CONFIG[signal.type] || SIGNAL_CONFIG.confirmation;
              const Icon = cfg.icon;
              return (
                <div key={signal.id} style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: cfg.bg,
                  border: `1px solid ${cfg.color}22`,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <Icon size={18} color={cfg.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span style={{
                        padding: '1px 7px', borderRadius: 20, fontSize: '0.62rem',
                        fontWeight: 700, background: 'rgba(255,255,255,0.06)',
                        color: '#94a3b8',
                      }}>
                        Strength: {signal.strength}%
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#475569', marginLeft: 'auto' }}>
                        {timeAgo(signal.timestamp)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                      {signal.description}
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.7rem', color: '#475569' }}>
                      <span>STX: ${signal.stxPrice?.toFixed(3)}</span>
                      <span>6h: {signal.priceChange6hPct > 0 ? '+' : ''}{signal.priceChange6hPct?.toFixed(1)}%</span>
                      <span>Smart Money: {signal.smartMoneyCount} clusters</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Top Accumulators & Distributors ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
        {/* Accumulators */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#22c55e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} /> Top Accumulators
          </h3>
          {(summary?.topAccumulators || []).length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(summary?.topAccumulators || []).slice(0, 5).map(c => (
                <div key={c.id} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 600 }}>{c.id}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 10, fontSize: '0.58rem', fontWeight: 700,
                        background: TYPE_CONFIG[c.type]?.bg || 'rgba(148,163,184,0.12)',
                        color: TYPE_CONFIG[c.type]?.color || '#94a3b8',
                      }}>
                        {TYPE_CONFIG[c.type]?.label || c.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.walletCount} wallets</span>
                  </div>
                  <AccumulationBar score={c.accumulationScore} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distributors */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={15} /> Top Distributors
          </h3>
          {(summary?.topDistributors || []).length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(summary?.topDistributors || []).slice(0, 5).map(c => (
                <div key={c.id} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 600 }}>{c.id}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 10, fontSize: '0.58rem', fontWeight: 700,
                        background: TYPE_CONFIG[c.type]?.bg || 'rgba(148,163,184,0.12)',
                        color: TYPE_CONFIG[c.type]?.color || '#94a3b8',
                      }}>
                        {TYPE_CONFIG[c.type]?.label || c.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.walletCount} wallets</span>
                  </div>
                  <AccumulationBar score={c.accumulationScore} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── All Clusters Table ─── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={16} color="#06b6d4" /> All Clusters ({clusters.length})
        </h3>

        {clusters.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>
            <GitBranch size={32} color="#1e293b" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: '0.85rem', marginBottom: 4 }}>No clusters detected yet</p>
            <p style={{ fontSize: '0.73rem' }}>GAUSS agent is collecting transaction data. First clusters will appear after ~30 minutes.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '120px 90px 70px 100px 1fr 80px 60px',
              gap: 8, padding: '6px 12px', fontSize: '0.68rem', color: '#475569',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Cluster</span>
              <span>Type</span>
              <span>Wallets</span>
              <span>Volume</span>
              <span>Score</span>
              <span>Trend</span>
              <span>Activity</span>
            </div>

            {clusters.slice(0, 20).map(cluster => {
              const isExpanded = expanded === cluster.id;
              const typeCfg = TYPE_CONFIG[cluster.type] || TYPE_CONFIG.retail;

              return (
                <div key={cluster.id}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : cluster.id)}
                    style={{
                      width: '100%', display: 'grid',
                      gridTemplateColumns: '120px 90px 70px 100px 1fr 80px 60px',
                      gap: 8, padding: '10px 12px', borderRadius: 8,
                      background: isExpanded ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.015)',
                      border: isExpanded ? '1px solid rgba(6,182,212,0.15)' : '1px solid transparent',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      alignItems: 'center', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 600 }}>
                      {cluster.id}
                    </span>
                    <span style={{
                      padding: '2px 7px', borderRadius: 10, fontSize: '0.6rem', fontWeight: 700,
                      background: typeCfg.bg, color: typeCfg.color, textAlign: 'center',
                    }}>
                      {typeCfg.label}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8' }}>
                      {cluster.walletCount}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#e2e8f0' }}>
                      {formatVolume(cluster.totalVolume)} STX
                    </span>
                    <AccumulationBar score={cluster.accumulationScore} />
                    <Sparkline data={cluster.scoreTrend} />
                    <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                      {timeAgo(cluster.lastActivity)}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      margin: '4px 0 8px', padding: '14px 16px', borderRadius: 10,
                      background: 'rgba(6,182,212,0.03)',
                      border: '1px solid rgba(6,182,212,0.1)',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: '#475569' }}>Avg TX Size</span>
                          <div style={{ fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600 }}>
                            {formatVolume(cluster.avgTxSize)} STX
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: '#475569' }}>Dominant DEX</span>
                          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>
                            {cluster.dominantDex || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.68rem', color: '#475569' }}>Last Updated</span>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {timeAgo(cluster.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.68rem', color: '#475569', display: 'block', marginBottom: 6 }}>
                          Wallet Addresses ({cluster.walletCount})
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {cluster.wallets.slice(0, 10).map(addr => (
                            <a
                              key={addr}
                              href={`https://explorer.stacks.co/address/${addr}?chain=mainnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '2px 8px', borderRadius: 6,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                fontFamily: 'monospace', fontSize: '0.68rem', color: '#818cf8',
                                textDecoration: 'none',
                              }}
                            >
                              {addr.slice(0, 8)}...{addr.slice(-4)}
                            </a>
                          ))}
                          {cluster.walletCount > 10 && (
                            <span style={{ fontSize: '0.68rem', color: '#475569', padding: '2px 8px' }}>
                              +{cluster.walletCount - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last Update */}
      {summary?.lastUpdate && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.7rem', color: '#334155' }}>
          Last cluster update: {timeAgo(summary.lastUpdate)}
        </div>
      )}
    </div>
  );
}
