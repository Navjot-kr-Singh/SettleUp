'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  X, 
  Plus, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX, 
  Upload, 
  AlertTriangle, 
  Shield, 
  RefreshCw,
  Eye
} from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter States
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  
  // Details Drawer State
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Available Action Types list for filter dropdown
  const actionTypes = [
    'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'DELETE_EXPENSE',
    'CREATE_SETTLEMENT', 'UPDATE_SETTLEMENT', 'DELETE_SETTLEMENT',
    'CREATE_GROUP', 'UPDATE_GROUP', 'DELETE_GROUP',
    'MEMBER_JOIN', 'MEMBER_LEAVE',
    'IMPORT_START', 'IMPORT_COMPLETE', 'IMPORT_FAILED',
    'ANOMALY_DETECTED', 'ANOMALY_RESOLVED',
    'PROPOSAL_CREATED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED',
    'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT'
  ];

  // Load users for filtering
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/currencies') // standard placeholder to verify backend response, but let's query custom route for users later if needed.
      // Instead, we will extract users from the loaded logs to construct a user list dynamically
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '15');
      if (search) params.append('search', search);
      if (entityType) params.append('entityType', entityType);
      if (actionType) params.append('actions', actionType);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      if (selectedUser) params.append('userId', selectedUser);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        
        // Dynamically build user filter from loaded logs if not done
        if (users.length === 0 && data.logs) {
          const userMap = new Map();
          data.logs.forEach((l: any) => {
            if (l.user) userMap.set(l.user.id, l.user.name);
          });
          setUsers(Array.from(userMap.entries()).map(([id, name]) => ({ id, name })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, entityType, actionType, startDate, endDate, selectedUser]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const resetFilters = () => {
    setSearch('');
    setEntityType('');
    setActionType('');
    setStartDate('');
    setEndDate('');
    setSelectedUser('');
    setPage(1);
  };

  // Helper to choose color themes based on action types
  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('CREATE_')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
    if (action.startsWith('UPDATE_')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
    if (action.startsWith('DELETE_') || action === 'LOGIN_FAILURE') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
    if (action.startsWith('MEMBER_')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
    if (action.startsWith('IMPORT_') || action.startsWith('PROPOSAL_')) return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30';
    return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  };

  // Helper to render lucide icon based on action
  const getActionIcon = (action: string) => {
    const size = 16;
    if (action.includes('CREATE_EXPENSE') || action.includes('CREATE_SETTLEMENT')) return <Plus size={size} className="text-emerald-600 dark:text-emerald-400" />;
    if (action.includes('UPDATE_')) return <Edit size={size} className="text-amber-600 dark:text-amber-400" />;
    if (action.includes('DELETE_')) return <Trash2 size={size} className="text-red-600 dark:text-red-400" />;
    if (action === 'MEMBER_JOIN') return <UserCheck size={size} className="text-blue-600 dark:text-blue-400" />;
    if (action === 'MEMBER_LEAVE') return <UserX size={size} className="text-red-600 dark:text-red-400" />;
    if (action.includes('IMPORT_')) return <Upload size={size} className="text-violet-600 dark:text-violet-400" />;
    if (action.includes('ANOMALY_')) return <AlertTriangle size={size} className="text-amber-600 dark:text-amber-400" />;
    if (action.includes('PROPOSAL_')) return <FileText size={size} className="text-violet-600 dark:text-violet-400" />;
    if (action === 'LOGIN_SUCCESS') return <CheckCircle size={size} className="text-emerald-600 dark:text-emerald-400" />;
    if (action === 'LOGIN_FAILURE') return <XCircle size={size} className="text-red-600 dark:text-red-400" />;
    return <Shield size={size} className="text-zinc-600 dark:text-zinc-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 py-10 px-6 sm:px-10 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <Shield className="text-zinc-900 dark:text-zinc-50" size={32} />
              System Audit Trail
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl">
              Real-time, date-aware audit ledger acting as the single source of truth for all SettleUp business transactions and entity mutations.
            </p>
          </div>
          <button 
            onClick={fetchLogs} 
            className="flex items-center gap-2 self-start md:self-center bg-white border border-zinc-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
            
            {/* Search Input Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search comments, entity IDs, or notes..." 
                  className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all text-sm"
                />
              </div>
              <button 
                type="submit"
                className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-sm font-semibold transition-all"
              >
                Search
              </button>
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              
              {/* Actor Filter */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Actor User</label>
                <select 
                  value={selectedUser} 
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none text-xs"
                >
                  <option value="">All Users (Actors)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Event Action</label>
                <select 
                  value={actionType} 
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none text-xs"
                >
                  <option value="">All Actions</option>
                  {actionTypes.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Entity Group</label>
                <select 
                  value={entityType} 
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none text-xs"
                >
                  <option value="">All Entities</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="SETTLEMENT">SETTLEMENT</option>
                  <option value="GROUP">GROUP</option>
                  <option value="MEMBERSHIP">MEMBERSHIP</option>
                  <option value="SYSTEM">SYSTEM</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none text-xs"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none text-xs"
                />
              </div>

            </div>

            {/* Reset Button */}
            <div className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button 
                type="button" 
                onClick={resetFilters}
                className="text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 text-xs font-bold transition-all"
              >
                Clear Filters
              </button>
            </div>

          </form>
        </div>

        {/* Timeline Log Feed */}
        <div className="relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-3">
              <RefreshCw size={24} className="animate-spin text-zinc-500" />
              <p className="text-sm font-medium">Fetching secure ledger audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <Shield className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-600 dark:text-zinc-400 font-bold">No Audit Records Found</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">Try modifying your query tags or keyword searches.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Vertical timeline trail line for visual connection */}
              <div className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-zinc-200 dark:bg-zinc-800 hidden md:block"></div>

              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="flex gap-4 items-start relative bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => {
                    setSelectedLog(log);
                    setDrawerOpen(true);
                  }}
                >
                  
                  {/* Visual Left Badge/Badge line */}
                  <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-zinc-200 bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 shadow-sm z-10 shrink-0 group-hover:scale-110 transition-transform">
                    {getActionIcon(log.action)}
                  </div>

                  {/* Log details content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium font-mono">
                          ID: {log.id.substring(0, 8)}...
                        </span>
                      </div>
                      
                      {/* Timestamp */}
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {log.notes || `${log.action} performed on ${log.entityType}`}
                    </p>

                    {/* Metadata Row */}
                    <div className="mt-3 flex flex-wrap gap-y-2 gap-x-6 text-xs text-zinc-500 dark:text-zinc-400 font-medium border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                      <span className="flex items-center gap-1">
                        <User size={13} />
                        Actor: <strong className="text-zinc-700 dark:text-zinc-300">{log.user?.name || 'SYSTEM'}</strong>
                      </span>
                      <span>
                        Target: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{log.entityType} ({log.entityId.substring(0, 8)}...)</strong>
                      </span>
                      {log.correlationId && (
                        <span>
                          Correlation ID: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{log.correlationId.substring(0, 8)}...</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right chevron hover button */}
                  <div className="self-center flex items-center gap-2 text-zinc-300 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                    <Eye size={18} />
                  </div>

                </div>
              ))}

            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 mt-8 pt-6">
            <span className="text-xs text-zinc-500 font-medium">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} entries total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Details Slide-out Drawer */}
      {drawerOpen && selectedLog && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex justify-end transition-opacity duration-300">
          
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)}></div>
          
          {/* Drawer Container */}
          <div className="relative w-full max-w-xl h-full bg-white dark:bg-zinc-900 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-slide-in p-6 overflow-y-auto">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
              <div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getActionBadgeColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                  Log Detail: {selectedLog.id.substring(0, 16)}...
                </h2>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Standard Details Stack */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-xs font-medium bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                <div>
                  <span className="text-zinc-400 block mb-1">Actor User</span>
                  <span className="text-zinc-800 dark:text-zinc-200 text-sm font-bold flex items-center gap-1">
                    <User size={12} />
                    {selectedLog.user?.name || 'SYSTEM'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">Timestamp</span>
                  <span className="text-zinc-800 dark:text-zinc-200 text-sm font-bold flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-400 block mb-1">Entity Target</span>
                  <span className="text-zinc-800 dark:text-zinc-200 text-xs font-mono font-bold">
                    {selectedLog.entityType} ({selectedLog.entityId.substring(0, 8)}...)
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-zinc-400 block mb-1">Correlation ID</span>
                  <span className="text-zinc-800 dark:text-zinc-200 text-xs font-mono font-bold">
                    {selectedLog.correlationId || 'None'}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-xs font-semibold text-zinc-400 block mb-1">Notes / Logs</span>
                <p className="bg-zinc-50 dark:bg-zinc-950 px-4 py-3 rounded-lg border border-zinc-100 dark:border-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {selectedLog.notes || 'No custom notes logged.'}
                </p>
              </div>
            </div>

            {/* UPDATE visual diff */}
            {selectedLog.action.includes('UPDATE_') && selectedLog.changedFields ? (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Changed Fields Comparison</h3>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="p-3 font-semibold text-zinc-500">Property</th>
                        <th className="p-3 font-semibold text-zinc-500">Before</th>
                        <th className="p-3 font-semibold text-zinc-500">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {Object.entries(selectedLog.changedFields).map(([field, data]: any) => (
                        <tr key={field} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="p-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">{field}</td>
                          <td className="p-3 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400 font-medium">
                            {typeof data.before === 'object' ? JSON.stringify(data.before) : String(data.before)}
                          </td>
                          <td className="p-3 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-medium">
                            {typeof data.after === 'object' ? JSON.stringify(data.after) : String(data.after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Collapsible raw details views */}
            <div className="space-y-4 mt-auto">
              
              {/* Metadata JSON */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 mb-1">Extra Metadata Context</h3>
                  <pre className="bg-zinc-950 text-zinc-300 p-4 rounded-lg text-[10px] font-mono overflow-x-auto border border-zinc-800">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Collapsible Before / After states JSON for deep inspections */}
              {selectedLog.beforeState && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 mb-1">Raw Before State Snapshot</h3>
                  <pre className="bg-zinc-950 text-zinc-300 p-4 rounded-lg text-[10px] font-mono overflow-x-auto border border-zinc-800 max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterState && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 mb-1">Raw After State Snapshot</h3>
                  <pre className="bg-zinc-950 text-zinc-300 p-4 rounded-lg text-[10px] font-mono overflow-x-auto border border-zinc-800 max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedLog.afterState, null, 2)}
                  </pre>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* Slide in drawer keyframes styles injection */}
      <style jsx font-css>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

    </div>
  );
}
