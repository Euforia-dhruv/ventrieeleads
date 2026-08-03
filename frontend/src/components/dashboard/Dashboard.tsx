'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Briefcase, TrendingUp, Clock, CheckCircle2, AlertTriangle,
  Search, Zap, BarChart3, Target, Mail, Phone, Calendar, ArrowUpRight
} from 'lucide-react';
import { cn, formatDate, getScoreColor } from '@/lib/utils';
import type { DashboardStats } from '@/types/leads';
import Link from 'next/link';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then(r => r.json()),
      fetch('/api/leads?limit=5&sortBy=created_at&sortOrder=DESC').then(r => r.json()),
      fetch('/api/campaigns').then(r => r.json()),
    ]).then(([statsData, leadsData, campData]) => {
      setStats(statsData.data);
      setRecentLeads(leadsData.data || []);
      setCampaigns(campData.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Leads', value: stats?.totalLeads ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: "Today's Searches", value: stats?.todayLeads ?? 0, icon: Search, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Jobs Running', value: stats?.jobsRunning ?? 0, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Avg Score', value: Math.round(stats?.avgLeadScore ?? 0), icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Hot Leads', value: stats?.hotLeads ?? 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Cold Leads', value: stats?.coldLeads ?? 0, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10' },
    { label: 'Qualified', value: stats?.qualifiedLeads ?? 0, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Jobs Completed', value: stats?.jobsCompleted ?? 0, icon: Briefcase, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-500',
    'Qualified': 'bg-green-500/10 text-green-500',
    'Researching': 'bg-yellow-500/10 text-yellow-500',
    'Contacted': 'bg-purple-500/10 text-purple-500',
    'Replied': 'bg-indigo-500/10 text-indigo-500',
    'Meeting': 'bg-pink-500/10 text-pink-500',
    'Proposal': 'bg-orange-500/10 text-orange-500',
    'Won': 'bg-emerald-500/10 text-emerald-500',
    'Lost': 'bg-gray-500/10 text-gray-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">AI Lead Generation Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            <motion.span
              className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            Live
          </Badge>
          <Link href="/search">
            <Button size="sm"><Search className="h-4 w-4 mr-2" />New Search</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <div className={cn('p-2 rounded-lg', card.bg)}>
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Status Pipeline</CardTitle>
              <Link href="/leads"><Button variant="ghost" size="sm">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(stats?.byStatus ?? {}).map(([status, count]) => (
                  <div key={status} className="text-center p-3 rounded-lg bg-secondary/50">
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground mt-1">{status}</div>
                  </div>
                ))}
                {Object.keys(stats?.byStatus ?? {}).length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-5">No leads yet. Run a search to get started.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Leads</CardTitle>
              <Link href="/leads"><Button variant="ghost" size="sm">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-medium">
                        {lead.company_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{lead.company_name}</div>
                        <div className="text-xs text-muted-foreground">{lead.industry || 'Unknown'} {lead.city ? `• ${lead.city}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn('text-xs', statusColors[lead.status] || '')}>{lead.status}</Badge>
                      <span className={cn('text-sm font-semibold', getScoreColor(lead.score || 0))}>{lead.score || 0}</span>
                    </div>
                  </div>
                ))}
                {recentLeads.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No leads yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Industry Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats?.byIndustry ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([industry, count]) => (
                  <div key={industry} className="flex items-center justify-between">
                    <span className="text-sm">{industry}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / (stats?.totalLeads || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(stats?.byIndustry ?? {}).length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Cities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats?.byCity ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between">
                    <span className="text-sm">{city}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
                {Object.keys(stats?.byCity ?? {}).length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Campaigns</CardTitle>
              <Link href="/campaigns"><Button variant="ghost" size="sm">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Button></Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaigns.slice(0, 3).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.lead_count || 0} leads</div>
                    </div>
                    <Badge variant={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No campaigns yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
