'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  KanbanSquare,
  Loader2,
  Mail,
  Phone,
  Globe,
  MapPin,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ArrowRight,
} from 'lucide-react';
import { cn, getScoreColor } from '@/lib/utils';

interface StageLead {
  pipeline_id: string;
  lead_id: string;
  lead_name: string;
  email?: string;
  phone?: string;
  city?: string;
  industry?: string;
  score?: number;
  company_name?: string;
  website?: string;
  confidence?: number;
  estimated_value_min?: number;
  estimated_value_max?: number;
}

interface PipelineStage {
  stage_id: string;
  stage_name: string;
  slug: string;
  color: string;
  icon?: string;
  sort_order: number;
  leads: StageLead[];
}

interface BoardData {
  stages: PipelineStage[];
}

export default function PipelinePage() {
  const [board, setBoard] = useState<BoardData>({ stages: [] });
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<{ leadId: string; to: string } | null>(null);
  const [stageSummary, setStageSummary] = useState<Record<string, number>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/board', { cache: 'no-store' });
      const data = await res.json();
      setBoard(data.data || { stages: [] });
      const summary: Record<string, number> = {};
      const stages = (data.data?.stages || []) as PipelineStage[];
      stages.forEach((s) => {
        summary[s.stage_id] = s.leads.length;
      });
      setStageSummary(summary);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const moveLead = async (leadId: string, toStageId: string) => {
    setMoving({ leadId, to: toStageId });
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/pipeline/leads/${leadId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage_id: toStageId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBoard();
      }
    } catch {
    } finally {
      setMoving(null);
    }
  };

  const totalLeads = board.stages.reduce((sum, s) => sum + s.leads.length, 0);

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
            <KanbanSquare className="w-5 h-5 text-blue-400" /> Pipeline
          </h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">{totalLeads} leads in pipeline</p>
        </div>
        <button
          onClick={fetchBoard}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-[hsl(215,20%,55%)] hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        </div>
      ) : board.stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <KanbanSquare className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
          <p className="text-[14px] text-[hsl(215,16%,40%)]">No pipeline stages configured</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {board.stages.map((stage) => (
            <div key={stage.stage_id} className="w-[290px] shrink-0 flex flex-col max-h-[calc(100vh-200px)]">
              {/* Stage header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-[13px] font-semibold text-white flex-1 truncate">{stage.stage_name}</h3>
                <span className="text-[11px] text-[hsl(215,20%,45%)]">
                  {stageSummary[stage.stage_id] || 0}
                </span>
              </div>

              {/* Leads column */}
              <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1 pb-2">
                {stage.leads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.06] h-24 flex items-center justify-center">
                    <p className="text-[11px] text-[hsl(215,16%,30%)]">No leads</p>
                  </div>
                ) : (
                  stage.leads.map((lead) => (
                    <div
                      key={lead.pipeline_id}
                      className="glass-card rounded-xl p-3 hover:border-white/[0.1] transition-all"
                    >
                      {/* Company + score */}
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/leads/${lead.lead_id}`}
                          className="min-w-0"
                        >
                          <p className="text-[13px] font-semibold text-white truncate hover:text-blue-400 transition-colors">
                            {lead.company_name || lead.lead_name || 'Unknown'}
                          </p>
                          {lead.company_name !== lead.lead_name && lead.lead_name && (
                            <p className="text-[10px] text-[hsl(215,16%,35%)] truncate">{lead.lead_name}</p>
                          )}
                        </Link>
                        <span
                          className={cn(
                            'text-[13px] font-bold shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.04]',
                            getScoreColor(lead.score || 0),
                          )}
                        >
                          {lead.score || 0}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="mt-2 space-y-1">
                        {lead.city && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[hsl(215,20%,45%)]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{lead.city}</span>
                          </div>
                        )}
                        {lead.industry && (
                          <p className="text-[11px] text-[hsl(215,20%,45%)] truncate">{lead.industry}</p>
                        )}
                        {lead.estimated_value_max ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-blue-300/70">
                            <TrendingUp className="w-3 h-3 shrink-0" />
                            <span>Up to ${lead.estimated_value_max.toLocaleString()}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 pt-1">
                          {lead.phone && <Phone className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                          {lead.email && <Mail className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                          {lead.website && <Globe className="w-3 h-3 text-[hsl(215,16%,40%)]" />}
                          <span className="flex-1" />
                          {lead.confidence ? (
                            <span className="text-[10px] text-[hsl(215,16%,35%)]">
                              {Math.round(lead.confidence * 100)}% conf
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Move controls */}
                      <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                        <button
                          onClick={() => {
                            const idx = board.stages.findIndex((s) => s.stage_id === stage.stage_id);
                            if (idx > 0) moveLead(lead.lead_id, board.stages[idx - 1].stage_id);
                          }}
                          disabled={moving?.leadId === lead.lead_id || stage.sort_order === 0}
                          aria-label={`Move ${lead.lead_name} to previous stage`}
                          className="p-1 rounded-md text-[hsl(215,16%,40%)] hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {moving?.leadId === lead.lead_id ? (
                          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        ) : (
                          <span className="text-[10px] text-[hsl(215,16%,35%)]">{stage.stage_name}</span>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === lead.pipeline_id ? null : lead.pipeline_id)}
                            disabled={moving?.leadId === lead.lead_id}
                            aria-label="Quick move"
                            className="p-1 rounded-md text-[hsl(215,16%,40%)] hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenu === lead.pipeline_id && (
                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-[hsl(224,71%,8%)] border border-white/[0.08] rounded-lg shadow-xl z-20 py-1">
                              <div className="px-2 py-1 text-[10px] text-[hsl(215,16%,40%)] uppercase tracking-wider">Move to</div>
                              {board.stages.map((s) => (
                                <button
                                  key={s.stage_id}
                                  onClick={() => moveLead(lead.lead_id, s.stage_id)}
                                  disabled={s.stage_id === stage.stage_id}
                                  className={cn(
                                    'w-full text-left px-2 py-1.5 text-[12px] flex items-center gap-2 transition-all',
                                    s.stage_id === stage.stage_id
                                      ? 'text-blue-400 bg-blue-500/10'
                                      : 'text-[hsl(215,20%,60%)] hover:bg-white/[0.04] hover:text-white'
                                  )}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.stage_name}
                                  {s.stage_id === stage.stage_id && <ArrowRight className="w-3 h-3 ml-auto" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const idx = board.stages.findIndex((s) => s.stage_id === stage.stage_id);
                            if (idx < board.stages.length - 1) {
                              moveLead(lead.lead_id, board.stages[idx + 1].stage_id);
                            }
                          }}
                          disabled={
                            moving?.leadId === lead.lead_id || stage.sort_order === board.stages.length - 1
                          }
                          aria-label={`Move ${lead.lead_name} to next stage`}
                          className="p-1 rounded-md text-[hsl(215,16%,40%)] hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
