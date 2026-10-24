/**
 * Core business rules and pure calculations for Markspen Engineering Central Monitor.
 * Decoupled from ExcelJS and DOM for deterministic unit testing.
 */

export interface JobCalculationInput {
  dateCreated: string;
  expectedCompletion?: string | null;
  status: string;
  todayDateStr?: string;
}

/**
 * Format a Date object to YYYY/MM/DD safely without UTC timezone drift.
 */
export function formatDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * Parse a YYYY/MM/DD or YYYY-MM-DD string into year, month, day numbers.
 */
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

/**
 * Check if a status is considered active for operational dropdowns.
 * Inactive statuses: 'Completed', 'Invalid', 'Cancelled' (case-insensitive, trimmed).
 */
export function isJobActive(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s !== 'completed' && s !== 'invalid' && s !== 'cancelled' && s !== 'closed';
}

/**
 * Validates Job Number format: YYYY-MPH-XXXX (e.g. 2026-MPH-0001).
 * XXXX must be positive integer of at least 4 digits.
 */
export function isValidJobNumber(jobNo: string | null | undefined): boolean {
  if (!jobNo || typeof jobNo !== 'string') return false;
  const trimmed = jobNo.trim();
  const match = trimmed.match(/^(\d{4})-MPH-(\d{4,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[2], 10);
  return idNum > 0;
}

/**
 * Generates the next suggested job number for the given year prefix (YYYY-MPH-)
 * based on highest existing numeric ID plus one starting from 0001.
 */
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

/**
 * Validates Visit ID format: VISIT-XXXXX (e.g. VISIT-00001).
 * XXXXX must be a positive integer of at least 5 digits.
 */
export function isValidVisitId(visitId: string | null | undefined): boolean {
  if (!visitId || typeof visitId !== 'string') return false;
  const trimmed = visitId.trim();
  const match = trimmed.match(/^VISIT-(\d{5,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[1], 10);
  return idNum > 0;
}

/**
 * Generates the next suggested visit ID starting from VISIT-00001
 * based on the highest existing numeric suffix plus one.
 */
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

/**
 * Validates Expense ID format: EXP-XXXXX (e.g. EXP-00001).
 * XXXXX must be a positive integer of at least 5 digits.
 */
export function isValidExpenseId(expenseId: string | null | undefined): boolean {
  if (!expenseId || typeof expenseId !== 'string') return false;
  const trimmed = expenseId.trim();
  const match = trimmed.match(/^EXP-(\d{5,})$/i);
  if (!match) return false;
  const idNum = parseInt(match[1], 10);
  return idNum > 0;
}

/**
 * Generates the next suggested expense ID starting from EXP-00001
 * based on the highest existing numeric suffix plus one.
 */
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

/**
 * Calculates calendar day difference between two YYYY/MM/DD dates.
 */
export function getCalendarDayDiff(startDateStr: string, endDateStr: string): number {
  const pStart = parseDateParts(startDateStr);
  const pEnd = parseDateParts(endDateStr);
  if (!pStart || !pEnd) return 0;

  const startUtc = Date.UTC(pStart.year, pStart.month - 1, pStart.day);
  const endUtc = Date.UTC(pEnd.year, pEnd.month - 1, pEnd.day);

  const diffMs = endUtc - startUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates Days Open:
 * - Excludes jobs whose status is 'Invalid', 'Completed', or 'Cancelled'.
 * - Difference in calendar days between Date Created and current local date.
 * - Never returns a negative number.
 */
export function calculateDaysOpen(dateCreated: string, status: string, todayStr?: string): number {
  if (!isJobActive(status)) return 0;
  if (!dateCreated) return 0;

  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(dateCreated, today);
  return Math.max(0, diff);
}

/**
 * Calculates Overdue Days:
 * - Excludes jobs whose status is 'Invalid', 'Completed', or 'Cancelled'.
 * - If current date is later than Expected Completion, calendar days between Expected Completion and current date.
 * - Otherwise returns 0.
 * - Never returns a negative number.
 */
export function calculateOverdueDays(expectedCompletion: string | null | undefined, status: string, todayStr?: string): number {
  if (!isJobActive(status)) return 0;
  if (!expectedCompletion) return 0;

  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(expectedCompletion, today);
  return Math.max(0, diff);
}

/**
 * Calculates days a job in "Pending Customer" status is past its "Follow-Up Due Date".
 * If status is not "Pending Customer" or followUpDueDate is missing, returns 0.
 * Returns positive calendar days past the followUpDueDate (0 if not past due).
 */
export function calculatePendingCustomerDays(followUpDueDate: string | null | undefined, status: string, todayStr?: string): number {
  if (!followUpDueDate || typeof followUpDueDate !== 'string') return 0;
  if (!status || status.trim().toLowerCase() !== 'pending customer') return 0;
  const today = todayStr || formatDate(new Date());
  const diff = getCalendarDayDiff(followUpDueDate.trim(), today);
  return Math.max(0, diff);
}

/**
 * Checks if a job in "Pending Customer" status is past its "Follow-Up Due Date".
 */
export function isPendingCustomerOverdue(followUpDueDate: string | null | undefined, status: string, todayStr?: string): boolean {
  return calculatePendingCustomerDays(followUpDueDate, status, todayStr) > 0;
}

/**
 * Calculates elapsed hours between Actual Time In and Actual Time Out.
 * Supports overnight visits (out < in).
 * Returns rounded to 2 decimal places.
 */
export function calculateVisitHours(actualIn: string | null | undefined, actualOut: string | null | undefined): number | null {
  if (!actualIn || !actualOut) return null;

  const matchIn = actualIn.trim().match(/^(\d{1,2}):(\d{2})$/);
  const matchOut = actualOut.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!matchIn || !matchOut) return null;

  const inMinutes = parseInt(matchIn[1], 10) * 60 + parseInt(matchIn[2], 10);
  let outMinutes = parseInt(matchOut[1], 10) * 60 + parseInt(matchOut[2], 10);

  if (outMinutes < inMinutes) {
    // Overnight visit: cross midnight
    outMinutes += 24 * 60;
  }

  const diffMinutes = outMinutes - inMinutes;
  const hours = diffMinutes / 60;
  return Math.round(hours * 100) / 100;
}

/**
 * Spare Parts calculations:
 * - Subtotal = Unit Price * Qty
 * - Discount Amount = Subtotal * (Discount% / 100)
 * - Discounted Subtotal = Subtotal - Discount Amount
 * - VAT Amount = Discounted Subtotal * (VAT% / 100)
 * - Total Price (Including Vat) = Discounted Subtotal + VAT Amount
 */
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

/**
 * Check if a manager is eligible for a branch:
 * Manager's assigned branch matches job branch OR manager's branch is 'Main'.
 */
export function isManagerEligibleForBranch(managerBranch: string, jobBranch: string): boolean {
  if (!managerBranch || !jobBranch) return false;
  const m = managerBranch.trim().toLowerCase();
  const j = jobBranch.trim().toLowerCase();
  return m === 'head office' || m === 'main' || m === j;
}

/**
 * Check if a technician is eligible for a branch:
 * Technician's branch matches job branch.
 */
export function isTechnicianEligibleForBranch(technicianBranch: string, jobBranch: string): boolean {
  if (!technicianBranch || !jobBranch) return false;
  return technicianBranch.trim().toLowerCase() === jobBranch.trim().toLowerCase();
}
