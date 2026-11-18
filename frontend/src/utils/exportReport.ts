import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PerformanceCategory, Suggestion } from '../types';

export interface PrintableReportPayload {
  student_id: string;
  student_name: string;
  subject: string;
  attendance_percentage: number;
  study_hours_per_day: number;
  previous_exam_marks: number;
  assignment_score: number;
  internal_assessment_marks: number;
  score_label: string;
  score_value: number;
  category: PerformanceCategory;
  model_used?: string;
  linear_prediction?: number;
  rf_prediction?: number;
  suggestions: Suggestion[];
  generated_at: string;
}

export function downloadReportCSV(report: PrintableReportPayload) {
  const rows: Array<[string, string]> = [
    ['Report Title', 'Student Performance Prediction Report'],
    ['Generated At', new Date(report.generated_at).toLocaleString()],
    ['Student ID', report.student_id],
    ['Student Name', report.student_name],
    ['Subject', report.subject],
    ['Attendance Percentage (%)', String(report.attendance_percentage)],
    ['Daily Study Hours', String(report.study_hours_per_day)],
    ['Previous Exam Marks (/100)', String(report.previous_exam_marks)],
    ['Assignment Score (/100)', String(report.assignment_score)],
    ['Internal Assessment Marks (/100)', String(report.internal_assessment_marks)],
    [report.score_label, `${report.score_value} / 100`],
    ['Performance Category', report.category],
  ];

  if (report.model_used) {
    rows.push(['ML Model Used', report.model_used]);
  }
  if (typeof report.linear_prediction === 'number') {
    rows.push(['Linear Regression Prediction', `${report.linear_prediction} / 100`]);
  }
  if (typeof report.rf_prediction === 'number') {
    rows.push(['Random Forest Prediction', `${report.rf_prediction} / 100`]);
  }

  rows.push(['', '']);
  rows.push(['Personalized Improvement Suggestions', 'Details']);
  report.suggestions.forEach((s, idx) => {
    rows.push([`${idx + 1}. [${s.priority}] ${s.title} (${s.area})`, s.detail]);
  });

  const csvContent = rows
    .map(([k, v]) => `"${String(k).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`)
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeId = report.student_id.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `student_report_${safeId}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadReportPDF(report: PrintableReportPayload) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(30, 64, 175); // #1E40AF
  doc.rect(0, 0, pageWidth, 84, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Student Performance Prediction Report', 40, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(219, 234, 254);
  doc.text(
    `Academic Analytics & Machine Learning Assessment  |  Generated ${new Date(report.generated_at).toLocaleDateString()}`,
    40,
    58
  );

  // Student Profile Summary
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Student Profile & Evaluation Result', 40, 118);

  autoTable(doc, {
    startY: 130,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 8, textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 180 } },
    body: [
      ['Student ID', report.student_id],
      ['Student Name', report.student_name],
      ['Subject', report.subject],
      [report.score_label, `${report.score_value} / 100`],
      ['Performance Category', report.category],
      ...(report.model_used ? [['Model Used', report.model_used]] : []),
    ],
  });

  const afterProfileY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Input Metrics Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Academic & Behavioral Input Factors', 40, afterProfileY);

  autoTable(doc, {
    startY: afterProfileY + 12,
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 8 },
    head: [['Metric', 'Observed Value', 'Benchmark Target']],
    body: [
      ['Attendance Percentage', `${report.attendance_percentage}%`, '85%+'],
      ['Daily Study Hours', `${report.study_hours_per_day} hrs/day`, '4.0+ hrs/day'],
      ['Previous Exam Marks', `${report.previous_exam_marks} / 100`, '75+ / 100'],
      ['Assignment Score', `${report.assignment_score} / 100`, '80+ / 100'],
      ['Internal Assessment Marks', `${report.internal_assessment_marks} / 100`, '75+ / 100'],
    ],
  });

  const afterInputsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // Personalized Improvement Suggestions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Personalized Academic Recommendations', 40, afterInputsY);

  autoTable(doc, {
    startY: afterInputsY + 12,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 120, fontStyle: 'bold' },
    },
    head: [['Priority', 'Focus Area', 'Actionable Guidance']],
    body: report.suggestions.map((s) => [s.priority, `${s.title} (${s.area})`, s.detail]),
  });

  const safeId = report.student_id.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`student_report_${safeId}.pdf`);
}
