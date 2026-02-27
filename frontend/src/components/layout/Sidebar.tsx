import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { TabType, NAV, BADGE } from '../../types/navigation';
import { fmt } from '../../utils/formatters';

interface SidebarProps {
    open: boolean;
    activeTab: TabType;
    onSelect: (t: TabType) => void;
    onToggle: () => void;
    tvl: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, activeTab, onSelect, onToggle, tvl }) => {
    const [expanded, setExpanded] = useState<string | null>('Overview');

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
                            Stacks Mainnet &middot; AI-Powered
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
                                                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e2e8f0'; } }}
                                                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
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
