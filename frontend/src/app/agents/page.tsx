'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bot, Play, Zap, Activity, Database, Clock, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { cn, apiFetch } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

const AGENT_NAMES = [
  'lead_researcher',
  'enrichment_engine',
  'email_outreach',
  'scoring_agent',
  'monitoring_agent',
  'company_discovery',
  'campaign_manager',
  'report_generator',
];

interface AgentState {
  name: string;
  status: 'idle' | 'running' | 'error';
  confidence: number;
  total_runs: number;
  successful_runs: number;
  last_run: string | null;
  last_error: string | null;
}

interface HealthData {
  agents: Record<string, AgentState>;
  recent_executions: any[];
  pending_events: number;
  total_memories: number;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function capitalize(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'running') return 'warning';
  if (status === 'error') return 'destructive';
  return 'success';
}

export default function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [agentsRes, healthRes] = await Promise.allSettled([
        fetch('/api/agents').then(r => r.json()),
        fetch('/api/agents/health').then(r => r.json()),
      ]);

      if (agentsRes.status === 'fulfilled' && agentsRes.value.success) {
        const agentList: AgentState[] = agentsRes.value.data.map((a: any) => ({
          name: a.name,
          status: a.status || 'idle',
          confidence: a.confidence ?? 0,
          total_runs: a.total_runs ?? 0,
          successful_runs: a.successful_runs ?? 0,
          last_run: a.last_run ?? a.last_run_at ?? null,
          last_error: a.last_error ?? null,
        }));
        setAgents(agentList);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.success) {
        setHealth(healthRes.value.data);
      }

      setLoading(false);
    } catch {
      setError('Failed to load agent data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runAllAgents = async () => {
    setRunningAll(true);
    try {
      await fetch('/api/agents/run-all', { method: 'POST' });
      toast('Briefing generation started for all agents', 'success');
      setTimeout(fetchData, 2000);
    } catch {
      toast('Failed to run agents', 'error');
    }
    setRunningAll(false);
  };

  const runAgent = async (name: string) => {
    setRunningAgent(name);
    try {
      await fetch(`/api/agents/${name}/run`, { method: 'POST' });
      toast(`Running ${capitalize(name)}`, 'info');
      setTimeout(fetchData, 2000);
    } catch {
      toast(`Failed to run ${capitalize(name)}`, 'error');
    }
    setRunningAgent(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-4">
        <AlertCircle className="h-12 w-12" />
        <p>{error}</p>
        <Button variant="outline" onClick={() => { setError(null); setLoading(true); fetchData(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agent Command Center</h1>
            <p className="text-muted-foreground mt-1">Monitor, run, and manage your AI agent fleet</p>
          </div>
          <Button onClick={runAllAgents} disabled={runningAll}>
            {runningAll ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating briefing...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Run All Agents</>
            )}
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agent Fleet</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {AGENT_NAMES.map((name, i) => {
              const agent = agents.find(a => a.name === name);
              const status = agent?.status || 'idle';
              const confidence = agent?.confidence ?? 0;
              const totalRuns = agent?.total_runs ?? 0;
              const successRuns = agent?.successful_runs ?? 0;
              const lastRun = agent?.last_run ?? null;
              const isRunning = runningAgent === name || (status === 'running');

              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass-card h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          {capitalize(name)}
                        </CardTitle>
                        <Badge variant={statusVariant(status)} className="text-[10px]">
                          {status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Confidence</span>
                          <span className="text-xs font-medium">{confidence}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                          <motion.div
                            className={cn(
                              'h-full rounded-full',
                              confidence >= 80 ? 'bg-green-500' : confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${confidence}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>{totalRuns} runs</span>
                        </div>
                        <span className="text-green-500">{successRuns} passed</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(lastRun)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => runAgent(name)}
                          disabled={isRunning}
                        >
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Pending Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.pending_events ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" /> Total Memories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.total_memories ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Stored in agent memory</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" /> Active Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{agents.filter(a => a.status === 'running').length}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently executing</p>
              </CardContent>
            </Card>
          </div>

          {health?.recent_executions && health.recent_executions.length > 0 && (
            <Card className="glass-card mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Recent Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {health.recent_executions.slice(0, 10).map((exec: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant={exec.status === 'success' ? 'success' : exec.status === 'error' ? 'destructive' : 'info'} className="text-[10px]">
                          {exec.status}
                        </Badge>
                        <span className="font-medium">{capitalize(exec.agent_name || exec.agent || 'unknown')}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(exec.executed_at || exec.created_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
