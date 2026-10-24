import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { TechnicianAssignment, JobRecord, ReferenceData } from '../types';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  UserCheck,
  Search,
  PlusCircle,
  Edit2,
  RefreshCw,
  Briefcase,
  Users
} from 'lucide-react';
import { isJobActive, isTechnicianEligibleForBranch } from '../utils/calculations';

interface TechniciansAssignedPageProps {
  referenceData: ReferenceData;
}

export const TechniciansAssignedPage: React.FC<TechniciansAssignedPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState<TechnicianAssignment[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedLead, setSelectedLead] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState<TechnicianAssignment | null>(null);

  // Form Fields
  const [formJobNo, setFormJobNo] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formTechnicianName, setFormTechnicianName] = useState('');
  const [formLeadTechnician, setFormLeadTechnician] = useState<'Yes' | 'No'>('No');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [assignedList, jobsList] = await Promise.all([
        api.getTechnicianAssignments(),
        api.getJobs()
      ]);
      setAssignments(assignedList);
      setJobs(jobsList);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter active jobs for dropdown (exclude Completed, Invalid, Cancelled)
  const activeJobs = useMemo(() => {
    return jobs.filter(j => isJobActive(j.status)).map(j => ({
      value: j.jobNo,
      label: `${j.jobNo} — ${j.customerName}`,
      badge: j.branch,
      description: `${j.machineModel || 'Equipment'} • Status: ${j.status}`
    }));
  }, [jobs]);

  // When job changes in form, auto-populate branch and reset invalid tech
  const handleJobSelect = (jobNo: string) => {
    setFormJobNo(jobNo);
    const selected = jobs.find(j => j.jobNo === jobNo);
    if (selected) {
      setFormBranch(selected.branch);
    } else {
      setFormBranch('');
      setFormTechnicianName('');
    }
  };

  // Show all technicians listed under "Technicians" sheet irrespective of the branch selected
  const allTechnicianOptions = useMemo(() => {
    return referenceData.technicians.map(t => ({
      value: t.name,
      label: t.name,
      badge: t.branch,
      description: t.contact || 'Technician'
    }));
  }, [referenceData.technicians]);

  const handleOpenCreate = () => {
    setAssignmentToEdit(null);
    setFormJobNo('');
    setFormBranch('');
    setFormTechnicianName('');
    setFormLeadTechnician('No');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: TechnicianAssignment) => {
    setAssignmentToEdit(item);
    setFormJobNo(item.jobNo);
    setFormBranch(item.branch);
    setFormTechnicianName(item.technicianName);
    setFormLeadTechnician(item.leadTechnician === 'Yes' ? 'Yes' : 'No');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formJobNo) errors.jobNo = 'Job No is required';
    if (!formTechnicianName) errors.technicianName = 'Technician is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (assignmentToEdit) {
        await api.updateTechnicianAssignment(assignmentToEdit.id, {
          technicianName: formTechnicianName,
          leadTechnician: formLeadTechnician
        });
        showToast('Technician assignment updated and saved to Excel!', 'success');
      } else {
        await api.createTechnicianAssignment({
          jobNo: formJobNo,
          technicianName: formTechnicianName,
          leadTechnician: formLeadTechnician
        });
        showToast('Technician successfully assigned and appended to Excel!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save assignment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (selectedBranch !== 'ALL' && a.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (selectedLead !== 'ALL' && a.leadTechnician.toLowerCase() !== selectedLead.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          a.jobNo.toLowerCase().includes(q) ||
          a.technicianName.toLowerCase().includes(q) ||
          a.branch.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assignments, selectedBranch, selectedLead, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Technicians Assigned
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 font-mono">
              Worksheet: Technicians Assigned ({assignments.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assign branch-qualified field technicians and lead engineers to active jobs.
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Assign Technician</span>
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
            placeholder="Search by Job No, Technician, Branch..."
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
            value={selectedLead}
            onChange={e => {
              setSelectedLead(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
          >
            <option value="ALL">All Lead Statuses</option>
            <option value="Yes">Lead Technician Only</option>
            <option value="No">Non-Lead Technician</option>
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
                <th className="px-4 py-3">Technician Name</th>
                <th className="px-4 py-3">Lead Technician</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Technicians Assigned worksheet...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No technician assignments found.
                  </td>
                </tr>
              ) : (
                paginatedList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{item.jobNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.branch}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.technicianName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        item.leadTechnician === 'Yes'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.leadTechnician === 'Yes' ? '★ Lead Tech' : 'Support Tech'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Assignment"
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
          totalItems={filteredAssignments.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Assignment Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={assignmentToEdit ? `Edit Assignment — ${assignmentToEdit.jobNo}` : 'Assign Technician to Job'}
          subtitle="Updates are committed directly to Technicians Assigned worksheet in Excel"
          maxWidth="md"
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
                onClick={handleSubmit}
                className={`px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-2
                  ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {assignmentToEdit ? 'Save Changes' : 'Assign Technician'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <SearchableSelect
              label="Job No"
              required
              disabled={Boolean(assignmentToEdit)}
              value={formJobNo}
              onChange={handleJobSelect}
              options={activeJobs}
              placeholder="Search active jobs..."
              error={formErrors.jobNo}
              helpText="Shows active jobs only (excluding Completed/Cancelled/Invalid)"
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

            <SearchableSelect
              label="Technician Name"
              required
              disabled={!formJobNo}
              value={formTechnicianName}
              onChange={setFormTechnicianName}
              options={allTechnicianOptions}
              placeholder={formJobNo ? "Select technician..." : "Select a job first"}
              error={formErrors.technicianName}
              helpText="All technicians from Technicians sheet (irrespective of branch)"
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Lead Technician
              </label>
              <select
                value={formLeadTechnician}
                onChange={e => setFormLeadTechnician(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="No">No (Support Technician)</option>
                <option value="Yes">Yes (Lead Technician)</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
