import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYLIBS_DIR = os.path.join(BASE_DIR, ".pylibs")
if os.path.isdir(PYLIBS_DIR) and PYLIBS_DIR not in sys.path:
    sys.path.insert(0, PYLIBS_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from dataset.generate_dataset import generate_dataset
from model.train_model import (
    FEATURE_COLUMNS,
    clean_and_preprocess,
    train_and_save,
)

DATASET_PATH = os.path.join(BASE_DIR, "dataset", "student_performance.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")
DB_PATH = os.path.join(BASE_DIR, "backend", "students.db")

app = Flask(__name__)
CORS(app)

MODELS = {
    "best": None,
    "linear_regression": None,
    "random_forest": None,
}
MODEL_METADATA = {}


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def classify_performance(marks: float) -> str:
    if marks >= 85.0:
        return "Excellent"
    if marks >= 70.0:
        return "Good"
    if marks >= 50.0:
        return "Average"
    return "At Risk"


def init_db_and_seed():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
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
        )
        """
    )

    cur.execute(
        """
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
        )
        """
    )

    cur.execute("SELECT COUNT(*) FROM students")
    count = cur.fetchone()[0]

    if count == 0:
        if not os.path.exists(DATASET_PATH):
            generate_dataset(DATASET_PATH, 550)
        raw_df = pd.read_csv(DATASET_PATH)
        clean_df, _ = clean_and_preprocess(raw_df)
        now_iso = datetime.now(timezone.utc).isoformat()
        records = []
        for _, row in clean_df.iterrows():
            records.append(
                (
                    str(row["student_id"]),
                    str(row["student_name"]),
                    int(row["age"]),
                    str(row["gender"]),
                    str(row.get("subject", "Computer Science")),
                    round(float(row["attendance_percentage"]), 1),
                    round(float(row["study_hours_per_day"]), 1),
                    round(float(row["previous_exam_marks"]), 1),
                    round(float(row["assignment_score"]), 1),
                    round(float(row["internal_assessment_marks"]), 1),
                    round(float(row["final_exam_marks"]), 1),
                    now_iso,
                )
            )
        cur.executemany(
            """
            INSERT OR IGNORE INTO students (
                student_id, student_name, age, gender, subject,
                attendance_percentage, study_hours_per_day,
                previous_exam_marks, assignment_score,
                internal_assessment_marks, final_exam_marks, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )

    conn.commit()
    conn.close()


def ensure_models_loaded():
    global MODELS, MODEL_METADATA
    best_path = os.path.join(MODEL_DIR, "best_model.joblib")
    lr_path = os.path.join(MODEL_DIR, "linear_regression.joblib")
    rf_path = os.path.join(MODEL_DIR, "random_forest.joblib")
    meta_path = os.path.join(MODEL_DIR, "model_metadata.json")

    if not (
        os.path.exists(best_path)
        and os.path.exists(lr_path)
        and os.path.exists(rf_path)
        and os.path.exists(meta_path)
    ):
        if not os.path.exists(DATASET_PATH):
            generate_dataset(DATASET_PATH, 550)
        train_and_save(source="csv")

    MODELS["best"] = joblib.load(best_path)
    MODELS["linear_regression"] = joblib.load(lr_path)
    MODELS["random_forest"] = joblib.load(rf_path)
    with open(meta_path, "r", encoding="utf-8") as f:
        MODEL_METADATA = json.load(f)


def validate_student_payload(data, is_update=False):
    errors = {}
    if not isinstance(data, dict):
        return None, {"_form": "Invalid JSON payload."}

    student_id = str(data.get("student_id", "")).strip()
    if not is_update and not student_id:
        errors["student_id"] = "Student ID is required."
    elif student_id and len(student_id) > 32:
        errors["student_id"] = "Student ID must be 32 characters or fewer."

    student_name = str(data.get("student_name", "")).strip()
    if not student_name or len(student_name) < 2:
        errors["student_name"] = "Student Name must be at least 2 characters."

    try:
        age = int(data.get("age", 0))
        if age < 15 or age > 45:
            errors["age"] = "Age must be between 15 and 45."
    except (TypeError, ValueError):
        age = 0
        errors["age"] = "Age must be a valid integer."

    gender = str(data.get("gender", "")).strip()
    if gender not in ("Male", "Female", "Non-Binary", "Other"):
        errors["gender"] = "Gender must be Male, Female, Non-Binary, or Other."

    subject = str(data.get("subject", "Computer Science")).strip() or "Computer Science"

    numeric_rules = [
        ("attendance_percentage", "Attendance Percentage", 0, 100),
        ("study_hours_per_day", "Study Hours Per Day", 0, 16),
        ("previous_exam_marks", "Previous Exam Marks", 0, 100),
        ("assignment_score", "Assignment Score", 0, 100),
        ("internal_assessment_marks", "Internal Assessment Marks", 0, 100),
        ("final_exam_marks", "Final Exam Marks", 0, 100),
    ]
    parsed_nums = {}
    for key, label, low, high in numeric_rules:
        raw_val = data.get(key)
        if raw_val is None or raw_val == "":
            errors[key] = f"{label} is required."
            continue
        try:
            val = float(raw_val)
            if val < low or val > high:
                errors[key] = f"{label} must be between {low} and {high}."
            else:
                parsed_nums[key] = round(val, 1)
        except (TypeError, ValueError):
            errors[key] = f"{label} must be a valid number."

    if errors:
        return None, errors

    return {
        "student_id": student_id,
        "student_name": student_name,
        "age": age,
        "gender": gender,
        "subject": subject,
        **parsed_nums,
    }, None


def build_personalized_suggestions(
    attendance: float,
    study_hours: float,
    previous_marks: float,
    assignment_score: float,
    internal_marks: float,
    predicted_marks: float,
):
    suggestions = []

    if attendance < 75:
        suggestions.append({
            "area": "Attendance",
            "priority": "High",
            "title": "Increase Class Attendance Above 80%",
            "detail": f"Current attendance ({attendance:.1f}%) is below the 75% threshold. Attending 4–5 additional classes per month correlates strongly with higher exam readiness.",
        })
    elif attendance < 85:
        suggestions.append({
            "area": "Attendance",
            "priority": "Medium",
            "title": "Maintain Consistent Lecture Participation",
            "detail": f"At {attendance:.1f}% attendance, pushing toward 90%+ helps capture key exam review sessions and lab walkthroughs.",
        })

    if study_hours < 2.5:
        suggestions.append({
            "area": "Study Habits",
            "priority": "High",
            "title": "Expand Structured Daily Study Time",
            "detail": f"At {study_hours:.1f} hrs/day, gradually increasing to 3.5–4.5 focused hours using spaced repetition can substantially lift final exam outcomes.",
        })
    elif study_hours < 4.0:
        suggestions.append({
            "area": "Study Habits",
            "priority": "Medium",
            "title": "Introduce Active Recall Blocks",
            "detail": f"Pair your {study_hours:.1f} daily study hours with timed practice problems to convert revision time into exam speed.",
        })

    if assignment_score < 65:
        suggestions.append({
            "area": "Coursework",
            "priority": "High",
            "title": "Prioritize Assignment Completion & Feedback",
            "detail": f"Assignment score ({assignment_score:.1f}/100) indicates conceptual gaps. Reviewing graded rubrics with instructors early will reinforce core fundamentals.",
        })

    if internal_marks < 65:
        suggestions.append({
            "area": "Internal Assessments",
            "priority": "High",
            "title": "Targeted Coaching for Mid-Term & Quiz Topics",
            "detail": f"Internal assessment ({internal_marks:.1f}/100) is a leading predictor of final scores. Schedule weekly peer tutoring or office-hour check-ins before the finals.",
        })

    if previous_marks < 60:
        suggestions.append({
            "area": "Foundations",
            "priority": "Medium",
            "title": "Bridge Prerequisite Knowledge",
            "detail": f"Previous exam marks ({previous_marks:.1f}/100) suggest revisiting foundational chapters before tackling advanced exam questions.",
        })

    if predicted_marks >= 85 and not suggestions:
        suggestions.append({
            "area": "Enrichment",
            "priority": "Low",
            "title": "Sustain Momentum & Peer Mentoring",
            "detail": "Performance indicators are consistently strong across attendance, coursework, and assessments. Focus on past-paper simulations to target top-decile mastery.",
        })
    elif not suggestions:
        suggestions.append({
            "area": "Exam Strategy",
            "priority": "Low",
            "title": "Practice Full-Length Timed Mock Exams",
            "detail": "Metrics are balanced. Shifting 20% of weekly study time to timed mock tests can lift your predicted score into the Excellent tier (85+).",
        })

    return suggestions


@app.route("/api/health", methods=["GET"])
def health():
    conn = get_db_connection()
    total = conn.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    conn.close()
    return jsonify({
        "status": "ok",
        "students_count": total,
        "selected_model": MODEL_METADATA.get("selected_model", {}).get("name", "Unknown"),
    })


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    conn = get_db_connection()
    rows = [dict(r) for r in conn.execute("SELECT * FROM students").fetchall()]
    conn.close()

    if not rows:
        return jsonify({
            "kpis": {
                "total_students": 0,
                "average_marks": 0,
                "average_attendance": 0,
                "performing_well": 0,
                "at_risk": 0,
                "excellent_count": 0,
            },
            "distribution": {"Excellent": 0, "Good": 0, "Average": 0, "At Risk": 0},
            "subject_performance": [],
            "attendance_vs_marks": [],
            "study_hours_vs_marks": [],
            "recent_at_risk": [],
        })

    total = len(rows)
    avg_marks = round(sum(r["final_exam_marks"] for r in rows) / total, 1)
    avg_attendance = round(sum(r["attendance_percentage"] for r in rows) / total, 1)
    avg_study_hours = round(sum(r["study_hours_per_day"] for r in rows) / total, 2)

    distribution = {"Excellent": 0, "Good": 0, "Average": 0, "At Risk": 0}
    performing_well = 0
    at_risk = 0
    excellent_count = 0

    subject_buckets = {}
    for r in rows:
        cat = classify_performance(r["final_exam_marks"])
        distribution[cat] += 1
        if r["final_exam_marks"] >= 70.0:
            performing_well += 1
        if r["final_exam_marks"] >= 85.0:
            excellent_count += 1
        if r["final_exam_marks"] < 50.0:
            at_risk += 1

        subj = r.get("subject", "Computer Science")
        if subj not in subject_buckets:
            subject_buckets[subj] = {"marks": [], "attendance": [], "internal": []}
        subject_buckets[subj]["marks"].append(r["final_exam_marks"])
        subject_buckets[subj]["attendance"].append(r["attendance_percentage"])
        subject_buckets[subj]["internal"].append(r["internal_assessment_marks"])

    subject_performance = []
    for subj, vals in sorted(subject_buckets.items()):
        n = len(vals["marks"])
        subject_performance.append({
            "subject": subj,
            "count": n,
            "avg_final_marks": round(sum(vals["marks"]) / n, 1),
            "avg_attendance": round(sum(vals["attendance"]) / n, 1),
            "avg_internal_marks": round(sum(vals["internal"]) / n, 1),
        })

    # Sample up to 160 points evenly for crisp scatter charts
    step = max(1, len(rows) // 160)
    sampled = rows[::step]
    attendance_vs_marks = [
        {
            "x": r["attendance_percentage"],
            "y": r["final_exam_marks"],
            "student_name": r["student_name"],
            "student_id": r["student_id"],
            "category": classify_performance(r["final_exam_marks"]),
        }
        for r in sampled
    ]
    study_hours_vs_marks = [
        {
            "x": r["study_hours_per_day"],
            "y": r["final_exam_marks"],
            "student_name": r["student_name"],
            "student_id": r["student_id"],
            "category": classify_performance(r["final_exam_marks"]),
        }
        for r in sampled
    ]

    at_risk_students = sorted(
        [
            {
                **r,
                "category": classify_performance(r["final_exam_marks"]),
            }
            for r in rows
            if r["final_exam_marks"] < 50.0
        ],
        key=lambda x: x["final_exam_marks"],
    )[:8]

    return jsonify({
        "kpis": {
            "total_students": total,
            "average_marks": avg_marks,
            "average_attendance": avg_attendance,
            "average_study_hours": avg_study_hours,
            "performing_well": performing_well,
            "at_risk": at_risk,
            "excellent_count": excellent_count,
        },
        "distribution": distribution,
        "subject_performance": subject_performance,
        "attendance_vs_marks": attendance_vs_marks,
        "study_hours_vs_marks": study_hours_vs_marks,
        "recent_at_risk": at_risk_students,
    })


@app.route("/api/students", methods=["GET"])
def get_students():
    q = request.args.get("q", "").strip().lower()
    category = request.args.get("category", "").strip()
    gender = request.args.get("gender", "").strip()
    subject = request.args.get("subject", "").strip()

    conn = get_db_connection()
    rows = [dict(r) for r in conn.execute("SELECT * FROM students ORDER BY id DESC").fetchall()]
    conn.close()

    enriched = []
    for r in rows:
        cat = classify_performance(r["final_exam_marks"])
        r["category"] = cat
        if q:
            if (
                q not in r["student_id"].lower()
                and q not in r["student_name"].lower()
                and q not in r["subject"].lower()
            ):
                continue
        if category and category != "All" and cat != category:
            continue
        if gender and gender != "All" and r["gender"] != gender:
            continue
        if subject and subject != "All" and r["subject"] != subject:
            continue
        enriched.append(r)

    return jsonify({
        "students": enriched,
        "total": len(enriched),
    })


@app.route("/api/students", methods=["POST"])
def create_student():
    data = request.get_json(silent=True)
    cleaned, errors = validate_student_payload(data, is_update=False)
    if errors:
        return jsonify({"error": "Validation failed. Please check the highlighted fields.", "field_errors": errors}), 400

    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM students WHERE student_id = ?", (cleaned["student_id"],)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({
            "error": f"Student ID '{cleaned['student_id']}' already exists.",
            "field_errors": {"student_id": f"Student ID '{cleaned['student_id']}' is already registered."},
        }), 409

    now_iso = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO students (
            student_id, student_name, age, gender, subject,
            attendance_percentage, study_hours_per_day,
            previous_exam_marks, assignment_score,
            internal_assessment_marks, final_exam_marks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            cleaned["student_id"],
            cleaned["student_name"],
            cleaned["age"],
            cleaned["gender"],
            cleaned["subject"],
            cleaned["attendance_percentage"],
            cleaned["study_hours_per_day"],
            cleaned["previous_exam_marks"],
            cleaned["assignment_score"],
            cleaned["internal_assessment_marks"],
            cleaned["final_exam_marks"],
            now_iso,
        ),
    )
    conn.commit()
    new_row = dict(conn.execute("SELECT * FROM students WHERE id = ?", (cur.lastrowid,)).fetchone())
    conn.close()
    new_row["category"] = classify_performance(new_row["final_exam_marks"])
    return jsonify({"student": new_row, "message": "Student record created successfully."}), 201


@app.route("/api/students/<student_id>", methods=["PUT"])
def update_student(student_id):
    data = request.get_json(silent=True)
    cleaned, errors = validate_student_payload(data, is_update=True)
    if errors:
        return jsonify({"error": "Validation failed. Please check the highlighted fields.", "field_errors": errors}), 400

    conn = get_db_connection()
    existing = conn.execute("SELECT * FROM students WHERE student_id = ?", (student_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": f"Student record '{student_id}' not found."}), 404

    new_sid = cleaned["student_id"] or student_id
    if new_sid != student_id:
        conflict = conn.execute("SELECT id FROM students WHERE student_id = ?", (new_sid,)).fetchone()
        if conflict:
            conn.close()
            return jsonify({
                "error": f"Student ID '{new_sid}' is already assigned to another student.",
                "field_errors": {"student_id": f"Student ID '{new_sid}' is already taken."},
            }), 409

    conn.execute(
        """
        UPDATE students
        SET student_id = ?, student_name = ?, age = ?, gender = ?, subject = ?,
            attendance_percentage = ?, study_hours_per_day = ?,
            previous_exam_marks = ?, assignment_score = ?,
            internal_assessment_marks = ?, final_exam_marks = ?
        WHERE student_id = ?
        """,
        (
            new_sid,
            cleaned["student_name"],
            cleaned["age"],
            cleaned["gender"],
            cleaned["subject"],
            cleaned["attendance_percentage"],
            cleaned["study_hours_per_day"],
            cleaned["previous_exam_marks"],
            cleaned["assignment_score"],
            cleaned["internal_assessment_marks"],
            cleaned["final_exam_marks"],
            student_id,
        ),
    )
    conn.commit()
    updated = dict(conn.execute("SELECT * FROM students WHERE student_id = ?", (new_sid,)).fetchone())
    conn.close()
    updated["category"] = classify_performance(updated["final_exam_marks"])
    return jsonify({"student": updated, "message": "Student record updated successfully."})


@app.route("/api/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM students WHERE student_id = ?", (student_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": f"Student record '{student_id}' not found."}), 404
    conn.execute("DELETE FROM students WHERE student_id = ?", (student_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Student '{student_id}' deleted successfully."})


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body."}), 400

    rules = [
        ("attendance_percentage", "Attendance Percentage", 0, 100),
        ("study_hours_per_day", "Daily Study Hours", 0, 16),
        ("previous_exam_marks", "Previous Exam Marks", 0, 100),
        ("assignment_score", "Assignment Score", 0, 100),
        ("internal_assessment_marks", "Internal Assessment Marks", 0, 100),
    ]

    errors = {}
    vals = {}
    for key, label, low, high in rules:
        raw = data.get(key)
        if raw is None or raw == "":
            errors[key] = f"{label} is required."
            continue
        try:
            num = float(raw)
            if num < low or num > high:
                errors[key] = f"{label} must be between {low} and {high}."
            else:
                vals[key] = num
        except (TypeError, ValueError):
            errors[key] = f"{label} must be a valid number."

    if errors:
        return jsonify({"error": "Please enter valid numeric values within range.", "field_errors": errors}), 400

    ensure_models_loaded()
    features_df = pd.DataFrame(
        [[
            vals["attendance_percentage"],
            vals["study_hours_per_day"],
            vals["previous_exam_marks"],
            vals["assignment_score"],
            vals["internal_assessment_marks"],
        ]],
        columns=FEATURE_COLUMNS,
    )

    lr_pred = float(np.clip(MODELS["linear_regression"].predict(features_df)[0], 0, 100))
    rf_pred = float(np.clip(MODELS["random_forest"].predict(features_df)[0], 0, 100))
    best_pred = float(np.clip(MODELS["best"].predict(features_df)[0], 0, 100))

    model_choice = str(data.get("model_choice", "best")).strip()
    selected_name = MODEL_METADATA.get("selected_model", {}).get("name", "Random Forest Regression")

    if model_choice == "linear_regression":
        final_pred = lr_pred
        model_used_label = "Linear Regression"
    elif model_choice == "random_forest":
        final_pred = rf_pred
        model_used_label = "Random Forest Regression"
    else:
        final_pred = best_pred
        model_used_label = f"{selected_name} (Auto-Selected Best)"

    final_pred = round(final_pred, 1)
    category = classify_performance(final_pred)

    suggestions = build_personalized_suggestions(
        vals["attendance_percentage"],
        vals["study_hours_per_day"],
        vals["previous_exam_marks"],
        vals["assignment_score"],
        vals["internal_assessment_marks"],
        final_pred,
    )

    student_id = str(data.get("student_id", "")).strip() or f"PRED-{datetime.now().strftime('%H%M%S')}"
    student_name = str(data.get("student_name", "")).strip() or "Prospective Evaluation"
    subject = str(data.get("subject", "General Academic")).strip() or "General Academic"
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO predictions (
            student_id, student_name, subject,
            attendance_percentage, study_hours_per_day,
            previous_exam_marks, assignment_score,
            internal_assessment_marks, predicted_marks,
            linear_prediction, rf_prediction,
            model_used, performance_category, suggestions_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            student_id,
            student_name,
            subject,
            round(vals["attendance_percentage"], 1),
            round(vals["study_hours_per_day"], 1),
            round(vals["previous_exam_marks"], 1),
            round(vals["assignment_score"], 1),
            round(vals["internal_assessment_marks"], 1),
            final_pred,
            round(lr_pred, 1),
            round(rf_pred, 1),
            model_used_label,
            category,
            json.dumps(suggestions),
            now_iso,
        ),
    )
    report_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "report_id": report_id,
        "student_id": student_id,
        "student_name": student_name,
        "subject": subject,
        "inputs": vals,
        "predicted_marks": final_pred,
        "linear_prediction": round(lr_pred, 1),
        "rf_prediction": round(rf_pred, 1),
        "model_used": model_used_label,
        "category": category,
        "suggestions": suggestions,
        "created_at": now_iso,
    })


@app.route("/api/ml/metrics", methods=["GET"])
def get_ml_metrics():
    ensure_models_loaded()
    return jsonify(MODEL_METADATA)


@app.route("/api/ml/retrain", methods=["POST"])
def retrain_models():
    data = request.get_json(silent=True) or {}
    source = data.get("source", "sqlite")
    if source not in ("csv", "sqlite"):
        source = "sqlite"
    metadata = train_and_save(source=source)
    ensure_models_loaded()
    return jsonify({
        "message": f"Models retrained successfully from {metadata.get('data_source')}.",
        "metadata": metadata,
    })


@app.route("/api/reports", methods=["GET"])
def get_reports():
    conn = get_db_connection()
    preds = [dict(r) for r in conn.execute("SELECT * FROM predictions ORDER BY id DESC LIMIT 100").fetchall()]
    students = [dict(r) for r in conn.execute("SELECT * FROM students ORDER BY id DESC LIMIT 100").fetchall()]
    conn.close()

    for p in preds:
        try:
            p["suggestions"] = json.loads(p.pop("suggestions_json", "[]"))
        except Exception:
            p["suggestions"] = []

    for s in students:
        s["category"] = classify_performance(s["final_exam_marks"])
        s["suggestions"] = build_personalized_suggestions(
            s["attendance_percentage"],
            s["study_hours_per_day"],
            s["previous_exam_marks"],
            s["assignment_score"],
            s["internal_assessment_marks"],
            s["final_exam_marks"],
        )

    return jsonify({
        "prediction_reports": preds,
        "student_reports": students,
    })


@app.route("/api/reports/<int:report_id>", methods=["DELETE"])
def delete_report(report_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM predictions WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Prediction report removed."})


# Initialize database and models when module loads
init_db_and_seed()
ensure_models_loaded()

if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False)
