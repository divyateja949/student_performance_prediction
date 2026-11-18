# Student Performance Prediction Using Machine Learning

A full-stack academic analytics and machine learning web application that analyzes student behavioral and academic indicators to predict final exam marks, classify performance tiers, surface at-risk students, and generate downloadable PDF/CSV performance reports.

## Project Structure

```text
├── backend/
│   ├── app.py                  # Python Flask REST API & SQLite persistence
│   └── students.db             # Auto-created SQLite database seeded from CSV
├── dataset/
│   ├── generate_dataset.py     # Reproducible 550-record synthetic academic dataset generator
│   └── student_performance.csv # Sample dataset (550 student records)
├── model/
│   ├── train_model.py          # Pandas preprocessing, EDA, Scikit-learn training & Joblib export
│   ├── best_model.joblib       # Selected best trained regressor
│   ├── linear_regression.joblib
│   ├── random_forest.joblib
│   └── model_metadata.json     # Real MAE, MSE, RMSE, R², EDA & test predictions
├── frontend/
│   └── src/                    # Modular React + TypeScript + Chart.js UI
│       ├── components/         # Sidebar, CategoryLabel
│       ├── pages/              # Dashboard, Predict, Students CRUD, ML Analytics, Reports
│       ├── services/           # Typed REST API client
│       ├── utils/              # Chart.js setup & PDF/CSV report exporters
│       ├── App.tsx
│       └── types.ts
├── src/                        # Vite entry bridge
├── server.ts                   # Node/Express + Vite bridge that launches Flask & proxies /api
├── requirements.txt            # Python dependencies
├── package.json                # Node/React dependencies
└── README.md
```

## Features

1. **Academic Dashboard**: Live KPIs (Total Students, Average Marks, Average Attendance, Performing Well, At Academic Risk) and interactive Chart.js visualizations (Performance Distribution, Subject-Wise Performance, Attendance vs Marks, Study Hours vs Marks, and Priority Support Watchlist).
2. **Student Data Management (SQLite CRUD)**: Search, filter by category/subject/gender, paginate, add, edit, and delete student records with server-side validation.
3. **Machine Learning Pipeline (Scikit-learn + Pandas + NumPy)**:
   - Loads `dataset/student_performance.csv`
   - Deduplicates & imputes missing values with Pandas median imputation
   - Computes Exploratory Data Analysis (summary statistics & Pearson correlations)
   - Splits data 80% Train / 20% Test
   - Trains **Linear Regression** and **Random Forest Regression**
   - Evaluates both models using **MAE**, **MSE**, **RMSE**, and **R²**
   - Automatically selects the better model and persists models via **Joblib**
   - Supports live retraining from the SQLite dataset
4. **Student Performance Prediction**: Enter Attendance %, Daily Study Hours, Previous Exam Marks, Assignment Score, and Internal Assessment Marks to predict final exam marks out of 100, view performance category (`85–100: Excellent`, `70–84: Good`, `50–69: Average`, `Below 50: At Risk`), inspect radar/bar charts, and receive personalized improvement recommendations.
5. **Individual Student Reports**: Preview and download detailed student performance reports as **PDF** or **CSV**.

## Running Locally in VS Code

### Prerequisites
- **Python 3.10+**
- **Node.js 20+** and `npm`

### 1. Install Python Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Generate Dataset & Train ML Models
```bash
python3 dataset/generate_dataset.py
python3 model/train_model.py
```

### 3. Install Frontend & Bridge Dependencies
```bash
npm install
```

### 4. Start the Application
Run the integrated development server (starts Python Flask on port `5001` and the React + Vite frontend on port `3000`):
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

#### Optional: Run Backend & Frontend Separately
- Terminal 1 (Flask API on port 5001):
  ```bash
  python3 backend/app.py
  ```
- Terminal 2 (Bridge / Vite on port 3000):
  ```bash
  npm run dev
  ```
