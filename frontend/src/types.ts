export type PerformanceCategory = 'Excellent' | 'Good' | 'Average' | 'At Risk';

export interface Student {
  id: number;
  student_id: string;
  student_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Non-Binary' | 'Other';
  subject: string;
  attendance_percentage: number;
  study_hours_per_day: number;
  previous_exam_marks: number;
  assignment_score: number;
  internal_assessment_marks: number;
  final_exam_marks: number;
  category: PerformanceCategory;
  created_at: string;
}

export interface StudentFormData {
  student_id: string;
  student_name: string;
  age: string | number;
  gender: string;
  subject: string;
  attendance_percentage: string | number;
  study_hours_per_day: string | number;
  previous_exam_marks: string | number;
  assignment_score: string | number;
  internal_assessment_marks: string | number;
  final_exam_marks: string | number;
}

export interface ScatterPoint {
  x: number;
  y: number;
  student_name: string;
  student_id: string;
  category: PerformanceCategory;
}

export interface SubjectPerformance {
  subject: string;
  count: number;
  avg_final_marks: number;
  avg_attendance: number;
  avg_internal_marks: number;
}

export interface DashboardData {
  kpis: {
    total_students: number;
    average_marks: number;
    average_attendance: number;
    average_study_hours: number;
    performing_well: number;
    at_risk: number;
    excellent_count: number;
  };
  distribution: Record<PerformanceCategory, number>;
  subject_performance: SubjectPerformance[];
  attendance_vs_marks: ScatterPoint[];
  study_hours_vs_marks: ScatterPoint[];
  recent_at_risk: Student[];
}

export interface Suggestion {
  area: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  detail: string;
}

export interface PredictionResult {
  report_id: number;
  student_id: string;
  student_name: string;
  subject: string;
  inputs: {
    attendance_percentage: number;
    study_hours_per_day: number;
    previous_exam_marks: number;
    assignment_score: number;
    internal_assessment_marks: number;
  };
  predicted_marks: number;
  linear_prediction: number;
  rf_prediction: number;
  model_used: string;
  category: PerformanceCategory;
  suggestions: Suggestion[];
  created_at: string;
}

export interface ModelMetrics {
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
}

export interface MLMetadata {
  data_source: string;
  train_samples: number;
  test_samples: number;
  split_ratio: string;
  features: string[];
  target: string;
  preprocessing: {
    raw_rows: number;
    cleaned_rows: number;
    duplicates_removed: number;
    missing_values_detected: number;
    missing_by_column: Record<string, number>;
    missing_values_after_cleaning: number;
    imputation_strategy: string;
    imputation_values: Record<string, number>;
  };
  eda: {
    correlations_with_final_marks: Record<string, number>;
    summary_statistics: Record<
      string,
      {
        mean: number;
        std: number;
        min: number;
        median: number;
        max: number;
      }
    >;
  };
  models: {
    linear_regression: {
      name: string;
      metrics: ModelMetrics;
      intercept: number;
    };
    random_forest: {
      name: string;
      metrics: ModelMetrics;
      n_estimators: number;
      max_depth: number;
    };
  };
  selected_model: {
    key: string;
    name: string;
    reason: string;
    metrics: ModelMetrics;
  };
  feature_importance: Array<{
    feature: string;
    label: string;
    random_forest_importance: number;
    linear_regression_weight: number;
    linear_coefficient: number;
  }>;
  actual_vs_predicted: Array<{
    student_id: string;
    student_name: string;
    actual: number;
    linear_predicted: number;
    rf_predicted: number;
    best_predicted: number;
  }>;
}

export interface PredictionReportRow {
  id: number;
  student_id: string;
  student_name: string;
  subject: string;
  attendance_percentage: number;
  study_hours_per_day: number;
  previous_exam_marks: number;
  assignment_score: number;
  internal_assessment_marks: number;
  predicted_marks: number;
  linear_prediction: number;
  rf_prediction: number;
  model_used: string;
  performance_category: PerformanceCategory;
  suggestions: Suggestion[];
  created_at: string;
}

export interface StudentReportRow extends Student {
  suggestions: Suggestion[];
}

export interface ReportsResponse {
  prediction_reports: PredictionReportRow[];
  student_reports: StudentReportRow[];
}
