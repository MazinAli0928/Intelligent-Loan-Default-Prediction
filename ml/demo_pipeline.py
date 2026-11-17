from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ApplicantFeatures:
    monthly_income: float
    monthly_expenses: float
    credit_score: int
    employment_years: float
    existing_loans: int
    requested_amount: float
    tenure_months: int
    savings_consistency: float


def predict_default_probability(features: ApplicantFeatures) -> dict:
    """Deterministic scoring contract used until trained artifacts are plugged in."""
    affordability = features.requested_amount / max(features.monthly_income * features.tenure_months, 1)
    expense_ratio = features.monthly_expenses / max(features.monthly_income, 1)
    pd = (
        0.18
        + (720 - features.credit_score) / 900
        + min(affordability * 2.2, 0.35)
        + (expense_ratio - 0.45) * 0.45
        + min(features.existing_loans * 0.035, 0.16)
        - min(features.employment_years * 0.018, 0.13)
        - (features.savings_consistency - 0.5) * 0.12
    )
    probability = round(max(0.03, min(0.91, pd)), 4)
    tier = "low" if probability < 0.18 else "medium" if probability < 0.34 else "high" if probability < 0.55 else "critical"
    return {
        "model_version": "hybrid-mlp-v2.0",
        "probability_default": probability,
        "risk_tier": tier,
        "confidence": round(max(0.72, min(0.94, 0.92 - abs(probability - 0.42) * 0.35)), 3),
    }
