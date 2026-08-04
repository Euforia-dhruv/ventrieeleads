'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Briefcase } from 'lucide-react';

const POPULAR_INDUSTRIES = [
  'Dentist', 'Restaurant', 'Hotel', 'Construction', 'Real Estate',
  'Law Firm', 'Gym', 'Salon', 'Marketing Agency', 'Software',
  'Interior Design', 'Architecture', 'Clinic', 'Car Rental',
  'Accounting', 'Healthcare', 'Education', 'E-commerce',
  'IT Services', 'Manufacturing', 'Logistics', 'Retail',
  'Fashion', 'Food & Beverage', 'Travel', 'Fitness',
  'Beauty', 'Automotive', 'Finance', 'Consulting',
];

interface IndustryPickerProps {
  value?: string[];
  onChange?: (industries: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

export default function IndustryPicker({ value = [], onChange, placeholder = 'Search industries...', multiple = true }: IndustryPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = POPULAR_INDUSTRIES.filter((ind) =>
    ind.toLowerCase().includes(query.toLowerCase())
  );

  const toggleIndustry = (industry: string) => {
    let newSelected: string[];
    if (multiple) {
      newSelected = selected.includes(industry)
        ? selected.filter((s) => s !== industry)
        : [...selected, industry];
    } else {
      newSelected = selected.includes(industry) ? [] : [industry];
      setOpen(false);
    }
    setSelected(newSelected);
    onChange?.(newSelected);
    setQuery('');
  };

  const removeIndustry = (industry: string) => {
    const newSelected = selected.filter((s) => s !== industry);
    setSelected(newSelected);
    onChange?.(newSelected);
  };

  const clearAll = () => {
    setSelected([]);
    onChange?.([]);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex items-center gap-2 flex-wrap min-h-[56px] px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
        <Briefcase className="w-5 h-5 text-slate-400 shrink-0" />
        <div className="flex-1 flex flex-wrap gap-2 min-w-0">
          {selected.map((industry) => (
            <span
              key={industry}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm border border-blue-500/20"
            >
              {industry}
              <button
                onClick={() => removeIndustry(industry)}
                className="hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
          />
        </div>
        {selected.length > 0 && (
          <button onClick={clearAll} className="text-slate-400 hover:text-white transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
          {!query && (
            <div className="p-3 border-b border-slate-700/50">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Popular industries</p>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-2">
            {filtered.map((industry) => (
              <button
                key={industry}
                onClick={() => toggleIndustry(industry)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  selected.includes(industry)
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{industry}</span>
                {selected.includes(industry) && (
                  <span className="text-xs text-blue-400">Selected</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-slate-400">
                No industries match &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
