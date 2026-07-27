'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, MapPin, Briefcase, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const LOCATIONS = {
  UAE: {
    Dubai: ['Downtown Dubai', 'Business Bay', 'Dubai Marina', 'Jumeirah', 'Palm Jumeirah', 'Deira', 'JLT', 'Al Barsha', 'Silicon Oasis', 'Internet City', 'Media City', 'Design District', 'Healthcare City', 'Jebal Ali'],
    Abu Dhabi: ['Al Reem Island', 'Khalifa City', 'Yas Island', 'Saadiyat Island', 'Mussafah', 'Masdar City', 'Al Raha'],
    Sharjah: ['Al Majaz', 'Al Nahda', 'Al Khan', 'Muwaileh', 'Industrial Area']
  },
  GCC: ['Riyadh', 'Jeddah', 'Muscat', 'Doha', 'Manama', 'Kuwait City']
};

const INDUSTRIES = [
  'Hotels', 'Restaurants', 'Cafes', 'Medical Clinics', 'Hospitals', 'Dentists',
  'Real Estate', 'Construction', 'Interior Designers', 'Architects', 'Gyms', 'Salons',
  'Spas', 'Car Showrooms', 'Law Firms', 'Accounting Firms', 'Travel Agencies',
  'Education', 'Schools', 'Universities', 'IT Companies', 'Marketing Agencies',
  'Ecommerce', 'Retail', 'Jewellery', 'Luxury Brands', 'Furniture', 'Manufacturing',
  'Logistics', 'Freight', 'Shipping', 'Warehouses'
];

const SEARCH_EXAMPLES = [
  'Hotels Dubai Marina', 'Luxury Hotels Downtown Dubai', 'Restaurants Business Bay',
  'Dental Clinic Dubai', 'Gym JLT', 'Construction Company Abu Dhabi',
  'Interior Designer Dubai', 'Architect Sharjah', 'Salon Al Barsha',
  'Real Estate Palm Jumeirah', 'Cafe Dubai Hills', 'Hotel Abu Dhabi',
  'Car Showroom Dubai', 'Marketing Agency Dubai', 'IT Company Abu Dhabi'
];

export default function CompaniesPage() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scouting, setScouting] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&industry=${encodeURIComponent(industry)}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleScout = async () => {
    setScouting(true);
    try {
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, industry })
      });
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    }
    setScouting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Discovery</h1>
        <p className="text-muted-foreground mt-1">Find and scout businesses using AI-powered search</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Scout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Search Query</label>
              <Input
                placeholder="e.g., Hotels Dubai Marina, Dental Clinic Dubai"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-48">
              <label className="text-xs font-medium mb-1 block">Location</label>
              <Select value={location} onValueChange={setLocation}>
                <option value="">All Locations</option>
                {Object.entries(LOCATIONS).map(([country, cities]) => (
                  <optgroup key={country} label={country}>
                    {Object.entries(cities).map(([emirate, areas]) => (
                      <optgroup key={emirate} label={emirate}>
                        {areas.map(area => <option key={area} value={area}>{area}</option>)}
                      </optgroup>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <label className="text-xs font-medium mb-1 block">Industry</label>
              <Select value={industry} onValueChange={setIndustry}>
                <option value="">All Industries</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
            <Button variant="secondary" onClick={handleScout} disabled={scouting}>
              <Zap className="h-4 w-4 mr-2" /> AI Scout
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground mr-2">Quick searches:</span>
            {SEARCH_EXAMPLES.map(example => (
              <Badge
                key={example}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => { setQuery(example); handleSearch(); }}
              >
                {example}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result, index) => (
          <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{result.name}</CardTitle>
                  {result.rating > 0 && (
                    <Badge variant="warning">{result.rating} ⭐</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="truncate">{result.website || 'No website'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{result.address || result.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  <span>{result.category || result.industry}</span>
                </div>
                {result.email && (
                  <div className="text-sm text-primary">{result.email}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Globe className="h-3 w-3 mr-1" /> Analyze
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Search className="h-3 w-3 mr-1" /> Scout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {results.length === 0 && !loading && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            Search for companies to discover leads
          </div>
        )}
      </div>
    </motion.div>
  );
}
