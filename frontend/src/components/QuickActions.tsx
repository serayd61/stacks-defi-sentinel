import React from 'react';
import { 
  ArrowRightLeft, 
  Coins, 
  CreditCard, 
  TrendingUp, 
  Vote, 
  Gift,
  Zap,
  ChevronRight
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
}

interface QuickActionsProps {
  onAction: (actionId: string) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => {
  const actions: QuickAction[] = [
    {
      id: 'aggregator',
      label: 'Swap Tokens',
      description: 'Best rates across DEXs',
      icon: ArrowRightLeft,
      color: 'purple',
      badge: 'Popular'
    },
    {
      id: 'stake',
      label: 'Stake & Earn',
      description: 'Up to 25% APY',
      icon: Coins,
      color: 'green',
      badge: 'Hot'
    },
    {
      id: 'token-sale',
      label: 'Buy SENTINEL',
      description: 'Token sale live',
      icon: CreditCard,
      color: 'orange',
      badge: 'New'
    },
    {
      id: 'lending',
      label: 'Lend & Borrow',
      description: 'Earn interest',
      icon: TrendingUp,
      color: 'blue'
    },
    {
      id: 'dao',
      label: 'DAO Voting',
      description: 'Governance proposals',
      icon: Vote,
      color: 'yellow'
    },
    {
      id: 'referral',
      label: 'Refer & Earn',
      description: 'Invite friends',
      icon: Gift,
      color: 'pink'
    }
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    purple: { bg: 'from-purple-500/20 to-purple-500/5', text: 'text-purple-400', border: 'border-purple-500/30' },
    green: { bg: 'from-green-500/20 to-green-500/5', text: 'text-green-400', border: 'border-green-500/30' },
    orange: { bg: 'from-orange-500/20 to-orange-500/5', text: 'text-orange-400', border: 'border-orange-500/30' },
    blue: { bg: 'from-blue-500/20 to-blue-500/5', text: 'text-blue-400', border: 'border-blue-500/30' },
    yellow: { bg: 'from-yellow-500/20 to-yellow-500/5', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    pink: { bg: 'from-pink-500/20 to-pink-500/5', text: 'text-pink-400', border: 'border-pink-500/30' }
  };

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Quick Actions</h3>
            <p className="text-sm text-gray-500">Popular features</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((action) => {
          const colors = colorClasses[action.color];
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={`group relative p-4 bg-gradient-to-br ${colors.bg} rounded-xl border ${colors.border} hover:scale-[1.02] transition-all text-left`}
            >
              {action.badge && (
                <span className={`absolute top-2 right-2 px-2 py-0.5 ${colors.text} bg-white/10 text-[10px] font-medium rounded-full`}>
                  {action.badge}
                </span>
              )}
              <action.icon className={`w-6 h-6 ${colors.text} mb-3`} />
              <h4 className="font-medium text-white mb-1">{action.label}</h4>
              <p className="text-xs text-gray-400">{action.description}</p>
              <ChevronRight className="absolute bottom-4 right-4 w-4 h-4 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;

