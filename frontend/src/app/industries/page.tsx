'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils';

interface Industry {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string;
  is_active: boolean;
  sort_order: number;
  children?: Industry[];
}

export default function IndustriesPage() {
  const [tree, setTree] = useState<Industry[]>([]);
  const [allIndustries, setAllIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', parent_id: '', icon: '', sort_order: 0 });
  const [stats, setStats] = useState({ root: 0, sub: 0, total: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [treeRes, allRes] = await Promise.all([
        apiFetch<any>('/industries/tree?max_depth=3'),
        apiFetch<any>('/industries?depth=1000'),
      ]);
      setTree(treeRes.data || []);
      setAllIndustries(allRes.data || []);

      const all = allRes.data || [];
      setStats({
        root: all.filter((i: Industry) => !i.parent_id).length,
        sub: all.filter((i: Industry) => i.parent_id).length,
        total: all.length,
      });
    } catch (e) {
      console.error('Failed to load industries', e);
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
      await apiFetch('/industries', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ name: '', slug: '', parent_id: '', icon: '', sort_order: 0 });
      loadData();
    } catch (e) {
      console.error('Failed to create industry', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this industry?')) return;
    try {
      await apiFetch(`/industries/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error('Failed to delete industry', e);
    }
  };

  const filterTree = (nodes: Industry[]): Industry[] => {
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

  const renderNode = (node: Industry, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const childCount = node.children?.length || 0;

    return (
      <div key={node.id} style={{ marginLeft: depth * 24 }}>
        <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/5 rounded-lg group">
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center text-gray-500 ${!hasChildren ? 'invisible' : ''}`}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
          </button>
          <span className="text-lg">
            {depth === 0 ? '🏭' : depth === 1 ? '📂' : '📄'}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-200 font-medium">{node.name}</span>
            {childCount > 0 && (
              <span className="text-xs text-gray-500 ml-2">({childCount} sub-industries)</span>
            )}
          </div>
          <span className="text-xs text-gray-500">{node.slug}</span>
          {!node.is_active && <span className="text-xs text-red-400">inactive</span>}
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
            <h1 className="text-2xl font-bold text-white">Industry Taxonomy</h1>
            <p className="text-gray-500 text-sm mt-1">Multi-level industry hierarchy — unlimited depth</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            + Add Industry
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Root Industries', value: stats.root, color: 'text-blue-400' },
            { label: 'Sub-Industries', value: stats.sub, color: 'text-purple-400' },
            { label: 'Total', value: stats.total, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-gray-500 text-xs">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Add New Industry</h3>
            <div className="grid grid-cols-5 gap-3">
              <input placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <input placeholder="Slug" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <input placeholder="Icon (emoji)" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <select value={formData.parent_id} onChange={e => setFormData({...formData, parent_id: e.target.value})}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">No parent (root)</option>
                {allIndustries.filter(i => !i.parent_id).map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <button onClick={handleCreate} className="bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
                Create
              </button>
            </div>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <input
            placeholder="Search industries..."
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
                <p className="text-gray-500 text-sm py-8 text-center">No industries found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
