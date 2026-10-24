import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { JobRecord, ReferenceData } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { JobFormModal } from '../components/jobs/JobFormModal';
import { JobDetailModal } from '../components/jobs/JobDetailModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';
import {
  Briefcase,
  Search,
  Filter,
  PlusCircle,
  Eye,
  Edit2,
  Calendar,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
  Trash2
} from 'lucide-react';

interface JobsPageProps {
  referenceData: ReferenceData;
  initialJobNoToView?: string | null;
  onClearInitialJobNo?: () => void;
  openNewModalDirectly?: boolean;
  onCloseNewModalDirectly?: () => void;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  referenceData,
  initialJobNoToView,
  onClearInitialJobNo,
  openNewModalDirectly,
  onCloseNewModalDirectly
}) => {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Clear confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedJobType, setSelectedJobType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Sorting
  const [sortBy, setSortBy] = useState<'jobNo' | 'dateCreated' | 'expectedCompletion' | 'daysOpen' | 'overdueDays'>('dateCreated');
  const [sortAsc, setSortAsc] = useState(false);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<JobRecord | null>(null);
  const [selectedJobNoForDetails, setSelectedJobNoForDetails] = useState<string | null>(null);

  // Handle external modal open triggers
  useEffect(() => {
    if (openNewModalDirectly) {
      setJobToEdit(null);
      setIsFormModalOpen(true);
      if (onCloseNewModalDirectly) onCloseNewModalDirectly();
    }
  }, [openNewModalDirectly, onCloseNewModalDirectly]);

  useEffect(() => {
    if (initialJobNoToView) {
      setSelectedJobNoForDetails(initialJobNoToView);
      if (onClearInitialJobNo) onClearInitialJobNo();
    }
  }, [initialJobNoToView, onClearInitialJobNo]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllJobs = async () => {
    setIsClearing(true);
    try {
      const res = await api.clearAllJobs();
      showToast(`Cleared ${res.count} job records from Excel!`, 'success');
      setShowClearConfirm(false);
      await fetchJobs();
    } catch (err: any) {
      showToast(err?.message || 'Failed to clear jobs worksheet', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Filtered & Sorted Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (activeOnly && (job.status.toLowerCase() === 'completed' || job.status.toLowerCase() === 'closed' || job.status.toLowerCase() === 'cancelled' || job.status.toLowerCase() === 'invalid')) {
        return false;
      }
      if (selectedBranch !== 'ALL' && job.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (selectedJobType !== 'ALL' && job.jobType.toLowerCase() !== selectedJobType.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'ALL' && job.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      if (selectedPriority !== 'ALL' && job.priority.toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          job.jobNo.toLowerCase().includes(q) ||
          job.customerName.toLowerCase().includes(q) ||
          job.machineModel.toLowerCase().includes(q) ||
          job.contactNumber.toLowerCase().includes(q) ||
          job.complaint.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [jobs, searchQuery, selectedBranch, selectedStatus, selectedPriority, activeOnly, sortBy, sortAsc]);

  // Paginated Slice
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const handleOpenCreate = () => {
    setSelectedJobNoForDetails(null);
    setJobToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (job: JobRecord) => {
    setSelectedJobNoForDetails(null);
    setJobToEdit(job);
    setIsFormModalOpen(true);
  };

  const handleJobSaved = (savedJob: JobRecord) => {
    fetchJobs();
    setSelectedJobNoForDetails(savedJob.jobNo);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Engineering Jobs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-mono">
              Worksheet: Jobs ({jobs.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative operational record of machinery service jobs, installation & maintenance tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchJobs}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Refresh jobs from Excel"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {jobs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Clear all job records from Excel worksheet"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Clear All Jobs</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Job</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Job No, Customer, Machine, Phone..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Job Type Filter */}
          <div>
            <select
              value={selectedJobType}
              onChange={e => {
                setSelectedJobType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Job Types</option>
              {referenceData.jobTypes.map(jt => (
                <option key={jt} value={jt}>{jt}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranch}
              onChange={e => {
                setSelectedBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
            >
              <option value="ALL">All Branches</option>
              {referenceData.branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              {referenceData.statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={e => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => {
                setActiveOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Show Active Jobs Only (Exclude Completed/Cancelled/Invalid)</span>
          </label>

          <div className="text-slate-500 font-mono text-[11px]">
            Filtered: {filteredJobs.length} of {jobs.length} jobs
          </div>
        </div>
      </div>

      {/* Jobs Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('jobNo')}
                >
                  Job No {sortBy === 'jobNo' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('dateCreated')}
                >
                  Date Created {sortBy === 'dateCreated' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Customer & Machine</th>
                <th className="px-4 py-3">Priority</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('expectedCompletion')}
                >
                  Expected {sortBy === 'expectedCompletion' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('daysOpen')}
                >
                  Days Open {sortBy === 'daysOpen' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('overdueDays')}
                >
                  Overdue {sortBy === 'overdueDays' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Jobs worksheet...
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No jobs matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedJobs.map(job => (
                  <tr
                    key={job.jobNo}
                    className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedJobNoForDetails(job.jobNo)}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {job.jobNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {job.dateCreated}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{job.branch}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{job.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {job.machineModel || 'N/A'} {job.serialNumber ? `• SN: ${job.serialNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.priority} type="priority" />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {job.expectedCompletion || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {job.daysOpen} d
                    </td>
                    <td className="px-4 py-3">
                      {job.overdueDays > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          {job.overdueDays} d
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0 d</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} type="status" />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedJobNoForDetails(job.jobNo)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          title="View Full Details (Visits, Parts, Expenses, Closure)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(job);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          title="Edit Job Information"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredJobs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create / Edit Modal */}
      {isFormModalOpen && (
        <JobFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSaved={handleJobSaved}
          jobToEdit={jobToEdit}
          referenceData={referenceData}
        />
      )}

      {/* Comprehensive Details Modal */}
      {selectedJobNoForDetails && (
        <JobDetailModal
          jobNo={selectedJobNoForDetails}
          isOpen={Boolean(selectedJobNoForDetails)}
          onClose={() => setSelectedJobNoForDetails(null)}
          onEditJob={() => {
            const j = jobs.find(item => item.jobNo === selectedJobNoForDetails);
            if (j) handleOpenEdit(j);
          }}
        />
      )}

      {/* Confirmation Dialog for Clearing All Jobs */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllJobs}
        title="Confirm Clear All Jobs"
        message={`Are you sure you want to permanently clear all ${jobs.length} job records from the Excel worksheet? This action will wipe all job rows from the Excel database.`}
        confirmText="Clear All Jobs"
        isLoading={isClearing}
      />
    </div>
  );
};
