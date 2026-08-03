'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Notification {
  id: string; type: string; title: string; message: string;
  is_read: boolean; action_url: string | null; created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    fetchNotifications();
  };

  const typeColors: Record<string, string> = {
    new_lead: 'bg-green-500/10 text-green-500', search_completed: 'bg-blue-500/10 text-blue-500',
    website_change: 'bg-yellow-500/10 text-yellow-500', job_failed: 'bg-red-500/10 text-red-500',
    high_value_lead: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && <Button variant="outline" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-2" />Mark All Read</Button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="text-center text-muted-foreground py-12">No notifications yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={n.is_read ? 'opacity-60' : ''}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium text-sm">{n.title}</h3>
                    {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={typeColors[n.type] || ''}>{n.type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                  {!n.is_read && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}><Check className="h-3 w-3" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
