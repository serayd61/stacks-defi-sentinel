import React from 'react';
import { AlertTriangle, ArrowRightLeft, Droplets, Send, TrendingUp, Clock } from 'lucide-react';

interface Alert {
  id: string;
  type: 'large_transfer' | 'large_swap' | 'large_liquidity' | 'new_wallet_activity';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  event: any;
}

interface WhaleAlertsProps {
  alerts: Alert[];
  expanded?: boolean;
}

export function WhaleAlerts({ alerts, expanded = false }: WhaleAlertsProps) {
  const getIcon = (type: Alert['type']) => {
    const icons = {
      large_swap: ArrowRightLeft,
      large_liquidity: Droplets,
      large_transfer: Send,
      new_wallet_activity: TrendingUp,
    };
    const Icon = icons[type] || AlertTriangle;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeStyles = (type: Alert['type']) => {
    const styles = {
      large_transfer: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      large_swap: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      large_liquidity: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      new_wallet_activity: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return styles[type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const getSeverityDot = (severity: Alert['severity']) => {
    const colors = {
      critical: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
    };
    return colors[severity] || colors.info;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getTypeLabel = (type: Alert['type']) => {
    const labels = {
      large_transfer: 'Transfer',
      large_swap: 'Swap',
      large_liquidity: 'Liquidity',
      new_wallet_activity: 'New Wallet',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span>🐋 Whale Alerts</span>
        </h3>
        {alerts.length > 0 && (
          <span className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-full text-sm font-medium border border-orange-500/20">
            {alerts.length} alerts
          </span>
        )}
      </div>
      
      <div className={`${expanded ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <span className="text-4xl">🐋</span>
            </div>
            <p className="text-gray-400 font-medium">No whale activity</p>
            <p className="text-sm text-gray-600 mt-1 text-center">
              Large transactions will appear here when detected
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map((alert, index) => (
              <div
                key={alert.id || index}
                className="p-4 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {/* Severity Indicator */}
                  <div className="relative mt-1">
                    <div className={`w-2 h-2 rounded-full ${getSeverityDot(alert.severity)}`} />
                    {alert.severity === 'critical' && (
                      <div className={`absolute inset-0 w-2 h-2 rounded-full ${getSeverityDot(alert.severity)} animate-ping`} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${getTypeStyles(alert.type)}`}>
                        {getIcon(alert.type)}
                        {getTypeLabel(alert.type)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTime(alert.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
