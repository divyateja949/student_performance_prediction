import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { PredictionReportRow, ReportsResponse, StudentReportRow } from '../types';
import { CategoryLabel } from '../components/CategoryBadge';
import {
  downloadReportCSV,
  downloadReportPDF,
  type PrintableReportPayload,
} from '../utils/exportReport';

export function ReportsPage() {
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<'predictions' | 'students'>('predictions');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReports();
      setReports(data);
      if (data.prediction_reports.length > 0) {
        setSelectedKey(`pred-${data.prediction_reports[0].id}`);
      } else if (data.student_reports.length > 0) {
        setSelectedKey(`stu-${data.student_reports[0].student_id}`);
        setSourceTab('students');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const filteredPredictions = useMemo(() => {
    if (!reports) return [];
    const q = query.trim().toLowerCase();
    return reports.prediction_reports.filter(
      (r) =>
        !q ||
        r.student_id.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q)
    );
  }, [reports, query]);

  const filteredStudents = useMemo(() => {
    if (!reports) return [];
    const q = query.trim().toLowerCase();
    return reports.student_reports.filter(
      (r) =>
        !q ||
        r.student_id.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q)
    );
  }, [reports, query]);

  const activeReport: PrintableReportPayload | null = useMemo(() => {
    if (!reports || !selectedKey) return null;
    if (selectedKey.startsWith('pred-')) {
      const id = Number(selectedKey.replace('pred-', ''));
      const found: PredictionReportRow | undefined = reports.prediction_reports.find(
        (r) => r.id === id
      );
      if (!found) return null;
      return {
        student_id: found.student_id,
        student_name: found.student_name,
        subject: found.subject,
        attendance_percentage: found.attendance_percentage,
        study_hours_per_day: found.study_hours_per_day,
        previous_exam_marks: found.previous_exam_marks,
        assignment_score: found.assignment_score,
        internal_assessment_marks: found.internal_assessment_marks,
        score_label: 'Predicted Final Exam Marks',
        score_value: found.predicted_marks,
        category: found.performance_category,
        model_used: found.model_used,
        linear_prediction: found.linear_prediction,
        rf_prediction: found.rf_prediction,
        suggestions: found.suggestions,
        generated_at: found.created_at,
      };
    } else {
      const sid = selectedKey.replace('stu-', '');
      const found: StudentReportRow | undefined = reports.student_reports.find(
        (r) => r.student_id === sid
      );
      if (!found) return null;
      return {
        student_id: found.student_id,
        student_name: found.student_name,
        subject: found.subject,
        attendance_percentage: found.attendance_percentage,
        study_hours_per_day: found.study_hours_per_day,
        previous_exam_marks: found.previous_exam_marks,
        assignment_score: found.assignment_score,
        internal_assessment_marks: found.internal_assessment_marks,
        score_label: 'Recorded Final Exam Marks',
        score_value: found.final_exam_marks,
        category: found.category,
        suggestions: found.suggestions,
        generated_at: found.created_at,
      };
    }
  }, [reports, selectedKey]);

  const handleDeletePredictionReport = async (id: number) => {
    await api.deleteReport(id);
    await loadReports();
  };

  if (loading && !reports) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl h-96 animate-pulse" />
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl h-96 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left List */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSourceTab('predictions')}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                sourceTab === 'predictions'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ML Predictions ({reports?.prediction_reports.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('students')}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                sourceTab === 'students'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student Roster ({reports?.student_reports.length || 0})
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter reports by ID, name, or subject..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
          {sourceTab === 'predictions' ? (
            filteredPredictions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No prediction reports logged yet. Run a prediction on the Predict Performance page
                to generate one, or switch to Student Roster.
              </div>
            ) : (
              filteredPredictions.map((p) => {
                const key = `pred-${p.id}`;
                const active = selectedKey === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`p-4 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                      active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {p.student_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {p.student_id} · {p.subject}
                      </p>
                      <div className="mt-1.5">
                        <CategoryLabel category={p.performance_category} compact />
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {p.predicted_marks.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePredictionReport(p.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No student records match your filter.
            </div>
          ) : (
            filteredStudents.map((s) => {
              const key = `stu-${s.student_id}`;
              const active = selectedKey === key;
              return (
                <div
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`p-4 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {s.student_name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {s.student_id} · {s.subject}
                    </p>
                    <div className="mt-1.5">
                      <CategoryLabel category={s.category} compact />
                    </div>
                  </div>
                  <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {s.final_exam_marks.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Report Preview */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
        {!activeReport ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Select a student or prediction entry from the list to inspect and export their report.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  {activeReport.student_id} · {activeReport.subject}
                </p>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {activeReport.student_name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <CategoryLabel category={activeReport.category} />
                  {activeReport.model_used && (
                    <span className="text-xs text-slate-500">
                      · Model: {activeReport.model_used}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadReportPDF(activeReport)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportCSV(activeReport)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Score & Input Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">{activeReport.score_label}</p>
                <p className="text-2xl font-bold text-blue-900 font-mono tabular-nums mt-1">
                  {activeReport.score_value.toFixed(1)} / 100
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500">Attendance</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {activeReport.attendance_percentage.toFixed(1)}%
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500">Daily Study Hours</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {activeReport.study_hours_per_day.toFixed(1)} hrs/day
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500">Previous Exam Marks</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {activeReport.previous_exam_marks.toFixed(1)} / 100
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500">Assignment Score</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {activeReport.assignment_score.toFixed(1)} / 100
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500">Internal Assessment</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  {activeReport.internal_assessment_marks.toFixed(1)} / 100
                </p>
              </div>
            </div>

            {/* Improvement Suggestions */}
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Personalized Improvement Recommendations
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg px-4">
                {activeReport.suggestions.map((s, idx) => (
                  <div key={idx} className="py-3 flex items-start gap-3">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        s.priority === 'High'
                          ? 'text-red-600'
                          : s.priority === 'Medium'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {s.title}{' '}
                        <span className="font-normal text-slate-500">
                          · {s.area} ({s.priority} Priority)
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
