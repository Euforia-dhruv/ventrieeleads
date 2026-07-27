'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Download, Mail, Phone, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { statusColors, getScoreColor, truncate } from '@/lib/utils';
import type { Lead } from '@/types/leads';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (cityFilter) params.set('city', cityFilter);

    fetch(`/api/leads?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setLeads(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, cityFilter]);

  const filtered = leads.filter(lead =>
    lead.company_name.toLowerCase().includes(search.toLowerCase()) ||
    lead.email.toLowerCase().includes(search.toLowerCase()) ||
    lead.city.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (format: string) => {
    const params = new URLSearchParams({ format, ...(statusFilter ? { status: statusFilter } : {}), ...(cityFilter ? { city: cityFilter } : {}) });
    const res = await fetch(`/api/export/leads?${params.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads.${format}`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">Manage your lead pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-2" /> JSON
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> New Lead
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <option value="">All Statuses</option>
          <option value="New">New</option>
          <option value="Qualified">Qualified</option>
          <option value="Contacted">Contacted</option>
          <option value="Replied">Replied</option>
          <option value="Proposal">Proposal</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </Select>
      </div>

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
                {filtered.map(lead => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{lead.company_name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.company_website}</div>
                    </td>
                    <td className="p-4 text-sm">{lead.city}, {lead.country}</td>
                    <td className="p-4">
                      <Badge variant="secondary">{lead.industry}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={cn(statusColors(lead.status))}>{lead.status}</Badge>
                    </td>
                    <td className="p-4">
                      <span className={cn('font-semibold', getScoreColor(lead.lead_score))}>{lead.lead_score}</span>
                    </td>
                    <td className="p-4 text-sm">
                      {lead.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</div>}
                      {lead.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</div>}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {loading ? 'Loading...' : 'No leads found'}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}