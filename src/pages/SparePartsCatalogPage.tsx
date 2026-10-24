import React, { useState, useMemo } from 'react';
import { ReferenceData } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  Package,
  Layers,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Tag,
  CircleDollarSign,
  TrendingUp,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

interface SparePartsCatalogPageProps {
  referenceData: ReferenceData;
  onRefreshReferenceData: () => Promise<void>;
}

export const SparePartsCatalogPage: React.FC<SparePartsCatalogPageProps> = ({
  referenceData,
  onRefreshReferenceData
}) => {
  const { showToast } = useToast();

  // Search, Filter, Sort & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Spare Part Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnitPrice, setFormUnitPrice] = useState<number | string>('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Distinct Categories from Excel
  const categories = useMemo(() => {
    const set = new Set<string>();
    referenceData.spareParts.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [referenceData.spareParts]);

  // Financial Insights
  const stats = useMemo(() => {
    const parts = referenceData.spareParts;
    const totalCount = parts.length;
    if (totalCount === 0) {
      return { totalCount: 0, avgPrice: 0, maxPart: null };
    }
    const totalPrice = parts.reduce((sum, p) => sum + (p.unitPrice || 0), 0);
    const avgPrice = Math.round(totalPrice / totalCount);

    let maxPart = parts[0];
    parts.forEach(p => {
      if ((p.unitPrice || 0) > (maxPart.unitPrice || 0)) {
        maxPart = p;
      }
    });

    return { totalCount, avgPrice, maxPart };
  }, [referenceData.spareParts]);

  // Filtered & Sorted Parts
  const filteredParts = useMemo(() => {
    let result = referenceData.spareParts.filter(p => {
      if (selectedCategory !== 'ALL' && (p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price-asc') return (a.unitPrice || 0) - (b.unitPrice || 0);
      if (sortBy === 'price-desc') return (b.unitPrice || 0) - (a.unitPrice || 0);
      return 0;
    });

    return result;
  }, [referenceData.spareParts, selectedCategory, searchQuery, sortBy]);

  // Paginated List
  const paginatedParts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, currentPage, pageSize]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshReferenceData();
      showToast('Spare parts catalog refreshed from Excel workbook!', 'success');
    } catch {
      showToast('Failed to refresh spare parts from Excel', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormCategory(categories[0] || 'General');
    setFormUnitPrice('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Spare Part Name is required');
      return;
    }
    const priceNum = Number(formUnitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid non-negative unit price');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await api.createSparePartInCatalog({
        name: formName.trim(),
        category: formCategory.trim() || 'General',
        unitPrice: priceNum
      });
      showToast(`Spare part "${formName.trim()}" added to "Spare parts" sheet in Excel!`, 'success');
      setIsAddModalOpen(false);
      await onRefreshReferenceData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to add spare part');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for Category Badge Color
  const getCategoryBadgeClass = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('bearing')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat.includes('seal') || cat.includes('gasket')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (cat.includes('electric')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (cat.includes('sensor') || cat.includes('automation')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (cat.includes('pneumatic') || cat.includes('hydraulic')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (cat.includes('pump') || cat.includes('compressor')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (cat.includes('safety') || cat.includes('control')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Spare Parts Catalog
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 font-mono">
                  Sheet: Spare parts ({referenceData.spareParts.length})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Central spare parts catalog, categories, and unit price directory mapped directly from Excel.
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
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Spare Part
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Catalog Items
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.totalCount}</span>
            <span className="text-[10px] text-indigo-600 font-semibold uppercase">Registered</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Categories
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{categories.length}</span>
            <span className="text-[10px] text-slate-500">Distinct Groups</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Average Unit Price
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              LKR {stats.avgPrice.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">per unit</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Highest Price Item
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-900 font-mono">
              LKR {stats.maxPart ? (stats.maxPart.unitPrice || 0).toLocaleString() : '0'}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5" title={stats.maxPart?.name}>
              {stats.maxPart?.name || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search spare parts by description or category..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="name">Sort by Name (A-Z)</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
              </select>
            </div>
          </div>

          <div className="text-slate-500 text-[11px] font-mono">
            Filtered: <strong className="text-slate-800">{filteredParts.length}</strong> of{' '}
            {referenceData.spareParts.length} parts
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">Part Name & Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Standard Unit Price (LKR)</th>
                <th className="px-4 py-3 text-center">Workbook Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No spare parts found matching criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting the category filter or search keywords.</p>
                  </td>
                </tr>
              ) : (
                paginatedParts.map((part, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  const price = part.unitPrice || 0;

                  return (
                    <tr key={`${part.name}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center font-mono text-slate-400">
                        {absoluteIndex}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {part.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Master Item • Row {absoluteIndex + 1} in "Spare parts" sheet
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getCategoryBadgeClass(
                            part.category
                          )}`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          {part.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          LKR {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> In Catalog
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredParts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add Spare Part Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Spare Part"
          subtitle='Appends directly to the authoritative "Spare parts" worksheet in Excel'
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
                onClick={handleSavePart}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Writing to Excel...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save to "Spare parts" Sheet
                  </>
                )}
              </button>
            </>
          }
        >
          <form onSubmit={handleSavePart} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Part Name & Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Needle Roller Bearing HK2016, Solenoid Coil 24V..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2">
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Type Custom Category...</option>
                </select>

                {formCategory === '__CUSTOM__' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom category name..."
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Standard Unit Price (LKR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  LKR
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formUnitPrice}
                  onChange={e => setFormUnitPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-12 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This unit price will auto-fill when selecting this part in the "Spare Parts Used" operational sheet.
              </p>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
