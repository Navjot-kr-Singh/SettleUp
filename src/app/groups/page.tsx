'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Plus, ShieldAlert, ChevronRight, Hash } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        setGroups(await res.json());
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newGroupName.trim().length < 3) {
      setError('Group name must be at least 3 characters.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group.');
      }

      setNewGroupName('');
      setDialogOpen(false);
      fetchGroups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Header Row */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Collaborative Rooms
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1.5">
            Select a roomspace workspace or initialize a new group roster.
          </p>
        </div>

        <button
          onClick={() => { setDialogOpen(true); setError(''); }}
          id="create-group-trigger"
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold shadow hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          <Plus size={14} />
          <span>New Group</span>
        </button>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
          <div className="w-6 h-6 border-3 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
          <span className="text-xs font-semibold">Loading groups board...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Users size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
          <p className="text-sm font-bold text-zinc-500">No rooms active</p>
          <p className="text-xs text-zinc-400 mt-0.5">Click "New Group" to configure your first roomspace.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} className="group">
              <Card className="hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] h-full flex flex-col justify-between cursor-pointer border border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700">
                <CardContent className="pt-6 pb-6 flex flex-col gap-6">
                  
                  {/* Icon & Details */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold shadow-sm">
                      <Hash size={18} />
                    </div>
                    
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:border-zinc-850">
                      Roster Active
                    </span>
                  </div>

                  {/* Name and members count */}
                  <div className="min-w-0">
                    <h3 className="text-md font-extrabold text-zinc-850 dark:text-zinc-50 group-hover:text-zinc-950 dark:group-hover:text-zinc-200 transition-colors truncate">
                      {group.name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-semibold mt-1 flex items-center gap-1.5">
                      <Users size={12} />
                      <span>{group.memberships?.length || 0} Members / Guests registered</span>
                    </p>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 text-xs font-bold text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-all">
                    <span>Enter Workspace</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>

                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Creation Modal Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Initialize New Space Group"
      >
        <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 p-3 rounded-lg text-xs font-semibold">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Group Space Name</label>
            <input
              type="text"
              id="group-name-input"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Spreetail Flatmates"
              disabled={createLoading}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={createLoading}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="group-submit-button"
              disabled={createLoading}
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {createLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Dialog>

    </div>
  );
}
