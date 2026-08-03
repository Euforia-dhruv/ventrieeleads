'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Wand2, Palette, Layout, Download, Monitor, AlertCircle } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

const STYLES = [
  { id: 'modern', label: 'Modern', desc: 'Clean, minimal with bold typography' },
  { id: 'luxury', label: 'Luxury', desc: 'Elegant with gold accents' },
  { id: 'corporate', label: 'Corporate', desc: 'Professional, trust-focused' },
  { id: 'creative', label: 'Creative', desc: 'Bold colors and animations' },
  { id: 'minimal', label: 'Minimal', desc: 'Simple, content-first' },
];

const PALETTES = [
  { id: 'ocean', label: 'Ocean', colors: ['#0EA5E9', '#0284C7', '#0369A1', '#F0F9FF'] },
  { id: 'forest', label: 'Forest', colors: ['#22C55E', '#16A34A', '#15803D', '#F0FDF4'] },
  { id: 'sunset', label: 'Sunset', colors: ['#F97316', '#EA580C', '#C2410C', '#FFF7ED'] },
  { id: 'royal', label: 'Royal', colors: ['#8B5CF6', '#7C3AED', '#6D28D9', '#F5F3FF'] },
  { id: 'midnight', label: 'Midnight', colors: ['#1E293B', '#334155', '#475569', '#F8FAFC'] },
];

export default function RedesignPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState('');
  const [style, setStyle] = useState('modern');
  const [palette, setPalette] = useState('ocean');
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<any>(null);

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
      const result = await apiFetch('/redesign', {
        method: 'POST',
        body: JSON.stringify({ company_id: lead?.company_id, style, color_palette: PALETTES.find(p => p.id === palette)?.colors }),
      });
      setPreview(result);
    } catch (e) {
      toast('Failed to generate redesign concept', 'error');
    }
    setGenerating(false);
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
        <h1 className="text-3xl font-bold tracking-tight">Redesign Studio</h1>
        <p className="text-muted-foreground mt-1">Generate AI-powered website redesign concepts</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Select Company</CardTitle></CardHeader>
            <CardContent>
              <Select value={selectedLead} onValueChange={setSelectedLead}>
                <option value="">Choose a lead...</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.company_name}</option>)}
              </Select>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Layout className="h-4 w-4" />Design Style</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)} className={cn('w-full text-left p-3 rounded-lg border transition-all text-sm', style === s.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" />Color Palette</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {PALETTES.map(p => (
                <button key={p.id} onClick={() => setPalette(p.id)} className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-all', palette === p.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
                  <div className="flex gap-1">{p.colors.map((c, i) => <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />)}</div>
                  <span className="text-sm font-medium">{p.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Button onClick={handleGenerate} disabled={!selectedLead || generating} className="w-full">
            {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate Concept
          </Button>
        </div>

        <div className="lg:col-span-2">
          <Card className="glass-card min-h-[600px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4" />Design Preview
                </CardTitle>
                {preview && <Badge variant="success">Generated</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-6">
                  <div className="p-8 rounded-xl border border-border" style={{ background: `linear-gradient(135deg, ${PALETTES.find(p => p.id === palette)?.colors[0]}10, ${PALETTES.find(p => p.id === palette)?.colors[1]}05)` }}>
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl mx-auto" style={{ backgroundColor: PALETTES.find(p => p.id === palette)?.colors[0] }} />
                      <h2 className="text-3xl font-bold">{preview.company?.name || 'Company'}</h2>
                      <p className="text-muted-foreground max-w-lg mx-auto">Modern, professional website redesign concept with {style} styling</p>
                      <div className="flex justify-center gap-3">
                        <Button style={{ backgroundColor: PALETTES.find(p => p.id === palette)?.colors[0] }}>Get Started</Button>
                        <Button variant="outline">Learn More</Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {['Navigation', 'Hero Section', 'Services', 'Testimonials', 'Gallery', 'Footer'].map(section => (
                      <div key={section} className="p-4 rounded-lg bg-secondary/30 border border-border">
                        <div className="w-full h-16 rounded bg-secondary mb-2" />
                        <div className="text-xs font-medium">{section}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1" onClick={() => {
                      const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `redesign-${preview.company?.name || 'concept'}.json`; a.click();
                      URL.revokeObjectURL(url);
                    }}><Download className="h-4 w-4 mr-2" />Export Concept</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                  <Eye className="h-16 w-16 mb-4 opacity-20" />
                  <h3 className="text-lg font-semibold">Design Preview</h3>
                  <p className="text-sm mt-2">Select a company and generate a redesign concept</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
