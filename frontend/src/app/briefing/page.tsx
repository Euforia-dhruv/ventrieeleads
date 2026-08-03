'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee, Loader2, TrendingUp, Target, DollarSign, Clock, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface BriefingReport {
  id: string;
  report_type: string;
  report_date: string;
  title: string;
  summary: string;
  content: {
    pipeline: any;
    top_prospects: any[];
    discovery: any;
    economics: any;
    system: any;
  };
  recommendations: { title: string; reason: string; value: number }[];
  top_opportunities: any[];
  system_health: any;
  economics: any;
  created_at: string;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<BriefingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ data: BriefingReport | null }>('/executive/morning');
      setBriefing(d.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBriefing(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiFetch('/executive/morning/generate', { method: 'POST', body: JSON.stringify({}) });
      setTimeout(() => fetchBriefing(), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const content = briefing?.content;
  const pipeline = content?.pipeline;
  const topProspects = content?.top_prospects || briefing?.top_opportunities || [];
  const recommendations = briefing?.recommendations || [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Coffee className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Morning Briefing</h1>
              <p className="text-white/50 text-sm">Your daily AI-powered executive summary</p>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate New'}
          </button>
        </div>

        {!briefing ? (
          <div className="text-center py-20">
            <Coffee className="h-16 w-16 text-white/10 mx-auto mb-4" />
            <h2 className="text-white text-lg mb-2">No briefing available</h2>
            <p className="text-white/40 text-sm mb-4">Generate your first morning briefing</p>
            <button onClick={handleGenerate}
              className="px-6 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium border border-amber-500/30 hover:bg-amber-500/30">
              Generate Briefing
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Title & Summary */}
            <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
              <h2 className="text-white font-bold text-lg mb-2">{briefing.title}</h2>
              <p className="text-white/60 text-sm leading-relaxed">{briefing.summary}</p>
            </div>

            {/* Pipeline Stats */}
            {pipeline && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Leads', value: pipeline.active ?? 0 },
                  { label: 'Pipeline Value', value: `$${(pipeline.total_pipeline_value ?? 0).toLocaleString()}` },
                  { label: 'Win Rate', value: `${pipeline.win_rate ?? 0}%` },
                  { label: 'Total Leads', value: pipeline.total ?? 0 },
                ].map((item, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <span className="text-xs text-white/50">{item.label}</span>
                    <div className="text-xl font-bold text-white mt-1">{item.value}</div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Top Prospects */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4">Top Prospects Today</h2>
              <div className="space-y-3">
                {topProspects.length === 0 ? (
                  <p className="text-white/30 text-sm">No prospects scored yet today</p>
                ) : (
                  topProspects.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-bold ${
                          (p.overall_readiness || 0) >= 75 ? 'text-emerald-400' :
                          (p.overall_readiness || 0) >= 50 ? 'text-yellow-400' : 'text-white/60'
                        }`}>{Math.round(p.overall_readiness || 0)}</div>
                        <div>
                          <span className="text-white text-sm font-medium">{p.company_name}</span>
                          {p.industry && <span className="text-white/30 text-xs ml-2">{p.industry}</span>}
                        </div>
                      </div>
                      {p.recommended_action && (
                        <span className="text-white/40 text-xs max-w-xs text-right">{p.recommended_action}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5">
                <h2 className="text-white font-semibold text-sm mb-3">AI Recommendations</h2>
                <div className="space-y-2">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-white/70 p-2 bg-white/[0.02] rounded-lg">
                      <ArrowRight className="h-3 w-3 text-purple-400 mt-1 shrink-0" />
                      <div>
                        <span className="font-medium text-white">{rec.title}</span>
                        {rec.reason && <span className="ml-2 text-white/50">{rec.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-white/20 text-xs mt-8">
              Generated: {new Date(briefing.created_at).toLocaleString()}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
