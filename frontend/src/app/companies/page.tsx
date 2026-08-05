'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Building2, Globe, MapPin, Star, Phone, Mail, ExternalLink, ArrowUpRight, Loader2 } from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  industry?: string;
  city?: string;
  country?: string;
  rating?: number;
  review_count?: number;
  logo_url?: string;
  lead_score?: number;
  website_score?: number;
  seo_score?: number;
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads?limit=100&sortBy=created_at&sortOrder=DESC');
      const data = await res.json();
      setCompanies(data.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const filtered = companies.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) ||
           c.industry?.toLowerCase().includes(q) ||
           c.city?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Companies</h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">{filtered.length} companies discovered</p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg text-[13px] font-medium transition-all"
        >
          <Search className="w-4 h-4" />
          Find Companies
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,40%)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="w-full h-9 pl-9 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((company, i) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="glass-card rounded-xl p-4 hover:border-blue-500/20 transition-all group animate-fade-in"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0 overflow-hidden">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[16px] font-bold text-white/20">{company.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[14px] font-semibold text-white truncate group-hover:text-blue-400 transition-colors">{company.name}</h3>
                    {company.lead_score !== undefined && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0",
                        company.lead_score >= 70 ? "bg-green-500/15 text-green-400" :
                        company.lead_score >= 40 ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-red-500/15 text-red-400"
                      )}>
                        {company.lead_score >= 70 ? 'Hot' : company.lead_score >= 40 ? 'Warm' : 'Cold'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[hsl(215,16%,45%)]">
                    {company.industry && (
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{company.industry}</span>
                    )}
                    {(company.city || company.country) && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[company.city, company.country].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                {company.lead_score !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(215,16%,40%)]">Lead</span>
                    <div className="w-14 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", company.lead_score >= 70 ? 'bg-green-500' : company.lead_score >= 40 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${company.lead_score}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-medium", getScoreColor(company.lead_score))}>{company.lead_score}</span>
                  </div>
                )}
                {company.website_score !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(215,16%,40%)]">Web</span>
                    <div className="w-14 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", company.website_score >= 70 ? 'bg-green-500' : company.website_score >= 40 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${company.website_score}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-medium", getScoreColor(company.website_score))}>{company.website_score}</span>
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="flex items-center gap-2 mt-2">
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-md text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <Globe className="w-3 h-3" />Website
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] rounded-md text-[10px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-colors">
                    <Mail className="w-3 h-3" />Email
                  </a>
                )}
                {company.phone && (
                  <a href={`tel:${company.phone}`} onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] rounded-md text-[10px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-colors">
                    <Phone className="w-3 h-3" />Call
                  </a>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
          <p className="text-[14px] text-[hsl(215,16%,40%)]">
            {search ? 'No companies match your search' : 'No companies yet'}
          </p>
          {!search && (
            <Link href="/search" className="mt-3 text-[12px] text-blue-400 hover:text-blue-300 transition-colors">
              Discover companies →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
