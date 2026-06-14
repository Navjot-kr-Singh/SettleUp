'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  Plus, 
  DollarSign, 
  ArrowRight, 
  History, 
  AlertCircle, 
  Info, 
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  CreditCard,
  Send,
  HelpCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { MinTransactions } from '@/components/balance/MinTransactions';

export default function GroupDetailPage() {
  const { id: groupId } = useParams() as { id: string };
  const { data: session } = useSession();
  const router = useRouter();
  
  // Data States
  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [settlementPlan, setSettlementPlan] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]); // System users for selection
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');

  // Modal States
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  // Form Fields: Expense
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES'>('EQUAL');
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, { selected: boolean; value: string }>>({});
  const [expenseError, setExpenseError] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);

  // Form Fields: Settlement
  const [senderId, setSenderId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementCurrency, setSettlementCurrency] = useState('INR');
  const [settlementError, setSettlementError] = useState('');
  const [settlementLoading, setSettlementLoading] = useState(false);

  // Form Fields: Add Member
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [membershipNotes, setMembershipNotes] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);

  // Form Fields: Remove Member
  const [selectedUserToRemove, setSelectedUserToRemove] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [groupRes, expensesRes, settlementsRes, balancesRes, planRes, usersRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/expenses?groupId=${groupId}`),
        fetch(`/api/settlements?groupId=${groupId}`),
        fetch(`/api/balances/group/${groupId}`),
        fetch(`/api/balances/settlement-plan/${groupId}`),
        fetch('/api/users'),
      ]);

      if (groupRes.ok) setGroup(await groupRes.json());
      if (expensesRes.ok) setExpenses(await expensesRes.json());
      if (settlementsRes.ok) setSettlements(await settlementsRes.json());
      if (balancesRes.ok) setBalances(await balancesRes.json());
      if (planRes.ok) setSettlementPlan(await planRes.json());
      if (usersRes.ok) {
        const uList = await usersRes.json();
        setUsers(uList);
      }
    } catch (err) {
      console.error('Failed to load group details workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      loadAllData();
    }
  }, [groupId]);

  // Initializing participant checkboxes when group members change
  useEffect(() => {
    if (group?.memberships) {
      const initial: Record<string, { selected: boolean; value: string }> = {};
      group.memberships.forEach((m: any) => {
        if (m.leftAt === null) {
          initial[m.userId] = { selected: true, value: '' };
        }
      });
      setSelectedParticipants(initial);
    }
  }, [group]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    if (!description || !amount || !paidBy) {
      setExpenseError('Please enter description, amount, and payer.');
      return;
    }

    const participantsPayload = Object.entries(selectedParticipants)
      .filter(([_, data]) => data.selected)
      .map(([userId, data]) => ({
        userId,
        shareValue: data.value ? parseFloat(data.value) : undefined,
      }));

    if (participantsPayload.length === 0) {
      setExpenseError('Please select at least one split participant.');
      return;
    }

    setExpenseLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          paidById: paidBy,
          description,
          originalAmount: parseFloat(amount),
          originalCurrency: currency,
          date: new Date().toISOString().split('T')[0],
          splitType,
          participants: participantsPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record expense.');
      }

      setExpenseDialogOpen(false);
      setDescription('');
      setAmount('');
      loadAllData();
    } catch (err: any) {
      setExpenseError(err.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettlementError('');
    if (!senderId || !receiverId || !settlementAmount) {
      setSettlementError('Please fill in all settlement fields.');
      return;
    }
    if (senderId === receiverId) {
      setSettlementError('Sender and receiver cannot be the same user.');
      return;
    }

    setSettlementLoading(true);
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          senderId,
          receiverId,
          amount: parseFloat(settlementAmount),
          currency: settlementCurrency,
          date: new Date().toISOString().split('T')[0],
          notes: `Settled repayment.`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record repayment.');
      }

      setSettlementDialogOpen(false);
      setSettlementAmount('');
      loadAllData();
    } catch (err: any) {
      setSettlementError(err.message);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    if (!selectedUserToAdd) {
      setMemberError('Please select a user to add.');
      return;
    }

    setMemberLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserToAdd,
          notes: membershipNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add user to roster.');
      }

      setMemberDialogOpen(false);
      setSelectedUserToAdd('');
      setMembershipNotes('');
      loadAllData();
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRemoveError('');
    if (!selectedUserToRemove) {
      setRemoveError('Please select a user.');
      return;
    }

    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserToRemove,
          notes: exitNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to deactivate member.');
      }

      setRemoveDialogOpen(false);
      setSelectedUserToRemove('');
      setExitNotes('');
      loadAllData();
    } catch (err: any) {
      setRemoveError(err.message);
    } finally {
      setRemoveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin dark:border-zinc-50"></div>
        <span className="text-xs font-semibold">Loading group detail hub...</span>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md mx-auto">
        <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
        <p className="text-sm font-bold text-zinc-500">Group not found</p>
        <Link href="/groups" className="text-xs font-bold text-zinc-900 hover:underline mt-2 inline-block">
          Return to groups board
        </Link>
      </div>
    );
  }

  // Active membership list helper
  const activeMemberships = group.memberships.filter((m: any) => m.leftAt === null);

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto font-sans text-zinc-900 dark:text-zinc-50">
      
      {/* Back button and page title */}
      <div className="flex flex-col gap-2">
        <Link href="/groups" className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1 self-start">
          <span>← Back to Rooms</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {group.name}
            </h1>
            <p className="text-xs text-zinc-400 font-semibold mt-1 flex items-center gap-2">
              <Users size={12} />
              <span>Workspace ID: {group.id}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSettlementDialogOpen(true); setSettlementError(''); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold transition-all"
            >
              <Send size={13} />
              <span>Record Repayment</span>
            </button>
            <button
              onClick={() => { setExpenseDialogOpen(true); setExpenseError(''); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl text-xs font-bold shadow hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <Plus size={14} />
              <span>Log Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs list selector */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 w-full gap-6">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 text-sm font-extrabold transition-all relative ${
            activeTab === 'expenses' 
              ? 'text-zinc-950 dark:text-zinc-50' 
              : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Expenses & Settlements
          {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 dark:bg-zinc-50"></div>}
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-3 text-sm font-extrabold transition-all relative ${
            activeTab === 'balances' 
              ? 'text-zinc-950 dark:text-zinc-50' 
              : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Balances & Simplification
          {activeTab === 'balances' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 dark:bg-zinc-50"></div>}
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-extrabold transition-all relative ${
            activeTab === 'members' 
              ? 'text-zinc-950 dark:text-zinc-50' 
              : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Members & History
          {activeTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 dark:bg-zinc-50"></div>}
        </button>
      </div>

      {/* Main Workspace Area Content */}
      <div className="w-full">
        {activeTab === 'expenses' && (
          <div className="flex flex-col gap-8">
            
            {/* Expenses Grid List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={15} />
                  <span>Logged Expense items ({expenses.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-semibold text-center py-6">No manual expenses logged for this group.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Paid By</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Split Type</TableHead>
                        <TableHead>Base Impact (INR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(exp.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-bold text-zinc-800 dark:text-zinc-200">
                            {exp.description}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {exp.paidBy?.name}
                          </TableCell>
                          <TableCell className="font-mono font-bold">
                            {exp.originalCurrency} {parseFloat(exp.originalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className="text-[9px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                              {exp.splitType}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                            ₹{parseFloat(exp.baseCurrencyAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Settlements Grid List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send size={15} />
                  <span>Repayments & Settlements History ({settlements.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-semibold text-center py-6">No direct repayment settlements recorded.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Sender (From)</TableHead>
                        <TableHead>Recipient (To)</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Exchange Rate</TableHead>
                        <TableHead>Total (INR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((set) => (
                        <TableRow key={set.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(set.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-semibold text-red-500">
                            {set.sender?.name}
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {set.receiver?.name}
                          </TableCell>
                          <TableCell className="font-mono font-bold">
                            {set.currency} {parseFloat(set.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-400">
                            {set.exchangeRate}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                            ₹{parseFloat(set.baseCurrencyAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Net balances table and Explain actions */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={15} />
                    <span>Member Net Balances Ledger</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Name</TableHead>
                        <TableHead>Status Role</TableHead>
                        <TableHead>Net Balance (INR)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balances.map((item) => (
                        <TableRow key={item.userId}>
                          <TableCell className="font-bold text-zinc-800 dark:text-zinc-200">
                            {group.memberships.find((m: any) => m.userId === item.userId)?.user?.name || item.userId}
                          </TableCell>
                          <TableCell>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              group.memberships.find((m: any) => m.userId === item.userId)?.user?.role === 'GUEST'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20'
                                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                            }`}>
                              {group.memberships.find((m: any) => m.userId === item.userId)?.user?.role || 'MEMBER'}
                            </span>
                          </TableCell>
                          <TableCell className={`font-mono font-extrabold ${item.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {item.netBalance >= 0 ? '+' : ''}₹{item.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link 
                              href={`/groups/${groupId}/balances/${item.userId}`}
                              className="text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 flex items-center gap-1 justify-end"
                            >
                              <HelpCircle size={13} />
                              <span>Explain Audit Trace</span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right: Min Settlement Plans */}
            <div className="shrink-0 flex flex-col gap-6">
              <MinTransactions settlements={settlementPlan} />
            </div>

          </div>
        )}

        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Members roster list */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Card>
                <CardHeader className="flex justify-between items-center gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Users size={15} />
                    <span>Roster Group Memberships</span>
                  </CardTitle>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRemoveDialogOpen(true); setRemoveError(''); }}
                      className="px-2 py-1 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold"
                    >
                      Remove Member
                    </button>
                    <button
                      onClick={() => { setMemberDialogOpen(true); setMemberError(''); }}
                      className="px-2.5 py-1 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-xs font-bold"
                    >
                      Add Member
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>System Role</TableHead>
                        <TableHead>Joined At</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.memberships.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-bold text-zinc-800 dark:text-zinc-200">{m.user.name}</TableCell>
                          <TableCell className="text-xs">{m.user.email || 'N/A'}</TableCell>
                          <TableCell>
                            <span className="text-[9px] font-bold bg-zinc-100 px-2 py-0.5 rounded text-zinc-500 dark:bg-zinc-800">
                              {m.user.role}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{new Date(m.joinedAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {m.leftAt ? (
                              <span className="text-[8px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                Left ({new Date(m.leftAt).toLocaleDateString()})
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Active Member
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right: Chronological Join/Leave history logs */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <History size={14} />
                    <span>Dynamic Roster timeline</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {group.timeline?.length === 0 ? (
                    <p className="text-xs text-zinc-400 font-semibold text-center">No roster events logged.</p>
                  ) : (
                    <div className="relative pl-4 flex flex-col gap-5">
                      <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-zinc-200 dark:bg-zinc-850"></div>
                      
                      {group.timeline?.map((event: any, idx: number) => (
                        <div key={idx} className="relative flex gap-3 items-start">
                          <div className={`absolute -left-[15px] top-1 w-2.5 h-2.5 rounded-full border border-white dark:border-zinc-900 ${
                            event.eventType === 'JOIN' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}></div>
                          
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{event.userName}</span>
                              <span className={`text-[7px] font-bold px-1 rounded ${
                                event.eventType === 'JOIN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {event.eventType}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{new Date(event.eventDate).toLocaleDateString()}</p>
                            <p className="text-[10px] text-zinc-500 font-medium mt-1">{event.notes}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </div>

      {/* Manual Expense Creator Dialog */}
      <Dialog
        open={expenseDialogOpen}
        onClose={() => setExpenseDialogOpen(false)}
        title="Log Manual Expense Roomspace"
      >
        <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-4">
          {expenseError && (
            <Alert variant="error">{expenseError}</Alert>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Expense Description</label>
            <input
              type="text"
              id="expense-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Pizza Night"
              disabled={expenseLoading}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                id="expense-amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={expenseLoading}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2"
              />
            </div>

            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={expenseLoading}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Paid By (Payer)"
              id="expense-payer-select"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              disabled={expenseLoading}
            >
              <option value="">Select Payer...</option>
              {activeMemberships.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.user.name}</option>
              ))}
              {/* Also add guests if they are not in permanent membership */}
              {users.filter(u => u.role === 'GUEST' && !activeMemberships.some((m: any) => m.userId === u.id)).map(guest => (
                <option key={guest.id} value={guest.id}>{guest.name} (GUEST)</option>
              ))}
            </Select>

            <Select
              label="Split Strategy"
              id="expense-strategy-select"
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as any)}
              disabled={expenseLoading}
            >
              <option value="EQUAL">EQUAL Splits</option>
              <option value="EXACT">EXACT Amounts</option>
              <option value="PERCENTAGE">PERCENTAGE Shares</option>
              <option value="SHARES">SHARE Allocations</option>
            </Select>
          </div>

          {/* Participants Checklist */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-2">Split With (Participants)</label>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 bg-zinc-50/20">
              {users.map((user) => {
                const isMember = activeMemberships.some((m: any) => m.userId === user.id);
                // Exclude Meera if she already left
                const wasMember = group.memberships.some((m: any) => m.userId === user.id);
                const hasLeft = group.memberships.find((m: any) => m.userId === user.id)?.leftAt !== null;
                
                if (hasLeft) return null;
                if (!isMember && user.role !== 'GUEST') return null; // normal member must be active in group

                const state = selectedParticipants[user.id] || { selected: false, value: '' };

                return (
                  <div key={user.id} className="flex items-center justify-between text-xs gap-3">
                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.selected}
                        onChange={(e) => {
                          setSelectedParticipants({
                            ...selectedParticipants,
                            [user.id]: { ...state, selected: e.target.checked }
                          });
                        }}
                        className="rounded border-zinc-350"
                      />
                      <span>{user.name}</span>
                      {user.role === 'GUEST' && (
                        <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded">GUEST</span>
                      )}
                    </label>
                    
                    {state.selected && splitType !== 'EQUAL' && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={
                            splitType === 'PERCENTAGE' ? '%' :
                            splitType === 'SHARES' ? 'shares' : '₹'
                          }
                          value={state.value}
                          onChange={(e) => {
                            setSelectedParticipants({
                              ...selectedParticipants,
                              [user.id]: { ...state, value: e.target.value }
                            });
                          }}
                          className="w-20 px-2 py-0.5 border border-zinc-200 rounded text-right text-xs"
                        />
                        <span className="text-[10px] text-zinc-400 font-semibold font-mono">
                          {splitType === 'PERCENTAGE' ? '%' :
                           splitType === 'SHARES' ? 'sh' : 'INR'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setExpenseDialogOpen(false)}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="expense-submit-button"
              disabled={expenseLoading}
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg text-xs font-bold transition-all"
            >
              {expenseLoading ? 'Saving...' : 'Log Expense'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Manual Settlement Repayments Creator Dialog */}
      <Dialog
        open={settlementDialogOpen}
        onClose={() => setSettlementDialogOpen(false)}
        title="Record Repayment Settlement"
      >
        <form onSubmit={handleSettlementSubmit} className="flex flex-col gap-4">
          {settlementError && (
            <Alert variant="error">{settlementError}</Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Sender (Payer)"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              disabled={settlementLoading}
            >
              <option value="">Select Sender...</option>
              {activeMemberships.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.user.name}</option>
              ))}
              {users.filter(u => u.role === 'GUEST' && !activeMemberships.some((m: any) => m.userId === u.id)).map(guest => (
                <option key={guest.id} value={guest.id}>{guest.name} (GUEST)</option>
              ))}
            </Select>

            <Select
              label="Receiver (Recipient)"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              disabled={settlementLoading}
            >
              <option value="">Select Recipient...</option>
              {activeMemberships.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.user.name}</option>
              ))}
              {users.filter(u => u.role === 'GUEST' && !activeMemberships.some((m: any) => m.userId === u.id)).map(guest => (
                <option key={guest.id} value={guest.id}>{guest.name} (GUEST)</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Repayment Amount</label>
              <input
                type="number"
                step="0.01"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                placeholder="0.00"
                disabled={settlementLoading}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-sm focus:outline-none"
              />
            </div>

            <Select
              label="Currency"
              value={settlementCurrency}
              onChange={(e) => setSettlementCurrency(e.target.value)}
              disabled={settlementLoading}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setSettlementDialogOpen(false)}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settlementLoading}
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg text-xs font-bold transition-all"
            >
              {settlementLoading ? 'Saving...' : 'Record Repayment'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={memberDialogOpen}
        onClose={() => setMemberDialogOpen(false)}
        title="Invite User to Group Roster"
      >
        <form onSubmit={handleAddMemberSubmit} className="flex flex-col gap-4">
          {memberError && <Alert variant="error">{memberError}</Alert>}

          <Select
            label="System User"
            value={selectedUserToAdd}
            onChange={(e) => setSelectedUserToAdd(e.target.value)}
            disabled={memberLoading}
          >
            <option value="">Select User...</option>
            {users.filter(u => !group.memberships.some((m: any) => m.userId === u.id && m.leftAt === null)).map(user => (
              <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
            ))}
          </Select>

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Membership Notes</label>
            <input
              type="text"
              value={membershipNotes}
              onChange={(e) => setMembershipNotes(e.target.value)}
              placeholder="e.g. Moved in to room 2"
              disabled={memberLoading}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 text-sm focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setMemberDialogOpen(false)}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={memberLoading}
              className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-lg text-xs font-bold transition-all"
            >
              {memberLoading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        title="Deactivate Member (Record Exit Date)"
      >
        <form onSubmit={handleRemoveMemberSubmit} className="flex flex-col gap-4">
          {removeError && <Alert variant="error">{removeError}</Alert>}

          <Select
            label="Active Member"
            value={selectedUserToRemove}
            onChange={(e) => setSelectedUserToRemove(e.target.value)}
            disabled={removeLoading}
          >
            <option value="">Select Member...</option>
            {activeMemberships.map((m: any) => (
              <option key={m.userId} value={m.userId}>{m.user.name}</option>
            ))}
          </Select>

          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Exit Notes</label>
            <input
              type="text"
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              placeholder="e.g. Moved out of roomspace"
              disabled={removeLoading}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/50 text-sm focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setRemoveDialogOpen(false)}
              className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={removeLoading}
              className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all"
            >
              {removeLoading ? 'Removing...' : 'Confirm Exit'}
            </button>
          </div>
        </form>
      </Dialog>

    </div>
  );
}
