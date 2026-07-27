'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Mail,
  Briefcase,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';

interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  todayLeads: number;
  emailsGenerated: number;
  outreachQueue: number;
  meetingsScheduled: number;
  revenuePipeline: number;
  hotLeads: number;
  coldLeads: number;
  avgLeadScore: number;
  byIndustry: Record<string, number>;
  byCity: Record<string, number>;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Today\'s Leads', value: stats?.todayLeads ?? 0, icon: Clock, color: 'text-blue-500' },
    { label: 'Qualified Leads', value: stats?.qualifiedLeads ?? 0, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Emails Generated', value: stats?.emailsGenerated ?? 0, icon: Mail, color: 'text-purple-500' },
    { label: 'Outreach Queue', value: stats?.outreachQueue ?? 0, icon: Briefcase, color: 'text-orange-500' },
    { label: 'Meetings', value: stats?.meetingsScheduled ?? 0, icon: Users, color: 'text-pink-500' },
    { label: 'Revenue Pipeline', value: stats?.revenuePipeline ?? 0, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Hot Leads', value: stats?.hotLeads ?? 0, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Cold Leads', value: stats?.coldLeads ?? 0, icon: Clock, color: 'text-gray-500' }
  ];

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
        <Badge variant="outline" className="px-3 py-1">
          <motion.span
            className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          Live
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Industry Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.byIndustry ?? {}).map(([industry, count]) => (
                <div key={industry} className="flex items-center justify-between">
                  <span className="text-sm">{industry}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(count / (stats?.totalLeads ?? 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{count}</span>
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
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.byCity ?? {}).slice(0, 10).map(([city, count]) => (
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
      </div>
    </div>
  );
}
