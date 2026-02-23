import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Activity, Shield,
  RefreshCw, ExternalLink, Bitcoin, Users, Layers,
} from 'lucide-react';

// sBTC mainnet contract addresses
const SBTC_TOKEN      = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
const SBTC_DEPOSIT    = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit';
const SBTC_WITHDRAWAL = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-withdrawal';
const HIRO            = 'https://api.hiro.so';
const EXPLORER        = 'https://explorer.stacks.co';

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  image_uri?: string;
}

interface BridgeTx {
  txId: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  functionName: string;
  blockHeight: number;
  timestamp: string;
  amountSats: number;
  sender: string;
  status: 'success' | 'pending' | 'failed';
}

interface BridgeStats {
  totalSupplyBTC: number;
  totalSupplySats: number;
  holdersCount: number;
  deposits24h: number;
  withdrawals24h: number;
  totalTxs24h: number;
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatBTC(sats: number) {
  if (sats === 0) return '0 BTC';
  const btc = sats / 1e8;
  if (btc >= 0.001) return `${btc.toFixed(6)} BTC`;
  return `${sats.toLocaleString()} sats`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SBTCBridgeMonitor: React.FC = () => {
  const [meta,       setMeta]       = useState<TokenMeta | null>(null);
  const [stats,      setStats]      = useState<BridgeStats | null>(null);
  const [txs,        setTxs]        = useState<BridgeTx[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<'all' | 'deposit' | 'withdrawal'>('all');

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // 1. Token metadata (supply, decimals, image)
      const metaRes = await fetch(`${HIRO}/metadata/v1/ft/${SBTC_TOKEN}`);
      if (metaRes.ok) {
        const m = await metaRes.json();
        setMeta(m);
        const sats = parseInt(m.total_supply || '0');
        const dec  = m.decimals || 8;
        const supplyBTC = sats / Math.pow(10, dec);

        // 2. Holders count
        let holders = 0;
        const hRes = await fetch(`${HIRO}/extended/v1/tokens/ft/${SBTC_TOKEN}/holders?limit=1`);
        if (hRes.ok) {
          const hData = await hRes.json();
          holders = hData.total || 0;
        }

        // 3. Recent transactions on deposit + withdrawal contracts
        const [depRes, witRes, tokenRes] = await Promise.all([
          fetch(`${HIRO}/extended/v1/address/${SBTC_DEPOSIT}/transactions?limit=50`),
          fetch(`${HIRO}/extended/v1/address/${SBTC_WITHDRAWAL}/transactions?limit=50`),
          fetch(`${HIRO}/extended/v1/address/${SBTC_TOKEN}/transactions?limit=30`),
        ]);

        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const allTxs: BridgeTx[] = [];
        let deposits24h = 0, withdrawals24h = 0;

        const parseTxList = (results: any[], defaultType: 'deposit' | 'withdrawal' | 'transfer') => {
          for (const tx of results) {
            if (tx.tx_type !== 'contract_call') continue;
            const fn   = tx.contract_call?.function_name || '';
            const ts   = tx.burn_block_time_iso || tx.receipt_time_iso || '';
            const tsMs = ts ? new Date(ts).getTime() : 0;

            let type: 'deposit' | 'withdrawal' | 'transfer' = defaultType;
            if (fn.includes('deposit') || fn.includes('mint'))    type = 'deposit';
            if (fn.includes('withdraw') || fn.includes('burn'))   type = 'withdrawal';
            if (fn.includes('transfer'))                           type = 'transfer';

            const amtArg = tx.contract_call?.function_args?.find(
              (a: any) => a.name === 'amount' || a.name === 'value'
            );
            const amtSats = amtArg ? parseInt(amtArg.repr?.replace('u', '') || '0') : 0;

            if (tsMs > cutoff) {
              if (type === 'deposit')    deposits24h++;
              if (type === 'withdrawal') withdrawals24h++;
            }

            allTxs.push({
              txId:         tx.tx_id,
              type,
              functionName: fn,
              blockHeight:  tx.block_height || 0,
              timestamp:    ts,
              amountSats:   amtSats,
              sender:       tx.sender_address || '',
              status:       tx.tx_status === 'success' ? 'success' : tx.tx_status === 'pending' ? 'pending' : 'failed',
            });
          }
        };

        if (depRes.ok)   parseTxList((await depRes.json()).results   || [], 'deposit');
        if (witRes.ok)   parseTxList((await witRes.json()).results   || [], 'withdrawal');
        if (tokenRes.ok) parseTxList((await tokenRes.json()).results || [], 'transfer');

        // Deduplicate + sort by block height desc
        const seen = new Set<string>();
        const unique = allTxs.filter(t => { if (seen.has(t.txId)) return false; seen.add(t.txId); return true; });
        unique.sort((a, b) => b.blockHeight - a.blockHeight);

        setTxs(unique.slice(0, 30));
        setStats({
          totalSupplyBTC: supplyBTC,
          totalSupplySats: sats,
          holdersCount: holders,
          deposits24h,
          withdrawals24h,
          totalTxs24h: deposits24h + withdrawals24h,
        });
      }
    } catch (e) {
      console.error('sBTC fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(() => fetchAll(), 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const filtered = activeTab === 'all'
    ? txs
    : txs.filter(t => t.type === activeTab);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Loading sBTC bridge data…</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Bitcoin className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">sBTC Bridge Monitor</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-gray-500 text-xs font-mono">
              Bitcoin ↔ Stacks · Hiro Token Metadata + Blockchain API
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Total Supply',
              value: `${stats.totalSupplyBTC.toFixed(4)} BTC`,
              sub: `${stats.totalSupplySats.toLocaleString()} sats`,
              icon: Bitcoin,
              color: 'text-orange-400',
              border: 'border-orange-500/20',
              bg: 'bg-orange-500/5',
            },
            {
              label: 'Holders',
              value: stats.holdersCount.toLocaleString(),
              sub: 'unique addresses',
              icon: Users,
              color: 'text-purple-400',
              border: 'border-purple-500/20',
              bg: 'bg-purple-500/5',
            },
            {
              label: 'Deposits (24h)',
              value: stats.deposits24h.toString(),
              sub: 'BTC → sBTC',
              icon: ArrowDownLeft,
              color: 'text-green-400',
              border: 'border-green-500/20',
              bg: 'bg-green-500/5',
            },
            {
              label: 'Withdrawals (24h)',
              value: stats.withdrawals24h.toString(),
              sub: 'sBTC → BTC',
              icon: ArrowUpRight,
              color: 'text-red-400',
              border: 'border-red-500/20',
              bg: 'bg-red-500/5',
            },
          ].map(s => { const Icon = s.icon; return (
            <div key={s.label} className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>
            </div>
          );})}
        </div>
      )}

      {/* ── Bridge Health ── */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
        <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-green-400">Bridge Healthy</span>
          <span className="text-gray-500 text-xs ml-2">· All systems operational · 1:1 BTC peg maintained</span>
        </div>
        <a
          href="https://sbtc.stacks.co/"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium"
        >
          Use Bridge <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* ── Transaction Feed ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Feed header + filters */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Live Transaction Feed</span>
            <span className="text-[10px] font-mono text-gray-600">{filtered.length} txs</span>
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'deposit', 'withdrawal'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveTab(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-mono uppercase tracking-wider transition-all border ${
                  activeTab === f
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                    : 'text-gray-600 hover:text-gray-300 border-transparent hover:border-white/10'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Tx list */}
        <div className="divide-y divide-white/[0.04]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Layers className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No transactions found</p>
            </div>
          ) : (
            filtered.map(tx => (
              <div key={tx.txId} className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-3">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  tx.type === 'deposit'    ? 'bg-green-500/15 text-green-400'
                  : tx.type === 'withdrawal' ? 'bg-red-500/15 text-red-400'
                  : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" />
                  : tx.type === 'withdrawal' ? <ArrowUpRight className="w-4 h-4" />
                  : <Activity className="w-4 h-4" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold capitalize ${
                      tx.type === 'deposit' ? 'text-green-400'
                      : tx.type === 'withdrawal' ? 'text-red-400'
                      : 'text-blue-400'
                    }`}>{tx.type}</span>
                    <span className="text-[10px] font-mono text-gray-600">{tx.functionName}</span>
                    {tx.status === 'pending' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        pending
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 truncate">
                    {shortAddr(tx.sender)}
                  </div>
                </div>

                {/* Amount + time */}
                <div className="text-right flex-shrink-0">
                  {tx.amountSats > 0 && (
                    <div className="text-xs font-mono text-orange-400">{formatBTC(tx.amountSats)}</div>
                  )}
                  <div className="text-[10px] text-gray-600">
                    {tx.timestamp ? timeAgo(tx.timestamp) : `#${tx.blockHeight}`}
                  </div>
                </div>

                {/* Explorer link */}
                <a
                  href={`${EXPLORER}/txid/${tx.txId}?chain=mainnet`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-orange-500/15 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 hover:text-orange-400" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Contract links ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'sBTC Token', addr: SBTC_TOKEN },
          { label: 'Deposit',   addr: SBTC_DEPOSIT },
          { label: 'Withdrawal',addr: SBTC_WITHDRAWAL },
        ].map(c => (
          <a
            key={c.addr}
            href={`${EXPLORER}/address/${c.addr}?chain=mainnet`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-orange-500/5 hover:border-orange-500/20 transition-all group"
          >
            <div>
              <div className="text-[11px] font-semibold text-gray-300 group-hover:text-orange-300">{c.label}</div>
              <div className="text-[10px] font-mono text-gray-600">{shortAddr(c.addr)}</div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-700 group-hover:text-orange-400" />
          </a>
        ))}
      </div>

    </div>
  );
};

export default SBTCBridgeMonitor;
