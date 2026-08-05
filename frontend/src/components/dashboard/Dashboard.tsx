'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Users, Zap, BarChart3, ArrowUpRight, Clock, Building2, Star, TrendingUp } from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  totalLeads: number;
  todayLeads: number;
  jobsRunning: number;
  avgLeadScore: number;
  hotLeads: number;
  coldLeads: number;
  qualifiedLeads: number;
  jobsCompleted: number;
  byStatus: Record<string, number>;
  byIndustry: Record<string, number>;
  byCity: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then(r => r.json()),
      fetch('/api/leads?limit=5&sortBy=created_at&sortOrder=DESC').then(r => r.json()),
    ]).then(([statsData, leadsData]) => {
      setStats(statsData.data);
      setRecentLeads(leadsData.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: "Today's Finds", value: stats?.todayLeads ?? 0, icon: Search, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Running Jobs', value: stats?.jobsRunning ?? 0, icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Avg Score', value: Math.round(stats?.avgLeadScore ?? 0), icon: BarChart3, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">AI-powered lead generation overview</p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg text-[13px] font-medium transition-all"
        >
          <Search className="w-4 h-4" />
          New Search
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <div key={card.label} className="glass-card rounded-xl p-4 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-[hsl(215,16%,50%)] font-medium">{card.label}</span>
              <div className={cn("p-1.5 rounded-lg", card.bg)}>
                <card.icon className={cn("w-4 h-4", card.color)} />
              </div>
            </div>
            <p className="text-[24px] font-bold text-white">{loading ? '—' : card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent leads */}
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
            <h2 className="text-[13px] font-semibold text-white">Recent Leads</h2>
            <Link href="/leads" className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/[0.04] rounded w-1/3" />
                      <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : recentLeads.length > 0 ? (
              recentLeads.map((lead: any) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[12px] font-semibold text-white/30">
                      {lead.company_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{lead.company_name}</p>
                      <p className="text-[11px] text-[hsl(215,16%,45%)]">
                        {lead.industry || 'Unknown'}{lead.city ? ` · ${lead.city}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[13px] font-semibold", getScoreColor(lead.score || 0))}>{lead.score || 0}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[hsl(215,16%,30%)]" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[hsl(215,16%,40%)]">No leads yet. Run a search to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-[13px] font-semibold text-white mb-3">Pipeline</h2>
            <div className="space-y-2">
              {stats?.byStatus ? Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-[12px] text-[hsl(215,20%,55%)]">{status}</span>
                  <span className="text-[12px] font-medium text-white">{count}</span>
                </div>
              )) : (
                <p className="text-[12px] text-[hsl(215,16%,35%)]">No pipeline data yet</p>
              )}
            </div>
          </div>

          {/* Top industries */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-[13px] font-semibold text-white mb-3">Top Industries</h2>
            <div className="space-y-2">
              {stats?.byIndustry ? Object.entries(stats.byIndustry)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([industry, count]) => (
                <div key={industry} className="flex items-center justify-between">
                  <span className="text-[12px] text-[hsl(215,20%,55%)] truncate">{industry}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / (stats?.totalLeads || 1)) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-white w-5 text-right">{count}</span>
                  </div>
                </div>
              )) : (
                <p className="text-[12px] text-[hsl(215,16%,35%)]">No data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
