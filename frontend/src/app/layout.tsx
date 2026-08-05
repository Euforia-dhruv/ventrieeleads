'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Search, Users, Briefcase, Settings, Menu, X, Zap,
  Building2, LogOut, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/toaster';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/campaigns', label: 'Campaigns', icon: Briefcase },
  { href: '/reports', label: 'Reports', icon: Briefcase },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <div className="flex h-screen bg-[hsl(224,71%,4%)] overflow-hidden">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass"
      >
        {sidebarOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-[260px] glass-sidebar flex flex-col transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.04]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] text-white tracking-tight">Ventriee</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-[hsl(215,20%,55%)] hover:bg-white/[0.04] hover:text-[hsl(215,31%,75%)]"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/[0.04]">
          {isAuthenticated && user ? (
            <div className="space-y-1">
              <Link
                href="/settings"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[hsl(215,20%,55%)] hover:bg-white/[0.04] hover:text-white transition-all"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-[hsl(215,16%,40%)] truncate">{user.email}</div>
                </div>
              </Link>
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[hsl(215,16%,40%)] hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[hsl(215,16%,40%)] hover:bg-white/[0.04] hover:text-white transition-all">
              <User className="h-4 w-4" />
              Sign In
            </Link>
          )}
          <div className="text-[10px] text-[hsl(215,16%,28%)] mt-2 px-3">
            v4.0
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
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
