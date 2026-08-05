'use client';

import { Star, Phone, Mail, Globe, Link2, AtSign, Share2, ExternalLink, MapPin, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
  lead_score?: number;
  website_score?: number;
  seo_score?: number;
  design_score?: number;
  opportunity_score?: number;
  ai_recommendation?: string;
}

interface ResultCardProps {
  company: Company;
  isSelected: boolean;
  onSelect: (company: Company) => void;
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number) {
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[hsl(215,16%,45%)] w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${getScoreBarColor(score)} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-[10px] font-medium w-6 text-right", getScoreColor(score))}>{score}</span>
    </div>
  );
}

export default function ResultCard({ company, isSelected, onSelect }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = company.lead_score || 0;

  return (
    <div
      onClick={() => onSelect(company)}
      className={cn(
        "rounded-lg p-3 cursor-pointer transition-all duration-150",
        isSelected
          ? "bg-blue-500/10 border border-blue-500/20"
          : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 overflow-hidden">
          {company.logo_url ? (
            <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[14px] font-semibold text-white/30">{company.name.charAt(0)}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[13px] font-semibold text-white truncate">{company.name}</h3>
            {score > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0",
                score >= 70 ? "bg-green-500/15 text-green-400" :
                score >= 40 ? "bg-yellow-500/15 text-yellow-400" :
                "bg-red-500/15 text-red-400"
              )}>
                {getScoreLabel(score)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[hsl(215,16%,45%)]">
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
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {company.rating}
                {company.review_count !== undefined && (
                  <span className="text-[hsl(215,16%,35%)]">({company.review_count})</span>
                )}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 mt-1.5">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors">
                <Globe className="w-3 h-3" />
                Website
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-white/[0.04] rounded text-[10px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-colors">
                <Mail className="w-3 h-3" />
                Email
              </a>
            )}
            {company.phone && (
              <a href={`tel:${company.phone}`} onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-white/[0.04] rounded text-[10px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-colors">
                <Phone className="w-3 h-3" />
                Call
              </a>
            )}
            {company.social_links?.linkedin && (
              <a href={company.social_links.linkedin} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="p-1 bg-white/[0.04] rounded hover:bg-white/[0.08] transition-colors">
                <Link2 className="w-3 h-3 text-blue-400" />
              </a>
            )}
            {company.social_links?.instagram && (
              <a href={company.social_links.instagram} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="p-1 bg-white/[0.04] rounded hover:bg-white/[0.08] transition-colors">
                <AtSign className="w-3 h-3 text-pink-400" />
              </a>
            )}
            {company.social_links?.facebook && (
              <a href={company.social_links.facebook} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="p-1 bg-white/[0.04] rounded hover:bg-white/[0.08] transition-colors">
                <Share2 className="w-3 h-3 text-blue-400" />
              </a>
            )}
          </div>
        </div>

        {/* Score column */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {company.lead_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[hsl(215,16%,40%)]">Lead</span>
              <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${getScoreBarColor(company.lead_score)} rounded-full`} style={{ width: `${company.lead_score}%` }} />
              </div>
              <span className={cn("text-[10px] font-medium w-5 text-right", getScoreColor(company.lead_score))}>{company.lead_score}</span>
            </div>
          )}
          {company.website_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[hsl(215,16%,40%)]">Web</span>
              <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${getScoreBarColor(company.website_score)} rounded-full`} style={{ width: `${company.website_score}%` }} />
              </div>
              <span className={cn("text-[10px] font-medium w-5 text-right", getScoreColor(company.website_score))}>{company.website_score}</span>
            </div>
          )}
          {company.seo_score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[hsl(215,16%,40%)]">SEO</span>
              <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${getScoreBarColor(company.seo_score)} rounded-full`} style={{ width: `${company.seo_score}%` }} />
              </div>
              <span className={cn("text-[10px] font-medium w-5 text-right", getScoreColor(company.seo_score))}>{company.seo_score}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable details */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-center gap-1 text-[10px] text-[hsl(215,16%,35%)] hover:text-[hsl(215,20%,60%)] transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Less' : 'More'}
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-2 animate-fade-in">
          {company.description && (
            <p className="text-[11px] text-[hsl(215,20%,55%)] line-clamp-2">{company.description}</p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {company.lead_score !== undefined && <ScoreBar label="Lead" score={company.lead_score} />}
            {company.website_score !== undefined && <ScoreBar label="Website" score={company.website_score} />}
            {company.seo_score !== undefined && <ScoreBar label="SEO" score={company.seo_score} />}
            {company.opportunity_score !== undefined && <ScoreBar label="Opportunity" score={company.opportunity_score} />}
          </div>
          {company.ai_recommendation && (
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-[10px] font-medium text-purple-400 mb-0.5">AI Analysis</p>
              <p className="text-[11px] text-[hsl(215,20%,60%)]">{company.ai_recommendation}</p>
            </div>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
              <Globe className="w-3 h-3" />
              Visit website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
