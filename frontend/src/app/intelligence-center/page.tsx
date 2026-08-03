'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Rocket, Users, Globe, Target, Lightbulb,
  BarChart3, TrendingUp, DollarSign, Cpu, Loader2,
  ChevronRight, Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface ModuleCard {
  id: string; title: string; subtitle: string;
  icon: any; color: string; href: string;
  data?: any; loading: boolean;
}

const MODULES = [
  { id: 'discovery', title: 'Discovery Intelligence', subtitle: 'Coverage & velocity analytics', icon: Rocket, color: 'from-blue-500 to-indigo-600', href: '#discovery' },
  { id: 'providers', title: 'Provider AI', subtitle: 'Provider performance ranking', icon: Cpu, color: 'from-purple-500 to-pink-600', href: '#providers' },
  { id: 'market', title: 'Market Intelligence', subtitle: 'Cities, industries, growth', icon: Globe, color: 'from-emerald-500 to-teal-600', href: '#market' },
  { id: 'opportunities', title: 'Opportunity Intelligence', subtitle: 'Company scoring & ranking', icon: Target, color: 'from-orange-500 to-red-600', href: '#opportunities' },
  { id: 'pipeline', title: 'Pipeline Optimisation', subtitle: 'Queue health & efficiency', icon: BarChart3, color: 'from-cyan-500 to-blue-600', href: '#pipeline' },
  { id: 'economics', title: 'Discovery Economics', subtitle: 'Cost & efficiency metrics', icon: DollarSign, color: 'from-yellow-500 to-orange-600', href: '#economics' },
];

export default function IntelligenceCenterPage() {
  const [modules, setModules] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const endpoints: Record<string, string> = {
      discovery: '/intelligence-center/discovery',
      providers: '/intelligence-center/providers',
      market: '/intelligence-center/market',
      opportunities: '/intelligence-center/opportunities',
      pipeline: '/intelligence-center/pipeline',
      economics: '/intelligence-center/economics',
    };

    Promise.all(
      Object.entries(endpoints).map(([key, url]) =>
        apiFetch<any>(url).then(d => [key, d.data]).catch(() => [key, null])
      )
    ).then(results => {
      const map: Record<string, any> = {};
      results.forEach(([k, v]: any) => { map[k] = v; });
      setModules(map);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  const discovery = modules.discovery || {};
  const scores = discovery.scores || {};
  const summary = discovery.summary || {};
  const pipeline = modules.pipeline?.metrics || {};
  const economics = modules.economics?.totals || {};
  const econCosts = modules.economics?.costs || {};

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Intelligence Center</h1>
            <p className="text-white/50 text-sm">10-module self-improving analytics platform</p>
          </div>
        </div>

        {/* Top KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Companies', value: summary.total_companies?.toLocaleString() || '0', icon: Users, color: 'from-blue-500 to-indigo-600' },
            { label: 'Coverage', value: `${scores.coverage_score || 0}%`, icon: Globe, color: 'from-emerald-500 to-teal-600' },
            { label: 'Velocity', value: `${scores.discovery_velocity || 0}/d`, icon: Rocket, color: 'from-purple-500 to-pink-600' },
            { label: 'Growth', value: `${scores.growth_rate || 0}%`, icon: TrendingUp, color: 'from-orange-500 to-red-600' },
            { label: 'Success', value: `${Math.round((pipeline.success_rate || 0) * 100)}%`, icon: Zap, color: 'from-cyan-500 to-blue-600' },
            { label: 'Cost', value: `$${econCosts.total_cost_usd?.toFixed(2) || '0'}`, icon: DollarSign, color: 'from-yellow-500 to-orange-600' },
          ].map((item, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                  <item.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs text-white/50">{item.label}</span>
              </div>
              <div className="text-xl font-bold text-white">{item.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {MODULES.map((mod, idx) => (
            <motion.div key={mod.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-colors cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center`}>
                    <mod.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{mod.title}</h3>
                    <p className="text-white/40 text-xs">{mod.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 mt-1" />
              </div>
              <ModuleMiniData moduleId={mod.id} data={modules[mod.id]} />
            </motion.div>
          ))}
        </div>

        {/* Recommendations */}
        {discovery.recommendations && discovery.recommendations.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              AI Recommendations
            </h2>
            <div className="space-y-3">
              {discovery.recommendations.slice(0, 5).map((rec: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    rec.priority >= 9 ? 'bg-red-500' : rec.priority >= 7 ? 'bg-orange-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="text-white text-sm font-medium">{rec.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ModuleMiniData({ moduleId, data }: { moduleId: string; data: any }) {
  if (!data) return <p className="text-white/30 text-xs">No data available</p>;

  switch (moduleId) {
    case 'discovery':
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-white/40">Industries:</span> <span className="text-white">{data.scores?.industry_coverage || 0}%</span></div>
          <div><span className="text-white/40">Confidence:</span> <span className="text-white">{data.scores?.discovery_confidence || 0}%</span></div>
          <div><span className="text-white/40">This week:</span> <span className="text-white">{data.trends?.new_this_week || 0}</span></div>
          <div><span className="text-white/40">Density:</span> <span className="text-white">{data.scores?.business_density || 0}</span></div>
        </div>
      );
    case 'providers':
      const top = data.providers?.[0];
      return top ? (
        <div className="text-xs">
          <p className="text-white">Top: <span className="text-emerald-400">{top.provider}</span></p>
          <p className="text-white/40 mt-1">Score: {top.scores?.composite_score || 0} | Health: {Math.round((top.scores?.health_score || 0) * 100)}%</p>
        </div>
      ) : <p className="text-white/30 text-xs">No provider data</p>;
    case 'market':
      const topCity = data.fastest_growing_cities?.[0];
      return topCity ? (
        <div className="text-xs">
          <p className="text-white">Fastest: <span className="text-emerald-400">{topCity.city}</span></p>
          <p className="text-white/40 mt-1">{topCity.total_companies} companies, {topCity.growth_rate}% growth</p>
        </div>
      ) : <p className="text-white/30 text-xs">No market data</p>;
    case 'opportunities':
      return data.summary ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-emerald-400">{data.summary.high_value}</span> <span className="text-white/40">high</span></div>
          <div><span className="text-orange-400">{data.summary.medium_value}</span> <span className="text-white/40">mid</span></div>
          <div><span className="text-red-400">{data.summary.low_value}</span> <span className="text-white/40">low</span></div>
        </div>
      ) : <p className="text-white/30 text-xs">No data</p>;
    case 'pipeline':
      return data.queue ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-white/40">Queued:</span> <span className="text-white">{data.queue.queued}</span></div>
          <div><span className="text-white/40">Running:</span> <span className="text-white">{data.queue.running}</span></div>
          <div><span className="text-white/40">Done:</span> <span className="text-emerald-400">{data.queue.completed}</span></div>
          <div><span className="text-white/40">Failed:</span> <span className="text-red-400">{data.queue.failed}</span></div>
        </div>
      ) : <p className="text-white/30 text-xs">No pipeline data</p>;
    case 'economics':
      return data.totals ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-white/40">Leads:</span> <span className="text-white">{data.totals.leads}</span></div>
          <div><span className="text-white/40">Opps:</span> <span className="text-white">{data.totals.opportunities}</span></div>
          <div><span className="text-white/40">Cost/company:</span> <span className="text-white">${data.costs?.cost_per_company || 0}</span></div>
          <div><span className="text-white/40">Audits:</span> <span className="text-white">{data.totals.audits}</span></div>
        </div>
      ) : <p className="text-white/30 text-xs">No economics data</p>;
    default:
      return <p className="text-white/30 text-xs">—</p>;
  }
}
