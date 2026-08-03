'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Layers, Cpu, Activity, Database, HardDrive, History, AlertTriangle,
  Plus, Trash2, Search, Server, Wrench, Eye, EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';


function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{message}</p>;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface ProviderData {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  config: Record<string, string>;
  last_used_at: string | null;
}

interface WorkerData {
  workers: Record<string, string>;
  queues: { queued: number; running: number; completed_today: number; failed_today: number };
}

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: string;
  request_count_today: number;
  avg_response_time: number;
}

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  created_at: string;
}

interface BackupEntry {
  id: string;
  filename: string;
  size_bytes: number;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [workers, setWorkers] = useState<WorkerData | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', type: 'openai' });
  const [dbTables, setDbTables] = useState<{ name: string; row_count: number; size_mb: number }[]>([]);
  const [storageUsage, setStorageUsage] = useState<{ bucket: string; objects: number; size_mb: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [usersRes, providersRes, workersRes, metricsRes, auditRes, backupsRes, dbRes, storageRes] = await Promise.allSettled([
          fetch('/api/admin/users').then(r => r.json()),
          fetch('/api/admin/providers').then(r => r.json()),
          fetch('/api/admin/workers').then(r => r.json()),
          fetch('/api/admin/metrics').then(r => r.json()),
          fetch('/api/admin/audit-logs').then(r => r.json()),
          fetch('/api/admin/backups').then(r => r.json()),
          fetch('/api/admin/database').then(r => r.json()),
          fetch('/api/admin/storage').then(r => r.json()),
        ]);
        if (cancelled) return;
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
        if (providersRes.status === 'fulfilled') setProviders(providersRes.value.data || []);
        if (workersRes.status === 'fulfilled') setWorkers(workersRes.value.data || null);
        if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data || null);
        if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value.data || []);
        if (backupsRes.status === 'fulfilled') setBackups(backupsRes.value.data || []);
        if (dbRes.status === 'fulfilled') setDbTables(dbRes.value.data || []);
        if (storageRes.status === 'fulfilled') setStorageUsage(storageRes.value.data || []);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const updateUserRole = async (id: string, role: string) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setUsers(u => u.map(user => user.id === id ? { ...user, role } : user));
  };

  const toggleUserActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    setUsers(u => u.map(user => user.id === id ? { ...user, is_active: !isActive } : user));
  };

  const createProvider = async () => {
    if (!newProvider.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider),
      });
      const data = await res.json();
      if (data.data) setProviders(p => [...p, data.data]);
      setShowNewProvider(false);
      setNewProvider({ name: '', type: 'openai' });
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleProvider = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    setProviders(p => p.map(prov => prov.id === id ? { ...prov, is_active: !isActive } : prov));
  };

  const deleteProvider = async (id: string) => {
    await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' });
    setProviders(p => p.filter(prov => prov.id !== id));
  };

  const triggerBackup = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/backups', { method: 'POST' });
      const res = await fetch('/api/admin/backups').then(r => r.json());
      setBackups(res.data || []);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleMaintenance = async () => {
    const next = !maintenanceMode;
    setSaving(true);
    try {
      await fetch('/api/admin/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      setMaintenanceMode(next);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const formatBytes = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground mt-1">Platform management and system administration</p>
        </div>
        <div className="flex items-center gap-3">
          {maintenanceMode && <Badge variant="warning">Maintenance Mode Active</Badge>}
          <Button variant={maintenanceMode ? 'destructive' : 'outline'} size="sm" onClick={toggleMaintenance} disabled={saving}>
            <Wrench className="h-4 w-4 mr-2" />
            {maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="workspaces"><Layers className="h-4 w-4 mr-1" />Workspaces</TabsTrigger>
          <TabsTrigger value="providers"><Cpu className="h-4 w-4 mr-1" />Providers</TabsTrigger>
          <TabsTrigger value="workers"><Activity className="h-4 w-4 mr-1" />Workers</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="h-4 w-4 mr-1" />Storage</TabsTrigger>
          <TabsTrigger value="database"><Database className="h-4 w-4 mr-1" />Database</TabsTrigger>
          <TabsTrigger value="backups"><History className="h-4 w-4 mr-1" />Backups</TabsTrigger>
          <TabsTrigger value="audit"><AlertTriangle className="h-4 w-4 mr-1" />Audit</TabsTrigger>
          <TabsTrigger value="metrics"><Server className="h-4 w-4 mr-1" />Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>{users.length} registered users</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or email..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="pl-10" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Joined</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <select
                            value={user.role}
                            onChange={e => updateUserRole(user.id, e.target.value)}
                            className="rounded-md border bg-background px-2 py-1 text-xs"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <Badge variant={user.is_active ? 'success' : 'destructive'}>
                            {user.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => toggleUserActive(user.id, user.is_active)}>
                            {user.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && <EmptyState message="No users found" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces">
          <Card>
            <CardHeader>
              <CardTitle>Workspaces</CardTitle>
              <CardDescription>Manage team workspaces and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState message="Workspace management coming soon" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>AI Providers</CardTitle>
                <CardDescription>Configure AI service providers</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewProvider(!showNewProvider)}>
                <Plus className="h-4 w-4 mr-2" />Add Provider
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showNewProvider && (
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Provider name" value={newProvider.name} onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))} />
                      <select value={newProvider.type} onChange={e => setNewProvider(p => ({ ...p, type: e.target.value }))} className="rounded-md border bg-background px-3 py-2 text-sm">
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Gemini</option>
                        <option value="ollama">Ollama</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createProvider} disabled={saving}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewProvider(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <EmptyState message="No providers configured" />
                ) : (
                  providers.map(provider => (
                    <div key={provider.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Cpu className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{provider.name}</span>
                            <Badge variant="secondary">{provider.type}</Badge>
                          </div>
                          {provider.last_used_at && (
                            <p className="text-xs text-muted-foreground">Last used {new Date(provider.last_used_at).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={provider.is_active ? 'success' : 'outline'}>
                          {provider.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => toggleProvider(provider.id, provider.is_active)}>
                          {provider.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteProvider(provider.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers">
          <Card>
            <CardHeader>
              <CardTitle>Workers & Queues</CardTitle>
              <CardDescription>Background job processing status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {workers ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-green-500/5 border-green-500/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">{workers.queues?.queued || 0}</div>
                        <div className="text-xs text-muted-foreground">Queued</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-500">{workers.queues?.running || 0}</div>
                        <div className="text-xs text-muted-foreground">Running</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-500/5 border-purple-500/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-500">{workers.queues?.completed_today || 0}</div>
                        <div className="text-xs text-muted-foreground">Completed Today</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{workers.queues?.failed_today || 0}</div>
                        <div className="text-xs text-muted-foreground">Failed Today</div>
                      </CardContent>
                    </Card>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium mb-3">Active Workers</h3>
                    <div className="space-y-2">
                      {Object.entries(workers.workers || {}).map(([name, status]) => (
                        <div key={name} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                          <Badge variant="success">{status as string}</Badge>
                        </div>
                      ))}
                      {Object.keys(workers.workers || {}).length === 0 && (
                        <EmptyState message="No active workers" />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState message="Unable to fetch worker status" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>File and object storage usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {storageUsage.length === 0 ? (
                <EmptyState message="No storage data available" />
              ) : (
                <div className="space-y-3">
                  {storageUsage.map(bucket => (
                    <div key={bucket.bucket} className="p-4 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{bucket.bucket}</span>
                        </div>
                        <Badge variant="outline">{formatBytes(bucket.size_mb)}</Badge>
                      </div>
                      <Progress value={bucket.size_mb} max={10240} />
                      <p className="text-xs text-muted-foreground">{bucket.objects.toLocaleString()} objects</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle>Database</CardTitle>
              <CardDescription>Table sizes and connection stats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dbTables.length === 0 ? (
                <EmptyState message="No database info available" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Table</th>
                        <th className="text-right p-3 font-medium">Rows</th>
                        <th className="text-right p-3 font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbTables.map(table => (
                        <tr key={table.name} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="p-3 font-medium font-mono text-xs">{table.name}</td>
                          <td className="p-3 text-right text-muted-foreground">{table.row_count.toLocaleString()}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatBytes(table.size_mb)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Backups</CardTitle>
                <CardDescription>Database backup history</CardDescription>
              </div>
              <Button size="sm" onClick={triggerBackup} disabled={saving}>
                <Database className="h-4 w-4 mr-2" />
                {saving ? 'Creating...' : 'New Backup'}
              </Button>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <EmptyState message="No backups yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">File</th>
                        <th className="text-right p-3 font-medium">Size</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map(backup => (
                        <tr key={backup.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="p-3 font-mono text-xs">{backup.filename}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatBytes((backup.size_bytes || 0) / (1024 * 1024))}</td>
                          <td className="p-3">
                            <Badge variant={backup.status === 'completed' ? 'success' : backup.status === 'failed' ? 'destructive' : 'warning'}>
                              {backup.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{new Date(backup.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>System activity and user actions</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <EmptyState message="No audit logs found" />
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{log.action}</span>
                          <Badge variant="secondary">{log.resource_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {log.user_email} &middot; {new Date(log.created_at).toLocaleString()}
                        </p>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{log.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>Real-time system performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {metrics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>CPU Usage</span>
                        <span className="font-medium">{metrics.cpu_usage}%</span>
                      </div>
                      <Progress value={metrics.cpu_usage} color={metrics.cpu_usage > 80 ? 'bg-red-500' : metrics.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Memory</span>
                        <span className="font-medium">{metrics.memory_usage}%</span>
                      </div>
                      <Progress value={metrics.memory_usage} color={metrics.memory_usage > 80 ? 'bg-red-500' : metrics.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Disk</span>
                        <span className="font-medium">{metrics.disk_usage}%</span>
                      </div>
                      <Progress value={metrics.disk_usage} color={metrics.disk_usage > 80 ? 'bg-red-500' : metrics.disk_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'} />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">{metrics.request_count_today.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Requests Today</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">{metrics.avg_response_time}ms</div>
                        <div className="text-xs text-muted-foreground">Avg Response Time</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">{metrics.uptime}</div>
                        <div className="text-xs text-muted-foreground">Uptime</div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <EmptyState message="Metrics unavailable" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
