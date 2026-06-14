'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Upload, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  
  const [groups, setGroups] = useState<any[]>([]);
  const [userBalances, setUserBalances] = useState<any>({ grandTotal: 0, groupBalances: [] });
  const [pendingImports, setPendingImports] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [groupsRes, balancesRes, importsRes, logsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch(`/api/balances/user/${userId}`),
          fetch('/api/imports/session?status=REVIEW_REQUIRED'),
          fetch('/api/audit-logs?limit=5'),
        ]);

        if (groupsRes.ok) setGroups(await groupsRes.json());
        if (balancesRes.ok) setUserBalances(await balancesRes.json());
        if (importsRes.ok) setPendingImports(await importsRes.json());
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setRecentLogs(logsData.logs || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Loading dashboard panel...</span>
      </div>
    );
  }

  const grandTotal = userBalances.grandTotal || 0;

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1.5">
            Audit-ready shared expenses tracker, strategy patterns dispatcher, and debt resolution engine.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl shadow-sm">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Secure Audit Session Active</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Metric 1: Grand Net Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Overall Balance</span>
              {grandTotal >= 0 ? (
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-950/20 dark:text-emerald-400">
                  <ArrowUpRight size={16} />
                </div>
              ) : (
                <div className="p-1.5 bg-red-50 text-red-500 rounded-lg dark:bg-red-950/20 dark:text-red-400">
                  <ArrowDownLeft size={16} />
                </div>
              )}
            </div>
            <div className="mt-4">
              <h2 className={`text-3xl font-extrabold tracking-tight font-mono ${grandTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {grandTotal >= 0 ? '+' : ''}₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                {grandTotal >= 0 ? 'You are owed in total' : 'You owe in total'} across all spaces
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Groups */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Groups</span>
              <div className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg dark:bg-zinc-800 dark:text-zinc-400">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-3xl font-extrabold tracking-tight">
                {groups.length}
              </h2>
              <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                Collaborative room/flatmate groupings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Pending Imports */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Reviews Pending</span>
              {pendingImports.length > 0 ? (
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-950/20 dark:text-amber-400 animate-pulse">
                  <AlertTriangle size={16} />
                </div>
              ) : (
                <div className="p-1.5 bg-zinc-100 text-zinc-400 rounded-lg dark:bg-zinc-800">
                  <Upload size={16} />
                </div>
              )}
            </div>
            <div className="mt-4">
              <h2 className={`text-3xl font-extrabold tracking-tight ${pendingImports.length > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                {pendingImports.length}
              </h2>
              <p className="text-[10px] text-zinc-400 mt-1 font-semibold">
                Import sessions requiring proposal reviews
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Grid: Groups & Pending Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Groups & Balances list */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} />
              Your Space Balances
            </h2>
            <Link href="/groups" className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1">
              <span>View All Groups</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {userBalances.groupBalances.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <Users size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-bold text-zinc-500">No active group memberships</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Create a group or add yourself to start tracking expenses.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {userBalances.groupBalances.map((item: any) => (
                <Link key={item.groupId} href={`/groups/${item.groupId}`}>
                  <Card className="hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] h-full flex flex-col justify-between">
                    <CardContent className="pt-5 pb-5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Roomspace</span>
                      <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 truncate mb-4">{item.groupName}</h3>
                      <div className="flex items-baseline justify-between border-t border-zinc-150/40 dark:border-zinc-800 pt-3">
                        <span className="text-[10px] text-zinc-400 font-semibold">Net Balance</span>
                        <span className={`text-sm font-extrabold font-mono ${item.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          {item.netBalance >= 0 ? '+' : ''}₹{item.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Action alerts & Logs */}
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} />
            Notifications & Logs
          </h2>

          {/* Pending Reviews notification stack */}
          {pendingImports.length > 0 && (
            <div className="flex flex-col gap-3">
              {pendingImports.map((session) => (
                <Link key={session.id} href={`/import/review/${session.id}`}>
                  <div className="flex gap-3 border border-amber-200 bg-amber-50/50 p-4 rounded-xl text-xs font-semibold dark:bg-amber-950/10 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 shadow-sm hover:scale-[1.01] transition-all">
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold">Review Required</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">CSV: {session.fileName}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Recent Audit events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Clock size={14} />
                <span>Recent System Mutations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-zinc-400 font-semibold text-center">No recent actions logged.</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="flex flex-col border-b border-zinc-150/40 dark:border-zinc-800 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="text-[9px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase truncate">
                        {log.action.replace('IMPORT_COMMIT_', '').replace('IMPORT_', '')}
                      </span>
                      <span className="text-[8px] text-zinc-400 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                      {log.notes || `${log.action} performed`}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
