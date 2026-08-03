'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Wand2, Eye, Mail, MessageSquare, Building2, AlertCircle } from 'lucide-react';
import { cn, formatDate, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export default function ProposalsPage() {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [tone, setTone] = useState('professional');
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/proposals').then(r => r.json()).then(d => Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []).catch(() => []),
      fetch('/api/leads?limit=100').then(r => r.json()).then(d => d.data || []).catch(() => []),
    ]).then(([p, l]) => {
      setProposals(Array.isArray(p) ? p : []);
      setLeads(Array.isArray(l) ? l : []);
      setLoading(false);
    }).catch(() => {
      setLoadingError('Failed to load proposals');
      setLoading(false);
    });
  }, []);

  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    try {
      const lead = leads.find((l: any) => l.id === selectedLead);
      await apiFetch('/proposals', {
        method: 'POST',
        body: JSON.stringify({ company_id: lead?.company_id, template: 'standard', branding: { tone } }),
      });
      toast('Proposal generation started!', 'success');
    } catch (e) {
      toast('Failed to generate proposal', 'error');
    }
    setGenerating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

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
        <h1 className="text-3xl font-bold tracking-tight">AI Proposal Generator</h1>
        <p className="text-muted-foreground mt-1">Generate beautiful client proposals with AI</p>
      </motion.div>

      <Card className="glass-card glow-blue">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />Generate New Proposal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Company</label>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <option value="">Choose a lead...</option>
                {leads.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.company_name} - {l.industry || 'Unknown'}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tone</label>
              <Select value={tone} onValueChange={setTone}>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="luxury">Luxury</option>
                <option value="corporate">Corporate</option>
                <option value="startup">Startup</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={!selectedLead || generating} className="w-full">
                {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Generate Proposal
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg">Recent Proposals</CardTitle></CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Proposals Yet</h3>
              <p className="text-sm mt-2">Generate your first proposal using the form above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.company_name || 'Unknown'} • {formatDate(p.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === 'accepted' ? 'success' : p.status === 'sent' ? 'info' : p.status === 'generating' ? 'warning' : 'secondary'}>{p.status}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => window.open(`/proposals/${p.id}`, '_blank')}><Eye className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
