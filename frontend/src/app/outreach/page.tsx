'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Mail, MessageSquare, Link2, Camera, Copy, Check, Loader2,
  Send, Clock, ArrowLeft, Edit3, Save, ExternalLink, Phone, Globe,
  Building2, AlertTriangle, Sparkles, ChevronDown
} from 'lucide-react';
import Link from 'next/link';

interface Lead {
  id: string;
  company_name?: string;
  company_website?: string;
  industry?: string;
  city?: string;
  email?: string;
  phone?: string;
  score?: number;
  score_label?: string;
}

interface OutreachResult {
  channel: string;
  company: { name: string; industry: string; city: string; website: string };
  issues_used: string[];
  subject?: string;
  body?: string;
  message?: string;
  connection_request?: string;
  follow_up?: string;
  cta?: string;
}

const CHANNELS = [
  { id: 'cold_email', label: 'Cold Email', icon: Mail, color: 'blue' },
  { id: 'linkedin', label: 'LinkedIn', icon: Link2, color: 'blue' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'green' },
  { id: 'instagram', label: 'Instagram DM', icon: Camera, color: 'pink' },
] as const;

function OutreachPageContent() {
  const searchParams = useSearchParams();
  const preselectedLeadId = searchParams.get('lead');
  const preselectedChannel = searchParams.get('channel');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>(preselectedChannel || 'cold_email');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [editedMessage, setEditedMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then(r => r.json())
      .then(d => {
        const leadList = d.data || [];
        setLeads(leadList);
        if (preselectedLeadId) {
          const match = leadList.find((l: Lead) => l.id === preselectedLeadId);
          if (match) {
            setSelectedLead(match);
            setLeadSearch(match.company_name || '');
          }
        }
      })
      .catch(() => {});
  }, [preselectedLeadId]);

  const filteredLeads = leads.filter(l =>
    (l.company_name || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.industry || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
    (l.city || '').toLowerCase().includes(leadSearch.toLowerCase())
  );

  const generate = useCallback(async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: selectedLead.id,
          channel: selectedChannel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        const msg = data.data.body || data.data.message || data.data.follow_up || '';
        setEditedMessage(msg);
        setIsEditing(false);
      }
    } catch (e) {
      console.error('Generation failed:', e);
    } finally {
      setGenerating(false);
    }
  }, [selectedLead, selectedChannel]);

  const copyToClipboard = async () => {
    const text = editedMessage || result?.body || result?.message || '';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveOutreach = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          message: editedMessage,
          status: 'sent',
        }),
      });
      if (res.ok) {
        alert('Outreach recorded!');
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const getMessageDisplay = () => {
    if (!result) return null;
    if (result.subject && result.body) {
      return (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Subject</label>
            <div className="mt-1 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-white">
              {result.subject}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Body</label>
            <textarea
              value={isEditing ? editedMessage : (result.body || '')}
              onChange={(e) => { setEditedMessage(e.target.value); setIsEditing(true); }}
              className="mt-1 w-full h-48 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 resize-none font-mono"
            />
          </div>
        </div>
      );
    }
    if (result.connection_request && result.follow_up) {
      return (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Connection Request</label>
            <textarea
              value={isEditing ? editedMessage : result.connection_request}
              onChange={(e) => { setEditedMessage(e.target.value); setIsEditing(true); }}
              className="mt-1 w-full h-24 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40 resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Follow-up Message</label>
            <textarea
              value={result.follow_up}
              readOnly
              className="mt-1 w-full h-32 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-[hsl(215,20%,60%)] resize-none"
            />
          </div>
        </div>
      );
    }
    return (
      <textarea
        value={isEditing ? editedMessage : (result.message || '')}
        onChange={(e) => { setEditedMessage(e.target.value); setIsEditing(true); }}
        className="w-full h-48 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 resize-none font-mono"
      />
    );
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="p-2 hover:bg-white/[0.04] rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold text-white">Generate Outreach</h1>
          <p className="text-[13px] text-[hsl(215,16%,45%)]">Create personalized messages using verified lead data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead selection + Channel */}
        <div className="space-y-4">
          {/* Lead Selector */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-3">Select Lead</h2>
            <div className="relative">
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => { setLeadSearch(e.target.value); setShowLeadDropdown(true); }}
                onFocus={() => setShowLeadDropdown(true)}
                placeholder="Search leads..."
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40"
              />
              {showLeadDropdown && filteredLeads.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full max-h-60 overflow-y-auto bg-[hsl(224,71%,6%)] border border-white/[0.06] rounded-lg shadow-xl">
                  {filteredLeads.slice(0, 20).map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setLeadSearch(lead.company_name || ''); setShowLeadDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-white/[0.04] border-b border-white/[0.02] last:border-0"
                    >
                      <div className="text-[12px] text-white font-medium">{lead.company_name}</div>
                      <div className="text-[10px] text-[hsl(215,16%,40%)]">{lead.industry} · {lead.city}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedLead && (
              <div className="mt-3 p-3 bg-white/[0.02] rounded-lg space-y-1">
                <div className="text-[13px] font-medium text-white">{selectedLead.company_name}</div>
                <div className="flex items-center gap-2 text-[11px] text-[hsl(215,16%,50%)]">
                  {selectedLead.industry && <span>{selectedLead.industry}</span>}
                  {selectedLead.city && <span>· {selectedLead.city}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {selectedLead.email && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                      <Mail className="w-3 h-3" /> {selectedLead.email}
                    </span>
                  )}
                  {selectedLead.phone && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-400">
                      <Phone className="w-3 h-3" /> {selectedLead.phone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    (selectedLead.score || 0) >= 70 ? 'bg-red-500/20 text-red-400' :
                    (selectedLead.score || 0) >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedLead.score || 0} {selectedLead.score_label || 'cold'}
                  </span>
                  {selectedLead.company_website && (
                    <a href={selectedLead.company_website} target="_blank" rel="noopener noreferrer"
                       className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Website <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Channel Selector */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-3">Channel</h2>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all border ${
                    selectedChannel === ch.id
                      ? `bg-${ch.color}-500/15 border-${ch.color}-500/30 text-${ch.color}-400`
                      : 'bg-white/[0.02] border-white/[0.04] text-[hsl(215,16%,50%)] hover:bg-white/[0.04]'
                  }`}
                >
                  <ch.icon className="w-4 h-4" />
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generate}
            disabled={!selectedLead || generating}
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-[hsl(223,47%,11%)] disabled:to-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Message</>
            )}
          </button>
        </div>

        {/* Right: Generated Message */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              {/* Message */}
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-semibold text-white">
                    {CHANNELS.find(c => c.id === result.channel)?.label || 'Message'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 h-8 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-all">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={saveOutreach} disabled={saving}
                      className="flex items-center gap-1.5 px-3 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg text-[11px] text-blue-400 hover:bg-blue-600/30 transition-all">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save & Mark Contacted
                    </button>
                  </div>
                </div>
                {getMessageDisplay()}
              </div>

              {/* Data Used */}
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[13px] font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Verified Data Used
                </h2>
                <p className="text-[11px] text-[hsl(215,16%,40%)] mb-3">
                  Only the following verified data was used. No information was invented.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <Building2 className="w-3.5 h-3.5 text-[hsl(215,16%,40%)]" />
                    <span className="text-white">{result.company.name}</span>
                    <span className="text-[hsl(215,16%,40%)]">({result.company.industry})</span>
                  </div>
                  {result.company.website && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <Globe className="w-3.5 h-3.5 text-[hsl(215,16%,40%)]" />
                      <span className="text-blue-400">{result.company.website}</span>
                    </div>
                  )}
                  {result.issues_used.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] font-medium text-[hsl(215,16%,50%)] uppercase">Issues Found:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.issues_used.map((issue, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <Sparkles className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
              <p className="text-[14px] text-[hsl(215,16%,40%)]">
                {generating ? 'Generating personalized message...' : 'Select a lead and channel to generate outreach'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>}>
      <OutreachPageContent />
    </Suspense>
  );
}
