import '../utils/chartSetup';
import { Bar, Doughnut, Scatter } from 'react-chartjs-2';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpenCheck,
  Percent,
  Users,
} from 'lucide-react';
import type { DashboardData, Student } from '../types';
import { CategoryLabel } from '../components/CategoryBadge';

interface DashboardPageProps {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  onNavigatePredict: (student?: Student) => void;
  onNavigateStudents: () => void;
}

export function DashboardPage({
  data,
  loading,
  error,
  onNavigatePredict,
  onNavigateStudents,
}: DashboardPageProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse" />
          <div className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-red-700">
        <h3 className="text-base font-semibold">Unable to load dashboard analytics</h3>
        <p className="text-sm mt-1 text-red-600">{error || 'No data returned from backend.'}</p>
      </div>
    );
  }

  const { kpis, distribution, subject_performance, attendance_vs_marks, study_hours_vs_marks, recent_at_risk } = data;

  const kpiCards = [
    {
      label: 'Total Students',
      value: kpis.total_students.toLocaleString(),
      subtext: 'Stored in SQLite roster',
      icon: Users,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Average Student Marks',
      value: `${kpis.average_marks.toFixed(1)}`,
      subtext: 'Out of 100 final exam marks',
      icon: BookOpenCheck,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Average Attendance',
      value: `${kpis.average_attendance.toFixed(1)}%`,
      subtext: `Avg ${kpis.average_study_hours.toFixed(1)} study hrs/day`,
      icon: Percent,
      accent: 'text-slate-700 bg-slate-100',
    },
    {
      label: 'Performing Well (70+)',
      value: kpis.performing_well.toLocaleString(),
      subtext: `${kpis.excellent_count} Excellent (85–100)`,
      icon: Award,
      accent: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: 'At Academic Risk (<50)',
      value: kpis.at_risk.toLocaleString(),
      subtext: 'Recommended for early support',
      icon: AlertTriangle,
      accent: 'text-red-700 bg-red-50',
    },
  ];

  // 1. Performance Distribution Chart
  const distChartData = {
    labels: ['Excellent (85–100)', 'Good (70–84)', 'Average (50–69)', 'At Risk (<50)'],
    datasets: [
      {
        label: 'Students',
        data: [
          distribution.Excellent || 0,
          distribution.Good || 0,
          distribution.Average || 0,
          distribution['At Risk'] || 0,
        ],
        backgroundColor: ['#059669', '#1D4ED8', '#D97706', '#DC2626'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  // 2. Subject-Wise Performance Chart
  const subjectChartData = {
    labels: subject_performance.map((s) => s.subject),
    datasets: [
      {
        label: 'Avg Final Exam Marks',
        data: subject_performance.map((s) => s.avg_final_marks),
        backgroundColor: '#1D4ED8',
        borderRadius: 6,
      },
      {
        label: 'Avg Internal Assessment',
        data: subject_performance.map((s) => s.avg_internal_marks),
        backgroundColor: '#93C5FD',
        borderRadius: 6,
      },
    ],
  };

  // 3. Attendance vs Marks Scatter
  const attendanceScatterData = {
    datasets: [
      {
        label: 'Excellent / Good (70+)',
        data: attendance_vs_marks.filter((p) => p.y >= 70),
        backgroundColor: 'rgba(29, 78, 216, 0.72)',
        pointRadius: 4,
      },
      {
        label: 'Average (50–69)',
        data: attendance_vs_marks.filter((p) => p.y >= 50 && p.y < 70),
        backgroundColor: 'rgba(217, 119, 6, 0.72)',
        pointRadius: 4,
      },
      {
        label: 'At Risk (<50)',
        data: attendance_vs_marks.filter((p) => p.y < 50),
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        pointRadius: 4.5,
      },
    ],
  };

  // 4. Study Hours vs Marks Scatter
  const studyScatterData = {
    datasets: [
      {
        label: 'Excellent / Good (70+)',
        data: study_hours_vs_marks.filter((p) => p.y >= 70),
        backgroundColor: 'rgba(5, 150, 105, 0.72)',
        pointRadius: 4,
      },
      {
        label: 'Average (50–69)',
        data: study_hours_vs_marks.filter((p) => p.y >= 50 && p.y < 70),
        backgroundColor: 'rgba(217, 119, 6, 0.72)',
        pointRadius: 4,
      },
      {
        label: 'At Risk (<50)',
        data: study_hours_vs_marks.filter((p) => p.y < 50),
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        pointRadius: 4.5,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-slate-500 mt-1">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Primary Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Performance Distribution */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Student Performance Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cohort breakdown across grading tiers ({kpis.total_students} records)
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-[260px]">
            <div className="w-full max-w-[290px]">
              <Doughnut
                data={distChartData}
                options={{
                  responsive: true,
                  cutout: '62%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 12, padding: 14, font: { size: 11 } },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Subject-Wise Performance */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Subject-Wise Academic Performance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mean final exam marks vs internal assessment scores by department subject
            </p>
          </div>
          <div className="flex-1 min-h-[260px]">
            <Bar
              data={subjectChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    min: 0,
                    max: 100,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Marks (/100)', font: { size: 11 } },
                  },
                  x: { grid: { display: false } },
                },
                plugins: {
                  legend: { position: 'top', align: 'end', labels: { boxWidth: 12 } },
                },
              }}
            />
          </div>
        </div>
      </section>

      {/* Correlation Scatter Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Attendance Percentage vs Final Exam Marks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing the positive correlation between class attendance and exam achievement
            </p>
          </div>
          <div className="h-[260px]">
            <Scatter
              data={attendanceScatterData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    min: 30,
                    max: 102,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Attendance (%)', font: { size: 11 } },
                  },
                  y: {
                    min: 15,
                    max: 102,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Final Marks (/100)', font: { size: 11 } },
                  },
                },
                plugins: {
                  legend: { position: 'top', align: 'end', labels: { boxWidth: 10 } },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const raw = ctx.raw as { x: number; y: number; student_name?: string };
                        return `${raw.student_name || 'Student'}: ${raw.x}% attendance, ${raw.y} marks`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Daily Study Hours vs Final Exam Marks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Impact of daily self-study duration on final exam scores
            </p>
          </div>
          <div className="h-[260px]">
            <Scatter
              data={studyScatterData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    min: 0,
                    max: 9.5,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Study Hours Per Day', font: { size: 11 } },
                  },
                  y: {
                    min: 15,
                    max: 102,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Final Marks (/100)', font: { size: 11 } },
                  },
                },
                plugins: {
                  legend: { position: 'top', align: 'end', labels: { boxWidth: 10 } },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const raw = ctx.raw as { x: number; y: number; student_name?: string };
                        return `${raw.student_name || 'Student'}: ${raw.x} hrs/day, ${raw.y} marks`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </section>

      {/* At-Risk Support Watchlist */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Priority Academic Support Watchlist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Students scoring below 50 marks flagged for early advising and targeted intervention
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateStudents}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            <span>View Full Student Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-5">Student ID</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4 text-right">Attendance</th>
                <th className="py-2.5 px-4 text-right">Study Hrs</th>
                <th className="py-2.5 px-4 text-right">Internal</th>
                <th className="py-2.5 px-4 text-right">Final Marks</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recent_at_risk.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                    No students currently fall in the At Risk (&lt;50) category.
                  </td>
                </tr>
              ) : (
                recent_at_risk.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-5 font-mono text-xs text-slate-600 tabular-nums">
                      {s.student_id}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{s.student_name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{s.subject}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {s.attendance_percentage.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {s.study_hours_per_day.toFixed(1)}h
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {s.internal_assessment_marks.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-red-700">
                      {s.final_exam_marks.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4">
                      <CategoryLabel category={s.category} compact />
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigatePredict(s)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        Simulate Intervention
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
