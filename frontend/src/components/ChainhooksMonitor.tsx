import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Bell, 
  Zap, 
  TrendingUp, 
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

interface ChainhookEvent {
  id: string;
  type: 'swap' | 'transfer' | 'stake' | 'contract_deploy' | 'whale_alert';
  txId: string;
  blockHeight: number;
  timestamp: number;
  data: {
    from?: string;
    to?: string;
    amount?: string;
    token?: string;
    contractId?: string;
  };
}

interface ChainhooksMonitorProps {
  wsUrl?: string;
}

const ChainhooksMonitor: React.FC<ChainhooksMonitorProps> = ({ 
  wsUrl = 'wss://stacks-defi-sentinel-production.up.railway.app/ws' 
}) => {
  const [events, setEvents] = useState<ChainhookEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    swaps: 0,
    transfers: 0,
    whaleAlerts: 0,
  });

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[Chainhooks] Connected to real-time feed');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chainhook_event') {
          const newEvent: ChainhookEvent = {
            id: crypto.randomUUID(),
            type: data.eventType || 'transfer',
            txId: data.txId,
            blockHeight: data.blockHeight,
            timestamp: Date.now(),
            data: data.payload,
          };
          
          setEvents(prev => [newEvent, ...prev].slice(0, 50));
          setStats(prev => ({
            totalEvents: prev.totalEvents + 1,
            swaps: prev.swaps + (newEvent.type === 'swap' ? 1 : 0),
            transfers: prev.transfers + (newEvent.type === 'transfer' ? 1 : 0),
            whaleAlerts: prev.whaleAlerts + (newEvent.type === 'whale_alert' ? 1 : 0),
          }));
        }
      } catch (err) {
        console.error('[Chainhooks] Parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[Chainhooks] Disconnected');
    };

    ws.onerror = (error) => {
      console.error('[Chainhooks] WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'swap': return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
      case 'whale_alert': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'stake': return <Zap className="w-4 h-4 text-green-400" />;
      case 'contract_deploy': return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                Chainhooks Monitor
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  Real-time
                </span>
              </h3>
              <p className="text-sm text-gray-500">Powered by Hiro Chainhooks</p>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
          }`}>
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </span>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-white/10">
        {[
          { label: 'Total Events', value: stats.totalEvents, color: 'text-white' },
          { label: 'Swaps', value: stats.swaps, color: 'text-purple-400' },
          { label: 'Transfers', value: stats.transfers, color: 'text-blue-400' },
          { label: 'Whale Alerts', value: stats.whaleAlerts, color: 'text-orange-400' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Events List */}
      <div className="max-h-80 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">Waiting for blockchain events...</p>
            <p className="text-xs text-gray-600 mt-1">Real-time data via Chainhooks</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {events.map((event) => (
              <div 
                key={event.id}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white capitalize">
                        {event.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        Block #{event.blockHeight}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate font-mono">
                      {event.txId.slice(0, 20)}...
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(event.timestamp)}
                    </span>
                    <a
                      href={`https://explorer.hiro.so/txid/${event.txId}?chain=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-500" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gradient-to-r from-purple-500/10 to-orange-500/10 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            Powered by <span className="text-purple-400 font-medium">Hiro Chainhooks</span>
          </span>
          <a 
            href="https://docs.hiro.so/chainhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ChainhooksMonitor;

