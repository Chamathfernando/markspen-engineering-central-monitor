import React from 'react';
import { Menu, RefreshCw, PlusCircle, Database, FileSpreadsheet } from 'lucide-react';
import { WorkbookHealth } from '../../types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  workbookHealth: WorkbookHealth | null;
  onRefreshData: () => void;
  isRefreshing: boolean;
  onOpenNewJobModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  workbookHealth,
  onRefreshData,
  isRefreshing,
  onOpenNewJobModal
}) => {
  const isConnected = workbookHealth?.status === 'connected';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-600 hidden sm:block" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Markspen Engineering Central Monitor
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Authoritative Excel Workbook Data Store
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Workbook Connection Badge */}
        <div
          title={
            workbookHealth
              ? `Path: ${workbookHealth.filePath}\nLast Save: ${workbookHealth.lastWrite || 'None'}`
              : 'Checking workbook connection...'
          }
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-50 border-slate-200 text-slate-700"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold">{isConnected ? 'Excel Connected' : 'Workbook Error'}</span>
          {workbookHealth?.fileSizeBytes ? (
            <span className="text-[10px] text-slate-400 font-mono">
              ({(workbookHealth.fileSizeBytes / 1024).toFixed(1)} KB)
            </span>
          ) : null}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefreshData}
          disabled={isRefreshing}
          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
          title="Reload workbook data"
          aria-label="Reload workbook data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Quick New Job Action */}
        <button
          type="button"
          onClick={onOpenNewJobModal}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">New Job</span>
        </button>
      </div>
    </header>
  );
};
