import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { SearchableSelect } from '../common/SearchableSelect';
import { DatePickerInput } from '../common/DatePickerInput';
import { JobRecord, ReferenceData } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';
import { isManagerEligibleForBranch } from '../../utils/calculations';
import { Lock, CheckCircle2 } from 'lucide-react';

interface JobFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (job: JobRecord) => void;
  jobToEdit?: JobRecord | null;
  referenceData: ReferenceData;
}

export const JobFormModal: React.FC<JobFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  jobToEdit,
  referenceData
}) => {
  const { showToast } = useToast();
  const isEditing = Boolean(jobToEdit);

  const isCompletedJob = useMemo(() => {
    if (!isEditing || !jobToEdit) return false;
    const current = (jobToEdit.status || '').trim().toLowerCase();
    return current === 'completed' || current === 'closed';
  }, [isEditing, jobToEdit]);

  const [jobNo, setJobNo] = useState('');
  const [branch, setBranch] = useState('');
  const [jobType, setJobType] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [machineCategory, setMachineCategory] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [complaint, setComplaint] = useState('');
  const [warehouseDeliveryDate, setWarehouseDeliveryDate] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [status, setStatus] = useState('Open');
  const [pendingCustomerDate, setPendingCustomerDate] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (jobToEdit) {
        setJobNo(jobToEdit.jobNo);
        setBranch(jobToEdit.branch);
        setJobType(jobToEdit.jobType);
        setCustomerName(jobToEdit.customerName || '');
        setContactNumber(jobToEdit.contactNumber || '');
        setCustomerAddress(jobToEdit.customerAddress || '');
        setMachineCategory(jobToEdit.machineCategory || '');
        setMachineModel(jobToEdit.machineModel || '');
        setSerialNumber(jobToEdit.serialNumber || '');
        setInstallationDate(jobToEdit.installationDate || '');
        setComplaint(jobToEdit.complaint || '');
        setWarehouseDeliveryDate(jobToEdit.warehouseDeliveryDate || '');
        setProblemDescription(jobToEdit.problemDescription || '');
        setPriority(jobToEdit.priority || 'Medium');
        setExpectedCompletion(jobToEdit.expectedCompletion || '');
        setSpecialInstructions(jobToEdit.specialInstructions || '');
        setCreatedBy(jobToEdit.createdBy || '');
        setSalesPerson(jobToEdit.salesPerson || '');
        setCoordinator(jobToEdit.coordinator || '');
        setStatus(jobToEdit.status || 'Open');
        setPendingCustomerDate(jobToEdit.pendingCustomerDate || '');
      } else {
        // Fetch next suggested job number
        api.getNextJobNumber()
          .then(nextNo => setJobNo(nextNo))
          .catch(() => setJobNo(''));

        setBranch('');
        setJobType('');
        setCustomerName('');
        setContactNumber('');
        setCustomerAddress('');
        setMachineCategory('');
        setMachineModel('');
        setSerialNumber('');
        setInstallationDate('');
        setComplaint('');
        setWarehouseDeliveryDate('');
        setProblemDescription('');
        setPriority('Medium');
        setExpectedCompletion('');
        setSpecialInstructions('');
        setCreatedBy('');
        setSalesPerson('');
        setCoordinator('');
        setStatus('Open');
        setPendingCustomerDate('');
      }
    }
  }, [isOpen, jobToEdit, referenceData]);

  // When branch changes, keep selected managers intact (managers shown irrespective of branch)
  const handleBranchChange = (newBranch: string) => {
    setBranch(newBranch);
  };

  // Show all managers listed under "Managers" sheet irrespective of their branch
  const allManagerOptions = referenceData.managers.map(m => ({
    value: m.name,
    label: m.name,
    badge: m.branch,
    description: m.role || 'Manager'
  }));

  // Statuses managed exclusively via Job Closing tab:
  // Pending Parts, On Hold, Cancelled, Invalid, Pending Customer, Completed, Closed
  const CLOSING_MANAGED_STATUSES = [
    'pending parts',
    'on hold',
    'cancelled',
    'invalid',
    'pending customer',
    'completed',
    'closed'
  ];

  const isStatusLocked = useMemo(() => {
    if (!isEditing || !jobToEdit) return false;
    const current = (jobToEdit.status || '').trim().toLowerCase();
    return CLOSING_MANAGED_STATUSES.includes(current);
  }, [isEditing, jobToEdit]);

  // Filter statuses: Exclude all closing-managed statuses from Jobs create/edit dropdown
  const eligibleStatuses = useMemo(() => {
    const base = referenceData.statuses.filter(s => {
      const lower = s.trim().toLowerCase();
      return !CLOSING_MANAGED_STATUSES.includes(lower);
    });

    if (isStatusLocked && jobToEdit?.status && !base.includes(jobToEdit.status)) {
      return [jobToEdit.status, ...base];
    }
    return base;
  }, [referenceData.statuses, isStatusLocked, jobToEdit?.status]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!jobNo.trim()) {
      errs.jobNo = 'Job No is required';
    } else if (!/^\d{4}-MPH-\d{4,}$/i.test(jobNo.trim())) {
      errs.jobNo = 'Must follow format YYYY-MPH-XXXX (e.g. 2026-MPH-0001)';
    }

    if (!branch) errs.branch = 'Branch is required';
    if (!jobType) errs.jobType = 'Job Type is required';
    if (!customerName.trim()) errs.customerName = 'Customer Name is required';
    if (!contactNumber.trim()) errs.contactNumber = 'Contact Number is required';
    if (!customerAddress.trim()) errs.customerAddress = 'Customer Address / Location is required';

    if (!createdBy.trim()) errs.createdBy = 'Created By is required';
    if (!salesPerson.trim()) errs.salesPerson = 'Sales Person is required';
    if (!coordinator.trim()) errs.coordinator = 'Coordinator is required';
    if (!status.trim()) errs.status = 'Status is required';

    if (!installationDate || !installationDate.trim()) {
      errs.installationDate = 'Installation Date is required';
    }
    if (!warehouseDeliveryDate || !warehouseDeliveryDate.trim()) {
      errs.warehouseDeliveryDate = 'Warehouse Delivery Date is required';
    }
    if (!expectedCompletion || !expectedCompletion.trim()) {
      errs.expectedCompletion = 'Expected Completion Date is required';
    }

    if (status.trim().toLowerCase() === 'pending customer' && (!pendingCustomerDate || !pendingCustomerDate.trim())) {
      errs.pendingCustomerDate = 'Follow-Up Due Date is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompletedJob) {
      showToast('This job is marked as Completed and cannot be modified.', 'error');
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<JobRecord> = {
        jobNo: jobNo.trim(),
        branch,
        jobType,
        customerName: customerName.trim(),
        contactNumber: contactNumber.trim(),
        customerAddress: customerAddress.trim(),
        machineCategory: machineCategory.trim(),
        machineModel: machineModel.trim(),
        serialNumber: serialNumber.trim(),
        installationDate,
        complaint: complaint.trim(),
        warehouseDeliveryDate,
        problemDescription: problemDescription.trim(),
        priority,
        expectedCompletion,
        specialInstructions: specialInstructions.trim(),
        createdBy,
        salesPerson,
        coordinator,
        status,
        pendingCustomerDate
      };

      let saved: JobRecord;
      if (isEditing && jobToEdit) {
        saved = await api.updateJob(jobToEdit.jobNo, payload);
        showToast(`Job ${saved.jobNo} updated and saved to Excel!`, 'success');
      } else {
        saved = await api.createJob(payload);
        showToast(`Job ${saved.jobNo} created and appended to Excel!`, 'success');
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save job to workbook', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Job — ${jobToEdit?.jobNo}` : 'Create New Engineering Job'}
      subtitle="Data is verified and committed directly to Markspen_Engineering_Central_Monitor.xlsx"
      maxWidth="4xl"
      footer={
        <>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {isCompletedJob ? 'Close' : 'Cancel'}
          </button>
          {!isCompletedJob && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className={`px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2
                ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Create Job'}
            </button>
          )}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {isCompletedJob && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>This job has been marked as <strong>Completed</strong>. All fields are locked for editing and preserved for auditing.</span>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
              <Lock className="w-3.5 h-3.5" /> Locked (Read-Only)
            </span>
          </div>
        )}

        <fieldset disabled={isCompletedJob} className="space-y-6 border-0 p-0 m-0 min-w-0">
          {/* Section 1: Core Job Identification */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
              1. Core Job Identification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Job No <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isEditing}
                  value={jobNo}
                  onChange={e => setJobNo(e.target.value)}
                  placeholder="2026-MPH-0001"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs font-mono
                    ${isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}
                    ${errors.jobNo ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}`}
                />
                {errors.jobNo ? (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{errors.jobNo}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">Format: YYYY-MPH-XXXX (e.g. 2026-MPH-0001)</p>
                )}
              </div>

              <SearchableSelect
                label="Branch"
                required
                disabled={isCompletedJob}
                value={branch}
                onChange={handleBranchChange}
                options={referenceData.branches}
                placeholder="Select branch..."
                error={errors.branch}
              />

              <SearchableSelect
                label="Job Type"
                required
                disabled={isCompletedJob}
                value={jobType}
                onChange={setJobType}
                options={referenceData.jobTypes}
                placeholder="Select job type..."
                error={errors.jobType}
              />
            </div>
          </div>

        {/* Section 2: Customer Details */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
            2. Customer Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Lanka Mills PLC"
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs
                  ${errors.customerName ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'}`}
              />
              {errors.customerName && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.customerName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Contact Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                placeholder="+94 11 234 5678"
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs
                  ${errors.contactNumber ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'}`}
              />
              {errors.contactNumber && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.contactNumber}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Customer Address / Location <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                placeholder="Factory address, Zone, City"
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs
                  ${errors.customerAddress ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'}`}
              />
              {errors.customerAddress && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.customerAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Machine & Problem */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
            3. Machine Details & Complaint
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Machine Category
              </label>
              <input
                type="text"
                value={machineCategory}
                onChange={e => setMachineCategory(e.target.value)}
                placeholder="e.g. CNC Lathe, Generator, Boiler"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Machine Model
              </label>
              <input
                type="text"
                value={machineModel}
                onChange={e => setMachineModel(e.target.value)}
                placeholder="Model name / number"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Serial Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="SN-XXXXX"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Complaint / Requirement
              </label>
              <textarea
                rows={2}
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                placeholder="Client reported issues or request..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Problem Description (Technical)
              </label>
              <textarea
                rows={2}
                value={problemDescription}
                onChange={e => setProblemDescription(e.target.value)}
                placeholder="Detailed technical inspection notes or symptoms..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Operational Dates & Priority */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
            4. Scheduling, Priority & Instructions
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <DatePickerInput
              label="Installation Date"
              required
              disabled={isCompletedJob}
              value={installationDate}
              onChange={setInstallationDate}
              error={errors.installationDate}
            />

            <DatePickerInput
              label="Warehouse Delivery"
              required
              disabled={isCompletedJob}
              value={warehouseDeliveryDate}
              onChange={setWarehouseDeliveryDate}
              error={errors.warehouseDeliveryDate}
            />

            <DatePickerInput
              label="Expected Completion"
              required
              disabled={isCompletedJob}
              value={expectedCompletion}
              onChange={setExpectedCompletion}
              error={errors.expectedCompletion}
            />

            <SearchableSelect
              label="Priority"
              disabled={isCompletedJob}
              value={priority}
              onChange={setPriority}
              options={['Critical', 'High', 'Medium', 'Low']}
            />

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Special Instructions
              </label>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Safety instructions, gate passes, specific PPE required..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Assignments & Status */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
            5. Management & Status
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Created By"
              required
              disabled={isCompletedJob}
              value={createdBy}
              onChange={setCreatedBy}
              options={allManagerOptions}
              placeholder="Select manager..."
              error={errors.createdBy}
              helpText="All managers from Managers sheet"
            />

            <SearchableSelect
              label="Sales Person"
              required
              disabled={isCompletedJob}
              value={salesPerson}
              onChange={setSalesPerson}
              options={allManagerOptions}
              placeholder="Select sales person..."
              error={errors.salesPerson}
              helpText="All managers from Managers sheet"
            />

            <SearchableSelect
              label="Coordinator"
              required
              disabled={isCompletedJob}
              value={coordinator}
              onChange={setCoordinator}
              options={allManagerOptions}
              placeholder="Select coordinator..."
              error={errors.coordinator}
              helpText="All managers from Managers sheet"
            />

            <SearchableSelect
              label="Status"
              required
              disabled={isStatusLocked || isCompletedJob}
              value={status}
              onChange={setStatus}
              options={eligibleStatuses}
              placeholder="Select status..."
              error={errors.status}
              helpText={
                isCompletedJob
                  ? 'Job is Completed (permanently locked)'
                  : isStatusLocked
                  ? `Status is "${status}" (managed exclusively via Job Closing tab)`
                  : 'Pending Parts, On Hold, Cancelled, Invalid, Pending Customer & Completed are managed via Job Closing'
              }
            />

            {status.trim().toLowerCase() === 'pending customer' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Follow-Up Due Date <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={isStatusLocked || isCompletedJob}
                  value={pendingCustomerDate ? pendingCustomerDate.replace(/\//g, '-') : ''}
                  onChange={e => {
                    const val = e.target.value;
                    setPendingCustomerDate(val ? val.replace(/-/g, '/') : '');
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg font-mono font-semibold
                    ${isStatusLocked || isCompletedJob ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed' : 'bg-amber-50/60 border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'}
                    ${errors.pendingCustomerDate ? 'border-rose-500 ring-1 ring-rose-200' : ''}`}
                />
                {errors.pendingCustomerDate ? (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{errors.pendingCustomerDate}</p>
                ) : (
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Saved in Column 25 of "Jobs" sheet and synchronized from the Job Closing tab.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        </fieldset>
      </form>
    </Modal>
  );
};
