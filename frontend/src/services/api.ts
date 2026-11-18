import type {
  DashboardData,
  MLMetadata,
  PredictionResult,
  ReportsResponse,
  Student,
  StudentFormData,
} from '../types';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${res.status}`,
      res.status,
      data.field_errors
    );
  }
  return data as T;
}

export const api = {
  getHealth: () =>
    request<{ status: string; students_count: number; selected_model: string }>('/api/health'),

  getDashboard: () => request<DashboardData>('/api/dashboard'),

  getStudents: (params?: {
    q?: string;
    category?: string;
    gender?: string;
    subject?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.category && params.category !== 'All') sp.set('category', params.category);
    if (params?.gender && params.gender !== 'All') sp.set('gender', params.gender);
    if (params?.subject && params.subject !== 'All') sp.set('subject', params.subject);
    const qs = sp.toString();
    return request<{ students: Student[]; total: number }>(
      `/api/students${qs ? `?${qs}` : ''}`
    );
  },

  createStudent: (payload: StudentFormData) =>
    request<{ student: Student; message: string }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStudent: (studentId: string, payload: StudentFormData) =>
    request<{ student: Student; message: string }>(
      `/api/students/${encodeURIComponent(studentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  deleteStudent: (studentId: string) =>
    request<{ message: string }>(`/api/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    }),

  predictPerformance: (payload: {
    student_id?: string;
    student_name?: string;
    subject?: string;
    attendance_percentage: number;
    study_hours_per_day: number;
    previous_exam_marks: number;
    assignment_score: number;
    internal_assessment_marks: number;
    model_choice?: 'best' | 'linear_regression' | 'random_forest';
  }) =>
    request<PredictionResult>('/api/predict', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMLMetrics: () => request<MLMetadata>('/api/ml/metrics'),

  retrainModels: (source: 'sqlite' | 'csv' = 'sqlite') =>
    request<{ message: string; metadata: MLMetadata }>('/api/ml/retrain', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),

  getReports: () => request<ReportsResponse>('/api/reports'),

  deleteReport: (id: number) =>
    request<{ message: string }>(`/api/reports/${id}`, {
      method: 'DELETE',
    }),
};
