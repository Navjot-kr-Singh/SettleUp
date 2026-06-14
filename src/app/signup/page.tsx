'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, User, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // 1. Send registration request
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      // 2. Auto Login on success
      const loginRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError('Auto Login failed: ' + loginRes.error);
        setLoading(false);
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError('An unexpected registration error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-slate-100 via-zinc-100 to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-4 font-sans text-zinc-900 dark:text-zinc-50">
      <div className="w-full max-w-md bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl shadow-xl p-8 flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 shadow-md">
            <Shield size={24} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-2 text-zinc-900 dark:text-zinc-50">
            Create Account
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Start governing your shared expenses with audit readiness
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
            <label className="block text-xs font-bold text-zinc-500 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input 
                type="text"
                id="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
              />
            </div>
          </div>

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
                placeholder="Minimum 8 characters"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input 
                type="password"
                id="confirm-password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            id="signup-submit-button"
            disabled={loading}
            className="w-full mt-2 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-sm font-semibold rounded-lg shadow transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-zinc-500 font-semibold">
            Already have an account?{' '}
            <Link href="/login" id="login-link" className="font-bold text-zinc-900 dark:text-zinc-50 hover:underline">
              Login
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
