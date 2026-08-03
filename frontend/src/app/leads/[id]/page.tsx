'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Globe, Mail, Phone, MapPin, Calendar, DollarSign, Plus, ExternalLink, AlertTriangle, CheckCircle2, Clock, Shield, Target, MessageSquare } from 'lucide-react';
import { cn, formatDate, getScoreColor, statusColors } from '@/lib/utils';
import Link from 'next/link';

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [opportunity, setOpportunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'tasks' | 'opportunity'>('overview');
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/${id}/timeline`).then(r => r.json()),
      fetch(`/api/leads/${id}/tasks`).then(r => r.json()),
      fetch(`/api/opportunities/${id}`).then(r => r.json()),
    ]).then(([leadData, timeData, taskData, oppData]) => {
      setLead(leadData.data);
      setTimeline(timeData.data || []);
      setTasks(taskData.data || []);
      setOpportunity(oppData.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/leads/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setLead((prev: any) => ({ ...prev, status }));
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    await fetch(`/api/leads/${id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTask }) });
    setNewTask('');
    const res = await fetch(`/api/leads/${id}/tasks`);
    const data = await res.json();
    setTasks(data.data || []);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await fetch(`/api/leads/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newNote }) });
    setNewNote('');
    const res = await fetch(`/api/leads/${id}/timeline`);
    const data = await res.json();
    setTimeline(data.data || []);
  };

  const estimateOpportunity = async () => {
    setEstimating(true);
    try {
      const res = await fetch(`/api/opportunities/${id}/estimate`, { method: 'POST' });
      const data = await res.json();
      setOpportunity(data.data);
    } catch (e) { console.error(e); }
    setEstimating(false);
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!lead) return <div className="p-6 text-center text-muted-foreground">Lead not found</div>;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'opportunity', label: 'Opportunity' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/leads"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.company_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={cn('border', statusColors(lead.status))}>{lead.status}</Badge>
            <span className={cn('text-sm font-semibold', getScoreColor(lead.score || 0))}>Score: {lead.score || 0}</span>
            {lead.score_label && <Badge variant="outline">{lead.score_label}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {lead.company_website && (
            <Button variant="outline" size="sm" asChild><a href={lead.company_website} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Website</a></Button>
          )}
          {lead.google_maps_url && (
            <Button variant="outline" size="sm" asChild><a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4 mr-2" />Maps</a></Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={cn('px-4 py-2 text-sm font-medium rounded-t-md transition-colors', activeTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Company Info</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" />{lead.company_website || 'No website'}</div>
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email || lead.company_email || 'No email'}</div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{lead.phone || lead.company_phone || 'No phone'}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{lead.city || 'Unknown'}, {lead.country || 'UAE'}</div>
                  <div className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" />{lead.industry || 'Unknown industry'}</div>
                  {lead.rating && <div className="flex items-center gap-2">⭐ {lead.rating} ({lead.review_count || 0} reviews)</div>}
                </div>
              </CardContent>
            </Card>

            {lead.audit && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Latest Audit</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    {[
                      { label: 'Overall', value: lead.audit.overall_score },
                      { label: 'SEO', value: lead.audit.seo_score },
                      { label: 'Performance', value: lead.audit.performance_score },
                      { label: 'Design', value: lead.audit.design_score },
                      { label: 'Conversion', value: lead.audit.conversion_score },
                      { label: 'Trust', value: lead.audit.trust_score },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <div className={cn('text-xl font-bold', getScoreColor(s.value))}>{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {lead.technologies?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Technologies</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {lead.technologies.map((t: any, i: number) => (
                      <Badge key={i} variant="outline">{t.name}{t.version ? ` v${t.version}` : ''}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Change Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {['New','Qualified','Researching','Contacted','Replied','Meeting','Proposal','Negotiation','Won','Lost'].map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={cn('w-full text-left px-3 py-2 rounded text-sm transition-colors', lead.status === s ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-secondary')}>
                    {s}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Social</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.whatsapp && <div className="flex items-center gap-2">📱 WhatsApp: {lead.whatsapp}</div>}
                {lead.instagram && <div className="flex items-center gap-2">📸 Instagram: {lead.instagram}</div>}
                {lead.facebook && <div className="flex items-center gap-2">👥 Facebook: {lead.facebook}</div>}
                {lead.linkedin && <div className="flex items-center gap-2">💼 LinkedIn: {lead.linkedin}</div>}
                {!lead.whatsapp && !lead.instagram && !lead.facebook && !lead.linkedin && (
                  <p className="text-muted-foreground">No social links found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Input placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()} className="flex-1" />
                <Button onClick={addNote}><MessageSquare className="h-4 w-4 mr-2" />Add Note</Button>
              </div>
              {timeline.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No activity yet</p>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {timeline.map((item: any, i: number) => (
                    <div key={item.id || i} className="relative">
                      <div className={cn('absolute -left-4 w-3 h-3 rounded-full border-2 bg-background', {
                        'border-blue-500': item.activity_type === 'note',
                        'border-green-500': item.activity_type === 'status_change',
                        'border-purple-500': item.activity_type === 'task_created',
                        'border-yellow-500': item.activity_type === 'task_completed',
                        'border-gray-500': !item.activity_type,
                      })} />
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.title || item.description || 'Activity'}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                        </div>
                        {item.content && <p className="text-sm text-muted-foreground mt-1">{item.content}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input placeholder="New task..." value={newTask} onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()} className="flex-1" />
              <Button onClick={addTask}><Plus className="h-4 w-4 mr-2" />Add Task</Button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tasks yet</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded bg-secondary/30">
                    <div className="flex items-center gap-3">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2" />
                      )}
                      <span className={cn('text-sm', task.status === 'completed' && 'line-through text-muted-foreground')}>{task.title}</span>
                    </div>
                    <Badge variant="outline">{task.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'opportunity' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              {!opportunity ? (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Opportunity Estimation</h3>
                  <p className="text-sm text-muted-foreground mb-4">Generate a budget estimate based on the company&apos;s audit data</p>
                  <Button onClick={estimateOpportunity} disabled={estimating}>
                    <DollarSign className="h-4 w-4 mr-2" />{estimating ? 'Estimating...' : 'Generate Estimate'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">Budget Estimate</h3>
                      <p className="text-sm text-muted-foreground">Based on audit scores and industry benchmarks (AED)</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-500">
                        {opportunity.total_min?.toLocaleString()} - {opportunity.total_max?.toLocaleString()}
                      </div>
                      <Badge variant={opportunity.priority === 'high' ? 'destructive' : opportunity.priority === 'medium' ? 'warning' : 'secondary'}>
                        {opportunity.priority} priority • {Math.round((opportunity.confidence || 0) * 100)}% confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { key: 'website_redesign', label: 'Website Redesign', color: 'text-blue-500' },
                      { key: 'seo', label: 'SEO', color: 'text-purple-500' },
                      { key: 'branding', label: 'Branding', color: 'text-pink-500' },
                      { key: 'performance', label: 'Performance', color: 'text-green-500' },
                      { key: 'booking_engine', label: 'Booking Engine', color: 'text-orange-500' },
                      { key: 'ai_chatbot', label: 'AI Chatbot', color: 'text-cyan-500' },
                      { key: 'analytics', label: 'Analytics', color: 'text-yellow-500' },
                      { key: 'maintenance', label: 'Maintenance', color: 'text-gray-500' },
                    ].map(s => {
                      const min = opportunity[`${s.key}_min`] || 0;
                      const max = opportunity[`${s.key}_max`] || 0;
                      if (!min && !max) return null;
                      return (
                        <div key={s.key} className="p-3 rounded-lg bg-secondary/30">
                          <div className={cn('text-lg font-bold', s.color)}>{min.toLocaleString()} - {max.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{s.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {opportunity.recommended_services?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Recommended Services</h4>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.recommended_services.map((s: string, i: number) => (
                          <Badge key={i} variant="outline" className="bg-green-500/10 text-green-500">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button variant="outline" onClick={estimateOpportunity} disabled={estimating}>
                    <DollarSign className="h-4 w-4 mr-2" />Regenerate Estimate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
