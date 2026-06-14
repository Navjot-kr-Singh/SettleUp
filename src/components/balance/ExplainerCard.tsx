'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Clock, Plus, Minus, ArrowUpRight, ArrowDownLeft, Shield } from 'lucide-react';

interface TimelineStep {
  date: string;
  type: 'EXPENSE_PAID' | 'EXPENSE_SHARE' | 'SETTLEMENT_SENT' | 'SETTLEMENT_RECEIVED';
  description: string;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  baseAmount: number; // impact in INR
  runningTotal: number; // running balance after this step
}

interface ExplainerCardProps {
  steps: TimelineStep[];
  userName: string;
}

export function ExplainerCard({ steps, userName }: ExplainerCardProps) {
  const getStepStyles = (type: string) => {
    switch (type) {
      case 'EXPENSE_PAID':
        return {
          icon: <Plus size={14} className="text-emerald-600 dark:text-emerald-400" />,
          bgColor: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30',
          badgeText: 'Paid Expense',
          sign: '+',
          signColor: 'text-emerald-600 dark:text-emerald-400'
        };
      case 'SETTLEMENT_SENT':
        return {
          icon: <ArrowUpRight size={14} className="text-blue-600 dark:text-blue-400" />,
          bgColor: 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30',
          badgeText: 'Sent Repayment',
          sign: '+',
          signColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'EXPENSE_SHARE':
        return {
          icon: <Minus size={14} className="text-red-600 dark:text-red-400" />,
          bgColor: 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30',
          badgeText: 'Owed Share',
          sign: '-',
          signColor: 'text-red-600 dark:text-red-400'
        };
      case 'SETTLEMENT_RECEIVED':
        return {
          icon: <ArrowDownLeft size={14} className="text-amber-600 dark:text-amber-400" />,
          bgColor: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30',
          badgeText: 'Received Repayment',
          sign: '-',
          signColor: 'text-amber-600 dark:text-amber-400'
        };
      default:
        return {
          icon: <Clock size={14} className="text-zinc-600 dark:text-zinc-400" />,
          bgColor: 'bg-zinc-50 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800',
          badgeText: 'Event',
          sign: '',
          signColor: 'text-zinc-650'
        };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} className="text-zinc-500" />
          <span>Audit-Ready Timeline Trace for {userName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-xs text-zinc-400 font-semibold text-center py-6">
            No transactions found affecting this user's balance.
          </p>
        ) : (
          <div className="relative pl-6 flex flex-col gap-6">
            
            {/* Timeline thread line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-zinc-200 dark:bg-zinc-800"></div>

            {steps.map((step, idx) => {
              const styles = getStepStyles(step.type);
              return (
                <div key={idx} className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  
                  {/* Timeline circle node */}
                  <div className={`absolute -left-[23px] top-1 flex items-center justify-center w-5 h-5 rounded-full border bg-white dark:bg-zinc-900 z-10 shadow-sm ${styles.bgColor}`}>
                    {styles.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[9px] font-bold text-zinc-400 font-mono">
                        {new Date(step.date).toLocaleDateString()}
                      </span>
                      <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${styles.bgColor}`}>
                        {styles.badgeText}
                      </span>
                      {step.originalCurrency !== 'INR' && (
                        <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 font-mono">
                          (Converted from {step.originalAmount} {step.originalCurrency} @ {step.exchangeRate})
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 break-words">
                      {step.description}
                    </p>
                  </div>

                  {/* Impact amount and cumulative total */}
                  <div className="flex flex-row sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-4 shrink-0 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                    <div className="min-w-0">
                      <span className="text-[9px] font-semibold text-zinc-400 block sm:hidden">Impact</span>
                      <span className={`text-xs font-extrabold ${styles.signColor}`}>
                        {styles.sign}₹{Math.abs(step.baseAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9px] font-semibold text-zinc-400 block sm:hidden font-sans">Running Total</span>
                      <span className={`text-[10px] font-extrabold font-mono ${
                        step.runningTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}>
                        Balance: ₹{step.runningTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
