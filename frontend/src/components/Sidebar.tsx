import {
  BarChart3,
  BrainCircuit,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'predict' | 'students' | 'analytics' | 'reports';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  totalStudents: number;
  selectedModelName: string;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Academic KPIs & overview',
    icon: LayoutDashboard,
  },
  {
    id: 'predict',
    label: 'Predict Performance',
    description: 'Interactive ML estimator',
    icon: BrainCircuit,
  },
  {
    id: 'students',
    label: 'Student Records',
    description: 'SQLite roster & CRUD',
    icon: Users,
  },
  {
    id: 'analytics',
    label: 'ML Model & Analytics',
    description: 'EDA & Scikit-learn metrics',
    icon: BarChart3,
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Export PDF & CSV dossiers',
    icon: FileSpreadsheet,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  totalStudents,
  selectedModelName,
}: SidebarProps) {
  const content = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-100 border-r border-slate-800 w-64 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate font-display leading-tight tracking-wide">
              AcadPredict ML
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              Academic Intelligence
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold whitespace-nowrap truncate leading-snug">
                  {item.label}
                </p>
                <p
                  className={`text-[11px] truncate ${
                    isActive ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Dataset & Active Model Summary Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">SQLite Cohort</span>
          <span className="font-mono tabular-nums font-semibold text-white">
            {totalStudents} students
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 block">Selected Model</span>
            <span className="font-semibold text-slate-100 truncate block">
              {selectedModelName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
