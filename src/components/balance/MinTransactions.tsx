'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ArrowRight, DollarSign, Wallet } from 'lucide-react';

interface SettlementItem {
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  amount: number;
}

interface MinTransactionsProps {
  settlements: SettlementItem[];
  currencySymbol?: string;
}

export function MinTransactions({ settlements, currencySymbol = '₹' }: MinTransactionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet size={16} className="text-zinc-500" />
          <span>Debt Simplification (Minimized Repayments Plan)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {settlements.length === 0 ? (
          <p className="text-xs text-zinc-400 font-semibold text-center py-4">
            No settlements required. All balances are fully cleared!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {settlements.map((item, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-3.5 rounded-xl shadow-sm hover:scale-[1.005] transition-all"
              >
                {/* Debtor */}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-0.5">Pays (Debtor)</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.senderName}</span>
                </div>

                {/* Arrow & Amount */}
                <div className="flex flex-col items-center shrink-0 px-4">
                  <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center">
                    {currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <ArrowRight size={14} className="text-zinc-400 mt-1" />
                </div>

                {/* Creditor */}
                <div className="min-w-0 flex-1 text-right">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-0.5">Receives (Creditor)</span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.receiverName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
