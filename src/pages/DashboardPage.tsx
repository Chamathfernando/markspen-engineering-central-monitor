import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { DashboardStats, JobRecord, ReferenceData, TechnicianVisit } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import {
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle,
  CalendarDays,
  Receipt,
  Wrench,
  ArrowRight,
  Activity,
  PlusCircle,
  Filter,
  Calendar,
  Search,
  RotateCcw,
  Eye,
  Layers,
  Sparkles,
  Phone
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardPageProps {
  onOpenNewJob: () => void;
  referenceData: ReferenceData;
  onSelectJobForDetails: (jobNo: string) => void;
}

function parseDateString(dStr: string | undefined): Date | null {
  if (!dStr || !dStr.trim()) return null;
  const parts = dStr.trim().split(/[/.-]/);
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(dStr.replace(/\//g, '-'));
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenNewJob,
  referenceData,
  onSelectJobForDetails
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allJobs, setAllJobs] = useState<JobRecord[]>([]);
  const [allVisits, setAllVisits] = useState<TechnicianVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Technician Hours Widget Filter State (default to current date - 1 day in YYYY-MM-DD format)
  const [techHoursFilterName, setTechHoursFilterName] = useState('ALL');
  const [techHoursFilterDate, setTechHoursFilterDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  // Group technician hours by technician and visit date
  const technicianDailyHours = useMemo(() => {
    // Map of "TechnicianName|Date" -> totalHours
    const map: Record<string, { technicianName: string; visitDate: string; totalHours: number; visitsCount: number; visits: TechnicianVisit[] }> = {};

    allVisits.forEach(v => {
      const tech = (v.technicianName || 'Unassigned').trim();
      const rawDate = (v.visitDate || '').trim();
      // Normalize rawDate (which could be YYYY/MM/DD or YYYY-MM-DD) to YYYY-MM-DD for comparison
      const normalizedDate = rawDate.replace(/\//g, '-');
      const hours = Number(v.hours) || 0;

      const key = `${tech}__${normalizedDate}`;
      if (!map[key]) {
        map[key] = {
          technicianName: tech,
          visitDate: rawDate || normalizedDate,
          totalHours: 0,
          visitsCount: 0,
          visits: []
        };
      }
      map[key].totalHours += hours;
      map[key].visitsCount += 1;
      map[key].visits.push(v);
    });

    return Object.values(map).sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [allVisits]);

  // Filtered technician daily hours list including all referenceData technicians for techHoursFilterDate
  const filteredTechnicianDailyHours = useMemo(() => {
    const selectedDate = techHoursFilterDate.trim();
    // 1. Gather all visits matching selectedDate (if any)
    const map: Record<string, { technicianName: string; visitDate: string; totalHours: number; visitsCount: number; visits: TechnicianVisit[] }> = {};

    allVisits.forEach(v => {
      const tech = (v.technicianName || 'Unassigned').trim();
      const rawDate = (v.visitDate || '').trim();
      const normalizedDate = rawDate.replace(/\//g, '-');

      if (selectedDate) {
        const filterNorm = selectedDate.replace(/\//g, '-');
        if (normalizedDate !== filterNorm) return;
      }

      const hours = Number(v.hours) || 0;
      const key = `${tech}__${normalizedDate}`;
      if (!map[key]) {
        map[key] = {
          technicianName: tech,
          visitDate: rawDate || normalizedDate,
          totalHours: 0,
          visitsCount: 0,
          visits: []
        };
      }
      map[key].totalHours += hours;
      map[key].visitsCount += 1;
      map[key].visits.push(v);
    });

    // 2. Ensure every referenceData technician is present for the selectedDate
    const allTechNames = (referenceData.technicians || []).map(t => t.name.trim()).filter(Boolean);
    // Also include any technicians who have visits on this date even if not in referenceData
    Object.values(map).forEach(item => {
      if (!allTechNames.includes(item.technicianName)) {
        allTechNames.push(item.technicianName);
      }
    });

    const result: Array<{ technicianName: string; visitDate: string; totalHours: number; visitsCount: number; visits: TechnicianVisit[] }> = [];

    allTechNames.forEach(tech => {
      if (techHoursFilterName !== 'ALL' && tech.toLowerCase() !== techHoursFilterName.toLowerCase()) {
        return;
      }
      const matchingKey = `${tech}__${selectedDate.replace(/\//g, '-')}`;
      if (map[matchingKey]) {
        result.push(map[matchingKey]);
      } else {
        // Zero hours record for this technician on selectedDate
        result.push({
          technicianName: tech,
          visitDate: selectedDate,
          totalHours: 0,
          visitsCount: 0,
          visits: []
        });
      }
    });

    return result.sort((a, b) => a.technicianName.localeCompare(b.technicianName));
  }, [allVisits, referenceData.technicians, techHoursFilterName, techHoursFilterDate]);

  // Filters for Dashboard Jobs Section
  const [jobTypeFilter, setJobTypeFilter] = useState('ALL');
  const [datePeriod, setDatePeriod] = useState<'ALL' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for Dashboard Jobs Table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const fetchStatsAndJobs = async () => {
    setIsLoading(true);
    try {
      const [dataStats, dataJobs, dataVisits] = await Promise.all([
        api.getDashboardStats(),
        api.getJobs(),
        api.getTechnicianVisits()
      ]);
      setStats(dataStats);
      setAllJobs(dataJobs);
      setAllVisits(dataVisits);
    } catch (err) {
      console.error('Error fetching dashboard stats or jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndJobs();
  }, []);

  // Filtered Jobs Logic for Dashboard Section
  const filteredDashboardJobs = useMemo(() => {
    const now = new Date();

    let startBound: Date | null = null;
    let endBound: Date | null = null;

    if (datePeriod === 'THIS_WEEK') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = todayStart.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      startBound = new Date(todayStart);
      startBound.setDate(todayStart.getDate() + diffToMonday);
      startBound.setHours(0, 0, 0, 0);

      endBound = new Date(startBound);
      endBound.setDate(startBound.getDate() + 6);
      endBound.setHours(23, 59, 59, 999);
    } else if (datePeriod === 'THIS_MONTH') {
      startBound = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endBound = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (datePeriod === 'CUSTOM') {
      if (startDate) {
        const s = parseDateString(startDate);
        if (s) {
          s.setHours(0, 0, 0, 0);
          startBound = s;
        }
      }
      if (endDate) {
        const e = parseDateString(endDate);
        if (e) {
          e.setHours(23, 59, 59, 999);
          endBound = e;
        }
      }
    }

    return allJobs.filter(job => {
      // 1. Job Type Filter
      if (jobTypeFilter !== 'ALL' && job.jobType.toLowerCase() !== jobTypeFilter.toLowerCase()) {
        return false;
      }

      // 2. Creation Date Filter
      if (startBound || endBound) {
        const jDate = parseDateString(job.dateCreated);
        if (!jDate) return false;

        if (startBound && jDate < startBound) return false;
        if (endBound && jDate > endBound) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          job.jobNo.toLowerCase().includes(q) ||
          job.customerName.toLowerCase().includes(q) ||
          (job.contactNumber && job.contactNumber.toLowerCase().includes(q)) ||
          job.machineModel.toLowerCase().includes(q) ||
          job.branch.toLowerCase().includes(q) ||
          job.jobType.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allJobs, jobTypeFilter, datePeriod, startDate, endDate, searchQuery]);

  const paginatedDashboardJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDashboardJobs.slice(start, start + pageSize);
  }, [filteredDashboardJobs, currentPage, pageSize]);

  const isFilterActive = jobTypeFilter !== 'ALL' || datePeriod !== 'ALL' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setJobTypeFilter('ALL');
    setDatePeriod('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  if (isLoading || !stats) {
    return (
      <div className="py-24 text-center">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500 font-medium">Aggregating live data from Excel sheets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/10">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Live Excel Synchronized
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Markspen Operations Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Real-time monitoring of engineering machinery repairs, branch technician dispatches, parts consumption, and job closures.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewJob}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Create Job
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Jobs Card */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Jobs</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.activeJobs}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span>Open: <strong>{stats.openJobs}</strong></span>
            <span>•</span>
            <span>In Progress: <strong>{stats.inProgressJobs}</strong></span>
          </div>
        </div>

        {/* Overdue Jobs Card */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue Attention</span>
            <div className={`p-2 rounded-lg ${stats.overdueJobs > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${stats.overdueJobs > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {stats.overdueJobs}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {stats.overdueJobs > 0 ? (
              <span className="text-rose-600 font-semibold">Requires immediate coordinator action</span>
            ) : (
              <span className="text-emerald-600 font-medium">All active jobs within schedule</span>
            )}
          </div>
        </div>

        {/* Total Visits Card */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Technician Visits</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalVisits}</div>
          <div className="mt-2 text-[11px] text-slate-500">
            Logged site visits across all branches
          </div>
        </div>

        {/* Expenses & Unpaid Card */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Unpaid Expenses</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono text-slate-900">
            LKR {stats.unpaidExpensesAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            Total Incurred: LKR {stats.totalExpensesAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Jobs Categorised by Status Widget */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Jobs Categorised by Status
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Live breakdown of all {allJobs.length} recorded engineering jobs across statuses
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
            Total: {allJobs.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(stats.statusCounts || {}).map(([statusName, count]) => {
            const lower = statusName.toLowerCase();
            let badgeBg = 'bg-slate-50 border-slate-200 text-slate-800';
            let dotColor = 'bg-slate-400';
            if (lower === 'open') {
              badgeBg = 'bg-blue-50/70 border-blue-200 text-blue-900';
              dotColor = 'bg-blue-500';
            } else if (lower === 'in progress') {
              badgeBg = 'bg-indigo-50/70 border-indigo-200 text-indigo-900';
              dotColor = 'bg-indigo-500';
            } else if (lower === 'pending parts') {
              badgeBg = 'bg-amber-50/70 border-amber-200 text-amber-900';
              dotColor = 'bg-amber-500';
            } else if (lower === 'on hold') {
              badgeBg = 'bg-purple-50/70 border-purple-200 text-purple-900';
              dotColor = 'bg-purple-500';
            } else if (lower === 'pending customer') {
              badgeBg = 'bg-teal-50/70 border-teal-200 text-teal-900';
              dotColor = 'bg-teal-500';
            } else if (lower === 'completed') {
              badgeBg = 'bg-emerald-50/70 border-emerald-200 text-emerald-900';
              dotColor = 'bg-emerald-500';
            } else if (lower === 'cancelled' || lower === 'invalid') {
              badgeBg = 'bg-rose-50/70 border-rose-200 text-rose-900';
              dotColor = 'bg-rose-500';
            }

            return (
              <div
                key={statusName}
                className={`p-3 rounded-xl border ${badgeBg} flex flex-col justify-between transition-all shadow-2xs`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider truncate" title={statusName}>
                    {statusName}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                </div>
                <div className="text-xl font-black font-mono">
                  {count}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {allJobs.length > 0 ? `${Math.round((Number(count) / allJobs.length) * 100)}% of total` : '0%'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technician Daily Worked Hours Widget */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Technician Daily Worked Hours (Calculated from Visits)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Total hours worked per technician per visit date, aggregated from all site visits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={techHoursFilterName}
              onChange={e => setTechHoursFilterName(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Technicians</option>
              {Array.from(new Set(allVisits.map(v => v.technicianName).filter(Boolean))).map(tech => (
                <option key={tech} value={tech}>{tech}</option>
              ))}
            </select>

            <input
              type="date"
              required
              value={techHoursFilterDate}
              onChange={e => {
                if (e.target.value) {
                  setTechHoursFilterDate(e.target.value);
                }
              }}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-mono focus:ring-2 focus:ring-blue-500 w-40"
            />

            {(techHoursFilterName !== 'ALL' || techHoursFilterDate !== (() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            })()) && (
              <button
                type="button"
                onClick={() => {
                  setTechHoursFilterName('ALL');
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setTechHoursFilterDate(`${y}-${m}-${day}`);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        </div>

        {filteredTechnicianDailyHours.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No technician visit hours found matching the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredTechnicianDailyHours.map((item, idx) => {
              const isWarning = item.totalHours < 7;
              const cardBg = isWarning ? 'bg-rose-50/80 border-rose-200 hover:border-rose-300' : 'bg-emerald-50/50 border-emerald-200/80 hover:border-emerald-300';
              const dotColor = isWarning ? 'bg-rose-500' : 'bg-emerald-500';
              const textColor = isWarning ? 'text-rose-700' : 'text-emerald-700';
              const badgeClass = isWarning ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800';

              return (
                <div
                  key={`${item.technicianName}-${item.visitDate}-${idx}`}
                  className={`p-4 rounded-xl border ${cardBg} transition-all flex flex-col justify-between space-y-3 shadow-2xs`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        {item.technicianName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {item.visitDate}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass} font-mono`}>
                      {item.visitsCount} {item.visitsCount === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      {isWarning ? 'Warning (<7h)' : 'Target Met (≥7h)'}
                    </span>
                    <div className={`text-lg font-black font-mono ${textColor} flex items-baseline gap-1`}>
                      {item.totalHours.toFixed(1)} <span className="text-[11px] font-normal text-slate-500 font-sans">hrs</span>
                    </div>
                  </div>

                  {item.visits.length > 0 && (
                    <div className="text-[10px] text-slate-400 space-y-0.5 pt-1">
                      {item.visits.map((v, vIdx) => (
                        <div key={vIdx} className="truncate flex items-center justify-between">
                          <span className="font-mono text-slate-500">{v.visitId} ({v.jobNo})</span>
                          <span className="font-mono font-medium text-slate-700">{v.hours !== null ? `${v.hours}h` : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW DASHBOARD SECTION: All Jobs Directory & Advanced Job Type / Creation Date Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                All Engineering Jobs Directory
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-mono">
                {filteredDashboardJobs.length} of {allJobs.length} Jobs
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Filter all engineering records by <strong>Job Type</strong> and <strong>Creation Date</strong> (This Week, This Month, or Custom Range).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Reset Filters</span>
              </button>
            )}
            <Link
              to="/jobs"
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
            >
              <span>Manage Jobs Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Job Type Filter */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1 text-[11px] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" /> Job Type
            </label>
            <select
              value={jobTypeFilter}
              onChange={e => {
                setJobTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Job Types ({allJobs.length})</option>
              {referenceData.jobTypes.map(jt => {
                const count = allJobs.filter(j => j.jobType.toLowerCase() === jt.toLowerCase()).length;
                return (
                  <option key={jt} value={jt}>
                    {jt} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Creation Date Filter Buttons / Periods */}
          <div className="lg:col-span-2">
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1 text-[11px] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Creation Date Filter
            </label>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'THIS_WEEK', label: 'This Week' },
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'CUSTOM', label: 'Custom Range' }
              ].map(period => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => {
                    setDatePeriod(period.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePeriod === period.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Search Query Input */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1 text-[11px] flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-500" /> Search Records
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Job No, Customer, Machine..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Range Panel (Visible when 'CUSTOM' is selected) */}
        {datePeriod === 'CUSTOM' && (
          <div className="p-4 bg-blue-50/70 border-b border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                Created From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                Created To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Filtered Jobs Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Job No</th>
                <th className="px-4 py-3">Date Created</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Job Type</th>
                <th className="px-4 py-3">Customer & Machine</th>
                <th className="px-4 py-3">Contact Number</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDashboardJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-medium">
                    No engineering jobs found matching the selected Job Type or Creation Date filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedDashboardJobs.map(job => (
                  <tr
                    key={job.jobNo}
                    onClick={() => onSelectJobForDetails(job.jobNo)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {job.jobNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {job.dateCreated}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {job.branch}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {job.jobType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{job.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {job.machineModel || 'N/A'} {job.serialNumber ? `• SN: ${job.serialNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {job.contactNumber ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200/60 font-mono text-xs font-semibold">
                          <Phone className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>{job.contactNumber}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.priority} type="priority" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} type="status" />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSelectJobForDetails(job.jobNo)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Directory Pagination Bar */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredDashboardJobs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Middle Section: Attention Jobs & Branch Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs Requiring Attention (Overdue / High Priority) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Jobs Requiring Attention
              </h3>
              <p className="text-xs text-slate-500">Overdue or nearing expected completion dates</p>
            </div>
            <Link
              to="/jobs"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All Jobs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {stats.attentionJobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                No overdue jobs at this time!
              </div>
            ) : (
              stats.attentionJobs.map(job => (
                <div
                  key={job.jobNo}
                  onClick={() => onSelectJobForDetails(job.jobNo)}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600">{job.jobNo}</span>
                      <StatusBadge status={job.status} type="status" />
                      <StatusBadge status={job.priority} type="priority" />
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{job.customerName}</div>
                    <div className="text-xs text-slate-500">{job.machineModel} • {job.branch}</div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{job.overdueDays} Days Overdue</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Expected: {job.expectedCompletion}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Branch Distribution Widget */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Active Jobs by Branch
          </h3>
          <p className="text-xs text-slate-500 mb-4">Workload across engineering regional service branches</p>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {Object.keys(stats.branchCounts).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active branch data</p>
            ) : (
              Object.entries(stats.branchCounts).map(([branchName, count]) => {
                const percentage = stats.activeJobs > 0 ? Math.round((count / stats.activeJobs) * 100) : 0;
                return (
                  <div key={branchName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{branchName}</span>
                      <span className="font-mono text-slate-900">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Total Active Workload</span>
            <span className="font-bold text-slate-900">{stats.activeJobs} Jobs</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Visits & Quick Operational Sheet Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visits Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Technician Visits</h3>
              <p className="text-xs text-slate-500">Latest field engineer visits recorded in Excel</p>
            </div>
            <Link
              to="/technician-visits"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              All Visits <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Visit ID</th>
                  <th className="px-4 py-2.5">Job No</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5">Visit Date</th>
                  <th className="px-4 py-2.5">Hours</th>
                  <th className="px-4 py-2.5">Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No visits recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentVisits.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">{v.visitId}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-900">{v.jobNo}</td>
                      <td className="px-4 py-2.5 font-medium">{v.technicianName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{v.visitDate}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{v.hours ?? '—'} hrs</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{v.vehicleNumber || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Nav Operational Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Direct Sheet Management
          </h3>
          <p className="text-xs text-slate-500">Navigate directly to operational worksheets:</p>

          <div className="space-y-2">
            <Link
              to="/technicians-assigned"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Technicians Assigned</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              to="/spare-parts-used"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Wrench className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Spare Parts Used</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              to="/expenses"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <Receipt className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Operational Expenses</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
            </Link>

            <Link
              to="/job-closing"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                <CheckCircle className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Job Closing & Sign-off</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
