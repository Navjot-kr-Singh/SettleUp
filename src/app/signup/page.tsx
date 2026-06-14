'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Lock, Mail, User, ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { LedgerGrid } from '@/components/LedgerGrid';

export default function SignupPage() {
  const router = useRouter();
  const { status } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Custom Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  // Compute password strength (max score 4)
  const getPasswordStrength = (pass: string): number => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strengthScore = getPasswordStrength(password);

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
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    console.log('Registering user:', { name, email });

    try {
      // 1. Send registration request to backend API
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

      setToastMessage('Account created! Triggering secure login...');

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
        setToastMessage('Authenticated successfully! Redirecting...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1500);
      }
    } catch {
      setError('An unexpected registration error occurred.');
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-vault-bg text-vault-text-primary px-4 py-12 select-none overflow-x-hidden">
      {/* Ledger Grid Background */}
      <LedgerGrid intensity={0.12} />

      {/* Back arrow top-left */}
      <Link 
        href="/"
        className="absolute top-6 left-6 text-vault-text-muted hover:text-vault-text-primary transition-colors flex items-center gap-1.5 text-xs font-mono"
        aria-label="Back to home"
      >
        <ArrowLeft size={16} />
        <span>BACK</span>
      </Link>

      {/* Custom sliding success notification toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-vault-success text-white px-4 py-3 rounded-lg shadow-lg font-sans text-xs font-bold animate-slide-in">
          <Shield size={16} className="animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Card Panel */}
      <div 
        className={`relative z-10 w-full max-w-[420px] bg-vault-surface/90 border border-vault-border rounded-xl shadow-[0_0_50px_rgba(99,102,241,0.03)] p-8 flex flex-col gap-6 transition-all ${
          error ? 'animate-shake border-vault-destructive/40' : ''
        }`}
      >
        {/* Hidden h1 for E2E tests compatibility */}
        <h1 className="sr-only">Create Account</h1>
        
        {/* Inside Card Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg border border-vault-border bg-vault-bg text-vault-accent shadow-[0_0_12px_rgba(99,102,241,0.08)]">
            <Shield size={22} />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] font-sans text-vault-text-primary mt-2">
            Join SettleUp
          </h2>
          <p className="text-xs font-sans text-vault-text-muted">
            Create your member account
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 bg-vault-destructive/10 border-vault-destructive/30 text-vault-destructive p-3 rounded-lg text-xs font-semibold animate-shake animate-pulse">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold font-sans text-vault-text-muted uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-text-muted" size={14} />
              <input 
                type="text"
                id="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2.5 border border-vault-border rounded-lg bg-vault-bg/40 focus:bg-vault-bg text-sm text-vault-text-primary focus:outline-none focus:ring-1 focus:ring-vault-accent focus:border-vault-accent transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold font-sans text-vault-text-muted uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-text-muted" size={14} />
              <input 
                type="email"
                id="email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. email@example.com"
                disabled={loading}
                className="w-full pl-9 pr-3 py-2.5 border border-vault-border rounded-lg bg-vault-bg/40 focus:bg-vault-bg text-sm text-vault-text-primary focus:outline-none focus:ring-1 focus:ring-vault-accent focus:border-vault-accent transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold font-sans text-vault-text-muted uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-text-muted" size={14} />
              <input 
                type={showPassword ? 'text' : 'password'}
                id="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                disabled={loading}
                className="w-full pl-9 pr-10 py-2.5 border border-vault-border rounded-lg bg-vault-bg/40 focus:bg-vault-bg text-sm text-vault-text-primary focus:outline-none focus:ring-1 focus:ring-vault-accent focus:border-vault-accent transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-text-muted hover:text-vault-text-primary transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* 4-segment password strength indicator */}
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4].map((index) => (
                <div 
                  key={index}
                  className={`h-1 flex-1 rounded-sm transition-all duration-300 ${
                    index <= strengthScore 
                      ? 'bg-vault-accent shadow-[0_0_8px_rgba(99,102,241,0.5)]' 
                      : 'bg-vault-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10px] text-vault-text-muted mt-1.5 font-sans">
              Include numbers, symbols, and uppercase letters.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold font-sans text-vault-text-muted uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-text-muted" size={14} />
              <input 
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirm-password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-9 pr-10 py-2.5 border border-vault-border rounded-lg bg-vault-bg/40 focus:bg-vault-bg text-sm text-vault-text-primary focus:outline-none focus:ring-1 focus:ring-vault-accent focus:border-vault-accent transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-text-muted hover:text-vault-text-primary transition-colors focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            id="signup-submit-button"
            disabled={loading}
            className="w-full mt-2 py-3 bg-vault-accent hover:bg-vault-accent/90 text-white text-sm font-bold rounded-lg shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] transition-all scale-100 hover:scale-[1.015] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-2">
          <p className="text-xs text-vault-text-muted font-sans font-medium">
            Already a member?{' '}
            <Link href="/login" id="login-link" className="font-bold text-vault-accent hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
