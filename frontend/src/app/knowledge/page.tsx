'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Network, GitBranch, Filter, RefreshCw, ArrowRight, Eye, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Edge {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string;
  weight: number;
  metadata: Record<string, any>;
}

interface RelationshipStat {
  relationship: string;
  count: number;
}

interface KnowledgeData {
  edges: Edge[];
  relationship_stats: RelationshipStat[];
  total_edges: number;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  uses: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  targets: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  competes_with: 'bg-red-500/15 text-red-400 border-red-500/20',
  located_in: 'bg-green-500/15 text-green-400 border-green-500/20',
  belongs_to: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  partners_with: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  owned_by: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  supplies: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

const NODE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  company: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  lead: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  technology: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
  industry: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  location: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  campaign: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
};

function getNodeColor(type: string) {
  return NODE_TYPE_COLORS[type.toLowerCase()] || { bg: 'bg-secondary/10', border: 'border-secondary/30', text: 'text-muted-foreground' };
}

function getRelColor(rel: string) {
  return RELATIONSHIP_COLORS[rel] || 'bg-secondary/15 text-muted-foreground border-secondary/20';
}

function getMaxWeight(edges: Edge[]) {
  let max = 1;
  for (const e of edges) if (e.weight > max) max = e.weight;
  return max;
}

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRel, setFilterRel] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/knowledge');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError('');
      } else {
        setError('Failed to load knowledge graph');
      }
    } catch {
      setError('Failed to load knowledge graph');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    fetchData();
  };

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    if (filterRel === 'all') return data.edges;
    return data.edges.filter(e => e.relationship === filterRel);
  }, [data, filterRel]);

  const nodesByType = useMemo(() => {
    if (!data) return {};
    const map: Record<string, Set<string>> = {};
    for (const e of data.edges) {
      if (!map[e.source_type]) map[e.source_type] = new Set();
      if (!map[e.target_type]) map[e.target_type] = new Set();
      map[e.source_type].add(e.source_id);
      map[e.target_type].add(e.target_id);
    }
    return map;
  }, [data]);

  const maxWeight = data ? getMaxWeight(data.edges) : 1;

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-lg font-semibold">{error}</h3>
        <Button variant="outline" className="mt-4" onClick={handleRefresh}>Retry</Button>
      </div>
    );
  }

  const isEmpty = !data || data.edges.length === 0;

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Graph</h1>
            <p className="text-muted-foreground mt-1">
              {data ? `${data.total_edges} relationship${data.total_edges !== 1 ? 's' : ''} discovered by agents` : 'Explore discovered relationships'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {isEmpty ? (
        <Card className="glass-card">
          <CardContent className="pt-6 text-center py-16 text-muted-foreground">
            <Network className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-semibold">Knowledge graph is empty</h3>
            <p className="text-sm mt-2 max-w-md mx-auto">Agents will populate it as they discover relationships between companies, leads, technologies, and more.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Relationship Stats */}
          {data && data.relationship_stats.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Relationship Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.relationship_stats.map((stat) => {
                    const pct = data.total_edges > 0 ? (stat.count / data.total_edges) * 100 : 0;
                    return (
                      <div key={stat.relationship} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-36 truncate" title={stat.relationship}>
                          {stat.relationship.replace(/_/g, ' ')}
                        </span>
                        <div className="flex-1 h-6 bg-secondary/40 rounded-md overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-md', getRelColor(stat.relationship).split(' ')[0])}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{stat.count} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Graph Visualization Placeholder */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Graph Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative min-h-[300px] rounded-xl border border-secondary/30 bg-secondary/5 p-6 overflow-hidden">
                  {/* Node groups */}
                  <div className="flex flex-wrap gap-8 justify-center">
                    {Object.entries(nodesByType).map(([type, ids], groupIdx) => {
                      const colors = getNodeColor(type);
                      return (
                        <motion.div
                          key={type}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * groupIdx }}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            {type} ({ids.size})
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center max-w-[200px]">
                            {[...ids].slice(0, 6).map((id) => (
                              <div
                                key={id}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg border text-xs font-medium truncate max-w-[120px]',
                                  colors.bg,
                                  colors.border,
                                  colors.text
                                )}
                                title={id}
                              >
                                {id}
                              </div>
                            ))}
                            {ids.size > 6 && (
                              <span className="text-[10px] text-muted-foreground">+{ids.size - 6} more</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Connection lines (decorative) */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {filteredEdges.slice(0, 15).map((edge, i) => (
                      <div
                        key={i}
                        className="absolute h-px bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent"
                        style={{
                          top: `${20 + (i * 17) % 60}%`,
                          left: `${5 + (i * 23) % 30}%`,
                          width: `${30 + (i * 11) % 40}%`,
                          transform: `rotate(${-5 + (i * 7) % 10}deg)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Edges List */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Relationships ({filteredEdges.length})
                  </CardTitle>
                  <Select value={filterRel} onValueChange={setFilterRel}>
                    <option value="all">All types</option>
                    {data?.relationship_stats.map(s => (
                      <option key={s.relationship} value={s.relationship}>{s.relationship.replace(/_/g, ' ')} ({s.count})</option>
                    ))}
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {filteredEdges.map((edge, i) => (
                    <motion.div
                      key={`${edge.source_id}-${edge.target_id}-${i}`}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                    >
                      {/* Source */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', getRelColor(edge.source_type))}>
                          {edge.source_type}
                        </span>
                        <span className="text-sm truncate max-w-[100px]" title={edge.source_id}>{edge.source_id}</span>
                      </div>

                      {/* Arrow + Relationship */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge variant="outline" className={cn('text-xs whitespace-nowrap', getRelColor(edge.relationship))}>
                          {edge.relationship.replace(/_/g, ' ')}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      {/* Target */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', getRelColor(edge.target_type))}>
                          {edge.target_type}
                        </span>
                        <span className="text-sm truncate max-w-[100px]" title={edge.target_id}>{edge.target_id}</span>
                      </div>

                      {/* Weight bar */}
                      <div className="ml-auto flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(edge.weight / maxWeight) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{(edge.weight * 100).toFixed(0)}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
