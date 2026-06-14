'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all credentials fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid email or password.');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError('An unexpected login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user: string) => {
    setError('');
    setLoading(true);
    const userEmail = `${user.toLowerCase()}@settleup.com`;
    const userPassword = `${user.toLowerCase()}123`;
    try {
      const res = await signIn('credentials', {
        email: userEmail,
        password: userPassword,
        redirect: false,
      });

      if (res?.error) {
        setError('Demo Login failed: ' + res.error);
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError('Demo Login error.');
    } finally {
      setLoading(false);
    }
  };

  const seededUsers = [
    { name: 'Aisha', role: 'MEMBER' },
    { name: 'Rohan', role: 'MEMBER' },
    { name: 'Priya', role: 'MEMBER' },
    { name: 'Meera', role: 'MEMBER (Exit: Mar 29)' },
    { name: 'Dev', role: 'MEMBER' },
    { name: 'Sam', role: 'MEMBER (Entry: Apr 8)' },
    { name: 'Kabir', role: 'GUEST' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-slate-100 via-zinc-100 to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-4 font-sans text-zinc-900 dark:text-zinc-50">
      <div className="w-full max-w-md bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl shadow-xl p-8 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 shadow-md">
            <Shield size={24} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-2 text-zinc-900 dark:text-zinc-50">
            SettleUp Portal
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Audit-Ready Shared Expenses & CSV Import Governance
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 p-3 rounded-lg text-xs font-semibold animate-shake">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input 
                type="email"
                id="email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. email@example.com"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input 
                type="password"
                id="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            id="login-submit-button"
            disabled={loading}
            className="w-full mt-2 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-sm font-semibold rounded-lg shadow transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-zinc-500 font-semibold">
            Don’t have an account?{' '}
            <Link href="/signup" id="signup-link" className="font-bold text-zinc-900 dark:text-zinc-50 hover:underline">
              Create Account
            </Link>
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Demo Accounts</span>
          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
        </div>

        {/* Quick Login Grid */}
        <div className="grid grid-cols-2 gap-2">
          {seededUsers.map((user) => (
            <button
              key={user.name}
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin(user.name)}
              className="flex flex-col items-start p-2 text-left border border-zinc-200/60 dark:border-zinc-800/80 rounded-lg bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group shadow-sm disabled:opacity-50"
            >
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Login as {user.name}</span>
              </div>
              <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5">{user.role}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
