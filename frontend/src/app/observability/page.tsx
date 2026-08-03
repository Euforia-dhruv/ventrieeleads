'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Loader2, Server, Database, Cpu, HardDrive, Globe, BarChart3, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface SystemMetrics {
  total_metrics: number;
  categories: {
    ai: number; workers: number; queues: number;
    discovery: number; database: number; redis: number; api: number;
  };
  health: { status: string; issues: string[] };
}

interface Metric {
  id: string; category: string; metric_name: string;
  metric_value: number; unit: string;
  tags: any; recorded_at: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  ai: Cpu, workers: Server, queues: Activity,
  discovery: Globe, database: Database, redis: HardDrive, api: BarChart3,
};

const CATEGORY_COLORS: Record<string, string> = {
  ai: 'from-purple-500 to-indigo-600',
  workers: 'from-blue-500 to-cyan-600',
  queues: 'from-yellow-500 to-orange-600',
  discovery: 'from-emerald-500 to-teal-600',
  database: 'from-cyan-500 to-blue-600',
  redis: 'from-red-500 to-pink-600',
  api: 'from-violet-500 to-purple-600',
};

export default function ObservabilityPage() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<Metric[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: SystemMetrics }>('/observability/overview')
      .then(d => setSystemMetrics(d.data))
      .catch(console.error);
    apiFetch<{ data: Metric[] }>('/observability/metrics?limit=100')
      .then(d => setRecentMetrics(d.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const filtered = selectedCategory === 'all'
    ? recentMetrics
    : recentMetrics.filter(m => m.category === selectedCategory);

  const categories = Object.entries(systemMetrics?.categories || {});

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Observability</h1>
            <p className="text-white/50 text-sm">System metrics and health monitoring</p>
          </div>
        </div>

        {/* Health Status */}
        {systemMetrics?.health && (
          <div className={`rounded-xl p-5 mb-8 border ${
            systemMetrics.health.status === 'healthy'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : systemMetrics.health.status === 'degraded'
              ? 'bg-yellow-500/5 border-yellow-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-3">
              {systemMetrics.health.status === 'healthy' ? (
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
              )}
              <div>
                <h3 className="text-white font-semibold capitalize">{systemMetrics.health.status}</h3>
                {systemMetrics.health.issues.length > 0 && (
                  <p className="text-white/50 text-sm mt-1">{systemMetrics.health.issues.join(', ')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {categories.map(([cat, count], idx) => {
            const Icon = CATEGORY_ICONS[cat] || BarChart3;
            return (
              <motion.div key={cat}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition-all hover:bg-white/[0.07] ${
                  selectedCategory === cat ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-white/60" />
                  <span className="text-xs text-white/50 capitalize">{cat}</span>
                </div>
                <div className="text-xl font-bold text-white">{count}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Metrics List */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-white font-semibold text-sm">Recent Metrics ({filtered.length})</h2>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">No metrics recorded yet</div>
            ) : (
              filtered.slice(0, 50).map((m, idx) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[m.category] || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                      {(() => { const Icon = CATEGORY_ICONS[m.category] || BarChart3; return <Icon className="h-4 w-4 text-white" />; })()}
                    </div>
                    <div>
                      <span className="text-white text-sm">{m.metric_name}</span>
                      <span className="text-white/30 text-xs ml-2 capitalize">({m.category})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-medium text-sm">{m.metric_value.toLocaleString()}</span>
                    {m.unit && <span className="text-white/40 text-xs ml-1">{m.unit}</span>}
                    <div className="text-white/30 text-xs">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(m.recorded_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
