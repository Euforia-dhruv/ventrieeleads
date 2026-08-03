'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Users, Target, BarChart3, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, getScoreColor, statusColors, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Campaign {
  id: string; name: string; description: string; status: string;
  industry_filter: string[]; location_filter: string[];
  lead_score_min: number; lead_score_max: number; notes: string;
  lead_count: number; created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<any[]>([]);
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', status: 'active', lead_score_min: 0, lead_score_max: 100 });

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const createCampaign = async () => {
    if (!form.name) return;
    await fetch('/api/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: '', description: '', status: 'active', lead_score_min: 0, lead_score_max: 100 });
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    fetchCampaigns();
  };

  const viewCampaignLeads = async (id: string) => {
    setSelectedCampaign(id);
    const [leadsRes, availRes] = await Promise.all([
      fetch(`/api/campaigns/${id}/leads`),
      fetch('/api/leads?limit=100'),
    ]);
    const leadsData = await leadsRes.json();
    const availData = await availRes.json();
    setCampaignLeads(leadsData.data || []);
    setAvailableLeads(availData.data || []);
  };

  const addLeadToCampaign = async (leadId: string) => {
    if (!selectedCampaign) return;
    await fetch(`/api/campaigns/${selectedCampaign}/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    });
    viewCampaignLeads(selectedCampaign);
  };

  const removeLeadFromCampaign = async (leadId: string) => {
    if (!selectedCampaign) return;
    await fetch(`/api/campaigns/${selectedCampaign}/leads/${leadId}`, { method: 'DELETE' });
    viewCampaignLeads(selectedCampaign);
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const totalLeads = campaigns.reduce((acc, c) => acc + (c.lead_count || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage your lead generation campaigns</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{activeCampaigns.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Total Leads in Campaigns</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Total Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{campaigns.length}</div></CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input placeholder="Campaign name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <Input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Min score" value={form.lead_score_min || ''} onChange={e => setForm({ ...form, lead_score_min: parseInt(e.target.value) || 0 })} className="w-24" />
                    <Input type="number" placeholder="Max score" value={form.lead_score_max || ''} onChange={e => setForm({ ...form, lead_score_max: parseInt(e.target.value) || 100 })} className="w-24" />
                  </div>
                  <Button onClick={createCampaign}>Create Campaign</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : campaigns.length === 0 ? (
          <Card><CardContent className="text-center py-12 text-muted-foreground">No campaigns yet. Create one to organize your leads.</CardContent></Card>
        ) : (
          campaigns.map((campaign, index) => (
            <motion.div key={campaign.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className={cn('hover:shadow-md transition-shadow', selectedCampaign === campaign.id && 'border-primary')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        <Badge variant={campaign.status === 'active' ? 'success' : 'secondary'}>{campaign.status}</Badge>
                        <Badge variant="outline">{campaign.lead_count || 0} leads</Badge>
                      </div>
                      {campaign.description && <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {campaign.industry_filter?.length > 0 && <span>Industries: {campaign.industry_filter.join(', ')}</span>}
                        {campaign.location_filter?.length > 0 && <span>Locations: {campaign.location_filter.join(', ')}</span>}
                        <span>Score: {campaign.lead_score_min}-{campaign.lead_score_max}</span>
                        <span>Created: {formatDate(campaign.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => viewCampaignLeads(campaign.id)}>
                        {selectedCampaign === campaign.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteCampaign(campaign.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedCampaign === campaign.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t space-y-4 overflow-hidden">
                        <h4 className="font-medium text-sm">Campaign Leads</h4>
                        {campaignLeads.length > 0 ? (
                          <div className="space-y-2">
                            {campaignLeads.map((cl: any) => (
                              <div key={cl.lead_id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                                <div className="flex items-center gap-2">
                                  <Link href={`/leads/${cl.lead_id}`} className="text-sm font-medium hover:underline">{cl.company_name}</Link>
                                  <span className="text-xs text-muted-foreground">{cl.industry}</span>
                                  <span className={cn('text-xs font-semibold', getScoreColor(cl.score || 0))}>{cl.score || 0}</span>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => removeLeadFromCampaign(cl.lead_id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No leads in this campaign yet.</p>
                        )}

                        <h4 className="font-medium text-sm">Add Leads</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {availableLeads.filter(l => !campaignLeads.some(cl => cl.lead_id === l.id)).slice(0, 20).map((l: any) => (
                            <div key={l.id} className="flex items-center justify-between p-2 rounded hover:bg-secondary/30">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{l.company_name}</span>
                                <span className="text-xs text-muted-foreground">{l.industry}</span>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => addLeadToCampaign(l.id)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
