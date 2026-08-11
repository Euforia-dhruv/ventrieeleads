'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  CornerDownLeft,
  ArrowRight,
  Building2,
  Users,
  Briefcase,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  icon: typeof Search;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      setActiveIndex(0);
    }
  }, [open]);

  const items: CommandItem[] = [
    { id: 'search', label: 'Global business search', hint: 'Go to Search', href: '/search', icon: Search },
    { id: 'dashboard', label: 'Dashboard', hint: 'Go to Dashboard', href: '/', icon: LayoutDashboard },
    { id: 'leads', label: 'Manage leads', hint: 'Go to Leads', href: '/leads', icon: Users },
    { id: 'companies', label: 'Discover companies', hint: 'Go to Companies', href: '/companies', icon: Building2 },
    { id: 'campaigns', label: 'Campaigns', hint: 'Go to Campaigns', href: '/campaigns', icon: Briefcase },
    { id: 'settings', label: 'Settings & API keys', hint: 'Go to Settings', href: '/settings', icon: Settings },
  ];

  const filtered = query.trim() ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())) : items;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const go = (item: CommandItem) => {
    setOpen(false);
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      go(filtered[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[560px] rounded-xl border border-white/[0.08] bg-[hsl(224,71%,7%)] shadow-2xl overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-[hsl(215,20%,45%)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            aria-label="Command search"
            className="flex-1 h-12 bg-transparent text-[14px] text-white placeholder-[hsl(215,16%,40%)] focus:outline-none"
          />
          <kbd className="text-[10px] text-[hsl(215,16%,40%)] border border-white/[0.08] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[hsl(215,16%,40%)]">No commands match “{query}”</p>
          ) : (
            filtered.map((item, idx) => (
              <Link
                key={item.id}
                href={item.href || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  go(item);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors',
                  idx === activeIndex ? 'bg-white/[0.06] text-white' : 'text-[hsl(215,20%,60%)]',
                ].join(' ')}
              >
                <item.icon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="hidden sm:block text-[11px] text-[hsl(215,16%,38%)]">{item.hint}</span>}
                {idx === activeIndex ? (
                  <CornerDownLeft className="w-3.5 h-3.5 text-[hsl(215,16%,40%)]" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-[hsl(215,16%,30%)]" />
                )}
              </Link>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-[hsl(215,16%,35%)] flex items-center gap-3">
          <span>
            <kbd className="border border-white/[0.08] rounded px-1 py-0.5">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="border border-white/[0.08] rounded px-1 py-0.5">↵</kbd> Open
          </span>
          <span>
            <kbd className="border border-white/[0.08] rounded px-1 py-0.5">⌘K</kbd> Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
