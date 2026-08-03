'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Plus, Play, Trash2, Clock, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ScheduledSearch {
  id: string; name: string; query: string; country: string; city: string;
  industry: string; schedule_type: string; is_active: boolean;
  last_run_at: string | null; total_runs: number; last_results_count: number;
  created_at: string; next_run_at: string | null;
}

export default function ScheduledPage() {
  const [searches, setSearches] = useState<ScheduledSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', query: '', city: 'Dubai', industry: '', schedule_type: 'daily' });

  useEffect(() => { fetchSearches(); }, []);

  const fetchSearches = async () => {
    try {
      const res = await fetch('/api/scheduled-searches');
      const data = await res.json();
      setSearches(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const createSearch = async () => {
    if (!form.name || !form.query) return;
    await fetch('/api/scheduled-searches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, country: 'UAE', max_results: 50 }),
    });
    setShowForm(false);
    setForm({ name: '', query: '', city: 'Dubai', industry: '', schedule_type: 'daily' });
    fetchSearches();
  };

  const runNow = async (id: string) => {
    await fetch(`/api/scheduled-searches/${id}/run`, { method: 'POST' });
    fetchSearches();
  };

  const deleteSearch = async (id: string) => {
    await fetch(`/api/scheduled-searches/${id}`, { method: 'DELETE' });
    fetchSearches();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Searches</h1>
          <p className="text-muted-foreground mt-1">Automated recurring searches</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" />New Schedule</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Query (e.g. dental clinics)" value={form.query} onChange={e => setForm({ ...form, query: e.target.value })} />
              <Input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <select value={form.schedule_type} onChange={e => setForm({ ...form, schedule_type: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
              <Button onClick={createSearch}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : searches.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">No scheduled searches yet. Create one to automate lead discovery.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {searches.map(s => (
            <Card key={s.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Badge variant={s.is_active ? 'success' : 'secondary'}>{s.is_active ? 'Active' : 'Paused'}</Badge>
                    <Badge variant="outline">{s.schedule_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Query: {s.query} | City: {s.city || 'Any'} | Runs: {s.total_runs} | Last: {s.last_run_at ? formatDate(s.last_run_at) : 'Never'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => runNow(s.id)}><Play className="h-3 w-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteSearch(s.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
