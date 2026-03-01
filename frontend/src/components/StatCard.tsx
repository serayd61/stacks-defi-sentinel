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

const COLOR_MAP = {
  purple: {
    iconBg:  'rgba(108,71,255,0.12)',
    iconColor: '#818CF8',
    iconBorder: 'rgba(108,71,255,0.2)',
    glow: 'rgba(108,71,255,0.08)',
    borderHover: 'rgba(108,71,255,0.25)',
    accent: '#6C47FF',
    barColor: 'rgba(108,71,255,0.6)',
  },
  orange: {
    iconBg:  'rgba(252,100,50,0.12)',
    iconColor: '#FB923C',
    iconBorder: 'rgba(252,100,50,0.2)',
    glow: 'rgba(252,100,50,0.07)',
    borderHover: 'rgba(252,100,50,0.25)',
    accent: '#FC6432',
    barColor: 'rgba(252,100,50,0.6)',
  },
  green: {
    iconBg:  'rgba(16,185,129,0.12)',
    iconColor: '#34D399',
    iconBorder: 'rgba(16,185,129,0.2)',
    glow: 'rgba(16,185,129,0.07)',
    borderHover: 'rgba(16,185,129,0.25)',
    accent: '#10B981',
    barColor: 'rgba(16,185,129,0.6)',
  },
  blue: {
    iconBg:  'rgba(59,130,246,0.12)',
    iconColor: '#60A5FA',
    iconBorder: 'rgba(59,130,246,0.2)',
    glow: 'rgba(59,130,246,0.07)',
    borderHover: 'rgba(59,130,246,0.25)',
    accent: '#3B82F6',
    barColor: 'rgba(59,130,246,0.6)',
  },
};

// Fake sparkline bars (visual only)
const SPARKLINES = [40, 55, 35, 60, 45, 70, 50, 65, 55, 80, 60, 75];

export function StatCard({ title, value, icon, color = 'purple', trend, subtitle }: StatCardProps) {
  const c = COLOR_MAP[color];
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        background: hovered
          ? `linear-gradient(135deg, rgba(255,255,255,0.03), ${c.glow})`
          : 'rgba(12,12,30,0.8)',
        border: `1px solid ${hovered ? c.borderHover : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16,
        padding: '18px 20px 16px',
        cursor: 'default',
        transition: 'all 0.2s ease',
        boxShadow: hovered
          ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.borderHover}`
          : '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Top corner glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 120, height: 120,
        background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
        opacity: hovered ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: c.iconBg,
          border: `1px solid ${c.iconBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: c.iconColor,
          transition: 'transform 0.2s',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}>
          {icon}
        </div>

        {/* Trend badge */}
        {trend !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '4px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700,
            background: trend >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: trend >= 0 ? '#10B981' : '#EF4444',
            border: `1px solid ${trend >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Title */}
      <p style={{
        fontSize: '0.72rem', fontWeight: 600, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 4, position: 'relative',
      }}>
        {title}
      </p>

      {/* Value */}
      <p style={{
        fontSize: '1.75rem', fontWeight: 800, color: '#F1F5F9',
        letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6,
        fontFamily: 'JetBrains Mono, monospace',
        position: 'relative',
      }}>
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p style={{ fontSize: '0.72rem', color: '#334155', position: 'relative' }}>
          {subtitle}
        </p>
      )}

      {/* Sparkline */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 80, height: 32,
        display: 'flex', alignItems: 'flex-end',
        gap: 2, padding: '0 14px 8px 0',
        opacity: hovered ? 0.7 : 0.35,
        transition: 'opacity 0.2s',
      }}>
        {SPARKLINES.map((h, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            height: `${h}%`,
            background: c.barColor,
            transition: 'height 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}
