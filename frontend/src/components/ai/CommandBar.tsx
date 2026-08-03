'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, ArrowRight, Building2, Users, FileText, BarChart3, Eye, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: any;
  action: () => void;
  category: string;
}

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandAction[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const allActions: CommandAction[] = [
    { id: 'search', label: 'Search Companies', description: 'Discover businesses across UAE', icon: Search, action: () => { setOpen(false); router.push('/search'); }, category: 'Navigation' },
    { id: 'leads', label: 'View Leads', description: 'Browse all captured leads', icon: Users, action: () => { setOpen(false); router.push('/leads'); }, category: 'Navigation' },
    { id: 'campaigns', label: 'Campaigns', description: 'Manage outreach campaigns', icon: FileText, action: () => { setOpen(false); router.push('/campaigns'); }, category: 'Navigation' },
    { id: 'companies', label: 'Company Dossier', description: 'View company intelligence', icon: Building2, action: () => { setOpen(false); router.push('/companies'); }, category: 'Navigation' },
    { id: 'monitoring', label: 'Monitoring Center', description: 'Track company changes', icon: Eye, action: () => { setOpen(false); router.push('/monitoring'); }, category: 'Navigation' },
    { id: 'proposals', label: 'Proposals', description: 'Generate client proposals', icon: FileText, action: () => { setOpen(false); router.push('/proposals'); }, category: 'Navigation' },
    { id: 'copywriter', label: 'AI Copywriter', description: 'Generate outreach messages', icon: Wand2, action: () => { setOpen(false); router.push('/copywriter'); }, category: 'Navigation' },
    { id: 'redesign', label: 'Redesign Studio', description: 'Generate redesign concepts', icon: Eye, action: () => { setOpen(false); router.push('/redesign'); }, category: 'Navigation' },
    { id: 'reports', label: 'Report Builder', description: 'Build custom reports', icon: BarChart3, action: () => { setOpen(false); router.push('/reports'); }, category: 'Navigation' },
    { id: 'playbook', label: 'Sales Playbook', description: 'AI sales recommendations', icon: BarChart3, action: () => { setOpen(false); router.push('/playbook'); }, category: 'Navigation' },
    { id: 'competitors', label: 'Competitor Insights', description: 'Analyze competitors', icon: Eye, action: () => { setOpen(false); router.push('/competitors'); }, category: 'Navigation' },
    { id: 'export', label: 'Export Hub', description: 'Export data in multiple formats', icon: FileText, action: () => { setOpen(false); router.push('/export'); }, category: 'Navigation' },
    { id: 'dashboard', label: 'Executive Dashboard', description: 'Premium analytics view', icon: BarChart3, action: () => { setOpen(false); router.push('/executive'); }, category: 'Navigation' },
  ];

  useEffect(() => {
    if (!query.trim()) {
      setResults(allActions.slice(0, 8));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allActions.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
    setResults(filtered);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      results[0].action();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-input text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Command className="h-4 w-4" />
        <span>Quick actions...</span>
        <kbd className="ml-4 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
            >
              <div className="glass-card rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center border-b border-white/5 px-4">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search or type a command..."
                    className="flex-1 bg-transparent border-0 outline-none py-4 px-3 text-sm placeholder:text-muted-foreground"
                  />
                  <button onClick={() => setOpen(false)} className="shrink-0 p-1 rounded hover:bg-secondary">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {results.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No results found</div>
                  ) : (
                    results.map((action) => (
                      <button
                        key={action.id}
                        onClick={action.action}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-secondary/50 transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-secondary/50 group-hover:bg-primary/10">
                          <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{action.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{action.description}</div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-white/5 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span><kbd className="px-1 py-0.5 rounded bg-secondary text-[10px]">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-secondary text-[10px]">↵</kbd> Select</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-secondary text-[10px]">Esc</kbd> Close</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
