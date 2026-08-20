'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Zap, Globe, Building2, Phone, Mail, Link2, Filter, X, Loader2, AlertCircle, MapPin, Star } from 'lucide-react';
import SearchMap, { type SearchArea } from '@/components/search/SearchMap';
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
  temperature: 'all' | 'hot' | 'warm' | 'cold';
  hasWebsite: boolean;
  noWebsite: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasSocial: boolean;
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

const LEAD_COUNTS = [10, 25, 50, 100, 250, 500];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [searchError, setSearchError] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [customCount, setCustomCount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'reviews' | 'newest'>('score');
  const [filters, setFilters] = useState<FilterState>({
    temperature: 'all',
    hasWebsite: false,
    noWebsite: false,
    hasEmail: false,
    hasPhone: false,
    hasSocial: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedResult?.id) return;
    const el = cardRefs.current[selectedResult.id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedResult?.id]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.metaKey || e.ctrlKey) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const effectiveMaxResults = showCustomInput ? (parseInt(customCount) || 50) : maxResults;

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    setProgress(0);
    setResults([]);
    setSelectedResult(null);
    setSearchError('');
    setProgressMessage('Connecting to search service...');

    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          max_results: effectiveMaxResults,
          ...(searchArea
            ? {
                lat: searchArea.lat,
                lng: searchArea.lng,
                radius_km: Math.round(searchArea.radiusKm),
                search_area: { lat: searchArea.lat, lng: searchArea.lng, radius_km: searchArea.radiusKm },
              }
            : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.message || `Search failed (${res.status})`);
        return;
      }
      const body = json.data || json;
      if (body.results) {
        setResults(body.results);
        setProgress(10);
      } else if (body.id) {
        await pollJobResults(body.id);
      } else {
        setSearchError('Unexpected response from search service.');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Network error — the backend may be starting up. Try again in 30 seconds.');
    } finally {
      setSearching(false);
    }
  };

  const pollJobResults = async (jobId: string) => {
    let consecutiveErrors = 0;
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/search/jobs/${jobId}`);
        consecutiveErrors = 0;
        if (res.ok) {
          const json = await res.json();
          const job = json.data || json;
          if (job.results && job.results.length > 0) {
            setResults(job.results);
          }
          const msg = job.metadata?.progress_message || '';
          if (msg) setProgressMessage(msg);

          const stage = job.progress_stage || 'queued';
          const discovered = job.discovered_count || 0;
          const processed = job.processed_count || 0;
          const requested = job.requested_count || job.max_results || 50;

          let pct = job.progress || 0;
          if (stage === 'parsing') pct = Math.max(pct, 5);
          else if (stage === 'searching') pct = Math.max(pct, 10);
          else if (stage === 'discovering') pct = Math.max(pct, 20 + Math.min(20, (discovered / Math.max(1, requested)) * 20));
          else if (stage === 'enriching') pct = Math.max(pct, 45 + Math.min(15, (processed / Math.max(1, discovered)) * 15));
          else if (stage === 'auditing') pct = Math.max(pct, 65 + Math.min(15, (processed / Math.max(1, discovered)) * 15));
          else if (stage === 'completed') pct = 100;
          else if (stage === 'failed') pct = 100;

          setProgress(Math.min(95, pct));

          if (job.status === 'completed') {
            setResults(job.results || []);
            setProgress(100);
            const stats = job.metadata?.stats;
            if (stats) {
              setProgressMessage(`Done! ${stats.new_companies} new leads from ${stats.total_results} found (${stats.duplicates} duplicates skipped)`);
            } else {
              setProgressMessage(`Done! ${job.results?.length || 0} companies found.`);
            }
            return;
          }
          if (job.status === 'failed') {
            setProgressMessage(`Search failed: ${job.error_message || 'Unknown error'}`);
            return;
          }
        } else if (res.status === 404) {
          setProgressMessage('Job not found — it may still be starting up...');
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          setSearchError('Lost connection to the server. The search may still be running — try refreshing.');
          return;
        }
      }
    }
    setSearchError('Search timed out. Try a smaller result count or different query.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const filteredResults = results.filter((r) => {
    if (filters.temperature !== 'all') {
      const score = r.lead_score || 0;
      if (filters.temperature === 'hot' && score < 80) return false;
      if (filters.temperature === 'warm' && (score < 60 || score >= 80)) return false;
      if (filters.temperature === 'cold' && score >= 60) return false;
    }
    if (filters.hasWebsite && !r.website) return false;
    if (filters.noWebsite && r.website) return false;
    if (filters.hasEmail && !r.email) return false;
    if (filters.hasPhone && !r.phone) return false;
    if (filters.hasSocial && !r.social_links?.linkedin && !r.social_links?.instagram && !r.social_links?.facebook) return false;
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
    return 0;
  });

  const activeFilterCount = (filters.temperature !== 'all' ? 1 : 0) +
    (filters.hasWebsite ? 1 : 0) + (filters.noWebsite ? 1 : 0) +
    (filters.hasEmail ? 1 : 0) + (filters.hasPhone ? 1 : 0) + (filters.hasSocial ? 1 : 0);

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
                aria-label="Search for a business"
                placeholder='What are you looking for? e.g. "dentists in London"'
                className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[14px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              aria-label="Find leads"
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
                  Find Leads
                </>
              )}
            </button>

            {/* Filters button */}
            {hasSearched && (
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                aria-label="Toggle filters"
                aria-expanded={filtersOpen}
                className={`h-10 px-3 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 shrink-0 border ${
                  filtersOpen || activeFilterCount > 0
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-white/[0.03] border-white/[0.06] text-[hsl(215,20%,55%)] hover:bg-white/[0.06]'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Lead count presets */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-[hsl(215,16%,35%)] shrink-0">How many?</span>
            {LEAD_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => { setMaxResults(n); setShowCustomInput(false); }}
                className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all border ${
                  !showCustomInput && maxResults === n
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-white/[0.02] border-white/[0.04] text-[hsl(215,16%,40%)] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all border ${
                showCustomInput
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-white/[0.02] border-white/[0.04] text-[hsl(215,16%,40%)] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              Custom
            </button>
            {showCustomInput && (
              <input
                type="number"
                min="1"
                max="1000"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder="1-1000"
                className="h-7 w-20 px-2 bg-white/[0.04] border border-white/[0.06] rounded-md text-[11px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40"
              />
            )}
          </div>

          {/* Examples row - only show when no search */}
          {!hasSearched && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto scrollbar-thin pb-1">
              <span className="text-[11px] text-[hsl(215,16%,35%)] shrink-0">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
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
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
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
                <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="text-[hsl(215,16%,40%)] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Temperature */}
              <div>
                <p className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider mb-2">Lead Temperature</p>
                <div className="flex gap-1">
                  {[
                    { value: 'all' as const, label: 'All', color: '' },
                    { value: 'hot' as const, label: 'HOT', color: 'bg-green-500/15 text-green-400 border-green-500/20' },
                    { value: 'warm' as const, label: 'WARM', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
                    { value: 'cold' as const, label: 'COLD', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
                  ].map(({ value, label, color }) => (
                    <button
                      key={value}
                      onClick={() => setFilters({ ...filters, temperature: value })}
                      className={`flex-1 h-7 rounded-md text-[11px] font-medium transition-all border ${
                        filters.temperature === value
                          ? value === 'all' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : color
                          : 'bg-white/[0.02] border-white/[0.04] text-[hsl(215,16%,40%)] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Website */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Website</p>
                <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                  <input type="checkbox" checked={filters.hasWebsite} onChange={(e) => setFilters({ ...filters, hasWebsite: e.target.checked })} className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">Has website</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                  <input type="checkbox" checked={filters.noWebsite} onChange={(e) => setFilters({ ...filters, noWebsite: e.target.checked })} className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20" />
                  <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">No website (needs one)</span>
                </label>
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Contact Info</p>
                {[
                  { key: 'hasEmail' as const, label: 'Has Email', icon: Mail },
                  { key: 'hasPhone' as const, label: 'Has Phone', icon: Phone },
                  { key: 'hasSocial' as const, label: 'Has Social', icon: Link2 },
                ].map(({ key, label, icon: Icon }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                    <input type="checkbox" checked={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })} className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500 focus:ring-blue-500/20" />
                    <Icon className="w-3.5 h-3.5 text-[hsl(215,16%,40%)] group-hover:text-[hsl(215,20%,60%)]" />
                    <span className="text-[12px] text-[hsl(215,20%,55%)] group-hover:text-white">{label}</span>
                  </label>
                ))}
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ temperature: 'all', hasWebsite: false, noWebsite: false, hasEmail: false, hasPhone: false, hasSocial: false })}
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
              results={sortedResults}
              selectedResult={selectedResult}
              hoveredId={hoveredId}
              onSelectResult={setSelectedResult}
              area={searchArea}
              onAreaSelected={setSearchArea}
              onClearArea={() => setSearchArea(null)}
            />

            {searchArea && (
              <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-lg text-[11px] text-white bg-blue-600/90 border border-blue-400/30 backdrop-blur">
                <MapPin className="w-3 h-3 inline mr-1" />
                Searching within {Math.max(1, Math.round(searchArea.radiusKm))} km
              </div>
            )}

            {searching && (
              <div className="absolute top-4 left-4 right-4 z-10">
                <SearchProgress currentStep={progress} message={progressMessage} />
              </div>
            )}

            {searchError && !searching && (
              <div className="absolute top-4 left-4 right-4 z-10 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-[12px] text-red-300">{searchError}</span>
                  <button onClick={() => setSearchError('')} className="ml-auto text-red-400 hover:text-red-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results panel */}
          <div className="w-[400px] shrink-0 border-l border-white/[0.04] bg-[hsl(224,71%,4%)] overflow-y-auto scrollbar-thin">
            {sortedResults.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/[0.04] bg-[hsl(224,71%,4%)]/95 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-[hsl(215,20%,60%)]">
                      <span className="text-white font-semibold">{sortedResults.length}</span> leads
                    </p>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="h-7 px-2 bg-white/[0.04] border border-white/[0.06] rounded text-[11px] text-[hsl(215,20%,60%)] focus:outline-none focus:border-blue-500/40"
                    >
                      <option value="score">Lead Score</option>
                      <option value="rating">Rating</option>
                      <option value="reviews">Reviews</option>
                    </select>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {sortedResults.map((company) => (
                    <div
                      key={company.id}
                      ref={(el) => { cardRefs.current[company.id] = el; }}
                    >
                      <ResultCard
                        company={company}
                        isSelected={selectedResult?.id === company.id}
                        onSelect={setSelectedResult}
                        onHover={setHoveredId}
                      />
                    </div>
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
                <Star className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="text-[12px] text-[hsl(215,20%,55%)]">AI Scoring</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
