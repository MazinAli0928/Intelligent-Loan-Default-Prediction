from __future__ import annotations

from collections import Counter
from datetime import datetime

import math
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .database import Base, engine, get_db
from .reports import build_risk_report_pdf
from .scoring import ACTIVE_MODEL_VERSION, fairness_snapshot, score_application
from . import scoring
from .seed_data import seed_database


from fastapi.middleware.cors import CORSMiddleware
import os, sys
from pathlib import Path
_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

from ml.production_inference import predict_loan_risk

app = FastAPI(
    title="Enterprise AI Loan Default Risk Platform",
    version="1.0.0",
    description="Demo-grade lender risk platform with scoring, explainability, fairness, overrides, and reports.",
)

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        seed_database(db)


def log_event(
    db: Session,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    metadata: dict | None = None,
) -> None:
    db.add(
        models.AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
        )
    )


import hashlib


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    if not authorization:
        user = db.query(models.User).options(joinedload(models.User.role)).first()
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization")
    token = authorization.replace("Bearer ", "")
    if not (token.startswith("demo-") or token.startswith("auth-")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = int(token.split("-")[1])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    user = (
        db.query(models.User)
        .options(joinedload(models.User.role))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return user


@app.post("/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .options(joinedload(models.User.role))
        .filter(models.User.email == payload.email)
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    hashed_pw = hashlib.sha256(payload.password.encode()).hexdigest()
    if user.password_hash != hashed_pw:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = f"auth-{user.id}"
    return {"token": token, "user": user}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "loan-risk-platform"}


@app.post("/api/predict", response_model=schemas.ProductionPredictResponse, tags=["Production Inference"])
@app.post("/predict", response_model=schemas.ProductionPredictResponse, tags=["Production Inference"])
def api_predict(payload: schemas.ProductionPredictRequest) -> schemas.ProductionPredictResponse:
    """
    Canonical production prediction endpoint.
    Calls ml.production_inference.predict_loan_risk() for XGBoost Base + Isotonic model v1.0.
    Accepts the 8 production user inputs and returns calibrated default probability,
    classification decision, risk tier, and TreeSHAP explanations.
    """
    try:
        input_dict = {
            "loan_amount": payload.loan_amount,
            "annual_income": payload.annual_income,
            "dti": payload.dti,
            "fico_score": payload.fico_score,
            "credit_history_years": payload.credit_history_years,
            "employment_length": payload.employment_length,
            "home_ownership": payload.home_ownership,
            "loan_purpose": payload.loan_purpose,
        }
        result = predict_loan_risk(input_dict)
        
        risk_factors = [e for e in result["explanations"] if e["impact_direction"] == "positive_risk"]
        protective_factors = [e for e in result["explanations"] if e["impact_direction"] == "protective"]
        decision = "Decline" if result["predicted_class"] == 1 else "Approve"
        
        return schemas.ProductionPredictResponse(
            model_name=result["model_name"],
            model_version="v1.0",
            calibration_method=result["calibration_method"],
            raw_probability=result["raw_probability"],
            calibrated_probability=result["calibrated_probability"],
            threshold=result["threshold"],
            predicted_class=result["predicted_class"],
            prediction=result["prediction_label"],
            decision=decision,
            risk_tier=result["risk_tier"],
            risk_tier_description=result["risk_tier_description"],
            uncertainty_status=result["uncertainty_status"],
            risk_factors=risk_factors,
            protective_factors=protective_factors,
            shap_explanations=result["explanations"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except Exception as e:
        import logging
        logging.error("Production inference server error: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal inference error occurred. Please contact system administrator."
        )


@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)) -> schemas.LoginResponse:
    user = (
        db.query(models.User)
        .options(joinedload(models.User.role))
        .filter(models.User.email == payload.email)
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Unknown demo user")
    return schemas.LoginResponse(token=f"demo-{user.id}", user=user)


@app.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)) -> models.User:
    return current_user


@app.get("/admin/users", response_model=list[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.User]:
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can view user list")
    return db.query(models.User).options(joinedload(models.User.role)).all()


@app.post("/admin/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can create new users")
    
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    role = db.query(models.Role).filter(models.Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' does not exist")

    pw_hash = hashlib.sha256(payload.password.encode()).hexdigest()
    new_user = models.User(name=payload.name, email=payload.email, password_hash=pw_hash, role=role)
    db.add(new_user)
    db.flush()
    log_event(db, current_user.id, "user.created", "user", new_user.id, {"email": new_user.email, "role": role.name})
    db.commit()
    db.refresh(new_user)
    return new_user


@app.delete("/admin/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role.name != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can delete users")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Admin cannot delete their own account")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_event(db, current_user.id, "user.deleted", "user", user.id, {"email": user.email})
    db.delete(user)
    db.commit()
    return Response(status_code=204)


@app.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)) -> schemas.DashboardSummary:
    applications = db.query(models.LoanApplication).options(joinedload(models.LoanApplication.borrower)).all()
    predictions = db.query(models.Prediction).all()
    audits = db.query(models.FairnessAudit).all()
    active_model = db.query(models.ModelVersion).filter(models.ModelVersion.is_active.is_(True)).first()
    latest_by_app = {}
    for prediction in predictions:
        latest_by_app[prediction.application_id] = prediction
    distribution = Counter(prediction.risk_tier for prediction in predictions)
    average_pd = round(sum(p.probability_default for p in predictions) / max(len(predictions), 1), 4)
    recent_queue = [
        {
            "id": app_item.id,
            "borrower": app_item.borrower.full_name,
            "amount": app_item.amount,
            "status": app_item.status,
            "risk_tier": latest_by_app.get(app_item.id).risk_tier if app_item.id in latest_by_app else "unscored",
            "reviewer": app_item.assigned_reviewer,
        }
        for app_item in applications[-6:]
    ]
    return schemas.DashboardSummary(
        total_applications=len(applications),
        high_risk_cases=sum(1 for p in predictions if p.risk_tier in {"high", "critical"}),
        average_pd=average_pd,
        fairness_alerts=sum(a.alert_count for a in audits),
        active_model=active_model.version if active_model else ACTIVE_MODEL_VERSION,
        risk_distribution={tier: distribution.get(tier, 0) for tier in ["low", "medium", "high", "critical"]},
        approval_trend=[
            {"month": "Apr", "approved": 42, "rejected": 11, "manual_review": 16},
            {"month": "May", "approved": 51, "rejected": 13, "manual_review": 19},
            {"month": "Jun", "approved": 48, "rejected": 17, "manual_review": 22},
            {"month": "Jul", "approved": 55, "rejected": 12, "manual_review": 18},
        ],
        recent_queue=recent_queue,
    )


@app.get("/borrowers", response_model=schemas.PaginatedResponse)
def list_borrowers(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.PaginatedResponse:
    query = db.query(models.Borrower)
    if search:
        query = query.filter(
            (models.Borrower.full_name.ilike(f"%{search}%")) |
            (models.Borrower.city.ilike(f"%{search}%")) |
            (models.Borrower.segment.ilike(f"%{search}%"))
        )
    total = query.count()
    items = query.order_by(models.Borrower.full_name).offset((page - 1) * size).limit(size).all()
    pages = math.ceil(total / size) if total > 0 else 1
    item_schemas = [schemas.BorrowerOut.model_validate(b) for b in items]
    return schemas.PaginatedResponse(items=item_schemas, total=total, page=page, size=size, pages=pages)


@app.post("/borrowers", response_model=schemas.BorrowerOut, status_code=201)
def create_borrower(
    payload: schemas.BorrowerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Borrower:
    if current_user.role.name not in ["Lender Analyst", "Admin"]:
        raise HTTPException(status_code=403, detail="Only Lender Analysts and Admins can create borrowers")

    borrower = models.Borrower(**payload.model_dump())
    db.add(borrower)
    db.commit()
    db.refresh(borrower)

    log_event(
        db,
        current_user.id,
        "borrower.created",
        "borrower",
        borrower.id,
        {
            "full_name": borrower.full_name,
            "credit_score": borrower.credit_score,
            "monthly_income": borrower.monthly_income,
            "city": borrower.city,
        },
    )
    db.commit()
    db.refresh(borrower)
    return borrower


@app.get("/borrowers/{borrower_id}", response_model=schemas.BorrowerOut)
def get_borrower(borrower_id: int, db: Session = Depends(get_db)) -> models.Borrower:
    borrower = db.get(models.Borrower, borrower_id)
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return borrower


@app.get("/applications", response_model=schemas.PaginatedResponse)
def list_applications(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.PaginatedResponse:
    query = db.query(models.LoanApplication).options(joinedload(models.LoanApplication.borrower))
    if status:
        query = query.filter(models.LoanApplication.status == status)
    total = query.count()
    items = query.order_by(models.LoanApplication.created_at.desc()).offset((page - 1) * size).limit(size).all()
    pages = math.ceil(total / size) if total > 0 else 1
    item_schemas = [schemas.ApplicationOut.model_validate(app_item) for app_item in items]
    return schemas.PaginatedResponse(items=item_schemas, total=total, page=page, size=size, pages=pages)


@app.post("/applications", response_model=schemas.ApplicationOut, status_code=201)
def create_application(
    payload: schemas.ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.LoanApplication:
    if current_user.role.name not in ["Lender Analyst", "Admin"]:
        raise HTTPException(status_code=403, detail="Only lenders and admins can create applications")
    if not db.get(models.Borrower, payload.borrower_id):
        raise HTTPException(status_code=404, detail="Borrower not found")
    application = models.LoanApplication(**payload.model_dump())
    db.add(application)
    db.flush()
    log_event(
        db,
        current_user.id,
        "application.created",
        "application",
        application.id,
        {
            "product": application.product,
            "amount": application.amount,
            "purpose": application.purpose,
            "borrower_id": application.borrower_id,
        },
    )
    db.commit()
    return (
        db.query(models.LoanApplication)
        .options(joinedload(models.LoanApplication.borrower))
        .filter(models.LoanApplication.id == application.id)
        .one()
    )


@app.get("/applications/{application_id}", response_model=schemas.ApplicationOut)
def get_application(application_id: int, db: Session = Depends(get_db)) -> models.LoanApplication:
    application = (
        db.query(models.LoanApplication)
        .options(joinedload(models.LoanApplication.borrower))
        .filter(models.LoanApplication.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@app.post("/applications/{application_id}/score", response_model=schemas.PredictionOut)
def score(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Prediction:
    application = (
        db.query(models.LoanApplication)
        .options(joinedload(models.LoanApplication.borrower))
        .filter(models.LoanApplication.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    result = score_application(application.borrower, application)
    prediction = models.Prediction(
        application_id=application.id,
        model_version=ACTIVE_MODEL_VERSION,
        probability_default=result.probability_default,
        risk_tier=result.risk_tier,
        confidence=result.confidence,
        recommendation=result.recommendation,
        explanation=result.explanation,
        narrative=result.narrative,
    )
    application.status = "manual_review" if result.risk_tier in {"high", "critical"} else "scored"
    application.updated_at = datetime.utcnow()
    db.add(prediction)
    db.flush()
    log_event(
        db,
        current_user.id,
        "application.scored",
        "prediction",
        prediction.id,
        {
            "risk_tier": result.risk_tier,
            "probability_default": round(result.probability_default, 4),
            "recommendation": result.recommendation,
            "application_id": application.id,
        },
    )
    db.commit()
    db.refresh(prediction)
    return prediction


@app.get("/applications/{application_id}/prediction", response_model=schemas.PredictionOut)
def get_application_prediction(application_id: int, db: Session = Depends(get_db)) -> models.Prediction:
    prediction = (
        db.query(models.Prediction)
        .filter(models.Prediction.application_id == application_id)
        .order_by(models.Prediction.created_at.desc())
        .first()
    )
    if not prediction:
        raise HTTPException(status_code=404, detail="No prediction found for this application")
    return prediction


@app.get("/predictions/{prediction_id}/explanation", response_model=schemas.ExplanationOut)
def prediction_explanation(prediction_id: int, db: Session = Depends(get_db)) -> schemas.ExplanationOut:
    prediction = db.get(models.Prediction, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return schemas.ExplanationOut(
        prediction_id=prediction.id,
        top_drivers=prediction.explanation,
        narrative=prediction.narrative,
    )


@app.get("/fairness/audits", response_model=list[schemas.FairnessAuditOut])
def list_fairness_audits(db: Session = Depends(get_db)) -> list[models.FairnessAudit]:
    return db.query(models.FairnessAudit).order_by(models.FairnessAudit.created_at.desc()).all()


@app.post("/fairness/audits/run", response_model=schemas.FairnessAuditOut)
def run_fairness_audit(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.FairnessAudit:
    predictions = (
        db.query(models.Prediction, models.Borrower.gender)
        .join(models.LoanApplication, models.Prediction.application_id == models.LoanApplication.id)
        .join(models.Borrower, models.LoanApplication.borrower_id == models.Borrower.id)
        .all()
    )
    if not predictions:
        apps = (
            db.query(models.LoanApplication)
            .options(joinedload(models.LoanApplication.borrower))
            .all()
        )
        for application in apps:
            result = score_application(application.borrower, application)
            db.add(
                models.Prediction(
                    application_id=application.id,
                    model_version=ACTIVE_MODEL_VERSION,
                    probability_default=result.probability_default,
                    risk_tier=result.risk_tier,
                    confidence=result.confidence,
                    recommendation=result.recommendation,
                    explanation=result.explanation,
                    narrative=result.narrative,
                )
            )
        db.flush()
        predictions = (
            db.query(models.Prediction, models.Borrower.gender)
            .join(models.LoanApplication, models.Prediction.application_id == models.LoanApplication.id)
            .join(models.Borrower, models.LoanApplication.borrower_id == models.Borrower.id)
            .all()
        )
    metrics = fairness_snapshot([(gender, pred.probability_default, pred.risk_tier) for pred, gender in predictions])
    alert_count = sum(
        1
        for key, threshold in metrics["thresholds"].items()
        if metrics.get(key, 0) > threshold
    )
    audit = models.FairnessAudit(
        model_version=ACTIVE_MODEL_VERSION,
        protected_attribute="gender",
        metrics=metrics,
        alert_count=alert_count,
        status="attention_required" if alert_count else "passed",
    )
    db.add(audit)
    db.flush()
    log_event(
        db,
        current_user.id,
        "fairness.audit_run",
        "fairness_audit",
        audit.id,
        {
            "protected_attribute": audit.protected_attribute,
            "status": audit.status,
            "alert_count": audit.alert_count,
        },
    )
    db.commit()
    db.refresh(audit)
    return audit


@app.post("/applications/{application_id}/override", response_model=schemas.OverrideOut)
def submit_override(
    application_id: int,
    payload: schemas.OverrideCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.OverrideDecision:
    if current_user.role.name not in ["Lender Analyst", "Admin"]:
        raise HTTPException(status_code=403, detail="Only lenders and admins can approve or override loans")
    application = db.get(models.LoanApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    override = models.OverrideDecision(
        application_id=application.id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        reason_code=payload.reason_code,
        notes=payload.notes,
    )
    application.status = payload.decision
    application.updated_at = datetime.utcnow()
    db.add(override)
    db.add(
        models.RetrainingFeedback(
            application_id=application.id,
            signal_type="human_override",
            payload=payload.model_dump(),
        )
    )
    db.flush()
    log_event(
        db,
        current_user.id,
        "override.submitted",
        "application",
        application.id,
        {
            "decision": payload.decision,
            "reason_code": payload.reason_code,
            "notes": payload.notes,
            "reviewer": current_user.name,
        },
    )
    db.commit()
    db.refresh(override)
    return override


@app.get("/reports/{application_id}.pdf")
def report(application_id: int, db: Session = Depends(get_db)) -> Response:
    application = (
        db.query(models.LoanApplication)
        .options(joinedload(models.LoanApplication.borrower))
        .filter(models.LoanApplication.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    prediction = (
        db.query(models.Prediction)
        .filter(models.Prediction.application_id == application_id)
        .order_by(models.Prediction.created_at.desc())
        .first()
    )
    override = (
        db.query(models.OverrideDecision)
        .filter(models.OverrideDecision.application_id == application_id)
        .order_by(models.OverrideDecision.created_at.desc())
        .first()
    )
    pdf = build_risk_report_pdf(application.borrower, application, prediction, override)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="risk-report-{application_id}.pdf"'},
    )


@app.get("/models", response_model=list[schemas.ModelVersionOut])
def list_models(db: Session = Depends(get_db)) -> list[models.ModelVersion]:
    return db.query(models.ModelVersion).order_by(models.ModelVersion.created_at.desc()).all()


@app.post("/models/{model_id}/activate", response_model=schemas.ModelVersionOut)
def activate_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ModelVersion:
    model = db.get(models.ModelVersion, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.query(models.ModelVersion).update({models.ModelVersion.is_active: False})
    model.is_active = True
    log_event(
        db,
        current_user.id,
        "model.activated",
        "model_version",
        model.id,
        {
            "version": model.version,
            "name": model.name,
            "auc": model.auc,
            "ks_statistic": model.ks_statistic,
        },
    )
    db.commit()
    db.refresh(model)
    return model


# ── What-If Risk Simulator ──────────────────────────────────────────────────
@app.post("/score/simulate", response_model=schemas.SimulatorResponse)
def simulate_score(
    payload: schemas.SimulatorRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Run the scoring engine against ad-hoc inputs without persisting anything."""
    fake_borrower = models.Borrower(
        full_name="Simulator",
        age=30,
        city="N/A",
        state="N/A",
        segment="salaried_prime",
        gender=payload.gender,
        monthly_income=payload.income,
        monthly_expenses=payload.expenses,
        credit_score=payload.credit_score,
        employment_years=payload.employment_years,
        existing_loans=payload.existing_loans,
        alternative_signals={"savings_consistency": payload.savings_consistency, "utility_payment_score": 0.75},
    )
    fake_application = models.LoanApplication(
        borrower_id=0,
        product="Simulator",
        amount=payload.amount,
        tenure_months=payload.tenure_months,
        purpose="What-If Simulation",
    )
    result = score_application(fake_borrower, fake_application)
    return schemas.SimulatorResponse(
        probability_default=result.probability_default,
        risk_tier=result.risk_tier,
        confidence=result.confidence,
        recommendation=result.recommendation,
        explanation=result.explanation,
        narrative=result.narrative,
    )


# ── Audit Log Viewer ────────────────────────────────────────────────────────
@app.get("/audit-logs", response_model=list[schemas.AuditLogOut])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[dict]:
    if current_user.role.name not in ["Admin", "Compliance Officer"]:
        raise HTTPException(status_code=403, detail="Only admins and compliance officers can view audit logs")
    logs = (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    # Enrich with actor names
    actor_ids = {log.actor_id for log in logs if log.actor_id is not None}
    actor_map: dict[int, str] = {}
    if actor_ids:
        users = db.query(models.User).filter(models.User.id.in_(actor_ids)).all()
        actor_map = {u.id: u.name for u in users}
    result = []
    for log in logs:
        d = {
            "id": log.id,
            "actor_id": log.actor_id,
            "actor_name": actor_map.get(log.actor_id) if log.actor_id else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "metadata_json": log.metadata_json,
            "created_at": log.created_at,
        }
        result.append(d)
    return result


# ── Fairness Mitigation Toggle ──────────────────────────────────────────────
@app.post("/fairness/mitigation/toggle")
def toggle_fairness_mitigation(
    current_user: models.User = Depends(get_current_user),
) -> dict:
    if current_user.role.name not in ["Admin"]:
        raise HTTPException(status_code=403, detail="Only admins can toggle fairness mitigation")
    scoring.FAIRNESS_MITIGATION_ACTIVE = not scoring.FAIRNESS_MITIGATION_ACTIVE
    return {"mitigation_active": scoring.FAIRNESS_MITIGATION_ACTIVE}


@app.get("/fairness/mitigation/status")
def fairness_mitigation_status(
    current_user: models.User = Depends(get_current_user),
) -> dict:
    return {"mitigation_active": scoring.FAIRNESS_MITIGATION_ACTIVE}


# ── Profile / Password Change ────────────────────────────────────────────────
@app.patch("/me/password")
def change_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> dict:
    current_hash = hashlib.sha256(payload.current_password.encode()).hexdigest()
    if current_user.password_hash != current_hash:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.password_hash = hashlib.sha256(payload.new_password.encode()).hexdigest()
    db.commit()
    log_event(db, current_user.id, "user.password_changed", "user", current_user.id)
    db.commit()
    return {"message": "Password updated successfully"}
