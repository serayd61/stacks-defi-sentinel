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
  Crown,
  Trophy,
  Vote,
  ChevronRight,
  Menu,
  X,
  Landmark,
  Shield,
  Coins,
  Target,
  Award,
  BookOpen,
  PieChart,
  Fuel,
  Gift,
  Layers,
  Database,
  LineChart,
  Star,
  ChevronDown,
  Code,
  Server,
  Search
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
import SBTCBridgeMonitor from './components/SBTCBridgeMonitor';
import DEXAggregator from './components/DEXAggregator';
import StacksBadge from './components/StacksBadge';
import StacksPredict from './components/StacksPredict';
import StacksPassport from './components/StacksPassport';
import StacksLeaderboard from './components/StacksLeaderboard';
import PortfolioTracker from './components/PortfolioTracker';
import GasTracker from './components/GasTracker';
import DAOVoting from './components/DAOVoting';
import ReferralSystem from './components/ReferralSystem';
import LendingPool from './components/LendingPool';
import LivePriceTicker from './components/LivePriceTicker';
import NetworkHealth from './components/NetworkHealth';
import ProtocolRankings from './components/ProtocolRankings';
import ContractActivityMonitor from './components/ContractActivityMonitor';
import WalletAnalytics from './components/WalletAnalytics';
import PriceAlerts from './components/PriceAlerts';
import MarketOverview from './components/MarketOverview';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { useApi } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';
import StacksWalletConnect from './components/StacksWalletConnect';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://stacks-defi-sentinel-production.up.railway.app/ws';

type TabType = 'overview' | 'swaps' | 'alerts' | 'ecosystem' | 'subscribe' | 'token-sale' | 'stake' | 'lending' | 'membership' | 'sbtc' | 'aggregator' | 'badges' | 'predict' | 'passport' | 'leaderboard' | 'portfolio' | 'gas' | 'dao' | 'referral' | 'network' | 'protocols' | 'contracts' | 'wallet-analytics' | 'price-alerts' | 'market';

// Navigation item type
interface NavItem {
  id: string;
  label: string;
  icon: any;
  description: string;
  hot?: boolean;
  new?: boolean;
}

interface NavCategory {
  name: string;
  icon: any;
  items: NavItem[];
}

// Navigation categories
const navCategories: NavCategory[] = [
  {
    name: 'Overview',
    icon: BarChart3,
    items: [
      { id: 'overview', label: 'Dashboard', icon: BarChart3, description: 'Platform overview & stats' },
      { id: 'market', label: 'Market Overview', icon: TrendingUp, description: 'Live market data', hot: true },
      { id: 'network', label: 'Network Health', icon: Server, description: 'Stacks network stats', new: true },
      { id: 'protocols', label: 'DeFi Rankings', icon: Trophy, description: 'Protocol rankings' },
    ]
  },
  {
    name: 'Trading',
    icon: ArrowRightLeft,
    items: [
      { id: 'aggregator', label: 'DEX Aggregator', icon: Zap, description: 'Best swap rates', hot: true },
      { id: 'swaps', label: 'Swap History', icon: ArrowRightLeft, description: 'Recent trades' },
      { id: 'price-alerts', label: 'Price Alerts', icon: Bell, description: 'Custom alerts', new: true },
    ]
  },
  {
    name: 'Analytics',
    icon: LineChart,
    items: [
      { id: 'contracts', label: 'Contract Activity', icon: Code, description: 'Smart contract calls', new: true },
      { id: 'wallet-analytics', label: 'Wallet Analytics', icon: Search, description: 'Analyze any wallet', new: true },
      { id: 'alerts', label: 'Whale Alerts', icon: Bell, description: 'Large transactions' },
    ]
  },
  {
    name: 'DeFi',
    icon: Landmark,
    items: [
      { id: 'lending', label: 'Lending', icon: Landmark, description: 'Borrow & lend' },
      { id: 'stake', label: 'Staking', icon: Coins, description: 'Earn rewards' },
      { id: 'sbtc', label: 'sBTC Bridge', icon: Database, description: 'Bitcoin bridge' },
    ]
  },
  {
    name: 'Token',
    icon: Coins,
    items: [
      { id: 'token-sale', label: 'Token Sale', icon: CreditCard, description: 'Buy SNTL tokens', hot: true },
      { id: 'membership', label: 'Pro Access', icon: Crown, description: 'Premium features' },
      { id: 'gas', label: 'Gas Tracker', icon: Fuel, description: 'Transaction fees' },
    ]
  },
  {
    name: 'Governance',
    icon: Shield,
    items: [
      { id: 'dao', label: 'DAO Voting', icon: Vote, description: 'Governance proposals' },
      { id: 'passport', label: 'Passport', icon: BookOpen, description: 'Digital identity' },
      { id: 'badges', label: 'Badges', icon: Award, description: 'Achievement NFTs' },
    ]
  },
  {
    name: 'More',
    icon: Layers,
    items: [
      { id: 'ecosystem', label: 'Explore', icon: Activity, description: 'Full ecosystem' },
      { id: 'portfolio', label: 'Portfolio', icon: PieChart, description: 'Track your assets' },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, description: 'Top performers' },
      { id: 'predict', label: 'Predictions', icon: Target, description: 'Market predictions' },
      { id: 'referral', label: 'Referrals', icon: Gift, description: 'Earn rewards' },
    ]
  },
];

function App() {
  const { dashboardStats, isLoading, isRefreshing, error, fetchDashboard } = useApi();
  const { isConnected: wsConnected, events } = useWebSocket(WS_URL);
  const { isConnected: walletConnected, userAddress, setShowWalletModal } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Overview');

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

  const currentNavItem = navCategories.flatMap(c => c.items).find(i => i.id === activeTab);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 h-full bg-[#0d0d14]/95 backdrop-blur-xl border-r border-white/5 z-40 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5546FF] via-purple-500 to-[#FC6432] flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d0d14]" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-white">DeFi Sentinel</h1>
                <p className="text-[10px] text-gray-500 font-mono">Stacks Mainnet</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navCategories.map((category) => (
            <div key={category.name} className="mb-2">
              {sidebarOpen ? (
                <>
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <category.icon className="w-4 h-4" />
                      {category.name}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedCategory === category.name ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedCategory === category.name && (
                    <div className="space-y-1 mt-1">
                      {category.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id as TabType)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                            activeTab === item.id
                              ? 'bg-gradient-to-r from-purple-500/20 to-orange-500/10 text-white border border-purple-500/30'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-purple-400'}`} />
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              {item.label}
                              {item.hot && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded-full">HOT</span>}
                              {item.new && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full">NEW</span>}
                            </div>
                          </div>
                          {activeTab === item.id && <ChevronRight className="w-4 h-4 text-purple-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as TabType)}
                      className={`w-full flex items-center justify-center p-3 rounded-xl transition-all group ${
                        activeTab === item.id
                          ? 'bg-gradient-to-r from-purple-500/20 to-orange-500/10 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                      title={item.label}
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-purple-400' : ''}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5">
          {sidebarOpen ? (
            <div className="space-y-3">
              {/* Quick Stats */}
              <div className="bg-gradient-to-r from-purple-500/10 to-orange-500/10 rounded-xl p-3 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">TVL</span>
                  <span className="text-xs text-green-400">+12.5%</span>
                </div>
                <div className="text-lg font-bold text-white">$142.50M</div>
              </div>
              
              {/* Toggle Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span className="text-xs">Collapse</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-full flex items-center justify-center py-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside className="w-72 h-full bg-[#0d0d14] p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5546FF] to-[#FC6432] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-white">DeFi Sentinel</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {navCategories.map((category) => (
              <div key={category.name} className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">{category.name}</div>
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as TabType); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        activeTab === item.id
                          ? 'bg-purple-500/20 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 lg:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Mobile Menu + Breadcrumb */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
                >
                  <Menu className="w-5 h-5 text-gray-400" />
                </button>
                
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{currentNavItem?.label || 'Dashboard'}</span>
                  {currentNavItem?.description && (
                    <>
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-400">{currentNavItem.description}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Status + Wallet */}
              <div className="flex items-center gap-3">
                {/* Live Status */}
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  wsConnected 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {wsConnected ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3" />
                      <span>Connecting</span>
                    </>
                  )}
                </div>

                {/* Alerts */}
                {totalAlerts > 0 && (
                  <button 
                    onClick={() => setActiveTab('alerts')}
                    className="relative p-2 hover:bg-white/10 rounded-lg"
                  >
                    <Bell className="w-5 h-5 text-gray-400" />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {totalAlerts > 9 ? '9+' : totalAlerts}
                    </span>
                  </button>
                )}

                {/* Stacks Wallet Connect - Week 3 Builder Challenge */}
                <StacksWalletConnect />

                {/* GitHub */}
                <a 
                  href="https://github.com/serayd61/stacks-defi-sentinel" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hidden sm:flex p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Github className="w-5 h-5 text-gray-500 hover:text-white" />
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-3">
              <WifiOff className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium">Connection Error</p>
                <p className="text-sm opacity-70">{error}</p>
              </div>
              <button onClick={() => fetchDashboard()} className="p-2 hover:bg-red-500/20 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Live Price Ticker - Always visible */}
          <div className="mb-6">
            <LivePriceTicker />
          </div>

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
              {/* Quick Stats - Always Visible */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              )}

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2">
                      <SwapTable swaps={combinedSwaps} isLive={wsConnected} />
                    </div>
                    <div>
                      <WhaleAlerts alerts={combinedAlerts} />
                    </div>
                  </div>
                  <PoolsTable pools={dashboardStats?.topPools || []} />
                </>
              )}

              {activeTab === 'swaps' && <SwapTable swaps={combinedSwaps} isLive={wsConnected} showAll />}

              {activeTab === 'alerts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <WhaleAlerts alerts={combinedAlerts} expanded />
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      Alert Statistics
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Large Transfers', type: 'large_transfer', color: 'orange' },
                        { label: 'Large Swaps', type: 'large_swap', color: 'purple' },
                        { label: 'Liquidity Events', type: 'large_liquidity', color: 'blue' },
                      ].map(({ label, type, color }) => (
                        <div key={type} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                          <span className="text-gray-400">{label}</span>
                          <span className={`font-mono font-bold text-${color}-400`}>
                            {combinedAlerts.filter(a => a.type === type).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ecosystem' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <SwapInterface />
                    <div className="lg:col-span-2"><TokenAnalytics /></div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SBTCDashboard />
                    <StackingTracker />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <NFTGallery />
                    <BlockExplorer />
                  </div>
                </div>
              )}

              {activeTab === 'sbtc' && <div className="max-w-5xl mx-auto"><SBTCBridgeMonitor /></div>}
              {activeTab === 'aggregator' && <div className="max-w-4xl mx-auto"><DEXAggregator /></div>}
              {activeTab === 'token-sale' && <div className="max-w-4xl mx-auto"><TokenSale /></div>}
              {activeTab === 'stake' && <div className="max-w-4xl mx-auto"><StakePanel /></div>}
              {activeTab === 'lending' && <div className="max-w-4xl mx-auto"><LendingPool /></div>}
              {activeTab === 'membership' && <div className="max-w-5xl mx-auto"><ProMembership /></div>}
              {activeTab === 'passport' && <div className="max-w-5xl mx-auto"><StacksPassport /></div>}
              {activeTab === 'badges' && <div className="max-w-5xl mx-auto"><StacksBadge /></div>}
              {activeTab === 'predict' && <div className="max-w-4xl mx-auto"><StacksPredict /></div>}
              {activeTab === 'leaderboard' && <div className="max-w-5xl mx-auto"><StacksLeaderboard /></div>}
              {activeTab === 'portfolio' && <div className="max-w-4xl mx-auto"><PortfolioTracker /></div>}
              {activeTab === 'gas' && <div className="max-w-4xl mx-auto"><GasTracker /></div>}
              {activeTab === 'dao' && <div className="max-w-5xl mx-auto"><DAOVoting /></div>}
              {activeTab === 'referral' && <div className="max-w-4xl mx-auto"><ReferralSystem /></div>}
              {activeTab === 'subscribe' && <div className="max-w-2xl mx-auto"><SubscriptionPanel /></div>}
              
              {/* Market Overview */}
              {activeTab === 'market' && <div className="max-w-6xl mx-auto"><MarketOverview /></div>}
              
              {/* New Advanced Features */}
              {activeTab === 'network' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <NetworkHealth />
                  <ContractActivityMonitor />
                </div>
              )}
              {activeTab === 'protocols' && <div className="max-w-5xl mx-auto"><ProtocolRankings /></div>}
              {activeTab === 'contracts' && <div className="max-w-5xl mx-auto"><ContractActivityMonitor /></div>}
              {activeTab === 'wallet-analytics' && <div className="max-w-4xl mx-auto"><WalletAnalytics /></div>}
              {activeTab === 'price-alerts' && <div className="max-w-2xl mx-auto"><PriceAlerts /></div>}

              {/* Footer */}
              <footer className="mt-12 pt-8 border-t border-white/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Built with <span className="text-purple-400">Chainhooks</span> • Stacks Builder Challenge 2024
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    {[
                      { label: 'Docs', href: 'https://docs.hiro.so/chainhooks' },
                      { label: 'GitHub', href: 'https://github.com/serayd61/stacks-defi-sentinel' },
                      { label: 'Hiro', href: 'https://platform.hiro.so' },
                    ].map(link => (
                      <a 
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>
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
