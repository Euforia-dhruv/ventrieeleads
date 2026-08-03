'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Key, Bell, Monitor, Trash2, Plus, Eye, EyeOff, Save, Smartphone, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface Session {
  id: string;
  device: string;
  browser: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

interface NotificationPrefs {
  email_new_leads: boolean;
  email_search_completed: boolean;
  email_weekly_report: boolean;
  email_website_changes: boolean;
  push_new_leads: boolean;
  push_search_completed: boolean;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    email_new_leads: true,
    email_search_completed: true,
    email_weekly_report: true,
    email_website_changes: false,
    push_new_leads: true,
    push_search_completed: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', new_password: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/settings/sessions').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/settings/api-keys').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([profileRes, sessionsRes, keysRes]) => {
      setProfile(profileRes.data || null);
      setSessions(sessionsRes.data || []);
      setApiKeys(keysRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, email: profile.email }),
      });
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const changePassword = async () => {
    setPasswordMsg(null);
    if (passwords.new_password !== passwords.confirm) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwords.new_password.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.new_password }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
        setPasswords({ current: '', new_password: '', confirm: '' });
      } else {
        setPasswordMsg({ type: 'error', text: data.message || 'Failed to update password' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Failed to update password' });
    }
  };

  const revokeSession = async (id: string) => {
    await fetch(`/api/settings/sessions/${id}`, { method: 'DELETE' });
    setSessions(s => s.filter(sess => sess.id !== id));
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.data?.key) setNewKeySecret(data.data.key);
      setNewKeyName('');
      fetch('/api/settings/api-keys').then(r => r.json()).then(d => setApiKeys(d.data || []));
    } catch (e) { console.error(e); }
    setCreatingKey(false);
  };

  const revokeApiKey = async (id: string) => {
    await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    setApiKeys(k => k.filter(key => key.id !== id));
  };

  const saveNotifPrefs = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifPrefs),
      });
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.classList.toggle('light', t === 'light');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, security, and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" />Profile</TabsTrigger>
          <TabsTrigger value="password"><Lock className="h-4 w-4 mr-2" />Password</TabsTrigger>
          <TabsTrigger value="sessions"><Smartphone className="h-4 w-4 mr-2" />Sessions</TabsTrigger>
          <TabsTrigger value="api-keys"><Key className="h-4 w-4 mr-2" />API Keys</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" />Notifications</TabsTrigger>
          <TabsTrigger value="appearance"><Monitor className="h-4 w-4 mr-2" />Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    profile?.name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <div>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={profile?.name || ''}
                    onChange={e => setProfile(p => p ? { ...p, name: e.target.value } : p)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={profile?.email || ''}
                    onChange={e => setProfile(p => p ? { ...p, email: e.target.value } : p)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Ensure your account stays secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div>
                <label className="text-sm font-medium">Current Password</label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.current}
                    onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.new_password}
                  onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.confirm}
                  onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                  className="mt-1"
                />
              </div>
              {passwordMsg && (
                <p className={cn('text-sm', passwordMsg.type === 'success' ? 'text-green-500' : 'text-red-500')}>
                  {passwordMsg.text}
                </p>
              )}
              <Button onClick={changePassword}>Update Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage devices where you are logged in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions found.</p>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        {session.browser.toLowerCase().includes('chrome') ? <Globe className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{session.browser}</span>
                          {session.is_current && <Badge variant="success">Current</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.ip_address} &middot; {session.device} &middot; Last active {new Date(session.last_active).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!session.is_current && (
                      <Button variant="ghost" size="sm" onClick={() => revokeSession(session.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage programmatic access to your account</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {newKeySecret && (
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                  <p className="text-sm font-medium text-green-500 mb-1">API Key Created</p>
                  <p className="text-xs text-muted-foreground mb-2">Copy this key now. It will not be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 rounded bg-background text-xs font-mono break-all">{newKeySecret}</code>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(newKeySecret); }}>Copy</Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g. Production, CI)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createApiKey()}
                  className="max-w-sm"
                />
                <Button onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()}>
                  <Plus className="h-4 w-4 mr-2" />Create Key
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No API keys yet.</p>
                ) : (
                  apiKeys.map(key => (
                    <div key={key.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{key.name}</span>
                          <code className="text-xs text-muted-foreground font-mono">{key.key_preview}</code>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => revokeApiKey(key.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Email Notifications</h3>
                <div className="space-y-3">
                  {([
                    ['email_new_leads', 'New leads discovered'],
                    ['email_search_completed', 'Search jobs completed'],
                    ['email_weekly_report', 'Weekly summary report'],
                    ['email_website_changes', 'Website changes detected'],
                  ] as [keyof NotificationPrefs, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm">{label}</span>
                      <button
                        onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          notifPrefs[key] ? 'bg-green-500' : 'bg-secondary'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          notifPrefs[key] ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-3">Push Notifications</h3>
                <div className="space-y-3">
                  {([
                    ['push_new_leads', 'New leads discovered'],
                    ['push_search_completed', 'Search jobs completed'],
                  ] as [keyof NotificationPrefs, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm">{label}</span>
                      <button
                        onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          notifPrefs[key] ? 'bg-green-500' : 'bg-secondary'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          notifPrefs[key] ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveNotifPrefs} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Theme</label>
                <div className="flex gap-3 mt-2">
                  {(['dark', 'light'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTheme(t)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors',
                        theme === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                      )}
                    >
                      <Monitor className="h-4 w-4" />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
