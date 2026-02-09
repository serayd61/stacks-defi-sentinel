import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Volume2, VolumeX, Settings, Coins, Bitcoin, Zap } from 'lucide-react';

interface PriceAlert {
  id: string;
  token: string;
  condition: 'above' | 'below';
  targetPrice: number;
  currentPrice: number;
  triggered: boolean;
  createdAt: number;
  notifySound: boolean;
}

interface TokenOption {
  symbol: string;
  name: string;
  icon: React.ReactNode;
  coingeckoId: string;
}

const PriceAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('STX');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [notifySound, setNotifySound] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const tokenOptions: TokenOption[] = [
    { symbol: 'STX', name: 'Stacks', icon: <Coins className="w-5 h-5 text-purple-400" />, coingeckoId: 'blockstack' },
    { symbol: 'BTC', name: 'Bitcoin', icon: <Bitcoin className="w-5 h-5 text-orange-400" />, coingeckoId: 'bitcoin' },
    { symbol: 'ALEX', name: 'ALEX', icon: <Zap className="w-5 h-5 text-blue-400" />, coingeckoId: 'alex-lab' },
  ];

  // Load alerts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('priceAlerts');
    if (saved) {
      setAlerts(JSON.parse(saved));
    }
  }, []);

  // Save alerts to localStorage
  useEffect(() => {
    localStorage.setItem('priceAlerts', JSON.stringify(alerts));
  }, [alerts]);

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const ids = tokenOptions.map(t => t.coingeckoId).join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
      );
      const data = await response.json();

      const newPrices: Record<string, number> = {};
      tokenOptions.forEach(token => {
        newPrices[token.symbol] = data[token.coingeckoId]?.usd || 0;
      });
      setPrices(newPrices);

      // Check alerts
      checkAlerts(newPrices);
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if any alerts are triggered
  const checkAlerts = (currentPrices: Record<string, number>) => {
    setAlerts(prev => prev.map(alert => {
      const currentPrice = currentPrices[alert.token] || 0;
      const wasTriggered = alert.triggered;
      let isTriggered = false;

      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        isTriggered = true;
      }

      // Play sound if newly triggered
      if (isTriggered && !wasTriggered && alert.notifySound && soundEnabled) {
        playAlertSound();
      }

      return {
        ...alert,
        currentPrice,
        triggered: isTriggered,
      };
    }));
  };

  const playAlertSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYALJHX6aSEEgAjkNfqpYQSAB+P1+qmhRIAHI7X6qeFEgAajtfqp4USAB2O1+qnhRIAHI7X6qeFEgAcjtfqp4USAB2O1+qnhRIAHI7X6qeFEgAcjtfqp4USAB2O1+qnhRIAHI7X6qeFEgAcjtfqp4USAB2O1+qnhRIAHI7X6qeFEgA=');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  const addAlert = () => {
    if (!targetPrice || isNaN(parseFloat(targetPrice))) return;

    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      token: selectedToken,
      condition,
      targetPrice: parseFloat(targetPrice),
      currentPrice: prices[selectedToken] || 0,
      triggered: false,
      createdAt: Date.now(),
      notifySound,
    };

    setAlerts(prev => [...prev, newAlert]);
    setShowAddModal(false);
    setTargetPrice('');
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearTriggered = () => {
    setAlerts(prev => prev.filter(a => !a.triggered));
  };

  const getTokenIcon = (symbol: string) => {
    return tokenOptions.find(t => t.symbol === symbol)?.icon || <Coins className="w-5 h-5 text-gray-400" />;
  };

  const triggeredCount = alerts.filter(a => a.triggered).length;
  const activeCount = alerts.filter(a => !a.triggered).length;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Price Alerts</h3>
              <p className="text-xs text-gray-500">Get notified when prices hit your targets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'}`}
              title={soundEnabled ? 'Sound On' : 'Sound Off'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-orange-500 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Alert
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{alerts.length}</div>
            <div className="text-xs text-gray-500">Total Alerts</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
            <div className="text-lg font-bold text-green-400">{activeCount}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3 text-center border border-orange-500/20">
            <div className="text-lg font-bold text-orange-400">{triggeredCount}</div>
            <div className="text-xs text-gray-500">Triggered</div>
          </div>
        </div>
      </div>

      {/* Current Prices */}
      <div className="p-4 bg-black/20 border-b border-white/5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Current Prices</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex gap-4">
          {tokenOptions.map(token => (
            <div key={token.symbol} className="flex items-center gap-2">
              {token.icon}
              <span className="text-sm text-white font-medium">{token.symbol}</span>
              <span className="text-sm text-gray-400 font-mono">
                ${prices[token.symbol]?.toFixed(token.symbol === 'BTC' ? 0 : 4) || '0.00'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500">No price alerts set</p>
            <p className="text-xs text-gray-600 mt-1">Click "Add Alert" to create one</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-4 transition-colors ${
                alert.triggered ? 'bg-orange-500/5' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  alert.triggered ? 'bg-orange-500/20' : 'bg-white/5'
                }`}>
                  {getTokenIcon(alert.token)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{alert.token}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      alert.condition === 'above' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                    </span>
                    {alert.triggered && (
                      <span className="flex items-center gap-1 text-xs text-orange-400">
                        <AlertTriangle className="w-3 h-3" />
                        Triggered!
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Target: <span className="text-white font-mono">${alert.targetPrice.toFixed(4)}</span>
                    <span className="mx-2">•</span>
                    Current: <span className="font-mono">${alert.currentPrice.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="p-2 hover:bg-red-500/20 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Clear Triggered */}
      {triggeredCount > 0 && (
        <div className="p-4 bg-orange-500/5 border-t border-orange-500/20">
          <button
            onClick={clearTriggered}
            className="w-full py-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            Clear {triggeredCount} triggered alert{triggeredCount > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#0d0d14] rounded-2xl border border-white/10 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create Price Alert</h3>
            
            {/* Token Selection */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Token</label>
              <div className="grid grid-cols-3 gap-2">
                {tokenOptions.map(token => (
                  <button
                    key={token.symbol}
                    onClick={() => setSelectedToken(token.symbol)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                      selectedToken === token.symbol
                        ? 'bg-purple-500/20 border-purple-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {token.icon}
                    <span className="text-sm font-medium">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Condition</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCondition('above')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                    condition === 'above'
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Price Above
                </button>
                <button
                  onClick={() => setCondition('below')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                    condition === 'below'
                      ? 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Price Below
                </button>
              </div>
            </div>

            {/* Target Price */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Target Price (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder={`Current: $${prices[selectedToken]?.toFixed(4) || '0.00'}`}
                  className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  step="0.0001"
                />
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="mb-6">
              <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer">
                <span className="text-sm text-gray-400">Play sound when triggered</span>
                <button
                  onClick={() => setNotifySound(!notifySound)}
                  className={`w-10 h-6 rounded-full transition-colors ${notifySound ? 'bg-purple-500' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${notifySound ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-white/5 rounded-xl text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addAlert}
                disabled={!targetPrice}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-orange-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceAlerts;
