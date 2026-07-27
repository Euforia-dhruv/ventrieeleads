'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scan, AlertCircle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, getScoreColor, getScoreBg } from '@/lib/utils';
import type { AuditResult } from '@/types/leads';

export default function AuditPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);
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
    { label: 'Business Score', value: result?.business_score ?? 0, color: 'bg-blue-500' },
    { label: 'Website Score', value: result?.website_score ?? 0, color: 'bg-green-500' },
    { label: 'SEO Score', value: result?.seo_score ?? 0, color: 'bg-purple-500' },
    { label: 'Conversion Score', value: result?.conversion_score ?? 0, color: 'bg-orange-500' }
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
              placeholder="https://example.com"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {scoreBars.map(bar => (
              <Card key={bar.label}>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">{bar.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{bar.label}</div>
                  <div className="w-full h-2 bg-secondary rounded-full mt-3 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', bar.color, `w-[${bar.value}%]`)}
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
                <CardTitle className="text-lg">Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(result.checks ?? {}).map(([key, passed]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {passed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(result.recommendations || []).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                  {(result.recommendations || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No major issues found</p>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Est. Project Value</div>
                <div className="text-2xl font-bold text-green-500">{result.estimated_project_value}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Expected ROI</div>
                <div className="text-2xl font-bold text-blue-500">{result.expected_roi}</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
