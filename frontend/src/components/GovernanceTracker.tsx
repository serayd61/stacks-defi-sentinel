import React, { useState, useEffect, useCallback } from 'react';
import {
  Vote,
  RefreshCw,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Zap,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

interface SipProposal {
  sipNumber: string;
  title: string;
  status: 'draft' | 'discussion' | 'voting' | 'accepted' | 'rejected' | 'implemented';
  author: string;
  summary: string;
  url: string;
  votesFor?: number;
  votesAgainst?: number;
}

interface GovernanceData {
  proposals: SipProposal[];
  activeCount: number;
  totalCount: number;
  scannedAt: string;
}

const GovernanceTracker: React.FC = () => {
  const [data, setData] = useState<GovernanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/governance`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusConfig = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      draft:       { bg: 'bg-gray-500/10 border-gray-500/20', text: 'text-gray-400', icon: <FileText className="w-3 h-3" />, label: 'Draft' },
      discussion:  { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', icon: <MessageSquare className="w-3 h-3" />, label: 'Discussion' },
      voting:      { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', icon: <Vote className="w-3 h-3" />, label: 'Voting' },
      accepted:    { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400', icon: <CheckCircle className="w-3 h-3" />, label: 'Accepted' },
      rejected:    { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
      implemented: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', icon: <Zap className="w-3 h-3" />, label: 'Implemented' },
    };
    return map[status] || map.draft;
  };

  const filteredProposals = data?.proposals?.filter(
    (p) => filter === 'all' || p.status === filter,
  ) || [];

  const filters = ['all', 'voting', 'discussion', 'draft', 'accepted', 'implemented', 'rejected'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Vote className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Governance Tracker</h2>
            <p className="text-sm text-gray-500">Scanning SIP proposals...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Vote className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Governance Tracker</h2>
            <p className="text-sm text-gray-500">Stacks Improvement Proposals (SIPs)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data?.scannedAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(data.scannedAt).toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => { setLoading(true); fetchData(); }}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{data.totalCount}</p>
            <p className="text-xs text-gray-500">Total Proposals</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{data.activeCount}</p>
            <p className="text-xs text-gray-500">Active (Draft/Discussion/Voting)</p>
          </div>
          <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {data.proposals.filter((p) => p.status === 'accepted' || p.status === 'implemented').length}
            </p>
            <p className="text-xs text-gray-500">Accepted / Implemented</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? `All (${data?.totalCount || 0})` : f}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      {filteredProposals.length > 0 ? (
        <div className="space-y-2">
          {filteredProposals.map((proposal, i) => {
            const cfg = getStatusConfig(proposal.status);
            return (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-amber-500/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {proposal.sipNumber}
                      </span>
                      <span className={`${cfg.bg} ${cfg.text} border px-2 py-0.5 rounded-md text-xs font-medium inline-flex items-center gap-1`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white truncate">{proposal.title}</h3>
                    {proposal.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{proposal.summary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>by {proposal.author}</span>
                      {proposal.votesFor !== undefined && (
                        <span className="text-green-400">+{proposal.votesFor}</span>
                      )}
                      {proposal.votesAgainst !== undefined && (
                        <span className="text-red-400">-{proposal.votesAgainst}</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={proposal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Vote className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {filter === 'all' ? 'No proposals found yet' : `No ${filter} proposals`}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Vote className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white mb-1">How Governance Tracker Works</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Scans the <strong className="text-amber-400">stacksgov/sips</strong> GitHub repository using the
              Extract API to pull structured proposal data. Also monitors the Stacks blog for
              governance-related updates. Refreshes every 12 hours using ~4 credits/day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernanceTracker;
