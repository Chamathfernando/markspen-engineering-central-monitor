import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { api } from './services/api';
import { ReferenceData, WorkbookHealth, JobRecord } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ToastProvider, useToast } from './components/common/Toast';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { JobFormModal } from './components/jobs/JobFormModal';
import { AppearanceModal } from './components/settings/AppearanceModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { TechniciansAssignedPage } from './pages/TechniciansAssignedPage';
import { TechnicianVisitsPage } from './pages/TechnicianVisitsPage';
import { SparePartsPage } from './pages/SparePartsPage';
import { SparePartsCatalogPage } from './pages/SparePartsCatalogPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { JobClosingPage } from './pages/JobClosingPage';
import { ManageEmployeesPage } from './pages/ManageEmployeesPage';
import { QuickReportsPage } from './pages/QuickReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppLayout() {
  const { showToast } = useToast();
  const { isAppearanceModalOpen, openAppearanceModal, closeAppearanceModal } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Global Reference Data & Health
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    branches: [],
    jobTypes: [],
    expenseCategories: [],
    statuses: [],
    technicians: [],
    managers: [],
    vehicleTypes: [],
    vehicles: [],
    spareParts: []
  });
  const [workbookHealth, setWorkbookHealth] = useState<WorkbookHealth | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Global Quick New Job Modal
  const [isGlobalNewJobModalOpen, setIsGlobalNewJobModalOpen] = useState(false);

  // Direct Job Detail View trigger from Dashboard
  const [jobNoToOpenInJobsPage, setJobNoToOpenInJobsPage] = useState<string | null>(null);

  const loadReferenceAndHealth = async () => {
    setIsRefreshing(true);
    try {
      const [refData, healthData] = await Promise.all([
        api.getReferenceData(),
        api.getWorkbookStatus()
      ]);
      setReferenceData(refData);
      setWorkbookHealth(healthData);
    } catch (err: any) {
      console.error('Failed to load initial workbook state:', err);
      showToast('Could not reach backend or Excel workbook', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReferenceAndHealth();
  }, []);

  const handleGlobalJobSaved = (job: JobRecord) => {
    showToast(`Job ${job.jobNo} saved to Excel!`, 'success');
    loadReferenceAndHealth();
    if (location.pathname !== '/jobs') {
      navigate('/jobs');
    }
  };

  const handleSelectJobFromDashboard = (jobNo: string) => {
    setJobNoToOpenInJobsPage(jobNo);
    navigate('/jobs');
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAppearanceModal={openAppearanceModal}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          workbookHealth={workbookHealth}
          onRefreshData={loadReferenceAndHealth}
          isRefreshing={isRefreshing}
          onOpenNewJobModal={() => setIsGlobalNewJobModalOpen(true)}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route
                path="/"
                element={
                  <DashboardPage
                    onOpenNewJob={() => setIsGlobalNewJobModalOpen(true)}
                    referenceData={referenceData}
                    onSelectJobForDetails={handleSelectJobFromDashboard}
                  />
                }
              />
              <Route
                path="/jobs"
                element={
                  <JobsPage
                    referenceData={referenceData}
                    initialJobNoToView={jobNoToOpenInJobsPage}
                    onClearInitialJobNo={() => setJobNoToOpenInJobsPage(null)}
                  />
                }
              />
              <Route
                path="/technicians-assigned"
                element={<TechniciansAssignedPage referenceData={referenceData} />}
              />
              <Route
                path="/technician-visits"
                element={<TechnicianVisitsPage referenceData={referenceData} />}
              />
              <Route
                path="/spare-parts"
                element={
                  <SparePartsCatalogPage
                    referenceData={referenceData}
                    onRefreshReferenceData={loadReferenceAndHealth}
                  />
                }
              />
              <Route
                path="/spare-parts-used"
                element={<SparePartsPage referenceData={referenceData} />}
              />
              <Route
                path="/expenses"
                element={<ExpensesPage referenceData={referenceData} />}
              />
              <Route
                path="/job-closing"
                element={<JobClosingPage referenceData={referenceData} />}
              />
              <Route
                path="/employees"
                element={
                  <ManageEmployeesPage
                    referenceData={referenceData}
                    onRefreshReferenceData={loadReferenceAndHealth}
                  />
                }
              />
              <Route
                path="/manage-employees"
                element={
                  <ManageEmployeesPage
                    referenceData={referenceData}
                    onRefreshReferenceData={loadReferenceAndHealth}
                  />
                }
              />
              <Route
                path="/quick-reports"
                element={<QuickReportsPage referenceData={referenceData} />}
              />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    referenceData={referenceData}
                    onRefreshReferenceData={loadReferenceAndHealth}
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>

      {/* Global New Job Modal */}
      {isGlobalNewJobModalOpen && (
        <JobFormModal
          isOpen={isGlobalNewJobModalOpen}
          onClose={() => setIsGlobalNewJobModalOpen(false)}
          onSaved={handleGlobalJobSaved}
          referenceData={referenceData}
        />
      )}

      {/* Appearance Settings Modal */}
      <AppearanceModal
        isOpen={isAppearanceModalOpen}
        onClose={closeAppearanceModal}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
