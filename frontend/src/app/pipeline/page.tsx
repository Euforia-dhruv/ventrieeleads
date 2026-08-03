'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, TrendingUp, DollarSign, Loader2, ArrowRight, Trophy, XCircle, Archive } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface StageData {
  stage_id: string; stage_name: string; slug: string;
  color: string; icon: string; count: number;
  value_min: number; value_max: number; avg_confidence: number;
}
interface PipelineSummary {
  total_leads: number; total_value_min: number; total_value_max: number;
}

const STAGE_ICONS: Record<string, any> = {
  won: Trophy, lost: XCircle, archived: Archive,
};

export default function PipelinePage() {
  const [stages, setStages] = useState<StageData[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: { stages: StageData[]; summary: PipelineSummary } }>('/pipeline/overview'),
      apiFetch<{ data: any }>('/pipeline/stats'),
    ]).then(([o, s]) => {
      setStages(o.data?.stages || []);
      setSummary(o.data?.summary || null);
      setStats(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Sales Pipeline</h1>
            <p className="text-white/50 text-sm">Lead progression through automated stages</p>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Leads', value: stats.total, color: 'from-blue-500 to-indigo-600' },
              { label: 'Active', value: stats.active, color: 'from-cyan-500 to-blue-600' },
              { label: 'Won', value: stats.won, color: 'from-emerald-500 to-green-600' },
              { label: 'Lost', value: stats.lost, color: 'from-red-500 to-pink-600' },
              { label: 'Win Rate', value: `${stats.win_rate}%`, color: 'from-purple-500 to-violet-600' },
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

        {/* Pipeline Value */}
        {summary && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <h2 className="text-white font-semibold">Pipeline Value</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">${summary.total_value_min.toLocaleString()}</span>
              <span className="text-white/40">—</span>
              <span className="text-3xl font-bold text-emerald-400">${summary.total_value_max.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Stage Funnel */}
        <div className="space-y-3">
          {stages.map((stage, idx) => (
            <motion.div key={stage.stage_id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <span className="text-sm font-medium text-white">{stage.stage_name}</span>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-white/5 rounded-full h-6 relative overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stage.count / maxCount) * 100}%` }}
                      transition={{ delay: idx * 0.1, duration: 0.5 }}
                      className="h-6 rounded-full"
                      style={{ backgroundColor: stage.color + '40', border: `1px solid ${stage.color}60` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-sm font-medium text-white">{stage.count}</span>
                    </div>
                  </div>
                </div>
                <div className="w-40 shrink-0 text-right">
                  <span className="text-sm text-white/60">
                    ${stage.value_min.toLocaleString()} — ${stage.value_max.toLocaleString()}
                  </span>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <span className="text-xs text-white/40">{Math.round(stage.avg_confidence * 100)}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
