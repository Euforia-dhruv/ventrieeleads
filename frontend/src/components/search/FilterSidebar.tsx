'use client';

import { useState } from 'react';
import { Filter, ChevronDown, ChevronRight, X, Star, Globe, Mail, Phone, MessageSquare, Link2, AtSign, Share2, Cpu } from 'lucide-react';

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

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const DEFAULT_FILTERS: FilterState = {
  country: '',
  city: '',
  industry: '',
  minRating: 0,
  minWebsiteScore: 0,
  minLeadScore: 0,
  minOppScore: 0,
  hasEmail: false,
  hasPhone: false,
  hasWhatsApp: false,
  hasInstagram: false,
  hasLinkedIn: false,
  hasFacebook: false,
  hasWebsite: false,
  noWebsite: false,
};

function FilterSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-700/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:text-white transition-colors"
      >
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

export default function FilterSidebar({ filters, onChange, isOpen, onToggle }: FilterSidebarProps) {
  const update = (key: keyof FilterState, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'minRating' || key === 'minWebsiteScore' || key === 'minLeadScore' || key === 'minOppScore') {
      return val > 0;
    }
    return val === true || (typeof val === 'string' && val !== '');
  }).length;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-300 backdrop-blur-lg"
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-xs">{activeCount}</span>
        )}
      </button>

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform lg:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-white">Filters</h3>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">{activeCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
            <button onClick={onToggle} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-60px)]">
          {/* Location */}
          <FilterSection title="Location" icon={Globe} defaultOpen={true}>
            <input
              type="text"
              value={filters.country}
              onChange={(e) => update('country', e.target.value)}
              placeholder="Country"
              className="w-full h-8 px-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
            <input
              type="text"
              value={filters.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="City"
              className="w-full h-8 px-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </FilterSection>

          {/* Industry */}
          <FilterSection title="Industry" icon={Filter}>
            <input
              type="text"
              value={filters.industry}
              onChange={(e) => update('industry', e.target.value)}
              placeholder="Industry"
              className="w-full h-8 px-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </FilterSection>

          {/* Scores */}
          <FilterSection title="Scores" icon={Star} defaultOpen={true}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Min Rating: {filters.minRating}</label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={filters.minRating}
                  onChange={(e) => update('minRating', parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Min Website Score: {filters.minWebsiteScore}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={filters.minWebsiteScore}
                  onChange={(e) => update('minWebsiteScore', parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Min Lead Score: {filters.minLeadScore}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={filters.minLeadScore}
                  onChange={(e) => update('minLeadScore', parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </FilterSection>

          {/* Contact */}
          <FilterSection title="Contact Info" icon={Mail} defaultOpen={true}>
            <div className="space-y-2">
              {[
                { key: 'hasEmail', label: 'Has Email', icon: Mail },
                { key: 'hasPhone', label: 'Has Phone', icon: Phone },
                { key: 'hasWhatsApp', label: 'Has WhatsApp', icon: MessageSquare },
                { key: 'hasInstagram', label: 'Has Instagram', icon: AtSign },
                { key: 'hasLinkedIn', label: 'Has LinkedIn', icon: Link2 },
                { key: 'hasFacebook', label: 'Has Facebook', icon: Share2 },
              ].map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters[key as keyof FilterState] as boolean}
                    onChange={(e) => update(key as keyof FilterState, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Website */}
          <FilterSection title="Website" icon={Globe}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hasWebsite}
                  onChange={(e) => update('hasWebsite', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Has website</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.noWebsite}
                  onChange={(e) => update('noWebsite', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">No website (needs one)</span>
              </label>
            </div>
          </FilterSection>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
