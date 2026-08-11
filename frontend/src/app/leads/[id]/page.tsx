'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  MapPin,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Target,
  MessageSquare,
  Loader2,
  Star,
  Zap,
  AlertTriangle,
  Send,
  Copy,
  Check,
} from 'lucide-react';
import { cn, formatDate, getScoreColor, statusColors } from '@/lib/utils';

const STATUS_OPTIONS = [
  'New', 'Qualified', 'Researching', 'Contacted', 'Replied',
  'Meeting', 'Proposal', 'Won', 'Lost',
];

const CHANNELS = [
  { value: 'cold_email', label: 'Cold Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram DM' },
];

interface LeadDetail {
  company_name?: string;
  status?: string;
  score?: number;
  industry?: string;
  city?: string;
  country?: string;
  company_website?: string;
  google_maps_url?: string;
  email?: string;
  company_email?: string;
  phone?: string;
  company_phone?: string;
  rating?: number;
  review_count?: number;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  audit?: {
    overall_score?: number;
    seo_score?: number;
    performance_score?: number;
    design_score?: number;
    conversion_score?: number;
    trust_score?: number;
    issues?: string[];
    strengths?: string[];
    weaknesses?: string[];
    quick_wins?: string[];
  };
  ai_scoring?: {
    score?: number;
    opportunity_score?: number;
    urgency?: string;
    buying_probability?: number;
    estimated_project_value?: string;
    recommended_service?: string;
    pain_points?: string[];
    reasons?: string[];
    outreach_angle?: string;
    ai_enhanced?: boolean;
  };
  technologies?: Array<{ name: string; category: string }>;
  services?: string[];
}

interface TimelineItem {
  id?: string;
  activity_type?: string;
  title?: string;
  description?: string;
  created_at?: string;
  content?: string;
}

interface LeadTask {
  id?: string;
  title?: string;
  status?: string;
}

interface OutreachRecord {
  id?: string;
  channel?: string;
  message?: string;
  status?: string;
  created_at?: string;
  action?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'tasks' | 'outreach'>('overview');
  const [newTask, setNewTask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [outreachChannel, setOutreachChannel] = useState('cold_email');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [outreachHistory, setOutreachHistory] = useState<OutreachRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/leads/${id}`).then((r) => r.json()),
      fetch(`/api/leads/${id}/timeline`).then((r) => r.json()),
      fetch(`/api/leads/${id}/tasks`).then((r) => r.json()),
      fetch(`/api/leads/${id}/outreach`).then((r) => r.json()),
    ])
      .then(([leadData, timeData, taskData, outreachData]) => {
        setLead(leadData.data);
        setTimeline(timeData.data || []);
        setTasks(taskData.data || []);
        setOutreachHistory(outreachData.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setLead((prev) => ({ ...(prev || {}), status }));
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    await fetch(`/api/leads/${id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTask }),
    });
    setNewTask('');
    const res = await fetch(`/api/leads/${id}/tasks`);
    const data = await res.json();
    setTasks(data.data || []);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await fetch(`/api/leads/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote }),
    });
    setNewNote('');
    const res = await fetch(`/api/leads/${id}/timeline`);
    const data = await res.json();
    setTimeline(data.data || []);
  };

  const generateOutreach = async () => {
    setOutreachLoading(true);
    try {
      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, channel: outreachChannel, tone: 'professional' }),
      });
      const data = await res.json();
      if (data.message) setOutreachMessage(data.message);
    } catch (error) {
      console.error('Failed to generate outreach:', error);
    } finally {
      setOutreachLoading(false);
    }
  };

  const recordOutreach = async (status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: outreachChannel,
          message: outreachMessage,
          status,
        }),
      });
      if (res.ok) {
        const historyRes = await fetch(`/api/leads/${id}/outreach`);
        const historyData = await historyRes.json();
        setOutreachHistory(historyData.data || []);
      }
    } catch (error) {
      console.error('Failed to record outreach:', error);
    }
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(outreachMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await recordOutreach('copied');
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );

  if (!lead) return <div className="p-6 text-center text-[hsl(215,16%,40%)]">Lead not found</div>;

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'timeline' as const, label: 'Timeline' },
    { key: 'tasks' as const, label: `Tasks (${tasks.length})` },
    { key: 'outreach' as const, label: 'Outreach' },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
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
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', statusColors(lead.status || ''))}>
                  {lead.status}
                </span>
                <span className={cn('text-[13px] font-semibold', getScoreColor(lead.score || 0))}>
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

      <div className="flex items-center gap-1 border-b border-white/[0.04]">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all -mb-px',
              activeTab === t.key ? 'border-blue-500 text-white' : 'border-transparent text-[hsl(215,16%,45%)] hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {lead.ai_scoring && (
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-[13px] font-semibold text-white">AI Analysis</h2>
                  {lead.ai_scoring.ai_enhanced && (
                    <span className="px-2 py-0.5 bg-yellow-500/10 rounded text-[10px] text-yellow-400">AI Enhanced</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 bg-white/[0.02] rounded-lg">
                    <div className={cn('text-[18px] font-bold', getScoreColor(lead.ai_scoring.opportunity_score || 0))}>
                      {lead.ai_scoring.opportunity_score || 0}
                    </div>
                    <div className="text-[10px] text-[hsl(215,16%,50%)]">Opportunity</div>
                  </div>
                  <div className="text-center p-2 bg-white/[0.02] rounded-lg">
                    <div className={cn('text-[18px] font-bold', getScoreColor(lead.ai_scoring.buying_probability || 0))}>
                      {lead.ai_scoring.buying_probability || 0}%
                    </div>
                    <div className="text-[10px] text-[hsl(215,16%,50%)]">Buying Prob.</div>
                  </div>
                  <div className="text-center p-2 bg-white/[0.02] rounded-lg">
                    <div className="text-[18px] font-bold text-white">
                      {lead.ai_scoring.estimated_project_value || 'N/A'}
                    </div>
                    <div className="text-[10px] text-[hsl(215,16%,50%)]">Project Value</div>
                  </div>
                  <div className="text-center p-2 bg-white/[0.02] rounded-lg">
                    <div className={cn('text-[14px] font-bold capitalize',
                      lead.ai_scoring.urgency === 'high' ? 'text-red-400' : lead.ai_scoring.urgency === 'medium' ? 'text-yellow-400' : 'text-green-400')}>
                      {lead.ai_scoring.urgency || 'medium'}
                    </div>
                    <div className="text-[10px] text-[hsl(215,16%,50%)]">Urgency</div>
                  </div>
                </div>
                {lead.ai_scoring.recommended_service && (
                  <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg mb-2">
                    <span className="text-[11px] text-blue-400">Recommended: </span>
                    <span className="text-[12px] text-white">{lead.ai_scoring.recommended_service}</span>
                  </div>
                )}
                {lead.ai_scoring.outreach_angle && (
                  <div className="p-2 bg-green-500/5 border border-green-500/10 rounded-lg">
                    <span className="text-[11px] text-green-400">Pitch Angle: </span>
                    <span className="text-[12px] text-white">{lead.ai_scoring.outreach_angle}</span>
                  </div>
                )}
                {(lead.ai_scoring.pain_points?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <h3 className="text-[11px] font-semibold text-red-400 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Pain Points
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.ai_scoring.pain_points!.map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/5 border border-red-500/10 rounded text-[11px] text-red-300">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(lead.ai_scoring.reasons?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <h3 className="text-[11px] font-semibold text-green-400 mb-1.5">Reasons to Contact</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.ai_scoring.reasons!.map((r, i) => (
                        <span key={i} className="px-2 py-1 bg-green-500/5 border border-green-500/10 rounded text-[11px] text-green-300">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {(lead.whatsapp || lead.instagram || lead.facebook || lead.linkedin || lead.youtube || lead.tiktok) && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Social Links</h2>
                <div className="flex flex-wrap gap-2">
                  {lead.whatsapp && <span className="px-3 py-1.5 bg-green-500/10 rounded-lg text-[12px] text-green-400">WhatsApp: {lead.whatsapp}</span>}
                  {lead.instagram && <span className="px-3 py-1.5 bg-pink-500/10 rounded-lg text-[12px] text-pink-400">Instagram: {lead.instagram}</span>}
                  {lead.facebook && <span className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400">Facebook: {lead.facebook}</span>}
                  {lead.linkedin && <span className="px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400">LinkedIn: {lead.linkedin}</span>}
                  {lead.youtube && <span className="px-3 py-1.5 bg-red-500/10 rounded-lg text-[12px] text-red-400">YouTube: {lead.youtube}</span>}
                  {lead.tiktok && <span className="px-3 py-1.5 bg-purple-500/10 rounded-lg text-[12px] text-purple-400">TikTok: {lead.tiktok}</span>}
                </div>
              </div>
            )}

            {lead.audit && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Website Audit</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                  {[
                    { label: 'Overall', value: lead.audit.overall_score },
                    { label: 'SEO', value: lead.audit.seo_score },
                    { label: 'Performance', value: lead.audit.performance_score },
                    { label: 'Design', value: lead.audit.design_score },
                    { label: 'Conversion', value: lead.audit.conversion_score },
                    { label: 'Trust', value: lead.audit.trust_score },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 bg-white/[0.02] rounded-lg">
                      <div className={cn('text-[18px] font-bold', getScoreColor(s.value ?? 0))}>{s.value ?? 0}</div>
                      <div className="text-[10px] text-[hsl(215,16%,50%)]">{s.label}</div>
                    </div>
                  ))}
                </div>
                {(lead.audit.weaknesses?.length ?? 0) > 0 && (
                  <div className="mb-3">
                    <h3 className="text-[11px] font-semibold text-red-400 mb-1.5">Weaknesses</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.audit.weaknesses!.slice(0, 5).map((w, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/5 border border-red-500/10 rounded text-[11px] text-red-300">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(lead.audit.quick_wins?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold text-green-400 mb-1.5">Quick Wins</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.audit.quick_wins!.slice(0, 5).map((q, i) => (
                        <span key={i} className="px-2 py-1 bg-green-500/5 border border-green-500/10 rounded text-[11px] text-green-300">{q}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(lead.technologies?.length ?? 0) > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Technologies</h2>
                <div className="flex flex-wrap gap-1.5">
                  {lead.technologies!.map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-white/[0.04] rounded text-[11px] text-[hsl(215,20%,60%)]">
                      {t.name} <span className="text-[hsl(215,16%,40%)]">({t.category})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Status</h2>
              <div className="space-y-1">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={cn('w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all',
                      lead.status === s ? 'bg-blue-500/15 text-blue-400 font-medium' : 'text-[hsl(215,16%,50%)] hover:bg-white/[0.04] hover:text-white')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {lead.services && lead.services.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3">Services</h2>
                <div className="space-y-1.5">
                  {lead.services.map((s, i) => (
                    <div key={i} className="text-[12px] text-[hsl(215,20%,60%)]">{s}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note..."
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
              {timeline.map((item: TimelineItem, i: number) => (
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
                      <span className="text-[11px] text-[hsl(215,16%,40%)]">{item.created_at ? formatDate(item.created_at) : ''}</span>
                    </div>
                    {item.content && <p className="text-[12px] text-[hsl(215,20%,55%)] mt-1">{item.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="New task..."
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
              {tasks.map((task: LeadTask) => (
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

      {activeTab === 'outreach' && (
        <div className="space-y-4">
          {/* Generate new outreach */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-4">Generate Outreach Message</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1.5 block">Channel</label>
                <select value={outreachChannel} onChange={(e) => setOutreachChannel(e.target.value)}
                  className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40">
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={generateOutreach} disabled={outreachLoading}
                  className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12px] font-medium transition-all disabled:opacity-50">
                  {outreachLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Generate
                </button>
                {outreachMessage && (
                  <button onClick={() => recordOutreach('sent')}
                    className="flex items-center gap-1.5 px-4 h-9 bg-green-600/20 border border-green-500/30 text-green-400 rounded-lg text-[12px] font-medium transition-all hover:bg-green-600/30">
                    Mark Sent
                  </button>
                )}
              </div>
            </div>
            {outreachMessage && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[hsl(215,16%,50%)]">Generated Message</span>
                  <button onClick={copyMessage} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg text-[13px] text-[hsl(215,20%,70%)] whitespace-pre-wrap">
                  {outreachMessage}
                </div>
              </div>
            )}
          </div>

          {/* Outreach history */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-4">Outreach History</h2>
            {outreachHistory.length === 0 ? (
              <p className="text-[hsl(215,16%,40%)] text-center py-6 text-[12px]">No outreach recorded yet</p>
            ) : (
              <div className="space-y-2">
                {outreachHistory.map((record, i) => {
                  const channel = record.channel || record.action?.replace('outreach_', '') || 'unknown';
                  const status = record.status || 'unknown';
                  const statusColor = status === 'sent' ? 'text-green-400' : status === 'copied' ? 'text-blue-400' : status === 'replied' ? 'text-purple-400' : status === 'failed' ? 'text-red-400' : 'text-[hsl(215,16%,50%)]';
                  return (
                    <div key={record.id || i} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', status === 'sent' ? 'bg-green-500' : status === 'copied' ? 'bg-blue-500' : status === 'replied' ? 'bg-purple-500' : 'bg-gray-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-white capitalize">{channel}</span>
                          <span className={cn('text-[10px] font-medium capitalize', statusColor)}>{status}</span>
                        </div>
                        {record.message && (
                          <p className="text-[11px] text-[hsl(215,16%,40%)] truncate mt-0.5">{record.message.slice(0, 80)}...</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[hsl(215,16%,35%)] shrink-0">
                        {record.created_at ? formatDate(record.created_at) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
