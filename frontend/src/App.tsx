import React, { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Users, Wallet, Zap, Github, ExternalLink,
  WifiOff, Bell, ArrowRightLeft, RefreshCw,
  ChevronRight, Menu, X,
  Target, Star, Fuel,
  ChevronDown, Code, Server, Search,
  Home, ChevronLeft, Brain, Bitcoin,
  Layers, Image, BarChart3, Link2, PieChart, Blocks, BarChart2,
  Globe, Fish, Vote, Shield, Rocket, Radio,
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
import BlockExplorer from './components/BlockExplorer';
import PortfolioTracker from './components/PortfolioTracker';
import StackingTracker from './components/StackingTracker';
import DEXAggregator from './components/DEXAggregator';
import NFTGallery from './components/NFTGallery';
import ChainhooksMonitor from './components/ChainhooksMonitor';
import TokenAnalytics from './components/TokenAnalytics';
import UserRevenueAnalytics from './components/UserRevenueAnalytics';
import WebIntelligence from './components/WebIntelligence';
import WhaleIntelligence from './components/WhaleIntelligence';
import DefiScanner from './components/DefiScanner';
import GovernanceTracker from './components/GovernanceTracker';
import SbtcBridge from './components/SbtcBridge';
import TokenLaunches from './components/TokenLaunches';
import SocialPulse from './components/SocialPulse';
import { WalletProvider } from './contexts/WalletContext';
import { useApi } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';
import { TabType, NAV, BADGE } from './types/navigation';
import { fmt, fmtCount } from './utils/formatters';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://stacks-defi-sentinel-production.up.railway.app/ws';



/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
function App() {
  const { dashboardStats, isLoading, isRefreshing, error, fetchDashboard } = useApi();
  const { isConnected: wsConnected, events } = useWebSocket(WS_URL);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
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
    <div style={{ minHeight: '100vh', background: '#04040e', color: '#fff', display: 'flex' }}>

      {/* Ambient glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, background: 'radial-gradient(circle,rgba(108,71,255,0.08) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -150, width: 600, height: 600, background: 'radial-gradient(circle,rgba(252,100,50,0.05) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '40%', left: '30%', width: 400, height: 400, background: 'radial-gradient(circle,rgba(16,185,129,0.03) 0%,transparent 70%)', borderRadius: '50%' }} />
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
        <Header 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setMobileOpen={setMobileOpen}
          currentItem={currentItem}
          wsConnected={wsConnected}
          combinedAlertsCount={combinedAlerts.length}
          isRefreshing={isRefreshing}
          fetchDashboard={fetchDashboard}
        />

        {/* PAGE BODY */}
        <div style={{ flex: 1, padding: '22px 20px 60px' }}>

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, margin: '0 auto 16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(108,71,255,0.12)',
                  borderTopColor: '#6C47FF',
                  animation: 'spinCW 0.7s linear infinite',
                  boxShadow: '0 0 20px rgba(108,71,255,0.2)',
                }} />
                <p style={{ color: '#475569', fontSize: '0.82rem', fontWeight: 500 }}>Loading Stacks data...</p>
                <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: 4 }}>Connecting to Mainnet</p>
              </div>
            </div>
          ) : (
            <>
              {/* ─── OVERVIEW / DASHBOARD ─── */}
              {activeTab === 'overview' && (
                <>
                  {/* Section label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: 'linear-gradient(180deg,#6C47FF,#FC6432)' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Network Overview
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                    <span style={{ fontSize: '0.68rem', color: '#334155' }}>Updated {lastUpdate.toLocaleTimeString()}</span>
                  </div>

                  {/* Stat cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                    gap: 14, marginBottom: 22,
                  }}>
                    <StatCard title="Total Value Locked" value={fmt(dashboardStats?.totalValueLocked || 0)} icon={<Wallet size={18} />} color="purple" trend={12.5} />
                    <StatCard title="24h Volume" value={fmt(dashboardStats?.totalVolume24h || 0)} icon={<TrendingUp size={18} />} color="orange" trend={-3.2} />
                    <StatCard title="Transactions (24h)" value={fmtCount(dashboardStats?.totalTransactions24h || 0)} icon={<Activity size={18} />} color="green" subtitle="Confirmed on-chain" />
                    <StatCard title="Active Wallets" value={fmtCount(dashboardStats?.activeWallets24h || 0)} icon={<Users size={18} />} color="blue" subtitle="Unique addresses" />
                  </div>

                  {/* Live data grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>
                    <SwapTable swaps={combinedSwaps} isLive={wsConnected} />
                    <WhaleAlerts alerts={combinedAlerts} />
                  </div>

                  <PoolsTable pools={dashboardStats?.topPools || []} />
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
                        { label: 'Large Swaps', type: 'large_swap', color: '#818cf8' },
                        { label: 'Liquidity Events', type: 'large_liquidity', color: '#60a5fa' },
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

              {/* ─── ANALYTICS (new) ─── */}
              {activeTab === 'portfolio' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><PortfolioTracker /></div>}
              {activeTab === 'stacking' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><StackingTracker /></div>}
              {activeTab === 'token-analytics' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><TokenAnalytics /></div>}
              {activeTab === 'user-analytics' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><UserRevenueAnalytics /></div>}

              {/* ─── LIVE DATA ─── */}
              {activeTab === 'swaps' && <SwapTable swaps={combinedSwaps} isLive={wsConnected} showAll />}
              {activeTab === 'dex' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><DEXAggregator /></div>}
              {activeTab === 'block-explorer' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><BlockExplorer /></div>}
              {activeTab === 'price-alerts' && <div style={{ maxWidth: 600, margin: '0 auto' }}><PriceAlerts /></div>}

              {/* ─── SBTC BRIDGE ─── */}
              {activeTab === 'sbtc' && <div style={{ maxWidth: 960, margin: '0 auto' }}><SBTCBridgeMonitor /></div>}

              {/* ─── AI AGENTS ─── */}
              {activeTab === 'ai-agents' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><AIAgents /></div>}
              {activeTab === 'web-intel' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><WebIntelligence /></div>}
              {activeTab === 'whale-intel' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><WhaleIntelligence /></div>}
              {activeTab === 'defi-scan' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><DefiScanner /></div>}
              {activeTab === 'governance' && <div style={{ maxWidth: 900, margin: '0 auto' }}><GovernanceTracker /></div>}
              {activeTab === 'sbtc-bridge' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><SbtcBridge /></div>}
              {activeTab === 'token-launches' && <div style={{ maxWidth: 900, margin: '0 auto' }}><TokenLaunches /></div>}
              {activeTab === 'social-pulse' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><SocialPulse /></div>}
              {activeTab === 'chainhooks' && <div style={{ maxWidth: 1000, margin: '0 auto' }}><ChainhooksMonitor /></div>}

              {/* ─── EXPLORE ─── */}
              {activeTab === 'gas' && <div style={{ maxWidth: 800, margin: '0 auto' }}><GasTracker /></div>}
              {activeTab === 'nfts' && <div style={{ maxWidth: 1100, margin: '0 auto' }}><NFTGallery /></div>}
              {activeTab === 'leaderboard' && <div style={{ maxWidth: 920, margin: '0 auto' }}><StacksLeaderboard /></div>}
              {activeTab === 'predict' && <div style={{ maxWidth: 800, margin: '0 auto' }}><StacksPredict /></div>}

              {/* ─── SUPPORT BANNER ─── */}
              <div style={{
                marginTop: 48,
                position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(108,71,255,0.07) 0%, rgba(79,70,229,0.04) 50%, rgba(252,100,50,0.05) 100%)',
                border: '1px solid rgba(108,71,255,0.18)',
                borderRadius: 16, padding: '20px 24px',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                justifyContent: 'space-between', gap: 14,
              }}>
                {/* bg glow */}
                <div style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, background: 'radial-gradient(circle,rgba(108,71,255,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg,#6C47FF,#FC6432)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(108,71,255,0.35)',
                  }}>
                    <Zap size={18} color="white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#E2E8F0', marginBottom: 3 }}>
                      Support Stacks Sentinel
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#475569', maxWidth: 400 }}>
                      Free & open-source. Help keep the platform running with a small donation.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
                  <a
                    href="https://explorer.stacks.co/address/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W?chain=mainnet"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px', borderRadius: 10,
                      background: 'rgba(108,71,255,0.12)',
                      border: '1px solid rgba(108,71,255,0.28)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(108,71,255,0.22)'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(108,71,255,0.12)'; }}
                  >
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818CF8', letterSpacing: '0.02em' }}>STX</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#64748B' }}>SP2PEB…D9WJB</span>
                    <ExternalLink size={11} color="#818CF8" />
                  </a>
                  <a
                    href="https://mempool.space/address/bc1q8jrgvvmu8ufjaqd47mrjpc8yr3x2rfhgkt9lx7"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px', borderRadius: 10,
                      background: 'rgba(252,100,50,0.1)',
                      border: '1px solid rgba(252,100,50,0.25)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(252,100,50,0.2)'; }}
                    onMouseLeave={e => { (e.currentTarget as any).style.background = 'rgba(252,100,50,0.1)'; }}
                  >
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#FB923C', letterSpacing: '0.02em' }}>BTC</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#64748B' }}>bc1q8j…lx7</span>
                    <ExternalLink size={11} color="#FB923C" />
                  </a>
                </div>
              </div>

              {/* ─── FOOTER ─── */}
              <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: 'linear-gradient(135deg,#6C47FF,#FC6432)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(108,71,255,0.3)',
                    }}>
                      <Zap size={14} color="white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#E2E8F0', letterSpacing: '-0.01em' }}>Stacks Sentinel</div>
                      <div style={{ fontSize: '0.68rem', color: '#334155', marginTop: 1 }}>
                        Powered by <span style={{ color: '#818CF8' }}>Chainhooks</span>
                        {' · '}
                        <span style={{ color: '#FB923C' }}>AI</span>
                        {' · '}Hiro Platform
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {[
                      { label: 'Docs', href: 'https://docs.hiro.so/chainhooks' },
                      { label: 'GitHub', href: 'https://github.com/serayd61/stacks-defi-sentinel' },
                      { label: 'Hiro', href: 'https://platform.hiro.so' },
                      { label: 'Stacks', href: 'https://stacks.co' },
                    ].map(link => (
                      <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: '#334155', textDecoration: 'none', fontWeight: 500 }}
                        onMouseEnter={e => ((e.currentTarget as any).style.color = '#818CF8')}
                        onMouseLeave={e => ((e.currentTarget as any).style.color = '#334155')}
                      >
                        {link.label} <ExternalLink size={9} />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Status bar */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 16,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: 10, fontSize: '0.69rem', color: '#334155',
                }}>
                  {[
                    { dot: wsConnected ? '#10B981' : '#F59E0B', label: `WebSocket: ${wsConnected ? 'Live' : 'Reconnecting'}` },
                    { dot: '#818CF8', label: 'AI Cluster: 4 Agents Active' },
                    { dot: '#60A5FA', label: `Last sync: ${lastUpdate.toLocaleTimeString()}` },
                    { dot: '#FB923C', label: 'Stacks Mainnet' },
                  ].map(s => (
                    <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
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
        @keyframes live-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes slide-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ticker-wrap { overflow:hidden; white-space:nowrap; display:flex; mask-image:linear-gradient(90deg,transparent,black 5%,black 95%,transparent); }
        .ticker-track { display:inline-flex; animation:ticker-scroll 50s linear infinite; }
        .ticker-track:hover { animation-play-state:paused; }
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
