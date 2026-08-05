'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Sparkles, Zap, Globe, Building2, MapPin, Star, Phone, Mail, Link2, AtSign, Share2, ExternalLink, Filter, X, ChevronDown, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import SearchMap from '@/components/search/SearchMap';
import ResultCard from '@/components/search/ResultCard';
import SearchProgress from '@/components/search/SearchProgress';

interface SearchResult {
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
  description?: string;
  social_links?: Record<string, string>;
  lead_score?: number;
  website_score?: number;
  seo_score?: number;
  design_score?: number;
  opportunity_score?: number;
  ai_recommendation?: string;
  latitude?: number;
  longitude?: number;
}

interface FilterState {
  minRating: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsApp: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasWebsite: boolean;
  noWebsite: boolean;
  minLeadScore: number;
}

const EXAMPLES = [
  'Dentists near London',
  'Hotels in Dubai Marina',
  'Construction companies in Sydney',
  'Law firms in Toronto',
  'Restaurants near Eiffel Tower',
  'Solar companies Germany',
  'Auto workshops Bangalore',
  'Marketing agencies New York',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    minRating: 0, hasEmail: false, hasPhone: false, hasWhatsApp: false,
    hasInstagram: false, hasLinkedIn: false, hasWebsite: false,
    noWebsite: false, minLeadScore: 0,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setProgress(0);
    setResults([]);
    setSelectedResult(null);

    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), max_results: 50 }),
      });

      if (res.ok) {
        const json = await res.json();
        const body = json.data || json;
        if (body.results) {
          setResults(body.results);
          setProgress(10);
        } else if (body.id) {
          await pollJobResults(body.id);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const pollJobResults = async (jobId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const res = await fetch(`/api/search/jobs/${jobId}`);
        if (res.ok) {
          const json = await res.json();
          const job = json.data || json;
          if (job.results && job.results.length > 0) {
            setResults(job.results);
            setProgress(Math.min(90, 10 + (job.progress || 0)));
          }
          if (job.status === 'completed') {
            setResults(job.results || []);
            setProgress(100);
            return;
          }
          if (job.status === 'failed') return;
        }
      } catch {}
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const filteredResults = results.filter(r => {
    if (filters.minRating && (r.rating || 0) < filters.minRating) return false;
    if (filters.hasEmail && !r.email) return false;
    if (filters.hasPhone && !r.phone) return false;
    if (filters.hasLinkedIn && !r.social_links?.linkedin) return false;
    if (filters.hasInstagram && !r.social_links?.instagram) return false;
    if (filters.hasWhatsApp && !r.social_links?.whatsapp) return false;
    if (filters.hasWebsite && !r.website) return false;
    if (filters.noWebsite && r.website) return false;
    if (filters.minLeadScore && (r.lead_score || 0) < filters.minLeadScore) return false;
    return true;
  });

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'minRating' || key === 'minLeadScore') return val > 0;
    return val === true;
  }).length;

  return (
    <div className="h-screen flex flex-col bg-[hsl(224,71%,4%)]">
      {/* Top search bar */}
      <div className="shrink-0 border-b border-white/[0.04]">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,20%,45%)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search any business... e.g. &quot;Dentists near London&quot;"
                className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="h-10 px-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-[hsl(223,47%,11%)] disabled:to-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 shrink-0"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Search
                </>
              )}
            </button>

            {/* Filters button */}
            {hasSearched && (
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`h-10 px-3 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 shrink-0 border ${
                  filtersOpen || activeFilterCount > 0
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-white/[0.03] border-white/[0.06] text-[hsl(215,20%,55%)] hover:bg-white/[0.06]'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>
            )}
          </div>

          {/* Examples row - only show when no search */}
          {!hasSearched && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] text-[hsl(215,16%,35%)] shrink-0">Try:</span>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => { setQuery(ex); }}
                  className="shrink-0 px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] rounded-md text-[12px] text-[hsl(215,20%,55%)] hover:text-white transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {!hasSearched && recentSearches.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-[hsl(215,16%,28%)] shrink-0">Recent:</span>
              {recentSearches.map(s => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); }}
                  className="text-[12px] text-[hsl(215,16%,35%)] hover:text-[hsl(215,20%,60%)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content: Map + Results */}
      {hasSearched ? (
        <div className="flex-1 flex min-h-0">
          {/* Filters panel */}
          {filtersOpen && (
            <div className="w-[260px] shrink-0 border-r border-white/[0.04] bg-[hsl(224,71%,4%)] overflow-y-auto scrollbar-thin p-4 space-y-4 animate-slide-in">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-white">Filters</h3>
                <button onClick={() => setFiltersOpen(false)} className="text-[hsl(215,16%,40%)] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rating */}
              <div>
                <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Min Rating: {filters.minRating}</label>
                <input type="range" min="0" max="5" step="0.5" value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-blue-500" />
              </div>

              {/* Lead Score */}
              <div>
                <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Min Lead Score: {filters.minLeadScore}</label>
                <input type="range" min="0" max="100" step="10" value={filters.minLeadScore}
                  onChange={(e) => setFilters({ ...filters, minLeadScore: parseInt(e.target.value) })}
                  className="w-full mt-1 accent-blue-500" />
              </div>

              {/* Contact toggles */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Contact Info</p>
                {[
                  { key: 'hasEmail' as const, label: 'Has Email', icon: Mail },
                  { key: 'hasPhone' as const, label: 'Has Phone', icon: Phone },
                  { key: 'hasWhatsApp' as const, label: 'Has WhatsApp', icon: AtSign },
                  { key: 'hasInstagram' as const, label: 'Has Instagram', icon: AtSign },
                  { key: 'hasLinkedIn' as const, label: 'Has LinkedIn', icon: Link2 },
                ].map(({ key, label, icon: Icon }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                    <input
                      type="checkbox"
                      checked={filters[key]}
                      onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20"
                    />
                    <Icon className="w-3.5 h-3.5 text-[hsl(215,16%,40%)] group-hover:text-[hsl(215,20%,60%)]" />
                    <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">{label}</span>
                  </label>
                ))}
              </div>

              {/* Website */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Website</p>
                <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                  <input type="checkbox" checked={filters.hasWebsite}
                    onChange={(e) => setFilters({ ...filters, hasWebsite: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">Has website</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                  <input type="checkbox" checked={filters.noWebsite}
                    onChange={(e) => setFilters({ ...filters, noWebsite: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">No website (needs one)</span>
                </label>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ minRating: 0, hasEmail: false, hasPhone: false, hasWhatsApp: false, hasInstagram: false, hasLinkedIn: false, hasWebsite: false, noWebsite: false, minLeadScore: 0 })}
                  className="w-full py-2 text-[12px] text-[hsl(215,20%,55%)] hover:text-white border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-all"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            <SearchMap
              results={filteredResults}
              selectedResult={selectedResult}
              onSelectResult={setSelectedResult}
            />

            {/* Progress overlay */}
            {searching && (
              <div className="absolute top-4 left-4 right-4 z-10">
                <SearchProgress currentStep={progress} />
              </div>
            )}
          </div>

          {/* Results panel */}
          <div className="w-[400px] shrink-0 border-l border-white/[0.04] bg-[hsl(224,71%,4%)] overflow-y-auto scrollbar-thin">
            {filteredResults.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/[0.04] bg-[hsl(224,71%,4%)]/95 backdrop-blur-sm">
                  <p className="text-[13px] text-[hsl(215,20%,60%)]">
                    <span className="text-white font-semibold">{filteredResults.length}</span> companies found
                  </p>
                </div>
                <div className="p-3 space-y-2">
                  {filteredResults.map(company => (
                    <ResultCard
                      key={company.id}
                      company={company}
                      isSelected={selectedResult?.id === company.id}
                      onSelect={setSelectedResult}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center px-8">
                <div>
                  <Building2 className="w-10 h-10 text-[hsl(215,16%,25%)] mx-auto mb-3" />
                  <p className="text-[14px] text-[hsl(215,16%,40%)]">
                    {searching ? 'Searching for companies...' : 'No results match your filters'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Landing / empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-lg text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Globe className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Find any business <span className="gradient-text">worldwide</span>
            </h2>
            <p className="text-[14px] text-[hsl(215,20%,50%)] mb-6">
              Search 195+ countries. Discover companies, enrich data with AI, and generate leads — all in one place.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="glass-card rounded-xl p-4">
                <Globe className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <p className="text-[12px] text-[hsl(215,20%,55%)]">195+ Countries</p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <Zap className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                <p className="text-[12px] text-[hsl(215,20%,55%)]">19 Free Providers</p>
              </div>
              <div className="glass-card rounded-xl p-4">
                <Sparkles className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="text-[12px] text-[hsl(215,20%,55%)]">AI Scoring</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
