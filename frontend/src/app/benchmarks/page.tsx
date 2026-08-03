'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Globe, Factory, TrendingUp, Star, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface Benchmark {
  entity: string; country_code?: string;
  total_companies: number;
  avg_website_score: number; avg_seo_score?: number;
  avg_design_score?: number; avg_performance_score?: number;
  avg_rating: number; avg_review_count?: number;
}

const FLAG: Record<string, string> = {
  AE: '🇦🇪', GB: '🇬🇧', US: '🇺🇸', SG: '🇸🇬', SA: '🇸🇦', IN: '🇮🇳',
  DE: '🇩🇪', CA: '🇨🇦', AU: '🇦🇺', JP: '🇯🇵', BR: '🇧🇷', FR: '🇫🇷',
};

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-white/5 rounded-full h-2">
      <div className={`h-2 rounded-full bg-gradient-to-r ${color}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'text-yellow-500 fill-yellow-500' : 'text-white/20'}`} />
      ))}
      <span className="text-white/50 text-xs ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function BenchmarksPage() {
  const [countryBenchmarks, setCountryBenchmarks] = useState<Benchmark[]>([]);
  const [industryBenchmarks, setIndustryBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'countries' | 'industries'>('countries');

  useEffect(() => {
    apiFetch<{ data: { country_benchmarks: Benchmark[]; industry_benchmarks: Benchmark[] } }>('/intelligence-center/benchmarks')
      .then(d => {
        setCountryBenchmarks(d.data?.country_benchmarks || []);
        setIndustryBenchmarks(d.data?.industry_benchmarks || []);
      })
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

  const data = tab === 'countries' ? countryBenchmarks : industryBenchmarks;
  const avgAll = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.avg_website_score, 0) / data.length * 10) / 10
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Global Benchmarks</h1>
            <p className="text-white/50 text-sm">Compare website quality and ratings across markets</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {([
            { key: 'countries', label: 'Countries', icon: Globe },
            { key: 'industries', label: 'Industries', icon: Factory },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              }`}>
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
          <div className="ml-auto text-white/40 text-sm">
            Avg Score: <span className="text-white font-medium">{avgAll}</span>/100
          </div>
        </div>

        {/* Benchmark Cards */}
        <div className="space-y-4">
          {data.map((item, idx) => (
            <motion.div key={`${item.entity}-${idx}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {tab === 'countries' && item.country_code && (
                    <span className="text-2xl">{FLAG[item.country_code] || '🌍'}</span>
                  )}
                  {tab === 'industries' && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                      <Factory className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-semibold">{item.entity}</h3>
                    <p className="text-white/40 text-xs">{item.total_companies} companies</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    item.avg_website_score >= 70 ? 'text-emerald-400' :
                    item.avg_website_score >= 40 ? 'text-yellow-400' : 'text-orange-400'
                  }`}>{item.avg_website_score}</div>
                  <div className="text-white/40 text-xs">web score</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-white/40 text-xs mb-1">Website</p>
                  <ScoreBar value={item.avg_website_score} color="from-blue-500 to-indigo-600" />
                  <p className="text-white text-xs mt-1">{item.avg_website_score}/100</p>
                </div>
                {item.avg_seo_score !== undefined && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">SEO</p>
                    <ScoreBar value={item.avg_seo_score} color="from-emerald-500 to-teal-600" />
                    <p className="text-white text-xs mt-1">{item.avg_seo_score}/100</p>
                  </div>
                )}
                {item.avg_design_score !== undefined && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Design</p>
                    <ScoreBar value={item.avg_design_score} color="from-purple-500 to-pink-600" />
                    <p className="text-white text-xs mt-1">{item.avg_design_score}/100</p>
                  </div>
                )}
                {item.avg_performance_score !== undefined && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Performance</p>
                    <ScoreBar value={item.avg_performance_score} color="from-orange-500 to-red-600" />
                    <p className="text-white text-xs mt-1">{item.avg_performance_score}/100</p>
                  </div>
                )}
                <div>
                  <p className="text-white/40 text-xs mb-1">Rating</p>
                  <Stars rating={item.avg_rating} />
                </div>
                {item.avg_review_count !== undefined && item.avg_review_count > 0 && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Reviews</p>
                    <p className="text-white text-sm">{Math.round(item.avg_review_count)}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
