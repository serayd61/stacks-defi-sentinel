import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Zap, Activity } from 'lucide-react';
import { TabType, NAV, BADGE } from '../../types/navigation';
import { fmt } from '../../utils/formatters';

interface SidebarProps {
  open: boolean;
  activeTab: TabType;
  onSelect: (t: TabType) => void;
  onToggle: () => void;
  tvl: number;
}

const BADGE_STYLE: Record<string, React.CSSProperties> = {
  live: { background: 'rgba(239,68,68,0.14)', color: '#F87171', border: '1px solid rgba(239,68,68,0.22)' },
  hot:  { background: 'rgba(251,146,60,0.14)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.22)' },
  new:  { background: 'rgba(16,185,129,0.14)', color: '#34D399', border: '1px solid rgba(16,185,129,0.22)' },
};

export const Sidebar: React.FC<SidebarProps> = ({ open, activeTab, onSelect, onToggle, tvl }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Overview', 'Analytics']));

  const toggleSection = (label: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <aside style={{
      width: open ? 252 : 68,
      minHeight: '100vh', height: '100vh',
      position: 'fixed', left: 0, top: 0,
      background: 'rgba(6,6,18,0.97)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 40, overflow: 'hidden',
    }}>

      {/* ─── LOGO ─── */}
      <div style={{
        padding: open ? '18px 16px 16px' : '18px 0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center',
        gap: 12, flexShrink: 0,
        justifyContent: open ? 'flex-start' : 'center',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Logo icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6C47FF 0%, #4F46E5 50%, #FC6432 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(108,71,255,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>
            <Zap size={17} color="white" strokeWidth={2.5} />
          </div>
          {/* Live dot */}
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 9, height: 9, borderRadius: '50%',
            background: '#10B981', border: '2px solid #06060f',
            animation: 'pulse-ring 2s infinite',
          }} />
        </div>

        {open && (
          <div style={{ overflow: 'hidden', lineHeight: 1 }}>
            <div style={{
              fontWeight: 700, fontSize: '0.92rem', color: '#F1F5F9',
              letterSpacing: '-0.025em', whiteSpace: 'nowrap',
            }}>
              Stacks Sentinel
            </div>
            <div style={{
              fontSize: '0.65rem', color: '#475569',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 3, whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>
              Mainnet · AI-Powered
            </div>
          </div>
        )}
      </div>

      {/* ─── TVL STRIP (collapsed mode) ─── */}
      {!open && tvl > 0 && (
        <div title={`TVL: ${fmt(tvl)}`} style={{
          margin: '10px 8px 4px',
          padding: '8px 0',
          background: 'rgba(108,71,255,0.1)',
          border: '1px solid rgba(108,71,255,0.18)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Activity size={13} color="#818cf8" />
        </div>
      )}

      {/* ─── NAVIGATION ─── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px 8px' }}>
        {NAV.map(section => {
          const isExpanded = expanded.has(section.label);
          return (
            <div key={section.label} style={{ marginBottom: 2 }}>
              {open ? (
                <>
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.label)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 10px 4px',
                      background: 'none', border: 'none',
                      color: '#334155', cursor: 'pointer',
                      fontSize: '0.66rem', fontWeight: 700,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      fontFamily: 'inherit', borderRadius: 6,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
                  >
                    <span>{section.label}</span>
                    <ChevronDown size={11} style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      color: '#334155',
                    }} />
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: 2, marginBottom: 4 }}>
                      {section.items.map(item => {
                        const active = activeTab === item.id;
                        const b = item.badge ? BADGE_STYLE[item.badge] : null;
                        return (
                          <button
                            key={item.id}
                            onClick={() => onSelect(item.id)}
                            style={{
                              width: '100%',
                              display: 'flex', alignItems: 'center', gap: 9,
                              padding: '8px 10px',
                              borderRadius: 9, marginBottom: 1,
                              background: active
                                ? 'linear-gradient(90deg, rgba(108,71,255,0.2), rgba(79,70,229,0.08))'
                                : 'transparent',
                              border: active
                                ? '1px solid rgba(108,71,255,0.28)'
                                : '1px solid transparent',
                              color: active ? '#E2E8F0' : '#64748B',
                              cursor: 'pointer', textAlign: 'left',
                              fontFamily: 'inherit', fontSize: '0.82rem',
                              fontWeight: active ? 600 : 400,
                              transition: 'all 0.12s',
                              boxShadow: active ? '0 2px 8px rgba(108,71,255,0.1)' : 'none',
                            }}
                            onMouseEnter={e => {
                              if (!active) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.color = '#CBD5E1';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!active) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#64748B';
                              }
                            }}
                          >
                            <item.icon
                              size={14}
                              color={active ? '#818CF8' : '#475569'}
                              style={{ flexShrink: 0 }}
                            />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.label}
                            </span>
                            {b && (
                              <span style={{
                                ...b,
                                padding: '1px 6px',
                                borderRadius: 99,
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                flexShrink: 0,
                              }}>
                                {BADGE[item.badge!]?.label}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ─── COLLAPSED: icons only ─── */
                <div style={{ marginBottom: 2 }}>
                  {section.items.map(item => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        title={item.label}
                        style={{
                          width: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '9px 0', marginBottom: 1,
                          borderRadius: 9,
                          background: active ? 'rgba(108,71,255,0.18)' : 'transparent',
                          border: active ? '1px solid rgba(108,71,255,0.3)' : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <item.icon size={15} color={active ? '#818CF8' : '#475569'} />
                      </button>
                    );
                  })}
                  {/* Section separator */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 8px 6px' }} />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ─── FOOTER ─── */}
      <div style={{
        padding: open ? '10px 10px 14px' : '10px 8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        {/* TVL Card (open mode) */}
        {open && tvl > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(108,71,255,0.1), rgba(252,100,50,0.06))',
            border: '1px solid rgba(108,71,255,0.2)',
            borderRadius: 12, padding: '10px 12px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stacks TVL</span>
              <span style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'live-dot 1.5s infinite' }} />
                LIVE
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#F1F5F9', letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace' }}>
              {fmt(tvl)}
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={onToggle}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: open ? 'flex-start' : 'center',
            gap: 8, padding: '7px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 9, color: '#475569',
            cursor: 'pointer', fontSize: '0.76rem',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#94A3B8';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
        >
          {open ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          {open && <span style={{ fontWeight: 500 }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
