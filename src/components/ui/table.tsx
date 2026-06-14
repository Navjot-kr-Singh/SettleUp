import React from 'react';

export function Table({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <table className={`w-full border-collapse text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`p-4 font-extrabold ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`p-4 align-middle text-zinc-700 dark:text-zinc-300 font-medium ${className}`} {...props}>
      {children}
    </td>
  );
}
