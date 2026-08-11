import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function truncate(str: string, length: number = 100) {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function statusColors(status: string): string {
  const colors: Record<string, string> = {
    New: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Qualified: 'bg-green-500/10 text-green-500 border-green-500/20',
    Researching: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Contacted: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Replied: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    Meeting: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    Proposal: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    Negotiation: 'bg-red-500/10 text-red-500 border-red-500/20',
    Won: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    Lost: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

export function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  return fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  }).then((res) => res.json());
}
