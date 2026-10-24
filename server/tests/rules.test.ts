import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  isJobActive,
  isValidJobNumber,
  getNextJobNumber,
  calculateDaysOpen,
  calculateOverdueDays,
  calculateVisitHours,
  calculateSparePartAmounts,
  isManagerEligibleForBranch,
  isTechnicianEligibleForBranch
} from '../excel/calculations.ts';

test('Job active definition excludes Completed, Invalid, Cancelled case-insensitively', () => {
  assert.equal(isJobActive('Open'), true);
  assert.equal(isJobActive('In Progress'), true);
  assert.equal(isJobActive('Pending Parts'), true);
  assert.equal(isJobActive('Completed'), false);
  assert.equal(isJobActive('completed'), false);
  assert.equal(isJobActive('COMPLETED '), false);
  assert.equal(isJobActive('Closed'), false);
  assert.equal(isJobActive('Invalid'), false);
  assert.equal(isJobActive('Cancelled'), false);
  assert.equal(isJobActive(' cancelled '), false);
  assert.equal(isJobActive(''), false);
  assert.equal(isJobActive(null), false);
});

test('Job number validation enforces YYYY-MPH-XXXX format', () => {
  assert.equal(isValidJobNumber('2026-MPH-0001'), true);
  assert.equal(isValidJobNumber('2026-MPH-1245'), true);
  assert.equal(isValidJobNumber('2026-mph-0001'), true); // case insensitive
  assert.equal(isValidJobNumber('2026-MPH-000'), false); // < 4 digits
  assert.equal(isValidJobNumber('JOB-2026-01'), false);
  assert.equal(isValidJobNumber('2026/10/001'), false);
  assert.equal(isValidJobNumber(''), false);
});

test('Next job number generator handles empty list and existing IDs for year', () => {
  const fixedDate = new Date(2026, 9, 18); // Oct 2026
  assert.equal(getNextJobNumber([], fixedDate), '2026-MPH-0001');

  const existing = ['2026-MPH-0001', '2026-MPH-0002', '2025-MPH-0015', '2026-MPH-0009'];
  assert.equal(getNextJobNumber(existing, fixedDate), '2026-MPH-0010');

  const gaps = ['2026-MPH-0001', '2026-MPH-0050'];
  assert.equal(getNextJobNumber(gaps, fixedDate), '2026-MPH-0051');
});

test('Days Open calculation excludes inactive jobs and calculates non-negative calendar days', () => {
  // When active
  assert.equal(calculateDaysOpen('2026/10/10', 'Open', '2026/10/18'), 8);
  assert.equal(calculateDaysOpen('2026/10/18', 'In Progress', '2026/10/18'), 0);
  assert.equal(calculateDaysOpen('2026/10/20', 'Open', '2026/10/18'), 0); // future creation date gives 0
  // When inactive
  assert.equal(calculateDaysOpen('2026/10/10', 'Completed', '2026/10/18'), 0);
  assert.equal(calculateDaysOpen('2026/10/10', 'Cancelled', '2026/10/18'), 0);
  assert.equal(calculateDaysOpen('2026/10/10', 'Invalid', '2026/10/18'), 0);
});

test('Overdue Days calculation', () => {
  // When current date is past expected completion
  assert.equal(calculateOverdueDays('2026/10/12', 'Open', '2026/10/18'), 6);
  // When not yet overdue
  assert.equal(calculateOverdueDays('2026/10/25', 'Open', '2026/10/18'), 0);
  // When exactly due today
  assert.equal(calculateOverdueDays('2026/10/18', 'Open', '2026/10/18'), 0);
  // When inactive, always 0
  assert.equal(calculateOverdueDays('2026/10/12', 'Completed', '2026/10/18'), 0);
  assert.equal(calculateOverdueDays('2026/10/12', 'Cancelled', '2026/10/18'), 0);
});

test('Visit hours calculation handles daytime and overnight visits', () => {
  assert.equal(calculateVisitHours('08:30', '17:15'), 8.75);
  assert.equal(calculateVisitHours('09:00', '13:30'), 4.5);
  // Overnight visit: cross midnight (e.g. 22:00 to 06:30)
  assert.equal(calculateVisitHours('22:00', '06:30'), 8.5);
  assert.equal(calculateVisitHours('23:15', '01:45'), 2.5);
  // Missing or invalid
  assert.equal(calculateVisitHours(null, '12:00'), null);
  assert.equal(calculateVisitHours('12:00', ''), null);
});

test('Spare part financial calculations with discount and VAT', () => {
  // Unit price 1000, Qty 2 = 2000 subtotal. Discount 10% = 200 => 1800. VAT 15% on 1800 = 270 => 2070.
  const res = calculateSparePartAmounts(1000, 2, 10, 15);
  assert.equal(res.subtotal, 2000);
  assert.equal(res.discountAmount, 200);
  assert.equal(res.discountedSubtotal, 1800);
  assert.equal(res.vatAmount, 270);
  assert.equal(res.finalTotal, 2070);

  // Fractional quantity and prices
  const fractional = calculateSparePartAmounts(450.50, 3.5, 5, 18);
  assert.equal(fractional.subtotal, 1576.75);
  assert.equal(fractional.discountAmount, 78.84);
  assert.equal(fractional.discountedSubtotal, 1497.91);
  assert.equal(fractional.vatAmount, 269.62);
  assert.equal(fractional.finalTotal, 1767.53);
});

test('Manager and technician branch filtering rules', () => {
  // Manager is eligible if branch matches or manager is from 'Head Office' / 'Main'
  assert.equal(isManagerEligibleForBranch('Head Office', 'Ampara'), true);
  assert.equal(isManagerEligibleForBranch('Head Office', 'Maharagama'), true);
  assert.equal(isManagerEligibleForBranch('Main', 'Maharagama'), true);
  assert.equal(isManagerEligibleForBranch('Kurunegala', 'Kurunegala'), true);
  assert.equal(isManagerEligibleForBranch('Kurunegala', 'Ampara'), false);

  // Technician must match job branch exactly
  assert.equal(isTechnicianEligibleForBranch('Maharagama', 'Maharagama'), true);
  assert.equal(isTechnicianEligibleForBranch('Head Office', 'Maharagama'), false);
  assert.equal(isTechnicianEligibleForBranch('Kurunegala', 'Maharagama'), false);
});
