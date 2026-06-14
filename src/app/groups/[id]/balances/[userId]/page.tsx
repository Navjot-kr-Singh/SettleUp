'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, AlertCircle } from 'lucide-react';
import { ExplainerCard } from '@/components/balance/ExplainerCard';

export default function BalanceExplainerPage() {
  const { id: groupId, userId } = useParams() as { id: string; userId: string };
  
  const [group, setGroup] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId || !userId) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [groupRes, explainRes] = await Promise.all([
          fetch(`/api/groups/${groupId}`),
          fetch(`/api/balances/explain/${userId}?groupId=${groupId}`),
        ]);

        if (groupRes.ok) {
          setGroup(await groupRes.json());
        } else {
          setError('Group space not found.');
        }

        if (explainRes.ok) {
          setSteps(await explainRes.json());
        } else {
          setError('Failed to calculate balance timeline.');
        }
      } catch (err) {
        console.error('Failed to load explainer trace:', err);
        setError('Error tracing ledger totals.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [groupId, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Generating timeline tracer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md mx-auto">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
        <p className="text-sm font-bold text-zinc-500">{error}</p>
        <Link href={`/groups/${groupId}`} className="text-xs font-bold text-zinc-900 hover:underline mt-2 inline-block">
          Return to group detail
        </Link>
      </div>
    );
  }

  const userProfile = group?.memberships?.find((m: any) => m.userId === userId)?.user;
  const userName = userProfile?.name || userId;

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Back button and page title */}
      <div className="flex flex-col gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href={`/groups/${groupId}`} className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1 self-start">
          <span>← Back to {group?.name || 'Group detail'}</span>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2 flex items-center gap-3">
          <Clock size={28} className="text-zinc-800 dark:text-zinc-200" />
          <span>Running Balance Explainer</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Chronological tracing of all split expenses paid, shares owed, and settlements completed.
        </p>
      </div>

      {/* Explainer Timeline Trace */}
      <ExplainerCard steps={steps} userName={userName} />

    </div>
  );
}
