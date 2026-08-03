'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Brain, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EXAMPLE_QUERIES = [
  'Find dental clinics in Abu Dhabi',
  'Show me hotels with low ratings',
  'IT companies in Dubai Silicon Oasis',
  'Real estate agencies needing SEO help',
];

interface RecentSearch {
  query: string;
  taskId: string | null;
  status: string;
  timestamp: number;
}

function getRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('intelligence_recent') || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(search: RecentSearch) {
  const recent = getRecentSearches();
  const updated = [search, ...recent.filter(r => r.query !== search.query)].slice(0, 10);
  localStorage.setItem('intelligence_recent', JSON.stringify(updated));
}

export default function IntelligencePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJob = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/search/jobs/${id}`);
        const data = await res.json();
        const jobStatus = data?.data?.status || data?.status;

        setStatus(jobStatus);

        if (jobStatus === 'completed' || jobStatus === 'failed' || jobStatus === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          setProcessing(false);
          setLoading(false);

          setRecentSearches(prev => {
            const updated = prev.map(s =>
              s.taskId === id ? { ...s, status: jobStatus } : s
            );
            localStorage.setItem('intelligence_recent', JSON.stringify(updated));
            return updated;
          });
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setProcessing(false);
        setLoading(false);
        setError('Lost connection while polling. Check the Jobs page for results.');
      }
    }, 3000);
  }, []);

  const handleSubmit = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q || loading) return;

    setQuery(q);
    setLoading(true);
    setProcessing(true);
    setError(null);
    setStatus('submitting');

    try {
      const res = await fetch('/api/intelligence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      const id = data.data?.task_id;
      const jobStatus = data.data?.status || 'queued';

      setTaskId(id);
      setStatus(jobStatus);

      const entry: RecentSearch = {
        query: q,
        taskId: id,
        status: jobStatus,
        timestamp: Date.now(),
      };
      saveRecentSearch(entry);
      setRecentSearches(getRecentSearches());

      if (id) pollJob(id);
      else {
        setProcessing(false);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start intelligence search');
      setProcessing(false);
      setLoading(false);
    }
  };

  const statusLabel: Record<string, string> = {
    submitting: 'Submitting query...',
    queued: 'Queued for processing...',
    processing: 'AI is analyzing your query...',
    running: 'Searching and gathering intelligence...',
    completed: 'Search complete!',
    failed: 'Search failed',
    error: 'An error occurred',
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center px-6 pt-24 pb-12"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Intelligent Search</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Describe what you need in natural language. Our AI will find, analyze, and qualify leads for you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-purple-500/20 shadow-lg shadow-purple-500/5">
            <CardContent className="p-6">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSubmit(query);
                }}
                className="flex gap-3"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Ask anything... e.g. Find luxury hotels in Dubai with outdated websites"
                    className="pl-10 h-12 text-base"
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || !query.trim()}
                  className="px-6"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Search
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="flex flex-wrap gap-2 mt-4">
                {EXAMPLE_QUERIES.map(eq => (
                  <button
                    key={eq}
                    onClick={() => handleSubmit(eq)}
                    disabled={loading}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full border transition-colors',
                      'border-purple-500/20 text-purple-500/80 hover:bg-purple-500/10 hover:text-purple-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl mt-6"
            >
              <Card className="border-blue-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                      <Sparkles className="h-4 w-4 text-blue-500 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <div>
                      <p className="font-medium">{statusLabel[status] || 'Processing...'}</p>
                      {taskId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Task: {taskId.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{
                        width: status === 'completed' ? '100%' : '60%',
                      }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl mt-6"
            >
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-4">
                  <p className="text-sm text-red-500">{error}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && recentSearches.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-2xl mt-10"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentSearches.map((s, i) => (
                  <button
                    key={`${s.timestamp}-${i}`}
                    onClick={() => handleSubmit(s.query)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-accent text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{s.query}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          s.status === 'completed'
                            ? 'bg-green-500/10 text-green-500'
                            : s.status === 'failed' || s.status === 'error'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-blue-500/10 text-blue-500'
                        )}
                      >
                        {s.status}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
