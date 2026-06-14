import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}

export function Select({ label, children, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-xs font-bold text-zinc-500">{label}</label>}
      <select
        className={`w-full px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
