'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Loader2, TrendingUp, DollarSign, Phone, Mail, Globe, Star, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface Prospect {
  company_id: string; company_name: string;
  industry: string; city: string; country: string;
  overall_readiness: number; budget_score: number;
  urgency_score: number; growth_score: number;
  digital_maturity: number; sales_readiness: number;
  recommended_action: string; recommended_pricing_range: string;
  website: string; email: string; phone: string;
  rating: number; review_count: number;
  computed_at: string;
}

function ScoreGauge({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/40">{label}</span>
        <span className="text-xs font-medium text-white">{Math.round(score)}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2">
        <div className={`h-2 rounded-full bg-gradient-to-r ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function ReadinessBadge({ score }: { score: number }) {
  if (score >= 75) return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">HOT</span>;
  if (score >= 50) return <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">WARM</span>;
  return <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs font-medium">COLD</span>;
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Prospect[] }>('/readiness/top?limit=50')
      .then(d => setProspects(d.data || []))
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Top Prospects</h1>
            <p className="text-white/50 text-sm">AI-scored companies ranked by client readiness</p>
          </div>
        </div>

        {prospects.length === 0 ? (
          <div className="text-center py-20">
            <Target className="h-16 w-16 text-white/10 mx-auto mb-4" />
            <h2 className="text-white text-lg mb-2">No prospects scored yet</h2>
            <p className="text-white/40 text-sm">Run readiness computation from the Intelligence Center</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prospects.map((p, idx) => (
              <motion.div key={p.company_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/[0.07] transition-colors">
                <div className="p-5 cursor-pointer" onClick={() => setExpanded(expanded === p.company_id ? null : p.company_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          p.overall_readiness >= 75 ? 'text-emerald-400' :
                          p.overall_readiness >= 50 ? 'text-yellow-400' : 'text-white/60'
                        }`}>{Math.round(p.overall_readiness)}</div>
                        <div className="text-xs text-white/40">Score</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{p.company_name}</h3>
                          <ReadinessBadge score={p.overall_readiness} />
                        </div>
                        <p className="text-white/40 text-xs mt-0.5">
                          {p.industry || 'Unknown'} — {p.city || ''}, {p.country || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-white text-sm">{p.recommended_pricing_range}</p>
                        <p className="text-white/40 text-xs mt-0.5">Est. Value</p>
                      </div>
                      <ChevronRight className={`h-5 w-5 text-white/30 transition-transform ${expanded === p.company_id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Quick scores */}
                  <div className="grid grid-cols-5 gap-3 mt-4">
                    {[
                      { label: 'Budget', score: p.budget_score, color: 'from-blue-500 to-indigo-600' },
                      { label: 'Urgency', score: p.urgency_score, color: 'from-red-500 to-orange-600' },
                      { label: 'Growth', score: p.growth_score, color: 'from-emerald-500 to-teal-600' },
                      { label: 'Digital', score: p.digital_maturity, color: 'from-purple-500 to-pink-600' },
                      { label: 'Sales', score: p.sales_readiness, color: 'from-cyan-500 to-blue-600' },
                    ].map((s, i) => (
                      <ScoreGauge key={i} label={s.label} score={s.score} color={s.color} />
                    ))}
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded === p.company_id && (
                  <div className="border-t border-white/5 p-5 bg-white/[0.02]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-white font-medium text-sm mb-3">Recommended Action</h4>
                        <p className="text-white/60 text-sm leading-relaxed">{p.recommended_action}</p>

                        <h4 className="text-white font-medium text-sm mt-4 mb-2">Contact Info</h4>
                        <div className="space-y-1">
                          {p.email && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <Mail className="h-3 w-3" /> {p.email}
                            </div>
                          )}
                          {p.phone && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <Phone className="h-3 w-3" /> {p.phone}
                            </div>
                          )}
                          {p.website && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <Globe className="h-3 w-3" /> {p.website}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm mb-3">Company Signals</h4>
                        <div className="space-y-2">
                          {p.rating > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="text-white">{p.rating}</span>
                              <span className="text-white/40">({p.review_count} reviews)</span>
                            </div>
                          )}
                          <div className="text-sm text-white/50">
                            Pricing: {p.recommended_pricing_range}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
