import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'purple' | 'orange' | 'green' | 'blue';
  trend?: number;
  subtitle?: string;
}

export function StatCard({ title, value, icon, color = 'purple', trend, subtitle }: StatCardProps) {
  const gradients = {
    purple: 'from-purple-500/20 via-purple-500/5 to-transparent',
    orange: 'from-orange-500/20 via-orange-500/5 to-transparent',
    green: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    blue: 'from-blue-500/20 via-blue-500/5 to-transparent',
  };

  const iconBg = {
    purple: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  };

  const glowColors = {
    purple: 'hover:shadow-purple-500/10',
    orange: 'hover:shadow-orange-500/10',
    green: 'hover:shadow-emerald-500/10',
    blue: 'hover:shadow-blue-500/10',
  };

  return (
    <div className={`
      relative overflow-hidden
      bg-white/[0.02] backdrop-blur-sm
      rounded-2xl p-6 
      border border-white/5
      hover:border-white/10
      transition-all duration-300
      hover:shadow-2xl ${glowColors[color]}
      group
    `}>
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradients[color]} opacity-50`} />
      
      {/* Glow Effect on Hover */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${gradients[color]} blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl ${iconBg[color]} ring-1`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              trend >= 0 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        
        <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-white font-mono tracking-tight">{value}</p>
        
        {subtitle && (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
