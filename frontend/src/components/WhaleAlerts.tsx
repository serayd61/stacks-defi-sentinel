import React from 'react';
import { AlertTriangle, ArrowRightLeft, Droplets, Send } from 'lucide-react';

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
}

export function WhaleAlerts({ alerts }: WhaleAlertsProps) {
  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'large_swap':
        return <ArrowRightLeft className="w-4 h-4" />;
      case 'large_liquidity':
        return <Droplets className="w-4 h-4" />;
      case 'large_transfer':
        return <Send className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="bg-stacks-bg-card rounded-2xl border border-stacks-border overflow-hidden">
      <div className="p-4 border-b border-stacks-border flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-stacks-orange" />
          🐋 Whale Alerts
        </h3>
        {alerts.length > 0 && (
          <span className="px-2 py-1 bg-stacks-orange/10 text-stacks-orange rounded-lg text-sm font-medium">
            {alerts.length}
          </span>
        )}
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-stacks-text-muted">
            <p>No whale activity detected</p>
            <p className="text-sm mt-2">Large transactions will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-stacks-border">
            {alerts.map((alert, index) => (
              <div
                key={alert.id || index}
                className={`p-4 ${getSeverityColor(alert.severity)} border-l-2 animate-slide-up`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIcon(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-stacks-text-muted mt-1">
                      {formatTime(alert.timestamp)}
                    </p>
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

