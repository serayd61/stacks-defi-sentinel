import React, { useState, useEffect } from 'react';
import {
  Menu, ChevronRight, WifiOff, Brain, Bell, RefreshCw,
  Github, TrendingUp, TrendingDown, Search, Zap,
} from 'lucide-react';
import { TabType, NavItem } from '../../types/navigation';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  setMobileOpen: (v: boolean) => void;
  currentItem?: NavItem;
  wsConnected: boolean;
  combinedAlertsCount: number;
  isRefreshing: boolean;
  fetchDashboard: () => void;
}

const TICKER_ASSETS: TickerItem[] = [
  { symbol: 'STX/USD',  price: 0,   change: 0 },
  { symbol: 'BTC/USD',  price: 0,   change: 0 },
  { symbol: 'ETH/USD',  price: 0,   change: 0 },
  { symbol: 'sBTC/BTC', price: 0.998, change: -0.04 },
  { symbol: 'ALEX',     price: 0,   change: 0 },
];

async function fetchTickerPrices(): Promise<TickerItem[]> {
  try {
    const [cgRes, stacksRes] = await Promise.allSettled([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack,bitcoin,ethereum,alexgo&vs_currencies=usd&include_24hr_change=true'),
      fetch('https://api.mainnet.hiro.so/extended/v1/tx/mempool/stats'),
    ]);

    const items: TickerItem[] = [
      { symbol: 'STX/USD',  price: 0, change: 0 },
      { symbol: 'BTC/USD',  price: 0, change: 0 },
      { symbol: 'ETH/USD',  price: 0, change: 0 },
      { symbol: 'sBTC/BTC', price: 0.998, change: -0.04 },
      { symbol: 'ALEX',     price: 0, change: 0 },
    ];

    if (cgRes.status === 'fulfilled' && cgRes.value.ok) {
      const d = await cgRes.value.json();
      if (d.blockstack) {
        items[0] = { symbol: 'STX/USD', price: d.blockstack.usd || 0, change: d.blockstack.usd_24h_change || 0 };
      }
      if (d.bitcoin) {
        items[1] = { symbol: 'BTC/USD', price: d.bitcoin.usd || 0, change: d.bitcoin.usd_24h_change || 0 };
      }
      if (d.ethereum) {
        items[2] = { symbol: 'ETH/USD', price: d.ethereum.usd || 0, change: d.ethereum.usd_24h_change || 0 };
      }
      if (d.alexgo) {
        items[4] = { symbol: 'ALEX', price: d.alexgo.usd || 0, change: d.alexgo.usd_24h_change || 0 };
      }
    }
    return items;
  } catch {
    return TICKER_ASSETS;
  }
}

function TickerItem({ item }: { item: TickerItem }) {
  const positive = item.change >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 20px' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>
        {item.symbol}
      </span>
      <span style={{
        fontSize: '0.78rem', fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        color: item.price > 0 ? '#F1F5F9' : '#475569',
      }}>
        {item.price > 0
          ? item.price > 100
            ? `$${item.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            : `$${item.price.toFixed(4)}`
          : '—'
        }
      </span>
      {item.price > 0 && (
        <span style={{
          fontSize: '0.68rem', fontWeight: 600,
          color: positive ? '#10B981' : '#EF4444',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {Math.abs(item.change).toFixed(2)}%
        </span>
      )}
      <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
    </span>
  );
}

export const Header: React.FC<HeaderProps> = ({
  activeTab, setActiveTab, setMobileOpen,
  currentItem, wsConnected,
  combinedAlertsCount, isRefreshing, fetchDashboard,
}) => {
  const [ticker, setTicker] = useState<TickerItem[]>(TICKER_ASSETS);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetchTickerPrices().then(setTicker);
    const iv = setInterval(() => fetchTickerPrices().then(setTicker), 60000);
    return () => clearInterval(iv);
  }, []);

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>

      {/* ── PRICE TICKER STRIP ── */}
      <div style={{
        background: 'rgba(6,6,18,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        height: 34,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Label */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 14px', height: '100%',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(108,71,255,0.08)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'live-dot 1.5s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#10B981', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            LIVE PRICES
          </span>
        </div>

        {/* Scrolling ticker */}
        <div className="ticker-wrap" style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
          <div className="ticker-track">
            {[...ticker, ...ticker].map((item, i) => (
              <TickerItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN NAV BAR ── */}
      <div style={{
        background: 'rgba(6,6,18,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        height: 52,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px', gap: 14,
      }}>

        {/* Left: mobile menu + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', cursor: 'pointer',
              padding: '6px 8px', borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: 'linear-gradient(135deg, #6C47FF, #FC6432)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={11} color="white" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 600 }}>Sentinel</span>
            </div>

            {currentItem && (
              <>
                <ChevronRight size={12} color="#1E293B" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: 'rgba(108,71,255,0.12)',
                    border: '1px solid rgba(108,71,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <currentItem.icon size={11} color="#818CF8" />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>
                    {currentItem.label}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

          {/* WS Status */}
          <div
            className="hidden sm:flex"
            style={{
              alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20,
              fontSize: '0.71rem', fontWeight: 600,
              background: wsConnected ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${wsConnected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
              color: wsConnected ? '#10B981' : '#F59E0B',
            }}
          >
            {wsConnected ? (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#10B981', flexShrink: 0,
                  animation: 'live-dot 1.5s infinite',
                }} />
                Live
              </>
            ) : (
              <><WifiOff size={10} /> Connecting</>
            )}
          </div>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#64748B', cursor: 'pointer',
              padding: '6px 8px', borderRadius: 9,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <Search size={15} />
          </button>

          {/* AI */}
          <button
            onClick={() => setActiveTab('ai-agents')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 9,
              background: activeTab === 'ai-agents'
                ? 'rgba(108,71,255,0.2)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeTab === 'ai-agents' ? 'rgba(108,71,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: activeTab === 'ai-agents' ? '#818CF8' : '#64748B',
              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (activeTab !== 'ai-agents') { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94A3B8'; } }}
            onMouseLeave={e => { if (activeTab !== 'ai-agents') { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748B'; } }}
          >
            <Brain size={13} />
            <span className="hidden sm:inline">AI</span>
          </button>

          {/* Alerts */}
          {combinedAlertsCount > 0 && (
            <button
              onClick={() => setActiveTab('alerts')}
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#64748B', cursor: 'pointer',
                padding: '6px 8px', borderRadius: 9,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <Bell size={15} />
              <span style={{
                position: 'absolute', top: -5, right: -5,
                minWidth: 16, height: 16, borderRadius: 99,
                background: 'linear-gradient(135deg, #FC6432, #EF4444)',
                border: '2px solid #070714',
                fontSize: '0.55rem', fontWeight: 800, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>
                {combinedAlertsCount > 9 ? '9+' : combinedAlertsCount}
              </span>
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => fetchDashboard()}
            title="Refresh data"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: isRefreshing ? '#818CF8' : '#64748B',
              cursor: 'pointer', padding: '6px 8px', borderRadius: 9,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = isRefreshing ? '#818CF8' : '#64748B'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spinCW 0.8s linear infinite' : 'none' }} />
          </button>

          {/* GitHub */}
          <a
            href="https://github.com/serayd61/stacks-defi-sentinel"
            target="_blank" rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#64748B', padding: '6px 8px', borderRadius: 9,
              display: 'flex', alignItems: 'center', textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748B'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <Github size={15} />
          </a>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div style={{
          background: 'rgba(6,6,18,0.98)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 20px',
          animation: 'slide-in-up 0.15s ease-out',
        }}>
          <div style={{ position: 'relative', maxWidth: 480 }}>
            <Search size={15} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              autoFocus
              placeholder="Search contracts, wallets, tokens..."
              onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              style={{
                width: '100%', paddingLeft: 38,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#F1F5F9',
                fontSize: '0.85rem', height: 38,
              }}
            />
            <kbd style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              padding: '2px 6px', borderRadius: 5, fontSize: '0.64rem',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#475569',
            }}>ESC</kbd>
          </div>
        </div>
      )}
    </header>
  );
};
