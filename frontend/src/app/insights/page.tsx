'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, Calendar, RefreshCw, Building2, MapPin, Zap, ArrowRight, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';

interface Briefing {
  briefing_date: string;
  briefing_type: string;
  top_opportunities: any[];
  website_changes: any;
  highest_value_prospects: any;
  growing_industries: string[];
  active_cities: string[];
  recommended_actions: string[];
  summary: string;
}

export default function InsightsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchBriefings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/briefings');
      const data = await res.json();
      setBriefings(data.data || []);
    } catch {
      setBriefings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  const generateBriefing = async () => {
    setGenerating(true);
    try {
      await fetch('/api/briefings/generate', { method: 'POST' });
      await fetchBriefings();
    } catch {
      // ignore
    }
    setGenerating(false);
  };

  const typeColors: Record<string, string> = {
    daily: 'info',
    weekly: 'success',
    custom: 'warning',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">Executive Insights</h1>
          <p className="text-muted-foreground mt-1">AI-generated briefings and strategic intelligence</p>
        </div>
        <Button onClick={generateBriefing} disabled={generating}>
          {generating ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          {generating ? 'Generating...' : 'Generate New Briefing'}
        </Button>
      </motion.div>

      {briefings.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="glass-card">
            <CardContent className="py-20 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">No Briefings Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Generate your first AI-powered executive briefing to get strategic insights, top opportunities, and recommended actions.
              </p>
              <Button onClick={generateBriefing} disabled={generating} className="mt-4">
                <Zap className="h-4 w-4 mr-2" />
                Generate Your First Briefing
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {briefings.map((briefing, i) => (
            <motion.div
              key={briefing.briefing_date + briefing.briefing_type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      {briefing.briefing_date}
                    </CardTitle>
                    <Badge variant={(typeColors[briefing.briefing_type] as any) || 'secondary'}>
                      {briefing.briefing_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {briefing.summary && (
                    <p className="text-muted-foreground leading-relaxed">{briefing.summary}</p>
                  )}

                  {briefing.top_opportunities?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Top Opportunities
                      </h4>
                      <div className="space-y-3">
                        {briefing.top_opportunities.map((opp: any, j: number) => (
                          <div key={j} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                            <div className="mt-0.5 h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-green-500">{j + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{opp.company_name || opp.name || 'Unknown'}</div>
                              {opp.industry && (
                                <div className="text-xs text-muted-foreground mt-0.5">{opp.industry}</div>
                              )}
                              {opp.estimated_value && (
                                <div className="text-xs text-green-500 mt-1 font-medium">
                                  {formatCurrency(opp.estimated_value)}
                                </div>
                              )}
                              {opp.reason && (
                                <p className="text-xs text-muted-foreground mt-1">{opp.reason}</p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {briefing.recommended_actions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-500" />
                        Recommended Actions
                      </h4>
                      <ol className="space-y-2">
                        {briefing.recommended_actions.map((action: string, j: number) => (
                          <li key={j} className="flex items-start gap-3 text-sm">
                            <span className="mt-0.5 h-5 w-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-orange-500">{j + 1}</span>
                            </span>
                            <span className="text-muted-foreground">{action}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {(briefing.growing_industries?.length > 0 || briefing.active_cities?.length > 0) && (
                    <div className="flex flex-wrap gap-4">
                      {briefing.growing_industries?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Growing Industries
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {briefing.growing_industries.map((ind: string, j: number) => (
                              <Badge key={j} variant="success">{ind}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {briefing.active_cities?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Active Cities
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {briefing.active_cities.map((city: string, j: number) => (
                              <Badge key={j} variant="info">{city}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
