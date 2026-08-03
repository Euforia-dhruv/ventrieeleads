'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';

interface Location {
  id: string;
  name: string;
  slug: string;
  location_type: string;
  parent_id: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number;
  gdp_usd: number;
  is_active: boolean;
  children?: Location[];
}

const TYPE_LABELS: Record<string, string> = {
  country: 'Country',
  state: 'State/Province',
  city: 'City/District',
  area: 'Area',
};

const TYPE_COLORS: Record<string, string> = {
  country: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  state: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  city: 'bg-green-500/10 text-green-400 border-green-500/20',
  area: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

export default function LocationsPage() {
  const [tree, setTree] = useState<Location[]>([]);
  const [countries, setCountries] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('country');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', location_type: 'country', parent_id: '', country_code: '' });
  const [stats, setStats] = useState({ countries: 0, states: 0, cities: 0, total: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [treeRes, countriesRes, allRes] = await Promise.all([
        apiFetch<any>('/locations/tree?max_depth=3'),
        apiFetch<any>('/locations?type=country'),
        apiFetch<any>('/locations?depth=1000'),
      ]);
      setTree(treeRes.data || []);
      setCountries(countriesRes.data || []);

      const all = allRes.data || [];
      setStats({
        countries: all.filter((l: Location) => l.location_type === 'country').length,
        states: all.filter((l: Location) => l.location_type === 'state').length,
        cities: all.filter((l: Location) => l.location_type === 'city').length,
        total: all.length,
      });
    } catch (e) {
      console.error('Failed to load locations', e);
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    try {
      await apiFetch('/locations', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ name: '', slug: '', location_type: 'country', parent_id: '', country_code: '' });
      loadData();
    } catch (e) {
      console.error('Failed to create location', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    try {
      await apiFetch(`/locations/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error('Failed to delete location', e);
    }
  };

  const filterTree = (nodes: Location[]): Location[] => {
    if (!search) return nodes;
    return nodes.filter(n => {
      const match = n.name.toLowerCase().includes(search.toLowerCase());
      const childMatch = n.children && filterTree(n.children).length > 0;
      return match || childMatch;
    }).map(n => ({
      ...n,
      children: n.children ? filterTree(n.children) : [],
    }));
  };

  const renderNode = (node: Location, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 py-2 px-3 hover:bg-white/5 rounded-lg group">
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center text-gray-500 ${!hasChildren ? 'invisible' : ''}`}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
          </button>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[node.location_type] || 'bg-gray-500/10 text-gray-400'}`}>
            {TYPE_LABELS[node.location_type] || node.location_type}
          </span>
          <span className="text-sm text-gray-200 font-medium">{node.name}</span>
          {node.country_code && <span className="text-xs text-gray-500">{node.country_code}</span>}
          {node.population && <span className="text-xs text-gray-500 ml-auto">{(node.population / 1000000).toFixed(1)}M</span>}
          <button
            onClick={() => handleDelete(node.id)}
            className="text-red-400 opacity-0 group-hover:opacity-100 text-xs ml-2"
          >
            ×
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = filterTree(tree);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Global Locations</h1>
            <p className="text-gray-500 text-sm mt-1">Country → State → City → District hierarchy</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            + Add Location
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Countries', value: stats.countries, color: 'text-blue-400' },
            { label: 'States/Provinces', value: stats.states, color: 'text-purple-400' },
            { label: 'Cities/Districts', value: stats.cities, color: 'text-green-400' },
            { label: 'Total Locations', value: stats.total, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-gray-500 text-xs">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Add New Location</h3>
            <div className="grid grid-cols-5 gap-3">
              <input placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <input placeholder="Slug" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <select value={formData.location_type} onChange={e => setFormData({...formData, location_type: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="country">Country</option>
                <option value="state">State/Province</option>
                <option value="city">City/District</option>
                <option value="area">Area</option>
              </select>
              <select value={formData.parent_id} onChange={e => setFormData({...formData, parent_id: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">No parent (root)</option>
                {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleCreate} className="bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
                Create
              </button>
            </div>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <input
            placeholder="Search locations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white mb-4"
          />
          {loading ? (
            <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredTree.map(node => renderNode(node))}
              {filteredTree.length === 0 && (
                <p className="text-gray-500 text-sm py-8 text-center">No locations found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
