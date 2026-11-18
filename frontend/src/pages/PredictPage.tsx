import '../utils/chartSetup';
import { useEffect, useState } from 'react';
import { Bar, Radar } from 'react-chartjs-2';
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Download,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { ApiError, api } from '../services/api';
import type { PredictionResult, Student } from '../types';
import { CategoryLabel } from '../components/CategoryBadge';
import { downloadReportCSV, downloadReportPDF } from '../utils/exportReport';

interface PredictPageProps {
  prefillStudent: Student | null;
  onClearPrefill: () => void;
  onPredictionCreated: () => void;
}

const PRESETS = [
  {
    label: 'High Achiever',
    values: {
      student_name: 'Sample High Achiever',
      attendance_percentage: '94',
      study_hours_per_day: '6.2',
      previous_exam_marks: '86',
      assignment_score: '90',
      internal_assessment_marks: '88',
    },
  },
  {
    label: 'Average Profile',
    values: {
      student_name: 'Sample Average Student',
      attendance_percentage: '74',
      study_hours_per_day: '3.0',
      previous_exam_marks: '62',
      assignment_score: '65',
      internal_assessment_marks: '61',
    },
  },
  {
    label: 'At-Risk Profile',
    values: {
      student_name: 'Sample At-Risk Student',
      attendance_percentage: '52',
      study_hours_per_day: '1.4',
      previous_exam_marks: '41',
      assignment_score: '45',
      internal_assessment_marks: '39',
    },
  },
];

export function PredictPage({
  prefillStudent,
  onClearPrefill,
  onPredictionCreated,
}: PredictPageProps) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [attendance, setAttendance] = useState('82');
  const [studyHours, setStudyHours] = useState('4.2');
  const [previousMarks, setPreviousMarks] = useState('74');
  const [assignmentScore, setAssignmentScore] = useState('78');
  const [internalMarks, setInternalMarks] = useState('75');
  const [modelChoice, setModelChoice] = useState<'best' | 'random_forest' | 'linear_regression'>('best');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);

  useEffect(() => {
    if (prefillStudent) {
      setStudentId(prefillStudent.student_id);
      setStudentName(prefillStudent.student_name);
      setSubject(prefillStudent.subject || 'Computer Science');
      setAttendance(String(prefillStudent.attendance_percentage));
      setStudyHours(String(prefillStudent.study_hours_per_day));
      setPreviousMarks(String(prefillStudent.previous_exam_marks));
      setAssignmentScore(String(prefillStudent.assignment_score));
      setInternalMarks(String(prefillStudent.internal_assessment_marks));
      setFieldErrors({});
      setFormError(null);
      onClearPrefill();
    }
  }, [prefillStudent, onClearPrefill]);

  const validateClient = () => {
    const errs: Record<string, string> = {};
    const checkRange = (val: string, key: string, label: string, min: number, max: number) => {
      if (val.trim() === '') {
        errs[key] = `${label} is required.`;
        return;
      }
      const num = Number(val);
      if (Number.isNaN(num) || num < min || num > max) {
        errs[key] = `${label} must be between ${min} and ${max}.`;
      }
    };

    checkRange(attendance, 'attendance_percentage', 'Attendance Percentage', 0, 100);
    checkRange(studyHours, 'study_hours_per_day', 'Daily Study Hours', 0, 16);
    checkRange(previousMarks, 'previous_exam_marks', 'Previous Exam Marks', 0, 100);
    checkRange(assignmentScore, 'assignment_score', 'Assignment Score', 0, 100);
    checkRange(internalMarks, 'internal_assessment_marks', 'Internal Assessment Marks', 0, 100);
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clientErrs = validateClient();
    if (Object.keys(clientErrs).length > 0) {
      setFieldErrors(clientErrs);
      setFormError('Please correct the highlighted fields before predicting.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await api.predictPerformance({
        student_id: studentId.trim() || undefined,
        student_name: studentName.trim() || undefined,
        subject,
        attendance_percentage: Number(attendance),
        study_hours_per_day: Number(studyHours),
        previous_exam_marks: Number(previousMarks),
        assignment_score: Number(assignmentScore),
        internal_assessment_marks: Number(internalMarks),
        model_choice: modelChoice,
      });
      setResult(res);
      onPredictionCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to connect to the prediction service.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setStudentId('');
    setStudentName(preset.values.student_name);
    setAttendance(preset.values.attendance_percentage);
    setStudyHours(preset.values.study_hours_per_day);
    setPreviousMarks(preset.values.previous_exam_marks);
    setAssignmentScore(preset.values.assignment_score);
    setInternalMarks(preset.values.internal_assessment_marks);
    setFieldErrors({});
    setFormError(null);
  };

  const handleReset = () => {
    setStudentId('');
    setStudentName('');
    setSubject('Computer Science');
    setAttendance('80');
    setStudyHours('4.0');
    setPreviousMarks('72');
    setAssignmentScore('75');
    setInternalMarks('74');
    setFieldErrors({});
    setFormError(null);
    setResult(null);
  };

  const radarData = result
    ? {
        labels: [
          'Attendance (%)',
          'Study Hours (Scaled)',
          'Previous Exam',
          'Assignment Score',
          'Internal Marks',
        ],
        datasets: [
          {
            label: 'Student Inputs',
            data: [
              result.inputs.attendance_percentage,
              Math.min(100, result.inputs.study_hours_per_day * 12.5),
              result.inputs.previous_exam_marks,
              result.inputs.assignment_score,
              result.inputs.internal_assessment_marks,
            ],
            backgroundColor: 'rgba(29, 78, 216, 0.16)',
            borderColor: '#1D4ED8',
            borderWidth: 2,
            pointBackgroundColor: '#1D4ED8',
          },
          {
            label: 'Excellent Benchmark (85+)',
            data: [90, 75, 85, 85, 85],
            backgroundColor: 'rgba(5, 150, 105, 0.06)',
            borderColor: '#059669',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 2,
          },
        ],
      }
    : null;

  const comparisonBarData = result
    ? {
        labels: [
          'Attendance',
          'Previous Exam',
          'Assignment',
          'Internal',
          'Linear Reg.',
          'Random Forest',
        ],
        datasets: [
          {
            label: 'Score (/100)',
            data: [
              result.inputs.attendance_percentage,
              result.inputs.previous_exam_marks,
              result.inputs.assignment_score,
              result.inputs.internal_assessment_marks,
              result.linear_prediction,
              result.rf_prediction,
            ],
            backgroundColor: [
              '#94A3B8',
              '#94A3B8',
              '#94A3B8',
              '#94A3B8',
              '#0EA5E9',
              '#1D4ED8',
            ],
            borderRadius: 6,
          },
        ],
      }
    : null;

  const numericInputs = [
    {
      key: 'attendance_percentage',
      label: 'Attendance Percentage',
      unit: '%',
      value: attendance,
      setter: setAttendance,
      min: 0,
      max: 100,
      step: 0.5,
    },
    {
      key: 'study_hours_per_day',
      label: 'Daily Study Hours',
      unit: 'hrs',
      value: studyHours,
      setter: setStudyHours,
      min: 0,
      max: 12,
      step: 0.1,
    },
    {
      key: 'previous_exam_marks',
      label: 'Previous Exam Marks',
      unit: '/100',
      value: previousMarks,
      setter: setPreviousMarks,
      min: 0,
      max: 100,
      step: 0.5,
    },
    {
      key: 'assignment_score',
      label: 'Assignment Score',
      unit: '/100',
      value: assignmentScore,
      setter: setAssignmentScore,
      min: 0,
      max: 100,
      step: 0.5,
    },
    {
      key: 'internal_assessment_marks',
      label: 'Internal Assessment Marks',
      unit: '/100',
      value: internalMarks,
      setter: setInternalMarks,
      min: 0,
      max: 100,
      step: 0.5,
    },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Interactive Input Simulator */}
      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Performance Simulator Inputs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust sliders or type values to evaluate student outcome
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Quick Test Presets */}
        <div className="mt-4">
          <span className="text-[11px] font-medium text-slate-500 block mb-2">
            Test profile presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {formError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Optional Student Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Student ID <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. STU1042"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Student Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Ananya Nair"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="Computer Science">Computer Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Physics">Physics</option>
                <option value="Data Science">Data Science</option>
                <option value="Economics">Economics</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Regression Model
              </label>
              <select
                value={modelChoice}
                onChange={(e) =>
                  setModelChoice(e.target.value as 'best' | 'random_forest' | 'linear_regression')
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="best">Auto-Selected Best Model</option>
                <option value="random_forest">Random Forest Regression</option>
                <option value="linear_regression">Linear Regression</option>
              </select>
            </div>
          </div>

          {/* Synchronized Sliders + Numeric Inputs */}
          <div className="pt-3 border-t border-slate-100 space-y-4">
            {numericInputs.map((item) => (
              <div key={item.key}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-700">{item.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step={item.step}
                      min={item.min}
                      max={item.key === 'study_hours_per_day' ? 16 : item.max}
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                      className={`w-20 px-2 py-1 text-right text-xs font-mono tabular-nums font-semibold rounded-md border focus:outline-none ${
                        fieldErrors[item.key]
                          ? 'border-red-400 text-red-700'
                          : 'border-slate-200 text-slate-900 focus:border-blue-600'
                      }`}
                    />
                    <span className="text-[11px] text-slate-400 w-7">{item.unit}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={Math.min(item.max, Math.max(item.min, Number(item.value) || 0))}
                  onChange={(e) => item.setter(e.target.value)}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
                />
                {fieldErrors[item.key] && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors[item.key]}</p>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>{submitting ? 'Running Scikit-learn Model...' : 'Predict Performance'}</span>
          </button>
        </form>
      </div>

      {/* Right Prediction Output Panel */}
      <div className="xl:col-span-7 space-y-6">
        {!result ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[460px]">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Ready to Predict Final Exam Performance
            </h3>
            <p className="text-sm text-slate-500 max-w-md mt-1.5">
              Adjust the interactive sliders on the left and click{' '}
              <span className="font-semibold text-slate-700">Predict Performance</span> to evaluate
              with the trained Scikit-learn regressor.
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left w-full max-w-lg pt-6 border-t border-slate-100">
              <div>
                <p className="text-xs font-semibold text-emerald-700">85–100</p>
                <p className="text-xs text-slate-500">Excellent</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700">70–84</p>
                <p className="text-xs text-slate-500">Good</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700">50–69</p>
                <p className="text-xs text-slate-500">Average</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700">Below 50</p>
                <p className="text-xs text-slate-500">At Risk</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Score Hero Card + Band Meter */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <p className="text-xs text-slate-500">
                    {result.student_id} · {result.student_name} · {result.subject}
                  </p>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-4xl font-bold text-slate-900 font-mono tabular-nums">
                      {result.predicted_marks.toFixed(1)}
                    </span>
                    <span className="text-sm text-slate-500 font-mono">/ 100 Predicted Marks</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <CategoryLabel category={result.category} />
                    <span className="text-xs text-slate-500">
                      Model: <span className="font-medium text-slate-700">{result.model_used}</span>
                    </span>
                  </div>
                </div>

                {/* Export PDF / CSV Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadReportPDF({
                        student_id: result.student_id,
                        student_name: result.student_name,
                        subject: result.subject,
                        ...result.inputs,
                        score_label: 'Predicted Final Exam Marks',
                        score_value: result.predicted_marks,
                        category: result.category,
                        model_used: result.model_used,
                        linear_prediction: result.linear_prediction,
                        rf_prediction: result.rf_prediction,
                        suggestions: result.suggestions,
                        generated_at: result.created_at,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadReportCSV({
                        student_id: result.student_id,
                        student_name: result.student_name,
                        subject: result.subject,
                        ...result.inputs,
                        score_label: 'Predicted Final Exam Marks',
                        score_value: result.predicted_marks,
                        category: result.category,
                        model_used: result.model_used,
                        linear_prediction: result.linear_prediction,
                        rf_prediction: result.rf_prediction,
                        suggestions: result.suggestions,
                        generated_at: result.created_at,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Performance Band Meter */}
              <div className="py-4 border-b border-slate-100">
                <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1.5">
                  <span>At Risk (0–49)</span>
                  <span>Average (50–69)</span>
                  <span>Good (70–84)</span>
                  <span>Excellent (85–100)</span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden flex bg-slate-100">
                  <div className="w-[50%] bg-red-200" />
                  <div className="w-[20%] bg-amber-200" />
                  <div className="w-[15%] bg-blue-200" />
                  <div className="w-[15%] bg-emerald-200" />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-slate-900"
                    style={{ left: `calc(${Math.min(99, Math.max(1, result.predicted_marks))}% - 2px)` }}
                  />
                </div>
              </div>

              {/* Dual-Model Prediction Cross-Check */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div>
                  <p className="text-xs text-slate-500">Random Forest Estimate</p>
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    {result.rf_prediction.toFixed(1)} / 100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Linear Regression Estimate</p>
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    {result.linear_prediction.toFixed(1)} / 100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Inter-Model Variance</p>
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    ±{Math.abs(result.rf_prediction - result.linear_prediction).toFixed(1)} pts
                  </p>
                </div>
              </div>
            </div>

            {/* Graphical Representation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Profile vs Benchmark Radar
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Normalized comparison against top-tier targets
                </p>
                <div className="h-[230px] flex items-center justify-center">
                  {radarData && (
                    <Radar
                      data={radarData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          r: {
                            min: 0,
                            max: 100,
                            ticks: { stepSize: 25, display: false },
                            pointLabels: { font: { size: 10 } },
                          },
                        },
                        plugins: {
                          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                        },
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Inputs & Model Output Breakdown
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Side-by-side comparison of raw scores & ML forecasts
                </p>
                <div className="h-[230px]">
                  {comparisonBarData && (
                    <Bar
                      data={comparisonBarData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: { min: 0, max: 100, grid: { color: '#F1F5F9' } },
                          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        },
                        plugins: { legend: { display: false } },
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Personalized Suggestions */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900">
                Personalized Improvement Recommendations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">
                Actionable steps derived from the student&apos;s lowest-performing predictive factors
              </p>
              <div className="divide-y divide-slate-100">
                {result.suggestions.map((s, idx) => (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        s.priority === 'High'
                          ? 'text-red-600'
                          : s.priority === 'Medium'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-500">
                          {s.area} ({s.priority} Priority)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
