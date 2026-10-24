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
  pendingCustomerDate?: string; // Alias for followUpDueDate
  pendingCustomerDays?: number; // Days past Follow-Up Due Date
  rowNumber?: number;
}

export interface TechnicianAssignment {
  id: string;
  jobNo: string;
  branch: string;
  technicianName: string;
  leadTechnician: string;
  rowNumber?: number;
}

export interface TechnicianVisit {
  id: string;
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

export interface SparePartUsedRecord {
  id: string;
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

export interface ExpenseRecord {
  id: string;
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

export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  openJobs: number;
  inProgressJobs: number;
  onHoldJobs: number;
  overdueJobs: number;
  completedJobs: number;
  closedJobs: number;
  totalVisits: number;
  totalExpensesAmount: number;
  unpaidExpensesAmount: number;
  totalSparePartsAmount: number;
  recentVisits: TechnicianVisit[];
  attentionJobs: JobRecord[];
  upcomingJobs: JobRecord[];
  branchCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
}

export interface JobFullDetails {
  job: JobRecord;
  assignedTechnicians: TechnicianAssignment[];
  visits: TechnicianVisit[];
  sparePartsUsed: SparePartUsedRecord[];
  expenses: ExpenseRecord[];
  closure: JobClosingRecord | null;
}

export type ThemeMode = 'light' | 'dark' | 'colorful';

export interface AppSettings {
  theme: ThemeMode;
  workbookPath?: string;
  backupPath?: string;
  updatedAt?: string;
}

