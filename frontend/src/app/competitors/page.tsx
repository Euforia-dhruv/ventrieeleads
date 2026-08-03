'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Eye, BarChart3, TrendingUp, Shield, Zap, AlertCircle } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function CompetitorsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetch('/api/leads?limit=100').then(r => r.json()).then(d => {
      setLeads(d.data || []);
      setLoading(false);
    }).catch(() => {
      setLoadingError('Failed to load companies');
      setLoading(false);
    });
  }, []);

  const loadCompetitors = async () => {
    if (!selectedLead) return;
    setFetching(true);
    try {
      const lead = leads.find((l: any) => l.id === selectedLead);
      const data = await apiFetch(`/companies/${lead?.company_id}/competitors`);
      setCompetitors(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      setCompetitors([]);
    }
    setFetching(false);
  };

  const triggerAnalysis = async () => {
    if (!selectedLead) return;
    try {
      const lead = leads.find((l: any) => l.id === selectedLead);
      await apiFetch(`/companies/${lead?.company_id}/competitors`, { method: 'POST' });
      toast('Competitor analysis started', 'success');
    } catch (e) {
      toast('Failed to start analysis', 'error');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (loadingError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-lg font-semibold">{loadingError}</h3>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Competitor Insights</h1>
        <p className="text-muted-foreground mt-1">Analyze and compare competitors for any company</p>
      </motion.div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Select Company</label>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <option value="">Choose a lead...</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.company_name}</option>)}
              </Select>
            </div>
            <Button onClick={loadCompetitors} disabled={!selectedLead || fetching}>
              {fetching ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Load Competitors
            </Button>
            <Button variant="outline" onClick={triggerAnalysis} disabled={!selectedLead}>
              <Zap className="h-4 w-4 mr-2" />Run AI Analysis
            </Button>
          </div>
        </CardContent>
      </Card>

      {competitors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competitors.map((comp: any) => (
            <motion.div key={comp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{comp.competitor_name}</h3>
                      <div className="text-sm text-muted-foreground">{comp.competitor_website}</div>
                    </div>
                    <Badge variant="outline">{comp.market_position || 'Unknown'}</Badge>
                  </div>

                  {comp.overall_comparison && (
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{comp.overall_comparison}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {comp.strengths_vs_competitor?.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-green-500 mb-2 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Their Strengths</div>
                        <ul className="space-y-1">
                          {comp.strengths_vs_competitor.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {comp.weaknesses_vs_competitor?.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-500 mb-2 flex items-center gap-1"><Shield className="h-3 w-3" />Their Weaknesses</div>
                        <ul className="space-y-1">
                          {comp.weaknesses_vs_competitor.map((w: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {comp.opportunity_gaps?.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <div className="text-xs font-medium text-blue-500 mb-1">Opportunity Gaps</div>
                      {comp.opportunity_gaps.map((g: string, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground">• {g}</div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : selectedLead && !fetching ? (
        <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
          <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Competitor Analysis Found</h3>
          <p className="text-sm text-muted-foreground mt-2">Run an AI analysis to discover and compare competitors</p>
          <Button onClick={triggerAnalysis} className="mt-4"><Zap className="h-4 w-4 mr-2" />Run Analysis</Button>
        </CardContent></Card>
      ) : (
        <Card className="glass-card"><CardContent className="pt-6 text-center py-12 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Select a Company</h3>
          <p className="text-sm mt-2">Choose a company above to view competitor analysis</p>
        </CardContent></Card>
      )}
    </div>
  );
}
