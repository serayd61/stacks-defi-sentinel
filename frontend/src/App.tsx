import React from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Wallet, 
  Zap,
  Github,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';
import { StatCard } from './components/StatCard';
import { SwapTable } from './components/SwapTable';
import { WhaleAlerts } from './components/WhaleAlerts';
import { PoolsTable } from './components/PoolsTable';
import { useApi } from './hooks/useApi';
import { useWebSocket } from './hooks/useWebSocket';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

function App() {
  const { dashboardStats, isLoading, error } = useApi();
  const { isConnected, events } = useWebSocket(WS_URL);

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
  ].slice(0, 20);

  const combinedAlerts = [
    ...events.alerts,
    ...(dashboardStats?.recentAlerts || []),
  ].slice(0, 15);

  return (
    <div className="min-h-screen bg-stacks-bg">
      {/* Header */}
      <header className="border-b border-stacks-border bg-stacks-bg-secondary/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-stacks-purple to-stacks-orange flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">Stacks DeFi Monitor</h1>
                <p className="text-xs text-stacks-text-muted">Real-time DeFi analytics powered by Chainhooks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                isConnected 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Connecting...</span>
                  </>
                )}
              </div>

              {/* Network Badge */}
              <span className="px-3 py-1.5 bg-stacks-purple/10 text-stacks-purple rounded-full text-sm font-medium border border-stacks-purple/30">
                Mainnet
              </span>

              {/* GitHub Link */}
              <a 
                href="https://github.com/hirosystems/chainhook-2.0" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-stacks-bg-highlight transition-colors"
              >
                <Github className="w-5 h-5 text-stacks-text-muted hover:text-white" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-stacks-purple/30 border-t-stacks-purple rounded-full animate-spin mx-auto mb-4" />
              <p className="text-stacks-text-muted">Loading DeFi data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Value Locked"
                value={formatNumber(dashboardStats?.totalValueLocked || 0)}
                icon={<Wallet className="w-6 h-6" />}
                color="purple"
              />
              <StatCard
                title="24h Volume"
                value={formatNumber(dashboardStats?.totalVolume24h || 0)}
                icon={<TrendingUp className="w-6 h-6" />}
                color="orange"
              />
              <StatCard
                title="24h Transactions"
                value={formatCount(dashboardStats?.totalTransactions24h || 0)}
                icon={<Activity className="w-6 h-6" />}
                color="green"
              />
              <StatCard
                title="Active Wallets"
                value={formatCount(dashboardStats?.activeWallets24h || 0)}
                icon={<Users className="w-6 h-6" />}
                color="blue"
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Swaps Table - Takes 2 columns */}
              <div className="lg:col-span-2">
                <SwapTable swaps={combinedSwaps} isLive={isConnected} />
              </div>

              {/* Whale Alerts - Takes 1 column */}
              <div>
                <WhaleAlerts alerts={combinedAlerts} />
              </div>
            </div>

            {/* Pools Table */}
            <div className="mb-8">
              <PoolsTable pools={dashboardStats?.topPools || []} />
            </div>

            {/* Powered By Section */}
            <div className="text-center py-8 border-t border-stacks-border">
              <p className="text-stacks-text-muted text-sm mb-4">
                Powered by Chainhooks - Real-time blockchain event streaming
              </p>
              <div className="flex items-center justify-center gap-6">
                <a 
                  href="https://docs.hiro.so/chainhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-stacks-purple hover:text-stacks-purple/80 transition-colors"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a 
                  href="https://www.npmjs.com/package/@hirosystems/chainhooks-client"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-stacks-orange hover:text-stacks-orange/80 transition-colors"
                >
                  <span>NPM Package</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

