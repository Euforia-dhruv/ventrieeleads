'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Mail, Phone, MapPin, Calendar, Plus, ExternalLink, CheckCircle2, Clock, Target, MessageSquare, Loader2, Building2, Star } from 'lucide-react';
import { cn, formatDate, getScoreColor, statusColors } from '@/lib/utils';

const STATUS_OPTIONS = ['New', 'Qualified', 'Researching', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Won', 'Lost'];

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'tasks'>('overview');
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/${id}/timeline`).then(r => r.json()),
      fetch(`/api/leads/${id}/tasks`).then(r => r.json()),
    ]).then(([leadData, timeData, taskData]) => {
      setLead(leadData.data);
      setTimeline(timeData.data || []);
      setTasks(taskData.data || []);
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

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );

  if (!lead) return <div className="p-6 text-center text-[hsl(215,16%,40%)]">Lead not found</div>;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/leads" className="p-2 hover:bg-white/[0.04] rounded-lg transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-[16px] font-bold text-white/20">
              {lead.company_name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-white">{lead.company_name}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", statusColors(lead.status))}>
                  {lead.status}
                </span>
                <span className={cn("text-[13px] font-semibold", getScoreColor(lead.score || 0))}>
                  Score: {lead.score || 0}
                </span>
                {lead.industry && <span className="text-[12px] text-[hsl(215,16%,50%)]">{lead.industry}</span>}
                {lead.city && <span className="text-[12px] text-[hsl(215,16%,50%)]">{lead.city}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.company_website && (
            <a href={lead.company_website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[12px] text-blue-400 hover:bg-blue-500/20 transition-all">
              <Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {lead.google_maps_url && (
            <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-all">
              <MapPin className="w-3.5 h-3.5" /> Maps
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.04]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all -mb-px",
              activeTab === t.key ? "border-blue-500 text-white" : "border-transparent text-[hsl(215,16%,45%)] hover:text-white"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Contact */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Contact Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  {lead.company_website && (
                    <a href={lead.company_website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[12px] text-blue-400 hover:text-blue-300 transition-colors">
                      <Globe className="w-3.5 h-3.5" /> {lead.company_website}
                    </a>
                  )}
                  {(lead.email || lead.company_email) && (
                    <a href={`mailto:${lead.email || lead.company_email}`}
                      className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,60%)] hover:text-white transition-colors">
                      <Mail className="w-3.5 h-3.5" /> {lead.email || lead.company_email}
                    </a>
                  )}
                  {(lead.phone || lead.company_phone) && (
                    <a href={`tel:${lead.phone || lead.company_phone}`}
                      className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,60%)] hover:text-white transition-colors">
                      <Phone className="w-3.5 h-3.5" /> {lead.phone || lead.company_phone}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,55%)]">
                    <MapPin className="w-3.5 h-3.5" /> {lead.city || 'Unknown'}, {lead.country || 'UAE'}
                  </p>
                  <p className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,55%)]">
                    <Target className="w-3.5 h-3.5" /> {lead.industry || 'Unknown industry'}
                  </p>
                  {lead.rating && (
                    <p className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,55%)]">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {lead.rating} ({lead.review_count || 0} reviews)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Social */}
            {(lead.whatsapp || lead.instagram || lead.facebook || lead.linkedin) && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Social Links</h2>
                <div className="flex flex-wrap gap-2">
                  {lead.whatsapp && <span className="px-3 py-1.5 bg-green-500/10 rounded-lg text-[12px] text-green-400">📱 WhatsApp: {lead.whatsapp}</span>}
                  {lead.instagram && <span className="px-3 py-1.5 bg-pink-500/10 rounded-lg text-[12px] text-pink-400">📸 Instagram: {lead.instagram}</span>}
                  {lead.facebook && <span className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400">👥 Facebook: {lead.facebook}</span>}
                  {lead.linkedin && <span className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400">💼 LinkedIn: {lead.linkedin}</span>}
                </div>
              </div>
            )}

            {/* Audit */}
            {lead.audit && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Latest Audit</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {[
                    { label: 'Overall', value: lead.audit.overall_score },
                    { label: 'SEO', value: lead.audit.seo_score },
                    { label: 'Performance', value: lead.audit.performance_score },
                    { label: 'Design', value: lead.audit.design_score },
                    { label: 'Conversion', value: lead.audit.conversion_score },
                    { label: 'Trust', value: lead.audit.trust_score },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 bg-white/[0.02] rounded-lg">
                      <div className={cn('text-[18px] font-bold', getScoreColor(s.value))}>{s.value}</div>
                      <div className="text-[10px] text-[hsl(215,16%,50%)]">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Status</h2>
              <div className="space-y-1">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all',
                      lead.status === s ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-[hsl(215,16%,50%)] hover:bg-white/[0.04] hover:text-white'
                    )}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNote()}
              placeholder="Add a note..."
              className="flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all" />
            <button onClick={addNote}
              className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12px] font-medium transition-all">
              <MessageSquare className="w-3.5 h-3.5" /> Add Note
            </button>
          </div>
          {timeline.length === 0 ? (
            <p className="text-[hsl(215,16%,40%)] text-center py-8">No activity yet</p>
          ) : (
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-white/[0.06]" />
              {timeline.map((item: any, i: number) => (
                <div key={item.id || i} className="relative">
                  <div className={cn('absolute -left-4 w-3 h-3 rounded-full border-2 bg-[hsl(224,71%,4%)]', {
                    'border-blue-500': item.activity_type === 'note',
                    'border-green-500': item.activity_type === 'status_change',
                    'border-purple-500': item.activity_type === 'task_created',
                    'border-yellow-500': item.activity_type === 'task_completed',
                    'border-gray-500': !item.activity_type,
                  })} />
                  <div className="ml-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">{item.title || item.description || 'Activity'}</span>
                      <span className="text-[11px] text-[hsl(215,16%,40%)]">{formatDate(item.created_at)}</span>
                    </div>
                    {item.content && <p className="text-[12px] text-[hsl(215,20%,55%)] mt-1">{item.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {activeTab === 'tasks' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="New task..."
              className="flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all" />
            <button onClick={addTask}
              className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12px] font-medium transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-[hsl(215,16%,40%)] text-center py-8">No tasks yet</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <div className="flex items-center gap-3">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : task.status === 'in_progress' ? (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[hsl(215,16%,30%)]" />
                    )}
                    <span className={cn('text-[13px] text-white', task.status === 'completed' && 'line-through text-[hsl(215,16%,40%)]')}>
                      {task.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-[hsl(215,16%,40%)]">{task.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
