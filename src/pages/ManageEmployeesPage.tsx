import React, { useState, useMemo, useEffect } from 'react';
import { ReferenceData } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import {
  Users,
  ShieldCheck,
  Wrench,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Phone,
  Building2,
  CheckCircle2,
  Briefcase
} from 'lucide-react';

interface ManageEmployeesPageProps {
  referenceData: ReferenceData;
  onRefreshReferenceData: () => Promise<void>;
}

export const ManageEmployeesPage: React.FC<ManageEmployeesPageProps> = ({
  referenceData,
  onRefreshReferenceData
}) => {
  const { showToast } = useToast();

  // Active Tab: 'managers' | 'technicians'
  const [activeTab, setActiveTab] = useState<'managers' | 'technicians'>('managers');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Job Counts for Technicians
  const [techAssignmentCounts, setTechAssignmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load technician assignment counts for extra operational context
    const loadAssignments = async () => {
      try {
        const assignments = await api.getTechnicianAssignments();
        const counts: Record<string, number> = {};
        assignments.forEach(a => {
          const name = a.technicianName.trim().toLowerCase();
          counts[name] = (counts[name] || 0) + 1;
        });
        setTechAssignmentCounts(counts);
      } catch {
        // Non-critical, ignore
      }
    };
    loadAssignments();
  }, []);

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addType, setAddType] = useState<'manager' | 'technician'>('manager');
  const [formName, setFormName] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAddModal = (type: 'manager' | 'technician') => {
    setAddType(type);
    setFormName('');
    setFormBranch(referenceData.branches[0] || 'Head Office');
    setFormRole(type === 'manager' ? 'Branch Manager' : '');
    setFormContact('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshReferenceData();
      showToast('Employee registry synchronized from Excel workbook!', 'success');
    } catch {
      showToast('Failed to refresh data from Excel', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Full Name is required');
      return;
    }
    if (!formBranch.trim()) {
      setFormError('Branch is required');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (addType === 'manager') {
        await api.createManager({
          name: formName.trim(),
          branch: formBranch.trim(),
          role: formRole.trim() || 'Branch Manager'
        });
        showToast(`Manager "${formName.trim()}" added to "Managers" sheet in Excel!`, 'success');
      } else {
        await api.createTechnician({
          name: formName.trim(),
          branch: formBranch.trim(),
          contact: formContact.trim()
        });
        showToast(`Technician "${formName.trim()}" added to "Technicians" sheet in Excel!`, 'success');
      }
      setIsAddModalOpen(false);
      await onRefreshReferenceData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save employee to Excel');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Managers
  const filteredManagers = useMemo(() => {
    return referenceData.managers.filter(m => {
      if (selectedBranch !== 'ALL' && m.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          m.name.toLowerCase().includes(q) ||
          m.branch.toLowerCase().includes(q) ||
          (m.role || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [referenceData.managers, selectedBranch, searchQuery]);

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    return referenceData.technicians.filter(t => {
      if (selectedBranch !== 'ALL' && t.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          t.name.toLowerCase().includes(q) ||
          t.branch.toLowerCase().includes(q) ||
          (t.contact || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [referenceData.technicians, selectedBranch, searchQuery]);

  // Unique branches covered
  const branchesCovered = useMemo(() => {
    const set = new Set<string>();
    referenceData.managers.forEach(m => m.branch && set.add(m.branch));
    referenceData.technicians.forEach(t => t.branch && set.add(t.branch));
    return set.size;
  }, [referenceData.managers, referenceData.technicians]);

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Manage Employees
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-mono">
                  {referenceData.managers.length + referenceData.technicians.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative personnel registry mapped directly from the "Managers" and "Technicians" worksheets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Reload from Excel workbook"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal(activeTab === 'managers' ? 'manager' : 'technician')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === 'managers' ? 'Manager' : 'Technician'}
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('managers')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'managers'
              ? 'bg-blue-50/60 border-blue-300 shadow-sm ring-1 ring-blue-300'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Managers
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {referenceData.managers.length}
            </span>
            <span className="text-[10px] text-blue-600 font-semibold uppercase">
              Sheet: Managers
            </span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('technicians')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'technicians'
              ? 'bg-emerald-50/60 border-emerald-300 shadow-sm ring-1 ring-emerald-300'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Technicians
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {referenceData.technicians.length}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold uppercase">
              Sheet: Technicians
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Branches Covered
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{branchesCovered}</span>
            <span className="text-[10px] text-slate-500">of {referenceData.branches.length} Registered</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Head Office Leadership
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {referenceData.managers.filter(m => m.branch.toLowerCase() === 'head office').length}
            </span>
            <span className="text-[10px] text-slate-500">Central Officers</span>
          </div>
        </div>
      </div>

      {/* Main Tabbed Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('managers')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                activeTab === 'managers'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Managers Table</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'managers' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {filteredManagers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                activeTab === 'technicians'
                  ? 'border-emerald-600 text-emerald-600 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Technicians Table</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'technicians' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {filteredTechnicians.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500 pb-2 hidden sm:block">
            Authoritative source: <span className="font-semibold text-slate-700">Markspen_Engineering_Central_Monitor.xlsx</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'managers'
                    ? 'Search manager name, branch, or designation...'
                    : 'Search technician name, branch, or contact...'
                }
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">All Branches ({referenceData.branches.length})</option>
                {referenceData.branches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-slate-500 text-[11px] font-mono">
            Showing{' '}
            <strong className="text-slate-800">
              {activeTab === 'managers' ? filteredManagers.length : filteredTechnicians.length}
            </strong>{' '}
            records
          </div>
        </div>

        {/* Active Tab View: 1. Managers Table */}
        {activeTab === 'managers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Manager Name</th>
                  <th className="px-4 py-3">Assigned Branch</th>
                  <th className="px-4 py-3">Role / Designation</th>
                  <th className="px-4 py-3">Operational Scope</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredManagers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No managers found matching criteria.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Try resetting the branch filter or search term.</p>
                    </td>
                  </tr>
                ) : (
                  filteredManagers.map((m, idx) => {
                    const isHeadOffice = m.branch.toLowerCase() === 'head office';
                    const initials = m.name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={`${m.name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-blue-200">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Registered Manager
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                              isHeadOffice
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            {m.branch}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {m.role || 'Branch Manager'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {isHeadOffice ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" /> Islandwide / Central Authority
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">
                              Regional Branch Lead ({m.branch})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Active Tab View: 2. Technicians Table */}
        {activeTab === 'technicians' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Technician Name</th>
                  <th className="px-4 py-3">Assigned Branch</th>
                  <th className="px-4 py-3">Contact Number</th>
                  <th className="px-4 py-3 text-center">Active Job Assignments</th>
                  <th className="px-4 py-3 text-center">Field Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTechnicians.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No technicians found matching criteria.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Try resetting the branch filter or search term.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTechnicians.map((t, idx) => {
                    const initials = t.name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const assignments = techAssignmentCounts[t.name.trim().toLowerCase()] || 0;

                    return (
                      <tr key={`${t.name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-emerald-200">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">
                                {t.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Engineering Field Technician
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            {t.branch}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.contact ? (
                            <a
                              href={`tel:${t.contact.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono font-semibold"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {t.contact}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Not recorded</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                              assignments > 0
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {assignments} {assignments === 1 ? 'Job' : 'Jobs'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Available / Active
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title={addType === 'manager' ? 'Add New Manager' : 'Add New Technician'}
          subtitle={`Appends directly to the "${addType === 'manager' ? 'Managers' : 'Technicians'}" worksheet in the Excel workbook`}
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveEmployee}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Writing to Excel...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save to {addType === 'manager' ? 'Managers' : 'Technicians'} Sheet
                  </>
                )}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveEmployee} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={addType === 'manager' ? 'e.g. Rohitha Wickramasinghe' : 'e.g. Kasun Fernando'}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Assigned Branch <span className="text-rose-500">*</span>
              </label>
              <select
                value={formBranch}
                onChange={e => setFormBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                {referenceData.branches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {addType === 'manager' ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Role / Designation
                </label>
                <input
                  type="text"
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  placeholder="e.g. Branch Manager, Service Coordinator..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={formContact}
                  onChange={e => setFormContact(e.target.value)}
                  placeholder="e.g. +94 77 123 4567"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};
