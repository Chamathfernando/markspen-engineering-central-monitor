import React from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerInputProps {
  label?: string;
  required?: boolean;
  value: string; // YYYY/MM/DD
  onChange: (value: string) => void;
  minToday?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  className?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  required,
  value,
  onChange,
  minToday = false,
  disabled = false,
  error,
  helpText,
  className = ''
}) => {
  // Convert YYYY/MM/DD to YYYY-MM-DD for native input
  const internalValue = value ? value.replace(/\//g, '-') : '';

  const getTodayNative = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      onChange('');
      return;
    }
    // Convert YYYY-MM-DD to YYYY/MM/DD
    const formatted = raw.replace(/-/g, '/');
    onChange(formatted);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="date"
          value={internalValue}
          min={minToday ? getTodayNative() : undefined}
          disabled={disabled}
          onChange={handleNativeChange}
          className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-lg shadow-xs font-mono transition-colors
            ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'hover:border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}
            ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}`}
        />
        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
      </div>

      <div className="flex items-center justify-between mt-1">
        {error ? (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        ) : (
          <p className="text-[11px] text-slate-400">
            {value ? `Format: ${value}` : 'Format: YYYY/MM/DD'}
          </p>
        )}
        {helpText && !error && <p className="text-xs text-slate-500">{helpText}</p>}
      </div>
    </div>
  );
};
