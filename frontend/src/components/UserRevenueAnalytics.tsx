import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { useAnalyticsOverview, useAcquisitionFunnel } from '../hooks/useAnalytics';

const fmt = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtShort = (n: number) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const tooltipStyle = {
  backgroundColor: 'rgba(9,9,18,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  fontSize: '0.75rem',
  color: '#e2e8f0',
};

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#f1f5f9',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#e2e8f0',
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const UserRevenueAnalytics: React.FC = () => {
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const { data: overview, isLoading: loadingOverview } =
    useAnalyticsOverview(range);
  const { data: funnel, isLoading: loadingFunnel } = useAcquisitionFunnel();

  if (loadingOverview) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 320,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              margin: '0 auto 14px',
              border: '3px solid rgba(85,70,255,0.12)',
              borderTopColor: '#5546FF',
              borderRadius: '50%',
              animation: 'spinCW 0.8s linear infinite',
            }}
          />
          <p style={{ color: '#475569', fontSize: '0.85rem' }}>
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 320,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 12 }}>
            Failed to load analytics data
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Format chart data - show shorter date labels
  const chartData = overview.days.map((d) => ({
    ...d,
    label: d.date.slice(5), // "MM-DD"
    revenue: Math.round(d.revenue * 100) / 100,
    txVolume: Math.round(d.txVolume),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + range toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#f1f5f9',
              margin: 0,
            }}
          >
            User & Revenue Analytics
          </h1>
          <p
            style={{
              fontSize: '0.78rem',
              color: '#475569',
              marginTop: 4,
            }}
          >
            Product-level metrics, conversion funnels, and revenue tracking
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 2,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: 3,
          }}
        >
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                background:
                  range === r
                    ? 'linear-gradient(135deg,#5546FF,#7c3aed)'
                    : 'transparent',
                color: range === r ? '#fff' : '#64748b',
              }}
            >
              {r === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          label="Total Revenue"
          value={fmt(overview.summary.totalRevenue)}
          icon={<DollarSign size={20} color="#22c55e" />}
          color="#22c55e"
        />
        <KpiCard
          label="Tx Volume"
          value={fmt(overview.summary.totalTxVolume)}
          icon={<TrendingUp size={20} color="#38bdf8" />}
          color="#38bdf8"
        />
        <KpiCard
          label="Avg DAU"
          value={fmtShort(overview.summary.avgDau)}
          icon={<Users size={20} color="#a855f7" />}
          color="#a855f7"
        />
        <KpiCard
          label="New Users"
          value={fmtShort(overview.summary.totalNewUsers)}
          icon={<Activity size={20} color="#fb923c" />}
          color="#fb923c"
        />
      </div>

      {/* Charts row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 16,
        }}
      >
        <ChartCard title="Revenue Over Time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, 'Revenue']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="DAU & New Users">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '0.72rem', color: '#64748b' }}
              />
              <Line
                type="monotone"
                dataKey="dau"
                name="Daily Active Users"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#a855f7' }}
              />
              <Line
                type="monotone"
                dataKey="newUsers"
                name="New Users"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#fb923c' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tx Volume chart */}
      <ChartCard title="Transaction Volume Over Time">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number | undefined) => [fmt(value ?? 0), 'Volume']}
            />
            <Bar
              dataKey="txVolume"
              fill="#38bdf8"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Acquisition Funnel */}
      <ChartCard title="Acquisition Funnel (Page View → Wallet → Swap → LP)">
        {loadingFunnel || !funnel ? (
          <div style={{ color: '#475569', fontSize: '0.82rem', padding: 20 }}>
            Loading funnel data...
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel.steps} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="stepName"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number | undefined) => [
                    fmtShort(value ?? 0),
                    'Users',
                  ]}
                />
                <Bar
                  dataKey="usersReached"
                  fill="url(#funnelGradient)"
                  radius={[0, 6, 6, 0]}
                />
                <defs>
                  <linearGradient
                    id="funnelGradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="#5546FF" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {funnel.steps.map((s) => (
                <div
                  key={s.stepIndex}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#e2e8f0',
                      marginBottom: 6,
                    }}
                  >
                    {s.stepName}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#64748b',
                      }}
                    >
                      Users: {fmtShort(s.usersReached)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color:
                          s.conversionFromPrev >= 0.5
                            ? '#22c55e'
                            : s.conversionFromPrev >= 0.2
                              ? '#fb923c'
                              : '#f87171',
                      }}
                    >
                      {s.stepIndex === 0
                        ? '100%'
                        : `${(s.conversionFromPrev * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  {s.stepIndex > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(s.conversionFromPrev * 100, 100)}%`,
                          height: '100%',
                          borderRadius: 2,
                          background:
                            s.conversionFromPrev >= 0.5
                              ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                              : s.conversionFromPrev >= 0.2
                                ? 'linear-gradient(90deg,#fb923c,#f97316)'
                                : 'linear-gradient(90deg,#f87171,#ef4444)',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default UserRevenueAnalytics;
