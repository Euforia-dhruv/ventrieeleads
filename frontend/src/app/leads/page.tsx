'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Users, Phone, Mail, Globe, ArrowUpDown, Loader2, Download, X, MessageSquare, Link2, ExternalLink } from 'lucide-react';
import { cn, getScoreColor, statusColors } from '@/lib/utils';

interface Lead {
  id: string;
  company_name: string;
  industry?: string;
  city?: string;
  country?: string;
  score?: number;
  status: string;
  phone?: string;
  email?: string;
  website?: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  'All', 'New', 'Qualified', 'Researching', 'Contacted',
  'Replied', 'Meeting', 'Proposal', 'Won', 'Lost',
];

const INDUSTRY_OPTIONS = [
  'All Industries', 'Dentists', 'Hotels', 'Restaurants', 'Construction',
  'Law Firms', 'Marketing Agencies', 'Real Estate', 'IT Companies',
  'Medical Clinics', 'Gyms', 'Car Rentals', 'Interior Designers',
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportIndustry, setExportIndustry] = useState('All Industries');
  const [exportMinScore, setExportMinScore] = useState(0);
  const [exportHasEmail, setExportHasEmail] = useState(false);
  const [exportHasPhone, setExportHasPhone] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', sortBy, sortOrder });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.industry?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q)
    );
  });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (exportIndustry !== 'All Industries') params.set('industry', exportIndustry);
      if (exportMinScore > 0) params.set('min_score', exportMinScore.toString());
      if (exportHasEmail) params.set('has_email', 'true');
      if (exportHasPhone) params.set('has_phone', 'true');
      if (statusFilter !== 'All') params.set('status', statusFilter);

      const res = await fetch(`/api/export?${params}`);
      if (format === 'csv') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExportModalOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Leads</h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">{filtered.length} leads</p>
        </div>
        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-2 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-[hsl(215,20%,55%)] hover:text-white hover:bg-white/[0.08] transition-all"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,40%)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full h-9 pl-9 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-white focus:outline-none focus:border-blue-500/40 appearance-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_120px_100px_100px_80px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.04] text-[11px] font-semibold text-[hsl(215,16%,45%)] uppercase tracking-wider">
          <button
            onClick={() => toggleSort('company_name')}
            className="flex items-center gap-1 hover:text-white transition-colors text-left"
          >
            Company <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Industry</span>
          <span>Location</span>
          <button
            onClick={() => toggleSort('score')}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            Score <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Status</span>
          <span>Contact</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="grid grid-cols-[1fr_140px_120px_100px_100px_80px_100px] gap-2 px-4 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors items-center group"
            >
              {/* Company */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[12px] font-semibold text-white/30 shrink-0">
                  {lead.company_name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                    {lead.company_name}
                  </p>
                  {lead.website && <p className="text-[10px] text-[hsl(215,16%,35%)] truncate">{lead.website}</p>}
                </div>
              </div>

              {/* Industry */}
              <span className="text-[12px] text-[hsl(215,20%,55%)] truncate">{lead.industry || '—'}</span>

              {/* Location */}
              <span className="text-[12px] text-[hsl(215,20%,55%)] truncate">
                {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
              </span>

              {/* Score */}
              <span className={cn('text-[13px] font-semibold', getScoreColor(lead.score || 0))}>{lead.score || 0}</span>

              {/* Status */}
              <span
                className={cn(
                  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit',
                  statusColors(lead.status),
                )}
              >
                {lead.status}
              </span>

              {/* Contact */}
              <div className="flex items-center gap-1.5">
                {lead.phone && <Phone className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                {lead.email && <Mail className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                {lead.website && <Globe className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 justify-self-end" onClick={(e) => e.preventDefault()}>
                <Link
                  href={`/outreach?lead=${lead.id}&channel=cold_email`}
                  className="p-1 rounded hover:bg-blue-500/10 transition-colors"
                  title="Email outreach"
                >
                  <Mail className="w-3 h-3 text-blue-400" />
                </Link>
                <Link
                  href={`/outreach?lead=${lead.id}&channel=whatsapp`}
                  className="p-1 rounded hover:bg-green-500/10 transition-colors"
                  title="WhatsApp outreach"
                >
                  <MessageSquare className="w-3 h-3 text-green-400" />
                </Link>
                <Link
                  href={`/outreach?lead=${lead.id}&channel=linkedin`}
                  className="p-1 rounded hover:bg-blue-500/10 transition-colors"
                  title="LinkedIn outreach"
                >
                  <Link2 className="w-3 h-3 text-blue-300" />
                </Link>
                <Link
                  href={`/leads/${lead.id}`}
                  className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                  title="Open lead"
                >
                  <ExternalLink className="w-3 h-3 text-[hsl(215,16%,40%)]" />
                </Link>
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
            <p className="text-[14px] text-[hsl(215,16%,40%)]">
              {search ? 'No leads match your search' : 'No leads yet'}
            </p>
            {!search && (
              <Link href="/search" className="mt-3 text-[12px] text-blue-400 hover:text-blue-300 transition-colors">
                Run your first search →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-white">Export Leads</h2>
              <button onClick={() => setExportModalOpen(false)} className="text-[hsl(215,16%,40%)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1 block">Industry</label>
                <select value={exportIndustry} onChange={(e) => setExportIndustry(e.target.value)}
                  className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40">
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1 block">Min Score: {exportMinScore}</label>
                <input type="range" min="0" max="100" step="10" value={exportMinScore}
                  onChange={(e) => setExportMinScore(parseInt(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exportHasEmail} onChange={(e) => setExportHasEmail(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)]">Has Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={exportHasPhone} onChange={(e) => setExportHasPhone(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)]">Has Phone</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => handleExport('csv')} disabled={exporting}
                className="flex-1 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-medium transition-all">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Export CSV'}
              </button>
              <button onClick={() => handleExport('json')} disabled={exporting}
                className="flex-1 h-9 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-50 text-white rounded-lg text-[12px] font-medium transition-all border border-white/[0.06]">
                Export JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
