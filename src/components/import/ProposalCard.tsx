'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { AlertCircle, Check, X, Edit2, ShieldAlert } from 'lucide-react';

interface Proposal {
  id: string;
  sessionId: string;
  recordId: string | null;
  rowNumber: number;
  field: string;
  originalValue: string;
  proposedValue: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  resolvedValue: string | null;
}

interface ProposalCardProps {
  proposal: Proposal;
  onResolve: () => void;
}

export function ProposalCard({ proposal, onResolve }: ProposalCardProps) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customValue, setCustomValue] = useState(proposal.proposedValue);
  const [error, setError] = useState('');

  const handleAction = async (status: 'APPROVED' | 'REJECTED', val?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/imports/proposals/${proposal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          resolvedValue: val !== undefined ? val : proposal.proposedValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update proposal');
      }

      setEditing(false);
      onResolve();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = () => {
    if (proposal.status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    if (proposal.status === 'REJECTED') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
  };

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 ${proposal.status === 'PENDING' ? 'hover:shadow-md' : 'opacity-75'}`}>
      
      {/* Visual left colored boundary bar based on status */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
        proposal.status === 'APPROVED' ? 'bg-emerald-500' :
        proposal.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
      }`} />

      <CardContent className="pl-6 pt-5 pb-5">
        <div className="flex flex-col gap-4">
          
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                Row #{proposal.rowNumber}
              </span>
              <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full"></span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {proposal.field}
              </span>
            </div>
            
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${getStatusClass()}`}>
              {proposal.status}
            </span>
          </div>

          {/* Diff Section */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-red-50/30 border border-red-100/40 rounded-lg dark:bg-red-950/5 dark:border-red-900/10">
              <span className="text-red-500 font-bold block mb-1">Before (Original CSV)</span>
              <p className="font-mono break-all text-zinc-600 dark:text-zinc-400">
                {proposal.originalValue === '' ? <span className="italic text-zinc-400">[Blank]</span> : proposal.originalValue}
              </p>
            </div>

            <div className="p-3 bg-emerald-50/30 border border-emerald-100/40 rounded-lg dark:bg-emerald-950/5 dark:border-emerald-900/10">
              <span className="text-emerald-600 font-bold block mb-1">After (Proposed Fix)</span>
              {editing ? (
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="flex-1 px-2 py-1 border border-zinc-200 rounded text-xs dark:bg-zinc-950 dark:border-zinc-850 focus:outline-none"
                  />
                  <button
                    onClick={() => handleAction('APPROVED', customValue)}
                    disabled={loading}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-1 text-zinc-400 hover:bg-zinc-150 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono break-all text-zinc-800 dark:text-zinc-200">
                    {proposal.status === 'APPROVED' && proposal.resolvedValue ? proposal.resolvedValue : proposal.proposedValue}
                  </p>
                  {proposal.status === 'PENDING' && (
                    <button
                      onClick={() => setEditing(true)}
                      className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reason details */}
          <div className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-100 dark:border-zinc-850/80">
            <ShieldAlert size={14} className="text-zinc-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 block mb-0.5">Normalization Rationale</span>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{proposal.reason}</p>
            </div>
          </div>

          {/* Actions - display if pending */}
          {proposal.status === 'PENDING' && (
            <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 mt-1">
              <button
                onClick={() => handleAction('REJECTED')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                <X size={12} />
                <span>Reject Row</span>
              </button>
              <button
                onClick={() => handleAction('APPROVED')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg text-xs font-bold transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                <Check size={12} />
                <span>Approve Change</span>
              </button>
            </div>
          )}

          {error && (
            <div className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/20 p-2 border border-red-200 rounded">
              {error}
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}
