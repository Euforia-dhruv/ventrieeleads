'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Briefcase, Building2, Star, Hash, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const UAE_EMIRATES = [
  {
    name: 'Dubai',
    areas: ['Downtown Dubai', 'Business Bay', 'Dubai Marina', 'Jumeirah', 'Palm Jumeirah', 'Deira', 'Bur Dubai', 'JLT', 'Al Barsha', 'Silicon Oasis', 'Internet City', 'Media City', 'Design District', 'Healthcare City', 'Motor City', 'Arabian Ranches', 'Dubai Hills', 'Mirdif', 'Al Quoz', 'International City', 'Discovery Gardens', 'Jebel Ali', 'Al Nahda', 'Satwa', 'Al Rigga', 'Oud Metha', 'Al Garhoud', 'Dubai Creek Harbour', 'Bluewaters Island']
  },
  {
    name: 'Abu Dhabi',
    areas: ['Al Reem Island', 'Khalifa City', 'Yas Island', 'Saadiyat Island', 'Mussafah', 'Masdar City', 'Al Raha', 'Corniche', 'Tourist Club Area', 'Al Maryah Island']
  },
  {
    name: 'Sharjah',
    areas: ['Al Majaz', 'Al Nahda', 'Al Khan', 'Muwaileh', 'Industrial Area', 'Al Qasimia', 'Al Taawun', 'Al Mamzar']
  },
  { name: 'Ajman', areas: ['Al Nuaimiya', 'Al Jurf', 'Al Rashidiya', 'Emirates City'] },
  { name: 'Ras Al Khaimah', areas: ['Al Marjan Island', 'Al Hamra Village', 'Dafan Al Khor'] },
  { name: 'Fujairah', areas: ['Dibba', 'Al Faseel', 'City Centre'] },
  { name: 'Umm Al Quwain', areas: ['Old Town', 'Al Salamah'] },
  { name: 'Al Ain', areas: ['Al Jimi', 'Al Towayya', 'Al Mutawaa', 'Zakher'] }
];

const INDUSTRIES = [
  'Hotels', 'Restaurants', 'Cafes', 'Medical Clinics', 'Hospitals', 'Dentists',
  'Real Estate', 'Construction', 'Interior Designers', 'Architects', 'Gyms', 'Salons',
  'Spas', 'Car Showrooms', 'Law Firms', 'Accounting Firms', 'Travel Agencies',
  'Education', 'IT Companies', 'Marketing Agencies', 'Ecommerce', 'Retail',
  'Jewellery', 'Luxury Brands', 'Furniture', 'Manufacturing', 'Logistics'
];

const QUICK_SEARCHES = [
  { label: 'Hotels Dubai Marina', query: 'Hotels', city: 'Dubai', area: 'Dubai Marina', industry: 'Hotels' },
  { label: 'Restaurants Business Bay', query: 'Restaurants', city: 'Dubai', area: 'Business Bay', industry: 'Restaurants' },
  { label: 'Dental Clinics Dubai', query: 'Dental Clinic', city: 'Dubai', area: '', industry: 'Dentists' },
  { label: 'Real Estate Downtown', query: 'Real Estate', city: 'Dubai', area: 'Downtown Dubai', industry: 'Real Estate' },
  { label: 'Gyms JLT', query: 'Gym', city: 'Dubai', area: 'JLT', industry: 'Gyms' },
  { label: 'Construction Abu Dhabi', query: 'Construction', city: 'Abu Dhabi', area: '', industry: 'Construction' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Dubai');
  const [area, setArea] = useState('');
  const [industry, setIndustry] = useState('');
  const [keyword, setKeyword] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [minRating, setMinRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const selectedEmirate = UAE_EMIRATES.find(e => e.name === city);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query || `${industry} ${keyword}`.trim(),
          country: 'UAE',
          city,
          area,
          industry,
          keyword,
          max_results: maxResults,
          min_rating: minRating
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Businesses</h1>
        <p className="text-muted-foreground mt-1">Discover businesses across the UAE</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Search Query</label>
              <Input
                placeholder="e.g., Hotels, Dental Clinic, Real Estate"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Keyword (Optional)</label>
              <Input
                placeholder="e.g., luxury, modern, 24/7"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <MapPin className="h-3 w-3" /> City / Emirate
              </label>
              <Select value={city} onValueChange={v => { setCity(v); setArea(''); }}>
                {UAE_EMIRATES.map(e => (
                  <option key={e.name} value={e.name}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Area</label>
              <Select value={area} onValueChange={setArea}>
                <option value="">All Areas</option>
                {selectedEmirate?.areas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Industry
              </label>
              <Select value={industry} onValueChange={setIndustry}>
                <option value="">All Industries</option>
                {INDUSTRIES.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Results
              </label>
              <Select value={maxResults.toString()} onValueChange={v => setMaxResults(parseInt(v))}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Star className="h-3 w-3" /> Minimum Rating
              </label>
              <Select value={minRating.toString()} onValueChange={v => setMinRating(parseFloat(v))}>
                <option value="0">Any Rating</option>
                <option value="3">3+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Search...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Start Search
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-2">Quick searches:</span>
            {QUICK_SEARCHES.map(qs => (
              <Badge
                key={qs.label}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => {
                  setQuery(qs.query);
                  setCity(qs.city);
                  setArea(qs.area);
                  setIndustry(qs.industry);
                }}
              >
                {qs.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Search Job Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Job ID:</span> {result.data?.id}
              </p>
              <p className="text-sm">
                <span className="font-medium">Status:</span>{' '}
                <Badge variant={result.data?.status === 'queued' ? 'secondary' : 'success'}>
                  {result.data?.status}
                </Badge>
              </p>
              <p className="text-sm">
                <span className="font-medium">Query:</span> {result.data?.query}
              </p>
              <p className="text-sm text-muted-foreground">
                The search is running in the background. Go to the Jobs page to track progress.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/jobs'}
              >
                View Jobs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
