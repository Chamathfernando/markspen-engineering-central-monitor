import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { SparePartUsedRecord, JobRecord, ReferenceData } from '../types';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  Wrench,
  Search,
  PlusCircle,
  Edit2,
  RefreshCw,
  Calculator,
  Tag,
  DollarSign
} from 'lucide-react';
import { isJobActive, calculateSparePartAmounts } from '../utils/calculations';

interface SparePartsPageProps {
  referenceData: ReferenceData;
}

export const SparePartsPage: React.FC<SparePartsPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();
  const [partsUsed, setPartsUsed] = useState<SparePartUsedRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobNo, setSelectedJobNo] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [partToEdit, setPartToEdit] = useState<SparePartUsedRecord | null>(null);

  const [formJobNo, setFormJobNo] = useState('');
  const [formPartName, setFormPartName] = useState('');
  const [formUnitPrice, setFormUnitPrice] = useState<number | string>(0);
  const [formQty, setFormQty] = useState<number | string>(1);
  const [formDiscountPercent, setFormDiscountPercent] = useState<number | string>(0);
  const [formVatPercent, setFormVatPercent] = useState<number | string>(18); // Sri Lanka standard 18% VAT

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [partsList, jobsList] = await Promise.all([
        api.getSparePartsUsed(),
        api.getJobs()
      ]);
      setPartsUsed(partsList);
      setJobs(jobsList);
    } catch (err) {
      console.error('Failed to load spare parts:', err);
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

  // Large spare parts catalog options from reference sheet
  const catalogOptions = useMemo(() => {
    return referenceData.spareParts.map(p => ({
      value: p.name,
      label: p.name,
      badge: p.category || 'Spares',
      description: p.unitPrice ? `Standard: LKR ${p.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : undefined
    }));
  }, [referenceData.spareParts]);

  // Auto-fill price when selecting a part from catalog
  const handlePartSelect = (name: string) => {
    setFormPartName(name);
    const found = referenceData.spareParts.find(p => p.name === name);
    if (found && found.unitPrice) {
      setFormUnitPrice(found.unitPrice);
    }
  };

  // Live calculation preview
  const liveCalc = useMemo(() => {
    return calculateSparePartAmounts(
      Number(formUnitPrice) || 0,
      Number(formQty) || 0,
      Number(formDiscountPercent) || 0,
      Number(formVatPercent) || 0
    );
  }, [formUnitPrice, formQty, formDiscountPercent, formVatPercent]);

  const handleOpenCreate = () => {
    setPartToEdit(null);
    setFormJobNo('');
    setFormPartName('');
    setFormUnitPrice(0);
    setFormQty(1);
    setFormDiscountPercent(0);
    setFormVatPercent(18);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: SparePartUsedRecord) => {
    setPartToEdit(p);
    setFormJobNo(p.jobNo);
    setFormPartName(p.name);
    setFormUnitPrice(p.unitPrice);
    setFormQty(p.qty);
    setFormDiscountPercent(p.discountPercent);
    setFormVatPercent(p.vatPercent);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formJobNo) errors.jobNo = 'Job No is required';
    if (!formPartName.trim()) errors.name = 'Spare part Name is required';
    if (Number(formUnitPrice) < 0) errors.unitPrice = 'Unit Price cannot be negative';
    if (Number(formQty) <= 0) errors.qty = 'Qty must be a positive number';
    if (Number(formDiscountPercent) < 0 || Number(formDiscountPercent) > 100) {
      errors.discountPercent = 'Discount must be between 0% and 100%';
    }
    if (Number(formVatPercent) < 0 || Number(formVatPercent) > 100) {
      errors.vatPercent = 'VAT must be between 0% and 100%';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (partToEdit) {
        await api.updateSparePartUsed(partToEdit.id, {
          name: formPartName.trim(),
          unitPrice: Number(formUnitPrice),
          qty: Number(formQty),
          discountPercent: Number(formDiscountPercent),
          vatPercent: Number(formVatPercent)
        });
        showToast('Spare part usage updated and saved to Excel!', 'success');
      } else {
        await api.createSparePartUsed({
          jobNo: formJobNo,
          name: formPartName.trim(),
          unitPrice: Number(formUnitPrice),
          qty: Number(formQty),
          discountPercent: Number(formDiscountPercent),
          vatPercent: Number(formVatPercent)
        });
        showToast('Spare part usage recorded and appended to Excel!', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save spare part record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredParts = useMemo(() => {
    return partsUsed.filter(p => {
      if (selectedJobNo !== 'ALL' && p.jobNo.toLowerCase() !== selectedJobNo.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.jobNo.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [partsUsed, selectedJobNo, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Spare Parts Used
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 font-mono">
              Worksheet: Spare Parts Used ({partsUsed.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track replacement components, unit prices, quantity, discounts, VAT (18%), and Excel-synchronized totals.
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
            <span>Add Spare Part</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Part Name or Job No..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={selectedJobNo}
            onChange={e => {
              setSelectedJobNo(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-700"
          >
            <option value="ALL">All Jobs</option>
            {jobs.map(j => (
              <option key={j.jobNo} value={j.jobNo}>{j.jobNo} — {j.customerName}</option>
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
                <th className="px-4 py-3">Spare Part Name</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Subtotal (Ex VAT)</th>
                <th className="px-4 py-3 text-right">Disc (%)</th>
                <th className="px-4 py-3 text-right">After Disc</th>
                <th className="px-4 py-3 text-right">VAT (%)</th>
                <th className="px-4 py-3 text-right">Total (Inc VAT)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 font-sans">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Reading Spare Parts Used worksheet...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 font-sans">
                    No spare parts records found.
                  </td>
                </tr>
              ) : (
                paginatedList.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-blue-600">{p.jobNo}</td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-right">LKR {p.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{p.qty}</td>
                    <td className="px-4 py-3 text-right text-slate-600">LKR {p.totalPriceExVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{p.discountPercent}%</td>
                    <td className="px-4 py-3 text-right text-slate-700">LKR {p.totalPriceAfterDiscountExVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{p.vatPercent}%</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-950">
                      LKR {p.totalPriceIncVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Spare Part"
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
          totalItems={filteredParts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={partToEdit ? `Edit Part — ${partToEdit.name}` : 'Record Spare Part Used'}
          subtitle="Prices and VAT are verified and written with Excel formulas"
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
                {partToEdit ? 'Save Changes' : 'Record Spare Part'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <SearchableSelect
              label="Job No"
              required
              disabled={Boolean(partToEdit)}
              value={formJobNo}
              onChange={setFormJobNo}
              options={activeJobs}
              placeholder="Select active job..."
              error={formErrors.jobNo}
            />

            <SearchableSelect
              label="Spare Part Name (From Catalog)"
              required
              value={formPartName}
              onChange={handlePartSelect}
              options={catalogOptions}
              placeholder="Search spare parts catalog..."
              error={formErrors.name}
              helpText="Select from catalog to auto-fill standard pricing or enter custom name"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Unit Price (LKR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formUnitPrice}
                  onChange={e => setFormUnitPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.unitPrice && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.unitPrice}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formQty}
                  onChange={e => setFormQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.qty && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.qty}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formDiscountPercent}
                  onChange={e => setFormDiscountPercent(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.discountPercent && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.discountPercent}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  VAT (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formVatPercent}
                  onChange={e => setFormVatPercent(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.vatPercent && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.vatPercent}</p>
                )}
              </div>
            </div>

            {/* Live Financial Cost Breakdown Card */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-inner space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-400">
                  <Calculator className="w-4 h-4" /> Live Financial Calculation Breakdown
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Formula Linked</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
                <div>
                  <span className="text-slate-400 text-[10px] block">Subtotal (Ex VAT)</span>
                  <span className="font-bold text-slate-100">
                    LKR {liveCalc.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Discount ({formDiscountPercent}%)</span>
                  <span className="text-amber-400">
                    - LKR {liveCalc.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">VAT ({formVatPercent}%)</span>
                  <span className="text-blue-300">
                    + LKR {liveCalc.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold">Total (Inc VAT)</span>
                  <span className="text-emerald-400 font-extrabold text-sm">
                    LKR {liveCalc.finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
