'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, Wand2, Download, FileText, Calendar, AlertCircle } from 'lucide-react';
import { cn, formatDate, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

const REPORT_TYPES = [
  { id: 'summary', label: 'Executive Summary' },
  { id: 'pipeline', label: 'Pipeline Report' },
  { id: 'research', label: 'Research Report' },
  { id: 'monitoring', label: 'Monitoring Report' },
  { id: 'performance', label: 'Performance Report' },
];

export default function ReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('summary');

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      setReports(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => {
      setLoadingError('Failed to load reports');
      setLoading(false);
    });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ report_type: reportType }),
      });
      toast('Report generation started!', 'success');
    } catch (e) {
      toast('Failed to generate report', 'error');
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
        <h1 className="text-3xl font-bold tracking-tight">Report Builder</h1>
        <p className="text-muted-foreground mt-1">Generate custom analytics reports</p>
      </motion.div>

      <Card className="glass-card glow-blue">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />Generate Report</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                {REPORT_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg">Recent Reports</CardTitle></CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Reports Yet</h3>
              <p className="text-sm mt-2">Generate your first report using the form above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 inline mr-1" />{formatDate(r.created_at)} • {r.report_type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === 'completed' ? 'success' : r.status === 'generating' ? 'warning' : 'secondary'}>{r.status}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => {
                      const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `${r.title || 'report'}.json`; a.click();
                      URL.revokeObjectURL(url);
                    }}><Download className="h-4 w-4" /></Button>
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
