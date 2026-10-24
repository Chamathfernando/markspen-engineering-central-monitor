export interface JobCalculationInput {
  dateCreated: string;
  expectedCompletion?: string | null;
  status: string;
  todayDateStr?: string;
}

export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function parseDateParts(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10)
  };
}

export function isJobActive(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s !== 'completed' && s !== 'invalid' && s !== 'cancelled' && s !== 'closed';
}

export function isValidJobNumber(jobNo: string | null | undefined): boolean {
  if (!jobNo || typeof jobNo !== 'string') return false;
  const trimmed = jobNo.trim();
  const match = trimmed.match(/^(\d{4})-MPH-(\d{4,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[2], 10);
  return idNum > 0;
}

export function getNextJobNumber(existingJobNos: string[], currentDate: Date = new Date()): string {
  const year = currentDate.getFullYear();
  const prefix = `${year}-MPH-`;

  let maxId = 0;
  for (const raw of existingJobNos) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed.toUpperCase().startsWith(prefix.toUpperCase())) {
      const remainder = trimmed.substring(prefix.length);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
  }

  const nextId = maxId + 1;
  const idStr = String(nextId).padStart(4, '0');
  return `${prefix}${idStr}`;
}

export function isValidVisitId(visitId: string | null | undefined): boolean {
  if (!visitId || typeof visitId !== 'string') return false;
  const trimmed = visitId.trim();
  const match = trimmed.match(/^VISIT-(\d{5,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[1], 10);
  return idNum > 0;
}

export function getNextVisitId(existingVisitIds: string[]): string {
  const prefix = 'VISIT-';
  let maxId = 0;
  for (const raw of existingVisitIds) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.startsWith('VISIT-')) {
      const remainder = trimmed.substring(6);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    } else if (trimmed.startsWith('VIS-')) {
      const remainder = trimmed.substring(4);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
  }

  const nextId = maxId + 1;
  const idStr = String(nextId).padStart(5, '0');
  return `${prefix}${idStr}`;
}

export function isValidExpenseId(expenseId: string | null | undefined): boolean {
  if (!expenseId || typeof expenseId !== 'string') return false;
  const trimmed = expenseId.trim();
  const match = trimmed.match(/^EXP-(\d{5,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[1], 10);
  return idNum > 0;
}

export function getNextExpenseId(existingExpenseIds: string[]): string {
  const prefix = 'EXP-';
  let maxId = 0;
  for (const raw of existingExpenseIds) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.startsWith('EXP-')) {
      const remainder = trimmed.substring(4);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    }
  }

  const nextId = maxId + 1;
  const idStr = String(nextId).padStart(5, '0');
  return `${prefix}${idStr}`;
}

export function getCalendarDayDiff(startDateStr: string, endDateStr: string): number {
  const pStart = parseDateParts(startDateStr);
  const pEnd = parseDateParts(endDateStr);
  if (!pStart || !pEnd) return 0;

  const startUtc = Date.UTC(pStart.year, pStart.month - 1, pStart.day);
  const endUtc = Date.UTC(pEnd.year, pEnd.month - 1, pEnd.day);

  const diffMs = endUtc - startUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function calculateDaysOpen(dateCreated: string, status: string, todayStr?: string): number {
  if (!isJobActive(status)) return 0;
  if (!dateCreated) return 0;

  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(dateCreated, today);
  return Math.max(0, diff);
}

export function calculateOverdueDays(expectedCompletion: string | null | undefined, status: string, todayStr?: string): number {
  if (!isJobActive(status)) return 0;
  if (!expectedCompletion) return 0;

  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(expectedCompletion, today);
  return Math.max(0, diff);
}

export function calculatePendingCustomerDays(followUpDueDate: string | null | undefined, status: string, todayStr?: string): number {
  if (!followUpDueDate || typeof followUpDueDate !== 'string') return 0;
  if (!status || status.trim().toLowerCase() !== 'pending customer') return 0;
  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(followUpDueDate.trim(), today);
  return Math.max(0, diff);
}

export function isPendingCustomerOverdue(followUpDueDate: string | null | undefined, status: string, todayStr?: string): boolean {
  return calculatePendingCustomerDays(followUpDueDate, status, todayStr) > 0;
}

export function calculateVisitHours(actualIn: string | null | undefined, actualOut: string | null | undefined): number | null {
  if (!actualIn || !actualOut) return null;

  const matchIn = actualIn.trim().match(/^(\d{1,2}):(\d{2})$/);
  const matchOut = actualOut.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!matchIn || !matchOut) return null;

  const inMinutes = parseInt(matchIn[1], 10) * 60 + parseInt(matchIn[2], 10);
  let outMinutes = parseInt(matchOut[1], 10) * 60 + parseInt(matchOut[2], 10);

  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  const diffMinutes = outMinutes - inMinutes;
  const hours = diffMinutes / 60;
  return Math.round(hours * 100) / 100;
}

export interface SparePartCalculation {
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  vatAmount: number;
  finalTotal: number;
}

export function calculateSparePartAmounts(
  unitPrice: number,
  qty: number,
  discountPercent: number = 0,
  vatPercent: number = 0
): SparePartCalculation {
  const safeUnitPrice = Math.max(0, Number(unitPrice) || 0);
  const safeQty = Math.max(0, Number(qty) || 0);
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const safeVat = Math.min(100, Math.max(0, Number(vatPercent) || 0));

  const subtotal = Math.round(safeUnitPrice * safeQty * 100) / 100;
  const discountAmount = Math.round((subtotal * safeDiscount / 100) * 100) / 100;
  const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
  const vatAmount = Math.round((discountedSubtotal * safeVat / 100) * 100) / 100;
  const finalTotal = Math.round((discountedSubtotal + vatAmount) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    vatAmount,
    finalTotal
  };
}

export function isManagerEligibleForBranch(managerBranch: string, jobBranch: string): boolean {
  if (!managerBranch || !jobBranch) return false;
  const m = managerBranch.trim().toLowerCase();
  const j = jobBranch.trim().toLowerCase();
  return m === 'head office' || m === 'main' || m === j;
}

export function isTechnicianEligibleForBranch(technicianBranch: string, jobBranch: string): boolean {
  if (!technicianBranch || !jobBranch) return false;
  return technicianBranch.trim().toLowerCase() === jobBranch.trim().toLowerCase();
}
