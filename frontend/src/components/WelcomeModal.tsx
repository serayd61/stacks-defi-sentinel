import React, { useState } from 'react';
import { X, Wallet, BarChart3, Coins, Shield, ArrowRight, CheckCircle } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectWallet: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, onConnectWallet }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to DeFi Sentinel',
      description: 'Your all-in-one DeFi monitoring platform on Stacks',
      icon: Shield,
      features: [
        'Real-time market data & analytics',
        'Whale alerts & smart notifications',
        'Portfolio tracking & insights',
        'Token staking & governance'
      ]
    },
    {
      title: 'Connect Your Wallet',
      description: 'Link your Stacks wallet to unlock all features',
      icon: Wallet,
      features: [
        'Xverse, Leather, OKX supported',
        'View your portfolio',
        'Stake tokens & earn rewards',
        'Participate in governance'
      ]
    },
    {
      title: 'Start Earning',
      description: 'Stake SENTINEL tokens and earn rewards',
      icon: Coins,
      features: [
        'Up to 25% APY on staking',
        'Pro membership benefits',
        'Referral rewards program',
        'DAO voting power'
      ]
    }
  ];

  if (!isOpen) return null;

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#12121a] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-orange-500 transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 pt-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 flex items-center justify-center border border-purple-500/30">
              <currentStep.icon className="w-10 h-10 text-purple-400" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h2>
            <p className="text-gray-400">{currentStep.description}</p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {currentStep.features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
              >
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 px-6 bg-white/5 hover:bg-white/10 rounded-xl font-medium text-white transition-colors"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-orange-500 rounded-xl font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onConnectWallet();
                  onClose();
                }}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-500 to-orange-500 rounded-xl font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>

          {/* Skip */}
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-gray-500 hover:text-white text-sm transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 pb-6">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setStep(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === step 
                  ? 'w-6 bg-gradient-to-r from-purple-500 to-orange-500' 
                  : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;

