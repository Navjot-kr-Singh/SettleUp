import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
}

export function Alert({ children, variant = 'info', className = '' }: AlertProps) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400',
    error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400',
  };

  const icons = {
    info: <Info size={16} className="shrink-0" />,
    success: <CheckCircle size={16} className="shrink-0" />,
    warning: <AlertTriangle size={16} className="shrink-0" />,
    error: <AlertCircle size={16} className="shrink-0" />,
  };

  return (
    <div className={`flex gap-3 border p-4 rounded-xl text-xs font-medium ${styles[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex-1">{children}</div>
    </div>
  );
}
