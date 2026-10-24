import express, { Router, Request, Response } from 'express';
import {
  getWorkbookHealth,
  readReferenceData,
  readJobs,
  addJob,
  updateJob,
  readTechniciansAssigned,
  addTechnicianAssignment,
  updateTechnicianAssignment,
  readTechnicianVisits,
  addTechnicianVisit,
  updateTechnicianVisit,
  readSparePartsUsed,
  addSparePartUsed,
  updateSparePartUsed,
  readExpenses,
  addExpense,
  updateExpense,
  readJobClosures,
  addJobClosure,
  updateJobClosure,
  addManager,
  addTechnician,
  addSparePartToCatalog,
  clearAllJobs,
  clearAllOperationalData
} from '../excel/workbook.ts';
import {
  isJobActive,
  getNextJobNumber,
  getNextVisitId,
  getNextExpenseId,
  formatDate
} from '../excel/calculations.ts';

export const apiRouter = Router();

// Health & Workbook Diagnostics
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await getWorkbookHealth();
    res.json({ ok: true, health });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed health check' });
  }
});

apiRouter.get('/workbook/status', async (_req: Request, res: Response) => {
  try {
    const health = await getWorkbookHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to check status' });
  }
});

// Dynamic Reference Data
apiRouter.get('/reference-data', async (_req: Request, res: Response) => {
  try {
    const data = await readReferenceData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load reference data' });
  }
});

apiRouter.post('/reference-data/refresh', async (_req: Request, res: Response) => {
  try {
    const data = await readReferenceData();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to refresh reference data' });
  }
});

// Employee Management (Managers & Technicians directly to Excel sheets)
apiRouter.post('/employees/managers', async (req: Request, res: Response) => {
  try {
    const manager = await addManager(req.body);
    res.status(201).json({ success: true, data: manager });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to add manager' });
  }
});

apiRouter.post('/employees/technicians', async (req: Request, res: Response) => {
  try {
    const technician = await addTechnician(req.body);
    res.status(201).json({ success: true, data: technician });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to add technician' });
  }
});

// Spare Parts Catalog (Direct write to "Spare parts" sheet in Excel)
apiRouter.post('/spare-parts/catalog', async (req: Request, res: Response) => {
  try {
    const part = await addSparePartToCatalog(req.body);
    res.status(201).json({ success: true, data: part });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to add spare part to catalog' });
  }
});

// Dashboard Insights & Metrics
apiRouter.get('/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    const [jobs, visits, expenses, parts, closures] = await Promise.all([
      readJobs(),
      readTechnicianVisits(),
      readExpenses(),
      readSparePartsUsed(),
      readJobClosures()
    ]);

    const todayStr = formatDate(new Date());

    const activeJobs = jobs.filter(j => isJobActive(j.status));
    const openJobs = jobs.filter(j => j.status.trim().toLowerCase() === 'open');
    const inProgressJobs = jobs.filter(j => j.status.trim().toLowerCase() === 'in progress');
    const onHoldJobs = jobs.filter(j => j.status.trim().toLowerCase() === 'on hold');
    const overdueJobs = jobs.filter(j => isJobActive(j.status) && j.overdueDays > 0);
    const completedJobs = jobs.filter(j => j.status.trim().toLowerCase() === 'completed');

    // Jobs due today or within next 7 days
    const upcomingJobs = activeJobs.filter(j => {
      if (!j.expectedCompletion) return false;
      const ec = j.expectedCompletion.trim();
      return ec >= todayStr;
    });

    // Expenses calculations
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + (e.expenseAmount || 0), 0);
    const unpaidExpensesAmount = expenses
      .filter(e => e.paymentStatus === 'Not Paid')
      .reduce((sum, e) => sum + (e.expenseAmount || 0), 0);

    // Total spare parts cost
    const totalSparePartsAmount = parts.reduce((sum, p) => sum + (p.totalPriceIncVat || 0), 0);

    // Branch breakdown for active jobs
    const branchCounts: Record<string, number> = {};
    activeJobs.forEach(j => {
      const b = j.branch || 'Unassigned';
      branchCounts[b] = (branchCounts[b] || 0) + 1;
    });

    // Status breakdown (initialized with all default statuses to 0)
    const statusCounts: Record<string, number> = {
      'Open': 0,
      'Assigned': 0,
      'In Progress': 0,
      'Pending Parts': 0,
      'Pending Customer': 0,
      'On Hold': 0,
      'Completed': 0,
      'Cancelled': 0,
      'Invalid': 0
    };
    jobs.forEach(j => {
      const s = j.status && j.status.trim() ? j.status.trim() : 'Open';
      // Match case-insensitively or add if new
      const foundKey = Object.keys(statusCounts).find(k => k.toLowerCase() === s.toLowerCase());
      if (foundKey) {
        statusCounts[foundKey] = (statusCounts[foundKey] || 0) + 1;
      } else {
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
    });

    // Priority breakdown
    const priorityCounts: Record<string, number> = {};
    activeJobs.forEach(j => {
      const p = j.priority || 'Medium';
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    });

    res.json({
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      openJobs: openJobs.length,
      inProgressJobs: inProgressJobs.length,
      onHoldJobs: onHoldJobs.length,
      overdueJobs: overdueJobs.length,
      completedJobs: completedJobs.length,
      closedJobs: completedJobs.length, // backwards compatibility alias
      totalVisits: visits.length,
      totalExpensesAmount: Math.round(totalExpensesAmount * 100) / 100,
      unpaidExpensesAmount: Math.round(unpaidExpensesAmount * 100) / 100,
      totalSparePartsAmount: Math.round(totalSparePartsAmount * 100) / 100,
      recentVisits: visits.slice(-5).reverse(),
      attentionJobs: overdueJobs.slice(0, 5),
      upcomingJobs: upcomingJobs.slice(0, 5),
      branchCounts,
      statusCounts,
      priorityCounts,
      pendingCustomerJobs: jobs.filter(j => j.status.trim().toLowerCase() === 'pending customer').length,
      pendingCustomerOverdueJobs: jobs.filter(j => j.status.trim().toLowerCase() === 'pending customer' && (j.pendingCustomerDays || 0) > 0).length
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate dashboard statistics' });
  }
});

// Quick Reports: Pending Customer Past Follow-Up Due Date
apiRouter.get('/reports/pending-customer', async (_req: Request, res: Response) => {
  try {
    const jobs = await readJobs();
    const todayStr = formatDate(new Date());

    const pendingCustomerJobs = jobs.filter(j => j.status.trim().toLowerCase() === 'pending customer');
    // Jobs where current date is past the Follow-Up Due Date (pendingCustomerDays > 0)
    const overdueJobs = pendingCustomerJobs.filter(j => (j.pendingCustomerDays || 0) > 0);

    res.json({
      success: true,
      today: todayStr,
      totalPendingCustomer: pendingCustomerJobs.length,
      overdueCount: overdueJobs.length,
      overdueJobs,
      allPendingCustomerJobs: pendingCustomerJobs
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch pending customer report' });
  }
});

// ----------------------------------------------------
// Jobs Endpoints
// ----------------------------------------------------

apiRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    let jobs = await readJobs();
    const { branch, status, search, activeOnly, priority } = req.query;

    if (activeOnly === 'true') {
      jobs = jobs.filter(j => isJobActive(j.status));
    }

    if (branch && typeof branch === 'string') {
      jobs = jobs.filter(j => j.branch.toLowerCase() === branch.toLowerCase());
    }

    if (status && typeof status === 'string') {
      jobs = jobs.filter(j => j.status.toLowerCase() === status.toLowerCase());
    }

    if (priority && typeof priority === 'string') {
      jobs = jobs.filter(j => j.priority.toLowerCase() === priority.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      jobs = jobs.filter(j =>
        j.jobNo.toLowerCase().includes(s) ||
        j.customerName.toLowerCase().includes(s) ||
        j.machineModel.toLowerCase().includes(s) ||
        j.branch.toLowerCase().includes(s) ||
        j.jobType.toLowerCase().includes(s)
      );
    }

    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read jobs' });
  }
});

apiRouter.delete('/jobs/clear', async (_req: Request, res: Response) => {
  try {
    const result = await clearAllJobs();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to clear jobs worksheet' });
  }
});

apiRouter.delete('/data/clear-operational', async (_req: Request, res: Response) => {
  try {
    const result = await clearAllOperationalData();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to clear operational data' });
  }
});

apiRouter.get('/jobs/next-number', async (_req: Request, res: Response) => {
  try {
    const jobs = await readJobs();
    const nextNo = getNextJobNumber(jobs.map(j => j.jobNo));
    res.json({ nextJobNo: nextNo });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate next job number' });
  }
});

async function handleGetJob(jobNo: string, res: Response) {
  try {
    const jobs = await readJobs();
    const job = jobs.find(j => j.jobNo.toLowerCase() === jobNo.toLowerCase());
    if (!job) {
      res.status(404).json({ error: `Job ${jobNo} not found` });
      return;
    }
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve job' });
  }
}

async function handleGetJobFullDetails(jobNo: string, res: Response) {
  try {
    const [jobs, assigned, visits, parts, expenses, closures] = await Promise.all([
      readJobs(),
      readTechniciansAssigned(),
      readTechnicianVisits(),
      readSparePartsUsed(),
      readExpenses(),
      readJobClosures()
    ]);

    const job = jobs.find(j => j.jobNo.toLowerCase() === jobNo.toLowerCase());
    if (!job) {
      res.status(404).json({ error: `Job ${jobNo} not found` });
      return;
    }

    const jobAssigned = assigned.filter(a => a.jobNo.toLowerCase() === jobNo.toLowerCase());
    const jobVisits = visits.filter(v => v.jobNo.toLowerCase() === jobNo.toLowerCase());
    const jobParts = parts.filter(p => p.jobNo.toLowerCase() === jobNo.toLowerCase());
    const jobExpenses = expenses.filter(e => e.jobNo.toLowerCase() === jobNo.toLowerCase());
    const closure = closures.find(c => c.jobNo.toLowerCase() === jobNo.toLowerCase()) || null;

    res.json({
      job,
      assignedTechnicians: jobAssigned,
      visits: jobVisits,
      sparePartsUsed: jobParts,
      expenses: jobExpenses,
      closure
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch job full details' });
  }
}

apiRouter.get('/jobs/:jobNo', async (req: Request, res: Response) => {
  await handleGetJob(req.params.jobNo, res);
});

apiRouter.get('/jobs/:year/:month/:id', async (req: Request, res: Response) => {
  const jobNo = `${req.params.year}/${req.params.month}/${req.params.id}`;
  await handleGetJob(jobNo, res);
});

apiRouter.get('/jobs/:jobNo/full-details', async (req: Request, res: Response) => {
  await handleGetJobFullDetails(req.params.jobNo, res);
});

apiRouter.get('/jobs/:year/:month/:id/full-details', async (req: Request, res: Response) => {
  const jobNo = `${req.params.year}/${req.params.month}/${req.params.id}`;
  await handleGetJobFullDetails(jobNo, res);
});

apiRouter.post('/jobs', async (req: Request, res: Response) => {
  try {
    const newJob = await addJob(req.body);
    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create job' });
  }
});

apiRouter.put('/jobs/:jobNo', async (req: Request, res: Response) => {
  try {
    const updated = await updateJob(req.params.jobNo, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update job' });
  }
});

// ----------------------------------------------------
// Technicians Assigned Endpoints
// ----------------------------------------------------

apiRouter.get('/technicians-assigned', async (req: Request, res: Response) => {
  try {
    let list = await readTechniciansAssigned();
    if (req.query.jobNo && typeof req.query.jobNo === 'string') {
      list = list.filter(a => a.jobNo.toLowerCase() === (req.query.jobNo as string).toLowerCase());
    }
    if (req.query.branch && typeof req.query.branch === 'string') {
      list = list.filter(a => a.branch.toLowerCase() === (req.query.branch as string).toLowerCase());
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read technician assignments' });
  }
});

apiRouter.post('/technicians-assigned', async (req: Request, res: Response) => {
  try {
    const created = await addTechnicianAssignment(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to assign technician' });
  }
});

apiRouter.put('/technicians-assigned/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateTechnicianAssignment(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update technician assignment' });
  }
});

// ----------------------------------------------------
// Technician Visits Endpoints
// ----------------------------------------------------

apiRouter.get('/technician-visits/next-id', async (_req: Request, res: Response) => {
  try {
    const visits = await readTechnicianVisits();
    const nextId = getNextVisitId(visits.map(v => v.visitId));
    res.json({ nextVisitId: nextId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate next visit ID' });
  }
});

apiRouter.get('/technician-visits', async (req: Request, res: Response) => {
  try {
    let visits = await readTechnicianVisits();
    if (req.query.jobNo && typeof req.query.jobNo === 'string') {
      visits = visits.filter(v => v.jobNo.toLowerCase() === (req.query.jobNo as string).toLowerCase());
    }
    if (req.query.branch && typeof req.query.branch === 'string') {
      visits = visits.filter(v => v.branch.toLowerCase() === (req.query.branch as string).toLowerCase());
    }
    if (req.query.technician && typeof req.query.technician === 'string') {
      visits = visits.filter(v => v.technicianName.toLowerCase() === (req.query.technician as string).toLowerCase());
    }
    res.json(visits);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read technician visits' });
  }
});

apiRouter.post('/technician-visits', async (req: Request, res: Response) => {
  try {
    const created = await addTechnicianVisit(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to record technician visit' });
  }
});

apiRouter.put('/technician-visits/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateTechnicianVisit(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update technician visit' });
  }
});

// ----------------------------------------------------
// Spare Parts Used Endpoints
// ----------------------------------------------------

apiRouter.get('/spare-parts-used', async (req: Request, res: Response) => {
  try {
    let list = await readSparePartsUsed();
    if (req.query.jobNo && typeof req.query.jobNo === 'string') {
      list = list.filter(p => p.jobNo.toLowerCase() === (req.query.jobNo as string).toLowerCase());
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read spare parts' });
  }
});

apiRouter.post('/spare-parts-used', async (req: Request, res: Response) => {
  try {
    const created = await addSparePartUsed(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to record spare part usage' });
  }
});

apiRouter.put('/spare-parts-used/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateSparePartUsed(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update spare part usage' });
  }
});

// ----------------------------------------------------
// Expenses Endpoints
// ----------------------------------------------------

apiRouter.get('/expenses/next-id', async (_req: Request, res: Response) => {
  try {
    const list = await readExpenses();
    const nextId = getNextExpenseId(list.map(e => e.expenseId));
    res.json({ nextExpenseId: nextId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate next expense ID' });
  }
});

apiRouter.get('/expenses', async (req: Request, res: Response) => {
  try {
    let list = await readExpenses();
    if (req.query.jobNo && typeof req.query.jobNo === 'string') {
      list = list.filter(e => e.jobNo.toLowerCase() === (req.query.jobNo as string).toLowerCase());
    }
    if (req.query.branch && typeof req.query.branch === 'string') {
      list = list.filter(e => e.branchChargedTo.toLowerCase() === (req.query.branch as string).toLowerCase());
    }
    if (req.query.paymentStatus && typeof req.query.paymentStatus === 'string') {
      list = list.filter(e => e.paymentStatus.toLowerCase() === (req.query.paymentStatus as string).toLowerCase());
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read expenses' });
  }
});

apiRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const created = await addExpense(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to record expense' });
  }
});

apiRouter.put('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateExpense(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update expense' });
  }
});

// ----------------------------------------------------
// Job Closing Endpoints
// ----------------------------------------------------

apiRouter.get('/job-closing', async (req: Request, res: Response) => {
  try {
    let list = await readJobClosures();
    if (req.query.jobNo && typeof req.query.jobNo === 'string') {
      list = list.filter(c => c.jobNo.toLowerCase() === (req.query.jobNo as string).toLowerCase());
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read job closures' });
  }
});

apiRouter.post('/job-closing', async (req: Request, res: Response) => {
  try {
    const created = await addJobClosure(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to close job' });
  }
});

apiRouter.put('/job-closing/:jobNo', async (req: Request, res: Response) => {
  try {
    const updated = await updateJobClosure(req.params.jobNo, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update job closure' });
  }
});

// ----------------------------------------------------
// App Settings Endpoints (stored in settings.json)
// ----------------------------------------------------
import { readSettings, writeSettings } from '../settings.ts';

apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load settings' });
  }
});

apiRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const updated = await writeSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to save settings' });
  }
});
