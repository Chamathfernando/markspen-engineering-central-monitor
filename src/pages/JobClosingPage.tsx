import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { JobClosingRecord, JobRecord, ReferenceData } from '../types';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  CheckCircle,
  Search,
  PlusCircle,
  Edit2,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Info
} from 'lucide-react';
import { isJobActive, formatDate } from '../utils/calculations';

interface JobClosingPageProps {
  referenceData: ReferenceData;
}

export const JobClosingPage: React.FC<JobClosingPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();
  const [closures, setClosures] = useState<JobClosingRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closureToEdit, setClosureToEdit] = useState<JobClosingRecord | null>(null);


  const [formJobNo, setFormJobNo] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formCompletionDate, setFormCompletionDate] = useState('');
  const [formWorkCarriedOut, setFormWorkCarriedOut] = useState('');
  const [formWorkHours, setFormWorkHours] = useState<number | string>(0);
  const [formCustomerAcknowledged, setFormCustomerAcknowledged] = useState<'Yes' | 'No'>('Yes');
  const [formWarrantyPartsReturned, setFormWarrantyPartsReturned] = useState<'Yes' | 'No'>('No');
  const [formFollowUpNeeded, setFormFollowUpNeeded] = useState<'Yes' | 'No'>('No');
  const [formFollowUpDetails, setFormFollowUpDetails] = useState('');
  const [formFollowUpDue, setFormFollowUpDue] = useState('');
  const [formApprovedBy, setFormApprovedBy] = useState('');
  const [formUpdatedBy, setFormUpdatedBy] = useState('');
  const [formStatus, setFormStatus] = useState('Completed');
  const [formRemarks, setFormRemarks] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [closuresList, jobsList] = await Promise.all([
        api.getJobClosures(),
        api.getJobs()
      ]);
      setClosures(closuresList);
      setJobs(jobsList);
    } catch (err) {
      console.error('Failed to load closures:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter active jobs eligible for closure:
  // Must be active (not Closed, Invalid, Cancelled) and not already closed in closures!
  const eligibleJobsForClosure = useMemo(() => {
    const closedJobNos = new Set(closures.map(c => c.jobNo.toLowerCase()));
    return jobs
      .filter(j => isJobActive(j.status) && !closedJobNos.has(j.jobNo.toLowerCase()))
      .map(j => ({
        value: j.jobNo,
        label: `${j.jobNo} — ${j.customerName}`,
        badge: j.branch,
        description: `${j.machineModel || 'Equipment'} • Current Status: ${j.status}`
      }));
  }, [jobs, closures]);

  // When job is selected, auto-fill branch and compute total logged visit hours
  const handleJobSelect = async (jobNo: string) => {
    setFormJobNo(jobNo);
    const selected = jobs.find(j => j.jobNo === jobNo);
    if (selected) {
      setFormBranch(selected.branch);
      try {
        const visits = await api.getTechnicianVisits({ jobNo });
        const totalHrs = visits.reduce((sum, v) => sum + (v.hours || 0), 0);
        setFormWorkHours(Math.round(totalHrs * 100) / 100);
      } catch {
        setFormWorkHours(0);
      }
    } else {
      setFormBranch('');
      setFormWorkHours(0);
    }
  };

  const managerOptions = useMemo(() => {
    return referenceData.managers.map(m => ({
      value: m.name,
      label: m.name,
      badge: m.branch,
      description: m.role || `${m.branch} Manager`
    }));
  }, [referenceData.managers]);

  // Filter status choices for Job Closing based on business logic rules:
  // 1. "Pending Customer" status appears ONLY IF "Follow-Up Needed?" is "Yes"
  // 2. "Completed" status appears ONLY IF "Customer Acknowledged" is "Yes" AND "Follow-Up Needed?" is "No"
  const closureStatusOptions = useMemo(() => {
    return referenceData.statuses.filter(status => {
      const s = status.trim().toLowerCase();

      // Rule 1: Pending Customer status only if Follow-Up Needed is "Yes"
      if (s === 'pending customer') {
        return formFollowUpNeeded === 'Yes';
      }

      // Rule 2: Completed status only if Customer Acknowledged is "Yes" AND Follow-Up Needed is "No"
      if (s === 'completed') {
        return formCustomerAcknowledged === 'Yes' && formFollowUpNeeded === 'No';
      }

      return true;
    });
  }, [referenceData.statuses, formCustomerAcknowledged, formFollowUpNeeded]);

  // Automatically adjust formStatus if current selection becomes invalid due to option toggles
  useEffect(() => {
    if (!isModalOpen) return;
    const isCurrentValid = closureStatusOptions.some(
      s => s.trim().toLowerCase() === formStatus.trim().toLowerCase()
    );

    if (!isCurrentValid) {
      if (formCustomerAcknowledged === 'Yes' && formFollowUpNeeded === 'No') {
        setFormStatus('Completed');
      } else if (formFollowUpNeeded === 'Yes') {
        setFormStatus('Pending Customer');
      } else if (closureStatusOptions.length > 0) {
        setFormStatus(closureStatusOptions[0]);
      }
    }
  }, [formCustomerAcknowledged, formFollowUpNeeded, closureStatusOptions, isModalOpen]);

  const handleOpenCreate = () => {
    setClosureToEdit(null);
    const todayStr = formatDate(new Date());
    setFormJobNo('');
    setFormBranch('');
    setFormCompletionDate(todayStr);
    setFormWorkCarriedOut('');
    setFormWorkHours(0);
    setFormCustomerAcknowledged('Yes');
    setFormWarrantyPartsReturned('No');
    setFormFollowUpNeeded('No');
    setFormFollowUpDetails('');
    setFormFollowUpDue('');
    setFormApprovedBy('');
    setFormUpdatedBy('');
    setFormStatus('Completed');
    setFormRemarks('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: JobClosingRecord) => {
    setClosureToEdit(c);
    setFormJobNo(c.jobNo);
    setFormBranch(c.branch);
    setFormCompletionDate(c.completionDate);
    setFormWorkCarriedOut(c.workCarriedOut);
    setFormWorkHours(c.workHours);
    setFormCustomerAcknowledged(c.customerAcknowledged);
    setFormWarrantyPartsReturned(c.warrantyPartsReturned);
    setFormFollowUpNeeded(c.followUpNeeded);
    setFormFollowUpDetails(c.followUpDetails);
    setFormFollowUpDue(c.followUpDue);
    setFormApprovedBy(c.approvedBy);
    setFormUpdatedBy(c.updatedBy);
    setFormStatus(c.status);
    setFormRemarks(c.remarks || '');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formJobNo) errors.jobNo = 'Job No is required';
    if (!formCompletionDate) errors.completionDate = 'Completion Date is required';
    if (!formWorkCarriedOut.trim()) errors.workCarriedOut = 'Work Carried Out description is required';

    if (!formApprovedBy || !formApprovedBy.trim()) {
      errors.approvedBy = 'Approved By is required';
    }

    if (!formUpdatedBy || !formUpdatedBy.trim()) {
      errors.updatedBy = 'Updated By is required';
    }

    if (!formRemarks.trim()) {
      errors.remarks = 'Remarks is mandatory to track on-hold reason, pending customer reason, or handover notes';
    }

    if (!formFollowUpNeeded) {
      errors.followUpNeeded = 'Follow-Up Needed? is a mandatory field';
    }

    if (formFollowUpNeeded === 'Yes') {
      if (!formFollowUpDue) errors.followUpDue = 'Follow-up due date is required when follow-up is needed';
    }

    const sLower = formStatus.trim().toLowerCase();
    if (sLower === 'pending customer' && formFollowUpNeeded !== 'Yes') {
      errors.status = '"Pending Customer" status requires Follow-Up Needed? = "Yes"';
    }
    if (sLower === 'completed') {
      if (formCustomerAcknowledged !== 'Yes' || formFollowUpNeeded !== 'No') {
        errors.status = '"Completed" status requires Customer Acknowledged = "Yes" and Follow-Up Needed? = "No"';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    executeSave();
  };

  const executeSave = async () => {
    setIsSubmitting(true);
    try {
      const payload: Partial<JobClosingRecord> = {
        jobNo: formJobNo,
        completionDate: formCompletionDate,
        workCarriedOut: formWorkCarriedOut.trim(),
        workHours: Number(formWorkHours) || 0,
        customerAcknowledged: formCustomerAcknowledged,
        warrantyPartsReturned: formWarrantyPartsReturned,
        followUpNeeded: formFollowUpNeeded,
        followUpDetails: formFollowUpNeeded === 'Yes' ? (closureToEdit?.followUpDetails || formFollowUpDetails || '') : '',
        followUpDue: formFollowUpNeeded === 'Yes' ? formFollowUpDue : '',
        approvedBy: formApprovedBy,
        updatedBy: formUpdatedBy,
        status: formStatus,
        remarks: formRemarks.trim()
      };

      if (closureToEdit) {
        await api.updateJobClosure(closureToEdit.jobNo, payload);
        showToast(`Job ${closureToEdit.jobNo} status updated to "${formStatus}" and synchronized to Jobs sheet!`, 'success');
      } else {
        await api.createJobClosure(payload);
        showToast(`Job ${formJobNo} updated to status "${formStatus}" and synchronized to Jobs sheet!`, 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete job closure', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredClosures = useMemo(() => {
    return closures.filter(c => {
      if (selectedBranch !== 'ALL' && c.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'ALL' && c.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          c.jobNo.toLowerCase().includes(q) ||
          c.branch.toLowerCase().includes(q) ||
          c.workCarriedOut.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [closures, selectedBranch, selectedStatus, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClosures.slice(start, start + pageSize);
  }, [filteredClosures, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Job Closing & Sign-off
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 font-mono">
              Worksheet: Job Closing ({closures.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete formal job handovers, total visit hour audits, and automatically synchronize 'Completed' status to the Jobs worksheet in Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Reload from Excel"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Close a Job</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Job No, Branch, Work Done..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="px-4 py-3">Job No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Completion Date</th>
                <th className="px-4 py-3">Work Hours</th>
                <th className="px-4 py-3">Customer Ack</th>
                <th className="px-4 py-3">Warranty Returned</th>
                <th className="px-4 py-3">Follow-Up</th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Job Closing worksheet...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    No completed jobs recorded yet.
                  </td>
                </tr>
              ) : (
                paginatedList.map(c => (
                  <tr key={c.jobNo} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{c.jobNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{c.branch}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{c.completionDate}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{c.workHours} hrs</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.customerAcknowledged === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {c.customerAcknowledged}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.warrantyPartsReturned === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                        {c.warrantyPartsReturned}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.followUpNeeded === 'Yes' ? (
                        <div className="flex flex-col">
                          <span className="text-amber-700 font-bold">Yes (Due: {c.followUpDue})</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-xs">{c.followUpDetails}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{c.approvedBy}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} type="status" />
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={c.remarks}>
                      {c.remarks || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Closure Record"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredClosures.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>



      {/* Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={closureToEdit ? `Edit Closure — ${closureToEdit.jobNo}` : 'Job Sign-off & Closure'}
          subtitle="Commits to Job Closing and atomically updates the Jobs worksheet status"
          maxWidth="3xl"
          footer={
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitAttempt}
                className={`px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-2
                  ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {closureToEdit ? 'Save Changes' : formStatus === 'Completed' ? 'Execute Job Closure' : 'Save Status & Sync to Job'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmitAttempt} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Job No"
                required
                disabled={Boolean(closureToEdit)}
                value={formJobNo}
                onChange={handleJobSelect}
                options={eligibleJobsForClosure}
                placeholder="Select active job to close..."
                error={formErrors.jobNo}
                helpText="Only active jobs without existing closures"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Branch (Auto-Populated)
                </label>
                <input
                  type="text"
                  readOnly
                  value={formBranch || 'Select a job first'}
                  className="w-full px-3 py-2 text-sm bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium cursor-not-allowed"
                />
              </div>

              <DatePickerInput
                label="Completion Date"
                required
                value={formCompletionDate}
                onChange={setFormCompletionDate}
                error={formErrors.completionDate}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Work Carried Out <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={formWorkCarriedOut}
                onChange={e => setFormWorkCarriedOut(e.target.value)}
                placeholder="Comprehensive summary of maintenance, parts replaced, calibration, and client handover sign-off..."
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-500
                  ${formErrors.workCarriedOut ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}`}
              />
              {formErrors.workCarriedOut && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.workCarriedOut}</p>
              )}
            </div>

            {/* Work Hours and Quality Signoffs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Work Hours (Total Recorded)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formWorkHours}
                    onChange={e => setFormWorkHours(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
                <span className="text-[10px] text-slate-400">Summed from technician visits</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Customer Acknowledged
                </label>
                <select
                  value={formCustomerAcknowledged}
                  onChange={e => setFormCustomerAcknowledged(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="Yes">Yes (Client Accepted & Signed)</option>
                  <option value="No">No (Pending Acceptance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Warranty Parts Returned
                </label>
                <select
                  value={formWarrantyPartsReturned}
                  onChange={e => setFormWarrantyPartsReturned(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes (Defective Spares Received)</option>
                </select>
              </div>
            </div>

            {/* Follow-up Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-blue-600" /> Follow-Up Requirements
                </span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-700 font-bold uppercase tracking-wider">
                      Follow-Up Needed? <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formFollowUpNeeded}
                      onChange={e => {
                        const val = e.target.value as 'Yes' | 'No';
                        setFormFollowUpNeeded(val);
                        if (val === 'No') {
                          setFormFollowUpDue('');
                          setFormFollowUpDetails('');
                        }
                      }}
                      className={`px-3 py-1 text-xs bg-white border rounded-md font-bold focus:ring-2 focus:ring-blue-500
                        ${formErrors.followUpNeeded ? 'border-rose-500 ring-1 ring-rose-200' : 'border-slate-300'}`}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  {formErrors.followUpNeeded && (
                    <p className="text-[10px] text-rose-600 font-semibold">{formErrors.followUpNeeded}</p>
                  )}
                </div>
              </div>

              {formFollowUpNeeded === 'Yes' && (
                <div className="pt-2 max-w-xs">
                  <DatePickerInput
                    label="Follow-Up Due Date"
                    required
                    value={formFollowUpDue}
                    onChange={setFormFollowUpDue}
                    minToday
                    error={formErrors.followUpDue}
                  />
                </div>
              )}
            </div>

            {/* Approvals & Synchronized Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Approved By"
                required
                value={formApprovedBy}
                onChange={setFormApprovedBy}
                options={managerOptions}
                placeholder="Select manager..."
                error={formErrors.approvedBy}
              />

              <SearchableSelect
                label="Updated By"
                required
                value={formUpdatedBy}
                onChange={setFormUpdatedBy}
                options={managerOptions}
                placeholder="Select manager..."
                error={formErrors.updatedBy}
              />

              <SearchableSelect
                label="Closure Status"
                required
                value={formStatus}
                onChange={setFormStatus}
                options={closureStatusOptions}
                placeholder="Select status..."
                error={formErrors.status}
              />
            </div>

            {/* Remarks / Operational Handover Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={formRemarks}
                onChange={e => setFormRemarks(e.target.value)}
                placeholder="Mandatory: Record on-hold reason, pending customer reason, or operational handover notes..."
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-500
                  ${formErrors.remarks ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}`}
              />
              {formErrors.remarks ? (
                <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.remarks}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  Mandatory field to record on-hold reason, pending customer reason, or handover notes
                </p>
              )}
            </div>

            {/* Status Rules & Combination Guidelines */}
            <div className="p-3.5 bg-fuchsia-50/70 border border-fuchsia-200/80 rounded-xl space-y-2.5 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-fuchsia-900 uppercase tracking-wider text-[11px]">
                  <Info className="w-4 h-4 text-fuchsia-600 shrink-0" />
                  <span>Closure Status Rules & Eligible Combinations</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">
                  Instructions Guide
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-white rounded-lg border border-fuchsia-100 shadow-2xs space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                    <span>Completed</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Available when <strong>Customer Acknowledged = Yes</strong> AND <strong>Follow-Up Needed = No</strong>.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-fuchsia-100 shadow-2xs space-y-1">
                  <div className="font-bold text-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 inline-block" />
                    <span>Pending Customer</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Available when <strong>Follow-Up Needed = Yes</strong>. Requires mandatory <strong>Follow-Up Due Date</strong>.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-fuchsia-100 shadow-2xs space-y-1">
                  <div className="font-bold text-indigo-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 inline-block" />
                    <span>On Hold / Pending Parts</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Available when <strong>Follow-Up Needed = No</strong>. Requires mandatory reason in <strong>Remarks</strong>.
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-fuchsia-100 shadow-2xs space-y-1">
                  <div className="font-bold text-rose-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 inline-block" />
                    <span>Cancelled / Invalid</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Available when <strong>Follow-Up Needed = No</strong>. Requires mandatory cancellation rationale in <strong>Remarks</strong>.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
