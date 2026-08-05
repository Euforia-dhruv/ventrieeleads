'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Users, ArrowUpRight, MapPin, Building2, Star, Phone, Mail, Globe, Filter, X, ChevronDown, ArrowUpDown, Loader2 } from 'lucide-react';
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

const STATUS_OPTIONS = ['All', 'New', 'Qualified', 'Researching', 'Contacted', 'Replied', 'Meeting', 'Proposal', 'Won', 'Lost'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, sortBy, sortOrder]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', sortBy, sortOrder });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.company_name?.toLowerCase().includes(q) ||
           l.industry?.toLowerCase().includes(q) ||
           l.city?.toLowerCase().includes(q);
  });

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
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
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_120px_100px_100px_80px_60px] gap-2 px-4 py-2.5 border-b border-white/[0.04] text-[11px] font-semibold text-[hsl(215,16%,45%)] uppercase tracking-wider">
          <button onClick={() => toggleSort('company_name')} className="flex items-center gap-1 hover:text-white transition-colors text-left">
            Company <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Industry</span>
          <span>Location</span>
          <button onClick={() => toggleSort('score')} className="flex items-center gap-1 hover:text-white transition-colors">
            Score <ArrowUpDown className="w-3 h-3" />
          </button>
          <span>Status</span>
          <span>Contact</span>
          <span></span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map(lead => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="grid grid-cols-[1fr_140px_120px_100px_100px_80px_60px] gap-2 px-4 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors items-center group"
            >
              {/* Company */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[12px] font-semibold text-white/30 shrink-0">
                  {lead.company_name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate group-hover:text-blue-400 transition-colors">{lead.company_name}</p>
                  {lead.website && <p className="text-[10px] text-[hsl(215,16%,35%)] truncate">{lead.website}</p>}
                </div>
              </div>

              {/* Industry */}
              <span className="text-[12px] text-[hsl(215,20%,55%)] truncate">{lead.industry || '—'}</span>

              {/* Location */}
              <span className="text-[12px] text-[hsl(215,20%,55%)] truncate">{[lead.city, lead.country].filter(Boolean).join(', ') || '—'}</span>

              {/* Score */}
              <span className={cn("text-[13px] font-semibold", getScoreColor(lead.score || 0))}>
                {lead.score || 0}
              </span>

              {/* Status */}
              <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit", statusColors(lead.status))}>
                {lead.status}
              </span>

              {/* Contact */}
              <div className="flex items-center gap-1.5">
                {lead.phone && <Phone className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                {lead.email && <Mail className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                {lead.website && <Globe className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
              </div>

              {/* Arrow */}
              <ArrowUpRight className="w-3.5 h-3.5 text-[hsl(215,16%,25%)] group-hover:text-white transition-colors justify-self-end" />
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
    </div>
  );
}
