import React, { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Users, Wallet, Zap, Github, ExternalLink,
  WifiOff, Bell, ArrowRightLeft, RefreshCw,
  ChevronRight, Menu, X,
  Target, Star, Fuel,
  ChevronDown, Code, Server, Search,
  Home, ChevronLeft, Brain, Bitcoin,
} from 'lucide-react';

import { StatCard } from './components/StatCard';
import { SwapTable } from './components/SwapTable';
import { WhaleAlerts } from './components/WhaleAlerts';
import { PoolsTable } from './components/PoolsTable';
import NetworkHealth from './components/NetworkHealth';
import ContractActivityMonitor from './components/ContractActivityMonitor';
import WalletAnalytics from './components/WalletAnalytics';
import PriceAlerts from './components/PriceAlerts';
import MarketOverview from './components/MarketOverview';
import AIAgents from './components/AIAgents';
import GasTracker from './components/GasTracker';
import StacksLeaderboard from './components/StacksLeaderboard';
import StacksPredict from './components/StacksPredict';
import SBTCBridgeMonitor from './components/SBTCBridgeMonitor';
import { WalletProvider } from './contexts/WalletContext';
import { useApi } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://stacks-defi-sentinel-production.up.railway.app/ws';

type TabType =
  | 'overview' | 'market' | 'network'
  | 'swaps' | 'price-alerts'
  | 'contracts' | 'alerts' | 'wallet-analytics'
  | 'ai-agents' | 'sbtc'
  | 'gas' | 'leaderboard' | 'predict';

interface NavItem { id: TabType; label: string; icon: React.ElementType; badge?: 'hot'|'new'|'live'; }
interface NavSection { label: string; items: NavItem[]; }

const NAV: NavSection[] = [
  { label: 'Overview', items: [
    { id: 'overview',   label: 'Dashboard',      icon: Home,       badge: 'live' },
    { id: 'market',     label: 'Market',          icon: TrendingUp, badge: 'hot'  },
    { id: 'network',    label: 'Network Health',  icon: Server,     badge: 'new'  },
  ]},
  { label: 'Analytics', items: [
    { id: 'contracts',        label: 'Contract Activity', icon: Code,     badge: 'new' },
    { id: 'alerts',           label: 'Whale Alerts',      icon: Activity },
    { id: 'wallet-analytics', label: 'Wallet Analyzer',   icon: Search },
  ]},
  { label: 'Live Data', items: [
    { id: 'swaps',        label: 'Swap History',  icon: ArrowRightLeft },
    { id: 'price-alerts', label: 'Price Alerts',  icon: Bell, badge: 'new' },
  ]},
  { label: 'Bitcoin', items: [
    { id: 'sbtc', label: 'sBTC Bridge', icon: Bitcoin, badge: 'new' as const },
  ]},
  { label: 'AI', items: [
    { id: 'ai-agents', label: 'AI Agents', icon: Brain, badge: 'new' as const },
  ]},
  { label: 'Explore', items: [
    { id: 'gas',         label: 'Gas Tracker',  icon: Fuel },
    { id: 'leaderboard', label: 'Leaderboard',  icon: Star },
    { id: 'predict',     label: 'Predictions',  icon: Target },
  ]},
];

const BADGE: Record<string, { label: string; bg: string; text: string }> = {
  hot:  { label: 'HOT',  bg: 'rgba(251,146,60,0.15)',  text: '#fb923c' },
  new:  { label: 'NEW',  bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  live: { label: 'LIVE', bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};

const fmt = (n: number) => {
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtCount = (n: number) => {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`;
  return n.toString();
};

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
const Sidebar: React.FC<{
  open: boolean; activeTab: TabType;
  onSelect: (t: TabType) => void;
  onToggle: () => void; tvl: number;
}> = ({ open, activeTab, onSelect, onToggle, tvl }) => {
  const [expanded, setExpanded] = useState<string|null>('Overview');

  return (
    <aside style={{
      width: open ? 248 : 72, minHeight: '100vh', height: '100vh',
      position: 'fixed', left: 0, top: 0,
      background: 'rgba(9,9,18,0.98)', backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 40, overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '18px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,#5546FF,#7c3aed,#FC6432)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(85,70,255,0.35)',
          }}>
            <Zap size={18} color="white" />
          </div>
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e', border: '2px solid #090912',
          }} />
        </div>
        {open && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              Stacks Sentinel
            </div>
            <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              Stacks Mainnet · AI-Powered
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
        {NAV.map(section => (
          <div key={section.label} style={{ marginBottom: 4 }}>
            {open ? (
              <>
                <button
                  onClick={() => setExpanded(e => e === section.label ? null : section.label)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '6px 10px',
                    background: 'none', border: 'none', color: '#475569',
                    fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8,
                    transition: 'color 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                >
                  {section.label}
                  <ChevronDown size={12} style={{
                    transform: expanded === section.label ? 'rotate(180deg)' : '',
                    transition: 'transform 0.2s',
                  }} />
                </button>
                {expanded === section.label && (
                  <div style={{ marginTop: 2 }}>
                    {section.items.map(item => {
                      const active = activeTab === item.id;
                      const b = item.badge ? BADGE[item.badge] : null;
                      return (
                        <button key={item.id} onClick={() => onSelect(item.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            gap: 10, padding: '8px 10px', borderRadius: 9,
                            background: active
                              ? 'linear-gradient(90deg,rgba(85,70,255,0.18),rgba(124,58,237,0.06))'
                              : 'transparent',
                            border: active ? '1px solid rgba(85,70,255,0.22)' : '1px solid transparent',
                            color: active ? '#e2e8f0' : '#64748b',
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontFamily: 'inherit', fontSize: '0.82rem',
                            fontWeight: active ? 600 : 400, marginBottom: 1, textAlign: 'left',
                          }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e2e8f0'; }}}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}}
                        >
                          <item.icon size={15} color={active ? '#818cf8' : '#475569'} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                          {b && (
                            <span style={{
                              padding: '1px 6px', borderRadius: 20, fontSize: '0.59rem',
                              fontWeight: 700, letterSpacing: '0.04em',
                              background: b.bg, color: b.text, flexShrink: 0,
                            }}>
                              {b.label}
                            </span>
                          )}
                          {active && <ChevronRight size={12} color="#818cf8" style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Collapsed – icons only */
              <div>
                {section.items.map(item => {
                  const active = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => onSelect(item.id)} title={item.label}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: '9px 0',
                        borderRadius: 9, marginBottom: 1,
                        background: active ? 'rgba(85,70,255,0.15)' : 'transparent',
                        border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <item.icon size={16} color={active ? '#818cf8' : '#475569'} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {open && tvl > 0 && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(85,70,255,0.1),rgba(252,100,50,0.05))',
            border: '1px solid rgba(85,70,255,0.18)',
            borderRadius: 10, padding: '10px 12px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>Stacks TVL</span>
              <span style={{ fontSize: '0.68rem', color: '#22c55e', fontWeight: 600 }}>Live</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.02em' }}>
              {fmt(tvl)}
            </div>
          </div>
        )}
        <button onClick={onToggle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: open ? 'flex-start' : 'center',
            gap: 8, padding: '7px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 9, color: '#475569', cursor: 'pointer',
            fontSize: '0.76rem', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        >
          {open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          {open && 'Collapse'}
        </button>
      </div>
    </aside>
  );
};

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
function App() {
  const { dashboardStats, isLoading, isRefreshing, error, fetchDashboard } = useApi();
  const { isConnected: wsConnected, events } = useWebSocket(WS_URL);

  const [activeTab, setActiveTab] = useState<TabType>('ai-agents');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => { fetchDashboard(); setLastUpdate(new Date()); }, 30000);
    return () => clearInterval(iv);
  }, [fetchDashboard]);

  const combinedSwaps = [
    ...events.swaps,
    ...(dashboardStats?.recentSwaps || []),
    ...((dashboardStats as any)?.recentTransactions || []),
  ].slice(0, 30);

  const combinedAlerts = [
    ...events.alerts,
    ...(dashboardStats?.recentAlerts || []),
  ].slice(0, 15);

  const allItems = NAV.flatMap(s => s.items);
  const currentItem = allItems.find(i => i.id === activeTab);

  const handleSelect = (t: TabType) => { setActiveTab(t); setMobileOpen(false); };

  return (
    <div style={{ minHeight: '100vh', background: '#090912', color: '#fff', display: 'flex' }}>

      {/* Ambient glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -150, right: -150, width: 600, height: 600, background: 'radial-gradient(circle,rgba(85,70,255,0.1) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 500, height: 500, background: 'radial-gradient(circle,rgba(252,100,50,0.06) 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block" style={{ flexShrink: 0, width: sidebarOpen ? 248 : 72, transition: 'width 0.25s' }}>
        <Sidebar open={sidebarOpen} activeTab={activeTab} onSelect={handleSelect}
          onToggle={() => setSidebarOpen(v => !v)} tvl={dashboardStats?.totalValueLocked || 0} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden" onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 50, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 264, height: '100%', background: '#0d0d18',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#5546FF,#FC6432)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="white" />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Stacks Sentinel</span>
              </div>
              <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <nav style={{ padding: '10px 8px' }}>
              {NAV.map(section => (
                <div key={section.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.64rem', color: '#475569', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '4px 10px 5px' }}>
                    {section.label}
                  </div>
                  {section.items.map(item => {
                    const active = activeTab === item.id;
                    const b = item.badge ? BADGE[item.badge] : null;
                    return (
                      <button key={item.id} onClick={() => handleSelect(item.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 10px', borderRadius: 8, marginBottom: 1,
                          background: active ? 'rgba(85,70,255,0.15)' : 'transparent',
                          border: 'none', color: active ? '#fff' : '#64748b',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.83rem',
                          fontWeight: active ? 600 : 400, textAlign: 'left',
                        }}
                      >
                        <item.icon size={15} color={active ? '#818cf8' : '#475569'} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {b && <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: '0.58rem', fontWeight: 700, background: b.bg, color: b.text }}>{b.label}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

        {/* TOP HEADER */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'rgba(9,9,18,0.88)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

            {/* Left: mobile button + breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="lg:hidden" onClick={() => setMobileOpen(true)} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8', cursor: 'pointer', padding: '6px 8px', borderRadius: 9, display: 'flex',
              }}>
                <Menu size={18} />
              </button>
              <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 500 }}>Stacks Sentinel</span>
                <ChevronRight size={12} color="#1e293b" />
                {currentItem && (
                  <>
                    <currentItem.icon size={13} color="#5546FF" />
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{currentItem.label}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right: status chips + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

              {/* Live pill */}
              <div className="hidden sm:flex" style={{
                alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 600,
                background: wsConnected ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${wsConnected ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)'}`,
                color: wsConnected ? '#22c55e' : '#f59e0b',
              }}>
                {wsConnected ? (
                  <>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.3)', flexShrink: 0 }} />
                    Live
                  </>
                ) : (
                  <><WifiOff size={11} /> Connecting</>
                )}
              </div>

              {/* AI Agents shortcut */}
              <button
                onClick={() => setActiveTab('ai-agents')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  background: activeTab === 'ai-agents' ? 'rgba(85,70,255,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${activeTab === 'ai-agents' ? 'rgba(85,70,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  color: activeTab === 'ai-agents' ? '#818cf8' : '#64748b',
                  cursor: 'pointer', borderRadius: 9, fontSize: '0.72rem', fontWeight: 600,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                <Brain size={13} />
                <span className="hidden sm:inline">AI</span>
              </button>

              {/* Alerts */}
              {combinedAlerts.length > 0 && (
                <button onClick={() => setActiveTab('alerts')} style={{
                  position: 'relative', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8',
                  cursor: 'pointer', padding: '6px 8px', borderRadius: 9, display: 'flex', transition: 'all 0.15s',
                }}>
                  <Bell size={16} />
                  <span style={{
                    position: 'absolute', top: -4, right: -4, width: 16, height: 16,
                    borderRadius: '50%', background: 'linear-gradient(135deg,#FC6432,#ef4444)',
                    border: '2px solid #090912', fontSize: '0.56rem', fontWeight: 700, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {combinedAlerts.length > 9 ? '9+' : combinedAlerts.length}
                  </span>
                </button>
              )}

              {/* Refresh */}
              <button onClick={() => fetchDashboard()} title="Refresh" style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                color: isRefreshing ? '#818cf8' : '#64748b', cursor: 'pointer',
                padding: '6px 8px', borderRadius: 9, display: 'flex', transition: 'all 0.15s',
              }}>
                <RefreshCw size={15} style={{ animation: isRefreshing ? 'spinCW 0.8s linear infinite' : 'none' }} />
              </button>

              {/* GitHub */}
              <a href="https://github.com/serayd61/stacks-defi-sentinel"
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  color: '#64748b', padding: '6px 8px', borderRadius: 9, display: 'flex',
                  textDecoration: 'none', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as any).style.color = '#fff'; (e.currentTarget as any).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as any).style.color = '#64748b'; (e.currentTarget as any).style.background = 'rgba(255,255,255,0.04)'; }}
              >
                <Github size={16} />
              </a>
            </div>
          </div>

        </header>

        {/* PAGE BODY */}
        <div style={{ flex: 1, padding: '24px 20px 48px' }}>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 20, padding: '12px 16px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              color: '#f87171', fontSize: '0.82rem',
            }}>
              <WifiOff size={15} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}><strong>Connection error</strong> — {error}</div>
              <button onClick={() => fetchDashboard()} style={{
                background: 'rgba(239,68,68,0.15)', border: 'none',
                color: '#f87171', cursor: 'pointer', padding: '5px 9px', borderRadius: 8, display: 'flex',
              }}>
                <RefreshCw size={13} />
              </button>
            </div>
          )}

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 44, height: 44, margin: '0 auto 14px',
                  border: '3px solid rgba(85,70,255,0.12)', borderTopColor: '#5546FF',
                  borderRadius: '50%', animation: 'spinCW 0.8s linear infinite',
                }} />
                <p style={{ color: '#475569', fontSize: '0.85rem' }}>Loading Stacks data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ─── OVERVIEW / DASHBOARD ─── */}
              {activeTab === 'overview' && (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                    gap: 14, marginBottom: 22,
                  }}>
                    <StatCard title="Total Value Locked" value={fmt(dashboardStats?.totalValueLocked||0)} icon={<Wallet size={20}/>} color="purple" trend={12.5}/>
                    <StatCard title="24h Volume" value={fmt(dashboardStats?.totalVolume24h||0)} icon={<TrendingUp size={20}/>} color="orange" trend={-3.2}/>
                    <StatCard title="Transactions (24h)" value={fmtCount(dashboardStats?.totalTransactions24h||0)} icon={<Activity size={20}/>} color="green" subtitle="Confirmed"/>
                    <StatCard title="Active Wallets" value={fmtCount(dashboardStats?.activeWallets24h||0)} icon={<Users size={20}/>} color="blue" subtitle="Unique addresses"/>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, marginBottom: 18 }}>
                    <SwapTable swaps={combinedSwaps} isLive={wsConnected} />
                    <WhaleAlerts alerts={combinedAlerts} />
                  </div>
                  <PoolsTable pools={dashboardStats?.topPools||[]} />
                </>
              )}

              {/* ─── MARKET ─── */}
              {activeTab === 'market' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><MarketOverview /></div>}

              {/* ─── NETWORK HEALTH ─── */}
              {activeTab === 'network' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <NetworkHealth /><ContractActivityMonitor />
                </div>
              )}

              {/* ─── ANALYTICS ─── */}
              {activeTab === 'contracts' && <div style={{ maxWidth: 920, margin: '0 auto' }}><ContractActivityMonitor /></div>}

              {activeTab === 'alerts' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <WhaleAlerts alerts={combinedAlerts} expanded />
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 22 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Activity size={17} color="#818cf8" /> Alert Statistics
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {[
                        { label: 'Large Transfers', type: 'large_transfer', color: '#fb923c' },
                        { label: 'Large Swaps',     type: 'large_swap',     color: '#818cf8' },
                        { label: 'Liquidity Events',type: 'large_liquidity', color: '#60a5fa' },
                      ].map(r => (
                        <div key={r.type} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '11px 14px', background: 'rgba(255,255,255,0.025)',
                          borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{r.label}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: r.color }}>{combinedAlerts.filter(a => a.type === r.type).length}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wallet-analytics' && <div style={{ maxWidth: 800, margin: '0 auto' }}><WalletAnalytics /></div>}

              {/* ─── LIVE DATA ─── */}
              {activeTab === 'swaps'        && <SwapTable swaps={combinedSwaps} isLive={wsConnected} showAll />}
              {activeTab === 'price-alerts' && <div style={{ maxWidth: 600, margin: '0 auto' }}><PriceAlerts /></div>}

              {/* ─── SBTC BRIDGE ─── */}
              {activeTab === 'sbtc' && <div style={{ maxWidth: 960, margin: '0 auto' }}><SBTCBridgeMonitor /></div>}

              {/* ─── AI AGENTS ─── */}
              {activeTab === 'ai-agents' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><AIAgents /></div>}

              {/* ─── EXPLORE ─── */}
              {activeTab === 'gas'         && <div style={{ maxWidth: 800, margin: '0 auto' }}><GasTracker /></div>}
              {activeTab === 'leaderboard' && <div style={{ maxWidth: 920, margin: '0 auto' }}><StacksLeaderboard /></div>}
              {activeTab === 'predict'     && <div style={{ maxWidth: 800, margin: '0 auto' }}><StacksPredict /></div>}

              {/* ─── DONATE BANNER ─── */}
              <div style={{
                marginTop: 48,
                background: 'linear-gradient(135deg,rgba(85,70,255,0.08),rgba(252,100,50,0.06))',
                border: '1px solid rgba(85,70,255,0.2)',
                borderRadius: 14, padding: '18px 22px',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                justifyContent: 'space-between', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#5546FF,#FC6432)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(85,70,255,0.3)',
                  }}>
                    <Zap size={17} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0', marginBottom: 2 }}>
                      Support Stacks Sentinel
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: 440 }}>
                      This tool is free & open-source. If it helps you, consider supporting development with a STX donation.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* STX donate */}
                  <a
                    href="https://explorer.stacks.co/address/SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB?chain=mainnet"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', borderRadius: 9,
                      background: 'linear-gradient(135deg,rgba(85,70,255,0.2),rgba(124,58,237,0.12))',
                      border: '1px solid rgba(85,70,255,0.3)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(85,70,255,0.32)'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'linear-gradient(135deg,rgba(85,70,255,0.2),rgba(124,58,237,0.12))'; }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a5b4fc' }}>STX</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#64748b' }}>
                      SP2PEB…D9WJB
                    </span>
                    <ExternalLink size={11} color="#6366f1" />
                  </a>
                  {/* BTC donate */}
                  <a
                    href="https://mempool.space/address/bc1q8jrgvvmu8ufjaqd47mrjpc8yr3x2rfhgkt9lx7"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', borderRadius: 9,
                      background: 'linear-gradient(135deg,rgba(252,100,50,0.15),rgba(251,146,60,0.08))',
                      border: '1px solid rgba(252,100,50,0.28)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(252,100,50,0.28)'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'linear-gradient(135deg,rgba(252,100,50,0.15),rgba(251,146,60,0.08))'; }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb923c' }}>BTC</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#64748b' }}>
                      bc1q8j…lx7
                    </span>
                    <ExternalLink size={11} color="#fb923c" />
                  </a>
                </div>
              </div>

              {/* FOOTER */}
              <footer style={{
                marginTop: 52, paddingTop: 24,
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#5546FF,#FC6432)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={13} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#e2e8f0' }}>Stacks Sentinel</div>
                      <div style={{ fontSize: '0.7rem', color: '#475569' }}>
                        Powered by <span style={{ color: '#818cf8' }}>Chainhooks</span> · <span style={{ color: '#fb923c' }}>llama3.2:1b</span> AI · Hetzner VPS
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    {[
                      { label: 'Docs',   href: 'https://docs.hiro.so/chainhooks' },
                      { label: 'GitHub', href: 'https://github.com/serayd61/stacks-defi-sentinel' },
                      { label: 'Hiro',   href: 'https://platform.hiro.so' },
                      { label: 'Stacks', href: 'https://stacks.co' },
                    ].map(link => (
                      <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#475569', textDecoration: 'none' }}
                        onMouseEnter={e => ((e.currentTarget as any).style.color = '#818cf8')}
                        onMouseLeave={e => ((e.currentTarget as any).style.color = '#475569')}
                      >
                        {link.label} <ExternalLink size={10} />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Status bar */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 14, padding: '9px 14px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 9, fontSize: '0.7rem', color: '#475569',
                }}>
                  {[
                    { dot: wsConnected ? '#22c55e' : '#f59e0b', label: `WebSocket: ${wsConnected ? 'Live' : 'Reconnecting'}` },
                    { dot: '#818cf8', label: 'AI Cluster: Hetzner VPS · 4 Agents' },
                    { dot: '#60a5fa', label: `Updated: ${lastUpdate.toLocaleTimeString()}` },
                    { dot: '#fb923c', label: 'Network: Stacks Mainnet' },
                  ].map(s => (
                    <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </footer>
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spinCW { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const AppWithProviders: React.FC = () => (
  <WalletProvider>
    <App />
  </WalletProvider>
);

export default AppWithProviders;
