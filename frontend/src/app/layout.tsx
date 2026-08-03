'use client';

import './globals.css';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Search, Users, Briefcase, Settings, Menu, X, Zap,
  Calendar, Bell, FileDown, Shield, Building2,
  Eye, FileText, Wand2, BarChart3, Lightbulb, Target,
  Bot, Brain, Network, Globe, Factory, Rocket, Map, HeartPulse, Sparkles,
  GitBranch, Coffee, Activity, LogOut, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommandBar } from '@/components/ai/CommandBar';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/executive', label: 'Executive', icon: BarChart3 },
  { href: '/agents', label: 'AI Agents', icon: Bot },
  { href: '/intelligence', label: 'Intelligence', icon: Brain },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/knowledge', label: 'Knowledge', icon: Network },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Briefcase },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/scheduled', label: 'Scheduled', icon: Calendar },
  { href: '/locations', label: 'Locations', icon: Globe },
  { href: '/industries', label: 'Industries', icon: Factory },
  { href: '/discovery', label: 'Discovery', icon: Rocket },
  { href: '/coverage', label: 'Coverage', icon: Map },
  { href: '/discovery-health', label: 'Health', icon: HeartPulse },
  { href: '/intelligence-center', label: 'Intel Center', icon: Brain },
  { href: '/heatmap', label: 'Heatmap', icon: Globe },
  { href: '/benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { href: '/executive-ai', label: 'Executive AI', icon: Sparkles },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/prospects', label: 'Top Prospects', icon: Target },
  { href: '/automation', label: 'Automation', icon: Zap },
  { href: '/observability', label: 'Observability', icon: Activity },
  { href: '/briefing', label: 'Morning Briefing', icon: Coffee },
  { href: '/proposals', label: 'Proposals', icon: FileText },
  { href: '/copywriter', label: 'Copywriter', icon: Wand2 },
  { href: '/redesign', label: 'Redesign', icon: Eye },
  { href: '/monitoring', label: 'Monitoring', icon: Settings },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/playbook', label: 'Playbook', icon: Lightbulb },
  { href: '/competitors', label: 'Competitors', icon: Target },
  { href: '/export', label: 'Export', icon: FileDown },
  { href: '/audit', label: 'Audit', icon: Settings },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin', label: 'Admin', icon: Shield },
];

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 glass-sidebar transform transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/5">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg gradient-text">Ventriee Leads</span>
            </Link>
          </div>

          <div className="px-4 pt-3 pb-1">
            <CommandBar />
          </div>

          <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto scrollbar-thin">
            {navItems.map(item => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/5">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                </Link>
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/login" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all">
                <User className="h-4 w-4" />
                Sign In
              </Link>
            )}
            <div className="text-xs text-muted-foreground mt-2 px-3">
              Ventriee Leads v3.0
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AuthProvider>
          <Toaster>
            <AppShell>{children}</AppShell>
          </Toaster>
        </AuthProvider>
      </body>
    </html>
  );
}
