import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { TechnicianVisit, JobRecord, ReferenceData } from '../types';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  CalendarDays,
  Search,
  PlusCircle,
  Edit2,
  RefreshCw,
  Clock,
  Truck,
  CheckCircle2
} from 'lucide-react';
import {
  isJobActive,
  isTechnicianEligibleForBranch,
  isManagerEligibleForBranch,
  calculateVisitHours,
  formatDate
} from '../utils/calculations';

interface TechnicianVisitsPageProps {
  referenceData: ReferenceData;
}

export const TechnicianVisitsPage: React.FC<TechnicianVisitsPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();
  const [visits, setVisits] = useState<TechnicianVisit[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedTechnician, setSelectedTechnician] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visitToEdit, setVisitToEdit] = useState<TechnicianVisit | null>(null);

  const [formVisitId, setFormVisitId] = useState('');
  const [formJobNo, setFormJobNo] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formTechnicianName, setFormTechnicianName] = useState('');
  const [formVisitDate, setFormVisitDate] = useState('');
  const [formScheduledArrival, setFormScheduledArrival] = useState('');
  const [formActualTimeIn, setFormActualTimeIn] = useState('');
  const [formActualTimeOut, setFormActualTimeOut] = useState('');
  const [formWorkDone, setFormWorkDone] = useState('');
  const [formOutcome, setFormOutcome] = useState('');
  const [formCoordinator, setFormCoordinator] = useState('');
  const [formVehicleType, setFormVehicleType] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [visitList, jobsList] = await Promise.all([
        api.getTechnicianVisits(),
        api.getJobs()
      ]);
      setVisits(visitList);
      setJobs(jobsList);
    } catch (err) {
      console.error('Failed to load visits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Active jobs for dropdown
  const activeJobs = useMemo(() => {
    return jobs.filter(j => isJobActive(j.status)).map(j => ({
      value: j.jobNo,
      label: `${j.jobNo} — ${j.customerName}`,
      badge: j.branch,
      description: `${j.machineModel || 'Equipment'} • Status: ${j.status}`
    }));
  }, [jobs]);

  // When job changes, auto-fill branch and reset dependent dropdowns
  const handleJobSelect = (jobNo: string) => {
    setFormJobNo(jobNo);
    const selected = jobs.find(j => j.jobNo === jobNo);
    if (selected) {
      setFormBranch(selected.branch);
      // Reset technician if not in branch
      if (formTechnicianName) {
        const tech = referenceData.technicians.find(t => t.name === formTechnicianName);
        if (tech && !isTechnicianEligibleForBranch(tech.branch, selected.branch)) {
          setFormTechnicianName('');
        }
      }
      // Reset vehicle if not in branch
      if (formVehicleNumber) {
        const veh = referenceData.vehicles.find(v => v.number === formVehicleNumber);
        if (veh && veh.branch !== selected.branch && veh.branch !== 'Main') {
          setFormVehicleNumber('');
        }
      }
    } else {
      setFormBranch('');
      setFormTechnicianName('');
      setFormVehicleNumber('');
    }
  };

  // Branch-filtered technicians
  const eligibleTechnicians = useMemo(() => {
    if (!formBranch) return [];
    return referenceData.technicians
      .filter(t => isTechnicianEligibleForBranch(t.branch, formBranch))
      .map(t => ({ value: t.name, label: t.name, badge: t.branch }));
  }, [referenceData.technicians, formBranch]);

  // Branch-filtered coordinators (branch + Main)
  const eligibleCoordinators = useMemo(() => {
    if (!formBranch) return [];
    return referenceData.managers
      .filter(m => isManagerEligibleForBranch(m.branch, formBranch))
      .map(m => ({ value: m.name, label: m.name, badge: m.branch, description: m.role }));
  }, [referenceData.managers, formBranch]);

  // Branch-filtered vehicles
  const eligibleVehicles = useMemo(() => {
    if (!formBranch) return [];
    return referenceData.vehicles
      .filter(v => v.branch.toLowerCase() === formBranch.toLowerCase() || v.branch.toLowerCase() === 'main')
      .map(v => ({
        value: v.number,
        label: `${v.number} (${v.type})`,
        badge: v.branch
      }));
  }, [referenceData.vehicles, formBranch]);

  // Auto-calculated elapsed hours
  const calculatedHours = useMemo(() => {
    return calculateVisitHours(formActualTimeIn, formActualTimeOut);
  }, [formActualTimeIn, formActualTimeOut]);

  const handleOpenCreate = async () => {
    setVisitToEdit(null);
    const todayStr = formatDate(new Date());
    setFormVisitId('VISIT-00001');
    try {
      const nextId = await api.getNextVisitId();
      setFormVisitId(nextId);
    } catch {
      // fallback
    }
    setFormJobNo('');
    setFormBranch('');
    setFormTechnicianName('');
    setFormVisitDate(todayStr);
    setFormScheduledArrival(`${todayStr} 08:30`);
    setFormActualTimeIn('08:30');
    setFormActualTimeOut('17:00');
    setFormWorkDone('');
    setFormOutcome('');
    setFormCoordinator('');
    setFormVehicleType(referenceData.vehicleTypes[0] || 'Double Cab');
    setFormVehicleNumber('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: TechnicianVisit) => {
    setVisitToEdit(v);
    setFormVisitId(v.visitId);
    setFormJobNo(v.jobNo);
    setFormBranch(v.branch);
    setFormTechnicianName(v.technicianName);
    setFormVisitDate(v.visitDate);
    setFormScheduledArrival(v.scheduledArrival);
    setFormActualTimeIn(v.actualTimeIn);
    setFormActualTimeOut(v.actualTimeOut);
    setFormWorkDone(v.workDone);
    setFormOutcome(v.outcome);
    setFormCoordinator(v.coordinator);
    setFormVehicleType(v.vehicleType);
    setFormVehicleNumber(v.vehicleNumber);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formJobNo) errors.jobNo = 'Job No is required';
    if (!formTechnicianName) errors.technicianName = 'Technician is required';
    if (!formVisitDate) errors.visitDate = 'Visit Date is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<TechnicianVisit> = {
        visitId: formVisitId.trim() || 'VISIT-00001',
        jobNo: formJobNo,
        technicianName: formTechnicianName,
        visitDate: formVisitDate,
        scheduledArrival: formScheduledArrival,
        actualTimeIn: formActualTimeIn,
        actualTimeOut: formActualTimeOut,
        workDone: formWorkDone.trim(),
        outcome: formOutcome.trim(),
        coordinator: formCoordinator,
        vehicleType: formVehicleType,
        vehicleNumber: formVehicleNumber
      };

      if (visitToEdit) {
        await api.updateTechnicianVisit(visitToEdit.id, payload);
        showToast('Visit record updated and saved to Excel!', 'success');
      } else {
        await api.createTechnicianVisit(payload);
        showToast('Technician visit recorded and appended to Excel!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save visit', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (selectedBranch !== 'ALL' && v.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (selectedTechnician !== 'ALL' && v.technicianName.toLowerCase() !== selectedTechnician.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          v.visitId.toLowerCase().includes(q) ||
          v.jobNo.toLowerCase().includes(q) ||
          v.technicianName.toLowerCase().includes(q) ||
          v.workDone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visits, selectedBranch, selectedTechnician, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVisits.slice(start, start + pageSize);
  }, [filteredVisits, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Technician Visits
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-mono">
              Worksheet: Technician Visits ({visits.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Log technician field visits, time in/out, automatic overnight hours calculations, vehicle tracking, and work outcomes.
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
            <span>Record Visit</span>
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
            placeholder="Search by Visit ID, Job No, Tech, Work..."
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
            value={selectedTechnician}
            onChange={e => {
              setSelectedTechnician(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
          >
            <option value="ALL">All Technicians</option>
            {referenceData.technicians.map(t => (
              <option key={t.name} value={t.name}>{t.name} ({t.branch})</option>
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
                <th className="px-4 py-3">Visit ID</th>
                <th className="px-4 py-3">Job No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Visit Date</th>
                <th className="px-4 py-3">Time In / Out</th>
                <th className="px-4 py-3">Calculated Hours</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Coordinator</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Technician Visits worksheet...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No technician visits recorded.
                  </td>
                </tr>
              ) : (
                paginatedList.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{v.visitId}</td>
                    <td className="px-4 py-3 font-mono text-slate-900 font-medium">{v.jobNo}</td>
                    <td className="px-4 py-3 text-slate-700">{v.branch}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{v.technicianName}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{v.visitDate}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{v.actualTimeIn} - {v.actualTimeOut}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {v.hours !== null ? `${v.hours} hrs` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{v.vehicleNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.coordinator || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(v)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Visit"
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
          totalItems={filteredVisits.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={visitToEdit ? `Edit Visit — ${visitToEdit.visitId}` : 'Record Technician Visit'}
          subtitle="Committed directly to Technician Visits worksheet with auto-calculated duration"
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
                onClick={handleSubmit}
                className={`px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-2
                  ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {visitToEdit ? 'Save Changes' : 'Record Visit'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Visit Id
                </label>
                <input
                  type="text"
                  value={formVisitId}
                  onChange={e => setFormVisitId(e.target.value)}
                  placeholder="VIS-101"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <SearchableSelect
                label="Job No"
                required
                disabled={Boolean(visitToEdit)}
                value={formJobNo}
                onChange={handleJobSelect}
                options={activeJobs}
                placeholder="Select active job..."
                error={formErrors.jobNo}
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Technician Name"
                required
                disabled={!formBranch}
                value={formTechnicianName}
                onChange={setFormTechnicianName}
                options={eligibleTechnicians}
                placeholder={formBranch ? `Select tech from ${formBranch}...` : 'Select job first'}
                error={formErrors.technicianName}
              />

              <DatePickerInput
                label="Visit Date"
                required
                value={formVisitDate}
                onChange={setFormVisitDate}
                error={formErrors.visitDate}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Scheduled Arrival
                </label>
                <input
                  type="text"
                  value={formScheduledArrival}
                  onChange={e => setFormScheduledArrival(e.target.value)}
                  placeholder="YYYY/MM/DD HH:MM"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Time In / Out & Duration Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Working Hours & Duration Calculation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Actual Time In (24h)
                  </label>
                  <input
                    type="time"
                    value={formActualTimeIn}
                    onChange={e => setFormActualTimeIn(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">e.g. 08:30</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Actual Time Out (24h)
                  </label>
                  <input
                    type="time"
                    value={formActualTimeOut}
                    onChange={e => setFormActualTimeOut(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Overnight supported (past midnight)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Calculated Hours (Decimal)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={calculatedHours !== null ? `${calculatedHours} hours` : 'Enter both times'}
                    className="w-full px-3 py-2 text-sm bg-white text-blue-700 font-mono font-bold border border-blue-200 rounded-lg cursor-not-allowed shadow-xs"
                  />
                  <span className="text-[10px] text-slate-400">Auto-saved to Hours column</span>
                </div>
              </div>
            </div>

            {/* Work Done & Outcome */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Work Done
                </label>
                <textarea
                  rows={3}
                  value={formWorkDone}
                  onChange={e => setFormWorkDone(e.target.value)}
                  placeholder="Replaced worn bearings, cleaned grease seals, tested vibration levels..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Outcome
                </label>
                <textarea
                  rows={3}
                  value={formOutcome}
                  onChange={e => setFormOutcome(e.target.value)}
                  placeholder="Machine operating smoothly within tolerances. Handover sheet signed."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Coordinator & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Coordinator"
                value={formCoordinator}
                onChange={setFormCoordinator}
                options={eligibleCoordinators}
                placeholder="Select coordinator..."
              />

              <SearchableSelect
                label="Vehicle Type"
                value={formVehicleType}
                onChange={setFormVehicleType}
                options={referenceData.vehicleTypes}
                placeholder="Select vehicle type..."
              />

              <SearchableSelect
                label="Vehicle Number"
                disabled={!formBranch}
                value={formVehicleNumber}
                onChange={setFormVehicleNumber}
                options={eligibleVehicles}
                placeholder={formBranch ? `Select vehicle (${formBranch})...` : 'Select job first'}
                helpText="Filtered to selected job branch"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
