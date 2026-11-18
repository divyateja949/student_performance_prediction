import json
import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYLIBS_DIR = os.path.join(BASE_DIR, ".pylibs")
if os.path.isdir(PYLIBS_DIR) and PYLIBS_DIR not in sys.path:
    sys.path.insert(0, PYLIBS_DIR)

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

DATASET_PATH = os.path.join(BASE_DIR, "dataset", "student_performance.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")
DB_PATH = os.path.join(BASE_DIR, "backend", "students.db")

FEATURE_COLUMNS = [
    "attendance_percentage",
    "study_hours_per_day",
    "previous_exam_marks",
    "assignment_score",
    "internal_assessment_marks",
]
TARGET_COLUMN = "final_exam_marks"

FEATURE_LABELS = {
    "attendance_percentage": "Attendance (%)",
    "study_hours_per_day": "Study Hours / Day",
    "previous_exam_marks": "Previous Exam Marks",
    "assignment_score": "Assignment Score",
    "internal_assessment_marks": "Internal Assessment",
}


def load_raw_dataframe(source="csv"):
    if source == "sqlite" and os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query("SELECT * FROM students", conn)
        conn.close()
        if len(df) >= 20:
            return df, "SQLite Database"
    df = pd.read_csv(DATASET_PATH)
    return df, "CSV Dataset"


def clean_and_preprocess(df: pd.DataFrame):
    raw_rows = int(len(df))
    missing_before = {
        col: int(df[col].isna().sum()) for col in FEATURE_COLUMNS + [TARGET_COLUMN]
    }
    total_missing_before = int(sum(missing_before.values()))

    # Drop duplicate student_ids if any
    if "student_id" in df.columns:
        df = df.drop_duplicates(subset=["student_id"], keep="first").copy()

    # Coerce numeric columns
    for col in FEATURE_COLUMNS + [TARGET_COLUMN, "age"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows missing the target variable
    df = df.dropna(subset=[TARGET_COLUMN]).copy()

    # Impute missing feature values using column median
    imputation_values = {}
    for col in FEATURE_COLUMNS:
        median_val = float(df[col].median())
        imputation_values[col] = round(median_val, 2)
        df[col] = df[col].fillna(median_val)

    # Clamp numeric features to realistic domain bounds
    df["attendance_percentage"] = df["attendance_percentage"].clip(0, 100)
    df["study_hours_per_day"] = df["study_hours_per_day"].clip(0, 16)
    df["previous_exam_marks"] = df["previous_exam_marks"].clip(0, 100)
    df["assignment_score"] = df["assignment_score"].clip(0, 100)
    df["internal_assessment_marks"] = df["internal_assessment_marks"].clip(0, 100)
    df[TARGET_COLUMN] = df[TARGET_COLUMN].clip(0, 100)

    missing_after = int(df[FEATURE_COLUMNS + [TARGET_COLUMN]].isna().sum().sum())

    preprocessing_report = {
        "raw_rows": raw_rows,
        "cleaned_rows": int(len(df)),
        "duplicates_removed": raw_rows - int(len(df)),
        "missing_values_detected": total_missing_before,
        "missing_by_column": missing_before,
        "missing_values_after_cleaning": missing_after,
        "imputation_strategy": "Median Imputation (Pandas)",
        "imputation_values": imputation_values,
    }
    return df, preprocessing_report


def compute_eda(df: pd.DataFrame):
    correlations = {}
    for col in FEATURE_COLUMNS:
        corr = float(df[col].corr(df[TARGET_COLUMN]))
        correlations[col] = round(corr if not np.isnan(corr) else 0.0, 4)

    summary_stats = {}
    for col in FEATURE_COLUMNS + [TARGET_COLUMN]:
        summary_stats[col] = {
            "mean": round(float(df[col].mean()), 2),
            "std": round(float(df[col].std()), 2),
            "min": round(float(df[col].min()), 2),
            "median": round(float(df[col].median()), 2),
            "max": round(float(df[col].max()), 2),
        }

    return {
        "correlations_with_final_marks": correlations,
        "summary_statistics": summary_stats,
    }


def evaluate_model(model, X_test, y_test):
    preds = np.clip(model.predict(X_test), 0, 100)
    mae = float(mean_absolute_error(y_test, preds))
    mse = float(mean_squared_error(y_test, preds))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_test, preds))
    return {
        "mae": round(mae, 4),
        "mse": round(mse, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
    }, preds


def train_and_save(source="csv"):
    os.makedirs(MODEL_DIR, exist_ok=True)
    raw_df, data_source_label = load_raw_dataframe(source=source)
    clean_df, preprocessing_report = clean_and_preprocess(raw_df)
    eda = compute_eda(clean_df)

    X = clean_df[FEATURE_COLUMNS]
    y = clean_df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    # 1. Linear Regression
    lr_model = LinearRegression()
    lr_model.fit(X_train, y_train)
    lr_metrics, lr_preds = evaluate_model(lr_model, X_test, y_test)

    # 2. Random Forest Regression
    rf_model = RandomForestRegressor(
        n_estimators=180,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    rf_model.fit(X_train, y_train)
    rf_metrics, rf_preds = evaluate_model(rf_model, X_test, y_test)

    # Model selection based on R² (and RMSE tie-breaker)
    if rf_metrics["r2"] >= lr_metrics["r2"]:
        selected_key = "random_forest"
        selected_name = "Random Forest Regression"
        best_model = rf_model
        best_preds = rf_preds
        selection_reason = (
            f"Random Forest Regression outperformed Linear Regression with higher R² "
            f"({rf_metrics['r2']:.4f} vs {lr_metrics['r2']:.4f}) and lower RMSE "
            f"({rf_metrics['rmse']:.4f} vs {lr_metrics['rmse']:.4f})."
        )
    else:
        selected_key = "linear_regression"
        selected_name = "Linear Regression"
        best_model = lr_model
        best_preds = lr_preds
        selection_reason = (
            f"Linear Regression outperformed Random Forest Regression with higher R² "
            f"({lr_metrics['r2']:.4f} vs {rf_metrics['r2']:.4f}) and lower RMSE "
            f"({lr_metrics['rmse']:.4f} vs {rf_metrics['rmse']:.4f})."
        )

    # Save models with Joblib
    joblib.dump(lr_model, os.path.join(MODEL_DIR, "linear_regression.joblib"))
    joblib.dump(rf_model, os.path.join(MODEL_DIR, "random_forest.joblib"))
    joblib.dump(best_model, os.path.join(MODEL_DIR, "best_model.joblib"))

    # Feature importance comparison
    rf_importances = [round(float(v), 4) for v in rf_model.feature_importances_]
    # Standardized linear coefficients for interpretability
    feature_stds = X_train.std().values
    raw_coefs = np.abs(lr_model.coef_) * feature_stds
    coef_sum = float(np.sum(raw_coefs)) if np.sum(raw_coefs) > 0 else 1.0
    lr_importances = [round(float(v / coef_sum), 4) for v in raw_coefs]

    feature_importance_list = []
    for idx, col in enumerate(FEATURE_COLUMNS):
        feature_importance_list.append({
            "feature": col,
            "label": FEATURE_LABELS[col],
            "random_forest_importance": rf_importances[idx],
            "linear_regression_weight": lr_importances[idx],
            "linear_coefficient": round(float(lr_model.coef_[idx]), 4),
        })

    # Actual vs Predicted sample points from test set
    test_indices = y_test.index.tolist()
    actual_vs_predicted = []
    for pos, df_idx in enumerate(test_indices[:80]):
        student_name = (
            str(clean_df.loc[df_idx, "student_name"])
            if "student_name" in clean_df.columns
            else f"Student {pos + 1}"
        )
        student_id = (
            str(clean_df.loc[df_idx, "student_id"])
            if "student_id" in clean_df.columns
            else f"STU{pos + 1}"
        )
        actual_vs_predicted.append({
            "student_id": student_id,
            "student_name": student_name,
            "actual": round(float(y_test.iloc[pos]), 2),
            "linear_predicted": round(float(lr_preds[pos]), 2),
            "rf_predicted": round(float(rf_preds[pos]), 2),
            "best_predicted": round(float(best_preds[pos]), 2),
        })

    metadata = {
        "data_source": data_source_label,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "split_ratio": "80% Train / 20% Test",
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "preprocessing": preprocessing_report,
        "eda": eda,
        "models": {
            "linear_regression": {
                "name": "Linear Regression",
                "metrics": lr_metrics,
                "intercept": round(float(lr_model.intercept_), 4),
            },
            "random_forest": {
                "name": "Random Forest Regression",
                "metrics": rf_metrics,
                "n_estimators": 180,
                "max_depth": 10,
            },
        },
        "selected_model": {
            "key": selected_key,
            "name": selected_name,
            "reason": selection_reason,
            "metrics": rf_metrics if selected_key == "random_forest" else lr_metrics,
        },
        "feature_importance": feature_importance_list,
        "actual_vs_predicted": actual_vs_predicted,
    }

    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Training complete. Selected model: {selected_name}")
    print(f"Linear Regression -> MAE: {lr_metrics['mae']}, RMSE: {lr_metrics['rmse']}, R2: {lr_metrics['r2']}")
    print(f"Random Forest     -> MAE: {rf_metrics['mae']}, RMSE: {rf_metrics['rmse']}, R2: {rf_metrics['r2']}")
    return metadata


if __name__ == "__main__":
    train_and_save(source="csv")
