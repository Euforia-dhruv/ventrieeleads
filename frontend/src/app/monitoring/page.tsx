'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Eye, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn, formatDate, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function MonitoringPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/leads?limit=100').then(r => r.json()).then(d => d.data || []).catch(() => []),
    ]).then(([leads]) => {
      setCompanies(leads);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadHistory = async (companyId: string) => {
    try {
      const data = await apiFetch(`/companies/${companyId}/monitoring/history`);
      setSnapshots(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setSnapshots([]);
    }
  };

  const triggerCheck = async (companyId: string) => {
    await apiFetch(`/companies/${companyId}/monitoring/check`, { method: 'POST' });
    toast('Monitoring check triggered', 'info');
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoring Center</h1>
            <p className="text-muted-foreground mt-1">Track company changes and receive alerts</p>
          </div>
          <Badge variant="outline" className="px-3 py-1">
            <motion.span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
            Active
          </Badge>
        </div>
      </motion.div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Monitored Companies</TabsTrigger>
          <TabsTrigger value="changes">Recent Changes</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card className="glass-card">
            <CardContent className="pt-6">
              {companies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Companies to Monitor</h3>
                  <p className="text-sm mt-2">Add companies and start monitoring their websites</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {companies.slice(0, 20).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold">{c.company_name?.charAt(0)}</div>
                        <div>
                          <div className="font-medium">{c.company_name}</div>
                          <div className="text-xs text-muted-foreground">{c.industry || 'Unknown'} • {c.city || 'UAE'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => loadHistory(c.company_id)}><Clock className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => triggerCheck(c.company_id)}><RefreshCw className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card className="glass-card">
            <CardContent className="pt-6">
              {snapshots.length > 0 ? (
                <div className="space-y-3">
                  {snapshots.map((s: any) => (
                    <div key={s.id} className="p-4 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">Change Detected</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                      </div>
                      {s.changes_detected?.map((c: any, i: number) => (
                        <div key={i} className="text-sm ml-4">
                          {c.type === 'score_change' && <span>Score changed: {c.field} from {c.old} to {c.new}</span>}
                          {c.type === 'technology_change' && <span>Technology: {c.added?.join(', ')} added, {c.removed?.join(', ')} removed</span>}
                          {c.type === 'review_change' && <span>Reviews: {c.old} → {c.new} ({c.delta > 0 ? '+' : ''}{c.delta})</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Changes Detected</h3>
                  <p className="text-sm mt-2">Select a company to view monitoring history</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="glass-card">
            <CardContent className="pt-6 text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Alert Center</h3>
              <p className="text-sm mt-2">Alerts for score changes, technology updates, and more</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
