'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="flex flex-col items-center gap-4">
        <Shield className="h-12 w-12 text-zinc-800 dark:text-zinc-200 animate-pulse" />
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Redirecting to SettleUp Portal...
        </h2>
        <p className="text-sm text-zinc-500">Checking secure authentication token state.</p>
      </div>
    </div>
  );
}
