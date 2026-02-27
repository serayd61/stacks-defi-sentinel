import React from 'react';
import {
  Activity, TrendingUp, Users, Wallet, Zap, Github, ExternalLink,
  WifiOff, Bell, ArrowRightLeft, RefreshCw,
  ChevronRight, Menu, X,
  Target, Star, Fuel,
  ChevronDown, Code, Server, Search,
  Home, ChevronLeft, Brain, Bitcoin,
  Layers, Image, BarChart3, Link2, PieChart, Blocks, BarChart2,
  Globe, Fish, Vote, Shield, Rocket, Radio,
} from 'lucide-react';

export type TabType =
  | 'overview' | 'market' | 'network'
  | 'swaps' | 'price-alerts' | 'block-explorer' | 'dex'
  | 'contracts' | 'alerts' | 'wallet-analytics' | 'portfolio' | 'stacking' | 'token-analytics' | 'user-analytics' | 'chainhooks'
  | 'ai-agents' | 'web-intel' | 'whale-intel' | 'defi-scan' | 'governance' | 'sbtc-bridge' | 'token-launches' | 'social-pulse' | 'sbtc'
  | 'gas' | 'leaderboard' | 'predict' | 'nfts';

export interface NavItem { id: TabType; label: string; icon: React.ElementType; badge?: 'hot'|'new'|'live'; }
export interface NavSection { label: string; items: NavItem[]; }

export const NAV: NavSection[] = [
  { label: 'Overview', items: [
    { id: 'overview',   label: 'Dashboard',       icon: Home,       badge: 'live' },
    { id: 'market',     label: 'Market',          icon: TrendingUp, badge: 'hot'  },
    { id: 'network',    label: 'Network Health',  icon: Server },
  ]},
  { label: 'Analytics', items: [
    { id: 'contracts',        label: 'Contract Activity', icon: Code },
    { id: 'alerts',           label: 'Whale Alerts',      icon: Activity },
    { id: 'wallet-analytics', label: 'Wallet Analyzer',   icon: Search },
    { id: 'portfolio',        label: 'Portfolio',          icon: PieChart,   badge: 'new' },
    { id: 'stacking',         label: 'Stacking',           icon: Layers,     badge: 'new' },
    { id: 'token-analytics',  label: 'Token Analytics',    icon: BarChart3,  badge: 'new' },
    { id: 'user-analytics',   label: 'User & Revenue',     icon: BarChart2,  badge: 'new' },
  ]},
  { label: 'Live Data', items: [
    { id: 'swaps',          label: 'Swap History',    icon: ArrowRightLeft },
    { id: 'dex',            label: 'DEX Aggregator',  icon: Link2,     badge: 'new' },
    { id: 'block-explorer', label: 'Block Explorer',  icon: Blocks,    badge: 'new' },
    { id: 'price-alerts',   label: 'Price Alerts',    icon: Bell },
  ]},
  { label: 'Bitcoin', items: [
    { id: 'sbtc', label: 'sBTC Bridge', icon: Bitcoin, badge: 'live' as const },
  ]},
  { label: 'AI', items: [
    { id: 'ai-agents',  label: 'AI Agents',    icon: Brain,  badge: 'live' as const },
    { id: 'web-intel',   label: 'Web Intel',     icon: Globe,  badge: 'new' as const },
    { id: 'whale-intel', label: 'Whale Intel',   icon: Fish,   badge: 'new' as const },
    { id: 'defi-scan',  label: 'DeFi Scanner',  icon: Search, badge: 'new' as const },
    { id: 'governance', label: 'Governance',    icon: Vote,   badge: 'new' as const },
    { id: 'sbtc-bridge', label: 'sBTC Bridge',  icon: Shield, badge: 'new' as const },
    { id: 'token-launches', label: 'Token Launches', icon: Rocket, badge: 'new' as const },
    { id: 'social-pulse', label: 'Social Pulse', icon: Radio, badge: 'new' as const },
    { id: 'chainhooks',  label: 'Chainhooks',    icon: Link2 },
  ]},
  { label: 'Explore', items: [
    { id: 'gas',         label: 'Gas Tracker',   icon: Fuel },
    { id: 'nfts',        label: 'NFT Gallery',   icon: Image,  badge: 'new' },
    { id: 'leaderboard', label: 'Leaderboard',   icon: Star },
    { id: 'predict',     label: 'Predictions',   icon: Target },
  ]},
];

export const BADGE: Record<string, { label: string; bg: string; text: string }> = {
  hot:  { label: 'HOT',  bg: 'rgba(251,146,60,0.15)',  text: '#fb923c' },
  new:  { label: 'NEW',  bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  live: { label: 'LIVE', bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};
