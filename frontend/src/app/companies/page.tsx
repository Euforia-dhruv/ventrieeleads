'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, MapPin, Briefcase, Zap, Loader2 } from 'lucide-react';
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
    areas: ['Al Reem Island', 'Khalifa City', 'Yas Island', 'Saadiyat Island', 'Mussafah', 'Masdar City', 'Al Raha']
  },
  {
    name: 'Sharjah',
    areas: ['Al Majaz', 'Al Nahda', 'Al Khan', 'Muwaileh', 'Industrial Area']
  },
  { name: 'Ajman', areas: ['Al Nuaimiya', 'Al Jurf'] },
  { name: 'Ras Al Khaimah', areas: ['Al Marjan Island', 'Al Hamra Village'] },
  { name: 'Fujairah', areas: ['Dibba', 'Al Faseel'] },
  { name: 'Umm Al Quwain', areas: ['Old Town'] },
  { name: 'Al Ain', areas: ['Al Jimi', 'Al Towayya'] }
];

const INDUSTRIES = [
  'Hotels', 'Restaurants', 'Cafes', 'Medical Clinics', 'Hospitals', 'Dentists',
  'Real Estate', 'Construction', 'Interior Designers', 'Architects', 'Gyms', 'Salons',
  'Spas', 'Car Showrooms', 'Law Firms', 'Accounting Firms', 'Travel Agencies',
  'Education', 'IT Companies', 'Marketing Agencies', 'Ecommerce', 'Retail',
  'Jewellery', 'Luxury Brands', 'Furniture', 'Manufacturing', 'Logistics'
];

export default function CompaniesPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Dubai');
  const [area, setArea] = useState('');
  const [industry, setIndustry] = useState('');
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
          query: query || industry,
          country: 'UAE',
          city,
          area,
          industry,
          max_results: 50
        })
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Discovery</h1>
        <p className="text-muted-foreground mt-1">Find businesses and start analysis jobs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Discover</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Search Query</label>
              <Input
                placeholder="e.g., Hotels, Dental Clinic, Real Estate"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Industry
              </label>
              <Select value={industry} onValueChange={setIndustry}>
                <option value="">All Industries</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                <MapPin className="h-3 w-3" /> City
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
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Search...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" /> Start Search
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Search Job Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">
              Job <strong>{result.data?.id?.slice(0, 8)}...</strong> has been queued.
              Businesses will be discovered, websites scraped, and audited automatically.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" href="/jobs">
                View Jobs
              </Button>
              <Button variant="outline" size="sm" href="/leads">
                View Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
