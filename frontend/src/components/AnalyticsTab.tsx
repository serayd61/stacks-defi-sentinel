import React, { useState } from 'react';
import {
  useAnalyticsOverview,
  useAcquisitionFunnel,
} from '../hooks/useAnalytics';
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
} from 'recharts';

function KpiCard(props: { label: string; value: string; unit?: string }) {
  const { label, value, unit } = props;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: '#475569',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        {unit && (
          <div style={{ fontSize: '0.72rem', color: '#475569' }}>{unit}</div>
        )}
      </div>
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
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
          marginBottom: 14,
        }}
      >
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

const AnalyticsTab: React.FC = () => {
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const { data: overview, isLoading: loadingOverview } =
    useAnalyticsOverview(range);
  const { data: funnel, isLoading: loadingFunnel } = useAcquisitionFunnel();

  if (loadingOverview || !overview) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header + range selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: '-0.02em',
          }}
        >
          Analytics
        </h1>
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: 3,
          }}
        >
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '5px 14px',
                borderRadius: 18,
                border: 'none',
                fontSize: '0.72rem',
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
              Last {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <KpiCard
          label="Total Revenue"
          value={overview.summary.totalRevenue.toFixed(2)}
          unit="USD"
        />
        <KpiCard
          label="Total Tx Volume"
          value={overview.summary.totalTxVolume.toFixed(2)}
          unit="USD"
        />
        <KpiCard
          label="Avg DAU"
          value={overview.summary.avgDau.toFixed(0)}
        />
        <KpiCard
          label="New Users"
          value={overview.summary.totalNewUsers.toFixed(0)}
        />
      </div>

      {/* Charts row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 18,
        }}
      >
        <Card title="Revenue over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={overview.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="DAU & New Users">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={overview.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="dau"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name="DAU"
              />
              <Line
                type="monotone"
                dataKey="newUsers"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="New Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tx Volume chart */}
      <Card title="Transaction Volume over time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={overview.days}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#1e293b',
                borderRadius: 8,
                fontSize: '0.78rem',
              }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="txVolume"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              name="Tx Volume (USD)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Acquisition funnel */}
      <Card title="Acquisition Funnel (Page View → Wallet → Swap)">
        {loadingFunnel || !funnel ? (
          <div style={{ color: '#475569', fontSize: '0.82rem' }}>
            Loading funnel...
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 18,
            }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel.steps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="stepName"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: 8,
                    fontSize: '0.78rem',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="usersReached" fill="#5546FF" radius={[6, 6, 0, 0]} name="Users" />
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        color: '#e2e8f0',
                      }}
                    >
                      {s.stepName}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#475569',
                        marginTop: 2,
                      }}
                    >
                      Users: {s.usersReached} &middot; Conv:{' '}
                      {(s.conversionFromPrev * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AnalyticsTab;
