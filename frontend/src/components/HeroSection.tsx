import React from 'react';
import { Zap, ArrowRight, Shield, BarChart3, Coins, Users, TrendingUp, Star } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onConnectWallet: () => void;
  stats: {
    tvl: string;
    users: string;
    transactions: string;
    volume: string;
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted, onConnectWallet, stats }) => {
  return (
    <div className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-500/15 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[200px]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-32">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-orange-500/10 border border-purple-500/20 backdrop-blur-sm">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-300">Stacks Builder Challenge 2024</span>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-white">The Future of</span>
            <br />
            <span className="bg-gradient-to-r from-[#5546FF] via-purple-400 to-[#FC6432] bg-clip-text text-transparent">
              DeFi on Stacks
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Monitor, trade, and earn on the most comprehensive DeFi platform built on Bitcoin L2. 
            Real-time analytics, smart alerts, and powerful tools.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onConnectWallet}
              className="group relative px-8 py-4 bg-gradient-to-r from-[#5546FF] to-[#FC6432] rounded-2xl font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:scale-105"
            >
              <span className="flex items-center gap-2">
                Connect Wallet
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl font-semibold text-white transition-all"
            >
              Explore Platform
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto">
          {[
            { label: 'Total Value Locked', value: stats.tvl, icon: Coins, color: 'purple' },
            { label: '24h Volume', value: stats.volume, icon: TrendingUp, color: 'orange' },
            { label: 'Active Users', value: stats.users, icon: Users, color: 'blue' },
            { label: 'Transactions', value: stats.transactions, icon: BarChart3, color: 'green' },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="group relative p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all hover:bg-white/[0.07]"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <stat.icon className={`w-5 h-5 text-${stat.color}-400 mb-3`} />
                <div className="text-2xl lg:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: Shield,
              title: 'Secure & Audited',
              description: 'Smart contracts reviewed for maximum security on Stacks mainnet'
            },
            {
              icon: Zap,
              title: 'Real-time Data',
              description: 'Live WebSocket feeds for instant market updates and alerts'
            },
            {
              icon: BarChart3,
              title: 'Advanced Analytics',
              description: 'Deep insights into DeFi protocols, whale movements, and trends'
            }
          ].map((feature) => (
            <div key={feature.title} className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-purple-500/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Trusted By */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-6">Powered by</p>
          <div className="flex items-center justify-center gap-8 opacity-50">
            <div className="text-white font-semibold">Stacks</div>
            <div className="text-white font-semibold">Hiro</div>
            <div className="text-white font-semibold">Alex</div>
            <div className="text-white font-semibold">Velar</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

