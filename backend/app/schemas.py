from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class RoleOut(BaseModel):
    name: str
    permissions: list[str]

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: RoleOut

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    size: int
    pages: int


class BorrowerCreate(BaseModel):
    full_name: str
    age: int = Field(ge=18, le=80)
    city: str
    state: str
    segment: str
    gender: str
    monthly_income: float = Field(gt=0)
    monthly_expenses: float = Field(ge=0)
    credit_score: int = Field(ge=300, le=900)
    employment_years: float = Field(ge=0)
    existing_loans: int = Field(ge=0)
    alternative_signals: dict[str, Any] = Field(default_factory=dict)


class BorrowerOut(BorrowerCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    borrower_id: int
    product: str
    amount: float = Field(gt=0)
    tenure_months: int = Field(ge=3, le=360)
    purpose: str
    channel: str = "branch"
    assigned_reviewer: str = "Unassigned"


class ApplicationOut(ApplicationCreate):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    borrower: BorrowerOut

    model_config = ConfigDict(from_attributes=True)


class FeatureContribution(BaseModel):
    feature: str
    label: str
    value: str
    contribution: float
    direction: str


class PredictionOut(BaseModel):
    id: int
    application_id: int
    model_version: str
    probability_default: float
    risk_tier: str
    confidence: float
    recommendation: str
    explanation: list[FeatureContribution]
    narrative: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExplanationOut(BaseModel):
    prediction_id: int
    top_drivers: list[FeatureContribution]
    narrative: str


class OverrideCreate(BaseModel):
    decision: str = Field(pattern="^(approve|reject|manual_review)$")
    reason_code: str = Field(min_length=3)
    notes: str = Field(min_length=8)


class OverrideOut(OverrideCreate):
    id: int
    application_id: int
    reviewer_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FairnessAuditOut(BaseModel):
    id: int
    model_version: str
    protected_attribute: str
    metrics: dict[str, Any]
    alert_count: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelVersionOut(BaseModel):
    id: int
    name: str
    version: str
    auc: float
    ks_statistic: float
    approval_state: str
    training_dataset: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    total_applications: int
    high_risk_cases: int
    average_pd: float
    fairness_alerts: int
    active_model: str
    risk_distribution: dict[str, int]
    approval_trend: list[dict[str, Any]]
    recent_queue: list[dict[str, Any]]


class SimulatorRequest(BaseModel):
    income: float
    expenses: float
    credit_score: int
    amount: float
    tenure_months: int
    existing_loans: int
    employment_years: float
    savings_consistency: float
    gender: str = "male"


class SimulatorResponse(BaseModel):
    probability_default: float
    risk_tier: str
    confidence: float
    recommendation: str
    explanation: list[dict[str, Any]]
    narrative: str


class AuditLogOut(BaseModel):
    id: int
    actor_id: int | None
    actor_name: str | None = None
    action: str
    entity_type: str
    entity_id: int | None
    metadata_json: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ProductionPredictRequest(BaseModel):
    loan_amount: float = Field(..., validation_alias=AliasChoices("loan_amount", "loan_amnt"), ge=500.0, le=100000.0, description="Requested loan amount in USD (500 to 100,000)")
    annual_income: float = Field(..., validation_alias=AliasChoices("annual_income", "revenue"), ge=0.0, le=10000000.0, description="Annual income in USD (0 to 10,000,000)")
    dti: float = Field(..., validation_alias=AliasChoices("dti", "dti_n"), ge=0.0, le=100.0, description="Debt-to-income ratio (0.0 to 100.0)")
    fico_score: float = Field(..., validation_alias=AliasChoices("fico_score", "fico_n"), ge=300.0, le=850.0, description="FICO credit score (300 to 850)")
    credit_history_years: float = Field(..., validation_alias=AliasChoices("credit_history_years", "experience_c"), ge=0.0, le=70.0, description="Years of credit history (0.0 to 70.0)")
    employment_length: str = Field(..., validation_alias=AliasChoices("employment_length", "emp_length"), description="Employment length category (e.g. '10+ years', '< 1 year')")
    home_ownership: str = Field(..., validation_alias=AliasChoices("home_ownership", "home_ownership_n"), description="Home ownership status (e.g. MORTGAGE, RENT, OWN)")
    loan_purpose: str = Field(..., validation_alias=AliasChoices("loan_purpose", "purpose"), description="Loan purpose category (e.g. debt_consolidation, credit_card)")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ProductionSHAPExplanation(BaseModel):
    feature: str
    human_feature_name: str
    feature_value: Any
    shap_value: float
    impact_direction: str
    impact_magnitude: str
    statement: str


class ProductionPredictResponse(BaseModel):
    model_name: str = "XGBoost"
    model_version: str = "v1.0"
    calibration_method: str = "IsotonicRegression"
    raw_probability: float = Field(..., ge=0.0, le=1.0)
    calibrated_probability: float = Field(..., ge=0.0, le=1.0)
    threshold: float = 0.45
    predicted_class: int = Field(..., ge=0, le=1)
    prediction: str
    decision: str
    risk_tier: str
    risk_tier_description: str
    uncertainty_status: str = "not_available"
    risk_factors: list[ProductionSHAPExplanation] = Field(default_factory=list)
    protective_factors: list[ProductionSHAPExplanation] = Field(default_factory=list)
    shap_explanations: list[ProductionSHAPExplanation] = Field(default_factory=list)

