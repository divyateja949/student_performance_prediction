import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BrainCircuit,
  Download,
  Edit3,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError, api } from '../services/api';
import type { Student, StudentFormData, Suggestion } from '../types';
import { CategoryLabel } from '../components/CategoryBadge';
import { downloadReportCSV, downloadReportPDF } from '../utils/exportReport';

interface StudentsPageProps {
  onDataChanged: () => void;
  onPredictStudent: (student: Student) => void;
}

const EMPTY_FORM: StudentFormData = {
  student_id: '',
  student_name: '',
  age: '20',
  gender: 'Female',
  subject: 'Computer Science',
  attendance_percentage: '85',
  study_hours_per_day: '4.0',
  previous_exam_marks: '75',
  assignment_score: '80',
  internal_assessment_marks: '76',
  final_exam_marks: '78',
};

const PAGE_SIZE = 25;

function buildQuickSuggestions(s: Student): Suggestion[] {
  const list: Suggestion[] = [];
  if (s.attendance_percentage < 75) {
    list.push({
      area: 'Attendance',
      priority: 'High',
      title: 'Increase Class Attendance Above 80%',
      detail: `Current attendance (${s.attendance_percentage.toFixed(1)}%) is below the 75% threshold.`,
    });
  }
  if (s.study_hours_per_day < 2.5) {
    list.push({
      area: 'Study Habits',
      priority: 'High',
      title: 'Expand Structured Daily Study Time',
      detail: `Increasing daily study from ${s.study_hours_per_day.toFixed(1)} hrs toward 3.5+ hrs improves retention.`,
    });
  }
  if (s.internal_assessment_marks < 65) {
    list.push({
      area: 'Internal Assessments',
      priority: 'High',
      title: 'Targeted Coaching for Mid-Term Topics',
      detail: `Internal assessment (${s.internal_assessment_marks.toFixed(1)}/100) indicates need for focused review.`,
    });
  }
  if (list.length === 0) {
    list.push({
      area: 'Exam Strategy',
      priority: 'Low',
      title: 'Maintain Momentum with Mock Papers',
      detail: 'Academic indicators are balanced; continue timed practice tests for exam readiness.',
    });
  }
  return list;
}

export function StudentsPage({ onDataChanged, onPredictStudent }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [page, setPage] = useState(1);

  // Detail Drawer
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStudents({
        q: search,
        category: categoryFilter,
        subject: subjectFilter,
        gender: genderFilter,
      });
      setStudents(res.students);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student records.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, subjectFilter, genderFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return students.slice(start, start + PAGE_SIZE);
  }, [students, page]);

  const openAddModal = () => {
    const nextNum = 1001 + students.length + Math.floor(Math.random() * 90);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, student_id: `STU${nextNum}` });
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingId(s.student_id);
    setForm({
      student_id: s.student_id,
      student_name: s.student_name,
      age: String(s.age),
      gender: s.gender,
      subject: s.subject,
      attendance_percentage: String(s.attendance_percentage),
      study_hours_per_day: String(s.study_hours_per_day),
      previous_exam_marks: String(s.previous_exam_marks),
      assignment_score: String(s.assignment_score),
      internal_assessment_marks: String(s.internal_assessment_marks),
      final_exam_marks: String(s.final_exam_marks),
    });
    setFieldErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    try {
      if (editingId) {
        await api.updateStudent(editingId, form);
      } else {
        await api.createStudent(form);
      }
      setModalOpen(false);
      await fetchStudents();
      onDataChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to save student record.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteStudent(deleteTarget.student_id);
      if (inspectedStudent?.student_id === deleteTarget.student_id) {
        setInspectedStudent(null);
      }
      setDeleteTarget(null);
      await fetchStudents();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID, name, or subject..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {['All', 'Excellent', 'Good', 'Average', 'At Risk'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter by subject"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="All">All Subjects</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Data Science">Data Science</option>
            <option value="Economics">Economics</option>
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            aria-label="Filter by gender"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="All">All Genders</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Non-Binary">Non-Binary</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-mono font-semibold text-slate-900">{students.length}</span>{' '}
            matching student records · Click any row to inspect dossier
          </p>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            Page {page} of {totalPages}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">ID</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-3 text-right">Age</th>
                <th className="py-2.5 px-3">Gender</th>
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3 text-right">Attend.</th>
                <th className="py-2.5 px-3 text-right">Study Hrs</th>
                <th className="py-2.5 px-3 text-right">Prev.</th>
                <th className="py-2.5 px-3 text-right">Assign.</th>
                <th className="py-2.5 px-3 text-right">Internal</th>
                <th className="py-2.5 px-3 text-right">Final</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={13} className="py-3 px-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 text-sm">
                    No student records match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
                  <tr
                    key={s.student_id}
                    onClick={() => setInspectedStudent(s)}
                    className="hover:bg-blue-50/40 transition-colors h-10 cursor-pointer"
                  >
                    <td className="py-2 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {s.student_id}
                    </td>
                    <td className="py-2 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {s.student_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                      {s.age}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{s.gender}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{s.subject}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {s.attendance_percentage.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {s.study_hours_per_day.toFixed(1)}h
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {s.previous_exam_marks.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {s.assignment_score.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {s.internal_assessment_marks.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {s.final_exam_marks.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <CategoryLabel category={s.category} compact />
                    </td>
                    <td
                      className="py-2 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPredictStudent(s)}
                          title="Send to Predictor"
                          className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50"
                        >
                          <BrainCircuit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          title="Edit Student"
                          className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          title="Delete Student"
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, students.length)} of{' '}
              {students.length}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Student Detail Slide-over Drawer */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-40 bg-slate-900/35 flex justify-end">
          <div className="bg-white w-full max-w-md h-full border-l border-slate-200 p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {inspectedStudent.student_id} · {inspectedStudent.subject}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {inspectedStudent.student_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Age {inspectedStudent.age} · {inspectedStudent.gender}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedStudent(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700">Final Exam Marks</p>
                  <p className="text-3xl font-bold text-blue-950 font-mono tabular-nums mt-0.5">
                    {inspectedStudent.final_exam_marks.toFixed(1)}
                    <span className="text-sm font-normal text-blue-700"> / 100</span>
                  </p>
                </div>
                <CategoryLabel category={inspectedStudent.category} />
              </div>

              <div className="space-y-2.5 text-sm">
                {[
                  ['Attendance Percentage', `${inspectedStudent.attendance_percentage.toFixed(1)}%`],
                  ['Study Hours Per Day', `${inspectedStudent.study_hours_per_day.toFixed(1)} hrs`],
                  ['Previous Exam Marks', `${inspectedStudent.previous_exam_marks.toFixed(1)} / 100`],
                  ['Assignment Score', `${inspectedStudent.assignment_score.toFixed(1)} / 100`],
                  ['Internal Assessment Marks', `${inspectedStudent.internal_assessment_marks.toFixed(1)} / 100`],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 border-b border-slate-100"
                  >
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-mono font-semibold tabular-nums text-slate-900">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = inspectedStudent;
                  setInspectedStudent(null);
                  onPredictStudent(target);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2"
              >
                <BrainCircuit className="w-4 h-4" />
                <span>Simulate Score in ML Predictor</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    downloadReportPDF({
                      student_id: inspectedStudent.student_id,
                      student_name: inspectedStudent.student_name,
                      subject: inspectedStudent.subject,
                      attendance_percentage: inspectedStudent.attendance_percentage,
                      study_hours_per_day: inspectedStudent.study_hours_per_day,
                      previous_exam_marks: inspectedStudent.previous_exam_marks,
                      assignment_score: inspectedStudent.assignment_score,
                      internal_assessment_marks: inspectedStudent.internal_assessment_marks,
                      score_label: 'Recorded Final Exam Marks',
                      score_value: inspectedStudent.final_exam_marks,
                      category: inspectedStudent.category,
                      suggestions: buildQuickSuggestions(inspectedStudent),
                      generated_at: inspectedStudent.created_at,
                    })
                  }
                  className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadReportCSV({
                      student_id: inspectedStudent.student_id,
                      student_name: inspectedStudent.student_name,
                      subject: inspectedStudent.subject,
                      attendance_percentage: inspectedStudent.attendance_percentage,
                      study_hours_per_day: inspectedStudent.study_hours_per_day,
                      previous_exam_marks: inspectedStudent.previous_exam_marks,
                      assignment_score: inspectedStudent.assignment_score,
                      internal_assessment_marks: inspectedStudent.internal_assessment_marks,
                      score_label: 'Recorded Final Exam Marks',
                      score_value: inspectedStudent.final_exam_marks,
                      category: inspectedStudent.category,
                      suggestions: buildQuickSuggestions(inspectedStudent),
                      generated_at: inspectedStudent.created_at,
                    })
                  }
                  className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? `Update Student (${editingId})` : 'Add New Student Record'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={form.student_id}
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.student_id && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.student_id}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Student Name
                  </label>
                  <input
                    type="text"
                    value={form.student_name}
                    onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200"
                    required
                  />
                  {fieldErrors.student_name && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.student_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.age && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.age}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                  </select>
                  {fieldErrors.gender && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.gender}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
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
                    Attendance Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.attendance_percentage}
                    onChange={(e) => setForm({ ...form, attendance_percentage: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.attendance_percentage && (
                    <p className="text-xs text-red-600 mt-1">
                      {fieldErrors.attendance_percentage}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Study Hours Per Day
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.study_hours_per_day}
                    onChange={(e) => setForm({ ...form, study_hours_per_day: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.study_hours_per_day && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.study_hours_per_day}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Previous Exam Marks (/100)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.previous_exam_marks}
                    onChange={(e) => setForm({ ...form, previous_exam_marks: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.previous_exam_marks && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.previous_exam_marks}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assignment Score (/100)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.assignment_score}
                    onChange={(e) => setForm({ ...form, assignment_score: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.assignment_score && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.assignment_score}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Internal Assessment Marks (/100)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.internal_assessment_marks}
                    onChange={(e) =>
                      setForm({ ...form, internal_assessment_marks: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.internal_assessment_marks && (
                    <p className="text-xs text-red-600 mt-1">
                      {fieldErrors.internal_assessment_marks}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Final Exam Marks (/100)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.final_exam_marks}
                    onChange={(e) => setForm({ ...form, final_exam_marks: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 font-mono"
                    required
                  />
                  {fieldErrors.final_exam_marks && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.final_exam_marks}</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900">Delete Student Record?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-slate-900">
                {deleteTarget.student_name} ({deleteTarget.student_id})
              </span>{' '}
              from the SQLite database?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
