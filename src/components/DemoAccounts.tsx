import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  notes?: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { name: 'Aisha', email: 'aisha@settleup.com', role: 'MEMBER', notes: 'Active from Feb 1' },
  { name: 'Rohan', email: 'rohan@settleup.com', role: 'MEMBER', notes: 'Active from Feb 1' },
  { name: 'Priya', email: 'priya@settleup.com', role: 'MEMBER', notes: 'Active from Feb 1' },
  { name: 'Meera', email: 'meera@settleup.com', role: 'MEMBER', notes: 'Exit Mar 29' },
  { name: 'Dev', email: 'dev@settleup.com', role: 'MEMBER', notes: 'Active from Feb 1' },
  { name: 'Sam', email: 'sam@settleup.com', role: 'MEMBER', notes: 'Entry Apr 8' },
  { name: 'Kabir', email: 'kabir@settleup.com', role: 'GUEST', notes: 'Transient Guest' },
];

interface DemoAccountsProps {
  onSelect?: (email: string) => void;
  defaultOpen?: boolean;
}

export function DemoAccounts({ onSelect, defaultOpen = false }: DemoAccountsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const router = useRouter();

  const handleSelect = (email: string) => {
    if (onSelect) {
      onSelect(email);
    } else {
      router.push(`/login?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <div className="w-full mt-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 border border-vault-border rounded-lg bg-vault-surface/40 hover:bg-vault-surface/75 hover:border-vault-accent/40 transition-all text-xs font-mono tracking-wider text-vault-text-muted hover:text-vault-text-primary"
      >
        <span>DEMO LEDGER ACCOUNTS</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => handleSelect(account.email)}
              className="flex flex-col items-start p-3 rounded-lg border border-vault-border bg-vault-surface hover:bg-vault-accent/5 hover:border-vault-accent/40 text-left transition-all group scale-100 hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-bold text-vault-text-primary group-hover:text-vault-accent transition-colors">
                  Login as {account.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vault-border text-vault-text-muted">
                  {account.role}
                </span>
              </div>
              <span className="text-xs font-mono text-vault-text-muted mt-1 truncate w-full">
                {account.email}
              </span>
              {account.notes && (
                <span className="text-[10px] text-vault-text-muted/60 mt-1 italic">
                  {account.notes}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
