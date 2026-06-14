'use client';

import React, { useState, useEffect } from 'react';
import { ProposalCard } from './ProposalCard';
import { RefreshCw, Filter, ShieldAlert } from 'lucide-react';
import { Select } from '../ui/select';

interface ReviewQueueProps {
  sessionId: string;
  onRefreshSession: () => void;
}

export function ReviewQueue({ sessionId, onRefreshSession }: ReviewQueueProps) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sessionId,
        page: page.toString(),
        limit: '10',
      });
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/imports/proposals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [sessionId, statusFilter, page]);

  const handleResolve = () => {
    fetchProposals();
    onRefreshSession(); // Tells the parent session page that a proposal was resolved, to see if state is APPROVED now.
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-zinc-400" />
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter Governance Queue</span>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-40 text-xs py-1"
          >
            <option value="ALL">All Proposals</option>
            <option value="PENDING">Pending Action</option>
            <option value="APPROVED">Approved Corrections</option>
            <option value="REJECTED">Rejected Rows</option>
          </Select>

          <button
            onClick={fetchProposals}
            className="p-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
          <p className="text-xs font-semibold">Loading data proposals...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <ShieldAlert className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={32} />
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Queue is empty</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            No proposals found matching the selected filters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.map((proposal) => (
            <ProposalCard 
              key={proposal.id} 
              proposal={proposal} 
              onResolve={handleResolve} 
            />
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-2">
              <span className="text-[10px] text-zinc-500 font-medium">
                Page {page} of {totalPages} ({totalCount} items total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1 border border-zinc-200 dark:border-zinc-850 rounded-lg text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1 border border-zinc-200 dark:border-zinc-850 rounded-lg text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
