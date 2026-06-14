'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle, 
  ArrowRight, 
  FileText, 
  User, 
  Calendar, 
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function ReportPage() {
  const { sessionId } = useParams() as { sessionId: string };

  const [metrics, setMetrics] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [metricsRes, proposalsRes, sessionDetailsRes] = await Promise.all([
          fetch(`/api/imports/commit/${sessionId}/status`),
          fetch(`/api/imports/proposals?sessionId=${sessionId}`),
          fetch(`/api/imports/session/${sessionId}`),
        ]);

        if (metricsRes.ok) {
          setMetrics(await metricsRes.json());
        } else {
          setError('Failed to fetch commit metrics.');
        }

        if (proposalsRes.ok) {
          const data = await proposalsRes.json();
          setProposals(data.proposals || []);
        }

        if (sessionDetailsRes.ok) {
          const sData = await sessionDetailsRes.json();
          setRecords(sData.records || []);
        }
      } catch (err) {
        console.error('Failed to load summary metrics:', err);
        setError('Failed to retrieve summary metrics.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Generating report summary...</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md mx-auto">
        <p className="text-sm font-bold text-zinc-500">{error || 'Metrics not found.'}</p>
        <Link href="/import" className="text-xs font-bold text-zinc-900 hover:underline mt-2 inline-block">
          Return to ingestion center
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Header */}
      <div className="flex flex-col gap-2 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
            <CheckCircle size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Import Ingestion Complete</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Staged file data successfully committed to the database ledger.</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        
        {/* Expenses Created */}
        <Card>
          <CardContent className="pt-5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Expenses Logged</span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2">{metrics.expensesCreated}</h2>
          </CardContent>
        </Card>

        {/* Settlements Created */}
        <Card>
          <CardContent className="pt-5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Settlements Logged</span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2">{metrics.settlementsCreated}</h2>
          </CardContent>
        </Card>

        {/* Snapshot version */}
        <Card>
          <CardContent className="pt-5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Snapshot Cache</span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-2 font-mono">v{metrics.snapshotVersion}</h2>
          </CardContent>
        </Card>

        {/* Timestamp */}
        <Card>
          <CardContent className="pt-5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Completion Date</span>
            <h2 className="text-sm font-bold mt-3 font-mono">
              {metrics.committedAt ? new Date(metrics.committedAt).toLocaleString() : 'N/A'}
            </h2>
          </CardContent>
        </Card>

      </div>

      {/* Grid: Resolutions left, Return actions right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Data proposals resolution log and committed records */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={15} />
                <span>Governance Resolutions Log ({proposals.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <p className="text-xs text-zinc-400 font-semibold text-center">No proposals were generated or modified during review.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Original Value</TableHead>
                      <TableHead>Resolved Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">#{item.rowNumber}</TableCell>
                        <TableCell className="font-semibold">{item.field}</TableCell>
                        <TableCell className="font-mono text-xs text-red-500 line-through truncate max-w-[120px]">
                          {item.originalValue || '[Blank]'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[120px]">
                          {item.resolvedValue || item.proposedValue}
                        </TableCell>
                        <TableCell>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.2 rounded border ${
                            item.status === 'APPROVED' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20' 
                              : 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/20'
                          }`}>
                            {item.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Committed Records Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={15} />
                <span>Committed Ledger Records ({records.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-xs text-zinc-400 font-semibold text-center py-6">No records committed.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Payer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((rec) => {
                      const norm = rec.normalizedData as any;
                      return (
                        <TableRow key={rec.id}>
                          <TableCell className="font-mono text-xs">#{rec.rowNumber}</TableCell>
                          <TableCell className="font-bold text-zinc-800 dark:text-zinc-200">
                            {norm?.description || rec.rawContent[1] || 'N/A'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {rec.rawContent[4] || 'N/A'}
                          </TableCell>
                          <TableCell className="font-mono font-bold">
                            {norm?.currency || rec.rawContent[3] || 'INR'} {parseFloat(norm?.amount || rec.rawContent[2] || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className="text-[9px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                              {norm?.type || rec.rawContent[5] || 'EXPENSE'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Next tasks actions */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <ShieldCheck size={14} />
                <span>Verify Balance Integration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-zinc-500 leading-5">
                The database balances snapshot has been incremented. Return to the dashboard space or room details workspace to verify overall totals.
              </p>
              
              <div className="flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                <Link
                  href="/dashboard"
                  className="w-full py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-bold rounded-lg text-center shadow transition-all"
                >
                  Return to Dashboard
                </Link>
                <Link
                  href="/groups"
                  className="w-full py-2 border border-zinc-250 hover:bg-zinc-50 text-xs font-bold rounded-lg text-center transition-all"
                >
                  Return to Groups Space
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
