'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, Mail, Phone, Globe, ExternalLink, ChevronLeft, ChevronRight, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { statusColors, getScoreColor, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Filters {
  status: string; city: string; industry: string; search: string;
  minScore: string; maxScore: string; sortBy: string; sortOrder: string;
  hasWebsite: string; hasEmail: string; hasPhone: string; hasWhatsApp: string;
  hasInstagram: string; hasFacebook: string; hasLinkedIn: string;
  technology: string; minWebsiteScore: string; maxWebsiteScore: string;
  minSeoScore: string; minPerformanceScore: string;
  noSSL: string; noWhatsApp: string; noBooking: string;
  slowWebsite: string; noAnalytics: string; noMetaPixel: string;
  noContactForm: string; lowSEO: string; priority: string;
}

const defaultFilters: Filters = {
  status: '', city: '', industry: '', search: '',
  minScore: '', maxScore: '', sortBy: 'created_at', sortOrder: 'DESC',
  hasWebsite: '', hasEmail: '', hasPhone: '', hasWhatsApp: '',
  hasInstagram: '', hasFacebook: '', hasLinkedIn: '',
  technology: '', minWebsiteScore: '', maxWebsiteScore: '',
  minSeoScore: '', minPerformanceScore: '',
  noSSL: '', noWhatsApp: '', noBooking: '',
  slowWebsite: '', noAnalytics: '', noMetaPixel: '',
  noContactForm: '', lowSEO: '', priority: '',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', '20');
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    const count = Object.entries(filters).filter(([k, v]) => v && k !== 'sortBy' && k !== 'sortOrder').length;
    setActiveFilterCount(count);
  }, [filters]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const handleExport = async (format: string) => {
    const params = new URLSearchParams({ format });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`/api/export/leads?${params.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads.${format}`; a.click();
  };

  const boolFilter = (label: string, key: keyof Filters) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs">{label}</span>
      <div className="flex gap-1">
        <button onClick={() => updateFilter(key, filters[key] === 'true' ? '' : 'true')}
          className={cn('px-2 py-0.5 text-xs rounded', filters[key] === 'true' ? 'bg-green-500/20 text-green-500' : 'bg-secondary text-muted-foreground')}>
          Yes
        </button>
        <button onClick={() => updateFilter(key, filters[key] === 'false' ? '' : 'false')}
          className={cn('px-2 py-0.5 text-xs rounded', filters[key] === 'false' ? 'bg-red-500/20 text-red-500' : 'bg-secondary text-muted-foreground')}>
          No
        </button>
      </div>
    </div>
  );

  const [filterSection, setFilterSection] = useState({ contact: true, tech: true, opportunity: true });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">{total} leads found</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />Filters
            {activeFilterCount > 0 && <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">{activeFilterCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}><Download className="h-4 w-4 mr-2" />JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('markdown')}><Download className="h-4 w-4 mr-2" />MD</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, website, or industry..." value={filters.search}
          onChange={e => updateFilter('search', e.target.value)} className="pl-10" />
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Smart Filters</span>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-3 w-3 mr-1" />Clear All</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs mt-1">
                      <option value="">All</option>
                      {['New','Qualified','Researching','Contacted','Replied','Meeting','Proposal','Negotiation','Won','Lost'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">City</label>
                    <select value={filters.city} onChange={e => updateFilter('city', e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs mt-1">
                      <option value="">All</option>{['Dubai','Abu Dhabi','Sharjah'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Industry</label>
                    <Input value={filters.industry} onChange={e => updateFilter('industry', e.target.value)} placeholder="Any" className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <select value={filters.priority} onChange={e => updateFilter('priority', e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs mt-1">
                      <option value="">All</option>
                      {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Min Score</label>
                    <Input type="number" value={filters.minScore} onChange={e => updateFilter('minScore', e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Max Score</label>
                    <Input type="number" value={filters.maxScore} onChange={e => updateFilter('maxScore', e.target.value)} className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Technology</label>
                    <Input value={filters.technology} onChange={e => updateFilter('technology', e.target.value)} placeholder="e.g. WordPress" className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Sort By</label>
                    <select value={filters.sortBy} onChange={e => updateFilter('sortBy', e.target.value)}
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs mt-1">
                      <option value="created_at">Date Added</option><option value="score">Score</option>
                      <option value="rating">Rating</option><option value="review_count">Reviews</option>
                      <option value="company_name">Name</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <button className="flex items-center gap-1 text-xs font-medium w-full" onClick={() => setFilterSection(s => ({ ...s, contact: !s.contact }))}>
                      Contact Filters {filterSection.contact ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {filterSection.contact && (
                      <div className="space-y-0.5">
                        {boolFilter('Has Website', 'hasWebsite')}
                        {boolFilter('Has Email', 'hasEmail')}
                        {boolFilter('Has Phone', 'hasPhone')}
                        {boolFilter('Has WhatsApp', 'hasWhatsApp')}
                        {boolFilter('Has Instagram', 'hasInstagram')}
                        {boolFilter('Has Facebook', 'hasFacebook')}
                        {boolFilter('Has LinkedIn', 'hasLinkedIn')}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <button className="flex items-center gap-1 text-xs font-medium w-full" onClick={() => setFilterSection(s => ({ ...s, tech: !s.tech }))}>
                      Technical Filters {filterSection.tech ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {filterSection.tech && (
                      <div className="space-y-0.5">
                        {boolFilter('Slow Website (>3s)', 'slowWebsite')}
                        {boolFilter('No SSL', 'noSSL')}
                        {boolFilter('No Analytics', 'noAnalytics')}
                        {boolFilter('No Meta Pixel', 'noMetaPixel')}
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs">Min SEO Score</span>
                          <Input type="number" value={filters.minSeoScore} onChange={e => updateFilter('minSeoScore', e.target.value)} className="w-16 h-6 text-xs text-right" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <button className="flex items-center gap-1 text-xs font-medium w-full" onClick={() => setFilterSection(s => ({ ...s, opportunity: !s.opportunity }))}>
                      Opportunity Filters {filterSection.opportunity ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {filterSection.opportunity && (
                      <div className="space-y-0.5">
                        {boolFilter('No WhatsApp Widget', 'noWhatsApp')}
                        {boolFilter('No Booking System', 'noBooking')}
                        {boolFilter('No Contact Form', 'noContactForm')}
                        {boolFilter('Low SEO (<40)', 'lowSEO')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Company</th>
                  <th className="text-left p-4 font-medium">Location</th>
                  <th className="text-left p-4 font-medium">Industry</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Score</th>
                  <th className="text-left p-4 font-medium">Contact</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                    <td className="p-4">
                      <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 hover:opacity-80">
                        {lead.logo_url ? (
                          <img src={lead.logo_url} alt="" className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-medium">
                            {lead.company_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{lead.company_name}</div>
                          {lead.company_website && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                              <Globe className="h-3 w-3 shrink-0" />
                              {lead.company_website.replace('https://', '').replace('http://', '')}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 text-sm">
                      {lead.city && <div>{lead.city}</div>}
                      {lead.area && <div className="text-xs text-muted-foreground">{lead.area}</div>}
                    </td>
                    <td className="p-4"><Badge variant="secondary">{lead.industry || '-'}</Badge></td>
                    <td className="p-4"><Badge className={cn('border', statusColors(lead.status))}>{lead.status}</Badge></td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className={cn('font-semibold text-lg', getScoreColor(lead.score || 0))}>{lead.score || 0}</span>
                        {lead.score_label && <span className={cn('text-xs', { 'text-red-500': lead.score_label === 'hot', 'text-yellow-500': lead.score_label === 'warm', 'text-blue-500': lead.score_label === 'cold' })}>{lead.score_label}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {(lead.email || lead.company_email) && (
                        <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate max-w-[120px]">{lead.email || lead.company_email}</span></div>
                      )}
                      {(lead.phone || lead.company_phone) && (
                        <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span>{lead.phone || lead.company_phone}</span></div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/leads/${lead.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        {lead.company_website && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={lead.company_website} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {loading ? 'Loading...' : 'No leads found'}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
