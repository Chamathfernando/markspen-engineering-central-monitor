import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { JobFullDetails } from '../../types';
import { api } from '../../services/api';
import {
  Briefcase,
  Users,
  CalendarCheck,
  Wrench,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Phone,
  Cpu
} from 'lucide-react';

interface JobDetailModalProps {
  jobNo: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEditJob: () => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  jobNo,
  isOpen,
  onClose,
  onEditJob
}) => {
  const [details, setDetails] = useState<JobFullDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'technicians' | 'visits' | 'parts' | 'expenses' | 'closure'>('overview');

  useEffect(() => {
    if (isOpen && jobNo) {
      setIsLoading(true);
      api.getJobFullDetails(jobNo)
        .then(data => setDetails(data))
        .catch(err => console.error('Failed to load full details:', err))
        .finally(() => setIsLoading(false));
    } else {
      setDetails(null);
    }
  }, [isOpen, jobNo]);

  if (!isOpen) return null;

  const job = details?.job;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={job ? `Job Details — ${job.jobNo}` : 'Job Details'}
      subtitle={job ? `${job.customerName} • ${job.machineModel || 'Equipment'}` : 'Loading...'}
      maxWidth="5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 font-mono">
            {job && `Created: ${job.dateCreated} | Last Updated: ${job.lastUpdated}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditJob();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              Edit Job
            </button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading comprehensive job records from Excel...</p>
        </div>
      ) : !job ? (
        <div className="py-12 text-center text-slate-500 text-sm">Job information could not be loaded.</div>
      ) : (
        <div className="space-y-5">
          {/* Top Banner Status Bar */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={job.status} type="status" />
              <StatusBadge status={job.priority} type="priority" />
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-800">
                Branch: {job.branch}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {job.jobType}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Days Open: <strong className="text-slate-900">{job.daysOpen}</strong></span>
              </div>
              {job.overdueDays > 0 ? (
                <div className="flex items-center gap-1.5 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Overdue: {job.overdueDays} days</span>
                </div>
              ) : (
                <div className="text-slate-500">
                  Due: <strong>{job.expectedCompletion || 'Not specified'}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 gap-1 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'overview', label: 'Overview & Info', icon: Briefcase },
              { id: 'technicians', label: `Assigned Techs (${details?.assignedTechnicians.length || 0})`, icon: Users },
              { id: 'visits', label: `Visits (${details?.visits.length || 0})`, icon: CalendarCheck },
              { id: 'parts', label: `Spare Parts (${details?.sparePartsUsed.length || 0})`, icon: Wrench },
              { id: 'expenses', label: `Expenses (${details?.expenses.length || 0})`, icon: Receipt },
              { id: 'closure', label: details?.closure ? 'Closure Record (Completed)' : 'Closure Status', icon: CheckCircle2 }
            ].map(tab => {
              const Icon = tab.icon;
              const isCurrent = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-2.5 border-b-2 font-medium transition-colors shrink-0 cursor-pointer
                    ${isCurrent
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Information Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-blue-600">
                    <MapPin className="w-4 h-4" /> Customer & Location
                  </h4>
                  <div className="text-xs space-y-1.5 text-slate-700">
                    <div><span className="font-semibold text-slate-500">Name:</span> {job.customerName}</div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-500">Contact:</span>
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.contactNumber || 'None provided'}</span>
                    </div>
                    <div><span className="font-semibold text-slate-500">Address:</span> {job.customerAddress || 'None provided'}</div>
                  </div>
                </div>

                {/* Machine Information Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-indigo-600">
                    <Cpu className="w-4 h-4" /> Machine & Equipment
                  </h4>
                  <div className="text-xs space-y-1.5 text-slate-700">
                    <div><span className="font-semibold text-slate-500">Category:</span> {job.machineCategory || 'Uncategorized'}</div>
                    <div><span className="font-semibold text-slate-500">Model:</span> {job.machineModel || 'Unknown'}</div>
                    <div><span className="font-semibold text-slate-500">Serial No:</span> <span className="font-mono">{job.serialNumber || 'N/A'}</span></div>
                    <div><span className="font-semibold text-slate-500">Installation Date:</span> {job.installationDate || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Technical Issues */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Complaint & Technical Scope
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 block mb-1">Customer Complaint / Requirement:</span>
                    <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap">
                      {job.complaint || 'No complaint notes entered.'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block mb-1">Problem Description (Technical):</span>
                    <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap">
                      {job.problemDescription || 'No detailed technical notes entered.'}
                    </p>
                  </div>
                </div>

                {job.specialInstructions && (
                  <div className="text-xs mt-2">
                    <span className="font-semibold text-slate-500 block mb-1">Special Instructions:</span>
                    <p className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 whitespace-pre-wrap">
                      {job.specialInstructions}
                    </p>
                  </div>
                )}
              </div>

              {/* Pending Customer Alert Banner if applicable */}
              {job.status.trim().toLowerCase() === 'pending customer' && (
                <div className={`p-4 rounded-xl border ${
                  (job.pendingCustomerDays || 0) > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}>
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 shrink-0 text-amber-700" />
                    <div>
                      <span className="font-bold block text-sm">
                        Status: Pending Customer
                      </span>
                      <span className="text-[11px] opacity-90">
                        Follow-Up Due Date: <strong>{job.followUpDueDate || job.pendingCustomerDate || 'N/A'}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full font-extrabold font-mono text-xs ${
                      (job.pendingCustomerDays || 0) > 0
                        ? 'bg-amber-200 text-amber-900 border border-amber-400'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}>
                      {(job.pendingCustomerDays || 0) > 0
                        ? `${job.pendingCustomerDays} Days Past Due`
                        : 'Follow-Up On Schedule'}
                    </span>
                    {(job.pendingCustomerDays || 0) > 0 && (
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider">
                        Past Due
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Management Team */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 text-xs text-center divide-x divide-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Created By</span>
                  <span className="font-bold text-slate-800">{job.createdBy || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sales Person</span>
                  <span className="font-bold text-slate-800">{job.salesPerson || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Coordinator</span>
                  <span className="font-bold text-slate-800">{job.coordinator || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'technicians' && (
            <div className="space-y-3">
              {details?.assignedTechnicians.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No technicians assigned to this job yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Technician Name</th>
                        <th className="px-4 py-2.5">Branch</th>
                        <th className="px-4 py-2.5">Lead Technician</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details?.assignedTechnicians.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{t.technicianName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{t.branch}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${t.leadTechnician === 'Yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {t.leadTechnician}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-3">
              {details?.visits.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No technician visits recorded for this job yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Visit ID</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Technician</th>
                        <th className="px-4 py-2.5">Time In / Out</th>
                        <th className="px-4 py-2.5">Hours</th>
                        <th className="px-4 py-2.5">Work Done</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details?.visits.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">{v.visitId}</td>
                          <td className="px-4 py-2.5">{v.visitDate}</td>
                          <td className="px-4 py-2.5 font-medium">{v.technicianName}</td>
                          <td className="px-4 py-2.5 font-mono">{v.actualTimeIn} – {v.actualTimeOut}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{v.hours ?? 'N/A'} hrs</td>
                          <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={v.workDone}>{v.workDone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'parts' && (
            <div className="space-y-3">
              {details?.sparePartsUsed.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No spare parts recorded for this job.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Part Name</th>
                        <th className="px-4 py-2.5 text-right">Unit Price</th>
                        <th className="px-4 py-2.5 text-right">Qty</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                        <th className="px-4 py-2.5 text-right">Disc %</th>
                        <th className="px-4 py-2.5 text-right">VAT %</th>
                        <th className="px-4 py-2.5 text-right">Total (Inc VAT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {details?.sparePartsUsed.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-sans font-medium text-slate-900">{p.name}</td>
                          <td className="px-4 py-2.5 text-right">LKR {p.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{p.qty}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">LKR {p.totalPriceExVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right">{p.discountPercent}%</td>
                          <td className="px-4 py-2.5 text-right">{p.vatPercent}%</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            LKR {p.totalPriceIncVat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {details?.expenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No expenses recorded for this job.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Expense ID</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Purchased By</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {details?.expenses.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">{e.expenseId}</td>
                          <td className="px-4 py-2.5 font-mono">{e.date}</td>
                          <td className="px-4 py-2.5">{e.expenseCategory}</td>
                          <td className="px-4 py-2.5 font-medium">{e.purchasedBy}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">
                            LKR {e.expenseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={e.paymentStatus} type="payment" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'closure' && (
            <div>
              {details?.closure ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Job Officially Completed
                    </h4>
                    <span className="text-xs font-mono text-slate-500">
                      Completed On: <strong>{details.closure.completionDate}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 pt-2 border-t border-emerald-200/60">
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-slate-500 block mb-1">Work Carried Out:</span>
                        <p className="p-2.5 bg-white rounded border border-slate-200 text-slate-800">
                          {details.closure.workCarriedOut || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500 block mb-1">Remarks / Operational Rationale:</span>
                        <p className="p-2.5 bg-white rounded border border-slate-200 text-slate-800">
                          {details.closure.remarks || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div><span className="font-semibold text-slate-500">Total Work Hours:</span> <span className="font-bold">{details.closure.workHours} hrs</span></div>
                      <div><span className="font-semibold text-slate-500">Customer Acknowledged:</span> {details.closure.customerAcknowledged}</div>
                      <div><span className="font-semibold text-slate-500">Warranty Parts Returned:</span> {details.closure.warrantyPartsReturned}</div>
                      <div><span className="font-semibold text-slate-500">Follow-Up Needed:</span> {details.closure.followUpNeeded}</div>
                      {details.closure.followUpNeeded === 'Yes' && (
                        <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
                          Follow-up Due: <strong>{details.closure.followUpDue}</strong>
                          <p className="mt-1">{details.closure.followUpDetails}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p>This job has not been completed yet. It is currently in active status: <strong>{job.status}</strong>.</p>
                  <p className="text-[11px] text-slate-400">
                    To record completion and synchronize status with the Jobs sheet, visit the Job Closing page.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
