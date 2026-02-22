import { useState, useEffect, useCallback } from 'react';
import { Brain, Zap, Shield, FileText, Activity, TrendingUp, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

// ─── Types ─────────────────────────────────────────────────────────────────
interface AgentInfo {
  name: string;
  role: string;
  model: string;
}

interface Insight {
  agent?: string;
  type?: string;
  amount?: number;
  analysis?: {
    risk_level?: string;
    pattern?: string;
    prediction?: string;
    action_needed?: boolean;
    arbitrage_opportunity?: boolean;
    recommendation?: string;
    urgency?: string;
  };
  content?: string;
  message?: string;
  receivedAt?: string;
  date?: string;
  event_count?: number;
}

interface AIStatus {
  cluster: string;
  inference: string;
  agents: AgentInfo[];
  total_insights: number;
  last_activity: string | null;
}

// ─── Agent Config ──────────────────────────────────────────────────────────
const AGENT_CONFIG: Record<string, { icon: typeof Brain; color: string; bg: string; border: string }> = {
  satoshi:  { icon: TrendingUp, color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20' },
  nakamoto: { icon: Activity,   color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20'   },
  szabo:    { icon: Shield,     color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20' },
  finney:   { icon: FileText,   color: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/20'  },
};

const RISK_COLORS: Record<string, string> = {
  low:      'text-green-400 bg-green-400/10',
  medium:   'text-yellow-400 bg-yellow-400/10',
  high:     'text-red-400 bg-red-400/10',
  critical: 'text-red-500 bg-red-500/20',
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function insightTitle(ins: Insight): string {
  switch (ins.type) {
    case 'whale_analysis':  return `🐋 ${ins.amount?.toLocaleString()} STX Whale Movement`;
    case 'dex_analysis':    return '📊 DEX Price Analysis';
    case 'dex_impact':      return '💥 Whale DEX Impact';
    case 'daily_report':    return '📝 Daily AI Report';
    case 'security_scan':   return '🔒 Contract Security Scan';
    case 'alert_whale':     return `⚡ Whale Alert`;
    case 'alert_dex':       return '📈 DEX Alert';
    case 'alert_security':  return '🚨 Security Alert';
    default:                return ins.type || 'AI Analysis';
  }
}

function insightBody(ins: Insight): string {
  if (ins.content)                    return ins.content.slice(0, 180);
  if (ins.message)                    return ins.message.slice(0, 180);
  if (ins.analysis?.prediction)       return ins.analysis.prediction.slice(0, 180);
  if (ins.analysis?.recommendation)   return ins.analysis.recommendation.slice(0, 180);
  if (ins.analysis?.pattern)          return `Pattern: ${ins.analysis.pattern}`;
  return '';
}

// ─── Components ────────────────────────────────────────────────────────────
function AgentCard({ agent, active }: { agent: AgentInfo; active: boolean }) {
  const cfg = AGENT_CONFIG[agent.name] || { icon: Brain, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' };
  const Icon = cfg.icon;
  return (
    <div className={`relative rounded-xl border p-4 transition-all duration-300 ${cfg.border} ${cfg.bg} hover:scale-[1.02]`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${cfg.bg}`}>
          <Icon className={`w-5 h-5 ${cfg.color}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className={`text-xs font-mono ${active ? 'text-green-400' : 'text-gray-500'}`}>
            {active ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      <h3 className={`font-bold text-sm uppercase tracking-wider mb-1 ${cfg.color}`}>{agent.name}</h3>
      <p className="text-gray-400 text-xs leading-relaxed">{agent.role}</p>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-gray-600 text-xs font-mono">model</span>
        <span className="text-gray-400 text-xs font-mono">{agent.model}</span>
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const agentCfg = AGENT_CONFIG[insight.agent || ''];
  const riskLevel = insight.analysis?.risk_level;
  const body = insightBody(insight);

  return (
    <div className="group flex gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200">
      {/* Agent dot */}
      <div className="mt-0.5 flex-shrink-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold uppercase ${agentCfg?.bg || 'bg-gray-700/50'} ${agentCfg?.color || 'text-gray-400'}`}>
          {(insight.agent || '?').slice(0, 2)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-white/90 leading-tight">{insightTitle(insight)}</span>
          {insight.receivedAt && (
            <span className="text-gray-500 text-xs flex-shrink-0 font-mono">{timeAgo(insight.receivedAt)}</span>
          )}
        </div>

        {body && <p className="text-gray-400 text-xs leading-relaxed mb-2">{body}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          {insight.agent && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${agentCfg?.bg || ''} ${agentCfg?.color || 'text-gray-400'}`}>
              {insight.agent}
            </span>
          )}
          {riskLevel && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${RISK_COLORS[riskLevel] || 'text-gray-400 bg-gray-400/10'}`}>
              risk: {riskLevel}
            </span>
          )}
          {insight.analysis?.pattern && (
            <span className="text-xs px-2 py-0.5 rounded-full font-mono text-blue-300 bg-blue-400/10">
              {insight.analysis.pattern}
            </span>
          )}
          {insight.analysis?.arbitrage_opportunity && (
            <span className="text-xs px-2 py-0.5 rounded-full font-mono text-yellow-300 bg-yellow-400/10">
              arbitrage opportunity
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1 group-hover:text-gray-400 transition-colors" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function AIAgents() {
  const [status,    setStatus]    = useState<AIStatus | null>(null);
  const [insights,  setInsights]  = useState<Insight[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter,    setFilter]    = useState<string>('all');

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [statusRes, insightsRes] = await Promise.all([
        fetch(`${API_URL}/api/ai-status`),
        fetch(`${API_URL}/api/ai-insights`),
      ]);
      if (statusRes.ok)   setStatus(await statusRes.json());
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data.insights || []);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error('AI Agents fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredInsights = filter === 'all'
    ? insights
    : insights.filter(i => i.agent === filter || i.type?.includes(filter));

  const agentNames = ['satoshi', 'nakamoto', 'szabo', 'finney'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Connecting to AI Cluster...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Agentic AI Cluster</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20 animate-pulse">
              LIVE
            </span>
          </div>
          <p className="text-gray-400 text-sm ml-11">
            Stacks DeFi Sentinel · Closed-Loop Network Topology
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Cluster Stats */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Inference Model', value: 'llama3.2:1b', icon: Zap, color: 'text-yellow-400' },
            { label: 'Active Agents',   value: `${status.agents.length}`,        icon: Brain,   color: 'text-purple-400' },
            { label: 'AI Insights',     value: `${status.total_insights}`,        icon: Activity, color: 'text-blue-400'  },
            { label: 'Last Analysis',   value: status.last_activity ? timeAgo(status.last_activity) : 'Waiting',
              icon: TrendingUp, color: 'text-green-400' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-gray-500 text-xs">{stat.label}</span>
                </div>
                <p className={`font-bold text-sm font-mono ${stat.color}`}>{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Cards */}
      <div>
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-4 h-px bg-gray-700" />
          Agentic Tier · Virtual Team
          <span className="w-4 h-px bg-gray-700" />
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(status?.agents || agentNames.map(n => ({ name: n, role: '', model: 'llama3.2:1b' }))).map(agent => (
            <AgentCard key={agent.name} agent={agent} active={true} />
          ))}
        </div>
      </div>

      {/* Insights Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-px bg-gray-700" />
            Latest AI Analyses
          </h2>
          <div className="flex items-center gap-2">
            {['all', 'satoshi', 'nakamoto', 'szabo', 'finney'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition-all ${
                  filter === f
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {filteredInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center">
              <Brain className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">No analyses yet</p>
            <p className="text-gray-600 text-xs">Agents are monitoring the blockchain...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInsights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <p className="text-center text-gray-600 text-xs font-mono">
          Last updated: {lastUpdate.toLocaleTimeString('en-US')} · Auto-refresh every 15s
        </p>
      )}
    </div>
  );
}
