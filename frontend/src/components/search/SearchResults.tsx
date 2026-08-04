'use client';

import { useState } from 'react';
import { ExternalLink, Star, Phone, Mail, Globe, Link2, AtSign, Share2, MapPin, Users, TrendingUp, Eye, Grid3X3, List, ChevronDown, ChevronUp, Building2 } from 'lucide-react';

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
  description?: string;
  social_links?: Record<string, string>;
  source?: string;
  website_score?: number;
  seo_score?: number;
  design_score?: number;
  lead_score?: number;
  opportunity_score?: number;
  ai_recommendation?: string;
  latitude?: number;
  longitude?: number;
}

interface SearchResultsProps {
  results: Company[];
  loading?: boolean;
  onSelect?: (company: Company) => void;
  onEnrich?: (company: Company) => void;
}

type ViewMode = 'list' | 'grid' | 'map';

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-300 w-8 text-right">{score}</span>
    </div>
  );
}

function CompanyCard({ company, onSelect, onEnrich }: { company: Company; onSelect?: (c: Company) => void; onEnrich?: (c: Company) => void }) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Hot';
    if (score >= 40) return 'Warm';
    return 'Cold';
  };

  return (
    <div className="glass-card rounded-xl p-4 hover:border-blue-500/20 transition-all group">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center shrink-0 overflow-hidden">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-6 h-6 text-slate-500" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium truncate">{company.name}</h3>
            {company.lead_score !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                company.lead_score >= 70 ? 'bg-green-500/20 text-green-400' :
                company.lead_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {getScoreLabel(company.lead_score)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-400 mb-2">
            {company.industry && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {company.industry}
              </span>
            )}
            {(company.city || company.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {[company.city, company.country].filter(Boolean).join(', ')}
              </span>
            )}
            {company.rating !== undefined && company.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {company.rating}
                {company.review_count !== undefined && (
                  <span className="text-slate-500">({company.review_count})</span>
                )}
              </span>
            )}
          </div>

          {/* Quick Contact */}
          <div className="flex items-center gap-3">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Globe className="w-3 h-3" />
                Website
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                <Mail className="w-3 h-3" />
                {company.email}
              </a>
            )}
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                <Phone className="w-3 h-3" />
                {company.phone}
              </a>
            )}
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2 mt-2">
            {company.social_links?.linkedin && (
              <a href={company.social_links.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors">
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
              </a>
            )}
            {company.social_links?.instagram && (
              <a href={company.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors">
                <AtSign className="w-3.5 h-3.5 text-pink-400" />
              </a>
            )}
            {company.social_links?.facebook && (
              <a href={company.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors">
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
              </a>
            )}
          </div>
        </div>

        {/* Scores */}
        <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
          {company.lead_score !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Lead</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${getScoreColor(company.lead_score)} rounded-full`} style={{ width: `${company.lead_score}%` }} />
              </div>
              <span className="text-xs text-white w-6 text-right">{company.lead_score}</span>
            </div>
          )}
          {company.website_score !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Web</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${getScoreColor(company.website_score)} rounded-full`} style={{ width: `${company.website_score}%` }} />
              </div>
              <span className="text-xs text-white w-6 text-right">{company.website_score}</span>
            </div>
          )}
          {company.seo_score !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">SEO</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${getScoreColor(company.seo_score)} rounded-full`} style={{ width: `${company.seo_score}%` }} />
              </div>
              <span className="text-xs text-white w-6 text-right">{company.seo_score}</span>
            </div>
          )}
          {company.opportunity_score !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Opp</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${getScoreColor(company.opportunity_score)} rounded-full`} style={{ width: `${company.opportunity_score}%` }} />
              </div>
              <span className="text-xs text-white w-6 text-right">{company.opportunity_score}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Less details' : 'More details'}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-3">
          {company.description && (
            <p className="text-sm text-slate-400 line-clamp-3">{company.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {company.lead_score !== undefined && (
              <ScoreBar label="Lead" score={company.lead_score} color={getScoreColor(company.lead_score)} />
            )}
            {company.website_score !== undefined && (
              <ScoreBar label="Website" score={company.website_score} color={getScoreColor(company.website_score)} />
            )}
            {company.seo_score !== undefined && (
              <ScoreBar label="SEO" score={company.seo_score} color={getScoreColor(company.seo_score)} />
            )}
            {company.design_score !== undefined && (
              <ScoreBar label="Design" score={company.design_score} color={getScoreColor(company.design_score)} />
            )}
            {company.opportunity_score !== undefined && (
              <ScoreBar label="Opportunity" score={company.opportunity_score} color={getScoreColor(company.opportunity_score)} />
            )}
          </div>

          {company.ai_recommendation && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-xs font-medium text-purple-400 mb-1">AI Recommendation</p>
              <p className="text-sm text-slate-300">{company.ai_recommendation}</p>
            </div>
          )}

          <div className="flex gap-2">
            {onSelect && (
              <button onClick={() => onSelect(company)} className="flex-1 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-lg text-sm transition-colors">
                View Details
              </button>
            )}
            {onEnrich && (
              <button onClick={() => onEnrich(company)} className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-colors">
                Enrich Data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchResults({ results, loading, onSelect, onEnrich }: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<string>('lead_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
                <div className="h-3 bg-slate-800 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">No companies found</h3>
        <p className="text-sm text-slate-500">Try a different search query or location</p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => {
    const aVal = (a as any)[sortField] || 0;
    const bVal = (b as any)[sortField] || 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">
          {results.length} companies found
        </p>
        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="h-8 px-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="lead_score">Lead Score</option>
            <option value="website_score">Website Score</option>
            <option value="seo_score">SEO Score</option>
            <option value="opportunity_score">Opportunity</option>
            <option value="rating">Rating</option>
            <option value="review_count">Reviews</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            className="h-8 px-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
          <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {sorted.map((company) => (
            <CompanyCard key={company.id} company={company} onSelect={onSelect} onEnrich={onEnrich} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((company) => (
            <CompanyCard key={company.id} company={company} onSelect={onSelect} onEnrich={onEnrich} />
          ))}
        </div>
      )}
    </div>
  );
}
