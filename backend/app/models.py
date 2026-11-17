from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    role: Mapped[Role] = relationship()


class Borrower(Base):
    __tablename__ = "borrowers"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(140), index=True)
    age: Mapped[int]
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(120))
    segment: Mapped[str] = mapped_column(String(80))
    gender: Mapped[str] = mapped_column(String(40))
    monthly_income: Mapped[float]
    monthly_expenses: Mapped[float]
    credit_score: Mapped[int]
    employment_years: Mapped[float]
    existing_loans: Mapped[int]
    alternative_signals: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    applications: Mapped[list["LoanApplication"]] = relationship(back_populates="borrower")


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    borrower_id: Mapped[int] = mapped_column(ForeignKey("borrowers.id"), index=True)
    product: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float]
    tenure_months: Mapped[int]
    purpose: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(60), default="submitted")
    assigned_reviewer: Mapped[str] = mapped_column(String(120), default="Unassigned")
    channel: Mapped[str] = mapped_column(String(80), default="branch")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    borrower: Mapped[Borrower] = relationship(back_populates="applications")
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="application")
    overrides: Mapped[list["OverrideDecision"]] = relationship(back_populates="application")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("loan_applications.id"), index=True)
    model_version: Mapped[str] = mapped_column(String(80))
    probability_default: Mapped[float]
    risk_tier: Mapped[str] = mapped_column(String(40))
    confidence: Mapped[float]
    recommendation: Mapped[str] = mapped_column(String(120))
    explanation: Mapped[list[dict]] = mapped_column(JSON, default=list)
    narrative: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application: Mapped[LoanApplication] = relationship(back_populates="predictions")


class FairnessAudit(Base):
    __tablename__ = "fairness_audits"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_version: Mapped[str] = mapped_column(String(80))
    protected_attribute: Mapped[str] = mapped_column(String(80))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    alert_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(60), default="passed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OverrideDecision(Base):
    __tablename__ = "override_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("loan_applications.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(60))
    reason_code: Mapped[str] = mapped_column(String(120))
    notes: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application: Mapped[LoanApplication] = relationship(back_populates="overrides")
    reviewer: Mapped[User] = relationship()


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    auc: Mapped[float]
    ks_statistic: Mapped[float]
    approval_state: Mapped[str] = mapped_column(String(80))
    training_dataset: Mapped[str] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[int | None]
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RetrainingFeedback(Base):
    __tablename__ = "retraining_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("loan_applications.id"))
    signal_type: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
