import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { WorkbookHealth, ReferenceData } from '../types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Shield,
  Lock,
  FileCheck,
  Palette,
  FolderOpen,
  Edit3,
  Save,
  X,
  FileText,
  Trash2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SettingsPageProps {
  referenceData: ReferenceData;
  onRefreshReferenceData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  referenceData,
  onRefreshReferenceData
}) => {
  const { showToast } = useToast();
  const { theme, openAppearanceModal } = useTheme();
  const [health, setHealth] = useState<WorkbookHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingRef, setIsRefreshingRef] = useState(false);

  // Path Configuration State
  const [isEditingPaths, setIsEditingPaths] = useState(false);
  const [formWorkbookPath, setFormWorkbookPath] = useState('');
  const [formBackupPath, setFormBackupPath] = useState('');
  const [isSavingPaths, setIsSavingPaths] = useState(false);

  // Clear Operational Data State
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const [healthData, settingsData] = await Promise.all([
        api.getWorkbookStatus(),
        api.getSettings().catch(() => null)
      ]);
      setHealth(healthData);
      if (settingsData) {
        setFormWorkbookPath(settingsData.workbookPath || 'data/Markspen_Engineering_Central_Monitor.xlsx');
        setFormBackupPath(settingsData.backupPath || 'data/Markspen_Engineering_Central_Monitor.backup.xlsx');
      } else if (healthData) {
        setFormWorkbookPath(healthData.filePath);
        setFormBackupPath(healthData.backupPath);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to check workbook health', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleRefreshRef = async () => {
    setIsRefreshingRef(true);
    try {
      await api.refreshReferenceData();
      onRefreshReferenceData();
      fetchHealth();
      showToast('Reference Data reloaded dynamically from Excel!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reload reference data', 'error');
    } finally {
      setIsRefreshingRef(false);
    }
  };

  const handleSavePaths = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkbookPath.trim()) {
      showToast('Primary workbook file path is required', 'error');
      return;
    }
    if (!formBackupPath.trim()) {
      showToast('Backup workbook file path is required', 'error');
      return;
    }

    setIsSavingPaths(true);
    try {
      await api.updateSettings({
        workbookPath: formWorkbookPath.trim(),
        backupPath: formBackupPath.trim()
      });
      await fetchHealth();
      onRefreshReferenceData();
      showToast('Workbook file location paths updated in settings.json successfully!', 'success');
      setIsEditingPaths(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update workbook file location', 'error');
    } finally {
      setIsSavingPaths(false);
    }
  };

  const handleClearAllOperationalData = async () => {
    setIsClearingAll(true);
    try {
      await api.clearAllOperationalData();
      showToast('All operational records cleared from Excel worksheets!', 'success');
      setShowClearAllConfirm(false);
      await fetchHealth();
      onRefreshReferenceData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to clear operational data', 'error');
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Workbook Status & File Locations
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-mono">
              data/ Storage Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure primary Excel data files, monitor backup paths, verify 14 live worksheets, and audit reference data locks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAppearanceModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-fuchsia-600" />
            <span>Appearance: <strong className="capitalize text-slate-900">{theme}</strong></span>
          </button>
          <button
            type="button"
            onClick={fetchHealth}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Check Connection</span>
          </button>
          <button
            type="button"
            onClick={handleRefreshRef}
            disabled={isRefreshingRef}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRef ? 'animate-spin' : ''}`} />
            <span>Reload Reference Sheets</span>
          </button>
        </div>
      </div>

      {/* Main Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Connection State */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" /> Primary Data Store
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                health?.exists ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-base font-bold text-slate-900 capitalize">
              {health?.exists ? 'Connected' : 'Missing / Offline'}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate font-mono" title={health?.filePath}>
            {health?.filePath || 'Loading...'}
          </p>
        </div>

        {/* Card 2: Backup Protection */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" /> Backup Location
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                health?.backupExists ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-base font-bold text-slate-900">
              {health?.backupExists ? 'Backup Synchronized' : 'Pending Initial Sync'}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate font-mono" title={health?.backupPath}>
            {health?.backupPath || 'Loading...'}
          </p>
        </div>

        {/* Card 3: Storage Metrics & Action */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" /> File Size & Control
            </span>
            <div className="text-base font-bold font-mono text-slate-900">
              {health?.fileSizeBytes ? `${(health.fileSizeBytes / 1024).toFixed(1)} KB` : '0 KB'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingPaths(!isEditingPaths)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer mt-1"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>{isEditingPaths ? 'Hide Path Configuration' : 'Change File Locations'}</span>
          </button>
        </div>
      </div>

      {/* Path Configuration Form (Toggleable or persistent) */}
      {isEditingPaths && (
        <form onSubmit={handleSavePaths} className="p-5 bg-white rounded-xl border border-blue-200 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configure Storage File Paths</h3>
                <p className="text-xs text-slate-500">
                  Set custom relative paths (e.g. <code>data/my_file.xlsx</code>) or absolute system paths. Settings are saved to <strong>settings.json</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingPaths(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Primary Workbook Path <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formWorkbookPath}
                onChange={e => setFormWorkbookPath(e.target.value)}
                placeholder="e.g. data/Markspen_Engineering_Central_Monitor.xlsx"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Resolved location: <span className="font-mono text-slate-700">{health?.filePath}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Backup File Path <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formBackupPath}
                onChange={e => setFormBackupPath(e.target.value)}
                placeholder="e.g. data/Markspen_Engineering_Central_Monitor.backup.xlsx"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Resolved location: <span className="font-mono text-slate-700">{health?.backupPath}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditingPaths(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingPaths}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingPaths ? 'Saving Paths...' : 'Save & Reconnect Paths'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Synchronized Worksheet Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Worksheet Record Counts (All 14 Sheets)
            </h3>
            <p className="text-xs text-slate-500">Live row counts verified via ExcelJS</p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Last Read: {health?.lastRead ? new Date(health.lastRead).toLocaleTimeString() : 'N/A'}
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Operational Sheets */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 border-b border-blue-100 pb-1 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-600" /> Operational Worksheets (Managed by App)
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {[
                'Jobs',
                'Technicians Assigned',
                'Technician Visits',
                'Spare Parts Used',
                'Expenses',
                'Job Closing'
              ].map(sheet => (
                <div key={sheet} className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{sheet}</span>
                  <span className="font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                    {health?.sheetCounts?.[sheet] ?? 0} records
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Wipe All Operational Records</span>
              </button>
            </div>
          </div>

          {/* Reference Data Sheets (Read-Only) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-500" /> Reference Data Sheets (Read-Only Authority)
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {[
                { name: 'Branches', count: referenceData.branches.length },
                { name: 'Job Types', count: referenceData.jobTypes.length },
                { name: 'Expense Categories', count: referenceData.expenseCategories.length },
                { name: 'Status', count: referenceData.statuses.length },
                { name: 'Technicians', count: referenceData.technicians.length },
                { name: 'Managers', count: referenceData.managers.length },
                { name: 'Vehicle Types', count: referenceData.vehicleTypes.length },
                { name: 'Vehicles', count: referenceData.vehicles.length },
                { name: 'Spare Parts', count: referenceData.spareParts.length }
              ].map(item => (
                <div key={item.name} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700 font-mono">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Read-only</span>
                  </div>
                  <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {item.count} items
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Concurrency and Usage Notice */}
      <div className="p-5 bg-amber-50 rounded-xl border border-amber-200 space-y-2 text-xs text-amber-900">
        <h4 className="font-bold flex items-center gap-2 text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> Storage & File Location Notice
        </h4>
        <p>
          The authoritative Excel workbook is stored in <code className="font-mono text-amber-950 bg-amber-100 px-1 rounded">/data/</code> by default, or at any configured file path. You can customize the workbook and backup paths using the <strong>Change File Locations</strong> configuration panel above.
        </p>
        <p className="text-[11px] text-amber-800">
          Session backups and atomic write locks are continuously enforced to prevent corruption even if custom paths are configured.
        </p>
      </div>

      {/* Confirmation Dialog for Clearing Operational Data */}
      <ConfirmDialog
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={handleClearAllOperationalData}
        title="Confirm Wipe All Operational Records"
        message="Are you sure you want to permanently clear all rows from Jobs, Technicians Assigned, Visits, Spare Parts Used, Expenses, and Job Closing worksheets? Reference data sheets (Branches, Managers, Technicians, etc.) will remain intact."
        confirmText="Wipe All Operational Data"
        isLoading={isClearingAll}
      />
    </div>
  );
};
