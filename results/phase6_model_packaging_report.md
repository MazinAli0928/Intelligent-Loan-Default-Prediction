# Phase 6: Final Model Packaging & Production Inference Pipeline Report

## 1. Production Model & Configuration
- **Selected Practical Candidate:** XGBoost (Base 8 Features)
- **Feature Set:** Base 8 (`loan_amnt`, `revenue`, `dti_n`, `fico_n`, `experience_c`, `emp_length`, `home_ownership_n`, `purpose`)
- **Calibration Method:** Isotonic Regression (fitted strictly on the Validation set)
- **Decision Threshold:** `0.45` (selected on Validation set to optimize F1 / Balanced Accuracy trade-off)
- **Model Version:** `1.0`
- **Uncertainty Status:** `"not_available"` (XGBoost production pipeline explicitly reports `not_available` as research deep ensembles belong to the FT-Transformer research track).

---

## 2. Artifact Structure (`models/production/xgboost_base/`)
The production candidate is packaged as a complete, self-contained, reproducible artifact directory:

```
models/production/xgboost_base/
├── model.pkl            # Trained XGBoostClassifier instance
├── calibration.pkl      # IsotonicRegression calibrator object
├── preprocessing.pkl    # StandardScaler, LabelEncoders, and column medians
├── feature_schema.json  # Mapping of 8 user inputs -> 8 model features
├── threshold.json       # Decision threshold rule (0.45)
└── metadata.json        # Full versioning, dates, seed (42), metrics, and traceability
```

---

## 3. Production Inference Pipeline (`ml/production_inference.py`)
A canonical, single-entry inference pipeline is provided via `predict_loan_risk(input_data: dict) -> dict`.

### Canonical Execution Order:
1. **Input Validation:** Enforces strict range checks and valid categorical values for user-facing fields (`loan_amount`, `annual_income`, `dti`, `fico_score`, `credit_history_years`, `employment_length`, `home_ownership`, `loan_purpose`). Raises explicit `ValueError` on bad inputs.
2. **Feature Mapping:** Maps user inputs to training columns (`loan_amnt`, `revenue`, etc.).
3. **Preprocessing:** Applies fitted column medians, `StandardScaler`, and `LabelEncoder` transformations.
4. **XGBoost Inference:** Obtains raw probability of default.
5. **Isotonic Calibration:** Transforms raw probability into calibrated PD.
6. **Thresholding:** Applies threshold `0.45` $\rightarrow$ `predicted_class` (`0` or `1`).
7. **Risk Banding:** Maps calibrated PD into 4 decision-support tiers:
   - `[0.00, 0.15)` $\rightarrow$ **Low**
   - `[0.15, 0.30)` $\rightarrow$ **Moderate**
   - `[0.30, 0.45)` $\rightarrow$ **High**
   - `[0.45, 1.00]` $\rightarrow$ **Critical**
8. **TreeSHAP Explainability:** Uses `shap.TreeExplainer` to calculate exact feature attributions and formats human-readable statements (e.g. *"FICO Score (710.0) decreases estimated default risk"*).

---

## 4. Sample Output Schema
```json
{
  "model_name": "XGBoost",
  "model_version": "1.0",
  "calibration_method": "IsotonicRegression",
  "raw_probability": 0.38421,
  "calibrated_probability": 0.31205,
  "threshold": 0.45,
  "predicted_class": 0,
  "prediction_label": "Non-Default",
  "risk_tier": "High",
  "risk_tier_description": "Elevated risk profile; requires manual review or secondary documentation.",
  "uncertainty_status": "not_available",
  "explanations": [
    {
      "feature": "dti",
      "human_feature_name": "Debt-to-Income (DTI)",
      "feature_value": 18.5,
      "shap_value": 0.24512,
      "impact_direction": "positive_risk",
      "impact_magnitude": "high",
      "statement": "Debt-to-Income (DTI) (18.5) increases estimated default risk"
    },
    {
      "feature": "fico_score",
      "human_feature_name": "FICO Score",
      "feature_value": 710.0,
      "shap_value": -0.19842,
      "impact_direction": "protective",
      "impact_magnitude": "high",
      "statement": "FICO Score (710.0) decreases estimated default risk"
    }
  ]
}
```

---

## 5. Automated Tests & Golden Inference Consistency
Unit tests (`ml/test_production_inference.py`) verify:
- **Valid Input Test:** PASS
- **Missing Input Test:** PASS (raises `ValueError`)
- **Out-of-Range Test:** PASS (e.g., FICO > 850 raises `ValueError`)
- **Unknown Category Test:** PASS (raises `ValueError`)
- **Zero Income Edge-Case Test:** PASS
- **Reproducibility Test:** PASS (identical output across calls)
- **Model Artifact Loading Test:** PASS
- **SHAP Explanation Consistency:** PASS
- **Golden Inference Consistency Test:** PASS (verifies that training-time feature transformation and production-time feature transformation produce identical numeric vectors with zero drift: `np.allclose(vec_training, vec_production)`).

Saved golden test case: `results/golden_inference_test.json`.

---

## 6. Known Limitations
1. **Uncertainty Estimation:** XGBoost does not natively provide ensemble standard deviations; `uncertainty_status` is explicitly set to `"not_available"`.
2. **Missing Feature Constraints:** Model requires all 8 base features. If user input omits a feature, inference rejects the payload rather than guessing.
3. **Temporal Scope:** Model trained on Lending Club historical data (Jun-2007 to Apr-2016). Macroeconomic shifts may require periodic re-calibration.

---

## 7. Files Created & Commands

### Files Created:
- `ml/phase6_package_model.py`
- `ml/production_inference.py`
- `ml/test_production_inference.py`
- `models/production/xgboost_base/model.pkl`
- `models/production/xgboost_base/calibration.pkl`
- `models/production/xgboost_base/preprocessing.pkl`
- `models/production/xgboost_base/feature_schema.json`
- `models/production/xgboost_base/threshold.json`
- `models/production/xgboost_base/metadata.json`
- `results/golden_inference_test.json`
- `results/phase6_model_packaging_report.md`

### Commands:
```bash
# Package production model
python ml/phase6_package_model.py

# Run test suite and golden consistency test
python ml/test_production_inference.py
```
