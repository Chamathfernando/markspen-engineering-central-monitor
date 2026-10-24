import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'priority' | 'payment';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'status',
  className = ''
}) => {
  const s = (status || '').trim().toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (type === 'status') {
    switch (s) {
      case 'open':
        styles = 'bg-sky-50 text-sky-700 border-sky-200';
        break;
      case 'in progress':
        styles = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'assigned':
        styles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'pending parts':
      case 'pending':
        styles = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'pending customer':
        styles = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'on hold':
        styles = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
      case 'completed':
        styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'closed':
        styles = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
      case 'cancelled':
      case 'invalid':
        styles = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      default:
        styles = 'bg-slate-100 text-slate-700 border-slate-200';
    }
  } else if (type === 'priority') {
    switch (s) {
      case 'critical':
        styles = 'bg-red-100 text-red-900 border-red-300 font-bold ring-1 ring-red-200';
        break;
      case 'high':
        styles = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
        break;
      case 'medium':
        styles = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'low':
        styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      default:
        styles = 'bg-slate-100 text-slate-700 border-slate-200';
    }
  } else if (type === 'payment') {
    switch (s) {
      case 'paid':
        styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'not paid':
        styles = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      default:
        styles = 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          s === 'critical'
            ? 'bg-red-600 animate-ping'
            : s === 'open' || s === 'in progress'
            ? 'bg-blue-500 animate-pulse'
            : s === 'closed' || s === 'not paid'
            ? 'bg-slate-400'
            : s === 'completed' || s === 'paid'
            ? 'bg-emerald-500'
            : s === 'high' || s === 'cancelled'
            ? 'bg-rose-500'
            : s === 'pending customer'
            ? 'bg-purple-500'
            : 'bg-amber-500'
        }`}
      />
      {status || 'Unknown'}
    </span>
  );
};
