'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Filter,
  X,
  Star,
  Globe,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Loader2,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';

interface Prospect {
  id: string;
  company_name: string;
  industry?: string;
  city?: string;
  country?: string;
  score: number;
  score_label?: string;
  rating?: number;
  review_count?: number;
  email?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  opportunity_score?: number;
  pain_points?: string[];
  recommended_service?: string;
}

const INDUSTRY_OPTIONS = [
  'All Industries', 'Dentists', 'Hotels', 'Restaurants', 'Construction',
  'Law Firms', 'Marketing Agencies', 'Real Estate', 'IT Companies',
  'Medical Clinics', 'Gyms', 'Car Rentals', 'Interior Designers',
];

const SCORE_RANGES = [
  { label: 'All Scores', min: 0, max: 100 },
  { label: 'Hot (70+)', min: 70, max: 100 },
  { label: 'Warm (40-69)', min: 40, max: 69 },
  { label: 'Cold (<40)', min: 0, max: 39 },
];

const SORT_OPTIONS = [
  { label: 'Score (High)', value: 'score_desc' },
  { label: 'Score (Low)', value: 'score_asc' },
  { label: 'Rating (High)', value: 'rating_desc' },
  { label: 'Reviews (Most)', value: 'reviews_desc' },
  { label: 'Name (A-Z)', value: 'name_asc' },
];

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [industry, setIndustry] = useState('All Industries');
  const [scoreRange, setScoreRange] = useState(0);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasWebsite, setHasWebsite] = useState(false);
  const [sortBy, setSortBy] = useState('score_desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads?sort=score&order=desc&limit=100');
      const data = await res.json();
      setProspects(data.data || []);
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProspects = prospects
    .filter((p) => {
      if (industry !== 'All Industries' && p.industry?.toLowerCase() !== industry.toLowerCase()) return false;
      const range = SCORE_RANGES[scoreRange];
      if (range && (p.score < range.min || p.score > range.max)) return false;
      if (hasEmail && !p.email) return false;
      if (hasPhone && !p.phone) return false;
      if (hasWebsite && !p.website) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.company_name?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.industry?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score_desc': return b.score - a.score;
        case 'score_asc': return a.score - b.score;
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'reviews_desc': return (b.review_count || 0) - (a.review_count || 0);
        case 'name_asc': return (a.company_name || '').localeCompare(b.company_name || '');
        default: return b.score - a.score;
      }
    });

  const activeFilterCount = [
    industry !== 'All Industries',
    scoreRange !== 0,
    hasEmail,
    hasPhone,
    hasWebsite,
  ].filter(Boolean).length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Best Prospects
          </h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">
            {filteredProspects.length} high-potential leads
          </p>
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            'flex items-center gap-2 h-9 px-3 rounded-lg text-[12px] font-medium transition-all border',
            filtersOpen || activeFilterCount > 0
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              : 'bg-white/[0.04] border-white/[0.06] text-[hsl(215,20%,55%)] hover:bg-white/[0.08]'
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      {filtersOpen && (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1 block">Industry</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40">
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1 block">Score Range</label>
              <select value={scoreRange} onChange={(e) => setScoreRange(parseInt(e.target.value))}
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40">
                {SCORE_RANGES.map((r, i) => (
                  <option key={i} value={i}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[hsl(215,16%,50%)] mb-1 block">Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40">
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500" />
                <span className="text-[12px] text-[hsl(215,20%,55%)]">Has Email</span>
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500" />
                <span className="text-[12px] text-[hsl(215,20%,55%)]">Has Phone</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, city, or industry..."
              className="flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40" />
            {activeFilterCount > 0 && (
              <button onClick={() => {
                setIndustry('All Industries');
                setScoreRange(0);
                setHasEmail(false);
                setHasPhone(false);
                setHasWebsite(false);
                setSearchQuery('');
              }}
                className="h-9 px-3 text-[12px] text-[hsl(215,20%,55%)] hover:text-white border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-all">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Prospects grid */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        </div>
      ) : filteredProspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Trophy className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
          <p className="text-[14px] text-[hsl(215,16%,40%)]">No prospects match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProspects.map((prospect) => (
            <Link
              key={prospect.id}
              href={`/leads/${prospect.id}`}
              className="glass-card rounded-xl p-4 hover:border-white/[0.1] transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-[14px] font-bold text-white/20 shrink-0">
                    {prospect.logo_url ? (
                      <img src={prospect.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      prospect.company_name?.charAt(0) || '?'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                      {prospect.company_name}
                    </p>
                    <p className="text-[11px] text-[hsl(215,16%,45%)] truncate">
                      {prospect.industry || 'Unknown industry'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-[18px] font-bold', getScoreColor(prospect.score))}>
                    {prospect.score}
                  </div>
                  <div className="text-[10px] text-[hsl(215,16%,40%)]">{prospect.score_label || 'score'}</div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {prospect.city && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[hsl(215,20%,45%)]">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{prospect.city}, {prospect.country}</span>
                  </div>
                )}
                {prospect.rating && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[hsl(215,20%,45%)]">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                    <span>{prospect.rating} ({prospect.review_count || 0} reviews)</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {prospect.email && <Mail className="w-3 h-3 text-green-400" />}
                  {prospect.phone && <Phone className="w-3 h-3 text-blue-400" />}
                  {prospect.website && <Globe className="w-3 h-3 text-purple-400" />}
                </div>
              </div>

              {prospect.recommended_service && (
                <div className="mt-2 pt-2 border-t border-white/[0.04]">
                  <p className="text-[10px] text-blue-400 truncate">{prospect.recommended_service}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
