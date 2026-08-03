'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Brain, Rocket, Target, Globe, TrendingUp,
  DollarSign, Cpu, Loader2, RefreshCw, CheckCircle,
  AlertTriangle, Lightbulb,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface ExecutiveReport {
  id: string; report_date: string; title: string;
  summary: string; content: any;
  recommendations: any[]; top_opportunities: any[];
  top_cities: any[]; top_industries: any[];
  top_providers: string[]; system_health: any; economics: any;
}

export default function ExecutiveAIPage() {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    apiFetch<{ data: ExecutiveReport | null }>('/intelligence-center/executive')
      .then(d => setReport(d.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiFetch('/intelligence-center/executive/generate', { method: 'POST' });
      // Poll for report
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const d = await apiFetch<{ data: ExecutiveReport | null }>('/intelligence-center/executive');
        if (d.data) { setReport(d.data); break; }
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Executive AI</h1>
              <p className="text-white/50 text-sm">AI-generated executive intelligence reports</p>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {!report ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20">
            <Brain className="h-16 w-16 text-white/10 mb-4" />
            <h2 className="text-white text-lg font-medium mb-2">No reports yet</h2>
            <p className="text-white/40 text-sm mb-6">Generate your first executive intelligence report</p>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:opacity-90 disabled:opacity-50">
              {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {generating ? 'Generating...' : 'Generate First Report'}
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h2 className="text-white text-lg font-bold">{report.title}</h2>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{report.summary}</p>
              <p className="text-white/30 text-xs mt-2">
                Generated: {new Date(report.report_date).toLocaleString()}
              </p>
            </div>

            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Priority Recommendations
                </h3>
                <div className="space-y-3">
                  {report.recommendations.slice(0, 10).map((rec: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        rec.priority >= 9 ? 'bg-red-500/20' : rec.priority >= 7 ? 'bg-orange-500/20' : 'bg-blue-500/20'
                      }`}>
                        {rec.priority >= 9 ? <AlertTriangle className="h-4 w-4 text-red-400" /> :
                         rec.priority >= 7 ? <AlertTriangle className="h-4 w-4 text-orange-400" /> :
                         <CheckCircle className="h-4 w-4 text-blue-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{rec.title}</p>
                        <p className="text-white/40 text-xs mt-0.5">{rec.description}</p>
                      </div>
                      <span className="text-white/30 text-xs">P{rec.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Cities */}
            {report.top_cities && report.top_cities.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-emerald-400" />
                  Top Cities
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.top_cities.map((city: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div>
                        <p className="text-white text-sm font-medium">{city.city || city.name}</p>
                        <p className="text-white/40 text-xs">{city.country_code || city.country}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm">{city.total_companies || city.company_count || 0}</p>
                        <p className="text-emerald-400 text-xs">+{city.growth_rate || city.new_this_week || 0}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Industries */}
            {report.top_industries && report.top_industries.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-400" />
                  Top Industries
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.top_industries.map((ind: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-white text-sm font-medium">{ind.industry || ind.name}</p>
                      <span className="text-white/40 text-xs">{ind.total_companies || ind.count || 0} companies</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Health & Economics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.system_health && Object.keys(report.system_health).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-cyan-400" />
                    System Health
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(report.system_health).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-white/40">{k.replace(/_/g, ' ')}</span>
                        <span className="text-white">{typeof v === 'number' ? (v < 1 ? `${Math.round(v * 100)}%` : v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.economics && Object.keys(report.economics).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-yellow-400" />
                    Economics
                  </h3>
                  <div className="space-y-2">
                    {report.economics.totals && Object.entries(report.economics.totals).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-white/40">{k.replace(/_/g, ' ')}</span>
                        <span className="text-white">{String(v)}</span>
                      </div>
                    ))}
                    {report.economics.costs && Object.entries(report.economics.costs).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-white/40">{k.replace(/_/g, ' ')}</span>
                        <span className="text-white">{typeof v === 'number' && k.includes('cost') ? `$${v}` : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Providers */}
            {report.top_providers && report.top_providers.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-blue-400" />
                  Top Providers
                </h3>
                <div className="flex flex-wrap gap-2">
                  {report.top_providers.map((p, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
