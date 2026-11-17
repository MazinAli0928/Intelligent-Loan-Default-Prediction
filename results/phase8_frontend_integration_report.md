# Phase 8 — Frontend Production Integration Report

## Objective

Integrate the Next.js frontend with the production prediction API (`POST /api/predict`)
serving **XGBoost Base + Isotonic Calibration v1.0**.

---

## Changes Made

### `frontend/lib/types.ts` — Production types added

Three new exported types appended at the end of the file:

| Type | Purpose |
|---|---|
| `ProductionPredictRequest` | 8-field request matching exact API alias names |
| `ProductionSHAPExplanation` | Individual SHAP feature explanation from API |
| `ProductionPredictResponse` | Full API response including PD, decision, tier, SHAP, metadata |

---

### `frontend/lib/api.ts` — `predictLoanRisk()` function added

- Calls `apiFetch<ProductionPredictResponse>("/api/predict", { method: "POST", body: ... })`
- Translates HTTP error codes to Phase 8 error token strings:
  - `422` / `validation` → `"VALIDATION_ERROR"`
  - `500` / `internal server` → `"SERVER_ERROR"`
  - `failed to fetch` / `networkerror` → `"NETWORK_ERROR"`
- Component maps tokens to user-facing messages.

---

### `frontend/app/score/page.tsx` — **Full replacement** (was mock JavaScript formula)

**Old page:** 4-field form using `useMemo` to calculate PD from a JavaScript formula. No API call.

**New page:** Full production form calling `POST /api/predict`.

#### Input Form (8 fields)

| Field | Type | Validation |
|---|---|---|
| Loan Amount (\$) | numeric | 500–40,000 required |
| Annual Income (\$) | numeric | > 0 required |
| Debt-to-Income Ratio (%) | numeric | 0–100 required |
| FICO Credit Score | numeric | 300–850 required |
| Credit History (years) | numeric | ≥ 0 required |
| Employment Length | select | 11 options from LabelEncoder |
| Home Ownership | select | MORTGAGE, RENT, OWN, ANY, NONE |
| Loan Purpose | select | 14 categories |

#### Results Panel (shown after successful prediction)

- **Decision banner** (green ✓ Approved / red ✕ Declined) — from API, never frontend-calculated
- **Calibrated Probability of Default** (primary display, formatted as %)
- **Risk Tier badge** — from API
- **SHAP Explanations** — split into Risk Factors and Protective Factors using `DriverChart`
- **Model Transparency table**: Model, Calibration, Version, Uncertainty, Threshold (hardcoded display values matching the v1.0 artifacts)
- **Technical Details accordion** (collapsed by default): Raw Probability and Calibrated Probability

#### Error Handling

| Scenario | User Message |
|---|---|
| HTTP 422 | "Please check the highlighted input fields." |
| HTTP 500 | "The prediction service is temporarily unavailable. Please try again." |
| Network failure | "Unable to connect to the prediction service." |

#### Loading State

- "Predict Risk" button becomes **disabled** and shows "Analyzing application…" text
- Prevents duplicate submissions

---

## Verification Results

### Backend Regression

```
pytest backend/tests -v
14 passed, 13 warnings in 23.65s
```

All pre-existing contract tests (3) and all Phase 7 API tests (11) pass. ✅

### Frontend Build

```
npm run build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (16/16)
/score   4 kB   109 kB first load
```

Zero TypeScript errors. Zero lint errors. Build exit code 0. ✅

---

## Phase 8 Compliance Checklist

| Requirement | Status |
|---|---|
| 8 exact production fields | ✅ |
| Strict Pydantic-aligned client-side validation | ✅ |
| `calibrated_probability` as primary display | ✅ |
| Decision from API only (never frontend-calculated) | ✅ |
| Risk tier from API only | ✅ |
| SHAP explanations from API only | ✅ |
| Model transparency section | ✅ |
| Raw probability in collapsed Technical Details | ✅ |
| Loading state disables submit button | ✅ |
| 422 → validation error message | ✅ |
| 500 → service unavailable message | ✅ |
| Network failure → connection error message | ✅ |
| Dashboard / navigation / fairness / simulator untouched | ✅ |
| No model retraining or artifact modification | ✅ |
| Frontend build passes with no errors | ✅ |
| Backend regression: 14/14 passed | ✅ |

---

## Architecture Summary

```
User Input (8 fields)
  → Client-side validation (ranges + required)
  → predictLoanRisk() in lib/api.ts
  → POST /api/predict (FastAPI)
  → predict_loan_risk() in ml/production_inference.py
  → XGBoost Base → Isotonic Calibration → TreeSHAP
  → ProductionPredictResponse JSON
  → DecisionBanner + PD % + RiskTierBadge + SHAPSection + TransparencySection
```
