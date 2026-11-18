import csv
import os
import random

random.seed(42)

FIRST_NAMES = [
    "Aarav", "Sophia", "Liam", "Priya", "Noah", "Maya", "Ethan", "Ananya",
    "Lucas", "Zara", "Oliver", "Isha", "Mateo", "Chloe", "Rohan", "Elena",
    "Daniel", "Nadia", "Samuel", "Kavya", "Benjamin", "Hannah", "Arjun", "Grace",
    "Julian", "Meera", "Leo", "Clara", "Vikram", "Aria", "Nathan", "Diya",
    "Caleb", "Sana", "Isaac", "Nora", "Aditya", "Ruby", "Sebastian", "Tara",
    "Henry", "Leila", "Karan", "Eva", "Gabriel", "Aisha", "Owen", "Iris",
    "Siddharth", "Layla"
]

LAST_NAMES = [
    "Sharma", "Patel", "Chen", "Williams", "Martinez", "Kim", "Anderson", "Nair",
    "Taylor", "Garcia", "Singh", "Miller", "Wilson", "Gupta", "Brown", "Lopez",
    "Lee", "Reddy", "Thomas", "Jackson", "Verma", "Davis", "Clark", "Mehta",
    "Rodriguez", "Lewis", "Walker", "Joshi", "Hall", "Allen", "Young", "Iyer",
    "King", "Wright", "Scott", "Das", "Green", "Baker", "Adams", "Kulkarni",
    "Nelson", "Carter", "Mitchell", "Rao", "Perez", "Roberts", "Turner", "Malhotra"
]

SUBJECTS = [
    "Mathematics",
    "Computer Science",
    "Physics",
    "Data Science",
    "Economics"
]

GENDERS = ["Male", "Female", "Non-Binary"]
GENDER_WEIGHTS = [0.48, 0.48, 0.04]


def clamp(val, low, high):
    return max(low, min(high, val))


def generate_dataset(output_path: str, total_records: int = 550):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    rows = []

    for i in range(total_records):
        student_id = f"STU{1001 + i}"
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        age = random.randint(18, 23)
        gender = random.choices(GENDERS, weights=GENDER_WEIGHTS, k=1)[0]
        subject = SUBJECTS[i % len(SUBJECTS)]

        # Create realistic student archetypes (High achievers, steady, struggling, borderline)
        archetype = random.random()
        if archetype < 0.22:
            # High-performing students
            attendance = clamp(random.gauss(91, 5.5), 75, 100)
            study_hours = clamp(random.gauss(5.8, 1.1), 3.2, 8.8)
            prev_marks = clamp(random.gauss(84, 7.0), 65, 99)
            assignment = clamp(random.gauss(88, 6.0), 70, 100)
            internal = clamp(random.gauss(86, 6.5), 68, 99)
        elif archetype < 0.62:
            # Good / Steady students
            attendance = clamp(random.gauss(81, 7.5), 60, 98)
            study_hours = clamp(random.gauss(4.0, 1.0), 2.0, 7.0)
            prev_marks = clamp(random.gauss(72, 8.0), 50, 92)
            assignment = clamp(random.gauss(76, 8.0), 52, 96)
            internal = clamp(random.gauss(74, 7.5), 52, 94)
        elif archetype < 0.85:
            # Average / Borderline students
            attendance = clamp(random.gauss(70, 8.5), 48, 92)
            study_hours = clamp(random.gauss(2.7, 0.9), 1.0, 5.2)
            prev_marks = clamp(random.gauss(58, 8.5), 36, 78)
            assignment = clamp(random.gauss(62, 9.0), 40, 84)
            internal = clamp(random.gauss(59, 8.5), 35, 80)
        else:
            # At-risk students
            attendance = clamp(random.gauss(54, 9.0), 35, 76)
            study_hours = clamp(random.gauss(1.5, 0.7), 0.5, 3.5)
            prev_marks = clamp(random.gauss(42, 8.5), 22, 62)
            assignment = clamp(random.gauss(46, 9.5), 25, 68)
            internal = clamp(random.gauss(43, 8.5), 22, 64)

        # Subject calibration + subtle non-linear interaction between study hours and attendance
        subject_offset = {
            "Mathematics": -1.2,
            "Computer Science": 1.5,
            "Physics": -1.8,
            "Data Science": 1.1,
            "Economics": 0.4,
        }[subject]

        synergy = 0.032 * (attendance - 70) * (study_hours - 3.5)
        raw_final = (
            0.18 * attendance
            + 2.45 * study_hours
            + 0.25 * prev_marks
            + 0.21 * assignment
            + 0.27 * internal
            + synergy
            + subject_offset
            + random.gauss(0, 2.8)
        )
        final_marks = round(clamp(raw_final, 18.0, 99.5), 1)

        row = {
            "student_id": student_id,
            "student_name": name,
            "age": age,
            "gender": gender,
            "subject": subject,
            "attendance_percentage": round(attendance, 1),
            "study_hours_per_day": round(study_hours, 1),
            "previous_exam_marks": round(prev_marks, 1),
            "assignment_score": round(assignment, 1),
            "internal_assessment_marks": round(internal, 1),
            "final_exam_marks": final_marks,
        }
        rows.append(row)

    # Inject a small number of realistic missing values (~16 cells) so preprocessing handles NaNs cleanly
    missing_indices = random.sample(range(len(rows)), 16)
    missing_fields = [
        "attendance_percentage",
        "study_hours_per_day",
        "previous_exam_marks",
        "assignment_score",
        "internal_assessment_marks",
    ]
    for idx in missing_indices:
        field = random.choice(missing_fields)
        rows[idx][field] = ""

    fieldnames = [
        "student_id",
        "student_name",
        "age",
        "gender",
        "subject",
        "attendance_percentage",
        "study_hours_per_day",
        "previous_exam_marks",
        "assignment_score",
        "internal_assessment_marks",
        "final_exam_marks",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} student records at {output_path}")


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    generate_dataset(os.path.join(base_dir, "student_performance.csv"), 550)
