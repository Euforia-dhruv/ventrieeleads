'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SearchJob } from '@/types/leads';

const statusConfig: Record<string, { icon: any; color: string; variant: string }> = {
  queued: { icon: Clock, color: 'text-yellow-500', variant: 'secondary' },
  running: { icon: Loader2, color: 'text-blue-500', variant: 'info' },
  completed: { icon: CheckCircle, color: 'text-green-500', variant: 'success' },
  failed: { icon: XCircle, color: 'text-red-500', variant: 'destructive' },
  cancelled: { icon: Trash2, color: 'text-gray-500', variant: 'outline' }
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/search/jobs?${params.toString()}`);
      const data = await res.json();
      setJobs(data.data || []);
    } catch {
      setJobs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.queued;
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <config.icon className={`h-3 w-3 ${config.color} ${status === 'running' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Jobs</h1>
          <p className="text-muted-foreground mt-1">Track background search operations</p>
        </div>
        <Button variant="outline" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        <Badge
          variant={!filter ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setFilter('')}
        >
          All
        </Badge>
        {['queued', 'running', 'completed', 'failed', 'cancelled'].map(s => (
          <Badge
            key={s}
            variant={filter === s ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4">
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(job.status)}
                      <span className="font-medium truncate">{job.query}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">City:</span> {job.city || '-'}
                      </div>
                      <div>
                        <span className="font-medium">Industry:</span> {job.industry || '-'}
                      </div>
                      <div>
                        <span className="font-medium">Max Results:</span> {job.max_results}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {formatDate(job.created_at)}
                      </div>
                    </div>
                    {job.status === 'running' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {job.status === 'completed' && (
                      <div className="mt-2 text-xs text-green-600">
                        Found {job.results_count} businesses
                      </div>
                    )}
                    {job.error_message && (
                      <div className="mt-2 text-xs text-red-500 truncate">
                        Error: {job.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {job.status === 'completed' && (
                      <Button variant="outline" size="sm" href="/leads">
                        <Search className="h-3 w-3 mr-1" /> View Leads
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {jobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {loading ? 'Loading jobs...' : 'No search jobs yet. Start a search to begin.'}
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
