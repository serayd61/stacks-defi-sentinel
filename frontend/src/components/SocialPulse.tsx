import React, { useState, useEffect, useCallback } from 'react';
import { Radio, RefreshCw, Clock, ExternalLink, TrendingUp, TrendingDown, Minus, Hash, MessageCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://stacks-defi-sentinel-production.up.railway.app';

interface Article { title: string; source: string; url: string; sentiment: 'positive' | 'neutral' | 'negative' }
interface PulseData { sentiment: 'bullish' | 'neutral' | 'bearish'; mentionCount: number; topTopics: string[]; articles: Article[]; scannedAt: string }

const SocialPulse: React.FC = () => {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try { const r = await fetch(`${API_URL}/api/social-pulse`); setData(await r.json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const i = setInterval(fetch_, 600_000); return () => clearInterval(i); }, [fetch_]);

  const sentimentCfg = {
    bullish: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', icon: <TrendingUp className="w-6 h-6"/> },
    neutral: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400', icon: <Minus className="w-6 h-6"/> },
    bearish: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: <TrendingDown className="w-6 h-6"/> },
  };

  const articleSentCfg = {
    positive: { dot: 'bg-green-400', text: 'text-green-400' },
    neutral: { dot: 'bg-gray-400', text: 'text-gray-400' },
    negative: { dot: 'bg-red-400', text: 'text-red-400' },
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="p-2 bg-indigo-500/10 rounded-xl"><Radio className="w-6 h-6 text-indigo-400"/></div>
      <div><h2 className="text-xl font-bold text-white">Social Pulse</h2><p className="text-sm text-gray-500">Analyzing market sentiment...</p></div></div>
      <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-white/5 rounded-xl"/>)}</div></div>
  );

  const cfg = sentimentCfg[data?.sentiment || 'neutral'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Radio className="w-6 h-6 text-indigo-400"/></div>
          <div><h2 className="text-xl font-bold text-white">Social Pulse</h2><p className="text-sm text-gray-500">Stacks ecosystem sentiment analysis</p></div>
        </div>
        <div className="flex items-center gap-3">
          {data?.scannedAt && <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/>{new Date(data.scannedAt).toLocaleTimeString()}</span>}
          <button onClick={()=>{setLoading(true);fetch_()}} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><RefreshCw className={`w-4 h-4 text-gray-400 ${loading?'animate-spin':''}`}/></button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          {/* Sentiment Gauge */}
          <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5 text-center`}>
            <div className={`${cfg.text} mx-auto mb-2`}>{cfg.icon}</div>
            <p className={`text-2xl font-bold uppercase ${cfg.text}`}>{data.sentiment}</p>
            <p className="text-xs text-gray-500 mt-1">Market Sentiment</p>
          </div>

          {/* Mentions */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
            <MessageCircle className="w-5 h-5 text-indigo-400 mx-auto mb-2"/>
            <p className="text-2xl font-bold text-white">{data.mentionCount}</p>
            <p className="text-xs text-gray-500">Articles Found</p>
          </div>

          {/* Top Topics */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Hash className="w-3 h-3"/>Trending Topics</h4>
            <div className="flex flex-wrap gap-1.5">
              {data.topTopics.length > 0 ? data.topTopics.map((t, i) => (
                <span key={i} className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded">{t}</span>
              )) : <span className="text-xs text-gray-500">No topics yet</span>}
            </div>
          </div>
        </div>
      )}

      {/* Articles */}
      {data?.articles && data.articles.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-white">Latest Articles</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {data.articles.map((article, i) => {
              const ac = articleSentCfg[article.sentiment];
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className={`w-2 h-2 rounded-full ${ac.dot} flex-shrink-0`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{article.title}</p>
                    <p className="text-xs text-gray-500">{article.source}</p>
                  </div>
                  <span className={`text-xs capitalize ${ac.text}`}>{article.sentiment}</span>
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
                    <ExternalLink className="w-3.5 h-3.5"/>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
          <Radio className="w-10 h-10 text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">No social data available yet</p>
        </div>
      )}

      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg"><Radio className="w-4 h-4 text-indigo-400"/></div>
          <div><h4 className="text-sm font-medium text-white mb-1">How Social Pulse Works</h4>
          <p className="text-xs text-gray-400">Scans CoinDesk and CryptoPanic for Stacks/STX mentions using the <strong className="text-indigo-400">Extract API</strong> with sentiment analysis. Articles are classified as positive/neutral/negative and aggregated into an overall bullish/bearish score. ~10 credits/day.</p></div>
        </div>
      </div>
    </div>
  );
};
export default SocialPulse;
