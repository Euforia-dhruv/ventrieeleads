'use client';

import { useState, useEffect } from 'react';
import { User, Key, Shield, LogOut, Save, Loader2, Plus, Trash2, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at?: string;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'api-keys' | 'password'>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
    fetchApiKeys();
  }, [user]);

  async function fetchApiKeys() {
    try {
      const res = await fetch('/api/settings/api-keys');
      const data = await res.json();
      setApiKeys(data.data || []);
    } catch {}
  }

  const saveProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName) return;
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.data?.key) setShowNewKey(data.data.key);
      setNewKeyName('');
      fetchApiKeys();
    } catch {}
  };

  const deleteApiKey = async (id: string) => {
    try {
      await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      fetchApiKeys();
    } catch {}
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setSaving(true);
    try {
      await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'api-keys' as const, label: 'API Keys', icon: Key },
    { id: 'password' as const, label: 'Password', icon: Shield },
  ];

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-white tracking-tight">Settings</h1>
        <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">Manage your account</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.04]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all -mb-px',
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-[hsl(215,16%,45%)] hover:text-white',
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 mt-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full h-10 px-3 mt-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg text-[13px] text-[hsl(215,16%,40%)] cursor-not-allowed"
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[13px] font-medium transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      )}

      {/* API Keys */}
      {activeTab === 'api-keys' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)"
                className="flex-1 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none focus:border-blue-500/40 transition-all"
              />
              <button
                onClick={createApiKey}
                className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12px] font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Create Key
              </button>
            </div>
          </div>

          {showNewKey && (
            <div className="glass-card rounded-xl p-4 border-green-500/20 bg-green-500/5">
              <p className="text-[11px] text-green-400 font-medium mb-2">
                New API key created. Copy it now &mdash; it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-black/30 rounded text-[12px] text-green-300 font-mono break-all">
                  {showNewKey}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(showNewKey);
                  }}
                  className="p-2 bg-white/[0.06] rounded hover:bg-white/[0.1] transition-colors"
                >
                  <Copy className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          <div className="glass-card rounded-xl divide-y divide-white/[0.04]">
            {apiKeys.length > 0 ? (
              apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-white">{key.name}</p>
                    <p className="text-[11px] text-[hsl(215,16%,40%)] font-mono">{key.key_prefix}...</p>
                  </div>
                  <button
                    onClick={() => deleteApiKey(key.id)}
                    className="p-1.5 text-[hsl(215,16%,35%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[hsl(215,16%,40%)]">No API keys yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">
              Current Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 mt-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[hsl(215,16%,50%)] uppercase tracking-wider">
              New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-10 px-3 mt-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[13px] text-white focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[hsl(216,34%,17%)] bg-[hsl(223,47%,11%)] text-blue-500"
            />
            <span className="text-[12px] text-[hsl(215,20%,55%)]">Show passwords</span>
          </label>
          <button
            onClick={changePassword}
            disabled={saving || !currentPassword || !newPassword}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[13px] font-medium transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Change Password
          </button>
        </div>
      )}

      {/* Sign out */}
      <div className="glass-card rounded-xl p-4">
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-[13px] text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
