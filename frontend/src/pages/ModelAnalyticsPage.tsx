import '../utils/chartSetup';
import { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { MLMetadata } from '../types';

interface ModelAnalyticsPageProps {
  metadata: MLMetadata | null;
  loading: boolean;
  onRetrained: (meta: MLMetadata) => void;
}

const FEATURE_DISPLAY: Record<string, string> = {
  attendance_percentage: 'Attendance (%)',
  study_hours_per_day: 'Study Hours / Day',
  previous_exam_marks: 'Previous Exam Marks',
  assignment_score: 'Assignment Score',
  internal_assessment_marks: 'Internal Assessment',
  final_exam_marks: 'Final Exam Marks (Target)',
};

export function ModelAnalyticsPage({
  metadata,
  loading,
  onRetrained,
}: ModelAnalyticsPageProps) {
  const [retraining, setRetraining] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainMessage(null);
    try {
      const res = await api.retrainModels('sqlite');
      onRetrained(res.metadata);
      setRetrainMessage(res.message);
    } catch (err) {
      setRetrainMessage(err instanceof Error ? err.message : 'Retraining failed.');
    } finally {
      setRetraining(false);
    }
  };

  if (loading || !metadata) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl h-40 animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse" />
      </div>
    );
  }

  const { preprocessing, models, selected_model, actual_vs_predicted, feature_importance, eda } =
    metadata;

  const actualVsPredictedChart = {
    labels: actual_vs_predicted.slice(0, 35).map((p) => p.student_id),
    datasets: [
      {
        label: 'Actual Final Marks',
        data: actual_vs_predicted.slice(0, 35).map((p) => p.actual),
        borderColor: '#0F172A',
        backgroundColor: '#0F172A',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
      },
      {
        label: 'Random Forest Predicted',
        data: actual_vs_predicted.slice(0, 35).map((p) => p.rf_predicted),
        borderColor: '#1D4ED8',
        backgroundColor: 'rgba(29, 78, 216, 0.1)',
        borderWidth: 2,
        pointRadius: 2.5,
        tension: 0.25,
      },
      {
        label: 'Linear Regression Predicted',
        data: actual_vs_predicted.slice(0, 35).map((p) => p.linear_predicted),
        borderColor: '#0EA5E9',
        borderDash: [4, 4],
        borderWidth: 1.8,
        pointRadius: 2,
        tension: 0.25,
      },
    ],
  };

  const featureImportanceChart = {
    labels: feature_importance.map((f) => f.label),
    datasets: [
      {
        label: 'Random Forest Importance',
        data: feature_importance.map((f) => Number((f.random_forest_importance * 100).toFixed(1))),
        backgroundColor: '#1D4ED8',
        borderRadius: 6,
      },
      {
        label: 'Linear Regression Weight (%)',
        data: feature_importance.map((f) => Number((f.linear_regression_weight * 100).toFixed(1))),
        backgroundColor: '#93C5FD',
        borderRadius: 6,
      },
    ],
  };

  const correlationChart = {
    labels: Object.keys(eda.correlations_with_final_marks).map(
      (k) => FEATURE_DISPLAY[k] || k
    ),
    datasets: [
      {
        label: 'Pearson r with Final Exam Marks',
        data: Object.values(eda.correlations_with_final_marks),
        backgroundColor: '#0F766E',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Selected Model & Retrain Header Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>Selected Production Model: {selected_model.name}</span>
          </div>
          <p className="text-sm text-slate-700 max-w-3xl">{selected_model.reason}</p>
          <p className="text-xs text-slate-500">
            Source: {metadata.data_source} · Split: {metadata.split_ratio} ({metadata.train_samples}{' '}
            train / {metadata.test_samples} test) · Saved via Joblib
          </p>
        </div>

        <button
          type="button"
          disabled={retraining}
          onClick={handleRetrain}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
          <span>{retraining ? 'Retraining Models...' : 'Retrain on SQLite Dataset'}</span>
        </button>
      </section>

      {retrainMessage && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800">
          {retrainMessage}
        </div>
      )}

      {/* Model Comparison Metrics & Preprocessing Pipeline */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Scikit-learn Model Evaluation Metrics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluated on {metadata.test_samples} held-out test records (lower error &amp; higher R²
              wins)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Regression Model</th>
                  <th className="py-3 px-4 text-right">MAE</th>
                  <th className="py-3 px-4 text-right">MSE</th>
                  <th className="py-3 px-4 text-right">RMSE</th>
                  <th className="py-3 px-4 text-right">R² Score</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {[
                  { key: 'linear_regression', data: models.linear_regression },
                  { key: 'random_forest', data: models.random_forest },
                ].map(({ key, data }) => {
                  const isWinner = selected_model.key === key;
                  return (
                    <tr key={key} className={isWinner ? 'bg-blue-50/40' : ''}>
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{data.name}</td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {data.metrics.mae.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {data.metrics.mse.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {data.metrics.rmse.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-blue-700">
                        {data.metrics.r2.toFixed(4)}
                      </td>
                      <td className="py-3.5 px-5 text-xs font-semibold">
                        {isWinner ? (
                          <span className="text-emerald-700">Selected Best</span>
                        ) : (
                          <span className="text-slate-500">Baseline</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preprocessing & Data Cleaning Report */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Data Cleaning &amp; Preprocessing Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated Pandas sanitization before model training
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
              <p className="text-slate-500">Raw Records Loaded</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {preprocessing.raw_rows}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
              <p className="text-slate-500">Cleaned Records</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {preprocessing.cleaned_rows}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
              <p className="text-slate-500">Missing Values Imputed</p>
              <p className="text-lg font-bold text-blue-700 font-mono tabular-nums mt-0.5">
                {preprocessing.missing_values_detected} → {preprocessing.missing_values_after_cleaning}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
              <p className="text-slate-500">Strategy</p>
              <p className="text-xs font-semibold text-slate-900 mt-1.5">
                {preprocessing.imputation_strategy}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Actual vs Predicted Marks Comparison Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Actual vs Predicted Final Exam Marks (Test Set Sample)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparing ground-truth test scores against Random Forest and Linear Regression outputs
          </p>
        </div>
        <div className="h-[300px]">
          <Line
            data={actualVsPredictedChart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  min: 15,
                  max: 100,
                  grid: { color: '#F1F5F9' },
                  title: { display: true, text: 'Exam Marks (/100)', font: { size: 11 } },
                },
                x: {
                  grid: { display: false },
                  ticks: { maxRotation: 45, font: { size: 10 } },
                },
              },
              plugins: {
                legend: { position: 'top', align: 'end', labels: { boxWidth: 12 } },
              },
            }}
          />
        </div>
      </section>

      {/* Feature Importance & Exploratory Data Analysis Correlations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Feature Importance Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Relative predictive weight assigned by Random Forest vs Linear Regression
            </p>
          </div>
          <div className="h-[260px]">
            <Bar
              data={featureImportanceChart}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    min: 0,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Relative Weight (%)', font: { size: 11 } },
                  },
                  y: { grid: { display: false } },
                },
                plugins: {
                  legend: { position: 'top', align: 'end', labels: { boxWidth: 12 } },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Exploratory Data Analysis: Feature Correlations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pearson correlation coefficient (r) between each predictor and Final Exam Marks
            </p>
          </div>
          <div className="h-[260px]">
            <Bar
              data={correlationChart}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    min: 0,
                    max: 1,
                    grid: { color: '#F1F5F9' },
                    title: { display: true, text: 'Pearson r', font: { size: 11 } },
                  },
                  y: { grid: { display: false } },
                },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
        </div>
      </section>

      {/* EDA Summary Statistics Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Exploratory Data Analysis Summary Statistics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribution metrics across all numeric features after cleaning
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-5">Feature</th>
                <th className="py-2.5 px-4 text-right">Mean</th>
                <th className="py-2.5 px-4 text-right">Std Dev</th>
                <th className="py-2.5 px-4 text-right">Min</th>
                <th className="py-2.5 px-4 text-right">Median</th>
                <th className="py-2.5 px-5 text-right">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {Object.entries(eda.summary_statistics).map(([col, stats]) => (
                <tr key={col} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-5 font-medium text-slate-900">
                    {FEATURE_DISPLAY[col] || col}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {stats.mean.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {stats.std.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {stats.min.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {stats.median.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono tabular-nums text-slate-700">
                    {stats.max.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
