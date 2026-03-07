import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Link, 
  CheckCircle, 
  XCircle, 
  Smartphone,
  Monitor,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';

interface WalletConnectIntegrationProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  isConnected: boolean;
  address?: string;
}

const WalletConnectIntegration: React.FC<WalletConnectIntegrationProps> = ({
  onConnect,
  onDisconnect,
  isConnected,
  address
}) => {
  const [showQR, setShowQR] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  const supportedWallets = [
    { 
      name: 'Xverse', 
      icon: '🔷', 
      description: 'Popular Stacks wallet',
      type: 'mobile' as const
    },
    { 
      name: 'Leather', 
      icon: '🟤', 
      description: 'Hiro wallet (formerly Hiro)',
      type: 'extension' as const
    },
    { 
      name: 'OKX Wallet', 
      icon: '⚫', 
      description: 'Multi-chain wallet',
      type: 'mobile' as const
    },
    { 
      name: 'Asigna', 
      icon: '🔵', 
      description: 'Multisig wallet',
      type: 'extension' as const
    },
  ];

  const handleWalletConnect = async (walletName: string) => {
    setConnectionStatus('connecting');
    
    try {
      // Simulate WalletConnect connection
      // In production, this would use @reown/appkit
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockAddress = 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W';
      setConnectionStatus('connected');
      onConnect(mockAddress);
    } catch (error) {
      setConnectionStatus('error');
      console.error('Connection failed:', error);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Wallet Connected</h3>
              <p className="text-sm text-gray-400">via WalletConnect</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
            Active
          </span>
        </div>

        <div className="bg-black/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Connected Address</p>
              <p className="font-mono text-white">{shortenAddress(address)}</p>
            </div>
            <button
              onClick={copyAddress}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <a
            href={`https://explorer.hiro.so/address/${address}?chain=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on Explorer
          </a>
          <button
            onClick={onDisconnect}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm text-red-400 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Link className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">WalletConnect</h3>
            <p className="text-sm text-gray-500">Connect your Stacks wallet</p>
          </div>
        </div>
      </div>

      {/* Status */}
      {connectionStatus === 'connecting' && (
        <div className="p-6 text-center">
          <RefreshCw className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-white font-medium">Connecting...</p>
          <p className="text-sm text-gray-500 mt-1">Please approve in your wallet</p>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="p-4 m-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span>Connection failed. Please try again.</span>
          </div>
        </div>
      )}

      {/* Wallet Options */}
      {connectionStatus !== 'connecting' && (
        <div className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Available Wallets</p>
          <div className="grid grid-cols-2 gap-3">
            {supportedWallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleWalletConnect(wallet.name)}
                className="group p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{wallet.icon}</span>
                  {wallet.type === 'mobile' ? (
                    <Smartphone className="w-3 h-3 text-gray-500" />
                  ) : (
                    <Monitor className="w-3 h-3 text-gray-500" />
                  )}
                </div>
                <h4 className="font-medium text-white group-hover:text-purple-400 transition-colors">
                  {wallet.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">{wallet.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Option */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setShowQR(!showQR)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 rounded-xl text-sm text-gray-300 transition-all"
        >
          <Wallet className="w-4 h-4" />
          {showQR ? 'Hide QR Code' : 'Show QR Code'}
        </button>
        
        {showQR && (
          <div className="mt-4 p-6 bg-white rounded-xl text-center">
            <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-3">
              <span className="text-gray-400 text-sm">QR Code</span>
            </div>
            <p className="text-gray-600 text-sm">Scan with your mobile wallet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-t border-white/10">
        <p className="text-xs text-center text-gray-500">
          Powered by <span className="text-blue-400">WalletConnect</span> • Week 3 Challenge
        </p>
      </div>
    </div>
  );
};

export default WalletConnectIntegration;

