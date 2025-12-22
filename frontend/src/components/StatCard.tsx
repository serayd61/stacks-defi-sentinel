import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: 'purple' | 'orange' | 'green' | 'blue';
}

export function StatCard({ title, value, change, icon, color = 'purple' }: StatCardProps) {
  const colorClasses = {
    purple: 'from-stacks-purple/20 to-transparent border-stacks-purple/30',
    orange: 'from-stacks-orange/20 to-transparent border-stacks-orange/30',
    green: 'from-green-500/20 to-transparent border-green-500/30',
    blue: 'from-blue-500/20 to-transparent border-blue-500/30',
  };

  const iconColors = {
    purple: 'text-stacks-purple',
    orange: 'text-stacks-orange',
    green: 'text-green-500',
    blue: 'text-blue-500',
  };

  return (
    <div className={`
      bg-gradient-to-br ${colorClasses[color]}
      bg-stacks-bg-card rounded-2xl p-6 border
      card-hover animate-fade-in
    `}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-stacks-text-muted text-sm font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold mono">{value}</p>
          {change !== undefined && (
            <p className={`text-sm mt-2 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-stacks-bg-highlight ${iconColors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

