import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  description?: string;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  className?: string;
  emptyMessage?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  helpText,
  className = '',
  emptyMessage = 'No matching options'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter(opt => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.badge && opt.badge.toLowerCase().includes(term)) ||
      (opt.description && opt.description.toLowerCase().includes(term))
    );
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white border rounded-lg shadow-xs transition-colors text-left
          ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'hover:border-slate-400 cursor-pointer'}
          ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
      >
        <span className="truncate block font-normal text-slate-900 flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <span className="font-semibold text-slate-900 shrink-0 max-w-[65%] truncate" title={selectedOption.label}>
                {selectedOption.label}
              </span>
              {(selectedOption.badge || selectedOption.description) && (
                <div className="flex items-center gap-1.5 shrink min-w-0 overflow-hidden text-right">
                  {selectedOption.badge && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {selectedOption.badge}
                    </span>
                  )}
                  {selectedOption.description && (
                    <span className="text-[11px] text-slate-500 font-normal truncate hidden sm:inline" title={selectedOption.description}>
                      {selectedOption.description}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1.5 ml-2 shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </span>
      </button>

      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {helpText && !error && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Type to search..."
              className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
              onKeyDown={e => {
                if (e.key === 'Escape') setIsOpen(false);
                if (e.key === 'Enter' && filteredOptions.length > 0) {
                  e.preventDefault();
                  handleSelect(filteredOptions[0].value);
                }
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-center text-slate-500 italic">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-left transition-colors cursor-pointer
                      ${isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-800 hover:bg-slate-100'}`}
                  >
                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 text-xs truncate" title={opt.label}>
                        {opt.label}
                      </div>
                      {(opt.badge || opt.description) && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-normal">
                          {opt.badge && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {opt.badge}
                            </span>
                          )}
                          {opt.description && (
                            <span className="truncate text-slate-500 font-medium" title={opt.description}>
                              {opt.description}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
