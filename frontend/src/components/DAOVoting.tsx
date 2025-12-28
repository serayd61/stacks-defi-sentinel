import React, { useState, useEffect } from 'react';
import { Vote, Users, Clock, CheckCircle2, XCircle, BarChart3, Trophy, Shield } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  totalVoters: number;
  startTime: string;
  endTime: string;
  category: 'governance' | 'treasury' | 'technical' | 'community';
  quorum: number;
  yourVote?: 'for' | 'against' | null;
}

interface VotingStats {
  totalProposals: number;
  activeProposals: number;
  totalVotes: number;
  participationRate: number;
  yourVotingPower: number;
  yourProposals: number;
}

const DAOVoting: React.FC = () => {
  const { isConnected, stxAddress } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<VotingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'passed' | 'all'>('active');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      // Demo governance proposals
      const mockProposals: Proposal[] = [
        {
          id: 1,
          title: 'SIP-001: Increase Staking Rewards',
          description: 'Proposal to increase SNTL staking rewards from 8% to 12% APY to incentivize long-term holding and protocol participation.',
          proposer: 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB',
          status: 'active',
          votesFor: 125000,
          votesAgainst: 45000,
          totalVoters: 342,
          startTime: new Date(Date.now() - 86400000 * 2).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 5).toISOString(),
          category: 'governance',
          quorum: 100000,
          yourVote: null,
        },
        {
          id: 2,
          title: 'SIP-002: Treasury Diversification',
          description: 'Allocate 10% of treasury funds to sBTC to diversify holdings and align with Stacks ecosystem growth.',
          proposer: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KR9H',
          status: 'active',
          votesFor: 89000,
          votesAgainst: 21000,
          totalVoters: 198,
          startTime: new Date(Date.now() - 86400000 * 1).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 6).toISOString(),
          category: 'treasury',
          quorum: 100000,
          yourVote: 'for',
        },
        {
          id: 3,
          title: 'SIP-003: Add ALEX DEX Integration',
          description: 'Integrate ALEX DEX into the DeFi Sentinel aggregator for better swap routing and liquidity.',
          proposer: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1',
          status: 'passed',
          votesFor: 185000,
          votesAgainst: 15000,
          totalVoters: 456,
          startTime: new Date(Date.now() - 86400000 * 10).toISOString(),
          endTime: new Date(Date.now() - 86400000 * 3).toISOString(),
          category: 'technical',
          quorum: 100000,
          yourVote: 'for',
        },
        {
          id: 4,
          title: 'SIP-004: Community Grants Program',
          description: 'Establish a 50,000 SNTL grants program to fund community-built tools and integrations.',
          proposer: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          status: 'pending',
          votesFor: 0,
          votesAgainst: 0,
          totalVoters: 0,
          startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 9).toISOString(),
          category: 'community',
          quorum: 100000,
          yourVote: null,
        },
        {
          id: 5,
          title: 'SIP-005: Reduce Subscription Fee',
          description: 'Reduce the premium subscription fee from 2.5 STX to 2 STX per month to increase accessibility.',
          proposer: 'SP3NE8YJHGX32GNGZ9NPDH0M65YWB3PFCN5J3PX9Z',
          status: 'rejected',
          votesFor: 32000,
          votesAgainst: 78000,
          totalVoters: 234,
          startTime: new Date(Date.now() - 86400000 * 15).toISOString(),
          endTime: new Date(Date.now() - 86400000 * 8).toISOString(),
          category: 'governance',
          quorum: 100000,
          yourVote: 'against',
        },
      ];

      setProposals(mockProposals);
      setStats({
        totalProposals: 5,
        activeProposals: 2,
        totalVotes: 589000,
        participationRate: 45.2,
        yourVotingPower: 50000,
        yourProposals: 0,
      });
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId: number, vote: 'for' | 'against') => {
    if (!isConnected) return;
    
    setIsVoting(true);
    try {
      // Simulate voting transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProposals(prev => prev.map(p => 
        p.id === proposalId 
          ? { 
              ...p, 
              yourVote: vote,
              votesFor: vote === 'for' ? p.votesFor + (stats?.yourVotingPower || 0) : p.votesFor,
              votesAgainst: vote === 'against' ? p.votesAgainst + (stats?.yourVotingPower || 0) : p.votesAgainst,
              totalVoters: p.totalVoters + 1,
            }
          : p
      ));
      
      setSelectedProposal(null);
    } catch (error) {
      console.error('Voting failed:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>;
      case 'passed':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Passed</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Rejected</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Pending</span>;
      default:
        return null;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'governance': return '⚖️';
      case 'treasury': return '💰';
      case 'technical': return '⚙️';
      case 'community': return '👥';
      default: return '📋';
    }
  };

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff < 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const filteredProposals = proposals.filter(p => {
    if (activeTab === 'active') return p.status === 'active';
    if (activeTab === 'passed') return p.status === 'passed';
    return true;
  });

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 rounded-2xl p-6 border border-violet-500/30">
        <div className="animate-pulse">
          <div className="h-8 bg-violet-500/20 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-violet-500/20 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 rounded-2xl p-6 border border-violet-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Vote className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">DAO Governance</h2>
            <p className="text-sm text-violet-300/70">Community Proposals</p>
          </div>
        </div>
        {isConnected && stats && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 rounded-xl">
            <Shield className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-violet-300">
              {stats.yourVotingPower.toLocaleString()} SNTL
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-black/30 rounded-xl p-4 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-violet-300/70">Total Proposals</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.totalProposals}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Vote className="w-4 h-4 text-green-400" />
              <span className="text-xs text-violet-300/70">Active</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.activeProposals}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-violet-300/70">Participation</span>
            </div>
            <p className="text-lg font-bold text-white">{stats.participationRate}%</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-violet-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-violet-300/70">Total Votes</span>
            </div>
            <p className="text-lg font-bold text-white">{(stats.totalVotes / 1000).toFixed(0)}K</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['active', 'passed', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-violet-500 text-white'
                : 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
            }`}
          >
            {tab === 'active' ? 'Active' : tab === 'passed' ? 'Passed' : 'All Proposals'}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      <div className="space-y-3">
        {filteredProposals.map((proposal) => (
          <div
            key={proposal.id}
            className="p-4 bg-black/20 rounded-xl border border-violet-500/10 hover:border-violet-500/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getCategoryIcon(proposal.category)}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-white font-medium">{proposal.title}</h4>
                    {getStatusBadge(proposal.status)}
                    {proposal.yourVote && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        proposal.yourVote === 'for' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        You voted {proposal.yourVote}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{proposal.description}</p>
                  <p className="text-xs text-violet-300/50 mt-1">
                    by {formatAddress(proposal.proposer)} • {proposal.totalVoters} voters
                  </p>
                </div>
              </div>
              {proposal.status === 'active' && (
                <div className="flex items-center gap-1 text-xs text-violet-300/70">
                  <Clock className="w-3 h-3" />
                  {formatTimeRemaining(proposal.endTime)}
                </div>
              )}
            </div>

            {/* Voting Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400">For: {(proposal.votesFor / 1000).toFixed(0)}K</span>
                <span className="text-red-400">Against: {(proposal.votesAgainst / 1000).toFixed(0)}K</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-green-500"
                  style={{ width: `${proposal.votesFor / (proposal.votesFor + proposal.votesAgainst || 1) * 100}%` }}
                />
                <div 
                  className="h-full bg-red-500"
                  style={{ width: `${proposal.votesAgainst / (proposal.votesFor + proposal.votesAgainst || 1) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span>Quorum: {(proposal.quorum / 1000).toFixed(0)}K SNTL</span>
                <span className={proposal.votesFor + proposal.votesAgainst >= proposal.quorum ? 'text-green-400' : ''}>
                  {proposal.votesFor + proposal.votesAgainst >= proposal.quorum ? '✓ Quorum reached' : `${((proposal.votesFor + proposal.votesAgainst) / proposal.quorum * 100).toFixed(0)}% of quorum`}
                </span>
              </div>
            </div>

            {/* Vote Buttons */}
            {proposal.status === 'active' && isConnected && !proposal.yourVote && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleVote(proposal.id, 'for')}
                  disabled={isVoting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Vote For
                </button>
                <button
                  onClick={() => handleVote(proposal.id, 'against')}
                  disabled={isVoting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Vote Against
                </button>
              </div>
            )}

            {!isConnected && proposal.status === 'active' && (
              <p className="text-center text-sm text-violet-300/50 py-2">
                Connect wallet to vote
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Create Proposal */}
      {isConnected && (
        <div className="mt-6 p-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-xl border border-violet-500/20 text-center">
          <p className="text-sm text-violet-300/70 mb-3">
            Have a proposal? You need at least 10,000 SNTL to create one.
          </p>
          <button className="px-6 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl text-white font-medium transition-colors">
            Create Proposal
          </button>
        </div>
      )}
    </div>
  );
};

export default DAOVoting;

