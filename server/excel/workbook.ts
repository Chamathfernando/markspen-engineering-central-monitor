import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import {
  formatDate,
  isJobActive,
  calculateDaysOpen,
  calculateOverdueDays,
  calculateVisitHours,
  calculateSparePartAmounts,
  isValidJobNumber,
  getNextJobNumber,
  getNextVisitId,
  getNextExpenseId,
  calculatePendingCustomerDays,
  isPendingCustomerOverdue
} from './calculations.ts';

import { readSettingsSync } from '../settings.ts';

export const WORKBOOK_FILENAME = 'Markspen_Engineering_Central_Monitor.xlsx';

export function getWorkbookPath(): string {
  const settings = readSettingsSync();
  const raw = settings.workbookPath || 'data/Markspen_Engineering_Central_Monitor.xlsx';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

export function getBackupPath(): string {
  const settings = readSettingsSync();
  const raw = settings.backupPath || 'data/Markspen_Engineering_Central_Monitor.backup.xlsx';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

// Operational sheet names
export const SHEET_JOBS = 'Jobs';
export const SHEET_TECH_ASSIGNED = 'Technicians Assigned';
export const SHEET_TECH_VISITS = 'Technician Visits';
export const SHEET_SPARE_PARTS = 'Spare Parts Used';
export const SHEET_EXPENSES = 'Expenses';
export const SHEET_JOB_CLOSING = 'Job Closing';

// Reference sheet names (read-only)
export const SHEET_BRANCHES = 'Branches';
export const SHEET_JOB_TYPES = 'Job Types';
export const SHEET_EXPENSE_CATS = 'Expense Categories';
export const SHEET_STATUS = 'Status';
export const SHEET_TECHNICIANS = 'Technicians';
export const SHEET_MANAGERS = 'Managers';
export const SHEET_VEHICLE_TYPES = 'Vehicle Types';
export const SHEET_VEHICLES = 'Vehicles '; // Trailing space preserved!
export const SHEET_SPARE_CATALOG = 'Spare parts';

// In-memory status & stats
let lastReadTime: string | null = null;
let lastWriteTime: string | null = null;
let hasCreatedBackupThisSession = false;
let fileOperationError: string | null = null;

// Write lock queue
let writeLockPromise = Promise.resolve();

export function withWorkbookLock<T>(action: () => Promise<T>): Promise<T> {
  const result = writeLockPromise.then(async () => {
    try {
      return await action();
    } catch (err: any) {
      fileOperationError = err?.message || String(err);
      throw err;
    }
  });
  writeLockPromise = result.then(() => {}, () => {});
  return result;
}

export interface WorkbookHealth {
  status: 'connected' | 'error' | 'initializing';
  filePath: string;
  backupPath: string;
  exists: boolean;
  backupExists: boolean;
  fileSizeBytes: number;
  lastRead: string | null;
  lastWrite: string | null;
  backupCreated: boolean;
  lastError: string | null;
  sheetCounts: Record<string, number>;
}

/**
 * Extracts clean string value from an Excel cell (handles formulas, dates, rich text, numbers)
 */
export function getCellValue(cell: ExcelJS.Cell | undefined): any {
  if (!cell || cell.value === null || cell.value === undefined) return '';

  const val = cell.value;
  if (typeof val === 'object') {
    if (val instanceof Date) {
      return formatDate(val);
    }
    if ('formula' in val) {
      return val.result !== undefined && val.result !== null ? val.result : '';
    }
    if ('text' in val) {
      return (val as any).text;
    }
    if ('richText' in val) {
      return (val as any).richText.map((t: any) => t.text).join('');
    }
  }
  return val;
}

export function getCellString(cell: ExcelJS.Cell | undefined): string {
  const val = getCellValue(cell);
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function getCellNumber(cell: ExcelJS.Cell | undefined): number {
  const val = getCellValue(cell);
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export const DEFAULT_BRANCHES = [
  'Ampara',
  'Anuradhapura',
  'Kurunegala',
  'Embilipitiya',
  'Polonnaruwa',
  'Maharagama',
  'Kilinochchi',
  'Head Office'
];

export const DEFAULT_JOB_TYPES = [
  'Breakdown',
  'Service',
  'Installation',
  'Inspection',
  'Modification',
  'Commissioning',
  'Warranty',
  'Other'
];

export const DEFAULT_STATUSES = [
  'Open',
  'Assigned',
  'In Progress',
  'Pending Parts',
  'Pending Customer',
  'On Hold',
  'Completed',
  'Cancelled',
  'Invalid'
];

const defaultTechnicians = [
  ['Kamal Perera', 'Head Office', '+94 77 123 4567'],
  ['Nuwan Jayasinghe', 'Head Office', '+94 71 234 5678'],
  ['Suneth Bandara', 'Maharagama', '+94 77 345 6789'],
  ['Dinesh Fernando', 'Maharagama', '+94 76 456 7890'],
  ['Chamara Wickramasinghe', 'Kurunegala', '+94 71 012 3456'],
  ['Kasun Wijesinghe', 'Kurunegala', '+94 70 567 8901'],
  ['Ruwan Silva', 'Anuradhapura', '+94 78 678 9012'],
  ['Chathura Senanayake', 'Polonnaruwa', '+94 75 789 0123'],
  ['Sajith Rathnayake', 'Ampara', '+94 72 890 1234'],
  ['Tharindu Alwis', 'Embilipitiya', '+94 77 901 2345'],
  ['Asanka Gunawardena', 'Kilinochchi', '+94 76 123 4568']
];

const defaultManagers = [
  ['Samantha Mendis', 'Head Office', 'Operations Director'],
  ['Lasantha Jayakody', 'Head Office', 'Service Coordinator'],
  ['Rohan de Silva', 'Head Office', 'Senior Sales Manager'],
  ['Priyantha Kumara', 'Maharagama', 'Maharagama Branch Manager'],
  ['Harsha Jayawardena', 'Kurunegala', 'Kurunegala Branch Manager'],
  ['Anura Ranatunga', 'Anuradhapura', 'Anuradhapura Branch Manager'],
  ['Manoj Weerasinghe', 'Polonnaruwa', 'Polonnaruwa Branch Manager'],
  ['Duminda Rajapaksha', 'Ampara', 'Ampara Branch Manager'],
  ['Nalaka Perera', 'Embilipitiya', 'Embilipitiya Branch Manager'],
  ['Sivakumar Thangarajah', 'Kilinochchi', 'Kilinochchi Branch Manager']
];

const defaultVehicles = [
  ['WP CAD-8921', 'Double Cab', 'Maharagama'],
  ['WP CAR-4155', 'Delivery Van', 'Maharagama'],
  ['NW PB-1890', 'Utility Pickup', 'Kurunegala'],
  ['NC NA-7240', 'Crew Cab', 'Anuradhapura'],
  ['NC LF-3312', 'Utility Pickup', 'Polonnaruwa'],
  ['EP QH-5520', 'Double Cab', 'Ampara'],
  ['SP LY-6632', 'Light Truck (Lorry)', 'Embilipitiya'],
  ['NP KX-9901', 'Delivery Van', 'Kilinochchi'],
  ['WP BAC-2204', 'Double Cab', 'Head Office']
];

export function syncReferenceDataSheets(wb: ExcelJS.Workbook): boolean {
  let changed = false;

  // 1. Branches
  let wsBranches = wb.getWorksheet(SHEET_BRANCHES);
  if (!wsBranches) {
    wsBranches = wb.addWorksheet(SHEET_BRANCHES);
    wsBranches.columns = [{ header: 'Branch', key: 'branch', width: 20 }];
  }
  const currentBranches: string[] = [];
  wsBranches.eachRow((r, i) => { if (i > 1) { const val = getCellString(r.getCell(1)); if (val) currentBranches.push(val); } });
  if (JSON.stringify(currentBranches) !== JSON.stringify(DEFAULT_BRANCHES)) {
    while (wsBranches.rowCount > 1) {
      wsBranches.spliceRows(2, 1);
    }
    DEFAULT_BRANCHES.forEach(b => wsBranches!.addRow([b]));
    changed = true;
  }

  // 2. Job Types
  let wsJobTypes = wb.getWorksheet(SHEET_JOB_TYPES);
  if (!wsJobTypes) {
    wsJobTypes = wb.addWorksheet(SHEET_JOB_TYPES);
    wsJobTypes.columns = [{ header: 'Job Type', key: 'jobType', width: 25 }];
  }
  const currentJobTypes: string[] = [];
  wsJobTypes.eachRow((r, i) => { if (i > 1) { const val = getCellString(r.getCell(1)); if (val) currentJobTypes.push(val); } });
  if (JSON.stringify(currentJobTypes) !== JSON.stringify(DEFAULT_JOB_TYPES)) {
    while (wsJobTypes.rowCount > 1) {
      wsJobTypes.spliceRows(2, 1);
    }
    DEFAULT_JOB_TYPES.forEach(jt => wsJobTypes!.addRow([jt]));
    changed = true;
  }

  // 3. Status
  let wsStatus = wb.getWorksheet(SHEET_STATUS);
  if (!wsStatus) {
    wsStatus = wb.addWorksheet(SHEET_STATUS);
    wsStatus.columns = [{ header: 'Status', key: 'status', width: 20 }];
  }
  const currentStatuses: string[] = [];
  wsStatus.eachRow((r, i) => { if (i > 1) { const val = getCellString(r.getCell(1)); if (val) currentStatuses.push(val); } });
  if (JSON.stringify(currentStatuses) !== JSON.stringify(DEFAULT_STATUSES)) {
    while (wsStatus.rowCount > 1) {
      wsStatus.spliceRows(2, 1);
    }
    DEFAULT_STATUSES.forEach(s => wsStatus!.addRow([s]));
    changed = true;
  }

  // 4. Update Technicians branches if old branches exist
  let wsTechs = wb.getWorksheet(SHEET_TECHNICIANS);
  if (wsTechs && wsTechs.rowCount <= 1) {
    defaultTechnicians.forEach(t => wsTechs!.addRow(t));
    changed = true;
  } else if (wsTechs) {
    const branchMap: Record<string, string> = {
      'Main': 'Head Office',
      'Colombo': 'Maharagama',
      'Kandy': 'Anuradhapura',
      'Galle': 'Ampara',
      'Gampaha': 'Polonnaruwa'
    };
    wsTechs.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const b = getCellString(row.getCell(2));
      if (branchMap[b]) {
        row.getCell(2).value = branchMap[b];
        changed = true;
      }
    });
  }

  // 5. Update Managers branches
  let wsManagers = wb.getWorksheet(SHEET_MANAGERS);
  if (wsManagers && wsManagers.rowCount <= 1) {
    defaultManagers.forEach(m => wsManagers!.addRow(m));
    changed = true;
  } else if (wsManagers) {
    const branchMap: Record<string, string> = {
      'Main': 'Head Office',
      'Colombo': 'Maharagama',
      'Kandy': 'Anuradhapura',
      'Galle': 'Ampara',
      'Gampaha': 'Polonnaruwa'
    };
    wsManagers.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const b = getCellString(row.getCell(2));
      if (branchMap[b]) {
        row.getCell(2).value = branchMap[b];
        changed = true;
      }
    });
  }

  // 6. Update Vehicles branches
  const wsVehicles = wb.getWorksheet(SHEET_VEHICLES) || wb.getWorksheet(SHEET_VEHICLES.trim());
  if (wsVehicles && wsVehicles.rowCount <= 1) {
    defaultVehicles.forEach(v => wsVehicles!.addRow(v));
    changed = true;
  } else if (wsVehicles) {
    const branchMap: Record<string, string> = {
      'Main': 'Head Office',
      'Colombo': 'Maharagama',
      'Kandy': 'Anuradhapura',
      'Galle': 'Ampara',
      'Gampaha': 'Polonnaruwa'
    };
    wsVehicles.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const b = getCellString(row.getCell(3));
      if (branchMap[b]) {
        row.getCell(3).value = branchMap[b];
        changed = true;
      }
    });
  }

  // 7. Update existing Jobs branch/type if needed
  const wsJobs = wb.getWorksheet(SHEET_JOBS);
  if (wsJobs) {
    const branchMap: Record<string, string> = {
      'Main': 'Head Office',
      'Colombo': 'Maharagama',
      'Kandy': 'Anuradhapura',
      'Galle': 'Ampara',
      'Gampaha': 'Polonnaruwa'
    };
    const typeMap: Record<string, string> = {
      'Breakdown Repair': 'Breakdown',
      'Preventive Maintenance': 'Service',
      'Warranty Service': 'Warranty',
      'Inspection & Assessment': 'Inspection',
      'Machine Overhaul': 'Modification',
      'Calibration & Testing': 'Commissioning'
    };
    wsJobs.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const b = getCellString(row.getCell(3));
      if (branchMap[b]) {
        row.getCell(3).value = branchMap[b];
        changed = true;
      }
      const jt = getCellString(row.getCell(4));
      if (typeMap[jt]) {
        row.getCell(4).value = typeMap[jt];
        changed = true;
      }
      // Migrate status 'Closed' to 'Completed'
      const st = getCellString(row.getCell(24));
      if (st.toLowerCase() === 'closed') {
        row.getCell(24).value = 'Completed';
        changed = true;
      }
      // Update formulas to use "completed"
      const fCol22 = row.getCell(22).value;
      if (typeof fCol22 === 'object' && fCol22 && 'formula' in fCol22 && typeof (fCol22 as any).formula === 'string') {
        if ((fCol22 as any).formula.includes('"closed"')) {
          (fCol22 as any).formula = (fCol22 as any).formula.replace(/"closed"/g, '"completed"');
          changed = true;
        }
      }
      const fCol23 = row.getCell(23).value;
      if (typeof fCol23 === 'object' && fCol23 && 'formula' in fCol23 && typeof (fCol23 as any).formula === 'string') {
        if ((fCol23 as any).formula.includes('"closed"')) {
          (fCol23 as any).formula = (fCol23 as any).formula.replace(/"closed"/g, '"completed"');
          changed = true;
        }
      }
    });
  }

  // 8. Migrate Job Closing status 'Closed' to 'Completed'
  const wsJobClosing = wb.getWorksheet(SHEET_JOB_CLOSING);
  if (wsJobClosing) {
    wsJobClosing.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const st = getCellString(row.getCell(14));
      if (st.toLowerCase() === 'closed') {
        row.getCell(14).value = 'Completed';
        changed = true;
      }
    });
  }

  return changed;
}

/**
 * Ensures the workbook exists. If absent, builds it with all 14 worksheets,
 * exact headers, professional styling, reference data and seed demo records.
 */
export async function ensureWorkbook(): Promise<void> {
  const workbookPath = getWorkbookPath();
  const backupPath = getBackupPath();

  // Ensure parent directories exist
  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });

  // Automatic Root File Sync: If root workbook file exists and was modified more recently than workbookPath, copy it over
  const legacyRootPath = path.join(process.cwd(), WORKBOOK_FILENAME);
  if (fs.existsSync(legacyRootPath)) {
    let rootStatMs = 0;
    try { rootStatMs = fs.statSync(legacyRootPath).mtimeMs; } catch {}

    let targetStatMs = 0;
    if (fs.existsSync(workbookPath)) {
      try { targetStatMs = fs.statSync(workbookPath).mtimeMs; } catch {}
    }

    if (!fs.existsSync(workbookPath) || rootStatMs > targetStatMs + 1000) {
      try {
        fs.copyFileSync(legacyRootPath, workbookPath);
        console.log(`[Workbook] Synchronized updated root Excel file -> ${workbookPath}`);
      } catch (err) {
        console.warn('[Workbook] Root file sync warning:', err);
      }
    }
  }

  const legacyBackupPath = path.join(process.cwd(), 'Markspen_Engineering_Central_Monitor.backup.xlsx');
  if (!fs.existsSync(backupPath) && fs.existsSync(legacyBackupPath)) {
    try {
      fs.renameSync(legacyBackupPath, backupPath);
      console.log(`[Workbook] Migrated root backup file to configured backup path: ${backupPath}`);
    } catch (err) {
      console.warn('[Workbook] Legacy backup migration warning:', err);
    }
  }

  if (fs.existsSync(workbookPath)) {
    // If not backed up yet this session, create backup
    if (!hasCreatedBackupThisSession) {
      try {
        fs.copyFileSync(workbookPath, backupPath);
        hasCreatedBackupThisSession = true;
      } catch (err) {
        console.warn('Could not create initial session backup:', err);
      }
    }

    // Synchronize reference data sheets with the requested values
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(workbookPath);
      const changed = syncReferenceDataSheets(wb);
      if (changed) {
        await saveWorkbook(wb);
        console.log('[Workbook] Reference data sheets synchronized with latest specifications.');
      }
    } catch (err) {
      console.warn('Reference sync error on startup:', err);
    }
    return;
  }

  console.log(`[Workbook] File not found at ${workbookPath}. Generating initial authoritative workbook...`);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Markspen Engineering Central Monitor';
  wb.created = new Date();

  // 1. Reference: Branches
  const wsBranches = wb.addWorksheet(SHEET_BRANCHES);
  wsBranches.columns = [{ header: 'Branch', key: 'branch', width: 20 }];
  DEFAULT_BRANCHES.forEach(b => wsBranches.addRow([b]));

  // 2. Reference: Job Types
  const wsJobTypes = wb.addWorksheet(SHEET_JOB_TYPES);
  wsJobTypes.columns = [{ header: 'Job Type', key: 'jobType', width: 25 }];
  DEFAULT_JOB_TYPES.forEach(jt => wsJobTypes.addRow([jt]));

  // 3. Reference: Expense Categories
  const wsExpenseCats = wb.addWorksheet(SHEET_EXPENSE_CATS);
  wsExpenseCats.columns = [{ header: 'Expense Category', key: 'cat', width: 25 }];
  const expenseCats = [
    'Travel & Transport',
    'Fuel & Petrol',
    'Accommodation / Lodging',
    'Meals & Food',
    'Consumables & Fasteners',
    'Tools & Equipment Hire',
    'Courier & Freight',
    'Emergency Local Purchase',
    'Toll & Parking',
    'Miscellaneous'
  ];
  expenseCats.forEach(c => wsExpenseCats.addRow([c]));

  // 4. Reference: Status
  const wsStatus = wb.addWorksheet(SHEET_STATUS);
  wsStatus.columns = [{ header: 'Status', key: 'status', width: 20 }];
  DEFAULT_STATUSES.forEach(s => wsStatus.addRow([s]));

  // 5. Reference: Technicians
  const wsTechs = wb.addWorksheet(SHEET_TECHNICIANS);
  wsTechs.columns = [
    { header: 'Technician Name', key: 'name', width: 25 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Contact Number', key: 'contact', width: 20 }
  ];
  defaultTechnicians.forEach(t => wsTechs.addRow(t));

  // 6. Reference: Managers
  const wsManagers = wb.addWorksheet(SHEET_MANAGERS);
  wsManagers.columns = [
    { header: 'Manager Name', key: 'name', width: 25 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Role', key: 'role', width: 25 }
  ];
  defaultManagers.forEach(m => wsManagers.addRow(m));

  // 7. Reference: Vehicle Types
  const wsVehTypes = wb.addWorksheet(SHEET_VEHICLE_TYPES);
  wsVehTypes.columns = [{ header: 'Vehicle Type', key: 'type', width: 25 }];
  const vehTypes = [
    'Double Cab',
    'Single Cab',
    'Delivery Van',
    'Light Truck (Lorry)',
    'Crew Cab',
    'Utility Pickup',
    'Motorcycle'
  ];
  vehTypes.forEach(vt => wsVehTypes.addRow([vt]));

  // 8. Reference: Vehicles (with trailing space in sheet name)
  const wsVehicles = wb.addWorksheet(SHEET_VEHICLES);
  wsVehicles.columns = [
    { header: 'Vehicle Number', key: 'num', width: 20 },
    { header: 'Vehicle Type', key: 'type', width: 20 },
    { header: 'Branch', key: 'branch', width: 20 }
  ];
  defaultVehicles.forEach(v => wsVehicles.addRow(v));

  // 9. Reference: Spare parts
  const wsParts = wb.addWorksheet(SHEET_SPARE_CATALOG);
  wsParts.columns = [
    { header: 'Name', key: 'name', width: 40 },
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Unit Price', key: 'price', width: 18 }
  ];
  const parts = [
    ['Deep Groove Ball Bearing 6205-2RS', 'Bearings', 2450.00],
    ['Taper Roller Bearing 32208', 'Bearings', 6800.00],
    ['Angular Contact Ball Bearing 7210', 'Bearings', 8900.00],
    ['Spherical Roller Bearing 22212 EK', 'Bearings', 14200.00],
    ['High Temperature Viton Oil Seal 45x65x10', 'Seals & Gaskets', 1850.00],
    ['Mechanical Shaft Seal 25mm Ceramic/Carbon', 'Seals & Gaskets', 4200.00],
    ['Spiral Wound Flange Gasket 2" ANSI 150', 'Seals & Gaskets', 2100.00],
    ['Nitril Rubber O-Ring Kit (382 Pcs Assortment)', 'Seals & Gaskets', 7500.00],
    ['Three-Phase Contactor 32A 230V Coil', 'Electrical', 7500.00],
    ['Thermal Overload Relay 18-25A', 'Electrical', 6200.00],
    ['Miniature Circuit Breaker 3P 40A', 'Electrical', 5800.00],
    ['Solid State Relay 40A 480V AC', 'Electrical', 4900.00],
    ['Digital Temperature Controller PID 220V', 'Automation & Sensors', 14500.00],
    ['PT100 RTD Temperature Sensor 2m Cable', 'Automation & Sensors', 3800.00],
    ['Proximity Sensor Inductive M18 NPN', 'Automation & Sensors', 3200.00],
    ['Optical Rotary Encoder 1024 PPR 24V', 'Automation & Sensors', 18500.00],
    ['Heavy Duty Pressure Gauge 0-25 Bar Glycerin', 'Instrumentation', 4100.00],
    ['Solenoid Valve 24V DC 1/2" Brass Direct Acting', 'Pneumatics & Hydraulics', 8400.00],
    ['Pneumatic Cylinder 50mm Bore 150mm Stroke', 'Pneumatics & Hydraulics', 16800.00],
    ['Air Filter Regulator Lubricator Unit FRL 1/2"', 'Pneumatics & Hydraulics', 11500.00],
    ['Hydraulic Filter Cartridge 10 Micron', 'Pneumatics & Hydraulics', 7200.00],
    ['High Pressure Hydraulic Hose 1/2" 2-Wire (3m)', 'Pneumatics & Hydraulics', 6500.00],
    ['Timing Belt HTD 8M-1200 Heavy Duty', 'Transmission', 5400.00],
    ['V-Belt B-64 Industrial High-Tension', 'Transmission', 2900.00],
    ['Flexible Jaw Coupling Ø35mm Aluminum', 'Transmission', 4600.00],
    ['Spur Gear Module 2.5 36 Teeth Steel', 'Transmission', 9200.00],
    ['Oil Mist Separator Filter Element', 'Filtration', 12000.00],
    ['Carbon Vane Set for Vacuum Pump (4 Pcs)', 'Pumps & Compressors', 18500.00],
    ['Centrifugal Pump Impeller Bronze Ø160mm', 'Pumps & Compressors', 24000.00],
    ['Cooling Fan 230V AC 120mm Ball Bearing', 'Cooling & Ventilation', 3400.00],
    ['Motor Capacitor 45µF 450V Round', 'Electrical', 1950.00],
    ['Variable Frequency Drive 2.2kW 3-Phase', 'Drives & Controls', 48000.00],
    ['Emergency Stop Switch Push-Lock Turn-Reset', 'Safety Controls', 2200.00],
    ['Limit Switch Heavy Duty Roller Lever IP67', 'Safety Controls', 3600.00]
  ];
  parts.forEach(p => wsParts.addRow(p));

  // Style all reference sheets header row
  [wsBranches, wsJobTypes, wsExpenseCats, wsStatus, wsTechs, wsManagers, wsVehTypes, wsVehicles, wsParts].forEach(ws => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    row.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // 10. Operational Sheet: Jobs
  const wsJobs = wb.addWorksheet(SHEET_JOBS);
  const jobsHeaders = [
    'Job No', 'Date Created', 'Branch', 'Job Type', 'Customer Name',
    'Contact Number', 'Customer Address', 'Machine Category', 'Machine Model', 'Serial Number',
    'Installation Date', 'Complaint / Requirement', 'Warehouse Delivery Date', 'Problem Description',
    'Priority', 'Expected Completion', 'Special Instructions', 'Created By', 'Sales Person',
    'Coordinator', 'Last Updated', 'Days Open', 'Overdue Days', 'Status'
  ];
  wsJobs.addRow(jobsHeaders);
  const jobsHeaderRow = wsJobs.getRow(1);
  jobsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  jobsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // 11. Operational Sheet: Technicians Assigned
  const wsTechAssigned = wb.addWorksheet(SHEET_TECH_ASSIGNED);
  wsTechAssigned.addRow(['Job No', 'Branch', 'Technician Name', 'Lead Technician']);
  const techAssignedHeader = wsTechAssigned.getRow(1);
  techAssignedHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  techAssignedHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // 12. Operational Sheet: Technician Visits
  const wsTechVisits = wb.addWorksheet(SHEET_TECH_VISITS);
  wsTechVisits.addRow([
    'Visit Id', 'Job No', 'Branch', 'Technician Name', 'Visit Date',
    'Scheduled Arrival', 'Actual Time In', 'Actual Time Out', 'Hours', 'Work Done',
    'Outcome', 'Coordinator', 'Vehicle Type', 'Vehicle Number', 'Updated Date'
  ]);
  const visitsHeader = wsTechVisits.getRow(1);
  visitsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  visitsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // 13. Operational Sheet: Spare Parts Used
  const wsPartsUsed = wb.addWorksheet(SHEET_SPARE_PARTS);
  wsPartsUsed.addRow([
    'Job No', 'Name', 'Unit Price ', 'Qty', 'Tota Price (Excluding Vat)',
    'Discount (%)', 'Total Price After Discount (Excluding Vat)', 'Vat (%)', 'Total Price (Including Vat)'
  ]);
  const partsUsedHeader = wsPartsUsed.getRow(1);
  partsUsedHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  partsUsedHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // 14. Operational Sheet: Expenses
  const wsExpenses = wb.addWorksheet(SHEET_EXPENSES);
  wsExpenses.addRow([
    'Expense Id', 'Job No', 'Date', 'Purchased By', 'Branch Charged To',
    'Expense Category', 'Description', 'Supplier', 'Expense Amount', 'Receipt',
    'Approved By', 'Entered By', 'Payment Status'
  ]);
  const expensesHeader = wsExpenses.getRow(1);
  expensesHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  expensesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // 15. Operational Sheet: Job Closing
  const wsJobClosing = wb.addWorksheet(SHEET_JOB_CLOSING);
  wsJobClosing.addRow([
    'Job No', 'Branch', 'Completion Date', 'Work Carried Out', 'Work Hours',
    'Customer Acknowledged', 'Warranty Parts Returned', 'Follow-Up Needed', 'Follow-Up Details',
    'Follow-Up Due', 'Approved By', 'Updated By', 'Updated Date', 'Status'
  ]);
  const closingHeader = wsJobClosing.getRow(1);
  closingHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  closingHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  // Add realistic initial seed records so the dashboard and tables have immediately visible operational data!
  const todayStr = formatDate(new Date());

  // Job 1: In Progress in Colombo
  const r2 = wsJobs.addRow([
    '2026/10/001', '2026/10/12', 'Colombo', 'Breakdown Repair', 'Lanka Weaving Mills Ltd',
    '+94 11 234 5678', '45 Industrial Zone, Ratmalana', 'Textile Machinery', 'Rapier Loom RF-800', 'SN-88231',
    '2026/10/12', 'Main spindle motor abnormal vibration and drive fault', '2026/10/12', 'Drive error code E-04 with motor overheating',
    'High', '2026/10/22', 'Check grounding and motor insulation resistance before replacing drive',
    'Samantha Mendis', 'Rohan de Silva', 'Lasantha Jayakody', todayStr,
    { formula: 'IF(OR(ISBLANK(B2),TRIM(LOWER(X2))="completed",TRIM(LOWER(X2))="invalid",TRIM(LOWER(X2))="cancelled"),0,MAX(0,TODAY()-B2))', result: 6 },
    { formula: 'IF(OR(ISBLANK(P2),TRIM(LOWER(X2))="completed",TRIM(LOWER(X2))="invalid",TRIM(LOWER(X2))="cancelled"),0,MAX(0,TODAY()-P2))', result: 0 },
    'In Progress'
  ]);

  // Job 2: Open in Kandy
  wsJobs.addRow([
    '2026/10/002', '2026/10/14', 'Kandy', 'Preventive Maintenance', 'Highland Tea Processing Factory',
    '+94 81 223 3445', 'Peradeniya Road, Kandy', 'Tea Processing Dryers', 'Rotary Drier RD-3000', 'SN-44109',
    '2026/10/15', 'Scheduled bi-annual inspection of bearings and heating elements', '2026/10/15', 'Normal scheduled maintenance protocol',
    'Medium', '2026/10/24', 'Carry spare bearings and grease guns',
    'Samantha Mendis', 'Rohan de Silva', 'Lasantha Jayakody', todayStr,
    { formula: 'IF(OR(ISBLANK(B3),TRIM(LOWER(X3))="completed",TRIM(LOWER(X3))="invalid",TRIM(LOWER(X3))="cancelled"),0,MAX(0,TODAY()-B3))', result: 4 },
    { formula: 'IF(OR(ISBLANK(P3),TRIM(LOWER(X3))="completed",TRIM(LOWER(X3))="invalid",TRIM(LOWER(X3))="cancelled"),0,MAX(0,TODAY()-P3))', result: 0 },
    'Open'
  ]);

  // Job 3: Completed in Galle
  wsJobs.addRow([
    '2026/10/003', '2026/10/05', 'Galle', 'Installation', 'Southern Marine Engineering',
    '+94 91 334 5566', 'Harbour Approach Road, Galle', 'Hydraulic Winches', 'Electro-Hydraulic Winch EH-50', 'SN-10293',
    '2026/10/06', 'New installation and commissioning of hydraulic power unit', '2026/10/06', 'New machine installation',
    'Medium', '2026/10/10', 'Test under load before handover',
    'Samantha Mendis', 'Rohan de Silva', 'Lasantha Jayakody', '2026/10/10',
    { formula: 'IF(OR(ISBLANK(B4),TRIM(LOWER(X4))="completed",TRIM(LOWER(X4))="invalid",TRIM(LOWER(X4))="cancelled"),0,MAX(0,TODAY()-B4))', result: 0 },
    { formula: 'IF(OR(ISBLANK(P4),TRIM(LOWER(X4))="completed",TRIM(LOWER(X4))="invalid",TRIM(LOWER(X4))="cancelled"),0,MAX(0,TODAY()-P4))', result: 0 },
    'Completed'
  ]);

  // Technicians Assigned seed
  wsTechAssigned.addRow(['2026/10/001', 'Colombo', 'Suneth Bandara', 'Yes']);
  wsTechAssigned.addRow(['2026/10/001', 'Colombo', 'Dinesh Fernando', 'No']);
  wsTechAssigned.addRow(['2026/10/002', 'Kandy', 'Ruwan Silva', 'Yes']);
  wsTechAssigned.addRow(['2026/10/003', 'Galle', 'Sajith Rathnayake', 'Yes']);

  // Technician Visits seed
  wsTechVisits.addRow([
    'VIS-101', '2026/10/001', 'Colombo', 'Suneth Bandara', '2026/10/13',
    '2026/10/13 08:30', '08:30', '16:00', 7.5, 'Inspected drive controller and checked stator winding resistance.',
    'Identified faulty contactor and cooling fan.', 'Lasantha Jayakody', 'Double Cab', 'WP CAD-8921', todayStr
  ]);
  wsTechVisits.addRow([
    'VIS-102', '2026/10/003', 'Galle', 'Sajith Rathnayake', '2026/10/08',
    '2026/10/08 09:00', '09:00', '17:30', 8.5, 'Full installation of hydraulic pump and pressure test.',
    'System commissioned successfully.', 'Lasantha Jayakody', 'Double Cab', 'SP QH-5520', '2026/10/08'
  ]);

  // Spare Parts Used seed
  wsPartsUsed.addRow([
    '2026/10/001', 'Three-Phase Contactor 32A 230V Coil', 7500.00, 1,
    { formula: 'ROUND(C2*D2, 2)', result: 7500.00 },
    10,
    { formula: 'ROUND(E2-(E2*F2/100), 2)', result: 6750.00 },
    18,
    { formula: 'ROUND(G2+(G2*H2/100), 2)', result: 7965.00 }
  ]);
  wsPartsUsed.addRow([
    '2026/10/001', 'Cooling Fan 230V AC 120mm Ball Bearing', 3400.00, 2,
    { formula: 'ROUND(C3*D3, 2)', result: 6800.00 },
    5,
    { formula: 'ROUND(E3-(E3*F3/100), 2)', result: 6460.00 },
    18,
    { formula: 'ROUND(G3+(G3*H3/100), 2)', result: 7622.80 }
  ]);

  // Expenses seed
  wsExpenses.addRow([
    'EXP-2026-001', '2026/10/001', '2026/10/13', 'Suneth Bandara', 'Colombo',
    'Travel & Transport', 'Highway toll and fuel for technician visit to Ratmalana', 'Ceypetco Fuel Station',
    4850.00, 'RCP-9941', 'Samantha Mendis', 'Lasantha Jayakody', 'Paid'
  ]);
  wsExpenses.addRow([
    'EXP-2026-002', '2026/10/001', '2026/10/13', 'Dinesh Fernando', 'Colombo',
    'Consumables & Fasteners', 'Cable lugs and heat shrink sleeves', 'Electro Supplies Colombo',
    1250.00, 'RCP-9952', 'Samantha Mendis', 'Lasantha Jayakody', 'Not Paid'
  ]);

  // Job Closing seed (for 2026/10/003)
  wsJobClosing.addRow([
    '2026/10/003', 'Galle', '2026/10/10', 'Installation and pressure testing completed. Client handover signed.',
    8.5, 'Yes', 'No', 'No', '', '', 'Samantha Mendis', 'Lasantha Jayakody', '2026/10/10', 'Completed'
  ]);

  // Auto-fit column widths cleanly
  [wsJobs, wsTechAssigned, wsTechVisits, wsPartsUsed, wsExpenses, wsJobClosing].forEach(ws => {
    ws.columns.forEach((col: any) => {
      let maxLen = 12;
      col.eachCell({ includeEmpty: false }, (cell: any) => {
        const str = String(cell.value || '');
        if (str.length > maxLen) maxLen = Math.min(str.length + 3, 40);
      });
      col.width = maxLen;
    });
  });

  await saveWorkbook(wb);
  const initialPath = getWorkbookPath();
  const initialBackup = getBackupPath();
  console.log(`[Workbook] Initial workbook created successfully at ${initialPath}`);

  // Create initial backup
  if (fs.existsSync(initialPath)) {
    try {
      fs.copyFileSync(initialPath, initialBackup);
      hasCreatedBackupThisSession = true;
    } catch {}
  }
}

/**
 * Loads the ExcelJS workbook from disk
 */
export async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  await ensureWorkbook();
  const workbookPath = getWorkbookPath();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(workbookPath);
  lastReadTime = new Date().toISOString();
  fileOperationError = null;
  return wb;
}

/**
 * Saves workbook to disk safely with backup
 */
export async function saveWorkbook(wb: ExcelJS.Workbook): Promise<void> {
  const workbookPath = getWorkbookPath();
  const backupPath = getBackupPath();

  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });

  if (!hasCreatedBackupThisSession && fs.existsSync(workbookPath)) {
    try {
      fs.copyFileSync(workbookPath, backupPath);
      hasCreatedBackupThisSession = true;
    } catch (e) {
      console.warn('Backup creation failed:', e);
    }
  }

  // Write via in-memory buffer first to ensure completed output before saving
  const tempPath = `${workbookPath}.tmp`;
  try {
    const buffer = await wb.xlsx.writeBuffer();
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    fs.renameSync(tempPath, workbookPath);
  } catch (err) {
    console.warn('[Workbook] Temp file rename write failed, attempting direct write:', err);
    try {
      const buffer = await wb.xlsx.writeBuffer();
      fs.writeFileSync(workbookPath, Buffer.from(buffer));
    } catch (fallbackErr) {
      console.error('[Workbook] Direct file write failed:', fallbackErr);
      throw fallbackErr;
    }
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }

  lastWriteTime = new Date().toISOString();
  fileOperationError = null;
}

/**
 * Health check & diagnostic status
 */
export async function getWorkbookHealth(): Promise<WorkbookHealth> {
  const workbookPath = getWorkbookPath();
  const backupPath = getBackupPath();

  const exists = fs.existsSync(workbookPath);
  const backupExists = fs.existsSync(backupPath);
  let fileSizeBytes = 0;
  const sheetCounts: Record<string, number> = {};

  if (exists) {
    try {
      const stats = fs.statSync(workbookPath);
      fileSizeBytes = stats.size;
      const wb = await loadWorkbook();
      wb.worksheets.forEach(ws => {
        sheetCounts[ws.name] = Math.max(0, ws.rowCount - 1);
      });
    } catch (err: any) {
      fileOperationError = err?.message || String(err);
    }
  }

  return {
    status: fileOperationError ? 'error' : exists ? 'connected' : 'initializing',
    filePath: workbookPath,
    backupPath: backupPath,
    exists,
    backupExists,
    fileSizeBytes,
    lastRead: lastReadTime,
    lastWrite: lastWriteTime,
    backupCreated: hasCreatedBackupThisSession,
    lastError: fileOperationError,
    sheetCounts
  };
}

/**
 * Read reference data dynamically from workbook without hardcoding
 */
export interface ReferenceData {
  branches: string[];
  jobTypes: string[];
  expenseCategories: string[];
  statuses: string[];
  technicians: Array<{ name: string; branch: string; contact?: string }>;
  managers: Array<{ name: string; branch: string; role?: string }>;
  vehicleTypes: string[];
  vehicles: Array<{ number: string; type: string; branch: string }>;
  spareParts: Array<{ name: string; category?: string; unitPrice?: number }>;
}

export async function readReferenceData(): Promise<ReferenceData> {
  const wb = await loadWorkbook();

  // 1. Branches
  const wsBranches = wb.getWorksheet(SHEET_BRANCHES);
  const branches: string[] = [];
  wsBranches?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const val = getCellString(row.getCell(1));
    if (val && !branches.includes(val)) branches.push(val);
  });

  // 2. Job Types
  const wsJobTypes = wb.getWorksheet(SHEET_JOB_TYPES);
  const jobTypes: string[] = [];
  wsJobTypes?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const val = getCellString(row.getCell(1));
    if (val && !jobTypes.includes(val)) jobTypes.push(val);
  });

  // 3. Expense Categories
  const wsExpenseCats = wb.getWorksheet(SHEET_EXPENSE_CATS);
  const expenseCategories: string[] = [];
  wsExpenseCats?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const val = getCellString(row.getCell(1));
    if (val && !expenseCategories.includes(val)) expenseCategories.push(val);
  });

  // 4. Status
  const wsStatus = wb.getWorksheet(SHEET_STATUS);
  const statuses: string[] = [];
  wsStatus?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const val = getCellString(row.getCell(1));
    if (val && !statuses.includes(val)) statuses.push(val);
  });

  // 5. Technicians
  const wsTechs = wb.getWorksheet(SHEET_TECHNICIANS);
  const technicians: Array<{ name: string; branch: string; contact?: string }> = [];
  wsTechs?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = getCellString(row.getCell(1));
    const branch = getCellString(row.getCell(2));
    const contact = getCellString(row.getCell(3));
    if (name) technicians.push({ name, branch, contact });
  });

  // 6. Managers
  const wsManagers = wb.getWorksheet(SHEET_MANAGERS);
  const managers: Array<{ name: string; branch: string; role?: string }> = [];
  wsManagers?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = getCellString(row.getCell(1));
    const branch = getCellString(row.getCell(2));
    const role = getCellString(row.getCell(3));
    if (name) managers.push({ name, branch, role });
  });

  // 7. Vehicle Types
  const wsVehTypes = wb.getWorksheet(SHEET_VEHICLE_TYPES);
  const vehicleTypes: string[] = [];
  wsVehTypes?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const val = getCellString(row.getCell(1));
    if (val && !vehicleTypes.includes(val)) vehicleTypes.push(val);
  });

  // 8. Vehicles (with trailing space)
  const wsVehicles = wb.getWorksheet(SHEET_VEHICLES) || wb.getWorksheet(SHEET_VEHICLES.trim());
  const vehicles: Array<{ number: string; type: string; branch: string }> = [];
  wsVehicles?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const number = getCellString(row.getCell(1));
    const type = getCellString(row.getCell(2));
    const branch = getCellString(row.getCell(3));
    if (number) vehicles.push({ number, type, branch });
  });

  // 9. Spare parts
  const wsParts = wb.getWorksheet(SHEET_SPARE_CATALOG);
  const spareParts: Array<{ name: string; category?: string; unitPrice?: number }> = [];
  wsParts?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = getCellString(row.getCell(1));
    const category = getCellString(row.getCell(2));
    const unitPrice = getCellNumber(row.getCell(3));
    if (name) spareParts.push({ name, category, unitPrice });
  });

  return {
    branches,
    jobTypes,
    expenseCategories,
    statuses,
    technicians,
    managers,
    vehicleTypes,
    vehicles,
    spareParts
  };
}

export async function addManager(data: { name: string; branch: string; role?: string }): Promise<{ name: string; branch: string; role?: string }> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    let ws = wb.getWorksheet(SHEET_MANAGERS);
    if (!ws) {
      ws = wb.addWorksheet(SHEET_MANAGERS);
      ws.columns = [
        { header: 'Manager Name', key: 'name', width: 25 },
        { header: 'Branch', key: 'branch', width: 20 },
        { header: 'Role', key: 'role', width: 25 }
      ];
    }
    const cleanName = data.name.trim();
    const cleanBranch = data.branch.trim();
    const cleanRole = (data.role || '').trim();
    if (!cleanName) throw new Error('Manager name is required');
    if (!cleanBranch) throw new Error('Branch is required');

    let exists = false;
    ws.eachRow((r, i) => {
      if (i > 1 && getCellString(r.getCell(1)).toLowerCase() === cleanName.toLowerCase()) {
        exists = true;
      }
    });
    if (exists) {
      throw new Error(`Manager "${cleanName}" already exists in the Managers sheet.`);
    }

    ws.addRow([cleanName, cleanBranch, cleanRole]);
    await saveWorkbook(wb);
    return { name: cleanName, branch: cleanBranch, role: cleanRole };
  });
}

export async function addTechnician(data: { name: string; branch: string; contact?: string }): Promise<{ name: string; branch: string; contact?: string }> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    let ws = wb.getWorksheet(SHEET_TECHNICIANS);
    if (!ws) {
      ws = wb.addWorksheet(SHEET_TECHNICIANS);
      ws.columns = [
        { header: 'Technician Name', key: 'name', width: 25 },
        { header: 'Branch', key: 'branch', width: 20 },
        { header: 'Contact Number', key: 'contact', width: 20 }
      ];
    }
    const cleanName = data.name.trim();
    const cleanBranch = data.branch.trim();
    const cleanContact = (data.contact || '').trim();
    if (!cleanName) throw new Error('Technician name is required');
    if (!cleanBranch) throw new Error('Branch is required');

    let exists = false;
    ws.eachRow((r, i) => {
      if (i > 1 && getCellString(r.getCell(1)).toLowerCase() === cleanName.toLowerCase()) {
        exists = true;
      }
    });
    if (exists) {
      throw new Error(`Technician "${cleanName}" already exists in the Technicians sheet.`);
    }

    ws.addRow([cleanName, cleanBranch, cleanContact]);
    await saveWorkbook(wb);
    return { name: cleanName, branch: cleanBranch, contact: cleanContact };
  });
}

export async function addSparePartToCatalog(data: { name: string; category?: string; unitPrice: number }): Promise<{ name: string; category?: string; unitPrice: number }> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    let ws = wb.getWorksheet(SHEET_SPARE_CATALOG) || wb.getWorksheet('Spare Parts') || wb.getWorksheet('Spare parts');
    if (!ws) {
      ws = wb.addWorksheet(SHEET_SPARE_CATALOG);
      ws.columns = [
        { header: 'Name', key: 'name', width: 35 },
        { header: 'Category', key: 'category', width: 25 },
        { header: 'Unit Price', key: 'unitPrice', width: 15 }
      ];
    }
    const cleanName = (data.name || '').trim();
    const cleanCat = (data.category || '').trim();
    const cleanPrice = Math.max(0, Number(data.unitPrice) || 0);

    if (!cleanName) throw new Error('Spare part name is required');

    let exists = false;
    ws.eachRow((r, i) => {
      if (i > 1 && getCellString(r.getCell(1)).toLowerCase() === cleanName.toLowerCase()) {
        exists = true;
      }
    });
    if (exists) {
      throw new Error(`Spare part "${cleanName}" already exists in the catalog.`);
    }

    ws.addRow([cleanName, cleanCat, cleanPrice]);
    await saveWorkbook(wb);
    return { name: cleanName, category: cleanCat, unitPrice: cleanPrice };
  });
}

// ----------------------------------------------------
// Operational Data Types & Readers
// ----------------------------------------------------

export interface JobRecord {
  jobNo: string;
  dateCreated: string;
  branch: string;
  jobType: string;
  customerName: string;
  contactNumber: string;
  customerAddress: string;
  machineCategory: string;
  machineModel: string;
  serialNumber: string;
  installationDate: string;
  complaint: string;
  warehouseDeliveryDate: string;
  problemDescription: string;
  priority: string;
  expectedCompletion: string;
  specialInstructions: string;
  createdBy: string;
  salesPerson: string;
  coordinator: string;
  lastUpdated: string;
  daysOpen: number;
  overdueDays: number;
  status: string;
  followUpDueDate?: string;
  pendingCustomerDate?: string;
  pendingCustomerDays?: number;
  rowNumber?: number;
}

export async function readJobs(): Promise<JobRecord[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_JOBS);
  if (!ws) return [];

  const todayStr = formatDate(new Date());
  const jobs: JobRecord[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const jobNo = getCellString(row.getCell(1));
    if (!jobNo) return;

    const dateCreated = getCellString(row.getCell(2));
    const expectedCompletion = getCellString(row.getCell(16));
    const status = getCellString(row.getCell(24)) || 'Open';
    const followUpDueDate = getCellString(row.getCell(25));

    // Backend derived values computed for immediate accurate display
    const daysOpen = calculateDaysOpen(dateCreated, status, todayStr);
    const overdueDays = calculateOverdueDays(expectedCompletion, status, todayStr);
    const pendingCustomerDays = calculatePendingCustomerDays(followUpDueDate, status, todayStr);

    jobs.push({
      jobNo,
      dateCreated,
      branch: getCellString(row.getCell(3)),
      jobType: getCellString(row.getCell(4)),
      customerName: getCellString(row.getCell(5)),
      contactNumber: getCellString(row.getCell(6)),
      customerAddress: getCellString(row.getCell(7)),
      machineCategory: getCellString(row.getCell(8)),
      machineModel: getCellString(row.getCell(9)),
      serialNumber: getCellString(row.getCell(10)),
      installationDate: getCellString(row.getCell(11)),
      complaint: getCellString(row.getCell(12)),
      warehouseDeliveryDate: getCellString(row.getCell(13)),
      problemDescription: getCellString(row.getCell(14)),
      priority: getCellString(row.getCell(15)) || 'Medium',
      expectedCompletion,
      specialInstructions: getCellString(row.getCell(17)),
      createdBy: getCellString(row.getCell(18)),
      salesPerson: getCellString(row.getCell(19)),
      coordinator: getCellString(row.getCell(20)),
      lastUpdated: getCellString(row.getCell(21)) || dateCreated,
      daysOpen,
      overdueDays,
      status,
      followUpDueDate,
      pendingCustomerDate: followUpDueDate,
      pendingCustomerDays,
      rowNumber
    });
  });

  return jobs;
}

export async function addJob(data: Partial<JobRecord>): Promise<JobRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_JOBS);
    if (!ws) throw new Error(`Worksheet ${SHEET_JOBS} not found`);

    const existingJobs = await readJobs();
    const existingJobNos = existingJobs.map(j => j.jobNo);

    // Job number validation
    let jobNo = data.jobNo ? data.jobNo.trim() : '';
    if (!jobNo) {
      jobNo = getNextJobNumber(existingJobNos);
    } else {
      if (!isValidJobNumber(jobNo)) {
        throw new Error(`Invalid Job No format "${jobNo}". Must be YYYY-MPH-XXXX (e.g. 2026-MPH-0001).`);
      }
      if (existingJobNos.some(existing => existing.toLowerCase() === jobNo.toLowerCase())) {
        throw new Error(`Job No "${jobNo}" already exists. Please choose a unique job number.`);
      }
    }

    const todayStr = formatDate(new Date());
    const dateCreated = todayStr;
    const lastUpdated = todayStr;

    // Validate mandatory fields
    if (!data.branch || !data.branch.trim()) throw new Error("Branch is mandatory when creating a job.");
    if (!data.jobType || !data.jobType.trim()) throw new Error("Job Type is mandatory when creating a job.");
    if (!data.customerName || !data.customerName.trim()) throw new Error("Customer Name is mandatory when creating a job.");
    if (!data.contactNumber || !data.contactNumber.trim()) throw new Error("Contact Number is mandatory when creating a job.");
    if (!data.customerAddress || !data.customerAddress.trim()) throw new Error("Customer Address / Location is mandatory when creating a job.");
    if (!data.createdBy || !data.createdBy.trim()) throw new Error("Created By is mandatory when creating a job.");
    if (!data.salesPerson || !data.salesPerson.trim()) throw new Error("Sales Person is mandatory when creating a job.");
    if (!data.coordinator || !data.coordinator.trim()) throw new Error("Coordinator is mandatory when creating a job.");
    if (!data.status || !data.status.trim()) throw new Error("Status is mandatory when creating a job.");
    if (!data.installationDate || !data.installationDate.trim()) throw new Error("Installation Date is mandatory when creating a job.");
    if (!data.warehouseDeliveryDate || !data.warehouseDeliveryDate.trim()) throw new Error("Warehouse Delivery Date is mandatory when creating a job.");
    if (!data.expectedCompletion || !data.expectedCompletion.trim()) throw new Error("Expected Completion Date is mandatory when creating a job.");

    const CLOSING_MANAGED_STATUSES = [
      'pending parts',
      'on hold',
      'cancelled',
      'invalid',
      'pending customer',
      'completed',
      'closed'
    ];

    if (data.status && CLOSING_MANAGED_STATUSES.includes(data.status.trim().toLowerCase())) {
      throw new Error(`Cannot set job status to '${data.status.trim()}' directly. Status '${data.status.trim()}' is updated exclusively when a record is added or edited in the Job Closing tab.`);
    }
    const status = data.status.trim();
    const isPendingCust = status.toLowerCase() === 'pending customer';
    const pendingCustomerDate = isPendingCust
      ? (data.pendingCustomerDate && data.pendingCustomerDate.trim() ? data.pendingCustomerDate.trim() : todayStr)
      : '';

    const rowNum = ws.rowCount + 1;
    const daysOpen = calculateDaysOpen(dateCreated, status, todayStr);
    const overdueDays = calculateOverdueDays(data.expectedCompletion || '', status, todayStr);
    const pendingCustomerDays = calculatePendingCustomerDays(pendingCustomerDate, status, todayStr);

    // Write row preserving Excel formulas
    ws.addRow([
      jobNo,
      dateCreated,
      data.branch || '',
      data.jobType || '',
      data.customerName || '',
      data.contactNumber || '',
      data.customerAddress || '',
      data.machineCategory || '',
      data.machineModel || '',
      data.serialNumber || '',
      data.installationDate || '',
      data.complaint || '',
      data.warehouseDeliveryDate || '',
      data.problemDescription || '',
      data.priority || 'Medium',
      data.expectedCompletion || '',
      data.specialInstructions || '',
      data.createdBy || '',
      data.salesPerson || '',
      data.coordinator || '',
      lastUpdated,
      { formula: `IF(OR(ISBLANK(B${rowNum}),TRIM(LOWER(X${rowNum}))="completed",TRIM(LOWER(X${rowNum}))="invalid",TRIM(LOWER(X${rowNum}))="cancelled"),0,MAX(0,TODAY()-B${rowNum}))`, result: daysOpen },
      { formula: `IF(OR(ISBLANK(P${rowNum}),TRIM(LOWER(X${rowNum}))="completed",TRIM(LOWER(X${rowNum}))="invalid",TRIM(LOWER(X${rowNum}))="cancelled"),0,MAX(0,TODAY()-P${rowNum}))`, result: overdueDays },
      status,
      pendingCustomerDate
    ]);

    await saveWorkbook(wb);

    return {
      jobNo,
      dateCreated,
      branch: data.branch || '',
      jobType: data.jobType || '',
      customerName: data.customerName || '',
      contactNumber: data.contactNumber || '',
      customerAddress: data.customerAddress || '',
      machineCategory: data.machineCategory || '',
      machineModel: data.machineModel || '',
      serialNumber: data.serialNumber || '',
      installationDate: data.installationDate || '',
      complaint: data.complaint || '',
      warehouseDeliveryDate: data.warehouseDeliveryDate || '',
      problemDescription: data.problemDescription || '',
      priority: data.priority || 'Medium',
      expectedCompletion: data.expectedCompletion || '',
      specialInstructions: data.specialInstructions || '',
      createdBy: data.createdBy || '',
      salesPerson: data.salesPerson || '',
      coordinator: data.coordinator || '',
      lastUpdated,
      daysOpen,
      overdueDays,
      status,
      pendingCustomerDate,
      pendingCustomerDays,
      rowNumber: rowNum
    };
  });
}

export async function updateJob(jobNoToUpdate: string, data: Partial<JobRecord>): Promise<JobRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_JOBS);
    if (!ws) throw new Error(`Worksheet ${SHEET_JOBS} not found`);

    let targetRow: ExcelJS.Row | null = null;
    let foundRowNum = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const jNo = getCellString(row.getCell(1));
      if (jNo.toLowerCase() === jobNoToUpdate.trim().toLowerCase()) {
        targetRow = row;
        foundRowNum = rowNumber;
      }
    });

    if (!targetRow || foundRowNum === 0) {
      throw new Error(`Job "${jobNoToUpdate}" not found in workbook.`);
    }

    const row = targetRow as ExcelJS.Row;
    const dateCreated = getCellString(row.getCell(2));
    const todayStr = formatDate(new Date());

    // Validate mandatory fields when updated
    if (data.branch !== undefined && !data.branch.trim()) throw new Error("Branch is mandatory when editing a job.");
    if (data.jobType !== undefined && !data.jobType.trim()) throw new Error("Job Type is mandatory when editing a job.");
    if (data.customerName !== undefined && !data.customerName.trim()) throw new Error("Customer Name is mandatory when editing a job.");
    if (data.contactNumber !== undefined && !data.contactNumber.trim()) throw new Error("Contact Number is mandatory when editing a job.");
    if (data.customerAddress !== undefined && !data.customerAddress.trim()) throw new Error("Customer Address / Location is mandatory when editing a job.");
    if (data.createdBy !== undefined && !data.createdBy.trim()) throw new Error("Created By is mandatory when editing a job.");
    if (data.salesPerson !== undefined && !data.salesPerson.trim()) throw new Error("Sales Person is mandatory when editing a job.");
    if (data.coordinator !== undefined && !data.coordinator.trim()) throw new Error("Coordinator is mandatory when editing a job.");
    if (data.status !== undefined && !data.status.trim()) throw new Error("Status is mandatory when editing a job.");
    if (data.installationDate !== undefined && !data.installationDate.trim()) throw new Error("Installation Date is mandatory when editing a job.");
    if (data.warehouseDeliveryDate !== undefined && !data.warehouseDeliveryDate.trim()) throw new Error("Warehouse Delivery Date is mandatory when editing a job.");
    if (data.expectedCompletion !== undefined && !data.expectedCompletion.trim()) throw new Error("Expected Completion Date is mandatory when editing a job.");

    const currentStatus = getCellString(row.getCell(24));
    const currentStatusLower = currentStatus.trim().toLowerCase();

    if (currentStatusLower === 'completed' || currentStatusLower === 'closed') {
      throw new Error(`Job "${jobNoToUpdate}" is marked as "${currentStatus}" and cannot be modified. Completed job records are permanently locked.`);
    }

    let status = data.status !== undefined ? data.status.trim() : currentStatus;
    const requestedStatusLower = status.toLowerCase();

    const CLOSING_MANAGED_STATUSES = [
      'pending parts',
      'on hold',
      'cancelled',
      'invalid',
      'pending customer',
      'completed',
      'closed'
    ];

    if (CLOSING_MANAGED_STATUSES.includes(currentStatusLower)) {
      if (data.status !== undefined && data.status.trim().toLowerCase() !== currentStatusLower) {
        throw new Error(`Cannot modify status directly from the Jobs tab when job status is "${currentStatus}". Status for "${currentStatus}" jobs is managed exclusively via the Job Closing tab.`);
      }
    }

    if (data.status && CLOSING_MANAGED_STATUSES.includes(data.status.trim().toLowerCase()) && currentStatusLower !== data.status.trim().toLowerCase()) {
      throw new Error(`Cannot set job status to "${data.status.trim()}" directly. Status "${data.status.trim()}" is updated exclusively when a record is added or edited in the Job Closing tab.`);
    }

    const expectedCompletion = data.expectedCompletion !== undefined ? data.expectedCompletion : getCellString(row.getCell(16));
    const daysOpen = calculateDaysOpen(dateCreated, status, todayStr);
    const overdueDays = calculateOverdueDays(expectedCompletion, status, todayStr);

    if (data.branch !== undefined) row.getCell(3).value = data.branch;
    if (data.jobType !== undefined) row.getCell(4).value = data.jobType;
    if (data.customerName !== undefined) row.getCell(5).value = data.customerName;
    if (data.contactNumber !== undefined) row.getCell(6).value = data.contactNumber;
    if (data.customerAddress !== undefined) row.getCell(7).value = data.customerAddress;
    if (data.machineCategory !== undefined) row.getCell(8).value = data.machineCategory;
    if (data.machineModel !== undefined) row.getCell(9).value = data.machineModel;
    if (data.serialNumber !== undefined) row.getCell(10).value = data.serialNumber;
    if (data.installationDate !== undefined) row.getCell(11).value = data.installationDate;
    if (data.complaint !== undefined) row.getCell(12).value = data.complaint;
    if (data.warehouseDeliveryDate !== undefined) row.getCell(13).value = data.warehouseDeliveryDate;
    if (data.problemDescription !== undefined) row.getCell(14).value = data.problemDescription;
    if (data.priority !== undefined) row.getCell(15).value = data.priority;
    if (data.expectedCompletion !== undefined) row.getCell(16).value = data.expectedCompletion;
    if (data.specialInstructions !== undefined) row.getCell(17).value = data.specialInstructions;
    if (data.createdBy !== undefined) row.getCell(18).value = data.createdBy;
    if (data.salesPerson !== undefined) row.getCell(19).value = data.salesPerson;
    if (data.coordinator !== undefined) row.getCell(20).value = data.coordinator;

    // Automatic Last Updated
    row.getCell(21).value = todayStr;

    // Formulas preserved
    row.getCell(22).value = {
      formula: `IF(OR(ISBLANK(B${foundRowNum}),TRIM(LOWER(X${foundRowNum}))="completed",TRIM(LOWER(X${foundRowNum}))="invalid",TRIM(LOWER(X${foundRowNum}))="cancelled"),0,MAX(0,TODAY()-B${foundRowNum}))`,
      result: daysOpen
    };
    row.getCell(23).value = {
      formula: `IF(OR(ISBLANK(P${foundRowNum}),TRIM(LOWER(X${foundRowNum}))="completed",TRIM(LOWER(X${foundRowNum}))="invalid",TRIM(LOWER(X${foundRowNum}))="cancelled"),0,MAX(0,TODAY()-P${foundRowNum}))`,
      result: overdueDays
    };
    // Handle Pending Customer Date tracking
    const currentPendingDate = getCellString(row.getCell(25));
    let pendingCustomerDate = currentPendingDate;
    if (status.toLowerCase() === 'pending customer') {
      if (currentStatus.toLowerCase() !== 'pending customer' || !currentPendingDate) {
        pendingCustomerDate = data.pendingCustomerDate && data.pendingCustomerDate.trim() ? data.pendingCustomerDate.trim() : todayStr;
      } else if (data.pendingCustomerDate !== undefined) {
        pendingCustomerDate = data.pendingCustomerDate.trim();
      }
    } else {
      pendingCustomerDate = '';
    }

    const pendingCustomerDays = calculatePendingCustomerDays(pendingCustomerDate, status, todayStr);

    row.getCell(24).value = status;
    row.getCell(25).value = pendingCustomerDate;

    await saveWorkbook(wb);

    return {
      jobNo: jobNoToUpdate,
      dateCreated,
      branch: getCellString(row.getCell(3)),
      jobType: getCellString(row.getCell(4)),
      customerName: getCellString(row.getCell(5)),
      contactNumber: getCellString(row.getCell(6)),
      customerAddress: getCellString(row.getCell(7)),
      machineCategory: getCellString(row.getCell(8)),
      machineModel: getCellString(row.getCell(9)),
      serialNumber: getCellString(row.getCell(10)),
      installationDate: getCellString(row.getCell(11)),
      complaint: getCellString(row.getCell(12)),
      warehouseDeliveryDate: getCellString(row.getCell(13)),
      problemDescription: getCellString(row.getCell(14)),
      priority: getCellString(row.getCell(15)),
      expectedCompletion: getCellString(row.getCell(16)),
      specialInstructions: getCellString(row.getCell(17)),
      createdBy: getCellString(row.getCell(18)),
      salesPerson: getCellString(row.getCell(19)),
      coordinator: getCellString(row.getCell(20)),
      lastUpdated: todayStr,
      daysOpen,
      overdueDays,
      status,
      pendingCustomerDate,
      pendingCustomerDays,
      rowNumber: foundRowNum
    };
  });
}

// ----------------------------------------------------
// Technicians Assigned
// ----------------------------------------------------

export interface TechnicianAssignment {
  id: string; // composite key: jobNo_technicianName or rowNumber
  jobNo: string;
  branch: string;
  technicianName: string;
  leadTechnician: string; // 'Yes' | 'No'
  rowNumber?: number;
}

export async function readTechniciansAssigned(): Promise<TechnicianAssignment[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_TECH_ASSIGNED);
  if (!ws) return [];

  const list: TechnicianAssignment[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const jobNo = getCellString(row.getCell(1));
    const technicianName = getCellString(row.getCell(3));
    if (!jobNo || !technicianName) return;

    list.push({
      id: `${jobNo}__${technicianName}`,
      jobNo,
      branch: getCellString(row.getCell(2)),
      technicianName,
      leadTechnician: getCellString(row.getCell(4)) || 'No',
      rowNumber
    });
  });

  return list;
}

export async function addTechnicianAssignment(data: {
  jobNo: string;
  technicianName: string;
  leadTechnician: string;
}): Promise<TechnicianAssignment> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const wsJobs = wb.getWorksheet(SHEET_JOBS);
    const wsAssigned = wb.getWorksheet(SHEET_TECH_ASSIGNED);
    if (!wsAssigned) throw new Error(`Worksheet ${SHEET_TECH_ASSIGNED} not found`);

    // Verify Job exists and is active
    const jobs = await readJobs();
    const targetJob = jobs.find(j => j.jobNo.toLowerCase() === data.jobNo.trim().toLowerCase());
    if (!targetJob) throw new Error(`Job "${data.jobNo}" not found`);
    if (!isJobActive(targetJob.status)) {
      throw new Error(`Cannot assign technician to inactive/completed job "${data.jobNo}" (Status: ${targetJob.status})`);
    }

    // Check duplicate assignment
    const existing = await readTechniciansAssigned();
    if (existing.some(e => e.jobNo.toLowerCase() === data.jobNo.trim().toLowerCase() &&
                          e.technicianName.toLowerCase() === data.technicianName.trim().toLowerCase())) {
      throw new Error(`Technician "${data.technicianName}" is already assigned to Job "${data.jobNo}".`);
    }

    const branch = targetJob.branch;
    const rowNum = wsAssigned.rowCount + 1;
    wsAssigned.addRow([
      targetJob.jobNo,
      branch,
      data.technicianName.trim(),
      data.leadTechnician === 'Yes' ? 'Yes' : 'No'
    ]);

    await saveWorkbook(wb);

    return {
      id: `${targetJob.jobNo}__${data.technicianName.trim()}`,
      jobNo: targetJob.jobNo,
      branch,
      technicianName: data.technicianName.trim(),
      leadTechnician: data.leadTechnician === 'Yes' ? 'Yes' : 'No',
      rowNumber: rowNum
    };
  });
}

export async function updateTechnicianAssignment(
  assignmentId: string,
  data: { leadTechnician?: string; technicianName?: string }
): Promise<TechnicianAssignment> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_TECH_ASSIGNED);
    if (!ws) throw new Error(`Worksheet ${SHEET_TECH_ASSIGNED} not found`);

    let targetRow: ExcelJS.Row | null = null;
    let foundRowNum = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const jNo = getCellString(row.getCell(1));
      const tName = getCellString(row.getCell(3));
      const id = `${jNo}__${tName}`;
      if (id.toLowerCase() === assignmentId.toLowerCase() || String(rowNumber) === assignmentId) {
        targetRow = row;
        foundRowNum = rowNumber;
      }
    });

    if (!targetRow || foundRowNum === 0) {
      throw new Error(`Technician assignment "${assignmentId}" not found`);
    }

    const row = targetRow as ExcelJS.Row;
    if (data.leadTechnician !== undefined) {
      row.getCell(4).value = data.leadTechnician === 'Yes' ? 'Yes' : 'No';
    }
    if (data.technicianName !== undefined) {
      row.getCell(3).value = data.technicianName.trim();
    }

    await saveWorkbook(wb);

    const jobNo = getCellString(row.getCell(1));
    const technicianName = getCellString(row.getCell(3));

    return {
      id: `${jobNo}__${technicianName}`,
      jobNo,
      branch: getCellString(row.getCell(2)),
      technicianName,
      leadTechnician: getCellString(row.getCell(4)),
      rowNumber: foundRowNum
    };
  });
}

// ----------------------------------------------------
// Technician Visits
// ----------------------------------------------------

export interface TechnicianVisit {
  id: string; // visitId or rowNumber
  visitId: string;
  jobNo: string;
  branch: string;
  technicianName: string;
  visitDate: string;
  scheduledArrival: string;
  actualTimeIn: string;
  actualTimeOut: string;
  hours: number | null;
  workDone: string;
  outcome: string;
  coordinator: string;
  vehicleType: string;
  vehicleNumber: string;
  updatedDate: string;
  rowNumber?: number;
}

export async function readTechnicianVisits(): Promise<TechnicianVisit[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_TECH_VISITS);
  if (!ws) return [];

  const visits: TechnicianVisit[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const visitId = getCellString(row.getCell(1)) || `VIS-${rowNumber}`;
    const jobNo = getCellString(row.getCell(2));
    if (!jobNo && !visitId) return;

    const actualTimeIn = getCellString(row.getCell(7));
    const actualTimeOut = getCellString(row.getCell(8));
    const recordedHours = getCellNumber(row.getCell(9));
    const hours = recordedHours > 0 ? recordedHours : calculateVisitHours(actualTimeIn, actualTimeOut);

    visits.push({
      id: visitId,
      visitId,
      jobNo,
      branch: getCellString(row.getCell(3)),
      technicianName: getCellString(row.getCell(4)),
      visitDate: getCellString(row.getCell(5)),
      scheduledArrival: getCellString(row.getCell(6)),
      actualTimeIn,
      actualTimeOut,
      hours,
      workDone: getCellString(row.getCell(10)),
      outcome: getCellString(row.getCell(11)),
      coordinator: getCellString(row.getCell(12)),
      vehicleType: getCellString(row.getCell(13)),
      vehicleNumber: getCellString(row.getCell(14)),
      updatedDate: getCellString(row.getCell(15)),
      rowNumber
    });
  });

  return visits;
}

export async function addTechnicianVisit(data: Partial<TechnicianVisit>): Promise<TechnicianVisit> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_TECH_VISITS);
    if (!ws) throw new Error(`Worksheet ${SHEET_TECH_VISITS} not found`);

    if (!data.jobNo) throw new Error('Job No is required for technician visit');

    // Verify active job
    const jobs = await readJobs();
    const targetJob = jobs.find(j => j.jobNo.toLowerCase() === data.jobNo!.trim().toLowerCase());
    if (!targetJob) throw new Error(`Job "${data.jobNo}" not found`);
    if (!isJobActive(targetJob.status)) {
      throw new Error(`Cannot add visit to inactive/completed job "${data.jobNo}" (Status: ${targetJob.status})`);
    }

    const branch = targetJob.branch;
    const visits = await readTechnicianVisits();
    const visitId = data.visitId && data.visitId.trim() ? data.visitId.trim() : getNextVisitId(visits.map(v => v.visitId));
    const hours = calculateVisitHours(data.actualTimeIn, data.actualTimeOut);
    const updatedDate = formatDate(new Date());

    const rowNum = ws.rowCount + 1;
    ws.addRow([
      visitId,
      targetJob.jobNo,
      branch,
      data.technicianName || '',
      data.visitDate || updatedDate,
      data.scheduledArrival || '',
      data.actualTimeIn || '',
      data.actualTimeOut || '',
      hours !== null ? hours : '',
      data.workDone || '',
      data.outcome || '',
      data.coordinator || '',
      data.vehicleType || '',
      data.vehicleNumber || '',
      updatedDate
    ]);

    await saveWorkbook(wb);

    return {
      id: visitId,
      visitId,
      jobNo: targetJob.jobNo,
      branch,
      technicianName: data.technicianName || '',
      visitDate: data.visitDate || updatedDate,
      scheduledArrival: data.scheduledArrival || '',
      actualTimeIn: data.actualTimeIn || '',
      actualTimeOut: data.actualTimeOut || '',
      hours,
      workDone: data.workDone || '',
      outcome: data.outcome || '',
      coordinator: data.coordinator || '',
      vehicleType: data.vehicleType || '',
      vehicleNumber: data.vehicleNumber || '',
      updatedDate,
      rowNumber: rowNum
    };
  });
}

export async function updateTechnicianVisit(visitIdToUpdate: string, data: Partial<TechnicianVisit>): Promise<TechnicianVisit> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_TECH_VISITS);
    if (!ws) throw new Error(`Worksheet ${SHEET_TECH_VISITS} not found`);

    let targetRow: ExcelJS.Row | null = null;
    let foundRowNum = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const vId = getCellString(row.getCell(1));
      if (vId.toLowerCase() === visitIdToUpdate.trim().toLowerCase() || String(rowNumber) === visitIdToUpdate) {
        targetRow = row;
        foundRowNum = rowNumber;
      }
    });

    if (!targetRow || foundRowNum === 0) {
      throw new Error(`Visit "${visitIdToUpdate}" not found in workbook.`);
    }

    const row = targetRow as ExcelJS.Row;
    const actualIn = data.actualTimeIn !== undefined ? data.actualTimeIn : getCellString(row.getCell(7));
    const actualOut = data.actualTimeOut !== undefined ? data.actualTimeOut : getCellString(row.getCell(8));
    const hours = calculateVisitHours(actualIn, actualOut);
    const updatedDate = formatDate(new Date());

    if (data.technicianName !== undefined) row.getCell(4).value = data.technicianName;
    if (data.visitDate !== undefined) row.getCell(5).value = data.visitDate;
    if (data.scheduledArrival !== undefined) row.getCell(6).value = data.scheduledArrival;
    row.getCell(7).value = actualIn;
    row.getCell(8).value = actualOut;
    row.getCell(9).value = hours !== null ? hours : '';
    if (data.workDone !== undefined) row.getCell(10).value = data.workDone;
    if (data.outcome !== undefined) row.getCell(11).value = data.outcome;
    if (data.coordinator !== undefined) row.getCell(12).value = data.coordinator;
    if (data.vehicleType !== undefined) row.getCell(13).value = data.vehicleType;
    if (data.vehicleNumber !== undefined) row.getCell(14).value = data.vehicleNumber;
    row.getCell(15).value = updatedDate;

    await saveWorkbook(wb);

    return {
      id: getCellString(row.getCell(1)),
      visitId: getCellString(row.getCell(1)),
      jobNo: getCellString(row.getCell(2)),
      branch: getCellString(row.getCell(3)),
      technicianName: getCellString(row.getCell(4)),
      visitDate: getCellString(row.getCell(5)),
      scheduledArrival: getCellString(row.getCell(6)),
      actualTimeIn: actualIn,
      actualTimeOut: actualOut,
      hours,
      workDone: getCellString(row.getCell(10)),
      outcome: getCellString(row.getCell(11)),
      coordinator: getCellString(row.getCell(12)),
      vehicleType: getCellString(row.getCell(13)),
      vehicleNumber: getCellString(row.getCell(14)),
      updatedDate,
      rowNumber: foundRowNum
    };
  });
}

// ----------------------------------------------------
// Spare Parts Used
// ----------------------------------------------------

export interface SparePartUsedRecord {
  id: string; // row number or composite
  jobNo: string;
  name: string;
  unitPrice: number;
  qty: number;
  totalPriceExVat: number;
  discountPercent: number;
  totalPriceAfterDiscountExVat: number;
  vatPercent: number;
  totalPriceIncVat: number;
  rowNumber?: number;
}

export async function readSparePartsUsed(): Promise<SparePartUsedRecord[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_SPARE_PARTS);
  if (!ws) return [];

  const list: SparePartUsedRecord[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const jobNo = getCellString(row.getCell(1));
    const name = getCellString(row.getCell(2));
    if (!jobNo || !name) return;

    const unitPrice = getCellNumber(row.getCell(3));
    const qty = getCellNumber(row.getCell(4));
    const discountPercent = getCellNumber(row.getCell(6));
    const vatPercent = getCellNumber(row.getCell(8));

    // Live recalculated for backend consistency
    const calc = calculateSparePartAmounts(unitPrice, qty, discountPercent, vatPercent);

    list.push({
      id: `${jobNo}__${name}__${rowNumber}`,
      jobNo,
      name,
      unitPrice,
      qty,
      totalPriceExVat: calc.subtotal,
      discountPercent,
      totalPriceAfterDiscountExVat: calc.discountedSubtotal,
      vatPercent,
      totalPriceIncVat: calc.finalTotal,
      rowNumber
    });
  });

  return list;
}

export async function addSparePartUsed(data: {
  jobNo: string;
  name: string;
  unitPrice: number;
  qty: number;
  discountPercent?: number;
  vatPercent?: number;
}): Promise<SparePartUsedRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_SPARE_PARTS);
    if (!ws) throw new Error(`Worksheet ${SHEET_SPARE_PARTS} not found`);

    if (!data.jobNo) throw new Error('Job No is required');
    if (!data.name) throw new Error('Spare part Name is required');

    // Verify active job
    const jobs = await readJobs();
    const targetJob = jobs.find(j => j.jobNo.toLowerCase() === data.jobNo.trim().toLowerCase());
    if (!targetJob) throw new Error(`Job "${data.jobNo}" not found`);
    if (!isJobActive(targetJob.status)) {
      throw new Error(`Cannot add spare parts to inactive/completed job "${data.jobNo}" (Status: ${targetJob.status})`);
    }

    const calc = calculateSparePartAmounts(data.unitPrice, data.qty, data.discountPercent || 0, data.vatPercent || 0);
    const rowNum = ws.rowCount + 1;

    // Excel formula preservation
    ws.addRow([
      targetJob.jobNo,
      data.name.trim(),
      calc.subtotal > 0 && data.qty > 0 ? Number(data.unitPrice) : 0,
      Number(data.qty) || 1,
      { formula: `ROUND(C${rowNum}*D${rowNum}, 2)`, result: calc.subtotal },
      Number(data.discountPercent) || 0,
      { formula: `ROUND(E${rowNum}-(E${rowNum}*F${rowNum}/100), 2)`, result: calc.discountedSubtotal },
      Number(data.vatPercent) || 0,
      { formula: `ROUND(G${rowNum}+(G${rowNum}*H${rowNum}/100), 2)`, result: calc.finalTotal }
    ]);

    await saveWorkbook(wb);

    return {
      id: `${targetJob.jobNo}__${data.name.trim()}__${rowNum}`,
      jobNo: targetJob.jobNo,
      name: data.name.trim(),
      unitPrice: Number(data.unitPrice),
      qty: Number(data.qty),
      totalPriceExVat: calc.subtotal,
      discountPercent: Number(data.discountPercent) || 0,
      totalPriceAfterDiscountExVat: calc.discountedSubtotal,
      vatPercent: Number(data.vatPercent) || 0,
      totalPriceIncVat: calc.finalTotal,
      rowNumber: rowNum
    };
  });
}

export async function updateSparePartUsed(
  recordId: string,
  data: { unitPrice?: number; qty?: number; discountPercent?: number; vatPercent?: number; name?: string }
): Promise<SparePartUsedRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_SPARE_PARTS);
    if (!ws) throw new Error(`Worksheet ${SHEET_SPARE_PARTS} not found`);

    let targetRow: ExcelJS.Row | null = null;
    let foundRowNum = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const jNo = getCellString(row.getCell(1));
      const pName = getCellString(row.getCell(2));
      const id = `${jNo}__${pName}__${rowNumber}`;
      if (id.toLowerCase() === recordId.toLowerCase() || String(rowNumber) === recordId) {
        targetRow = row;
        foundRowNum = rowNumber;
      }
    });

    if (!targetRow || foundRowNum === 0) {
      throw new Error(`Spare part usage record "${recordId}" not found`);
    }

    const row = targetRow as ExcelJS.Row;
    const name = data.name !== undefined ? data.name : getCellString(row.getCell(2));
    const unitPrice = data.unitPrice !== undefined ? Number(data.unitPrice) : getCellNumber(row.getCell(3));
    const qty = data.qty !== undefined ? Number(data.qty) : getCellNumber(row.getCell(4));
    const discountPercent = data.discountPercent !== undefined ? Number(data.discountPercent) : getCellNumber(row.getCell(6));
    const vatPercent = data.vatPercent !== undefined ? Number(data.vatPercent) : getCellNumber(row.getCell(8));

    const calc = calculateSparePartAmounts(unitPrice, qty, discountPercent, vatPercent);

    row.getCell(2).value = name;
    row.getCell(3).value = unitPrice;
    row.getCell(4).value = qty;
    row.getCell(5).value = { formula: `ROUND(C${foundRowNum}*D${foundRowNum}, 2)`, result: calc.subtotal };
    row.getCell(6).value = discountPercent;
    row.getCell(7).value = { formula: `ROUND(E${foundRowNum}-(E${foundRowNum}*F${foundRowNum}/100), 2)`, result: calc.discountedSubtotal };
    row.getCell(8).value = vatPercent;
    row.getCell(9).value = { formula: `ROUND(G${foundRowNum}+(G${foundRowNum}*H${foundRowNum}/100), 2)`, result: calc.finalTotal };

    await saveWorkbook(wb);

    const jobNo = getCellString(row.getCell(1));
    return {
      id: `${jobNo}__${name}__${foundRowNum}`,
      jobNo,
      name,
      unitPrice,
      qty,
      totalPriceExVat: calc.subtotal,
      discountPercent,
      totalPriceAfterDiscountExVat: calc.discountedSubtotal,
      vatPercent,
      totalPriceIncVat: calc.finalTotal,
      rowNumber: foundRowNum
    };
  });
}

// ----------------------------------------------------
// Expenses
// ----------------------------------------------------

export interface ExpenseRecord {
  id: string; // expenseId
  expenseId: string;
  jobNo: string;
  date: string;
  purchasedBy: string;
  branchChargedTo: string;
  expenseCategory: string;
  description: string;
  supplier: string;
  expenseAmount: number;
  receipt: string;
  approvedBy: string;
  enteredBy: string;
  paymentStatus: 'Paid' | 'Not Paid';
  rowNumber?: number;
}

export async function readExpenses(): Promise<ExpenseRecord[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_EXPENSES);
  if (!ws) return [];

  const list: ExpenseRecord[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const expenseId = getCellString(row.getCell(1));
    if (!expenseId) return;

    list.push({
      id: expenseId,
      expenseId,
      jobNo: getCellString(row.getCell(2)),
      date: getCellString(row.getCell(3)),
      purchasedBy: getCellString(row.getCell(4)),
      branchChargedTo: getCellString(row.getCell(5)),
      expenseCategory: getCellString(row.getCell(6)),
      description: getCellString(row.getCell(7)),
      supplier: getCellString(row.getCell(8)),
      expenseAmount: getCellNumber(row.getCell(9)),
      receipt: getCellString(row.getCell(10)),
      approvedBy: getCellString(row.getCell(11)),
      enteredBy: getCellString(row.getCell(12)),
      paymentStatus: getCellString(row.getCell(13)) === 'Paid' ? 'Paid' : 'Not Paid',
      rowNumber
    });
  });

  return list;
}

export async function addExpense(data: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_EXPENSES);
    if (!ws) throw new Error(`Worksheet ${SHEET_EXPENSES} not found`);

    const existing = await readExpenses();
    const expenseId = data.expenseId && data.expenseId.trim() ? data.expenseId.trim() : getNextExpenseId(existing.map(e => e.expenseId));
    if (existing.some(e => e.expenseId.toLowerCase() === expenseId.toLowerCase())) {
      throw new Error(`Expense ID "${expenseId}" already exists. Please provide a unique ID.`);
    }

    // Verify active job
    const jobs = await readJobs();
    const targetJob = jobs.find(j => j.jobNo.toLowerCase() === data.jobNo!.trim().toLowerCase());
    if (!targetJob) throw new Error(`Job "${data.jobNo}" not found`);
    if (!isJobActive(targetJob.status)) {
      throw new Error(`Cannot add expenses to inactive/completed job "${data.jobNo}" (Status: ${targetJob.status})`);
    }

    const rowNum = ws.rowCount + 1;
    const date = data.date || formatDate(new Date());

    ws.addRow([
      expenseId,
      targetJob.jobNo,
      date,
      data.purchasedBy || '',
      data.branchChargedTo || targetJob.branch,
      data.expenseCategory || '',
      data.description || '',
      data.supplier || '',
      Number(data.expenseAmount) || 0,
      data.receipt || '',
      data.approvedBy || '',
      data.enteredBy || '',
      data.paymentStatus === 'Paid' ? 'Paid' : 'Not Paid'
    ]);

    await saveWorkbook(wb);

    return {
      id: expenseId,
      expenseId,
      jobNo: targetJob.jobNo,
      date,
      purchasedBy: data.purchasedBy || '',
      branchChargedTo: data.branchChargedTo || targetJob.branch,
      expenseCategory: data.expenseCategory || '',
      description: data.description || '',
      supplier: data.supplier || '',
      expenseAmount: Number(data.expenseAmount) || 0,
      receipt: data.receipt || '',
      approvedBy: data.approvedBy || '',
      enteredBy: data.enteredBy || '',
      paymentStatus: data.paymentStatus === 'Paid' ? 'Paid' : 'Not Paid',
      rowNumber: rowNum
    };
  });
}

export async function updateExpense(expenseIdToUpdate: string, data: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_EXPENSES);
    if (!ws) throw new Error(`Worksheet ${SHEET_EXPENSES} not found`);

    let targetRow: ExcelJS.Row | null = null;
    let foundRowNum = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const eId = getCellString(row.getCell(1));
      if (eId.toLowerCase() === expenseIdToUpdate.trim().toLowerCase()) {
        targetRow = row;
        foundRowNum = rowNumber;
      }
    });

    if (!targetRow || foundRowNum === 0) {
      throw new Error(`Expense "${expenseIdToUpdate}" not found in workbook.`);
    }

    const row = targetRow as ExcelJS.Row;
    if (data.date !== undefined) row.getCell(3).value = data.date;
    if (data.purchasedBy !== undefined) row.getCell(4).value = data.purchasedBy;
    if (data.branchChargedTo !== undefined) row.getCell(5).value = data.branchChargedTo;
    if (data.expenseCategory !== undefined) row.getCell(6).value = data.expenseCategory;
    if (data.description !== undefined) row.getCell(7).value = data.description;
    if (data.supplier !== undefined) row.getCell(8).value = data.supplier;
    if (data.expenseAmount !== undefined) row.getCell(9).value = Number(data.expenseAmount);
    if (data.receipt !== undefined) row.getCell(10).value = data.receipt;
    if (data.approvedBy !== undefined) row.getCell(11).value = data.approvedBy;
    if (data.enteredBy !== undefined) row.getCell(12).value = data.enteredBy;
    if (data.paymentStatus !== undefined) row.getCell(13).value = data.paymentStatus === 'Paid' ? 'Paid' : 'Not Paid';

    await saveWorkbook(wb);

    return {
      id: expenseIdToUpdate,
      expenseId: expenseIdToUpdate,
      jobNo: getCellString(row.getCell(2)),
      date: getCellString(row.getCell(3)),
      purchasedBy: getCellString(row.getCell(4)),
      branchChargedTo: getCellString(row.getCell(5)),
      expenseCategory: getCellString(row.getCell(6)),
      description: getCellString(row.getCell(7)),
      supplier: getCellString(row.getCell(8)),
      expenseAmount: getCellNumber(row.getCell(9)),
      receipt: getCellString(row.getCell(10)),
      approvedBy: getCellString(row.getCell(11)),
      enteredBy: getCellString(row.getCell(12)),
      paymentStatus: getCellString(row.getCell(13)) === 'Paid' ? 'Paid' : 'Not Paid',
      rowNumber: foundRowNum
    };
  });
}

// ----------------------------------------------------
// Job Closing (Critical synchronized workflow)
// ----------------------------------------------------

export interface JobClosingRecord {
  jobNo: string;
  branch: string;
  completionDate: string;
  workCarriedOut: string;
  workHours: number;
  customerAcknowledged: 'Yes' | 'No';
  warrantyPartsReturned: 'Yes' | 'No';
  followUpNeeded: 'Yes' | 'No';
  followUpDetails: string;
  followUpDue: string;
  approvedBy: string;
  updatedBy: string;
  updatedDate: string;
  status: string;
  remarks: string;
  pendingCustomerDate?: string;
  rowNumber?: number;
}

export async function readJobClosures(): Promise<JobClosingRecord[]> {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_JOB_CLOSING);
  if (!ws) return [];

  const list: JobClosingRecord[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const jobNo = getCellString(row.getCell(1));
    if (!jobNo) return;

    list.push({
      jobNo,
      branch: getCellString(row.getCell(2)),
      completionDate: getCellString(row.getCell(3)),
      workCarriedOut: getCellString(row.getCell(4)),
      workHours: getCellNumber(row.getCell(5)),
      customerAcknowledged: getCellString(row.getCell(6)) === 'Yes' ? 'Yes' : 'No',
      warrantyPartsReturned: getCellString(row.getCell(7)) === 'Yes' ? 'Yes' : 'No',
      followUpNeeded: getCellString(row.getCell(8)) === 'Yes' ? 'Yes' : 'No',
      followUpDetails: getCellString(row.getCell(9)),
      followUpDue: getCellString(row.getCell(10)),
      approvedBy: getCellString(row.getCell(11)),
      updatedBy: getCellString(row.getCell(12)),
      updatedDate: getCellString(row.getCell(13)),
      status: getCellString(row.getCell(14)) || 'Completed',
      pendingCustomerDate: getCellString(row.getCell(15)),
      remarks: getCellString(row.getCell(16)),
      rowNumber
    });
  });

  return list;
}

/**
 * Atomic synchronized Job Closure workflow:
 * 1. Validate job exists and is eligible for closure.
 * 2. Ensure no existing closure record for the job.
 * 3. Append to Job Closing worksheet.
 * 4. Update corresponding record in Jobs worksheet (sync status & Last Updated date).
 * 5. Commit safely to disk.
 */
export async function addJobClosure(data: Partial<JobClosingRecord>): Promise<JobClosingRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const wsClosing = wb.getWorksheet(SHEET_JOB_CLOSING);
    const wsJobs = wb.getWorksheet(SHEET_JOBS);
    if (!wsClosing || !wsJobs) throw new Error('Worksheets missing');

    if (!data.jobNo) throw new Error('Job No is required');
    const jobNo = data.jobNo.trim();

    // 1. Check existing closure
    const existingClosures = await readJobClosures();
    if (existingClosures.some(c => c.jobNo.toLowerCase() === jobNo.toLowerCase())) {
      throw new Error(`Job "${jobNo}" already has a closure record in Job Closing.`);
    }

    // 2. Locate Job in Jobs sheet
    let targetJobRow: ExcelJS.Row | null = null;
    let jobRowNum = 0;
    wsJobs.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const jNo = getCellString(row.getCell(1));
      if (jNo.toLowerCase() === jobNo.toLowerCase()) {
        targetJobRow = row;
        jobRowNum = rowNumber;
      }
    });

    if (!targetJobRow || jobRowNum === 0) {
      throw new Error(`Job "${jobNo}" does not exist in the Jobs worksheet.`);
    }

    const jobRow = targetJobRow as ExcelJS.Row;
    const currentJobStatus = getCellString(jobRow.getCell(24));
    if (!isJobActive(currentJobStatus)) {
      throw new Error(`Job "${jobNo}" cannot be completed because it is currently "${currentJobStatus}".`);
    }

    const branch = getCellString(jobRow.getCell(3));

    // Calculate total visit hours if not supplied
    let workHours = Number(data.workHours);
    if (isNaN(workHours) || workHours <= 0) {
      const visits = await readTechnicianVisits();
      const jobVisits = visits.filter(v => v.jobNo.toLowerCase() === jobNo.toLowerCase());
      workHours = jobVisits.reduce((acc, v) => acc + (v.hours || 0), 0);
      workHours = Math.round(workHours * 100) / 100;
    }

    const todayStr = formatDate(new Date());
    const completionDate = data.completionDate || todayStr;
    const closureStatus = data.status && data.status.trim() ? data.status.trim() : 'Completed';
    const followUpNeeded = data.followUpNeeded === 'Yes' ? 'Yes' : 'No';
    const customerAck = data.customerAcknowledged === 'Yes' ? 'Yes' : 'No';

    if (closureStatus.toLowerCase() === 'pending customer' && followUpNeeded !== 'Yes') {
      throw new Error("Cannot set closure status to 'Pending Customer'. Status 'Pending Customer' is allowed only if 'Follow-Up Needed?' is 'Yes'.");
    }

    if (closureStatus.toLowerCase() === 'completed') {
      if (customerAck !== 'Yes' || followUpNeeded !== 'No') {
        throw new Error("Cannot set closure status to 'Completed'. Status 'Completed' is allowed only if 'Customer Acknowledged' is 'Yes' and 'Follow-Up Needed?' is 'No'.");
      }
    }

    if (!data.remarks || !data.remarks.trim()) {
      throw new Error("Remarks is mandatory in Job Closing to track on-hold reason, pending customer reason, or handover notes.");
    }
    const remarks = data.remarks.trim();

    const followUpDueDate = followUpNeeded === 'Yes' ? (data.followUpDue || '') : '';

    // 3. Add to Job Closing sheet
    const closingRowNum = wsClosing.rowCount + 1;
    wsClosing.addRow([
      jobNo,
      branch,
      completionDate,
      data.workCarriedOut || '',
      workHours,
      data.customerAcknowledged === 'Yes' ? 'Yes' : 'No',
      data.warrantyPartsReturned === 'Yes' ? 'Yes' : 'No',
      data.followUpNeeded === 'Yes' ? 'Yes' : 'No',
      data.followUpNeeded === 'Yes' ? (data.followUpDetails || '') : '',
      followUpDueDate,
      data.approvedBy || '',
      data.updatedBy || '',
      todayStr,
      closureStatus,
      followUpDueDate,
      remarks
    ]);

    // 4. Synchronize with Jobs worksheet!
    jobRow.getCell(21).value = todayStr; // Last Updated
    jobRow.getCell(24).value = closureStatus; // Sync status (e.g. Pending Customer, On Hold, Completed)
    jobRow.getCell(25).value = followUpDueDate; // Sync Follow-Up Due Date to Jobs worksheet!

    // Recalculate formula cells for the job
    const dateCreated = getCellString(jobRow.getCell(2));
    const expectedCompletion = getCellString(jobRow.getCell(16));
    const daysOpen = calculateDaysOpen(dateCreated, closureStatus, todayStr);
    const overdueDays = calculateOverdueDays(expectedCompletion, closureStatus, todayStr);

    jobRow.getCell(22).value = {
      formula: `IF(OR(ISBLANK(B${jobRowNum}),TRIM(LOWER(X${jobRowNum}))="completed",TRIM(LOWER(X${jobRowNum}))="invalid",TRIM(LOWER(X${jobRowNum}))="cancelled"),0,MAX(0,TODAY()-B${jobRowNum}))`,
      result: daysOpen
    };
    jobRow.getCell(23).value = {
      formula: `IF(OR(ISBLANK(P${jobRowNum}),TRIM(LOWER(X${jobRowNum}))="completed",TRIM(LOWER(X${jobRowNum}))="invalid",TRIM(LOWER(X${jobRowNum}))="cancelled"),0,MAX(0,TODAY()-P${jobRowNum}))`,
      result: overdueDays
    };

    // 5. Commit write atomically
    await saveWorkbook(wb);

    return {
      jobNo,
      branch,
      completionDate,
      workCarriedOut: data.workCarriedOut || '',
      workHours,
      customerAcknowledged: data.customerAcknowledged === 'Yes' ? 'Yes' : 'No',
      warrantyPartsReturned: data.warrantyPartsReturned === 'Yes' ? 'Yes' : 'No',
      followUpNeeded: data.followUpNeeded === 'Yes' ? 'Yes' : 'No',
      followUpDetails: data.followUpNeeded === 'Yes' ? (data.followUpDetails || '') : '',
      followUpDue: followUpDueDate,
      approvedBy: data.approvedBy || '',
      updatedBy: data.updatedBy || '',
      updatedDate: todayStr,
      status: closureStatus,
      remarks,
      pendingCustomerDate: followUpDueDate,
      rowNumber: closingRowNum
    };
  });
}

export async function updateJobClosure(jobNo: string, data: Partial<JobClosingRecord>): Promise<JobClosingRecord> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const wsClosing = wb.getWorksheet(SHEET_JOB_CLOSING);
    const wsJobs = wb.getWorksheet(SHEET_JOBS);
    if (!wsClosing || !wsJobs) throw new Error('Worksheets missing');

    let targetClosingRow: ExcelJS.Row | null = null;
    let foundClosingRowNum = 0;

    wsClosing.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const jNo = getCellString(row.getCell(1));
      if (jNo.toLowerCase() === jobNo.trim().toLowerCase()) {
        targetClosingRow = row;
        foundClosingRowNum = rowNumber;
      }
    });

    if (!targetClosingRow || foundClosingRowNum === 0) {
      throw new Error(`Job closure record for "${jobNo}" not found.`);
    }

    const row = targetClosingRow as ExcelJS.Row;
    const todayStr = formatDate(new Date());

    if (data.completionDate !== undefined) row.getCell(3).value = data.completionDate;
    if (data.workCarriedOut !== undefined) row.getCell(4).value = data.workCarriedOut;
    if (data.workHours !== undefined) row.getCell(5).value = Number(data.workHours);
    if (data.customerAcknowledged !== undefined) row.getCell(6).value = data.customerAcknowledged === 'Yes' ? 'Yes' : 'No';
    if (data.warrantyPartsReturned !== undefined) row.getCell(7).value = data.warrantyPartsReturned === 'Yes' ? 'Yes' : 'No';
    if (data.followUpNeeded !== undefined) row.getCell(8).value = data.followUpNeeded === 'Yes' ? 'Yes' : 'No';
    if (data.followUpDetails !== undefined) row.getCell(9).value = data.followUpDetails;
    if (data.followUpDue !== undefined) row.getCell(10).value = data.followUpDue;
    if (data.approvedBy !== undefined) row.getCell(11).value = data.approvedBy;
    if (data.updatedBy !== undefined) row.getCell(12).value = data.updatedBy;
    row.getCell(13).value = todayStr;

    const newStatus = data.status !== undefined ? data.status.trim() : getCellString(row.getCell(14));
    const followUpNeeded = data.followUpNeeded !== undefined ? (data.followUpNeeded === 'Yes' ? 'Yes' : 'No') : (getCellString(row.getCell(8)) === 'Yes' ? 'Yes' : 'No');
    const customerAck = data.customerAcknowledged !== undefined ? (data.customerAcknowledged === 'Yes' ? 'Yes' : 'No') : (getCellString(row.getCell(6)) === 'Yes' ? 'Yes' : 'No');

    if (newStatus.toLowerCase() === 'pending customer' && followUpNeeded !== 'Yes') {
      throw new Error("Cannot set closure status to 'Pending Customer'. Status 'Pending Customer' is allowed only if 'Follow-Up Needed?' is 'Yes'.");
    }

    if (newStatus.toLowerCase() === 'completed') {
      if (customerAck !== 'Yes' || followUpNeeded !== 'No') {
        throw new Error("Cannot set closure status to 'Completed'. Status 'Completed' is allowed only if 'Customer Acknowledged' is 'Yes' and 'Follow-Up Needed?' is 'No'.");
      }
    }

    row.getCell(14).value = newStatus;

    const followUpDueDate = followUpNeeded === 'Yes'
      ? (data.followUpDue !== undefined ? data.followUpDue.trim() : getCellString(row.getCell(10)))
      : '';
    row.getCell(15).value = followUpDueDate;

    if (data.remarks !== undefined && !data.remarks.trim()) {
      throw new Error("Remarks is mandatory in Job Closing to track on-hold reason, pending customer reason, or handover notes.");
    }
    const remarks = data.remarks !== undefined ? data.remarks.trim() : getCellString(row.getCell(16));
    row.getCell(16).value = remarks;

    // Sync corresponding Job in Jobs sheet
    wsJobs.eachRow((jRow, jRowNum) => {
      if (jRowNum === 1) return;
      const jNo = getCellString(jRow.getCell(1));
      if (jNo.toLowerCase() === jobNo.trim().toLowerCase()) {
        jRow.getCell(21).value = todayStr;
        jRow.getCell(24).value = newStatus;
        jRow.getCell(25).value = followUpDueDate;

        const dateCreated = getCellString(jRow.getCell(2));
        const expectedCompletion = getCellString(jRow.getCell(16));
        const daysOpen = calculateDaysOpen(dateCreated, newStatus, todayStr);
        const overdueDays = calculateOverdueDays(expectedCompletion, newStatus, todayStr);

        jRow.getCell(22).value = {
          formula: `IF(OR(ISBLANK(B${jRowNum}),TRIM(LOWER(X${jRowNum}))="completed",TRIM(LOWER(X${jRowNum}))="invalid",TRIM(LOWER(X${jRowNum}))="cancelled"),0,MAX(0,TODAY()-B${jRowNum}))`,
          result: daysOpen
        };
        jRow.getCell(23).value = {
          formula: `IF(OR(ISBLANK(P${jRowNum}),TRIM(LOWER(X${jRowNum}))="completed",TRIM(LOWER(X${jRowNum}))="invalid",TRIM(LOWER(X${jRowNum}))="cancelled"),0,MAX(0,TODAY()-P${jRowNum}))`,
          result: overdueDays
        };
      }
    });

    await saveWorkbook(wb);

    return {
      jobNo,
      branch: getCellString(row.getCell(2)),
      completionDate: getCellString(row.getCell(3)),
      workCarriedOut: getCellString(row.getCell(4)),
      workHours: getCellNumber(row.getCell(5)),
      customerAcknowledged: getCellString(row.getCell(6)) === 'Yes' ? 'Yes' : 'No',
      warrantyPartsReturned: getCellString(row.getCell(7)) === 'Yes' ? 'Yes' : 'No',
      followUpNeeded: getCellString(row.getCell(8)) === 'Yes' ? 'Yes' : 'No',
      followUpDetails: getCellString(row.getCell(9)),
      followUpDue: getCellString(row.getCell(10)),
      approvedBy: getCellString(row.getCell(11)),
      updatedBy: getCellString(row.getCell(12)),
      updatedDate: todayStr,
      status: newStatus,
      remarks,
      pendingCustomerDate: followUpDueDate,
      rowNumber: foundClosingRowNum
    };
  });
}

/**
 * Clears all job records from the Jobs worksheet
 */
export async function clearAllJobs(): Promise<{ success: boolean; count: number }> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_JOBS);
    if (!ws) throw new Error(`Worksheet ${SHEET_JOBS} not found`);

    let removedCount = 0;
    while (ws.rowCount > 1) {
      ws.spliceRows(2, 1);
      removedCount++;
    }

    await saveWorkbook(wb);
    return { success: true, count: removedCount };
  });
}

/**
 * Clears all operational worksheets (Jobs, Tech Assigned, Visits, Parts, Expenses, Closures)
 */
export async function clearAllOperationalData(): Promise<{ success: boolean; message: string }> {
  return withWorkbookLock(async () => {
    const wb = await loadWorkbook();
    const sheetsToClear = [
      SHEET_JOBS,
      SHEET_TECH_ASSIGNED,
      SHEET_TECH_VISITS,
      SHEET_SPARE_PARTS,
      SHEET_EXPENSES,
      SHEET_JOB_CLOSING
    ];

    sheetsToClear.forEach(sheetName => {
      const ws = wb.getWorksheet(sheetName);
      if (ws) {
        while (ws.rowCount > 1) {
          ws.spliceRows(2, 1);
        }
      }
    });

    await saveWorkbook(wb);
    return { success: true, message: 'All operational records cleared from Excel workbook.' };
  });
}
