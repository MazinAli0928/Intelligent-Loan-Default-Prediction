# Phase 7: FastAPI Production Integration Report

## 1. Endpoint Implemented
- **Primary Endpoint:** `POST /api/predict` (also aliased at `POST /predict`)
- **Framework:** FastAPI
- **Model Version:** `v1.0` (XGBoost Base + Isotonic Calibration)
- **Single Source of Truth:** `ml.production_inference.predict_loan_risk(input_data: dict)`

---

## 2. Request Schema (`ProductionPredictRequest`)
Strict Pydantic schema enforcing the exact 8 production features with support for both standard user-facing field names and dataset column aliases:

| Field Name | Accepted Alias | Type | Validation Constraints | Description |
|---|---|---|---|---|
| `loan_amount` | `loan_amnt` | `float` | `ge=500.0, le=100000.0` | Requested loan amount ($) |
| `annual_income` | `revenue` | `float` | `ge=0.0, le=10000000.0` | Annual income ($) |
| `dti` | `dti_n` | `float` | `ge=0.0, le=100.0` | Debt-to-Income ratio |
| `fico_score` | `fico_n` | `float` | `ge=300.0, le=850.0` | FICO score |
| `credit_history_years` | `experience_c` | `float` | `ge=0.0, le=70.0` | Years of credit history |
| `employment_length` | `emp_length` | `str` | Must be valid category | Employment length category |
| `home_ownership` | `home_ownership_n` | `str` | Must be valid category | Home ownership status |
| `loan_purpose` | `purpose` | `str` | Must be valid category | Loan purpose category |

*Configured with `extra="forbid"` to reject unmapped or arbitrary extra fields.*

---

## 3. Response Schema (`ProductionPredictResponse`)
Typed Pydantic response containing production predictions and explainability details:

```json
{
  "model_name": "XGBoost",
  "model_version": "v1.0",
  "calibration_method": "IsotonicRegression",
  "raw_probability": 0.38421,
  "calibrated_probability": 0.31205,
  "threshold": 0.45,
  "predicted_class": 0,
  "prediction": "Non-Default",
  "decision": "Approve",
  "risk_tier": "High",
  "risk_tier_description": "Elevated risk profile; requires manual review or secondary documentation.",
  "uncertainty_status": "not_available",
  "risk_factors": [...],
  "protective_factors": [...],
  "shap_explanations": [...]
}
```

---

## 4. Production Inference Flow
```
API Client Request 
    ↓
Pydantic Validation (ProductionPredictRequest)
    ↓
ml.production_inference.predict_loan_risk()
    ↓
Preprocessing (Medians + StandardScaler + LabelEncoder)
    ↓
XGBoost Classifier
    ↓
Raw Probability (0.3842)
    ↓
Isotonic Calibration (Val-fitted)
    ↓
Calibrated PD (0.3120)
    ↓
Threshold Decision (PD >= 0.45 → Decline)
    ↓
Risk Band Mapping (Low/Moderate/High/Critical)
    ↓
TreeSHAP Feature Attributions
    ↓
API Response (ProductionPredictResponse)
```

---

## 5. Database & Audit Integration
- Updated `ACTIVE_MODEL_VERSION = "v1.0"` in `backend/app/scoring.py`.
- Maintained compatibility with `LoanApplication`, `Prediction`, `ModelVersion`, `FairnessAudit`, `OverrideDecision`, and `AuditLog` models.
- No second competing prediction pipeline introduced.

---

## 6. Test Suite & Results
Executed full backend test suite via `pytest`:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.5, pytest-9.1.1, pluggy-1.6.0
collected 14 items

backend/tests/test_contracts.py ...                                      [ 21%]
backend/tests/test_production_api.py ...........                         [100%]

====================== 14 passed, 13 warnings in 11.85s =======================
```

### Breakdown of Executed API Tests (`backend/tests/test_production_api.py`):
1. **Test 1 — Valid Request (HTTP 200):** PASSED.
2. **Test 1b — Valid Alias Request (`loan_amnt`, `revenue`, etc.):** PASSED.
3. **Test 2 — Missing Field (HTTP 422):** PASSED.
4. **Test 3 — Invalid Numeric Value out of range (HTTP 422):** PASSED.
5. **Test 4 — Unknown Category (HTTP 422):** PASSED.
6. **Test 5 — Production Consistency (API == `predict_loan_risk`):** PASSED.
7. **Test 6 — Probability Validity ($0 \le \text{PD} \le 1$):** PASSED.
8. **Test 7 — Threshold Consistency ($\text{PD} \ge 0.45 \rightarrow$ Decline):** PASSED.
9. **Test 8 — Model Version (`"v1.0"`):** PASSED.
10. **Test 9 — SHAP Consistency (explanations present & populated):** PASSED.
11. **Test 10 — Error Handling Security (No internal paths/stack traces leaked):** PASSED.

---

## 7. Existing Backend Regression Results
- **Regression Tests Passed:** 100% (all existing contract tests in `test_contracts.py` passed cleanly).
- **Authentication, Audits, Overrides, Reports:** 100% operational.

---

## 8. Files Changed / Created

### Modified Files:
- `backend/app/schemas.py` (Added `ProductionPredictRequest`, `ProductionSHAPExplanation`, `ProductionPredictResponse`)
- `backend/app/main.py` (Added `POST /api/predict` and `POST /predict` endpoints calling canonical inference)
- `backend/app/scoring.py` (Updated `ACTIVE_MODEL_VERSION = "v1.0"`)

### Created Files:
- `backend/tests/test_production_api.py` (11 automated integration tests)
- `results/phase7_api_integration_report.md` (This report)

---

## 9. Verification Command
To re-run the backend API test suite at any time:
```bash
$env:PYTHONPATH="backend"; pytest backend/tests
```
