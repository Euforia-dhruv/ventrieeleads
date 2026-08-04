'use client';

import { useState, useEffect } from 'react';
import { Search, Sparkles, Zap, Globe, Building2, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import LocationPicker from '@/components/search/LocationPicker';
import IndustryPicker from '@/components/search/IndustryPicker';
import SearchProgress from '@/components/search/SearchProgress';
import SearchResults from '@/components/search/SearchResults';
import FilterSidebar from '@/components/search/FilterSidebar';

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
}

interface FilterState {
  country: string;
  city: string;
  industry: string;
  minRating: number;
  minWebsiteScore: number;
  minLeadScore: number;
  minOppScore: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsApp: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasFacebook: boolean;
  hasWebsite: boolean;
  noWebsite: boolean;
}

const EXAMPLES = [
  { text: 'Dentists in London', icon: '🦷' },
  { text: 'Restaurants near Berlin', icon: '🍽️' },
  { text: 'Hotels in Tokyo', icon: '🏨' },
  { text: 'Real Estate Dubai', icon: '🏢' },
  { text: 'Construction companies Toronto', icon: '🏗️' },
  { text: 'Marketing agencies New York', icon: '📈' },
  { text: 'Gyms Paris', icon: '💪' },
  { text: 'Law firms Sydney', icon: '⚖️' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<{ country?: string; state?: string; city?: string; query: string }>({ query: '' });
  const [industries, setIndustries] = useState<string[]>([]);
  const [maxResults, setMaxResults] = useState(50);
  const [minRating, setMinRating] = useState(0);

  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    country: '', city: '', industry: '',
    minRating: 0, minWebsiteScore: 0, minLeadScore: 0, minOppScore: 0,
    hasEmail: false, hasPhone: false, hasWhatsApp: false,
    hasInstagram: false, hasLinkedIn: false, hasFacebook: false,
    hasWebsite: false, noWebsite: false,
  });

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const handleSearch = async () => {
    if (!query.trim() && industries.length === 0) return;

    setSearching(true);
    setHasSearched(true);
    setProgress(0);
    setResults([]);

    const searchQuery = query || industries.join(', ');
    const fullQuery = location.query
      ? `${searchQuery} in ${location.query}`
      : searchQuery;

    // Save to recent searches
    const updated = [fullQuery, ...recentSearches.filter(s => s !== fullQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    // Simulate progress steps
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      setProgress(i);
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: fullQuery,
          country: location.country || filters.country,
          city: location.city || filters.city,
          industry: industries[0] || filters.industry,
          keyword: query,
          max_results: maxResults,
          min_rating: minRating,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const body = json.data || json;
        if (body.results) {
          setResults(body.results);
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
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/search/jobs/${jobId}`);
        if (res.ok) {
          const json = await res.json();
          const job = json.data || json;
          if (job.status === 'completed' && job.results) {
            setResults(job.results);
            return;
          }
          if (job.status === 'failed') {
            console.error('Search failed:', job.error_message);
            return;
          }
        }
      } catch (err) {
        console.error('Poll failed:', err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // Apply client-side filters
  const filteredResults = results.filter(r => {
    if (filters.country && r.country?.toLowerCase() !== filters.country.toLowerCase()) return false;
    if (filters.city && r.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.industry && !r.industry?.toLowerCase().includes(filters.industry.toLowerCase())) return false;
    if (filters.minRating && (r.rating || 0) < filters.minRating) return false;
    if (filters.minWebsiteScore && (r.website_score || 0) < filters.minWebsiteScore) return false;
    if (filters.minLeadScore && (r.lead_score || 0) < filters.minLeadScore) return false;
    if (filters.hasEmail && !r.email) return false;
    if (filters.hasPhone && !r.phone) return false;
    if (filters.hasLinkedIn && !r.social_links?.linkedin) return false;
    if (filters.hasInstagram && !r.social_links?.instagram) return false;
    if (filters.hasFacebook && !r.social_links?.facebook) return false;
    if (filters.hasWebsite && !r.website) return false;
    if (filters.noWebsite && r.website) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Search Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 pt-12 pb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Discover <span className="gradient-text">any business</span> worldwide
            </h1>
            <p className="text-lg text-slate-400">
              Find, analyze, and connect with companies anywhere in the world
            </p>
          </div>

          {/* Main Search Bar */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            {/* Query Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What are you looking for? Try &quot;Dentists in London&quot;"
                className="w-full h-14 pl-12 pr-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-lg text-xs text-slate-400">
                  <Sparkles className="w-3 h-3" />
                  AI-powered
                </span>
              </div>
            </div>

            {/* Location + Industry Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LocationPicker
                value={location.query}
                onChange={setLocation}
                placeholder="Location (optional)"
              />
              <IndustryPicker
                value={industries}
                onChange={setIndustries}
                placeholder="Industry (optional)"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={searching || (!query.trim() && industries.length === 0)}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Search Companies
                </>
              )}
            </button>
          </div>

          {/* Quick Examples */}
          {!hasSearched && (
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500 mb-3">Try these examples:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.text}
                    onClick={() => {
                      setQuery(ex.text);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                  >
                    <span>{ex.icon}</span>
                    {ex.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {!hasSearched && recentSearches.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-600 mb-2">Recent</p>
              <div className="flex flex-wrap justify-center gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => setQuery(search)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800/20 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {searching && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <SearchProgress currentStep={progress} />
        </div>
      )}

      {/* Results */}
      {hasSearched && !searching && (
        <div className="flex">
          {/* Filters */}
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen(!filtersOpen)}
          />

          {/* Results */}
          <div className="flex-1 px-4 pb-12">
            <div className="max-w-5xl mx-auto">
              <SearchResults
                results={filteredResults}
                onSelect={(company) => {
                  window.location.href = `/companies/${company.id}`;
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasSearched && !searching && (
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-xl p-6 text-center">
              <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-white font-medium mb-1">Global Coverage</h3>
              <p className="text-sm text-slate-400">Search 195+ countries and 10,000+ cities</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center">
              <Building2 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="text-white font-medium mb-1">19 Free Providers</h3>
              <p className="text-sm text-slate-400">Google Maps, Clutch, Apollo, and more</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center">
              <Sparkles className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-white font-medium mb-1">AI-Powered</h3>
              <p className="text-sm text-slate-400">Automatic scoring, audit, and outreach</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
