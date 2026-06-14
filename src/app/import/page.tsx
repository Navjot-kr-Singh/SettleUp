'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FileUpload } from '@/components/import/FileUpload';
import { Upload, FileSpreadsheet, AlertTriangle, ShieldCheck, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ImportPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSessionsAndGroups = async () => {
    setLoading(true);
    try {
      const [groupsRes, sessionsRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/imports/session'),
      ]);

      if (groupsRes.ok) {
        const groupData = await groupsRes.json();
        setGroups(groupData);
        if (groupData.length > 0) setSelectedGroup(groupData[0].id);
      }
      if (sessionsRes.ok) {
        setSessions(await sessionsRes.json());
      }
    } catch (err) {
      console.error('Failed to load import center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionsAndGroups();
  }, []);

  const handleUpload = async (fileName: string, content: string) => {
    if (!selectedGroup) {
      setError('Please select a target group first.');
      return;
    }
    
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/imports/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: selectedGroup,
          fileName,
          csvContent: content,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute dry-run simulation.');
      }

      // Successful dry-run redirects directly to the review queue portal
      router.push(`/import/review/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
      REVIEW_REQUIRED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 animate-pulse',
      COMMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30',
      FAILED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30',
    };
    return (
      <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${styles[status] || 'bg-zinc-50 border-zinc-200'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Loading import engine...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Page Header */}
      <div className="flex flex-col gap-2 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <Upload size={28} className="text-zinc-850 dark:text-zinc-50" />
          <span>CSV Ingestion Center</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Perform secure, zero-risk dry-run balance simulations before committing ledger records.
        </p>
      </div>

      {/* Main Grid: Upload left, History right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: file uploader dropzone */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet size={15} />
                <span>Upload CSV Ledger</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              
              {/* Group Selector */}
              <Select
                label="Target Roomspace Group"
                id="import-group-select"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                disabled={uploading}
              >
                <option value="">Select Group...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </Select>

              {/* Upload Drozone */}
              <FileUpload onUpload={handleUpload} loading={uploading} />
              
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 p-3 rounded-lg text-xs font-semibold">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Recent sessions list */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Clock size={14} />
                <span>Recent Ingestion Runs</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-xs text-zinc-400 font-semibold text-center py-6">No uploads staged yet.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {sessions.map((sess) => (
                    <div key={sess.id} className="flex flex-col border-b border-zinc-150/40 dark:border-zinc-800 pb-3 last:border-b-0 last:pb-0 gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{sess.fileName}</p>
                          <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                            {new Date(sess.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {getStatusBadge(sess.status)}
                      </div>

                      {/* Route Redirect link based on state */}
                      <div className="flex justify-end pt-1">
                        {sess.status === 'REVIEW_REQUIRED' || sess.status === 'APPROVED' ? (
                          <Link
                            href={`/import/review/${sess.id}`}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 flex items-center gap-1"
                          >
                            <span>Open Queue</span>
                            <ChevronRight size={12} />
                          </Link>
                        ) : sess.status === 'COMMITTED' ? (
                          <Link
                            href={`/import/report/${sess.id}`}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <span>View Report</span>
                            <ChevronRight size={12} />
                          </Link>
                        ) : null}
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
