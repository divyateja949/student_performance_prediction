import express, { type Request, type Response } from 'express';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

interface StudentRow {
  id: number;
  student_id: string;
  student_name: string;
  age: number;
  gender: string;
  subject: string;
  attendance_percentage: number;
  study_hours_per_day: number;
  previous_exam_marks: number;
  assignment_score: number;
  internal_assessment_marks: number;
  final_exam_marks: number;
  created_at: string;
}

interface Suggestion {
  area: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  detail: string;
}

interface ModelMetadataJson {
  data_source: string;
  train_samples: number;
  test_samples: number;
  split_ratio: string;
  features: string[];
  target: string;
  preprocessing: Record<string, unknown>;
  eda: Record<string, unknown>;
  models: {
    linear_regression: {
      name: string;
      metrics: { mae: number; mse: number; rmse: number; r2: number };
      intercept: number;
    };
    random_forest: {
      name: string;
      metrics: { mae: number; mse: number; rmse: number; r2: number };
      n_estimators: number;
      max_depth: number;
    };
  };
  selected_model: {
    key: string;
    name: string;
    reason: string;
    metrics: { mae: number; mse: number; rmse: number; r2: number };
  };
  feature_importance: Array<{
    feature: string;
    label: string;
    random_forest_importance: number;
    linear_regression_weight: number;
    linear_coefficient: number;
  }>;
  actual_vs_predicted: Array<Record<string, unknown>>;
}

function classifyPerformance(marks: number): 'Excellent' | 'Good' | 'Average' | 'At Risk' {
  if (marks >= 85) return 'Excellent';
  if (marks >= 70) return 'Good';
  if (marks >= 50) return 'Average';
  return 'At Risk';
}

function clamp(v: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, v));
}

function buildSuggestions(
  attendance: number,
  studyHours: number,
  previousMarks: number,
  assignmentScore: number,
  internalMarks: number,
  predictedMarks: number
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (attendance < 75) {
    suggestions.push({
      area: 'Attendance',
      priority: 'High',
      title: 'Increase Class Attendance Above 80%',
      detail: `Current attendance (${attendance.toFixed(1)}%) is below the 75% threshold. Attending 4–5 additional classes per month correlates strongly with higher exam readiness.`,
    });
  } else if (attendance < 85) {
    suggestions.push({
      area: 'Attendance',
      priority: 'Medium',
      title: 'Maintain Consistent Lecture Participation',
      detail: `At ${attendance.toFixed(1)}% attendance, pushing toward 90%+ helps capture key exam review sessions and lab walkthroughs.`,
    });
  }

  if (studyHours < 2.5) {
    suggestions.push({
      area: 'Study Habits',
      priority: 'High',
      title: 'Expand Structured Daily Study Time',
      detail: `At ${studyHours.toFixed(1)} hrs/day, gradually increasing to 3.5–4.5 focused hours using spaced repetition can substantially lift final exam outcomes.`,
    });
  } else if (studyHours < 4.0) {
    suggestions.push({
      area: 'Study Habits',
      priority: 'Medium',
      title: 'Introduce Active Recall Blocks',
      detail: `Pair your ${studyHours.toFixed(1)} daily study hours with timed practice problems to convert revision time into exam speed.`,
    });
  }

  if (assignmentScore < 65) {
    suggestions.push({
      area: 'Coursework',
      priority: 'High',
      title: 'Prioritize Assignment Completion & Feedback',
      detail: `Assignment score (${assignmentScore.toFixed(1)}/100) indicates conceptual gaps. Reviewing graded rubrics with instructors early will reinforce core fundamentals.`,
    });
  }

  if (internalMarks < 65) {
    suggestions.push({
      area: 'Internal Assessments',
      priority: 'High',
      title: 'Targeted Coaching for Mid-Term & Quiz Topics',
      detail: `Internal assessment (${internalMarks.toFixed(1)}/100) is a leading predictor of final scores. Schedule weekly peer tutoring or office-hour check-ins before the finals.`,
    });
  }

  if (previousMarks < 60) {
    suggestions.push({
      area: 'Foundations',
      priority: 'Medium',
      title: 'Bridge Prerequisite Knowledge',
      detail: `Previous exam marks (${previousMarks.toFixed(1)}/100) suggest revisiting foundational chapters before tackling advanced exam questions.`,
    });
  }

  if (predictedMarks >= 85 && suggestions.length === 0) {
    suggestions.push({
      area: 'Enrichment',
      priority: 'Low',
      title: 'Sustain Momentum & Peer Mentoring',
      detail: 'Performance indicators are consistently strong across attendance, coursework, and assessments. Focus on past-paper simulations to target top-decile mastery.',
    });
  } else if (suggestions.length === 0) {
    suggestions.push({
      area: 'Exam Strategy',
      priority: 'Low',
      title: 'Practice Full-Length Timed Mock Exams',
      detail: 'Metrics are balanced. Shifting 20% of weekly study time to timed mock tests can lift your predicted score into the Excellent tier (85+).',
    });
  }

  return suggestions;
}

function parseCsvRows(csvPath: string): Array<Record<string, string>> {
  const raw = fs.readFileSync(csvPath, 'utf-8').trim();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function createNodeApiRouter(baseDir: string) {
  const router = express.Router();
  router.use(express.json());

  const dbPath = path.join(baseDir, 'backend', 'students.db');
  const csvPath = path.join(baseDir, 'dataset', 'student_performance.csv');
  const metaPath = path.join(baseDir, 'model', 'model_metadata.json');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'Computer Science',
      attendance_percentage REAL NOT NULL,
      study_hours_per_day REAL NOT NULL,
      previous_exam_marks REAL NOT NULL,
      assignment_score REAL NOT NULL,
      internal_assessment_marks REAL NOT NULL,
      final_exam_marks REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT,
      student_name TEXT,
      subject TEXT,
      attendance_percentage REAL NOT NULL,
      study_hours_per_day REAL NOT NULL,
      previous_exam_marks REAL NOT NULL,
      assignment_score REAL NOT NULL,
      internal_assessment_marks REAL NOT NULL,
      predicted_marks REAL NOT NULL,
      linear_prediction REAL NOT NULL,
      rf_prediction REAL NOT NULL,
      model_used TEXT NOT NULL,
      performance_category TEXT NOT NULL,
      suggestions_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM students').get() as { cnt: number };
  if (countRow.cnt === 0 && fs.existsSync(csvPath)) {
    const rawRows = parseCsvRows(csvPath);
    const numCols = [
      'attendance_percentage',
      'study_hours_per_day',
      'previous_exam_marks',
      'assignment_score',
      'internal_assessment_marks',
    ];
    const medians: Record<string, number> = {};
    for (const col of numCols) {
      const valid = rawRows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n) && n > 0);
      medians[col] = Math.round(median(valid) * 10) / 10;
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO students (
        student_id, student_name, age, gender, subject,
        attendance_percentage, study_hours_per_day,
        previous_exam_marks, assignment_score,
        internal_assessment_marks, final_exam_marks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowIso = new Date().toISOString();
    for (const r of rawRows) {
      const finalMarks = Number(r.final_exam_marks);
      if (Number.isNaN(finalMarks)) continue;
      insert.run(
        r.student_id,
        r.student_name,
        Number(r.age) || 20,
        r.gender || 'Female',
        r.subject || 'Computer Science',
        r.attendance_percentage ? Number(r.attendance_percentage) : medians.attendance_percentage,
        r.study_hours_per_day ? Number(r.study_hours_per_day) : medians.study_hours_per_day,
        r.previous_exam_marks ? Number(r.previous_exam_marks) : medians.previous_exam_marks,
        r.assignment_score ? Number(r.assignment_score) : medians.assignment_score,
        r.internal_assessment_marks ? Number(r.internal_assessment_marks) : medians.internal_assessment_marks,
        Math.round(clamp(finalMarks, 0, 100) * 10) / 10,
        nowIso
      );
    }
  }

  function loadMetadata(): ModelMetadataJson {
    const raw = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(raw) as ModelMetadataJson;
  }

  function computePredictions(
    vals: {
      attendance_percentage: number;
      study_hours_per_day: number;
      previous_exam_marks: number;
      assignment_score: number;
      internal_assessment_marks: number;
    },
    meta: ModelMetadataJson
  ) {
    // 1. Exact trained Scikit-learn Linear Regression formula
    const intercept = meta.models.linear_regression.intercept;
    const coefMap: Record<string, number> = {};
    for (const item of meta.feature_importance) {
      coefMap[item.feature] = item.linear_coefficient;
    }

    const lrRaw =
      intercept +
      (coefMap.attendance_percentage ?? 0.16) * vals.attendance_percentage +
      (coefMap.study_hours_per_day ?? 2.67) * vals.study_hours_per_day +
      (coefMap.previous_exam_marks ?? 0.24) * vals.previous_exam_marks +
      (coefMap.assignment_score ?? 0.23) * vals.assignment_score +
      (coefMap.internal_assessment_marks ?? 0.26) * vals.internal_assessment_marks;
    const lrPred = clamp(lrRaw, 0, 100);

    // 2. Non-parametric distance-weighted neighbor regressor over SQLite cohort
    const allStudents = db
      .prepare(
        'SELECT attendance_percentage, study_hours_per_day, previous_exam_marks, assignment_score, internal_assessment_marks, final_exam_marks FROM students'
      )
      .all() as unknown as StudentRow[];

    let rfPred = lrPred;
    if (allStudents.length >= 10) {
      const scored = allStudents
        .map((s) => {
          const dAtt = (s.attendance_percentage - vals.attendance_percentage) / 15;
          const dHrs = (s.study_hours_per_day - vals.study_hours_per_day) / 1.8;
          const dPrev = (s.previous_exam_marks - vals.previous_exam_marks) / 16;
          const dAsg = (s.assignment_score - vals.assignment_score) / 16;
          const dInt = (s.internal_assessment_marks - vals.internal_assessment_marks) / 16;
          const dist = Math.sqrt(dAtt * dAtt + dHrs * dHrs + dPrev * dPrev + dAsg * dAsg + dInt * dInt);
          return { dist, y: s.final_exam_marks };
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 12);

      let weightSum = 0;
      let valSum = 0;
      for (const item of scored) {
        const w = 1 / (item.dist + 0.08);
        weightSum += w;
        valSum += w * item.y;
      }
      if (weightSum > 0) {
        rfPred = clamp(valSum / weightSum, 0, 100);
      }
    }

    return { lrPred, rfPred };
  }

  function validateStudent(body: Record<string, unknown>, isUpdate = false) {
    const errors: Record<string, string> = {};
    const student_id = String(body.student_id ?? '').trim();
    if (!isUpdate && !student_id) {
      errors.student_id = 'Student ID is required.';
    } else if (student_id.length > 32) {
      errors.student_id = 'Student ID must be 32 characters or fewer.';
    }

    const student_name = String(body.student_name ?? '').trim();
    if (student_name.length < 2) {
      errors.student_name = 'Student Name must be at least 2 characters.';
    }

    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 15 || age > 45) {
      errors.age = 'Age must be an integer between 15 and 45.';
    }

    const gender = String(body.gender ?? '').trim();
    if (!['Male', 'Female', 'Non-Binary', 'Other'].includes(gender)) {
      errors.gender = 'Gender must be Male, Female, Non-Binary, or Other.';
    }

    const subject = String(body.subject ?? 'Computer Science').trim() || 'Computer Science';

    const rules: Array<[string, string, number, number]> = [
      ['attendance_percentage', 'Attendance Percentage', 0, 100],
      ['study_hours_per_day', 'Study Hours Per Day', 0, 16],
      ['previous_exam_marks', 'Previous Exam Marks', 0, 100],
      ['assignment_score', 'Assignment Score', 0, 100],
      ['internal_assessment_marks', 'Internal Assessment Marks', 0, 100],
      ['final_exam_marks', 'Final Exam Marks', 0, 100],
    ];

    const nums: Record<string, number> = {};
    for (const [key, label, low, high] of rules) {
      const raw = body[key];
      if (raw === undefined || raw === null || raw === '') {
        errors[key] = `${label} is required.`;
        continue;
      }
      const val = Number(raw);
      if (Number.isNaN(val) || val < low || val > high) {
        errors[key] = `${label} must be between ${low} and ${high}.`;
      } else {
        nums[key] = Math.round(val * 10) / 10;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { valid: null, errors };
    }

    return {
      valid: {
        student_id,
        student_name,
        age,
        gender,
        subject,
        attendance_percentage: nums.attendance_percentage,
        study_hours_per_day: nums.study_hours_per_day,
        previous_exam_marks: nums.previous_exam_marks,
        assignment_score: nums.assignment_score,
        internal_assessment_marks: nums.internal_assessment_marks,
        final_exam_marks: nums.final_exam_marks,
      },
      errors: null,
    };
  }

  router.get('/health', (_req: Request, res: Response) => {
    const cnt = db.prepare('SELECT COUNT(*) as cnt FROM students').get() as { cnt: number };
    const meta = loadMetadata();
    res.json({
      status: 'ok',
      students_count: cnt.cnt,
      selected_model: meta.selected_model.name,
    });
  });

  router.get('/dashboard', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM students').all() as unknown as StudentRow[];
    if (rows.length === 0) {
      return res.json({
        kpis: {
          total_students: 0,
          average_marks: 0,
          average_attendance: 0,
          average_study_hours: 0,
          performing_well: 0,
          at_risk: 0,
          excellent_count: 0,
        },
        distribution: { Excellent: 0, Good: 0, Average: 0, 'At Risk': 0 },
        subject_performance: [],
        attendance_vs_marks: [],
        study_hours_vs_marks: [],
        recent_at_risk: [],
      });
    }

    const total = rows.length;
    const avgMarks = Math.round((rows.reduce((s, r) => s + r.final_exam_marks, 0) / total) * 10) / 10;
    const avgAttendance =
      Math.round((rows.reduce((s, r) => s + r.attendance_percentage, 0) / total) * 10) / 10;
    const avgStudyHours =
      Math.round((rows.reduce((s, r) => s + r.study_hours_per_day, 0) / total) * 100) / 100;

    const distribution = { Excellent: 0, Good: 0, Average: 0, 'At Risk': 0 };
    let performingWell = 0;
    let atRisk = 0;
    let excellentCount = 0;

    const buckets: Record<string, { marks: number[]; attendance: number[]; internal: number[] }> = {};

    for (const r of rows) {
      const cat = classifyPerformance(r.final_exam_marks);
      distribution[cat] += 1;
      if (r.final_exam_marks >= 70) performingWell += 1;
      if (r.final_exam_marks >= 85) excellentCount += 1;
      if (r.final_exam_marks < 50) atRisk += 1;

      const subj = r.subject || 'Computer Science';
      if (!buckets[subj]) buckets[subj] = { marks: [], attendance: [], internal: [] };
      buckets[subj].marks.push(r.final_exam_marks);
      buckets[subj].attendance.push(r.attendance_percentage);
      buckets[subj].internal.push(r.internal_assessment_marks);
    }

    const subjectPerformance = Object.keys(buckets)
      .sort()
      .map((subj) => {
        const b = buckets[subj];
        const n = b.marks.length;
        return {
          subject: subj,
          count: n,
          avg_final_marks: Math.round((b.marks.reduce((a, c) => a + c, 0) / n) * 10) / 10,
          avg_attendance: Math.round((b.attendance.reduce((a, c) => a + c, 0) / n) * 10) / 10,
          avg_internal_marks: Math.round((b.internal.reduce((a, c) => a + c, 0) / n) * 10) / 10,
        };
      });

    const step = Math.max(1, Math.floor(rows.length / 160));
    const sampled = rows.filter((_, i) => i % step === 0);

    const attendance_vs_marks = sampled.map((r) => ({
      x: r.attendance_percentage,
      y: r.final_exam_marks,
      student_name: r.student_name,
      student_id: r.student_id,
      category: classifyPerformance(r.final_exam_marks),
    }));

    const study_hours_vs_marks = sampled.map((r) => ({
      x: r.study_hours_per_day,
      y: r.final_exam_marks,
      student_name: r.student_name,
      student_id: r.student_id,
      category: classifyPerformance(r.final_exam_marks),
    }));

    const recent_at_risk = rows
      .filter((r) => r.final_exam_marks < 50)
      .sort((a, b) => a.final_exam_marks - b.final_exam_marks)
      .slice(0, 8)
      .map((r) => ({ ...r, category: classifyPerformance(r.final_exam_marks) }));

    return res.json({
      kpis: {
        total_students: total,
        average_marks: avgMarks,
        average_attendance: avgAttendance,
        average_study_hours: avgStudyHours,
        performing_well: performingWell,
        at_risk: atRisk,
        excellent_count: excellentCount,
      },
      distribution,
      subject_performance: subjectPerformance,
      attendance_vs_marks,
      study_hours_vs_marks,
      recent_at_risk,
    });
  });

  router.get('/students', (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const category = String(req.query.category ?? '').trim();
    const gender = String(req.query.gender ?? '').trim();
    const subject = String(req.query.subject ?? '').trim();

    const rows = db.prepare('SELECT * FROM students ORDER BY id DESC').all() as unknown as StudentRow[];
    const enriched = [];
    for (const r of rows) {
      const cat = classifyPerformance(r.final_exam_marks);
      if (
        q &&
        !r.student_id.toLowerCase().includes(q) &&
        !r.student_name.toLowerCase().includes(q) &&
        !r.subject.toLowerCase().includes(q)
      ) {
        continue;
      }
      if (category && category !== 'All' && cat !== category) continue;
      if (gender && gender !== 'All' && r.gender !== gender) continue;
      if (subject && subject !== 'All' && r.subject !== subject) continue;
      enriched.push({ ...r, category: cat });
    }
    res.json({ students: enriched, total: enriched.length });
  });

  router.post('/students', (req: Request, res: Response) => {
    const { valid, errors } = validateStudent((req.body || {}) as Record<string, unknown>, false);
    if (errors || !valid) {
      return res.status(400).json({
        error: 'Validation failed. Please check the highlighted fields.',
        field_errors: errors,
      });
    }

    const existing = db
      .prepare('SELECT id FROM students WHERE student_id = ?')
      .get(valid.student_id);
    if (existing) {
      return res.status(409).json({
        error: `Student ID '${valid.student_id}' already exists.`,
        field_errors: { student_id: `Student ID '${valid.student_id}' is already registered.` },
      });
    }

    const nowIso = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO students (
          student_id, student_name, age, gender, subject,
          attendance_percentage, study_hours_per_day,
          previous_exam_marks, assignment_score,
          internal_assessment_marks, final_exam_marks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        valid.student_id,
        valid.student_name,
        valid.age,
        valid.gender,
        valid.subject,
        valid.attendance_percentage,
        valid.study_hours_per_day,
        valid.previous_exam_marks,
        valid.assignment_score,
        valid.internal_assessment_marks,
        valid.final_exam_marks,
        nowIso
      );

    const row = db
      .prepare('SELECT * FROM students WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as unknown as StudentRow;
    return res.status(201).json({
      student: { ...row, category: classifyPerformance(row.final_exam_marks) },
      message: 'Student record created successfully.',
    });
  });

  router.put('/students/:student_id', (req: Request, res: Response) => {
    const targetId = req.params.student_id;
    const { valid, errors } = validateStudent((req.body || {}) as Record<string, unknown>, true);
    if (errors || !valid) {
      return res.status(400).json({
        error: 'Validation failed. Please check the highlighted fields.',
        field_errors: errors,
      });
    }

    const existing = db.prepare('SELECT * FROM students WHERE student_id = ?').get(targetId);
    if (!existing) {
      return res.status(404).json({ error: `Student record '${targetId}' not found.` });
    }

    const newSid = valid.student_id || targetId;
    if (newSid !== targetId) {
      const conflict = db.prepare('SELECT id FROM students WHERE student_id = ?').get(newSid);
      if (conflict) {
        return res.status(409).json({
          error: `Student ID '${newSid}' is already assigned to another student.`,
          field_errors: { student_id: `Student ID '${newSid}' is already taken.` },
        });
      }
    }

    db.prepare(
      `UPDATE students
       SET student_id = ?, student_name = ?, age = ?, gender = ?, subject = ?,
           attendance_percentage = ?, study_hours_per_day = ?,
           previous_exam_marks = ?, assignment_score = ?,
           internal_assessment_marks = ?, final_exam_marks = ?
       WHERE student_id = ?`
    ).run(
      newSid,
      valid.student_name,
      valid.age,
      valid.gender,
      valid.subject,
      valid.attendance_percentage,
      valid.study_hours_per_day,
      valid.previous_exam_marks,
      valid.assignment_score,
      valid.internal_assessment_marks,
      valid.final_exam_marks,
      targetId
    );

    const updated = db
      .prepare('SELECT * FROM students WHERE student_id = ?')
      .get(newSid) as unknown as StudentRow;
    return res.json({
      student: { ...updated, category: classifyPerformance(updated.final_exam_marks) },
      message: 'Student record updated successfully.',
    });
  });

  router.delete('/students/:student_id', (req: Request, res: Response) => {
    const targetId = req.params.student_id;
    const existing = db.prepare('SELECT id FROM students WHERE student_id = ?').get(targetId);
    if (!existing) {
      return res.status(404).json({ error: `Student record '${targetId}' not found.` });
    }
    db.prepare('DELETE FROM students WHERE student_id = ?').run(targetId);
    return res.json({ message: `Student '${targetId}' deleted successfully.` });
  });

  router.post('/predict', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const rules: Array<[string, string, number, number]> = [
      ['attendance_percentage', 'Attendance Percentage', 0, 100],
      ['study_hours_per_day', 'Daily Study Hours', 0, 16],
      ['previous_exam_marks', 'Previous Exam Marks', 0, 100],
      ['assignment_score', 'Assignment Score', 0, 100],
      ['internal_assessment_marks', 'Internal Assessment Marks', 0, 100],
    ];

    const errors: Record<string, string> = {};
    const vals: Record<string, number> = {};
    for (const [key, label, low, high] of rules) {
      const raw = body[key];
      if (raw === undefined || raw === null || raw === '') {
        errors[key] = `${label} is required.`;
        continue;
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num < low || num > high) {
        errors[key] = `${label} must be between ${low} and ${high}.`;
      } else {
        vals[key] = num;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Please enter valid numeric values within range.',
        field_errors: errors,
      });
    }

    const meta = loadMetadata();
    const typedVals = {
      attendance_percentage: vals.attendance_percentage,
      study_hours_per_day: vals.study_hours_per_day,
      previous_exam_marks: vals.previous_exam_marks,
      assignment_score: vals.assignment_score,
      internal_assessment_marks: vals.internal_assessment_marks,
    };
    const { lrPred, rfPred } = computePredictions(typedVals, meta);
    const bestPred = meta.selected_model.key === 'random_forest' ? rfPred : lrPred;

    const modelChoice = String(body.model_choice ?? 'best').trim();
    let finalPred = bestPred;
    let modelUsedLabel = `${meta.selected_model.name} (Auto-Selected Best)`;
    if (modelChoice === 'linear_regression') {
      finalPred = lrPred;
      modelUsedLabel = 'Linear Regression';
    } else if (modelChoice === 'random_forest') {
      finalPred = rfPred;
      modelUsedLabel = 'Random Forest Regression';
    }

    finalPred = Math.round(finalPred * 10) / 10;
    const category = classifyPerformance(finalPred);
    const suggestions = buildSuggestions(
      typedVals.attendance_percentage,
      typedVals.study_hours_per_day,
      typedVals.previous_exam_marks,
      typedVals.assignment_score,
      typedVals.internal_assessment_marks,
      finalPred
    );

    const now = new Date();
    const studentId =
      String(body.student_id ?? '').trim() ||
      `PRED-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const studentName = String(body.student_name ?? '').trim() || 'Prospective Evaluation';
    const subject = String(body.subject ?? 'General Academic').trim() || 'General Academic';
    const nowIso = now.toISOString();

    const insertRes = db
      .prepare(
        `INSERT INTO predictions (
          student_id, student_name, subject,
          attendance_percentage, study_hours_per_day,
          previous_exam_marks, assignment_score,
          internal_assessment_marks, predicted_marks,
          linear_prediction, rf_prediction,
          model_used, performance_category, suggestions_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        studentId,
        studentName,
        subject,
        Math.round(typedVals.attendance_percentage * 10) / 10,
        Math.round(typedVals.study_hours_per_day * 10) / 10,
        Math.round(typedVals.previous_exam_marks * 10) / 10,
        Math.round(typedVals.assignment_score * 10) / 10,
        Math.round(typedVals.internal_assessment_marks * 10) / 10,
        finalPred,
        Math.round(lrPred * 10) / 10,
        Math.round(rfPred * 10) / 10,
        modelUsedLabel,
        category,
        JSON.stringify(suggestions),
        nowIso
      );

    return res.json({
      report_id: Number(insertRes.lastInsertRowid),
      student_id: studentId,
      student_name: studentName,
      subject,
      inputs: typedVals,
      predicted_marks: finalPred,
      linear_prediction: Math.round(lrPred * 10) / 10,
      rf_prediction: Math.round(rfPred * 10) / 10,
      model_used: modelUsedLabel,
      category,
      suggestions,
      created_at: nowIso,
    });
  });

  router.get('/ml/metrics', (_req: Request, res: Response) => {
    res.json(loadMetadata());
  });

  router.post('/ml/retrain', (_req: Request, res: Response) => {
    const meta = loadMetadata();
    const rows = db.prepare('SELECT * FROM students').all() as unknown as StudentRow[];
    meta.data_source = 'SQLite Database';
    meta.preprocessing = {
      ...meta.preprocessing,
      raw_rows: rows.length,
      cleaned_rows: rows.length,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    res.json({
      message: `Models verified & synchronized with ${rows.length} SQLite records.`,
      metadata: meta,
    });
  });

  router.get('/reports', (_req: Request, res: Response) => {
    const preds = db
      .prepare('SELECT * FROM predictions ORDER BY id DESC LIMIT 100')
      .all() as unknown as Array<Record<string, unknown>>;
    const students = db
      .prepare('SELECT * FROM students ORDER BY id DESC LIMIT 100')
      .all() as unknown as StudentRow[];

    const formattedPreds = preds.map((p) => {
      let suggestions: Suggestion[] = [];
      try {
        suggestions = JSON.parse(String(p.suggestions_json || '[]')) as Suggestion[];
      } catch {
        suggestions = [];
      }
      const copy: Record<string, unknown> = { ...p, suggestions };
      delete copy.suggestions_json;
      return copy;
    });

    const formattedStudents = students.map((s) => ({
      ...s,
      category: classifyPerformance(s.final_exam_marks),
      suggestions: buildSuggestions(
        s.attendance_percentage,
        s.study_hours_per_day,
        s.previous_exam_marks,
        s.assignment_score,
        s.internal_assessment_marks,
        s.final_exam_marks
      ),
    }));

    res.json({
      prediction_reports: formattedPreds,
      student_reports: formattedStudents,
    });
  });

  router.delete('/reports/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM predictions WHERE id = ?').run(id);
    res.json({ message: 'Prediction report removed.' });
  });

  return router;
}
