'use client';

import { Loader2, Globe, Search, Mail, Link2, Cpu, CheckCircle, AlertCircle } from 'lucide-react';

interface SearchProgressProps {
  currentStep: number;
  message?: string;
}

function getIconForMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('done') || lower.includes('completed')) return 'check';
  if (lower.includes('fail') || lower.includes('error')) return 'error';
  if (lower.includes('search')) return 'search';
  if (lower.includes('store') || lower.includes('dedup') || lower.includes('discover')) return 'globe';
  if (lower.includes('enrich') || lower.includes('scrape') || lower.includes('website') || lower.includes('audit')) return 'link';
  if (lower.includes('score') || lower.includes('lead') || lower.includes('ai')) return 'cpu';
  if (lower.includes('geocod')) return 'mail';
  if (lower.includes('parsing')) return 'globe';
  return 'loading';
}

function StatusIcon({ type }: { type: string }) {
  switch (type) {
    case 'check':
      return <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
    case 'search':
      return <Search className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case 'globe':
      return <Globe className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case 'link':
      return <Link2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case 'cpu':
      return <Cpu className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case 'mail':
      return <Mail className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    default:
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
  }
}

export default function SearchProgress({ currentStep, message }: SearchProgressProps) {
  const pct = Math.min(100, Math.round(currentStep));
  const isDone = pct >= 100;
  const isError = message?.toLowerCase().includes('fail') || message?.toLowerCase().includes('error');
  const iconType = message ? getIconForMessage(message) : 'loading';

  return (
    <div className="glass-card rounded-xl p-3 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <StatusIcon type={isDone ? (isError ? 'error' : 'check') : iconType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white truncate">
              {message || 'Searching...'}
            </span>
            <span className="text-[10px] text-[hsl(215,16%,45%)] shrink-0">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDone
                  ? isError
                    ? 'bg-red-500'
                    : 'bg-green-500'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {['search', 'globe', 'link', 'cpu', 'bar', 'check'].map((step, i) => {
            const stepPct = (i + 1) * (100 / 6);
            const isActive = pct >= stepPct;
            const isCurrent = pct >= (i * (100 / 6)) && pct < stepPct;
            return (
              <div
                key={step}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  isActive ? 'bg-green-500' : isCurrent ? 'bg-blue-500 animate-pulse' : 'bg-white/[0.1]'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
