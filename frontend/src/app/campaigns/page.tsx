'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, Plus, Users, BarChart3, ArrowUpRight, Loader2, Play, Pause, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  status: string;
  lead_count?: number;
  industry?: string;
  city?: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newCity, setNewCity] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const createCampaign = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, industry: newIndustry, city: newCity }),
      });
      setNewName(''); setNewIndustry(''); setNewCity('');
      setShowCreate(false);
      fetchCampaigns();
    } catch {} finally { setCreating(false); }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch {}
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Campaigns</h1>
          <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">Manage outreach campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg text-[13px] font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass-card rounded-xl p-4 space-y-3 animate-fade-in">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Campaign name"
            className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all" />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all" />
            <input type="text" value={newCity} onChange={(e) => setNewCity(e.target.value)}
              placeholder="City (optional)"
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={createCampaign} disabled={creating || !newName}
              className="flex items-center gap-1.5 px-3 h-8 bg-blue-600 hover:bg-blue-500 disabled:bg-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[12px] font-medium transition-all">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-3 h-8 text-[12px] text-[hsl(215,16%,50%)] hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : campaigns.length > 0 ? (
        <div className="space-y-2">
          {campaigns.map((c, i) => (
            <div key={c.id} className="glass-card rounded-xl p-4 flex items-center justify-between group animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-white">{c.name}</p>
                  <p className="text-[11px] text-[hsl(215,16%,45%)]">
                    {c.lead_count || 0} leads{c.industry ? ` · ${c.industry}` : ''}{c.city ? ` · ${c.city}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium",
                  c.status === 'active' ? "bg-green-500/15 text-green-400" : "bg-white/[0.06] text-[hsl(215,16%,50%)]"
                )}>
                  {c.status}
                </span>
                <button onClick={() => deleteCampaign(c.id)}
                  className="p-1.5 text-[hsl(215,16%,30%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
          <p className="text-[14px] text-[hsl(215,16%,40%)]">No campaigns yet</p>
          <p className="text-[12px] text-[hsl(215,16%,30%)] mt-1">Create a campaign to organize your outreach</p>
        </div>
      )}
    </div>
  );
}
