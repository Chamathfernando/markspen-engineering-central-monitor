import {
  ReferenceData,
  JobRecord,
  TechnicianAssignment,
  TechnicianVisit,
  SparePartUsedRecord,
  ExpenseRecord,
  JobClosingRecord,
  WorkbookHealth,
  DashboardStats,
  JobFullDetails,
  AppSettings
} from '../types';

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    if (contentType.includes('application/json')) {
      try {
        const errObj = await res.json();
        if (errObj && errObj.error) msg = errObj.error;
      } catch {
        // ignore json parse error
      }
    } else {
      const text = await res.text();
      if (text.includes('<!doctype') || text.includes('<html')) {
        msg = `Server returned HTML page (${res.status}). API route might be missing or failing on server.`;
      }
    }
    throw new Error(msg);
  }

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.includes('<!doctype') || text.includes('<html')) {
      throw new Error(`Expected JSON response, but received HTML page (${res.status}). Ensure API route endpoint is correct.`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Response body is not valid JSON.');
    }
  }

  return res.json();
}

export const api = {
  // Health & Workbook Diagnostics
  getHealth: async (): Promise<{ ok: boolean; health: WorkbookHealth }> => {
    const res = await fetch('/api/health');
    return handleResponse(res);
  },

  getWorkbookStatus: async (): Promise<WorkbookHealth> => {
    const res = await fetch('/api/workbook/status');
    return handleResponse(res);
  },

  // Reference Data
  getReferenceData: async (): Promise<ReferenceData> => {
    const res = await fetch('/api/reference-data');
    return handleResponse(res);
  },

  refreshReferenceData: async (): Promise<{ success: boolean; data: ReferenceData }> => {
    const res = await fetch('/api/reference-data/refresh', { method: 'POST' });
    return handleResponse(res);
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await fetch('/api/dashboard/stats');
    return handleResponse(res);
  },

  // Jobs
  getJobs: async (params?: {
    branch?: string;
    status?: string;
    search?: string;
    activeOnly?: boolean;
    priority?: string;
  }): Promise<JobRecord[]> => {
    const query = new URLSearchParams();
    if (params?.branch) query.append('branch', params.branch);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.activeOnly) query.append('activeOnly', 'true');
    if (params?.priority) query.append('priority', params.priority);

    const res = await fetch(`/api/jobs?${query.toString()}`);
    return handleResponse(res);
  },

  getNextJobNumber: async (): Promise<string> => {
    const res = await fetch('/api/jobs/next-number');
    const data = await handleResponse<{ nextJobNo: string }>(res);
    return data.nextJobNo;
  },

  getJob: async (jobNo: string): Promise<JobRecord> => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobNo)}`);
    return handleResponse(res);
  },

  getJobFullDetails: async (jobNo: string): Promise<JobFullDetails> => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobNo)}/full-details`);
    return handleResponse(res);
  },

  createJob: async (data: Partial<JobRecord>): Promise<JobRecord> => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateJob: async (jobNo: string, data: Partial<JobRecord>): Promise<JobRecord> => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Technicians Assigned
  getTechnicianAssignments: async (jobNo?: string): Promise<TechnicianAssignment[]> => {
    const url = jobNo ? `/api/technicians-assigned?jobNo=${encodeURIComponent(jobNo)}` : '/api/technicians-assigned';
    const res = await fetch(url);
    return handleResponse(res);
  },

  createTechnicianAssignment: async (data: {
    jobNo: string;
    technicianName: string;
    leadTechnician: string;
  }): Promise<TechnicianAssignment> => {
    const res = await fetch('/api/technicians-assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateTechnicianAssignment: async (
    id: string,
    data: { leadTechnician?: string; technicianName?: string }
  ): Promise<TechnicianAssignment> => {
    const res = await fetch(`/api/technicians-assigned/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Technician Visits
  getTechnicianVisits: async (params?: { jobNo?: string; branch?: string }): Promise<TechnicianVisit[]> => {
    const query = new URLSearchParams();
    if (params?.jobNo) query.append('jobNo', params.jobNo);
    if (params?.branch) query.append('branch', params.branch);
    const res = await fetch(`/api/technician-visits?${query.toString()}`);
    return handleResponse(res);
  },

  getNextVisitId: async (): Promise<string> => {
    const res = await fetch('/api/technician-visits/next-id');
    const data = await handleResponse<{ nextVisitId: string }>(res);
    return data.nextVisitId;
  },

  createTechnicianVisit: async (data: Partial<TechnicianVisit>): Promise<TechnicianVisit> => {
    const res = await fetch('/api/technician-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateTechnicianVisit: async (id: string, data: Partial<TechnicianVisit>): Promise<TechnicianVisit> => {
    const res = await fetch(`/api/technician-visits/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Spare Parts Used
  getSparePartsUsed: async (jobNo?: string): Promise<SparePartUsedRecord[]> => {
    const url = jobNo ? `/api/spare-parts-used?jobNo=${encodeURIComponent(jobNo)}` : '/api/spare-parts-used';
    const res = await fetch(url);
    return handleResponse(res);
  },

  createSparePartUsed: async (data: {
    jobNo: string;
    name: string;
    unitPrice: number;
    qty: number;
    discountPercent?: number;
    vatPercent?: number;
  }): Promise<SparePartUsedRecord> => {
    const res = await fetch('/api/spare-parts-used', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateSparePartUsed: async (
    id: string,
    data: { unitPrice?: number; qty?: number; discountPercent?: number; vatPercent?: number; name?: string }
  ): Promise<SparePartUsedRecord> => {
    const res = await fetch(`/api/spare-parts-used/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Expenses
  getExpenses: async (params?: { jobNo?: string; paymentStatus?: string }): Promise<ExpenseRecord[]> => {
    const query = new URLSearchParams();
    if (params?.jobNo) query.append('jobNo', params.jobNo);
    if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    const res = await fetch(`/api/expenses?${query.toString()}`);
    return handleResponse(res);
  },

  getNextExpenseId: async (): Promise<string> => {
    const res = await fetch('/api/expenses/next-id');
    const data = await handleResponse<{ nextExpenseId: string }>(res);
    return data.nextExpenseId;
  },

  createExpense: async (data: Partial<ExpenseRecord>): Promise<ExpenseRecord> => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateExpense: async (id: string, data: Partial<ExpenseRecord>): Promise<ExpenseRecord> => {
    const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Job Closing
  getJobClosures: async (jobNo?: string): Promise<JobClosingRecord[]> => {
    const url = jobNo ? `/api/job-closing?jobNo=${encodeURIComponent(jobNo)}` : '/api/job-closing';
    const res = await fetch(url);
    return handleResponse(res);
  },

  createJobClosure: async (data: Partial<JobClosingRecord>): Promise<JobClosingRecord> => {
    const res = await fetch('/api/job-closing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateJobClosure: async (jobNo: string, data: Partial<JobClosingRecord>): Promise<JobClosingRecord> => {
    const res = await fetch(`/api/job-closing/${encodeURIComponent(jobNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Manage Employees (Managers & Technicians)
  createManager: async (data: { name: string; branch: string; role?: string }): Promise<{ success: boolean; data: { name: string; branch: string; role?: string } }> => {
    const res = await fetch('/api/employees/managers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  createTechnician: async (data: { name: string; branch: string; contact?: string }): Promise<{ success: boolean; data: { name: string; branch: string; contact?: string } }> => {
    const res = await fetch('/api/employees/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Spare Parts Catalog (Sheet: "Spare parts")
  createSparePartInCatalog: async (data: { name: string; category?: string; unitPrice: number }): Promise<{ success: boolean; data: { name: string; category?: string; unitPrice: number } }> => {
    const res = await fetch('/api/spare-parts/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Quick Reports
  getPendingCustomerReport: async (): Promise<{
    success: boolean;
    today: string;
    thresholdDays: number;
    totalPendingCustomer: number;
    overdueCount: number;
    overdueJobs: JobRecord[];
    allPendingCustomerJobs: JobRecord[];
  }> => {
    const res = await fetch('/api/reports/pending-customer');
    return handleResponse(res);
  },

  // App Settings (stored in settings.json)
  getSettings: async (): Promise<AppSettings> => {
    const res = await fetch('/api/settings');
    return handleResponse(res);
  },

  updateSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse(res);
  },

  // Data Wiping & Clearing
  clearAllJobs: async (): Promise<{ success: boolean; count: number }> => {
    const res = await fetch('/api/jobs/clear', { method: 'DELETE' });
    return handleResponse(res);
  },

  clearAllOperationalData: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch('/api/data/clear-operational', { method: 'DELETE' });
    return handleResponse(res);
  }
};
