'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  HeartPulse, Activity, Zap, Clock, AlertTriangle, CheckCircle2,
  XCircle, Loader2, TrendingUp, DollarSign, Server, Wifi,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface HealthData {
  queue_size: number; active_workers: number;
  avg_runtime_ms: number; avg_businesses_per_job: number;
  completed_24h: number; failed_24h: number; total_24h: number;
  recent_failures: { error_message: string; count: string }[];
}
interface ProviderHealth {
  provider: string; total_requests: number; successful_requests: number;
  failed_requests: number; success_rate: number; avg_latency_ms: number;
  countries_served: number; last_used_at: string | null; last_error: string | null;
}
interface CostData {
  totals: {
    total_provider_requests: string; total_ai_requests: string;
    total_browser_sessions: string; total_estimated_cost_usd: string;
    total_businesses_discovered: string; unique_businesses: string;
    cost_per_business: string;
  };
  daily: { date: string; campaigns: string; businesses: string; cost: string }[];
}

const PROVIDER_ICONS: Record<string, string> = {
  google_maps: '🗺️', clutch: '🏆', goodfirms: '📊', designrush: '🎨',
  dubai_directory: '🇦🇪', yello_uae: '📱',
};

export default function DiscoveryHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: HealthData }>('/discovery/health'),
      apiFetch<{ data: ProviderHealth[] }>('/discovery/health/providers'),
      apiFetch<{ data: CostData }>('/discovery/costs'),
    ]).then(([h, p, c]) => {
      setHealth(h.data);
      setProviders(p.data || []);
      setCosts(c.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const fmtMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Discovery Health</h1>
            <p className="text-white/50 text-sm">Queue status, provider performance, and system health</p>
          </div>
        </div>

        {/* Summary Cards */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Queue Size', value: health.queue_size, icon: Clock, color: 'from-yellow-500 to-orange-600' },
              { label: 'Active Workers', value: health.active_workers, icon: Server, color: 'from-blue-500 to-indigo-600' },
              { label: 'Completed (24h)', value: health.completed_24h, icon: CheckCircle2, color: 'from-emerald-500 to-teal-600' },
              { label: 'Failed (24h)', value: health.failed_24h, icon: XCircle, color: 'from-red-500 to-pink-600' },
            ].map((item, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs text-white/50">{item.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{item.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Performance Stats */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-white/50">Avg Runtime</span>
              <div className="text-lg font-bold text-white mt-1">{fmtMs(health.avg_runtime_ms)}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-white/50">Avg Businesses/Job</span>
              <div className="text-lg font-bold text-white mt-1">{health.avg_businesses_per_job}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="text-xs text-white/50">Success Rate (24h)</span>
              <div className="text-lg font-bold text-white mt-1">
                {health.total_24h > 0
                  ? `${Math.round(health.completed_24h / health.total_24h * 100)}%`
                  : '—'}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Provider Health */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" /> Provider Health
            </h2>
            {providers.length === 0 ? (
              <p className="text-white/30 text-sm">No provider metrics yet. Run a discovery campaign first.</p>
            ) : (
              <div className="space-y-2">
                {providers.map(p => (
                  <div key={p.provider}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <span className="text-lg">{PROVIDER_ICONS[p.provider] || '⚙️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white capitalize">{p.provider.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-white/30">{p.countries_served} countries · {p.total_requests} requests</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        p.success_rate >= 0.9 ? 'text-emerald-400' :
                        p.success_rate >= 0.7 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(p.success_rate * 100)}%
                      </div>
                      <div className="text-xs text-white/30">{fmtMs(p.avg_latency_ms)}</div>
                    </div>
                    <div className="w-16 bg-white/5 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${
                        p.success_rate >= 0.9 ? 'bg-emerald-400' :
                        p.success_rate >= 0.7 ? 'bg-yellow-400' : 'bg-red-400'
                      }`} style={{ width: `${Math.round(p.success_rate * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Failures */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Recent Failures
            </h2>
            {health && health.recent_failures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-10 w-10 text-emerald-400/30 mb-2" />
                <p className="text-white/30 text-sm">No recent failures</p>
              </div>
            ) : (
              <div className="space-y-2">
                {health?.recent_failures.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-red-500/[0.05] border border-red-500/10">
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/70 break-all">{f.error_message}</div>
                      <div className="text-xs text-white/30 mt-1">{f.count} occurrences</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cost Tracking */}
        {costs?.totals && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" /> Cost Tracking
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Provider Requests', value: parseInt(costs.totals.total_provider_requests || '0').toLocaleString() },
                { label: 'AI Requests', value: parseInt(costs.totals.total_ai_requests || '0').toLocaleString() },
                { label: 'Browser Sessions', value: parseInt(costs.totals.total_browser_sessions || '0').toLocaleString() },
                { label: 'Est. Total Cost', value: `$${parseFloat(costs.totals.total_estimated_cost_usd || '0').toFixed(2)}` },
              ].map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] rounded-lg p-3">
                  <span className="text-xs text-white/40">{item.label}</span>
                  <div className="text-lg font-bold text-white mt-1">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <span className="text-xs text-white/40">Businesses Discovered</span>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {parseInt(costs.totals.total_businesses_discovered || '0').toLocaleString()}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <span className="text-xs text-white/40">Cost per Business</span>
                <div className="text-lg font-bold text-white mt-1">
                  ${parseFloat(costs.totals.cost_per_business || '0').toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
