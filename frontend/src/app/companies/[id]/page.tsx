'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Globe, Phone, Mail, MapPin, Star, Users, ExternalLink,
  Cpu, BarChart3, Shield, Target, TrendingUp, FileText, Eye, Clock,
  Wand2, Play, Download, ChevronRight, Award, AlertTriangle,
  CheckCircle2, Zap, ArrowRight, Lightbulb, MessageSquare
} from 'lucide-react';
import { cn, formatDate, formatCurrency, getScoreColor } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

export default function CompanyDossierPage() {
  const { toast } = useToast();
  const params = useParams();
  const id = params.id as string;
  const [company, setCompany] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [audit, setAudit] = useState<any>(null);
  const [research, setResearch] = useState<any>(null);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [playbook, setPlaybook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/companies/${id}`).then(r => r.json()),
      fetch(`/api/companies/${id}/contacts`).then(r => r.json()).then(d => d.data || d).catch(() => []),
      fetch(`/api/companies/${id}/technologies`).then(r => r.json()).then(d => d.data || d).catch(() => []),
      fetch(`/api/companies/${id}/audit`).then(r => r.json()).then(d => d.data || d).catch(() => null),
      fetch(`/api/companies/${id}/research`).then(r => r.json()).then(d => d.data || d).catch(() => null),
      fetch(`/api/companies/${id}/competitors`).then(r => r.json()).then(d => d.data || d).catch(() => []),
      fetch(`/api/companies/${id}/timeline`).then(r => r.json()).then(d => d.data || d).catch(() => []),
      fetch(`/api/companies/${id}/monitoring`).then(r => r.json()).then(d => d.data || d).catch(() => null),
      fetch(`/api/companies/${id}/playbook`).then(r => r.json()).then(d => d.data || d).catch(() => null),
      fetch(`/api/proposals`).then(r => r.json()).then(d => d.data || d).catch(() => []),
    ]).then(([c, co, t, a, r, comp, tl, mon, pb, props]) => {
      setCompany(c);
      setContacts(Array.isArray(co) ? co : []);
      setTechs(Array.isArray(t) ? t : []);
      setAudit(a);
      setResearch(r);
      setCompetitors(Array.isArray(comp) ? comp : []);
      setTimeline(Array.isArray(tl) ? tl : []);
      setMonitoring(mon);
      setPlaybook(pb);
      setProposals(Array.isArray(props) ? props.filter((p: any) => p.company_id === id) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const triggerResearch = async () => {
    await fetch(`/api/companies/${id}/research`, { method: 'POST' });
    toast('Research generation started', 'success');
  };

  const triggerCompetitorAnalysis = async () => {
    await fetch(`/api/companies/${id}/competitors`, { method: 'POST' });
    toast('Competitor analysis started', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Company not found</h2>
        <Link href="/leads"><Button variant="outline" className="mt-4">Back to Leads</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl glass-card flex items-center justify-center text-xl font-bold gradient-text">
              {company.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {company.industry && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{company.industry}</span>}
                {company.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.city}</span>}
                {company.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" />{company.rating} ({company.review_count})</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={triggerResearch}><Wand2 className="h-4 w-4 mr-1" />Research</Button>
            <Button size="sm" variant="outline" onClick={triggerCompetitorAnalysis}><Eye className="h-4 w-4 mr-1" />Competitors</Button>
            {company.website && <Button size="sm" variant="outline" asChild><a href={company.website} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Website</a></Button>}
          </div>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {audit && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-lg">Website Scores</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Overall', value: audit.overall_score },
                        { label: 'SEO', value: audit.seo_score },
                        { label: 'Performance', value: audit.performance_score },
                        { label: 'Design', value: audit.design_score },
                        { label: 'Conversion', value: audit.conversion_score },
                        { label: 'Trust', value: audit.trust_score },
                      ].map(s => (
                        <div key={s.label} className="text-center p-3 rounded-lg bg-secondary/30">
                          <div className={cn('text-2xl font-bold', getScoreColor(s.value))}>{s.value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                          <Progress value={s.value} className="mt-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {playbook && (
                <Card className="glass-card glow-blue">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />Sales Playbook</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <div className="text-xs text-muted-foreground">Urgency</div>
                        <Badge variant={playbook.urgency === 'critical' ? 'destructive' : playbook.urgency === 'high' ? 'warning' : 'info'} className="mt-1">{playbook.urgency}</Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <div className="text-xs text-muted-foreground">Close Probability</div>
                        <div className={cn('text-xl font-bold mt-1', getScoreColor(playbook.close_probability))}>{playbook.close_probability}%</div>
                      </div>
                    </div>
                    {playbook.services?.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2">Recommended Services</div>
                        <div className="flex flex-wrap gap-2">
                          {playbook.services.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {playbook.pricing_range && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        Estimated Range: <span className="font-semibold text-foreground">{formatCurrency(playbook.pricing_range.min)} - {formatCurrency(playbook.pricing_range.max)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {research && (
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-lg">Business Summary</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{research.business_summary}</p>
                    {research.likely_pain_points?.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> Pain Points</div>
                        <ul className="space-y-1">
                          {research.likely_pain_points.map((p: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-orange-500" />{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {research.recommended_services?.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-2 flex items-center gap-1"><Target className="h-3 w-3 text-blue-500" /> Recommended Services</div>
                        <div className="flex flex-wrap gap-2">
                          {research.recommended_services.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs bg-blue-500/5">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {company.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{company.phone}</div>}
                  {company.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{company.email}</div>}
                  {company.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{company.address}</div>}
                  {contacts.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Key Contacts</div>
                      {contacts.slice(0, 3).map((c: any) => (
                        <div key={c.id} className="text-sm py-1">
                          <span className="font-medium">{c.name}</span>
                          {c.title && <span className="text-muted-foreground"> - {c.title}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Technology Stack</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {techs.map((t: any) => (
                      <Badge key={t.id} variant="secondary" className="text-xs"><Cpu className="h-3 w-3 mr-1" />{t.name}</Badge>
                    ))}
                    {techs.length === 0 && <p className="text-xs text-muted-foreground">No technologies detected</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Link href={`/proposals?company=${id}`} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start"><FileText className="h-4 w-4 mr-2" />Generate Proposal</Button>
                  </Link>
                  <Link href={`/copywriter?company=${id}`} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start"><MessageSquare className="h-4 w-4 mr-2" />Generate Outreach</Button>
                  </Link>
                  <Link href={`/redesign?company=${id}`} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start"><Eye className="h-4 w-4 mr-2" />Redesign Concept</Button>
                  </Link>
                  <Link href={`/playbook?company=${id}`} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start"><Play className="h-4 w-4 mr-2" />Sales Playbook</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="research">
          {research ? (
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Business Overview</h3>
                    <p className="text-sm text-muted-foreground">{research.business_summary}</p>
                    <div className="mt-4 space-y-2">
                      <div className="text-sm"><span className="text-muted-foreground">Type:</span> <span className="font-medium">{research.business_type || 'N/A'}</span></div>
                      <div className="text-sm"><span className="text-muted-foreground">Audience:</span> <span className="font-medium">{research.target_audience || 'N/A'}</span></div>
                      <div className="text-sm"><span className="text-muted-foreground">Priority:</span> <Badge variant={research.priority === 'high' ? 'destructive' : research.priority === 'medium' ? 'warning' : 'secondary'}>{research.priority}</Badge></div>
                      <div className="text-sm"><span className="text-muted-foreground">Budget:</span> <span className="font-medium">{research.estimated_budget || 'N/A'}</span></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {research.unique_selling_points?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Award className="h-3 w-3 text-green-500" /> Unique Selling Points</h4>
                        <ul className="space-y-1">{research.unique_selling_points.map((p: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {p}</li>)}</ul>
                      </div>
                    )}
                    {research.growth_indicators?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-blue-500" /> Growth Indicators</h4>
                        <ul className="space-y-1">{research.growth_indicators.map((p: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {p}</li>)}</ul>
                      </div>
                    )}
                    {research.website_weaknesses?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-500" /> Website Weaknesses</h4>
                        <ul className="space-y-1">{research.website_weaknesses.map((p: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {p}</li>)}</ul>
                      </div>
                    )}
                    {research.sales_talking_points?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3 text-purple-500" /> Talking Points</h4>
                        <ul className="space-y-1">{research.sales_talking_points.map((p: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {p}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
              <Wand2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Research Yet</h3>
              <p className="text-sm text-muted-foreground mt-2">Generate AI-powered intelligence for this company</p>
              <Button onClick={triggerResearch} className="mt-4"><Wand2 className="h-4 w-4 mr-2" />Generate Research</Button>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="audit">
          {audit ? (
            <Card className="glass-card"><CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {audit.weaknesses?.slice(0, 6).map((w: string, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="text-xs text-red-400 font-medium">{w}</div>
                  </div>
                ))}
              </div>
              {audit.quick_wins?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Quick Wins</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {audit.quick_wins.map((qw: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded bg-green-500/5">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{qw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent></Card>
          ) : (
            <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Audit Data</h3>
              <p className="text-sm text-muted-foreground mt-2">Run a website audit to see scores and recommendations</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="competitors">
          {competitors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitors.map((comp: any) => (
                <Card key={comp.id} className="glass-card">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">{comp.competitor_name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{comp.market_position}</p>
                    {comp.strengths_vs_competitor?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-green-500 mb-1">Their Strengths</div>
                        <ul className="space-y-0.5">{comp.strengths_vs_competitor.map((s: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {s}</li>)}</ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
              <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Competitor Analysis</h3>
              <Button onClick={triggerCompetitorAnalysis} className="mt-4"><Eye className="h-4 w-4 mr-2" />Run Analysis</Button>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="monitoring">
          <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
            <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {monitoring ? `Monitoring every ${monitoring.check_interval_hours}h. Next check: ${formatDate(monitoring.next_check_at)}` : 'Start monitoring to track changes'}
            </p>
            <Link href="/monitoring"><Button variant="outline" className="mt-4">Go to Monitoring Center</Button></Link>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="proposals">
          {proposals.length > 0 ? (
            <div className="space-y-3">
              {proposals.map((p: any) => (
                <Card key={p.id} className="glass-card">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.created_at)} • {p.status}</div>
                    </div>
                    <Badge variant={p.status === 'accepted' ? 'success' : p.status === 'sent' ? 'info' : 'secondary'}>{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card"><CardContent className="pt-6 text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No Proposals</h3>
              <Link href={`/proposals?company=${id}`}><Button className="mt-4">Generate Proposal</Button></Link>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="glass-card"><CardContent className="pt-6">
            {timeline.length > 0 ? (
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {timeline.map((event: any, i: number) => (
                  <div key={i} className="relative">
                    <div className={cn(
                      'absolute -left-4 top-1 w-4 h-4 rounded-full border-2 border-background',
                      event.type === 'research' ? 'bg-blue-500' :
                      event.type === 'audit' ? 'bg-green-500' :
                      event.type === 'proposal' ? 'bg-purple-500' : 'bg-orange-500'
                    )} />
                    <div className="ml-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{event.type}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
                      </div>
                      <div className="mt-1 text-sm">
                        {event.type === 'research' && <span>Research completed - Priority: {event.data.priority || 'medium'}</span>}
                        {event.type === 'audit' && <span>Audit score: {event.data.overall_score || 0}/100</span>}
                        {event.type === 'proposal' && <span>{event.data.title} - {event.data.status}</span>}
                        {event.type === 'monitoring' && <span>Monitoring check - {event.data.changes_detected?.length || 0} changes</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Timeline Events</h3>
                <p className="text-sm mt-2">Activity will appear here as you interact with this company</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
