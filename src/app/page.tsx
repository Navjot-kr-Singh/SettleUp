'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Shield } from 'lucide-react';
import { LedgerGrid } from '@/components/LedgerGrid';
import { DemoAccounts } from '@/components/DemoAccounts';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-vault-bg text-vault-text-primary px-4 py-8 select-none overflow-x-hidden">
      {/* Ledger Grid Ambient Animating Background */}
      <LedgerGrid intensity={0.12} />

      {/* Main Centered Content Container */}
      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center text-center">
        {/* SVG Inline Shield Indicator */}
        <div className="flex items-center justify-center w-14 h-14 rounded-xl border border-vault-border bg-vault-surface/60 text-vault-accent shadow-[0_0_15px_rgba(99,102,241,0.1)] mb-6">
          <Shield className="w-7 h-7" />
        </div>

        {/* Display Header */}
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-[-0.03em] font-sans text-vault-text-primary">
          SettleUp
        </h1>
        <p className="text-sm font-sans text-vault-text-muted mt-2">
          Shared expenses. Zero confusion.
        </p>

        {/* Horizontal Visual Divider */}
        <hr className="w-full border-t border-vault-border my-8" />

        {/* Action Controls Panel */}
        <div className="w-full flex flex-col gap-3">
          <Link
            href="/login"
            className="flex items-center justify-center w-full py-3 px-4 rounded-lg bg-vault-accent hover:bg-vault-accent/90 text-white font-bold text-sm tracking-wide shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] transition-all scale-100 hover:scale-[1.015]"
            aria-label="Sign in to your account"
          >
            Sign In
          </Link>

          <Link
            href="/signup"
            className="flex items-center justify-center w-full py-3 px-4 rounded-lg border border-vault-accent text-vault-accent hover:bg-vault-accent/5 font-bold text-sm tracking-wide transition-all scale-100 hover:scale-[1.015]"
            aria-label="Create a new account"
          >
            Create Account
          </Link>
        </div>

        {/* Collapsible Demo Ledger Accounts */}
        <DemoAccounts />
      </div>
    </main>
  );
}
