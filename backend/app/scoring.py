from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import Borrower, LoanApplication

ACTIVE_MODEL_VERSION = "v1.0"
FAIRNESS_MITIGATION_ACTIVE = False

@dataclass(frozen=True)
class ScoreResult:
    probability_default: float
    risk_tier: str
    confidence: float
    recommendation: str
    explanation: list[dict]
    narrative: str

def score_application(borrower: Borrower, application: LoanApplication) -> ScoreResult:
    from ml.production_inference import predict_loan_risk

    input_data = {
        "loan_amount": float(min(40000.0, max(500.0, application.amount))),
        "annual_income": float(max(1.0, borrower.monthly_income * 12.0)),
        "dti": float(min(100.0, max(0.0, (borrower.monthly_expenses / max(borrower.monthly_income, 1.0)) * 100.0))),
        "fico_score": float(min(850.0, max(300.0, borrower.credit_score))),
        "credit_history_years": float(max(0.0, borrower.employment_years)),
        "employment_length": "10+ years" if borrower.employment_years >= 10 else f"{int(borrower.employment_years)} years" if borrower.employment_years >= 1 else "< 1 year",
        "home_ownership": "MORTGAGE",
        "loan_purpose": application.purpose if application.purpose in ["debt_consolidation", "credit_card", "home_improvement", "other", "major_purchase", "medical", "small_business", "car", "vacation", "moving", "house", "wedding", "renewable_energy", "educational"] else "debt_consolidation"
    }

    res = predict_loan_risk(input_data)
    probability = float(res["calibrated_probability"])
    tier = str(res["risk_tier"]).lower()
    prediction_label = res.get("prediction_label", "Approved" if res.get("predicted_class", 0) == 0 else "Declined")
    recommendation = "approve" if prediction_label.lower() == "approved" else "decline"

    explanation = []
    for exp in res["explanations"]:
        explanation.append({
            "feature": exp["feature"],
            "label": exp.get("display_name", exp.get("feature", "Feature")),
            "value": str(exp["feature_value"]),
            "contribution": round(float(exp["shap_value"]), 4),
            "direction": "risk" if exp.get("impact_direction") == "positive_risk" else "protective"
        })

    confidence = 0.95
    narrative = (
        f"{borrower.full_name} is classified as {tier} risk with a "
        f"{probability:.1%} calibrated probability of default using production XGBoost Base v1.0."
    )

    return ScoreResult(probability, tier, confidence, recommendation, explanation, narrative)

def fairness_snapshot(predictions: list[tuple[str, float, str]]) -> dict:
    groups: dict[str, list] = {}
    for group, pd, tier in predictions:
        groups.setdefault(group, []).append((pd, tier.lower()))
    comparison = {}
    approval_rates = []
    high_risk_rates = []
    for group, rows in groups.items():
        approvals = sum(1 for pd, _ in rows if pd < 0.45)
        high_risk = sum(1 for _, t in rows if t in {"high", "critical"})
        ar = approvals / max(len(rows), 1)
        hrr = high_risk / max(len(rows), 1)
        approval_rates.append(ar)
        high_risk_rates.append(hrr)
        comparison[group] = {
            "count": len(rows),
            "approval_rate": round(ar, 3),
            "high_risk_rate": round(hrr, 3),
            "average_pd": round(sum(p for p, _ in rows) / max(len(rows), 1), 3)
        }
    return {
        "demographic_parity_gap": round(max(approval_rates, default=0) - min(approval_rates, default=0), 3),
        "equalized_odds_proxy_gap": round(max(high_risk_rates, default=0) - min(high_risk_rates, default=0), 3),
        "groups": comparison,
        "thresholds": {"demographic_parity_gap": 0.18, "equalized_odds_proxy_gap": 0.22},
    }
