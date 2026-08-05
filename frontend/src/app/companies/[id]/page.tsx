'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Phone, Mail, MapPin, Star, Building2, ExternalLink, Link2, AtSign, Share2, Loader2, TrendingUp, BarChart3, Shield, Users, Cpu, Eye } from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[hsl(215,16%,50%)] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-[11px] font-medium w-8 text-right", getScoreColor(score))}>{score}</span>
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/companies/${id}`).then(r => r.json()).then(d => {
      setCompany(d.data || d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );

  if (!company) return (
    <div className="p-6 text-center text-[hsl(215,16%,40%)]">Company not found</div>
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/companies" className="p-2 hover:bg-white/[0.04] rounded-lg transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center overflow-hidden">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-6 h-6 text-white/20" />
              )}
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-white">{company.name}</h1>
              <div className="flex items-center gap-3 text-[12px] text-[hsl(215,16%,50%)]">
                {company.industry && <span>{company.industry}</span>}
                {(company.city || company.country) && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[company.city, company.country].filter(Boolean).join(', ')}</span>
                )}
                {company.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    {company.rating} ({company.review_count} reviews)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[12px] text-blue-400 hover:bg-blue-500/20 transition-all">
              <Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {company.google_maps_url && (
            <a href={company.google_maps_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-[hsl(215,20%,60%)] hover:bg-white/[0.08] transition-all">
              <MapPin className="w-3.5 h-3.5" /> Maps
            </a>
          )}
        </div>
      </div>

      {/* Scores */}
      {(company.lead_score !== undefined || company.website_score !== undefined) && (
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-white mb-4">Scores</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {company.lead_score !== undefined && (
              <div className="text-center p-3 bg-white/[0.02] rounded-lg">
                <div className={cn("text-[24px] font-bold", getScoreColor(company.lead_score))}>{company.lead_score}</div>
                <div className="text-[11px] text-[hsl(215,16%,50%)]">Lead Score</div>
              </div>
            )}
            {company.website_score !== undefined && (
              <div className="text-center p-3 bg-white/[0.02] rounded-lg">
                <div className={cn("text-[24px] font-bold", getScoreColor(company.website_score))}>{company.website_score}</div>
                <div className="text-[11px] text-[hsl(215,16%,50%)]">Website Score</div>
              </div>
            )}
            {company.seo_score !== undefined && (
              <div className="text-center p-3 bg-white/[0.02] rounded-lg">
                <div className={cn("text-[24px] font-bold", getScoreColor(company.seo_score))}>{company.seo_score}</div>
                <div className="text-[11px] text-[hsl(215,16%,50%)]">SEO Score</div>
              </div>
            )}
            {company.opportunity_score !== undefined && (
              <div className="text-center p-3 bg-white/[0.02] rounded-lg">
                <div className={cn("text-[24px] font-bold", getScoreColor(company.opportunity_score))}>{company.opportunity_score}</div>
                <div className="text-[11px] text-[hsl(215,16%,50%)]">Opportunity</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-3">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[12px] text-blue-400 hover:text-blue-300 transition-colors">
                    <Globe className="w-3.5 h-3.5" /> {company.website}
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`}
                    className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,60%)] hover:text-white transition-colors">
                    <Mail className="w-3.5 h-3.5" /> {company.email}
                  </a>
                )}
                {company.phone && (
                  <a href={`tel:${company.phone}`}
                    className="flex items-center gap-2 text-[12px] text-[hsl(215,20%,60%)] hover:text-white transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {company.phone}
                  </a>
                )}
              </div>
              <div className="space-y-2">
                {company.address && (
                  <p className="flex items-start gap-2 text-[12px] text-[hsl(215,20%,55%)]">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {company.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Social */}
          {(company.social_links?.linkedin || company.social_links?.instagram || company.social_links?.facebook) && (
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Social Links</h2>
              <div className="flex items-center gap-2">
                {company.social_links?.linkedin && (
                  <a href={company.social_links.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <Link2 className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                {company.social_links?.instagram && (
                  <a href={company.social_links.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 rounded-lg text-[12px] text-pink-400 hover:bg-pink-500/20 transition-colors">
                    <AtSign className="w-3.5 h-3.5" /> Instagram
                  </a>
                )}
                {company.social_links?.facebook && (
                  <a href={company.social_links.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 rounded-lg text-[12px] text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <Share2 className="w-3.5 h-3.5" /> Facebook
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {company.description && (
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">About</h2>
              <p className="text-[13px] text-[hsl(215,20%,55%)] leading-relaxed">{company.description}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-3">Details</h2>
            <div className="space-y-3 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[hsl(215,16%,50%)]">Industry</span>
                <span className="text-white">{company.industry || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(215,16%,50%)]">Location</span>
                <span className="text-white">{[company.city, company.country].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(215,16%,50%)]">Rating</span>
                <span className="text-white">{company.rating || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(215,16%,50%)]">Reviews</span>
                <span className="text-white">{company.review_count || '—'}</span>
              </div>
            </div>
          </div>

          {/* Technologies */}
          {company.technologies?.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white mb-3">Technologies</h2>
              <div className="flex flex-wrap gap-1.5">
                {company.technologies.map((t: any, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-[hsl(215,20%,60%)]">
                    {t.name || t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
