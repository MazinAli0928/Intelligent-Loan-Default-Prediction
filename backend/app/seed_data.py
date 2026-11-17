from __future__ import annotations

from sqlalchemy.orm import Session
from . import models
import hashlib

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def seed_database(db: Session) -> None:
    if db.query(models.User).first():
        return

    roles = {
        "Lender Analyst": models.Role(
            name="Lender Analyst",
            permissions=["dashboard:read", "borrowers:write", "applications:score", "reports:read"],
        ),
        "Compliance Officer": models.Role(
            name="Compliance Officer",
            permissions=["dashboard:read", "fairness:run", "overrides:write", "audit:read"],
        ),
        "Admin": models.Role(
            name="Admin",
            permissions=["*"],
        ),
    }
    db.add_all(roles.values())
    db.flush()

    default_hash = hash_pw("password123")
    db.add_all(
        [
            models.User(name="Asha Mehta", email="analyst@demo.local", password_hash=default_hash, role=roles["Lender Analyst"]),
            models.User(name="Rahul Verma", email="compliance@demo.local", password_hash=default_hash, role=roles["Compliance Officer"]),
            models.User(name="Nisha Rao", email="admin@demo.local", password_hash=default_hash, role=roles["Admin"]),
        ]
    )

    borrowers = [
        models.Borrower(
            full_name="Priya Sharma",
            age=34,
            city="Mumbai",
            state="Maharashtra",
            segment="salaried_prime",
            gender="female",
            monthly_income=145000,
            monthly_expenses=62000,
            credit_score=782,
            employment_years=8.5,
            existing_loans=1,
            alternative_signals={"savings_consistency": 0.82, "utility_payment_score": 0.91},
        ),
        models.Borrower(
            full_name="Arjun Nair",
            age=42,
            city="Bengaluru",
            state="Karnataka",
            segment="self_employed",
            gender="male",
            monthly_income=98000,
            monthly_expenses=76000,
            credit_score=642,
            employment_years=5.0,
            existing_loans=3,
            alternative_signals={"savings_consistency": 0.38, "utility_payment_score": 0.74},
        ),
        models.Borrower(
            full_name="Farah Khan",
            age=29,
            city="Hyderabad",
            state="Telangana",
            segment="new_to_credit",
            gender="female",
            monthly_income=72000,
            monthly_expenses=39000,
            credit_score=611,
            employment_years=2.2,
            existing_loans=0,
            alternative_signals={"savings_consistency": 0.64, "utility_payment_score": 0.88},
        ),
        models.Borrower(
            full_name="Dev Patel",
            age=51,
            city="Ahmedabad",
            state="Gujarat",
            segment="micro_business",
            gender="male",
            monthly_income=86000,
            monthly_expenses=83000,
            credit_score=586,
            employment_years=12.0,
            existing_loans=4,
            alternative_signals={"savings_consistency": 0.29, "utility_payment_score": 0.66},
        ),
    ]
    db.add_all(borrowers)
    db.flush()

    db.add_all(
        [
            models.LoanApplication(
                borrower_id=borrowers[0].id,
                product="Home Improvement Loan",
                amount=850000,
                tenure_months=60,
                purpose="debt_consolidation",
                status="approved",
                assigned_reviewer="Asha Mehta",
                channel="digital",
            ),
            models.LoanApplication(
                borrower_id=borrowers[1].id,
                product="MSME Working Capital",
                amount=1250000,
                tenure_months=36,
                purpose="small_business",
                status="manual_review",
                assigned_reviewer="Rahul Verma",
                channel="branch",
            ),
            models.LoanApplication(
                borrower_id=borrowers[2].id,
                product="Personal Loan",
                amount=320000,
                tenure_months=36,
                purpose="educational",
                status="submitted",
                assigned_reviewer="Asha Mehta",
                channel="partner",
            ),
            models.LoanApplication(
                borrower_id=borrowers[3].id,
                product="Equipment Finance",
                amount=975000,
                tenure_months=48,
                purpose="major_purchase",
                status="submitted",
                assigned_reviewer="Rahul Verma",
                channel="branch",
            ),
        ]
    )

    db.add_all(
        [
            models.ModelVersion(
                name="XGBoost Base + Isotonic Calibration v1.0",
                version="xgboost-isotonic-v1.0",
                auc=0.932,
                ks_statistic=0.729,
                approval_state="approved",
                training_dataset="LendingClub Historical Granted Loans Dataset",
                is_active=True,
            ),
            models.ModelVersion(
                name="Logistic Baseline",
                version="risk-logit-baseline-v0.8",
                auc=0.781,
                ks_statistic=0.351,
                approval_state="archived",
                training_dataset="LendingClub Historical Granted Loans Dataset",
                is_active=False,
            ),
        ]
    )
    db.commit()
