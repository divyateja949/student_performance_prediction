import { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, Menu } from 'lucide-react';
import { api } from './services/api';
import type { DashboardData, MLMetadata, Student } from './types';
import { Sidebar, type NavTab } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { PredictPage } from './pages/PredictPage';
import { StudentsPage } from './pages/StudentsPage';
import { ModelAnalyticsPage } from './pages/ModelAnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Academic Performance Overview',
    subtitle: 'Cohort KPIs, subject distributions, and behavioral correlation analysis',
  },
  predict: {
    title: 'Student Performance Prediction',
    subtitle: 'Real-time final exam mark forecasting using Scikit-learn regression models',
  },
  students: {
    title: 'Student Data Management',
    subtitle: 'Add, update, filter, and manage student academic records in SQLite',
  },
  analytics: {
    title: 'Machine Learning Module & Analytics',
    subtitle: 'Dataset preprocessing, exploratory analysis, and model evaluation metrics',
  },
  reports: {
    title: 'Performance Reports & Exports',
    subtitle: 'Generate individual student performance dossiers in PDF or CSV format',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [mlMetadata, setMlMetadata] = useState<MLMetadata | null>(null);
  const [mlLoading, setMlLoading] = useState(true);

  const [prefillStudent, setPrefillStudent] = useState<Student | null>(null);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : 'Unable to fetch dashboard analytics.'
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const fetchMLMetrics = useCallback(async () => {
    setMlLoading(true);
    try {
      const meta = await api.getMLMetrics();
      setMlMetadata(meta);
    } catch {
      // Handled smoothly in ModelAnalyticsPage
    } finally {
      setMlLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchMLMetrics();
  }, [fetchDashboard, fetchMLMetrics]);

  const handleNavigatePredict = (student?: Student) => {
    if (student) {
      setPrefillStudent(student);
    }
    setActiveTab('predict');
  };

  const currentHeader = TAB_TITLES[activeTab];

  return (
    <div className="min-h-screen flex bg-[#F4F6FA] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        totalStudents={dashboardData?.kpis.total_students ?? 0}
        selectedModelName={mlMetadata?.selected_model.name || 'Random Forest Regression'}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate font-display">
                {currentHeader.title}
              </h1>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                {currentHeader.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab !== 'predict' && (
              <button
                type="button"
                onClick={() => setActiveTab('predict')}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 whitespace-nowrap transition-colors"
              >
                <BrainCircuit className="w-4 h-4" />
                <span>Predict Performance</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              onNavigatePredict={handleNavigatePredict}
              onNavigateStudents={() => setActiveTab('students')}
            />
          )}

          {activeTab === 'predict' && (
            <PredictPage
              prefillStudent={prefillStudent}
              onClearPrefill={() => setPrefillStudent(null)}
              onPredictionCreated={() => {
                // Keep dashboard synced if user returns
              }}
            />
          )}

          {activeTab === 'students' && (
            <StudentsPage
              onDataChanged={fetchDashboard}
              onPredictStudent={handleNavigatePredict}
            />
          )}

          {activeTab === 'analytics' && (
            <ModelAnalyticsPage
              metadata={mlMetadata}
              loading={mlLoading}
              onRetrained={(meta) => setMlMetadata(meta)}
            />
          )}

          {activeTab === 'reports' && <ReportsPage />}
        </main>
      </div>
    </div>
  );
}
