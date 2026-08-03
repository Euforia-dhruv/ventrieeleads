'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Lightbulb, Target, TrendingUp, MessageSquare, FileText,
  Clock, DollarSign, AlertTriangle, CheckCircle2, Play, ArrowRight, AlertCircle
} from 'lucide-react';
import { cn, formatCurrency, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function PlaybookPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [playbook, setPlaybook] = useState<any>(null);
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

  const loadPlaybook = async () => {
    if (!selectedLead) return;
    setFetching(true);
    try {
      const lead = leads.find((l: any) => l.id === selectedLead);
      const data = await apiFetch(`/companies/${lead?.company_id}/playbook`);
      setPlaybook(data?.data || data);
    } catch (e) {
      toast('Failed to load playbook', 'error');
    }
    setFetching(false);
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
        <h1 className="text-3xl font-bold tracking-tight">Sales Playbook</h1>
        <p className="text-muted-foreground mt-1">AI-powered sales recommendations for every company</p>
      </motion.div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Select Company</label>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <option value="">Choose a lead...</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.company_name} - {l.industry || 'Unknown'}</option>)}
              </Select>
            </div>
            <Button onClick={loadPlaybook} disabled={!selectedLead || fetching}>
              {fetching ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Load Playbook
            </Button>
          </div>
        </CardContent>
      </Card>

      {playbook && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-card glow-blue">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className={cn('h-8 w-8 mx-auto mb-2', playbook.urgency === 'critical' ? 'text-red-500' : playbook.urgency === 'high' ? 'text-orange-500' : 'text-yellow-500')} />
                <div className="text-sm text-muted-foreground">Urgency</div>
                <Badge variant={playbook.urgency === 'critical' ? 'destructive' : playbook.urgency === 'high' ? 'warning' : 'info'} className="mt-2 text-lg">{playbook.urgency}</Badge>
              </CardContent>
            </Card>
            <Card className="glass-card glow-green">
              <CardContent className="pt-6 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-sm text-muted-foreground">Close Probability</div>
                <div className="text-2xl font-bold mt-2">{playbook.close_probability}%</div>
              </CardContent>
            </Card>
            <Card className="glass-card glow-purple">
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <div className="text-sm text-muted-foreground">Price Range</div>
                <div className="text-sm font-medium mt-2">{playbook.pricing_range ? `${formatCurrency(playbook.pricing_range.min)} - ${formatCurrency(playbook.pricing_range.max)}` : 'N/A'}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-sm text-muted-foreground">Score</div>
                <div className="text-2xl font-bold mt-2">{playbook.scores?.overall || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />Recommended Services</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {playbook.services?.map((s: string) => <Badge key={s} variant="outline" className="text-sm">{s}</Badge>)}
              </div>
            </CardContent>
          </Card>

          {playbook.research && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" />Pain Points</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {playbook.research.pain_points?.map((p: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-orange-500" />{p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-500" />Talking Points</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {playbook.research.talking_points?.map((p: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 shrink-0 text-blue-500" />{p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-green-500" />Recommended First Message</CardTitle></CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-secondary/20 border border-border text-sm leading-relaxed">
                {playbook.recommended_first_message}
              </div>
              <Button variant="outline" className="mt-3" onClick={() => { navigator.clipboard.writeText(playbook.recommended_first_message); }}>
                <FileText className="h-4 w-4 mr-2" />Copy Message
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
