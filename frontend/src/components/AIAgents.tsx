import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Zap, Shield, FileText, Activity, TrendingUp,
  RefreshCw, ChevronDown, ChevronUp, Clock, AlertTriangle,
  BarChart2, Lock, Newspaper, ExternalLink, CheckCircle, XCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';
const EXPLORER = 'https://explorer.stacks.co';

// ─── Types ─────────────────────────────────────────────────────────────────
interface AgentInfo { name: string; role: string; model: string; }

interface SecurityReport {
  severity?: string;
  vulnerabilities?: string[];
  safe_functions?: string[];
  recommendation?: string;
  blacklist?: boolean;
}

interface Insight {
  agent?: string;
  type?: string;
  amount?: number;
  txid?: string;
  contract_id?: string;
  whale_amount?: number;
  content?: string;
  message?: string;
  receivedAt?: string;
  date?: string;
  event_count?: number;
  raw?: Record<string, unknown>;
  // Satoshi / Nakamoto analysis fields
  analysis?: {
    risk_level?: string;
    pattern?: string;
    prediction?: string;
    action_needed?: boolean;
    arbitrage_opportunity?: boolean;
    recommendation?: string;
    urgency?: string;
    best_pair?: string;
    price_deviation_pct?: number;
    liquidity_trend?: string;
    severity?: string;
    vulnerabilities?: string[];
    suggested_action?: string;
  };
  // Szabo uses "report" key (not "analysis")
  report?: SecurityReport;
  // Nakamoto dex_impact_analysis
  impact?: {
    expected_price_impact_pct?: number;
    affected_pools?: string[];
    suggested_action?: string;
    window_minutes?: number;
  };
}

interface AIStatus {
  cluster: string;
  inference: string;
  agents: AgentInfo[];
  total_insights: number;
  last_activity: string | null;
}

// ─── Agent Config ──────────────────────────────────────────────────────────
const AGENT_CONFIG: Record<string, {
  icon: typeof Brain; color: string; bg: string;
  border: string; label: string;
}> = {
  satoshi:  { icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', label: 'SATOSHI' },
  nakamoto: { icon: BarChart2,  color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',   label: 'NAKAMOTO' },
  szabo:    { icon: Lock,       color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', label: 'SZABO' },
  finney:   { icon: Newspaper,  color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20',  label: 'FINNEY' },
};

const RISK_BADGE: Record<string, string> = {
  low:      'bg-green-400/10 text-green-400 border-green-400/30',
  medium:   'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
  high:     'bg-red-400/10 text-red-400 border-red-400/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  none:     'bg-gray-400/10 text-gray-400 border-gray-400/30',
};

const SEVERITY_COLOR: Record<string, string> = {
  none:     'text-gray-400',
  low:      'text-green-400',
  medium:   'text-yellow-400',
  high:     'text-red-400',
  critical: 'text-red-500',
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-8)}`;
}

// ─── Insight → human-readable explanation ─────────────────────────────────
function buildExplanation(ins: Insight): { title: string; summary: string; detail: string; tags: string[] } {
  const a = ins.analysis || {};
  // Szabo stores security data under "report", fallback to "analysis"
  const r: SecurityReport = ins.report || {};
  const tags: string[] = [];

  // WHALE
  if (ins.type === 'whale_analysis') {
    const risk    = a.risk_level || 'low';
    const pattern = a.pattern    || 'transfer';
    const amount  = ins.amount?.toLocaleString() || '?';
    tags.push(`risk: ${risk}`, pattern);
    if (a.action_needed) tags.push('action needed');
    return {
      title:   `🐋 ${amount} STX Whale Movement Detected`,
      summary: `A large whale transaction of ${amount} STX has been identified. The AI classified this as a ${pattern} pattern with ${risk} risk.`,
      detail:  a.prediction
        ? `Agent Prediction: "${a.prediction}"${a.action_needed ? ' ⚠️ Immediate monitoring is recommended.' : ''}`
        : `Pattern: ${pattern} — ${
            pattern === 'accumulation' ? 'Whale building a position, often a bullish signal.'
          : pattern === 'distribution' ? 'Whale offloading holdings, potential sell pressure ahead.'
          : pattern === 'suspicious'   ? 'Unusual on-chain activity that warrants closer inspection.'
          : 'Routine large transfer between wallets.'
          }`,
      tags,
    };
  }

  // DEX ANALYSIS
  if (ins.type === 'dex_analysis') {
    const arb = a.arbitrage_opportunity;
    const liq = a.liquidity_trend || 'stable';
    const dev = a.price_deviation_pct ?? 0;
    tags.push(`liquidity: ${liq}`);
    if (arb) tags.push('arbitrage opportunity');
    if (a.urgency && a.urgency !== 'low') tags.push(`urgency: ${a.urgency}`);
    return {
      title:   `📊 DEX Market Analysis`,
      summary: `Market scan across Velar, ALEX and Arkadiko pools. Liquidity trend is ${liq}. ${arb ? '⚡ An arbitrage opportunity has been detected.' : 'No immediate arbitrage opportunity found.'}`,
      detail:  a.recommendation
        ? `Recommendation: "${a.recommendation}"${dev > 0 ? ` Price deviation: ${dev.toFixed(2)}%.` : ''}`
        : `Liquidity is ${liq}. ${arb ? `Best pair: ${a.best_pair || 'STX/USDA'}.` : 'Markets within normal ranges.'}`,
      tags,
    };
  }

  // DEX IMPACT — Nakamoto posts type "dex_impact_analysis"
  if (ins.type === 'dex_impact' || ins.type === 'dex_impact_analysis') {
    const impact  = ins.impact || {};
    const wAmount = ins.whale_amount?.toLocaleString() || '?';
    const pools   = impact.affected_pools?.join(', ') || 'STX pools';
    tags.push('whale impact');
    return {
      title:   `💥 Whale Impact on DEX Markets`,
      summary: `Following the ${wAmount} STX whale movement, Nakamoto assessed the expected market impact on Stacks DEX platforms.`,
      detail:  `Affected pools: ${pools}. Expected price impact: ${impact.expected_price_impact_pct?.toFixed(2) ?? '< 0.1'}%. Impact window: ${impact.window_minutes ?? 30} minutes.${impact.suggested_action ? ` Action: ${impact.suggested_action}.` : ''}`,
      tags,
    };
  }

  // SECURITY SCAN — Szabo uses "report" key
  if (ins.type === 'security_scan' || ins.type === 'whale_contract_scan') {
    const severity = r.severity || a.severity || 'none';
    const vulns    = r.vulnerabilities || a.vulnerabilities || [];
    tags.push(`severity: ${severity}`);
    if (r.blacklist) tags.push('blacklisted');
    return {
      title:   `🔒 ${ins.type === 'whale_contract_scan' ? 'Whale Contract' : 'Smart Contract'} Security Scan`,
      summary: `Szabo performed a Clarity contract security analysis${ins.contract_id ? ` on ${shortAddr(ins.contract_id)}` : ''}. Severity: ${severity.toUpperCase()}.`,
      detail:  vulns.length > 0
        ? `Vulnerabilities: ${vulns.join(', ')}. ${r.recommendation || a.suggested_action || 'Review contract before interacting.'}`
        : `No critical vulnerabilities found.${r.recommendation ? ` Recommendation: ${r.recommendation}.` : ''}`,
      tags,
    };
  }

  // DAILY REPORT
  if (ins.type === 'daily_report') {
    tags.push('daily digest', `${ins.event_count ?? 0} events`);
    return {
      title:   `📝 Daily AI Intelligence Report — ${ins.date || 'Today'}`,
      summary: `Finney compiled the day's DeFi intelligence across all Stacks protocols. ${ins.event_count ?? 0} events processed by the agent cluster.`,
      detail:  ins.content && ins.content !== 'Report could not be generated.'
        ? ins.content
        : 'The AI cluster monitored whale movements, DEX liquidity, and contract activity throughout the day. All systems operating normally.',
      tags,
    };
  }

  // URGENT ALERTS — Finney posts type "urgent_alert_whale/security/dex"
  if (ins.type?.startsWith('urgent_alert_') || ins.type?.startsWith('alert_')) {
    const sub = ins.type.replace('urgent_alert_', '').replace('alert_', '');
    tags.push(sub, 'urgent');
    return {
      title:   `⚡ Urgent ${sub.charAt(0).toUpperCase() + sub.slice(1)} Alert`,
      summary: ins.message || 'An urgent alert was triggered by the monitoring agents.',
      detail:  ins.message || '',
      tags,
    };
  }

  return {
    title:   ins.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'AI Analysis',
    summary: ins.content || ins.message || 'Agent analysis recorded.',
    detail:  '',
    tags,
  };
}

// ─── DataRow — helper for the structured detail grid ────────────────────────
function DataRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider flex-shrink-0">{label}</span>
      <span className={`text-[11px] text-right ${mono ? 'font-mono text-gray-300' : 'text-gray-200'}`}>{value}</span>
    </div>
  );
}

// ─── Structured detail section per insight type ────────────────────────────
function InsightDetail({ insight }: { insight: Insight }) {
  const a   = insight.analysis || {};
  const r   = insight.report   || {};
  const imp = insight.impact   || {};
  const cfg = AGENT_CONFIG[insight.agent || ''];

  // ── WHALE ──────────────────────────────────────────────────────────────
  if (insight.type === 'whale_analysis') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-0">
          {insight.amount  && <DataRow label="Amount"       value={`${insight.amount.toLocaleString()} STX`} />}
          {a.risk_level    && <DataRow label="Risk Level"   value={a.risk_level.toUpperCase()} />}
          {a.pattern       && <DataRow label="Pattern"      value={a.pattern} />}
          {a.action_needed !== undefined && (
            <DataRow label="Action Needed" value={a.action_needed ? '⚠️ Yes' : '✓ No'} />
          )}
        </div>

        {a.prediction && (
          <div className="mt-2">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
              <Brain className="w-3 h-3 inline mr-1 opacity-60" />AI Prediction
            </p>
            <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
              {a.prediction}
            </p>
          </div>
        )}

        {insight.txid && insight.txid.length > 10 && (
          <a
            href={`${EXPLORER}/txid/${insight.txid}?chain=mainnet`}
            target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-[10px] font-mono ${cfg?.color || 'text-gray-400'} hover:opacity-80 transition-opacity`}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">TX: {insight.txid}</span>
          </a>
        )}
      </div>
    );
  }

  // ── DEX ANALYSIS ────────────────────────────────────────────────────────
  if (insight.type === 'dex_analysis') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-0">
          {a.liquidity_trend && <DataRow label="Liquidity Trend"  value={a.liquidity_trend} />}
          {a.best_pair       && <DataRow label="Best Pair"        value={a.best_pair} />}
          {a.price_deviation_pct !== undefined && (
            <DataRow label="Price Deviation" value={`${a.price_deviation_pct.toFixed(2)}%`} />
          )}
          {a.urgency         && <DataRow label="Urgency"          value={a.urgency.toUpperCase()} />}
          {a.arbitrage_opportunity !== undefined && (
            <DataRow label="Arbitrage" value={a.arbitrage_opportunity ? '⚡ Detected' : '— None'} />
          )}
        </div>

        {a.recommendation && (
          <div className="mt-2">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
              <Brain className="w-3 h-3 inline mr-1 opacity-60" />Recommendation
            </p>
            <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
              {a.recommendation}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── DEX IMPACT ──────────────────────────────────────────────────────────
  if (insight.type === 'dex_impact' || insight.type === 'dex_impact_analysis') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-0">
          {insight.whale_amount && (
            <DataRow label="Whale Amount" value={`${insight.whale_amount.toLocaleString()} STX`} />
          )}
          {imp.expected_price_impact_pct !== undefined && (
            <DataRow label="Price Impact" value={`${imp.expected_price_impact_pct.toFixed(2)}%`} />
          )}
          {imp.window_minutes !== undefined && (
            <DataRow label="Impact Window" value={`${imp.window_minutes} minutes`} />
          )}
        </div>

        {imp.affected_pools && imp.affected_pools.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Affected Pools</p>
            <div className="flex flex-wrap gap-1.5">
              {imp.affected_pools.map(pool => (
                <span key={pool} className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-400/10 text-blue-300 border border-blue-400/20">
                  {pool}
                </span>
              ))}
            </div>
          </div>
        )}

        {imp.suggested_action && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Suggested Action</p>
            <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
              {imp.suggested_action}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── SECURITY SCAN ───────────────────────────────────────────────────────
  if (insight.type === 'security_scan' || insight.type === 'whale_contract_scan') {
    const severity = r.severity || a.severity || 'none';
    const vulns    = r.vulnerabilities || a.vulnerabilities || [];
    const safeFns  = r.safe_functions || [];

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-0">
          <DataRow label="Severity" value={severity.toUpperCase()} />
          {r.blacklist !== undefined && (
            <DataRow label="Blacklisted" value={r.blacklist ? '🚫 Yes' : '✓ No'} />
          )}
        </div>

        {insight.contract_id && (
          <a
            href={`${EXPLORER}/address/${insight.contract_id}?chain=mainnet`}
            target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-[10px] font-mono ${cfg?.color || 'text-purple-400'} hover:opacity-80 transition-opacity`}
          >
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{insight.contract_id}</span>
          </a>
        )}

        {vulns.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" /> Vulnerabilities
            </p>
            <ul className="space-y-1">
              {vulns.map(v => (
                <li key={v} className="flex items-start gap-1.5 text-xs text-red-300">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">•</span> {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeFns.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" /> Safe Functions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {safeFns.map(fn => (
                <span key={fn} className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-green-400/10 text-green-300 border border-green-400/20">
                  {fn}
                </span>
              ))}
            </div>
          </div>
        )}

        {(r.recommendation || a.suggested_action) && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Recommendation</p>
            <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
              {r.recommendation || a.suggested_action}
            </p>
          </div>
        )}

        {severity !== 'none' && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            severity === 'critical' || severity === 'high'
              ? 'bg-red-500/10 border-red-500/20'
              : severity === 'medium'
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-gray-500/10 border-gray-500/20'
          }`}>
            <Shield className={`w-3.5 h-3.5 flex-shrink-0 ${SEVERITY_COLOR[severity] || 'text-gray-400'}`} />
            <span className={`text-xs font-mono ${SEVERITY_COLOR[severity] || 'text-gray-400'}`}>
              Severity: {severity.toUpperCase()}
              {r.blacklist ? ' — Contract blacklisted' : ''}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── DAILY REPORT ────────────────────────────────────────────────────────
  if (insight.type === 'daily_report') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-0">
          {insight.date        && <DataRow label="Date"   value={insight.date} />}
          {insight.event_count !== undefined && (
            <DataRow label="Events Processed" value={insight.event_count} />
          )}
        </div>
        {insight.content && insight.content !== 'Report could not be generated.' && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
              <FileText className="w-3 h-3 inline mr-1 opacity-60" />Full Report
            </p>
            <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] whitespace-pre-wrap">
              {insight.content}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── URGENT ALERTS ───────────────────────────────────────────────────────
  if (insight.type?.startsWith('urgent_alert_') || insight.type?.startsWith('alert_')) {
    return (
      <div className="space-y-3">
        {insight.message && (
          <p className="text-xs text-gray-200 leading-relaxed bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
            {insight.message}
          </p>
        )}
        {insight.raw && Object.keys(insight.raw).length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Raw Data</p>
            <pre className="text-[10px] font-mono text-gray-400 bg-white/[0.02] rounded-lg p-3 border border-white/[0.06] overflow-auto max-h-40">
              {JSON.stringify(insight.raw, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ── FALLBACK ────────────────────────────────────────────────────────────
  return (
    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
      {insight.content || insight.message || ''}
    </p>
  );
}

// ─── InsightCard ───────────────────────────────────────────────────────────
function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const cfg  = AGENT_CONFIG[insight.agent || ''];
  const Icon = cfg?.icon || Brain;
  const exp  = buildExplanation(insight);
  const risk = insight.analysis?.risk_level || insight.report?.severity;

  return (
    <article className={`rounded-xl border transition-all duration-200 overflow-hidden
      ${cfg?.border || 'border-white/[0.06]'}
      ${expanded ? 'bg-white/[0.04]' : 'bg-white/[0.02] hover:bg-white/[0.035]'}`}>

      {/* Header — always visible */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Agent avatar */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg?.bg || 'bg-gray-700/50'}`}>
          <Icon className={`w-4 h-4 ${cfg?.color || 'text-gray-400'}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-white/90 leading-snug">{exp.title}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {insight.receivedAt && (
                <span className="text-gray-500 text-xs font-mono hidden sm:block">
                  {formatTime(insight.receivedAt)}
                </span>
              )}
              {expanded
                ? <ChevronUp   className="w-3.5 h-3.5 text-gray-500" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </div>

          {/* Summary — always shown */}
          <p className="text-gray-400 text-xs leading-relaxed mt-1">{exp.summary}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {insight.agent && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${cfg?.bg || ''} ${cfg?.color || ''} ${cfg?.border || ''}`}>
                {cfg?.label || insight.agent}
              </span>
            )}
            {risk && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${RISK_BADGE[risk] || 'text-gray-400'}`}>
                {insight.report ? 'severity' : 'risk'}: {risk}
              </span>
            )}
            {exp.tags.filter(t => !t.startsWith('risk') && !t.startsWith('severity')).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-mono border border-white/10 text-gray-400 bg-white/[0.03]">
                {tag}
              </span>
            ))}
            {insight.receivedAt && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono text-gray-600 sm:hidden">
                {timeAgo(insight.receivedAt)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className={`mx-4 mb-4 p-3 rounded-lg border ${cfg?.bg || 'bg-white/[0.02]'} ${cfg?.border || 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-1.5 mb-3 opacity-60">
            <Brain className="w-3 h-3" />
            <span className="font-mono text-[10px] uppercase tracking-wider">AI Analysis Detail</span>
          </div>
          <InsightDetail insight={insight} />
        </div>
      )}
    </article>
  );
}

// ─── Agent Status Card ──────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AgentInfo }) {
  const cfg  = AGENT_CONFIG[agent.name] || { icon: Brain, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20', label: agent.name.toUpperCase() };
  const Icon = cfg.icon;
  return (
    <div className={`rounded-xl border p-3 transition-all hover:scale-[1.02] ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-green-400">LIVE</span>
        </div>
      </div>
      <p className={`font-bold text-xs uppercase tracking-wider mb-1 ${cfg.color}`}>{cfg.label}</p>
      <p className="text-gray-500 text-[10px] leading-relaxed">{agent.role}</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIAgents() {
  const [status,    setStatus]    = useState<AIStatus | null>(null);
  const [insights,  setInsights]  = useState<Insight[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [lastUpdate,setLastUpdate]= useState<Date | null>(null);
  const [filter,    setFilter]    = useState<string>('all');

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`${API_URL}/api/ai-status`),
        fetch(`${API_URL}/api/ai-insights`),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (iRes.ok) { const d = await iRes.json(); setInsights(d.insights || []); }
      setLastUpdate(new Date());
    } catch (e) {
      console.error('AI Agents fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(), 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const filtered = filter === 'all'
    ? insights
    : insights.filter(i => i.agent === filter || i.type?.includes(filter));

  const agents = status?.agents || [
    { name: 'satoshi',  role: 'Whale Tracking & Pattern Analysis', model: 'phi3:mini' },
    { name: 'nakamoto', role: 'DEX Arbitrage & Price Analysis',    model: 'phi3:mini' },
    { name: 'szabo',    role: 'Contract Security Scanner',         model: 'phi3:mini' },
    { name: 'finney',   role: 'User Reports & Notifications',      model: 'phi3:mini' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Connecting to AI Cluster...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
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
          <p className="text-gray-500 text-xs ml-11 font-mono">
            STACKS DEFI SENTINEL · CLOSED-LOOP NETWORK TOPOLOGY
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

      {/* ── Stats Bar ── */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Inference Model', value: status.inference?.split(' ')[1]?.replace(/[()]/g,'') || 'phi3:mini', icon: Zap,      color: 'text-yellow-400' },
            { label: 'Active Agents',   value: `${status.agents.length} online`,                                    icon: Brain,    color: 'text-purple-400' },
            { label: 'Total Insights',  value: `${status.total_insights} analyses`,                                 icon: Activity, color: 'text-blue-400'   },
            { label: 'Last Activity',   value: status.last_activity ? timeAgo(status.last_activity) : 'Waiting…',  icon: Clock,    color: 'text-green-400'  },
          ].map(s => { const Icon = s.icon; return (
            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
            </div>
          );})}
        </div>
      )}

      {/* ── Agent Grid ── */}
      <div>
        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-6 h-px bg-gray-800" /> Agentic Tier · Virtual Team <span className="w-6 h-px bg-gray-800" />
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {agents.map(a => <AgentCard key={a.name} agent={a} />)}
        </div>
      </div>

      {/* ── Intelligence Feed ── */}
      <div>
        {/* Feed header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest flex items-center gap-2 mb-0.5">
              <span className="w-6 h-px bg-gray-800" /> Daily Intelligence Feed
            </p>
            <p className="text-gray-500 text-xs">
              Continuous AI analysis — updated every 15 seconds
            </p>
          </div>
          {/* Filter buttons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {['all', 'satoshi', 'nakamoto', 'szabo', 'finney'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider transition-all border ${
                  filter === f
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'text-gray-600 hover:text-gray-300 border-transparent hover:border-white/10'
                }`}>
                {f === 'all' ? 'All Agents' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Feed list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-xl bg-gray-800/50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No analyses yet</p>
            <p className="text-gray-600 text-xs text-center max-w-xs">
              The AI agents are actively monitoring the Stacks blockchain. Results will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ins, i) => <InsightCard key={i} insight={ins} index={i} />)}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
          <Brain className="w-3 h-3" />
          <span className="font-mono">Powered by phi3:mini · Hetzner VPS · Redis pub/sub</span>
        </div>
        {lastUpdate && (
          <span className="text-gray-600 text-xs font-mono">
            <Clock className="w-3 h-3 inline mr-1" />
            {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
        )}
      </div>

    </div>
  );
}
