'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, ChevronDown, ChevronRight, Globe, X } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  country_code?: string;
  location_type: string;
  parent_id?: string;
  latitude?: number;
  longitude?: number;
}

interface LocationPickerProps {
  value?: string;
  onChange?: (location: { country?: string; state?: string; city?: string; query: string }) => void;
  placeholder?: string;
}

const QUICK_LOCATIONS = [
  { name: 'Dubai', country: 'UAE', emoji: '🇦🇪' },
  { name: 'London', country: 'UK', emoji: '🇬🇧' },
  { name: 'New York', country: 'USA', emoji: '🇺🇸' },
  { name: 'Tokyo', country: 'Japan', emoji: '🇯🇵' },
  { name: 'Berlin', country: 'Germany', emoji: '🇩🇪' },
  { name: 'Paris', country: 'France', emoji: '🇫🇷' },
  { name: 'Toronto', country: 'Canada', emoji: '🇨🇦' },
  { name: 'Sydney', country: 'Australia', emoji: '🇦🇺' },
  { name: 'Singapore', country: 'Singapore', emoji: '🇸🇬' },
  { name: 'Mumbai', country: 'India', emoji: '🇮🇳' },
];

export default function LocationPicker({ value, onChange, placeholder = 'Search anywhere in the world...' }: LocationPickerProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ country?: string; state?: string; city?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchLocations = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.locations || data || []);
      }
    } catch (err) {
      console.error('Location search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchLocations(query);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchLocations]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLocation = (loc: Location) => {
    const country = loc.country_code || '';
    const city = loc.location_type === 'city' ? loc.name : '';
    const state = loc.location_type === 'state' ? loc.name : '';

    setSelected({ country, state, city });
    setQuery(loc.name);
    setOpen(false);
    onChange?.({ country, state, city, query: loc.name });
  };

  const selectQuick = (loc: typeof QUICK_LOCATIONS[0]) => {
    setQuery(`${loc.name}, ${loc.country}`);
    setSelected({ country: loc.country, city: loc.name });
    setOpen(false);
    onChange?.({ country: loc.country, city: loc.name, query: `${loc.name}, ${loc.country}` });
  };

  const clearSelection = () => {
    setQuery('');
    setSelected({});
    setResults([]);
    onChange?.({ country: '', state: '', city: '', query: '' });
  };

  const grouped = results.reduce((acc, loc) => {
    const type = loc.location_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(loc);
    return acc;
  }, {} as Record<string, Location[]>);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-14 pl-12 pr-12 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
        />
        {query && (
          <button onClick={clearSelection} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
          {!query && (
            <div className="p-3 border-b border-slate-700/50">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Popular locations</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => selectQuick(loc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all"
                  >
                    <span>{loc.emoji}</span>
                    <span>{loc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Searching locations...
              </div>
            )}

            {!loading && results.length === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-slate-400">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No locations found for &ldquo;{query}&rdquo;
              </div>
            )}

            {!loading && results.length === 0 && query.length < 2 && (
              <div className="p-4 text-center text-slate-400">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Type at least 2 characters to search
              </div>
            )}

            {Object.entries(grouped).map(([type, locs]) => (
              <div key={type}>
                <div className="px-3 py-2 bg-slate-800/30 border-b border-slate-700/30">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{type}s</p>
                </div>
                {locs.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => selectLocation(loc)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{loc.name}</p>
                      {loc.country_code && (
                        <p className="text-xs text-slate-500">{loc.country_code}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
