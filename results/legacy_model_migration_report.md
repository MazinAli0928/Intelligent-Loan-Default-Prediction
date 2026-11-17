# Phase 8.5 — Complete Legacy Model Purge & System Migration Report

## 1. Executive Summary

The entire repository has been migrated to center strictly around the canonical production model:
**XGBoost Base + Isotonic Calibration v1.0** trained on historical Lending Club loan granting data.

All legacy model code (PyTorch Hybrid MLP, Focal Loss, embedding modules, synthetic score fallback formulas), legacy dataset checkpoints/pickles, and obsolete feature references have been audited, decoupled, and purged from operational backend, frontend, API, and database seeding paths.

---

## 2. Legacy Inventory & Actions Taken

| Legacy Item | Location | Purpose | Still Required? | Action | Replacement |
| --- | --- | --- | --- | --- | --- |
| `HybridMLPScorer` / `DeepPyTorchCreditMLP` | `ml/pytorch_mlp_trainer.py` | Old PyTorch MLP model architecture & trainer | ❌ No | **DELETED** | `predict_loan_risk()` in `ml/production_inference.py` |
| `hybrid_mlp.pt` | `ml/saved_models/hybrid_mlp.pt` | Old PyTorch weights | ❌ No | **DELETED** | `models/production/xgboost_base/model.pkl` |
| `ft_transformer_*.pt` | `ml/saved_models/`, `models/uncertainty/` | Experimental DL checkpoints | ❌ No (production) | **DELETED** | XGBoost v1.0 canonical production artifacts |
| Formula Fallback | `backend/app/scoring.py` | Hardcoded JS/Python fallback formula | ❌ No | **REPLACED** | Direct call to `predict_loan_risk()` |
| Synthetic Seed Models | `backend/app/seed_data.py` | Seed DB with `hybrid-mlp-v2.0` | ❌ No | **MIGRATED** | Seeded with `v1.0` (XGBoost Base + Isotonic) |
| Obsolete Feature Labels | Frontend & DB mock data | 10-feature synthetic schema | ❌ No | **MIGRATED** | 8 canonical Lending Club user features |
| Research Comparative Metrics | `results/*.csv`, `phase5b_results/` | Experimental comparisons (Phases 3–5B) | ✅ Yes (Research paper) | **PRESERVED** | Preserved isolated in research results directories |

---

## 3. Production Architecture (Single Source of Truth)

```text
                    ┌──────────────────────┐
                    │     Next.js UI       │
                    │      8 inputs        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    FastAPI /api      │
                    │     /predict         │
                    └──────────┬───────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │  predict_loan_risk()           │
              │  Canonical Production Inference│
              └───────────────┬────────────────┘
                              │
                              ▼
                   ┌────────────────────┐
                   │ Production         │
                   │ Preprocessing      │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │ XGBoost Base       │
                   │ v1.0               │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │ Isotonic           │
                   │ Calibration        │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │ Calibrated PD      │
                   └─────────┬──────────┘
                             │
                 ┌───────────┴────────────┐
                 ▼                        ▼
          Threshold 0.45             TreeSHAP
                 │                        │
                 ▼                        ▼
           Decision/Risk             Explanation
                 │
                 └────────────┬───────────┘
                              ▼
                         API Response
```

---

## 4. Feature Schema Mapping

Canonical 8 User-Facing Inputs:

1. `loan_amnt` (`loan_amount`)
2. `revenue` (`annual_income`)
3. `dti_n` (`dti`)
4. `fico_n` (`fico_score`)
5. `experience_c` (`credit_history_years`)
6. `emp_length` (`employment_length`)
7. `home_ownership_n` (`home_ownership`)
8. `purpose` (`loan_purpose`)

---

## 5. Verification Results

### Backend Test Suite (Pytest)

```powershell
$env:PYTHONPATH="backend"; pytest backend/tests -v
====================== 14 passed, 13 warnings in 13.07s =======================
```
- All contract tests: **PASS**
- All production API tests: **PASS**

### Production Inference & Golden Consistency Test

```powershell
python ml/test_production_inference.py
Ran 8 tests in 70.437s
OK
[OK] Golden Inference Consistency Test Passed. Saved to results/golden_inference_test.json
```
- Model loading, preprocessing alignment, TreeSHAP consistency, range validations, reproducibility: **PASS**

### Next.js Frontend Production Build

```powershell
npm run build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (16/16)
```
- Zero TypeScript errors, zero lint errors, clean exit 0. **PASS**

### Legacy Reference Search Audit

- Operational references to `HybridMLP`, `BinaryFocalLoss`, `pytorch_mlp_trainer`: **NONE**
- Active synthetic formula fallbacks: **NONE**
- Active prediction pipelines using PyTorch: **NONE**
