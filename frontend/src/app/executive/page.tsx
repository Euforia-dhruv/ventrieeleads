'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Building2, TrendingUp, Eye, FileText, BarChart3, Zap,
  Target, ArrowUpRight, Activity, Shield, Briefcase, Star
} from 'lucide-react';
import { cn, formatCurrency, getScoreColor } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function ExecutiveDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/executive/stats').then(r => r.json()).then(d => setStats(d.data || d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const metrics = [
    { label: 'Pipeline Value', value: formatCurrency(stats?.pipeline_min || 0) + ' - ' + formatCurrency(stats?.pipeline_max || 0), icon: TrendingUp, color: 'text-green-500', glow: 'glow-green' },
    { label: 'Total Leads', value: stats?.total_leads || 0, icon: Users, color: 'text-blue-500', glow: 'glow-blue' },
    { label: 'Hot Leads', value: stats?.hot_leads || 0, icon: Zap, color: 'text-orange-500', glow: 'glow-orange' },
    { label: 'Avg Score', value: stats?.avg_score || 0, icon: BarChart3, color: 'text-purple-500', glow: 'glow-purple' },
    { label: 'Companies', value: stats?.total_companies || 0, icon: Building2, color: 'text-cyan-500', glow: '' },
    { label: 'Research Done', value: stats?.total_research || 0, icon: Eye, color: 'text-indigo-500', glow: '' },
    { label: 'Proposals Sent', value: stats?.sent_proposals || 0, icon: FileText, color: 'text-pink-500', glow: '' },
    { label: 'Won Deals', value: stats?.won_leads || 0, icon: Target, color: 'text-emerald-500', glow: 'glow-green' },
  ];

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text">Executive Dashboard</h1>
            <p className="text-muted-foreground mt-1">Premium analytics and intelligence overview</p>
          </div>
          <Badge variant="outline" className="px-3 py-1">
            <motion.span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
            Live
          </Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={cn('glass-card transition-all', m.glow)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
                <div className={cn('p-2 rounded-lg bg-secondary/50', m.color)}>
                  <m.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{m.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Monitored Companies', value: stats?.monitored_companies || 0, total: stats?.total_companies || 0 },
              { label: 'Change Alerts', value: stats?.change_alerts || 0, total: stats?.total_snapshots || 0 },
              { label: 'Accepted Proposals', value: stats?.accepted_proposals || 0, total: stats?.sent_proposals || 0 },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}/{item.total}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 text-green-500" />Revenue Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-3xl font-bold gradient-text">{formatCurrency(stats?.pipeline_min || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Minimum Pipeline</div>
              <Separator className="my-4" />
              <div className="text-3xl font-bold gradient-text">{formatCurrency(stats?.pipeline_max || 0)}</div>
              <div className="text-sm text-muted-foreground mt-1">Maximum Pipeline</div>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {stats?.total_opportunities || 0} total opportunities
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/search" className="block"><Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer"><CardContent className="py-3 flex items-center gap-3"><Zap className="h-5 w-5 text-orange-500" /><div><div className="text-sm font-medium">New Search</div><div className="text-xs text-muted-foreground">Discover companies</div></div><ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" /></CardContent></Card></Link>
            <Link href="/proposals" className="block"><Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer"><CardContent className="py-3 flex items-center gap-3"><FileText className="h-5 w-5 text-blue-500" /><div><div className="text-sm font-medium">Generate Proposal</div><div className="text-xs text-muted-foreground">AI-powered proposals</div></div><ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" /></CardContent></Card></Link>
            <Link href="/monitoring" className="block"><Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer"><CardContent className="py-3 flex items-center gap-3"><Eye className="h-5 w-5 text-purple-500" /><div><div className="text-sm font-medium">Monitoring Center</div><div className="text-xs text-muted-foreground">Track changes</div></div><ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" /></CardContent></Card></Link>
            <Link href="/reports" className="block"><Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer"><CardContent className="py-3 flex items-center gap-3"><BarChart3 className="h-5 w-5 text-green-500" /><div><div className="text-sm font-medium">Generate Report</div><div className="text-xs text-muted-foreground">Custom analytics</div></div><ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" /></CardContent></Card></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
