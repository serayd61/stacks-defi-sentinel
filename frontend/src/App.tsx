import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Wallet, 
  Zap,
  Github,
  ExternalLink,
  Wifi,
  WifiOff,
  Bell,
  BarChart3,
  Droplets,
  ArrowRightLeft,
  Clock,
  RefreshCw,
  CreditCard,
  Crown
} from 'lucide-react';
import { StatCard } from './components/StatCard';
import { SwapTable } from './components/SwapTable';
import { WhaleAlerts } from './components/WhaleAlerts';
import { PoolsTable } from './components/PoolsTable';
import SubscriptionPanel from './components/SubscriptionPanel';
import WalletModal from './components/WalletModal';
import SBTCDashboard from './components/SBTCDashboard';
import StackingTracker from './components/StackingTracker';
import BlockExplorer from './components/BlockExplorer';
import TokenAnalytics from './components/TokenAnalytics';
import SwapInterface from './components/SwapInterface';
import NFTGallery from './components/NFTGallery';
import TokenSale from './components/TokenSale';
import StakePanel from './components/StakePanel';
import ProMembership from './components/ProMembership';
import { WalletProvider } from './contexts/WalletContext';
import { useApi } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://stacks-defi-sentinel-production.up.railway.app/ws';

function App() {
  const { dashboardStats, isLoading, error, fetchDashboard } = useApi();
  const { isConnected, events } = useWebSocket(WS_URL);
  const [activeTab, setActiveTab] = useState<'overview' | 'swaps' | 'alerts' | 'ecosystem' | 'subscribe' | 'token-sale' | 'stake' | 'membership'>('overview');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboard();
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatCount = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  // Combine API data with real-time WebSocket events
  const combinedSwaps = [
    ...events.swaps,
    ...(dashboardStats?.recentSwaps || []),
    ...((dashboardStats as any)?.recentTransactions || []),
  ].slice(0, 30);

  const combinedAlerts = [
    ...events.alerts,
    ...(dashboardStats?.recentAlerts || []),
  ].slice(0, 15);

  const totalAlerts = combinedAlerts.length + events.alerts.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5546FF] via-purple-500 to-[#FC6432] flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0a0a0f] animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-orange-200 bg-clip-text text-transparent">
                  Stacks DeFi Sentinel
                </h1>
                <p className="text-xs text-gray-500 font-mono">Powered by Chainhooks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Last Update */}
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>Updated {lastUpdate.toLocaleTimeString()}</span>
              </div>

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Connecting...</span>
                  </>
                )}
              </div>

              {/* Alerts Badge */}
              {totalAlerts > 0 && (
                <div className="relative">
                  <Bell className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                    {totalAlerts}
                  </span>
                </div>
              )}

              {/* Network Badge */}
              <span className="px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-orange-500/10 text-purple-300 rounded-full text-sm font-medium border border-purple-500/20">
                Mainnet
              </span>

              {/* GitHub Link */}
              <a 
                href="https://github.com/serayd61/stacks-defi-sentinel" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <Github className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
              </a>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 mt-4 -mb-4">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'swaps', label: 'Swaps', icon: ArrowRightLeft },
              { id: 'alerts', label: 'Whale Alerts', icon: Bell },
              { id: 'ecosystem', label: 'Ecosystem', icon: Activity },
              { id: 'token-sale', label: 'Token Sale', icon: CreditCard },
              { id: 'stake', label: 'Stake & Earn', icon: Droplets },
              { id: 'membership', label: 'Pro Access', icon: Crown },
              { id: 'subscribe', label: 'Subscribe', icon: CreditCard },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/5 text-white border-t border-l border-r border-white/10'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'alerts' && totalAlerts > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                    {totalAlerts}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-sm text-red-400/70">{error}</p>
            </div>
            <button 
              onClick={() => fetchDashboard()}
              className="ml-auto p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
              </div>
              <p className="text-gray-500">Loading DeFi data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                title="Total Value Locked"
                value={formatNumber(dashboardStats?.totalValueLocked || 0)}
                icon={<Wallet className="w-6 h-6" />}
                color="purple"
                trend={12.5}
              />
              <StatCard
                title="24h Volume"
                value={formatNumber(dashboardStats?.totalVolume24h || 0)}
                icon={<TrendingUp className="w-6 h-6" />}
                color="orange"
                trend={-3.2}
              />
              <StatCard
                title="Transactions"
                value={formatCount(dashboardStats?.totalTransactions24h || 0)}
                icon={<Activity className="w-6 h-6" />}
                color="green"
                subtitle="Last 24 hours"
              />
              <StatCard
                title="Active Wallets"
                value={formatCount(dashboardStats?.activeWallets24h || 0)}
                icon={<Users className="w-6 h-6" />}
                color="blue"
                subtitle="Unique addresses"
              />
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <SwapTable swaps={combinedSwaps} isLive={isConnected} />
                </div>
                <div>
                  <WhaleAlerts alerts={combinedAlerts} />
                </div>
              </div>
            )}

            {activeTab === 'swaps' && (
              <SwapTable swaps={combinedSwaps} isLive={isConnected} showAll />
            )}

            {activeTab === 'alerts' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WhaleAlerts alerts={combinedAlerts} expanded />
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Alert Statistics
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                      <span className="text-gray-400">Large Transfers</span>
                      <span className="font-mono font-bold text-orange-400">
                        {combinedAlerts.filter(a => a.type === 'large_transfer').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                      <span className="text-gray-400">Large Swaps</span>
                      <span className="font-mono font-bold text-purple-400">
                        {combinedAlerts.filter(a => a.type === 'large_swap').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                      <span className="text-gray-400">Liquidity Events</span>
                      <span className="font-mono font-bold text-blue-400">
                        {combinedAlerts.filter(a => a.type === 'large_liquidity').length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ecosystem Section */}
            {activeTab === 'ecosystem' && (
              <div className="space-y-6">
                {/* Swap Interface - Full Width */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <SwapInterface />
                  <div className="lg:col-span-2">
                    <TokenAnalytics />
                  </div>
                </div>
                {/* sBTC and Stacking */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SBTCDashboard />
                  <StackingTracker />
                </div>
                {/* NFT and Block Explorer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <NFTGallery />
                  <BlockExplorer />
                </div>
              </div>
            )}

            {/* Token Sale Section */}
            {activeTab === 'token-sale' && (
              <div className="max-w-4xl mx-auto">
                <TokenSale />
              </div>
            )}

            {/* Stake & Earn Section */}
            {activeTab === 'stake' && (
              <div className="max-w-4xl mx-auto">
                <StakePanel />
              </div>
            )}

            {/* Pro Membership Section */}
            {activeTab === 'membership' && (
              <div className="max-w-5xl mx-auto">
                <ProMembership />
              </div>
            )}

            {/* Subscribe Section */}
            {activeTab === 'subscribe' && (
              <div className="max-w-2xl mx-auto">
                <SubscriptionPanel />
              </div>
            )}

            {/* Pools Section */}
            {activeTab === 'overview' && (
              <div className="mt-8">
                <PoolsTable pools={dashboardStats?.topPools || []} />
              </div>
            )}

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t border-white/5">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Built with <span className="text-purple-400">Chainhooks</span> • Real-time blockchain monitoring
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <a 
                    href="https://docs.hiro.so/chainhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    Documentation
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a 
                    href="https://github.com/serayd61/stacks-defi-sentinel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-400 transition-colors"
                  >
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a 
                    href="https://platform.hiro.so"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    Hiro Platform
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

// Wrap App with WalletProvider
const AppWithWallet: React.FC = () => (
  <WalletProvider>
    <App />
    <WalletModal />
  </WalletProvider>
);

export default AppWithWallet;
