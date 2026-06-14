'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldAlert, 
  CheckCircle, 
  ArrowRight, 
  Clock, 
  FileSpreadsheet, 
  Loader2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ReviewQueue } from '@/components/import/ReviewQueue';
import { Alert } from '@/components/ui/alert';

export default function ReviewPage() {
  const { id: sessionId } = useParams() as { id: string };
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState('');

  const loadSessionDetails = async () => {
    try {
      const res = await fetch(`/api/imports/session/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      } else {
        setError('Import session not found.');
      }
    } catch (err) {
      console.error('Failed to load session details:', err);
      setError('Failed to contact import engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadSessionDetails();
    }
  }, [sessionId]);

  const handleCommit = async () => {
    setCommitLoading(true);
    setCommitError('');
    try {
      const res = await fetch(`/api/imports/commit/${sessionId}`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute commit database writes.');
      }

      // Successful commit redirects to the import report summary view
      router.push(`/import/report/${sessionId}`);
    } catch (err: any) {
      setCommitError(err.message);
    } finally {
      setCommitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Loading staging workspace...</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md mx-auto">
        <ShieldAlert className="mx-auto text-red-500 mb-2" size={32} />
        <p className="text-sm font-bold text-zinc-500">{error || 'Session not found.'}</p>
        <Link href="/import" className="text-xs font-bold text-zinc-900 hover:underline mt-2 inline-block">
          Return to ingestion center
        </Link>
      </div>
    );
  }

  const isApproved = session.status === 'APPROVED';
  const isCommitted = session.status === 'COMMITTED';

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Header Info */}
      <div className="flex flex-col gap-2 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/import" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1 self-start">
          <span>← Back to Ingestion Center</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <FileSpreadsheet size={28} />
              <span>Review Workspace: {session.fileName}</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-semibold text-xs">
              Staged Session: {session.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">Status:</span>
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
              isCommitted ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20' :
              isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20' :
              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 animate-pulse'
            }`}>
              {session.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Proposals and Governance */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <h2 className="text-lg font-extrabold uppercase tracking-wider text-zinc-900 dark:text-zinc-50">
            Pending Normalizations Queue
          </h2>

          {isCommitted ? (
            <div className="bg-blue-50/50 border border-blue-200 text-blue-700 dark:bg-blue-950/10 dark:border-blue-900/30 dark:text-blue-400 p-6 rounded-xl flex flex-col gap-4">
              <div className="flex gap-3 items-start">
                <CheckCircle size={20} className="text-blue-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">Import Session Already Committed</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    This session has already been written to the production database ledger.
                  </p>
                </div>
              </div>
              <Link
                href={`/import/report/${session.id}`}
                className="self-start px-4 py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <span>View Import Report</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <ReviewQueue sessionId={session.id} onRefreshSession={loadSessionDetails} />
          )}
        </div>

        {/* Right Column: Ingestion Status Metrics & Commit Panel */}
        <div className="flex flex-col gap-6">
          
          {/* Commit execution triggers */}
          {!isCommitted && (
            <Card className={isApproved ? 'border-emerald-300 dark:border-emerald-800' : ''}>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Lock size={14} />
                  <span>Atomic Commit Gate</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isApproved ? (
                  <div className="flex flex-col gap-3">
                    <Alert variant="success">
                      <p className="font-bold">Commit Gate Open</p>
                      <p className="text-[10px] mt-0.5">All staged proposals have been resolved. Staged data is verified zero-sum ready.</p>
                    </Alert>
                    
                    {commitError && <Alert variant="error">{commitError}</Alert>}

                    <button
                      onClick={handleCommit}
                      disabled={commitLoading}
                      id="commit-import-button"
                      className="w-full py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm font-bold rounded-lg shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {commitLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Executing Transaction...</span>
                        </>
                      ) : (
                        <span>Commit Import to Ledger</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Alert variant="warning">
                      <p className="font-bold">Commit Gate Locked</p>
                      <p className="text-[10px] mt-0.5">All pending anomaly proposals must be approved or rejected before committing to database.</p>
                    </Alert>
                    <button
                      disabled
                      className="w-full py-2.5 bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-650 text-sm font-bold rounded-lg cursor-not-allowed flex items-center justify-center"
                    >
                      Proposals Outstanding
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Staged anomalies list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400">
                Validation Logs (Anomalies)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.anomalies?.length === 0 ? (
                <p className="text-xs text-emerald-600 font-semibold text-center">No anomalies detected in this session. CSV header formats conform perfectly!</p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {session.anomalies?.map((anomaly: any) => (
                    <div 
                      key={anomaly.id} 
                      className={`flex gap-2.5 items-start p-3 rounded-lg border text-xs font-semibold ${
                        anomaly.severity === 'ERROR' 
                          ? 'bg-red-50/20 border-red-200/40 text-red-700 dark:bg-red-950/5' 
                          : 'bg-amber-50/20 border-amber-200/40 text-amber-700 dark:bg-amber-950/5'
                      }`}
                    >
                      <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold">Row #{anomaly.rowNumber}</span>
                          <span className="w-1 h-1 bg-zinc-350 rounded-full"></span>
                          <span className="text-[9px] font-bold font-mono px-1 rounded bg-white border border-zinc-200">
                            {anomaly.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 font-normal leading-4">{anomaly.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
