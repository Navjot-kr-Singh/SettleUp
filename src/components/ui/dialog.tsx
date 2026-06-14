'use client';

import React from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = '' }: DialogProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/75 animate-fade-in backdrop-blur-sm">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div 
        className={`relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-zoom-in ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/80">
          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Body content scrollable */}
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
