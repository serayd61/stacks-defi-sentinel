import React, { useState, useEffect, useCallback } from 'react';
import { Rocket, RefreshCw, Clock, ExternalLink, AlertTriangle, Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

interface TokenLaunch {
  name: string; symbol: string; platform: string; launchDate?: string;
  initialPrice?: number; status: 'upcoming' | 'live' | 'ended'; url: string; description: string;
}
interface Data { launches: TokenLaunch[]; scannedAt: string }

const TokenLaunches: React.FC = () => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetch_ = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/api/token-launches`); setData(await r.json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const i = setInterval(fetch_, 600_000); return () => clearInterval(i); }, [fetch_]);

  const statusCfg: Record<string, { bg: string; text: string }> = {
    upcoming: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400' },
    live: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400' },
    ended: { bg: 'bg-gray-500/10 border-gray-500/20', text: 'text-gray-400' },
  };

  const filtered = data?.launches?.filter(l => filter === 'all' || l.status === filter) || [];

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="p-2 bg-pink-500/10 rounded-xl"><Rocket className="w-6 h-6 text-pink-400"/></div>
      <div><h2 className="text-xl font-bold text-white">Token Launch Scanner</h2><p className="text-sm text-gray-500">Scanning for new tokens...</p></div></div>
      <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-white/5 rounded-xl"/>)}</div></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20"><Rocket className="w-6 h-6 text-pink-400"/></div>
          <div><h2 className="text-xl font-bold text-white">Token Launch Scanner</h2><p className="text-sm text-gray-500">New token launches & IDOs on Stacks</p></div>
        </div>
        <div className="flex items-center gap-3">
          {data?.scannedAt && <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/>{new Date(data.scannedAt).toLocaleTimeString()}</span>}
          <button onClick={()=>{setLoading(true);fetch_()}} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><RefreshCw className={`w-4 h-4 text-gray-400 ${loading?'animate-spin':''}`}/></button>
        </div>
      </div>

      <div className="flex gap-2">
        {['all','upcoming','live','ended'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter===f?'bg-pink-500/20 text-pink-400 border border-pink-500/30':'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}>
            {f === 'all' ? `All (${data?.launches?.length||0})` : f}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((launch, i) => {
            const cfg = statusCfg[launch.status] || statusCfg.live;
            return (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-pink-500/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{launch.name}</span>
                      <span className="text-xs font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">{launch.symbol}</span>
                      <span className={`${cfg.bg} ${cfg.text} border px-2 py-0.5 rounded text-xs capitalize`}>{launch.status}</span>
                    </div>
                    {launch.description && <p className="text-xs text-gray-500 mb-2">{launch.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span><Zap className="w-3 h-3 inline mr-1"/>{launch.platform}</span>
                      {launch.initialPrice && <span>Price: ${launch.initialPrice}</span>}
                      {launch.launchDate && <span>Launch: {launch.launchDate}</span>}
                    </div>
                  </div>
                  <a href={launch.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400"/>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Rocket className="w-10 h-10 text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">{filter==='all'?'No token launches found yet':'No '+filter+' launches'}</p>
        </div>
      )}

      <div className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-pink-500/10 rounded-lg"><Rocket className="w-4 h-4 text-pink-400"/></div>
          <div><h4 className="text-sm font-medium text-white mb-1">How Token Launch Scanner Works</h4>
          <p className="text-xs text-gray-400">Scans STXCity and ALEX Launchpad using the <strong className="text-pink-400">Extract API</strong> to detect new token launches, IDOs, and listings. ~8 credits/day, refreshes every 6 hours.</p></div>
        </div>
      </div>
    </div>
  );
};
export default TokenLaunches;
