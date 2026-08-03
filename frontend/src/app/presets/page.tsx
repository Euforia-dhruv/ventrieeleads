'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Preset {
  id: string; name: string; slug: string; description: string;
  industry: string; city: string; country: string; query_template: string;
  icon: string; is_builtin: boolean; sort_order: number;
}

const iconMap: Record<string, string> = {
  hotel: '🏨', utensils: '🍽️', stethoscope: '🩺', smile: '😁', scale: '⚖️',
  'drafting-compass': '📐', paintbrush: '🎨', hammer: '🔨', megaphone: '📢',
  building: '🏢', dumbbell: '💪', scissors: '✂️', car: '🚗', crown: '👑',
};

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/presets').then(r => r.json()).then(d => { setPresets(d.data || []); setLoading(false); });
  }, []);

  const runPreset = (p: Preset) => {
    router.push(`/search?query=${encodeURIComponent(p.query_template)}&city=${p.city || ''}&industry=${p.industry || ''}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Presets</h1>
        <p className="text-muted-foreground mt-1">Quick-start templates for common searches</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map(p => (
            <Card key={p.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => runPreset(p)}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{iconMap[p.icon] || '🔍'}</span>
                    <h3 className="font-semibold">{p.name}</h3>
                  </div>
                  <Badge variant="outline">{p.city || p.country}</Badge>
                </div>
                {p.industry && <p className="text-sm text-muted-foreground mb-2">Industry: {p.industry}</p>}
                <p className="text-xs text-muted-foreground">{p.query_template}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
