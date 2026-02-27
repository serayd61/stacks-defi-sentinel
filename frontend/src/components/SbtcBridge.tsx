import React, { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Clock, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

interface BridgeOp { type: 'peg-in' | 'peg-out'; amount: number; status: 'pending' | 'confirmed'; timestamp: string }
interface BridgeData { pegInCount: number; pegOutCount: number; totalLocked: number; pegRatio: number; recentOps: BridgeOp[]; scannedAt: string }

const SbtcBridge: React.FC = () => {
  const [data, setData] = useState<BridgeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/api/sbtc-bridge`); setData(await r.json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const i = setInterval(fetch_, 600_000); return () => clearInterval(i); }, [fetch_]);

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="p-2 bg-orange-500/10 rounded-xl"><Shield className="w-6 h-6 text-orange-400" /></div>
      <div><h2 className="text-xl font-bold text-white">sBTC Bridge Monitor</h2><p className="text-sm text-gray-500">Scanning bridge activity...</p></div></div>
      <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-white/5 rounded-xl"/>)}</div></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20"><Shield className="w-6 h-6 text-orange-400" /></div>
          <div><h2 className="text-xl font-bold text-white">sBTC Bridge Monitor</h2><p className="text-sm text-gray-500">Real-time peg-in/peg-out tracking</p></div>
        </div>
        <div className="flex items-center gap-3">
          {data?.scannedAt && <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/>{new Date(data.scannedAt).toLocaleTimeString()}</span>}
          <button onClick={()=>{setLoading(true);fetch_()}} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><RefreshCw className={`w-4 h-4 text-gray-400 ${loading?'animate-spin':''}`}/></button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4 text-center">
            <Lock className="w-5 h-5 text-orange-400 mx-auto mb-1"/>
            <p className="text-2xl font-bold text-white">{data.totalLocked > 0 ? `${data.totalLocked.toFixed(2)} BTC` : '—'}</p>
            <p className="text-xs text-gray-500">Total Locked</p>
          </div>
          <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 text-center">
            <ArrowDownToLine className="w-5 h-5 text-green-400 mx-auto mb-1"/>
            <p className="text-2xl font-bold text-green-400">{data.pegInCount}</p>
            <p className="text-xs text-gray-500">Peg-In Ops</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 text-center">
            <ArrowUpFromLine className="w-5 h-5 text-blue-400 mx-auto mb-1"/>
            <p className="text-2xl font-bold text-blue-400">{data.pegOutCount}</p>
            <p className="text-xs text-gray-500">Peg-Out Ops</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{data.pegRatio.toFixed(4)}</p>
            <p className="text-xs text-gray-500">Peg Ratio</p>
          </div>
        </div>
      )}

      {data?.recentOps && data.recentOps.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-white">Recent Operations</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {data.recentOps.map((op, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {op.type === 'peg-in' ? <ArrowDownToLine className="w-4 h-4 text-green-400"/> : <ArrowUpFromLine className="w-4 h-4 text-blue-400"/>}
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${op.type==='peg-in'?'bg-green-500/10 text-green-400':'bg-blue-500/10 text-blue-400'}`}>{op.type}</span>
                <span className="text-sm text-white font-mono flex-1">{op.amount.toFixed(4)} BTC</span>
                <span className={`text-xs ${op.status==='confirmed'?'text-green-400':'text-yellow-400'}`}>{op.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Shield className="w-10 h-10 text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">No bridge operations data yet</p>
          <p className="text-gray-500 text-xs mt-1">Bridge monitor scans every 4 hours</p>
        </div>
      )}

      <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-orange-500/10 rounded-lg"><Shield className="w-4 h-4 text-orange-400"/></div>
          <div><h4 className="text-sm font-medium text-white mb-1">How sBTC Bridge Monitor Works</h4>
          <p className="text-xs text-gray-400">Uses Hyperbrowser's <strong className="text-orange-400">Extract API</strong> to analyze sBTC token data on Hiro Explorer. Tracks total locked BTC, peg-in/peg-out operations, and peg ratio health. ~6 credits/day.</p></div>
        </div>
      </div>
    </div>
  );
};
export default SbtcBridge;
