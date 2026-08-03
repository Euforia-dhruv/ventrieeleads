'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Plus, Play, Pause, RotateCcw, Trash2, ChevronDown, ChevronRight,
  MapPin, Factory, Zap, Clock, CheckCircle2, XCircle, SkipForward, Loader2,
  Globe, Search, X, AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface Campaign {
  id: string; name: string; description: string; status: string;
  country_ids: string[]; state_ids: string[]; city_ids: string[];
  industry_ids: string[]; provider_slugs: string[];
  priority: number; max_businesses_per_city: number; concurrency: number;
  total_jobs: number; queued_jobs: number; running_jobs: number;
  completed_jobs: number; failed_jobs: number; skipped_jobs: number;
  total_businesses: number; unique_businesses: number; duplicate_count: number;
  created_at: string;
}
interface Location { id: string; name: string; location_type: string; parent_id: string | null; country_code: string; }
interface Industry { id: string; name: string; slug: string; parent_id: string | null; icon?: string; children?: Industry[]; }
interface Provider { slug: string; name: string; is_ready: boolean; }
interface CampaignJob {
  id: string; status: string; provider_slug: string; country_code: string;
  state_name: string; city_name: string; industry_name: string;
  businesses_found: number; duplicates_found: number; new_businesses: number;
  runtime_ms: number; error_message: string | null; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/60', active: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  running: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  paused: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 border border-red-500/20',
};
const JOB_STATUS_COLORS: Record<string, string> = {
  queued: 'text-white/40', running: 'text-blue-400', completed: 'text-emerald-400',
  failed: 'text-red-400', skipped: 'text-yellow-400',
};

export default function DiscoveryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignJobs, setCampaignJobs] = useState<CampaignJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [countries, setCountries] = useState<Location[]>([]);
  const [states, setStates] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);

  const [form, setForm] = useState({
    name: '', description: '', country_ids: [] as string[], state_ids: [] as string[],
    city_ids: [] as string[], industry_ids: [] as string[], provider_slugs: [] as string[],
    priority: 5, max_businesses_per_city: 50, concurrency: 5, schedule_type: 'once',
  });

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await apiFetch<{ data: Campaign[] }>('/discovery-campaigns');
      setCampaigns(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Location[] }>('/locations?type=country'),
      apiFetch<{ data: Industry[] }>('/industries'),
      apiFetch<{ data: Provider[] }>('/providers'),
    ]).then(([locData, indData, provData]) => {
      setLocations(locData.data || []);
      setCountries((locData.data || []).filter((l: Location) => l.location_type === 'country'));
      setIndustries(indData.data || []);
      setProviders(provData.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.country_ids.length > 0) {
      apiFetch<{ data: Location[] }>(`/locations?type=state`).then(d => {
        const filtered = (d.data || []).filter((l: Location) =>
          form.country_ids.some(cid => {
            const c = countries.find(x => x.id === cid);
            return c && l.country_code === c.country_code;
          })
        );
        setStates(filtered);
      }).catch(() => setStates([]));
    } else { setStates([]); setCities([]); }
  }, [form.country_ids, countries]);

  useEffect(() => {
    if (form.state_ids.length > 0) {
      apiFetch<{ data: Location[] }>(`/locations?type=city`).then(d => {
        const filtered = (d.data || []).filter((l: Location) =>
          form.state_ids.includes(l.parent_id || '')
        );
        setCities(filtered);
      }).catch(() => setCities([]));
    } else { setCities([]); }
  }, [form.state_ids]);

  const loadJobs = async (campaignId: string) => {
    setJobsLoading(true);
    try {
      const data = await apiFetch<{ data: CampaignJob[] }>(`/discovery-campaigns/${campaignId}/jobs?limit=100`);
      setCampaignJobs(data.data || []);
    } catch (e) { console.error(e); }
    setJobsLoading(false);
  };

  const selectCampaign = async (c: Campaign) => {
    setSelectedCampaign(c);
    setShowForm(false);
    await loadJobs(c.id);
  };

  const createCampaign = async () => {
    if (!form.name) return;
    try {
      await apiFetch('/discovery-campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: '', description: '', country_ids: [], state_ids: [], city_ids: [],
        industry_ids: [], provider_slugs: [], priority: 5, max_businesses_per_city: 50,
        concurrency: 5, schedule_type: 'once' });
      await fetchCampaigns();
    } catch (e) { console.error(e); }
  };

  const activateCampaign = async (id: string) => {
    try {
      await apiFetch(`/discovery-campaigns/${id}/activate`, { method: 'POST' });
      await fetchCampaigns();
      if (selectedCampaign?.id === id) await loadJobs(id);
    } catch (e) { console.error(e); }
  };

  const pauseCampaign = async (id: string) => {
    try {
      await apiFetch(`/discovery-campaigns/${id}/pause`, { method: 'POST' });
      await fetchCampaigns();
    } catch (e) { console.error(e); }
  };

  const retryJobs = async (id: string) => {
    try {
      await apiFetch(`/discovery-campaigns/${id}/retry`, { method: 'POST' });
      await loadJobs(id);
    } catch (e) { console.error(e); }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await apiFetch(`/discovery-campaigns/${id}`, { method: 'DELETE' });
      if (selectedCampaign?.id === id) { setSelectedCampaign(null); setCampaignJobs([]); }
      await fetchCampaigns();
    } catch (e) { console.error(e); }
  };

  const toggleArrayItem = (field: keyof typeof form, value: string) => {
    setForm(prev => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const estimatedJobs = form.country_ids.length * form.state_ids.length * form.city_ids.length *
    Math.max(form.industry_ids.length, 1) * Math.max(form.provider_slugs.length || 1, 1);

  const leafIndustries = industries.filter(i => !industries.some(c => c.parent_id === i.id));
  const rootIndustries = industries.filter(i => !i.parent_id);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              Discovery Orchestrator
            </h1>
            <p className="text-white/50 mt-1">Generate discovery jobs across countries, industries, and providers</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(!showForm); setSelectedCampaign(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition">
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showForm && (
            <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
                  <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Campaign Name *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Hotels in Europe"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Description</label>
                    <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>

                {/* Locations */}
                <div className="mb-4">
                  <label className="block text-xs text-white/50 mb-2">
                    <Globe className="inline h-3 w-3 mr-1" /> Locations
                  </label>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-white/30 mr-2">Countries:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {countries.map(c => (
                          <button key={c.id} onClick={() => toggleArrayItem('country_ids', c.id)}
                            className={`px-2 py-0.5 rounded text-xs border transition ${
                              form.country_ids.includes(c.id)
                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                            }`}>{c.name}</button>
                        ))}
                      </div>
                    </div>
                    {states.length > 0 && (
                      <div>
                        <span className="text-xs text-white/30 mr-2">States ({states.length}):</span>
                        <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                          {states.map(s => (
                            <button key={s.id} onClick={() => toggleArrayItem('state_ids', s.id)}
                              className={`px-2 py-0.5 rounded text-xs border transition ${
                                form.state_ids.includes(s.id)
                                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                              }`}>{s.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {cities.length > 0 && (
                      <div>
                        <span className="text-xs text-white/30 mr-2">Cities ({cities.length}):</span>
                        <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                          {cities.map(c => (
                            <button key={c.id} onClick={() => toggleArrayItem('city_ids', c.id)}
                              className={`px-2 py-0.5 rounded text-xs border transition ${
                                form.city_ids.includes(c.id)
                                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                              }`}>{c.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Industries */}
                <div className="mb-4">
                  <label className="block text-xs text-white/50 mb-2">
                    <Factory className="inline h-3 w-3 mr-1" /> Industries
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {rootIndustries.map(r => {
                      const subInds = leafIndustries.filter(i => i.parent_id === r.id);
                      const allSelected = subInds.every(i => form.industry_ids.includes(i.id));
                      return (
                        <button key={r.id} onClick={() => {
                          if (allSelected) {
                            setForm(f => ({ ...f, industry_ids: f.industry_ids.filter(id => !subInds.some(s => s.id === id)) }));
                          } else {
                            setForm(f => ({ ...f, industry_ids: [...new Set([...f.industry_ids, ...subInds.map(s => s.id)])] }));
                          }
                        }}
                          className={`px-2 py-0.5 rounded text-xs border transition ${
                            allSelected
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                          }`}>
                          {r.icon} {r.name}{subInds.length > 1 ? ` (${subInds.length})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Providers */}
                <div className="mb-4">
                  <label className="block text-xs text-white/50 mb-2">
                    <Zap className="inline h-3 w-3 mr-1" /> Providers
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {providers.map(p => (
                      <button key={p.slug} onClick={() => toggleArrayItem('provider_slugs', p.slug)}
                        className={`px-2 py-0.5 rounded text-xs border transition ${
                          form.provider_slugs.includes(p.slug)
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                        }`}>
                        {p.name} {!p.is_ready && <span className="text-yellow-400 ml-1">!</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Priority (1-10)</label>
                    <input type="number" min={1} max={10} value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 5 }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Max per City</label>
                    <input type="number" min={1} value={form.max_businesses_per_city}
                      onChange={e => setForm(f => ({ ...f, max_businesses_per_city: parseInt(e.target.value) || 50 }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Concurrency</label>
                    <input type="number" min={1} max={20} value={form.concurrency}
                      onChange={e => setForm(f => ({ ...f, concurrency: parseInt(e.target.value) || 5 }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Schedule</label>
                    <select value={form.schedule_type}
                      onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>

                {/* Preview + Submit */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="text-sm text-white/40">
                    Estimated jobs: <span className="text-white font-mono">{estimatedJobs.toLocaleString()}</span>
                    {estimatedJobs > 0 && (
                      <span className="ml-2 text-white/30">
                        ({form.country_ids.length || 'all'} countries × {Math.max(form.industry_ids.length, 1)} industries × {Math.max(form.provider_slugs.length || 1, 1)} providers)
                      </span>
                    )}
                  </div>
                  <button onClick={createCampaign}
                    disabled={!form.name}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium disabled:opacity-30 hover:opacity-90 transition">
                    Create Campaign
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign List */}
          <div className={`${selectedCampaign ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-white/40">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading campaigns...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-20 bg-white/5 border border-white/10 rounded-xl">
                <Rocket className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">No discovery campaigns yet</p>
                <button onClick={() => setShowForm(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition">
                  Create your first campaign
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedCampaign && (
                  <button onClick={() => { setSelectedCampaign(null); setCampaignJobs([]); }}
                    className="text-sm text-white/40 hover:text-white/60 flex items-center gap-1 mb-2">
                    <ChevronRight className="h-3 w-3 rotate-180" /> Back to all campaigns
                  </button>
                )}
                {campaigns.map(c => {
                  const progress = c.total_jobs > 0 ? Math.round((c.completed_jobs + c.skipped_jobs) / c.total_jobs * 100) : 0;
                  return (
                    <motion.div key={c.id} layout
                      onClick={() => selectCampaign(c)}
                      className={`bg-white/5 border rounded-xl p-4 cursor-pointer transition hover:bg-white/[0.07] ${
                        selectedCampaign?.id === c.id ? 'border-blue-500/40' : 'border-white/10'
                      }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-white text-sm">{c.name}</h3>
                          {c.description && <p className="text-xs text-white/40 mt-0.5">{c.description}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[c.status] || ''}`}>
                          {c.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/40 mb-2">
                        <span>{c.country_ids?.length || 'All'} countries</span>
                        <span>{c.industry_ids?.length || 'All'} industries</span>
                        <span>{c.provider_slugs?.length || 'All'} providers</span>
                      </div>

                      <div className="w-full bg-white/5 rounded-full h-1.5 mb-2">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%` }} />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex gap-3 text-white/40">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> {c.completed_jobs}</span>
                          <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 text-blue-400" /> {c.running_jobs}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-white/30" /> {c.queued_jobs}</span>
                          <span className="flex items-center gap-1"><SkipForward className="h-3 w-3 text-yellow-400" /> {c.skipped_jobs}</span>
                          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400" /> {c.failed_jobs}</span>
                        </div>
                        <span className="text-white/30">{c.total_businesses} businesses</span>
                      </div>

                      {selectedCampaign?.id === c.id && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-white/5" onClick={e => e.stopPropagation()}>
                          {(c.status === 'draft' || c.status === 'paused') && (
                            <button onClick={() => activateCampaign(c.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs hover:bg-emerald-500/25 transition">
                              <Play className="h-3 w-3" /> Activate
                            </button>
                          )}
                          {c.status === 'active' && (
                            <button onClick={() => pauseCampaign(c.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-xs hover:bg-yellow-500/25 transition">
                              <Pause className="h-3 w-3" /> Pause
                            </button>
                          )}
                          {c.failed_jobs > 0 && (
                            <button onClick={() => retryJobs(c.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs hover:bg-blue-500/25 transition">
                              <RotateCcw className="h-3 w-3" /> Retry Failed
                            </button>
                          )}
                          <button onClick={() => deleteCampaign(c.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs hover:bg-red-500/25 transition ml-auto">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Campaign Jobs Detail */}
          {selectedCampaign && (
            <div className="lg:col-span-2">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-lg font-semibold text-white mb-1">{selectedCampaign.name} — Jobs</h2>
                <p className="text-xs text-white/40 mb-4">
                  {selectedCampaign.total_jobs} total jobs · {selectedCampaign.total_businesses} businesses discovered
                </p>

                {jobsLoading ? (
                  <div className="flex items-center justify-center py-10 text-white/40">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading jobs...
                  </div>
                ) : campaignJobs.length === 0 ? (
                  <div className="text-center py-10 text-white/30">No jobs generated yet. Activate the campaign.</div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto space-y-1">
                    {campaignJobs.map(j => (
                      <div key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] text-xs">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          j.status === 'completed' ? 'bg-emerald-400' :
                          j.status === 'running' ? 'bg-blue-400 animate-pulse' :
                          j.status === 'failed' ? 'bg-red-400' :
                          j.status === 'skipped' ? 'bg-yellow-400' : 'bg-white/20'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-white truncate block">{j.industry_name} — {j.city_name}, {j.country_code}</span>
                          <span className="text-white/30">{j.provider_slug}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`capitalize ${JOB_STATUS_COLORS[j.status] || ''}`}>{j.status}</span>
                          {j.businesses_found > 0 && (
                            <span className="text-white/30 ml-2">{j.businesses_found} found</span>
                          )}
                          {j.new_businesses > 0 && (
                            <span className="text-emerald-400/60 ml-1">({j.new_businesses} new)</span>
                          )}
                        </div>
                        {j.error_message && (
                          <span title={j.error_message}><AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" /></span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
