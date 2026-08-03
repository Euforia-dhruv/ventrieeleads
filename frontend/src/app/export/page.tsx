'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileDown, Download, Filter } from 'lucide-react';

export default function ExportPage() {
  const [loading, setLoading] = useState(false);
  const [lastExport, setLastExport] = useState<any>(null);
  const [filters, setFilters] = useState({
    format: 'csv', status: '', city: '', industry: '', minScore: '', maxScore: '', technology: ''
  });

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const format = filters.format;

      if (format === 'csv' || format === 'markdown') {
        const res = await fetch(`/api/export/leads?${params.toString()}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads.${format === 'csv' ? 'csv' : 'md'}`;
        a.click();
        URL.revokeObjectURL(url);
        setLastExport({ format, timestamp: new Date().toISOString() });
      } else {
        const res = await fetch(`/api/export/leads?${params.toString()}`);
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.data || [], null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads.json';
        a.click();
        URL.revokeObjectURL(url);
        setLastExport({ format, timestamp: new Date().toISOString(), count: data.data?.length || 0 });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Center</h1>
        <p className="text-muted-foreground mt-1">Export leads in multiple formats</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" />Export Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Format</label>
              <select value={filters.format} onChange={e => setFilters({ ...filters, format: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1">
                <option value="csv">CSV (.csv)</option><option value="json">JSON (.json)</option><option value="markdown">Markdown (.md)</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">Status</label>
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1">
                <option value="">All</option>
                {['New','Qualified','Researching','Contacted','Replied','Meeting','Proposal','Negotiation','Won','Lost'].map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="text-sm font-medium">City</label>
              <select value={filters.city} onChange={e => setFilters({ ...filters, city: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1">
                <option value="">All</option>{['Dubai','Abu Dhabi','Sharjah'].map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="text-sm font-medium">Industry</label>
              <Input placeholder="e.g. Dentists" value={filters.industry} onChange={e => setFilters({ ...filters, industry: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium">Min Score</label><Input type="number" value={filters.minScore} onChange={e => setFilters({ ...filters, minScore: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium">Max Score</label><Input type="number" value={filters.maxScore} onChange={e => setFilters({ ...filters, maxScore: e.target.value })} className="mt-1" /></div>
            <div><label className="text-sm font-medium">Technology</label><Input placeholder="e.g. WordPress" value={filters.technology} onChange={e => setFilters({ ...filters, technology: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />{loading ? 'Exporting...' : 'Export Leads'}
            </Button>
            {lastExport && <Badge variant="outline">Last: {lastExport.format.toUpperCase()} at {new Date(lastExport.timestamp).toLocaleTimeString()}</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
