'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Wand2, Copy, Mail, MessageCircle, Link2, AtSign, AlertCircle } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

const COPY_TYPES = [
  { id: 'cold_email', label: 'Cold Email', icon: Mail },
  { id: 'linkedin', label: 'LinkedIn Message', icon: Link2 },
  { id: 'whatsapp', label: 'WhatsApp Message', icon: MessageCircle },
  { id: 'instagram', label: 'Instagram DM', icon: AtSign },
  { id: 'proposal_intro', label: 'Proposal Introduction', icon: MessageSquare },
  { id: 'followup', label: 'Follow-up Message', icon: MessageSquare },
  { id: 'meeting_request', label: 'Meeting Request', icon: MessageSquare },
  { id: 'audit_summary', label: 'Website Audit Summary', icon: MessageSquare },
];

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'startup', label: 'Startup' },
];

export default function CopywriterPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedType, setSelectedType] = useState('cold_email');
  const [tone, setTone] = useState('professional');
  const [context, setContext] = useState('');
  const [generated, setGenerated] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/leads?limit=100').then(r => r.json()).then(d => {
      setLeads(d.data || []);
      setLoading(false);
    }).catch(() => {
      setLoadingError('Failed to load companies');
      setLoading(false);
    });
  }, []);

  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    try {
      const lead = leads.find((l: any) => l.id === selectedLead);
      const result = await apiFetch('/copywriter', {
        method: 'POST',
        body: JSON.stringify({ company_id: lead?.company_id, type: selectedType, tone, context }),
      });
      setGenerated(result);
    } catch (e) {
      toast('Failed to generate copy', 'error');
    }
    setGenerating(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        <h1 className="text-3xl font-bold tracking-tight">AI Copywriter</h1>
        <p className="text-muted-foreground mt-1">Generate personalised outreach messages powered by research</p>
      </motion.div>

      <Card className="glass-card glow-purple">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-purple-500" />Generate Copy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Company</label>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <option value="">Choose a lead...</option>
                {leads.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.company_name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tone</label>
              <Select value={tone} onValueChange={setTone}>
                {TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Message Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COPY_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setSelectedType(ct.id)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border text-sm transition-all',
                    selectedType === ct.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/30'
                  )}
                >
                  <ct.icon className="h-4 w-4" />
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Additional Context (optional)</label>
            <Textarea value={context} onChange={e => setContext(e.target.value)} placeholder="Any specific context to include in the message..." className="glass-input" />
          </div>
          <Button onClick={handleGenerate} disabled={!selectedLead || generating} className="w-full md:w-auto">
            {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate {COPY_TYPES.find(ct => ct.id === selectedType)?.label}
          </Button>
        </CardContent>
      </Card>

      {generated && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card glow-green">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Generated Copy</CardTitle>
                <Badge variant="success">Ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generated.company && (
                <div className="p-3 rounded-lg bg-secondary/30 text-sm">
                  <span className="text-muted-foreground">Company:</span> <span className="font-medium">{generated.company.name}</span> • {generated.company.industry} • {generated.company.city}
                </div>
              )}
              <div className="p-4 rounded-lg bg-secondary/20 border border-border">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {generated.message || `Copy generation queued for ${generated.company?.name}. The AI will generate ${selectedType.replace('_', ' ')} content with ${tone} tone using research data.`}
                </p>
              </div>
              <Button variant="outline" onClick={() => copyToClipboard(generated.message || '')}>
                <Copy className="h-4 w-4 mr-2" />Copy to Clipboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
