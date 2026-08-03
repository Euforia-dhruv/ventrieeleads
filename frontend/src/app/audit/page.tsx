'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scan, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AuditReport } from '@/types/leads';

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAudit = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch('/api/audit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setResult(data.data || null);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const scoreBars = [
    { label: 'SEO Score', value: result?.seo_score ?? 0, color: 'bg-purple-500' },
    { label: 'Performance', value: result?.performance_score ?? 0, color: 'bg-blue-500' },
    { label: 'Design', value: result?.design_score ?? 0, color: 'bg-green-500' },
    { label: 'Conversion', value: result?.conversion_score ?? 0, color: 'bg-orange-500' },
    { label: 'Accessibility', value: result?.accessibility_score ?? 0, color: 'bg-yellow-500' },
    { label: 'Trust', value: result?.trust_score ?? 0, color: 'bg-red-500' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Audit</h1>
        <p className="text-muted-foreground mt-1">Analyze websites and get actionable insights</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Input
              placeholder="https://your-website.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAudit()}
              className="flex-1"
            />
            <Button onClick={handleAudit} disabled={loading || !url}>
              <Scan className="h-4 w-4 mr-2" />
              {loading ? 'Auditing...' : 'Run Audit'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-5xl font-bold mb-2">{result.overall_score}</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {scoreBars.map(bar => (
              <Card key={bar.label}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{bar.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{bar.label}</div>
                  <div className="w-full h-2 bg-secondary rounded-full mt-3 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', bar.color)}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issues</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(result.issues || []).map((issue: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className={cn('h-4 w-4 mt-0.5 shrink-0', {
                      'text-red-500': issue.severity === 'critical' || issue.severity === 'high',
                      'text-yellow-500': issue.severity === 'medium',
                      'text-blue-500': issue.severity === 'low'
                    })} />
                    <div>
                      <div className="font-medium">{issue.title}</div>
                      <div className="text-xs text-muted-foreground">{issue.description}</div>
                    </div>
                  </div>
                ))}
                {(result.issues || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No issues found</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Wins</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(result.quick_wins || []).map((qw: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      {qw}
                    </li>
                  ))}
                  {(result.quick_wins || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No quick wins identified</p>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Est. Redesign Budget</div>
                <div className="text-xl font-bold text-green-500">{result.estimated_redesign_budget}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Recommended Services</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(result.recommended_services || []).map((s: string, i: number) => (
                    <span key={i} className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">{s}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/5 border-purple-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Strengths</div>
                <div className="space-y-1 mt-2">
                  {(result.strengths || []).slice(0, 4).map((s: string, i: number) => (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500" /> {s}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
