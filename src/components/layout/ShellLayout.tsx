'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  LayoutDashboard, 
  Users, 
  Upload, 
  History, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon,
  ChevronRight
} from 'lucide-react';

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/signup';
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);

  React.useEffect(() => {
    // Sync theme class
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  React.useEffect(() => {
    if (status === 'unauthenticated' && !isPublicPage) {
      router.replace('/login');
    }
  }, [status, router, isPublicPage]);

  // If loading or unauthenticated or on public page, don't show navigation shell
  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
          <span className="text-xs font-semibold text-zinc-500">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Groups', href: '/groups', icon: Users },
    { name: 'Import Center', href: '/import', icon: Upload },
    { name: 'Audit Trail', href: '/audit-logs', icon: History },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50 transition-colors">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shrink-0">
        
        {/* App Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 font-bold shadow">
            <Shield size={18} />
          </div>
          <span className="font-extrabold tracking-tight text-md">SettleUp</span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-4 flex flex-col gap-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.01] ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </nav>

        {/* User profile details and Signout footer */}
        <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs">
              {session?.user?.name?.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-zinc-400 font-semibold truncate uppercase tracking-wider">{ (session?.user as any)?.role }</p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all hover:scale-[1.01]"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navbar */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
          
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850"
          >
            <Menu size={18} />
          </button>

          {/* Page indicator info */}
          <div className="hidden sm:block text-xs font-semibold text-zinc-400">
            SettleUp Shared Expenses Governance Platform
          </div>

          {/* Quick-action tools (dark theme toggle, active actor info) */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/50 px-3 py-1 rounded-lg text-xs font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span>{session?.user?.name}</span>
            </div>
          </div>

        </header>

        {/* Page Inner Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {children}
        </main>

      </div>

      {/* Mobile Drawer Navigation Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex md:hidden">
          <div className="absolute inset-0" onClick={() => setMobileMenuOpen(false)}></div>
          
          <aside className="relative w-64 h-full bg-white dark:bg-zinc-900 flex flex-col p-6 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl animate-slide-in">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <span className="font-extrabold text-md tracking-tight">SettleUp Navigation</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 shadow-md'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs">
                  {session?.user?.name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{session?.user?.name}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold truncate uppercase tracking-wider">{ (session?.user as any)?.role }</p>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}
