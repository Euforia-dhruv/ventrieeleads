'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Plus, ToggleLeft, ToggleRight, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/utils';

interface Rule {
  id: string; name: string; description: string;
  is_active: boolean; trigger_event: string;
  conditions: any[]; actions: any[];
  total_executions: number; last_executed_at: string;
  priority: number;
}

interface Stats {
  total_rules: number; active_rules: number;
  total_executions: number; success_rate: number;
}

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', description: '', trigger_event: 'lead_discovered',
    conditions: [{ field: 'website_score', operator: '<', value: 50 }],
    actions: [{ type: 'generate_proposal', params: {} }],
    priority: 5,
  });

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Rule[] }>('/automation/rules'),
      apiFetch<{ data: Stats }>('/automation/stats'),
    ]).then(([r, s]) => {
      setRules(r.data || []);
      setStats(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: string) => {
    await apiFetch(`/automation/rules/${id}/toggle`, { method: 'PUT' });
    setRules(rules.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/automation/rules/${id}`, { method: 'DELETE' });
    setRules(rules.filter(r => r.id !== id));
  };

  const handleCreate = async () => {
    await apiFetch('/automation/rules', {
      method: 'POST',
      body: JSON.stringify(newRule),
    });
    setShowCreate(false);
    setLoading(true);
    const r = await apiFetch<{ data: Rule[] }>('/automation/rules');
    setRules(r.data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Intelligent Automation</h1>
              <p className="text-white/50 text-sm">Rule-based automated actions</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Rules', value: stats.total_rules },
              { label: 'Active', value: stats.active_rules },
              { label: 'Executions', value: stats.total_executions },
              { label: 'Success Rate', value: `${stats.success_rate}%` },
            ].map((item, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-xs text-white/50">{item.label}</span>
                <div className="text-xl font-bold text-white mt-1">{item.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <h3 className="text-white font-semibold mb-4">Create Automation Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 block mb-1">Name</label>
                <input value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                  placeholder="e.g., Auto-proposal for low-score websites" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Trigger Event</label>
                <select value={newRule.trigger_event}
                  onChange={e => setNewRule({ ...newRule, trigger_event: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50">
                  <option value="lead_discovered">Lead Discovered</option>
                  <option value="audit_completed">Audit Completed</option>
                  <option value="website_changed">Website Changed</option>
                  <option value="review_milestone">Review Milestone</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/40 block mb-1">Description</label>
                <input value={newRule.description} onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                  placeholder="Describe what this rule does" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10">Cancel</button>
              <button onClick={handleCreate}
                className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 border border-yellow-500/30">Create Rule</button>
            </div>
          </motion.div>
        )}

        {/* Rules List */}
        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <motion.div key={rule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm">{rule.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${rule.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-xs">P{rule.priority}</span>
                  </div>
                  {rule.description && (
                    <p className="text-white/40 text-xs mt-1">{rule.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                    <span>Trigger: <span className="text-white/60">{rule.trigger_event}</span></span>
                    <span>Conditions: <span className="text-white/60">{rule.conditions.length}</span></span>
                    <span>Actions: <span className="text-white/60">{rule.actions.length}</span></span>
                    <span>Executions: <span className="text-white/60">{rule.total_executions}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(rule.id)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    {rule.is_active ?
                      <ToggleRight className="h-5 w-5 text-emerald-400" /> :
                      <ToggleLeft className="h-5 w-5 text-white/40" />
                    }
                  </button>
                  <button onClick={() => handleDelete(rule.id)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <Trash2 className="h-4 w-4 text-white/30 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
