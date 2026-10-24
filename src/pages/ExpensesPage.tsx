import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { ExpenseRecord, JobRecord, ReferenceData } from '../types';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  Receipt,
  Search,
  PlusCircle,
  Edit2,
  RefreshCw,
  Building,
  CheckCircle2
} from 'lucide-react';
import { isJobActive, formatDate } from '../utils/calculations';

interface ExpensesPageProps {
  referenceData: ReferenceData;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseRecord | null>(null);

  const [formExpenseId, setFormExpenseId] = useState('');
  const [formJobNo, setFormJobNo] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formPurchasedBy, setFormPurchasedBy] = useState('');
  const [formBranchChargedTo, setFormBranchChargedTo] = useState('');
  const [formExpenseCategory, setFormExpenseCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formExpenseAmount, setFormExpenseAmount] = useState<number | string>(0);
  const [formReceipt, setFormReceipt] = useState('');
  const [formApprovedBy, setFormApprovedBy] = useState('');
  const [formEnteredBy, setFormEnteredBy] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'Paid' | 'Not Paid'>('Not Paid');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [expenseList, jobsList] = await Promise.all([
        api.getExpenses(),
        api.getJobs()
      ]);
      setExpenses(expenseList);
      setJobs(jobsList);
    } catch (err) {
      console.error('Failed to load expenses:', err);
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

  // Combined Purchased By options: Technicians + Managers
  const purchasedByOptions = useMemo(() => {
    const techOptions = referenceData.technicians.map(t => ({
      value: t.name,
      label: `${t.name} (Tech)`,
      badge: t.branch,
      description: 'Field Technician'
    }));
    const mgrOptions = referenceData.managers.map(m => ({
      value: m.name,
      label: `${m.name} (Mgr)`,
      badge: m.branch,
      description: m.role || 'Manager'
    }));
    return [...techOptions, ...mgrOptions];
  }, [referenceData.technicians, referenceData.managers]);

  const managerOptions = useMemo(() => {
    return referenceData.managers.map(m => ({
      value: m.name,
      label: m.name,
      badge: m.branch,
      description: m.role || `${m.branch} Manager`
    }));
  }, [referenceData.managers]);

  // When job changes, auto-set default Branch Charged To
  const handleJobSelect = (jobNo: string) => {
    setFormJobNo(jobNo);
    const selected = jobs.find(j => j.jobNo === jobNo);
    if (selected && !formBranchChargedTo) {
      setFormBranchChargedTo(selected.branch);
    }
  };

  const handleOpenCreate = async () => {
    setExpenseToEdit(null);
    const todayStr = formatDate(new Date());
    setFormExpenseId('EXP-00001');
    try {
      const nextId = await api.getNextExpenseId();
      setFormExpenseId(nextId);
    } catch {
      // fallback
    }
    setFormJobNo('');
    setFormDate(todayStr);
    setFormPurchasedBy('');
    setFormBranchChargedTo(referenceData.branches[0] || 'Colombo');
    setFormExpenseCategory(referenceData.expenseCategories[0] || 'Travel & Transport');
    setFormDescription('');
    setFormSupplier('');
    setFormExpenseAmount(0);
    setFormReceipt('');
    setFormApprovedBy(referenceData.managers[0]?.name || '');
    setFormEnteredBy(referenceData.managers[1]?.name || '');
    setFormPaymentStatus('Not Paid');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: ExpenseRecord) => {
    setExpenseToEdit(e);
    setFormExpenseId(e.expenseId);
    setFormJobNo(e.jobNo);
    setFormDate(e.date);
    setFormPurchasedBy(e.purchasedBy);
    setFormBranchChargedTo(e.branchChargedTo);
    setFormExpenseCategory(e.expenseCategory);
    setFormDescription(e.description);
    setFormSupplier(e.supplier);
    setFormExpenseAmount(e.expenseAmount);
    setFormReceipt(e.receipt);
    setFormApprovedBy(e.approvedBy);
    setFormEnteredBy(e.enteredBy);
    setFormPaymentStatus(e.paymentStatus);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formExpenseId.trim()) errors.expenseId = 'Expense ID is required';
    if (!formJobNo) errors.jobNo = 'Job No is required';
    if (!formDate) errors.date = 'Date is required';
    if (!formPurchasedBy) errors.purchasedBy = 'Purchased By is required';
    if (Number(formExpenseAmount) < 0) errors.expenseAmount = 'Amount cannot be negative';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<ExpenseRecord> = {
        expenseId: formExpenseId.trim(),
        jobNo: formJobNo,
        date: formDate,
        purchasedBy: formPurchasedBy,
        branchChargedTo: formBranchChargedTo,
        expenseCategory: formExpenseCategory,
        description: formDescription.trim(),
        supplier: formSupplier.trim(),
        expenseAmount: Number(formExpenseAmount) || 0,
        receipt: formReceipt.trim(),
        approvedBy: formApprovedBy,
        enteredBy: formEnteredBy,
        paymentStatus: formPaymentStatus
      };

      if (expenseToEdit) {
        await api.updateExpense(expenseToEdit.id, payload);
        showToast('Expense updated and saved to Excel!', 'success');
      } else {
        await api.createExpense(payload);
        showToast('Expense recorded and appended to Excel!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (selectedBranch !== 'ALL' && e.branchChargedTo.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }
      if (selectedCategory !== 'ALL' && e.expenseCategory.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (selectedPaymentStatus !== 'ALL' && e.paymentStatus.toLowerCase() !== selectedPaymentStatus.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          e.expenseId.toLowerCase().includes(q) ||
          e.jobNo.toLowerCase().includes(q) ||
          e.purchasedBy.toLowerCase().includes(q) ||
          e.supplier.toLowerCase().includes(q) ||
          e.receipt.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, selectedBranch, selectedCategory, selectedPaymentStatus, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Operational Expenses
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 font-mono">
              Worksheet: Expenses ({expenses.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track fuel, tolls, meals, lodging, emergency spares, and invoice receipt status linked to jobs.
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
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Expense ID, Job, Person, Supplier..."
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
            <option value="ALL">All Branches Charged</option>
            {referenceData.branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
          >
            <option value="ALL">All Expense Categories</option>
            {referenceData.expenseCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedPaymentStatus}
            onChange={e => {
              setSelectedPaymentStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Not Paid">Not Paid</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="px-4 py-3">Expense ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Job No</th>
                <th className="px-4 py-3">Purchased By</th>
                <th className="px-4 py-3">Branch Charged</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Amount (LKR)</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Expenses worksheet...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedList.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{e.expenseId}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{e.date}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{e.jobNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.purchasedBy}</td>
                    <td className="px-4 py-3 text-slate-600">{e.branchChargedTo}</td>
                    <td className="px-4 py-3 text-slate-700">{e.expenseCategory}</td>
                    <td className="px-4 py-3 text-slate-600">{e.supplier || '—'}</td>
                    <td className="px-4 py-3 font-mono text-right font-bold text-slate-950">
                      LKR {e.expenseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.paymentStatus} type="payment" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(e)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Expense"
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
          totalItems={filteredExpenses.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={expenseToEdit ? `Edit Expense — ${expenseToEdit.expenseId}` : 'Record Operational Expense'}
          subtitle="Committed directly to Expenses worksheet with duplicate ID checks"
          maxWidth="2xl"
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
                {expenseToEdit ? 'Save Changes' : 'Record Expense'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Expense ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={Boolean(expenseToEdit)}
                  value={formExpenseId}
                  onChange={e => setFormExpenseId(e.target.value)}
                  placeholder="EXP-2026-001"
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs font-mono
                    ${expenseToEdit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}
                    ${formErrors.expenseId ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'}`}
                />
                {formErrors.expenseId && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.expenseId}</p>
                )}
              </div>

              <SearchableSelect
                label="Job No"
                required
                disabled={Boolean(expenseToEdit)}
                value={formJobNo}
                onChange={handleJobSelect}
                options={activeJobs}
                placeholder="Select active job..."
                error={formErrors.jobNo}
              />

              <DatePickerInput
                label="Expense Date"
                required
                value={formDate}
                onChange={setFormDate}
                error={formErrors.date}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Purchased By"
                required
                value={formPurchasedBy}
                onChange={setFormPurchasedBy}
                options={purchasedByOptions}
                placeholder="Select technician or manager..."
                error={formErrors.purchasedBy}
                helpText="Includes Technicians and Managers"
              />

              <SearchableSelect
                label="Branch Charged To"
                required
                value={formBranchChargedTo}
                onChange={setFormBranchChargedTo}
                options={referenceData.branches}
                placeholder="Select branch..."
              />

              <SearchableSelect
                label="Expense Category"
                required
                value={formExpenseCategory}
                onChange={setFormExpenseCategory}
                options={referenceData.expenseCategories}
                placeholder="Select category..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={e => setFormSupplier(e.target.value)}
                  placeholder="e.g. Ceypetco, Hardware Store"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Expense Amount (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formExpenseAmount}
                  onChange={e => setFormExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.expenseAmount && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.expenseAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Receipt Ref / Invoice No
                </label>
                <input
                  type="text"
                  value={formReceipt}
                  onChange={e => setFormReceipt(e.target.value)}
                  placeholder="RCP-9812 / INV-004"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Description / Purpose
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Highway toll tickets, petrol for Colombo-Kandy dispatch..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SearchableSelect
                label="Approved By"
                value={formApprovedBy}
                onChange={setFormApprovedBy}
                options={managerOptions}
                placeholder="Select manager..."
              />

              <SearchableSelect
                label="Entered By"
                value={formEnteredBy}
                onChange={setFormEnteredBy}
                options={managerOptions}
                placeholder="Select manager..."
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Status
                </label>
                <select
                  value={formPaymentStatus}
                  onChange={e => setFormPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="Not Paid">Not Paid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
