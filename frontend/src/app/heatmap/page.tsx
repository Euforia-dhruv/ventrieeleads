'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Map, Globe, Building2, TrendingUp, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface CountryData {
  country_code: string; country_name: string;
  latitude: number; longitude: number;
  total_cities: number; total_companies: number;
  coverage_jobs: number; lead_density: number;
  avg_website_score: number; coverage_pct: number;
  avg_project_value: number;
}

const FLAG: Record<string, string> = {
  AE: '🇦🇪', GB: '🇬🇧', US: '🇺🇸', SG: '🇸🇬', SA: '🇸🇦', IN: '🇮🇳',
  DE: '🇩🇪', CA: '🇨🇦', AU: '🇦🇺', JP: '🇯🇵', BR: '🇧🇷', FR: '🇫🇷',
  ZA: '🇿🇦', QA: '🇶🇦', KW: '🇰🇼', OM: '🇴🇲', BH: '🇧🇭', KE: '🇰🇪',
  NG: '🇳🇬', EG: '🇪🇬', TR: '🇹🇷', TH: '🇹🇭', MY: '🇲🇾', PH: '🇵🇭',
};

function getIntensityColor(score: number): string {
  if (score >= 70) return 'from-green-500 to-emerald-600';
  if (score >= 40) return 'from-yellow-500 to-orange-600';
  if (score > 0) return 'from-orange-500 to-red-600';
  return 'from-gray-600 to-gray-700';
}

function getIntensityBg(score: number): string {
  if (score >= 70) return 'bg-green-500/10 border-green-500/20';
  if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score > 0) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-white/5 border-white/10';
}

export default function HeatmapPage() {
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'companies' | 'density' | 'coverage' | 'score'>('companies');

  useEffect(() => {
    apiFetch<{ data: { countries: CountryData[] } }>('/intelligence-center/heatmap')
      .then(d => setCountries(d.data?.countries || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...countries].sort((a, b) => {
    switch (sortBy) {
      case 'density': return b.lead_density - a.lead_density;
      case 'coverage': return b.coverage_pct - a.coverage_pct;
      case 'score': return b.avg_website_score - a.avg_website_score;
      default: return b.total_companies - a.total_companies;
    }
  });

  const totalCompanies = countries.reduce((s, c) => s + c.total_companies, 0);
  const totalCities = countries.reduce((s, c) => s + c.total_cities, 0);
  const avgScore = countries.length > 0
    ? Math.round(countries.reduce((s, c) => s + c.avg_website_score, 0) / countries.length * 10) / 10
    : 0;

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
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
            <Map className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Global Heatmap</h1>
            <p className="text-white/50 text-sm">Discovery activity and market intelligence by country</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Companies', value: totalCompanies.toLocaleString(), icon: Building2, color: 'from-blue-500 to-indigo-600' },
            { label: 'Cities Tracked', value: totalCities.toLocaleString(), icon: Globe, color: 'from-emerald-500 to-teal-600' },
            { label: 'Avg Website Score', value: `${avgScore}/100`, icon: TrendingUp, color: 'from-purple-500 to-pink-600' },
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
              <div className="text-xl font-bold text-white">{item.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-white/40 text-sm">Sort by:</span>
          {(['companies', 'density', 'coverage', 'score'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Country Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((country, idx) => (
            <motion.div key={country.country_code}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.03 }}
              className={`rounded-xl p-5 border transition-all hover:scale-[1.02] ${getIntensityBg(country.avg_website_score)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{FLAG[country.country_code] || '🌍'}</span>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{country.country_name}</h3>
                    <p className="text-white/40 text-xs">{country.country_code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-lg">{country.total_companies}</div>
                  <div className="text-white/40 text-xs">companies</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Cities</span>
                  <span className="text-white">{country.total_cities}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Density</span>
                  <span className="text-white">{country.lead_density}/city</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Coverage</span>
                  <span className="text-white">{country.coverage_pct}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Web Score</span>
                  <span className={`font-medium ${
                    country.avg_website_score >= 70 ? 'text-emerald-400' :
                    country.avg_website_score >= 40 ? 'text-yellow-400' : 'text-orange-400'
                  }`}>{country.avg_website_score}/100</span>
                </div>

                {/* Coverage bar */}
                <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                  <div className={`h-1.5 rounded-full bg-gradient-to-r ${getIntensityColor(country.avg_website_score)}`}
                    style={{ width: `${Math.min(country.coverage_pct, 100)}%` }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
