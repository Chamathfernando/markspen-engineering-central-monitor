import React, { useState, useEffect, useMemo } from 'react';
import { JobRecord, ReferenceData } from '../types';
import { api } from '../services/api';
import { Pagination } from '../components/common/Pagination';
import { useToast } from '../components/common/Toast';
import {
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

interface QuickReportsPageProps {
  referenceData: ReferenceData;
}

export const QuickReportsPage: React.FC<QuickReportsPageProps> = ({ referenceData }) => {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allPendingJobs, setAllPendingJobs] = useState<JobRecord[]>([]);

  // Filters & Toggles
  const [filterMode, setFilterMode] = useState<'overdue-only' | 'all'>('overdue-only');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchReportData = async () => {
    try {
      const data = await api.getPendingCustomerReport();
      setAllPendingJobs(data.allPendingCustomerJobs || []);
    } catch (err) {
      console.error('Failed to load pending customer report:', err);
      showToast('Failed to load report data from server', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchReportData();
    showToast('Quick report synchronized with Excel workbook!', 'success');
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPending = allPendingJobs.length;
    // Overdue = today is past the Follow-Up Due Date (pendingCustomerDays > 0)
    const overdueJobs = allPendingJobs.filter(j => (j.pendingCustomerDays || 0) > 0);
    const criticalJobs = allPendingJobs.filter(j => (j.pendingCustomerDays || 0) > 7);

    const totalDays = overdueJobs.reduce((acc, j) => acc + (j.pendingCustomerDays || 0), 0);
    const avgDays = overdueJobs.length > 0 ? Math.round(totalDays / overdueJobs.length) : 0;

    let longestJob = overdueJobs[0] || null;
    overdueJobs.forEach(j => {
      if ((j.pendingCustomerDays || 0) > (longestJob?.pendingCustomerDays || 0)) {
        longestJob = j;
      }
    });

    return {
      totalPending,
      overdueCount: overdueJobs.length,
      criticalCount: criticalJobs.length,
      avgDays,
      longestJob
    };
  }, [allPendingJobs]);

  // Filtered List based on Toggle, Search, and Branch
  const filteredList = useMemo(() => {
    return allPendingJobs.filter(job => {
      // 1. Overdue filter: past due date only (days > 0) vs all
      const days = job.pendingCustomerDays || 0;
      if (filterMode === 'overdue-only' && days <= 0) {
        return false;
      }

      // 2. Branch Filter
      if (selectedBranch !== 'ALL' && job.branch.toLowerCase() !== selectedBranch.toLowerCase()) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          job.jobNo.toLowerCase().includes(q) ||
          job.customerName.toLowerCase().includes(q) ||
          job.contactNumber.toLowerCase().includes(q) ||
          job.machineModel.toLowerCase().includes(q) ||
          job.machineCategory.toLowerCase().includes(q) ||
          job.branch.toLowerCase().includes(q)
        );
      }

      return true;
    }).sort((a, b) => (b.pendingCustomerDays || 0) - (a.pendingCustomerDays || 0)); // Most overdue first
  }, [allPendingJobs, filterMode, selectedBranch, searchQuery]);

  // Paginated List
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Quick Reports
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  Past Follow-Up Due Date
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Service orders in "Pending Customer" status where the current date is past the designated "Follow-Up Due Date".
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
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
            Refresh Report
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setFilterMode('overdue-only');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterMode === 'overdue-only'
              ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-1 ring-amber-300'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Past Follow-Up Due Date
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono">
              {stats.overdueCount}
            </span>
            <span className="text-[10px] text-amber-800 font-bold uppercase">
              Follow-Up Overdue
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            setFilterMode('all');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterMode === 'all'
              ? 'bg-blue-50/70 border-blue-300 shadow-sm ring-1 ring-blue-300'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Pending Customer
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {stats.totalPending}
            </span>
            <span className="text-[10px] text-blue-600 font-semibold">Active Jobs</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Critical (&gt; 7 Days Past)
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {stats.criticalCount}
            </span>
            <span className="text-[10px] text-rose-600 font-semibold">Severe Delay</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Longest Overdue Job
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-900 font-mono">
              {stats.longestJob ? `${stats.longestJob.pendingCustomerDays} Days Past` : 'None'}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5" title={stats.longestJob?.customerName}>
              {stats.longestJob ? `${stats.longestJob.jobNo} • ${stats.longestJob.customerName}` : 'All follow-ups current'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* View Mode Toggle Buttons */}
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('overdue-only');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  filterMode === 'overdue-only'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Past Follow-Up Due Date ({stats.overdueCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Pending Customer ({stats.totalPending})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search job #, customer, model, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedBranch}
                onChange={e => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option value="ALL">All Branches</option>
                {referenceData.branches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-slate-500 text-[11px] font-mono">
            Showing <strong className="text-slate-800">{filteredList.length}</strong> matching jobs
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Job No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Customer Information</th>
                <th className="px-4 py-3">Equipment / Machine</th>
                <th className="px-4 py-3 text-center">Follow-Up Due Date</th>
                <th className="px-4 py-3 text-center">Status / Days Past Due</th>
                <th className="px-4 py-3">Coordinator / Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading escalation report...
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="text-sm font-bold text-slate-800">
                        {filterMode === 'overdue-only'
                          ? 'No Overdue Follow-Ups Found!'
                          : 'No Pending Customer Jobs'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {filterMode === 'overdue-only'
                          ? 'All jobs currently marked as "Pending Customer" have follow-up due dates in the future. No follow-ups are past due.'
                          : 'There are currently no engineering jobs in "Pending Customer" status.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map(job => {
                  const days = job.pendingCustomerDays || 0;
                  const isOverdue = days > 0;
                  const isCritical = days > 7;

                  const dueDateStr = job.followUpDueDate || job.pendingCustomerDate || 'Not set';

                  return (
                    <tr
                      key={job.jobNo}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        isCritical ? 'bg-rose-50/30' : isOverdue ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-blue-600 text-sm block">
                          {job.jobNo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Created: {job.dateCreated}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {job.branch}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">
                            {job.customerName}
                          </span>
                          {job.contactNumber ? (
                            <a
                              href={`tel:${job.contactNumber.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-mono font-semibold"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              {job.contactNumber}
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No contact</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {job.machineModel || 'Equipment'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {job.machineCategory || 'General'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          {dueDateStr}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isOverdue ? (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                                isCritical
                                  ? 'bg-red-100 text-red-800 border border-red-300 ring-1 ring-red-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-200'
                              }`}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {days} {days === 1 ? 'Day' : 'Days'} Past Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Follow-Up On Schedule
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Coordinator</span>
                          <span className="font-semibold text-slate-800">{job.coordinator || 'Unassigned'}</span>
                        </div>
                        {job.salesPerson && (
                          <div className="mt-1">
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Sales Rep</span>
                            <span className="text-slate-700">{job.salesPerson}</span>
                          </div>
                        )}
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
          totalItems={filteredList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
