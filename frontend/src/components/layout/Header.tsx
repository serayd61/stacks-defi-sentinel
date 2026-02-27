import React from 'react';
import { Menu, ChevronRight, WifiOff, Brain, Bell, RefreshCw, Github } from 'lucide-react';
import { TabType, NavItem } from '../../types/navigation';

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

export const Header: React.FC<HeaderProps> = ({
    activeTab,
    setActiveTab,
    setMobileOpen,
    currentItem,
    wsConnected,
    combinedAlertsCount,
    isRefreshing,
    fetchDashboard
}) => {
    return (
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
                    {combinedAlertsCount > 0 && (
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
                                {combinedAlertsCount > 9 ? '9+' : combinedAlertsCount}
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
    );
};
