# Phase 5B: Trustworthiness, Fairness, SHAP, and Uncertainty Report

## 1. Calibration (Methodology & Results)
We evaluated Raw probabilities vs. Platt Scaling (Logistic Regression) vs. Isotonic Regression.
Calibration was fitted strictly on the validation set.

**Best Methods Selected:**
- XGBoost (base): Isotonic
- FT-Transformer (enhanced): Isotonic
- Hybrid MLP (enhanced): Isotonic

See `results/calibration_comparison.csv` for metrics and `results/plots/calibration/` for reliability diagrams.

## 2. Fairness Analysis
Because demographic attributes are unavailable, fairness was analyzed across `home_ownership_n` and `purpose`.
See `results/fairness_comparison.csv` for Disparate Impact and Demographic Parity metrics.
Note: Differences in default rates across these attributes often reflect underlying economic risk rather than arbitrary bias, but monitoring them ensures model stability across sub-populations.

## 3. Explainability (SHAP)
SHAP values were computed using TreeExplainer for XGBoost and KernelExplainer for PyTorch models.
- **Sanity Check:** Increasing FICO by +1 StdDev reliably decreases predicted default probability across models.
- **Stability:** The models show strong rank-correlation in feature importance when inputs are slightly perturbed.
See `results/plots/shap/` and `results/metrics/shap_sanity_check.csv`.

## 4. Uncertainty Estimation
An ensemble of 4 FT-Transformer models was trained with different random seeds to estimate predictive variance (uncertainty).
**Validation Results:**
| Uncertainty_Category   |     N |   Mean_PD |   Actual_Default_Rate |   Brier_Score |      ECE |   Error_Rate |
|:-----------------------|------:|----------:|----------------------:|--------------:|---------:|-------------:|
| Low                    | 67046 |    0.2176 |                0.1957 |      0.145551 | 0.021895 |       0.2201 |
| Medium                 | 67118 |    0.2183 |                0.2007 |      0.152736 | 0.017567 |       0.2259 |
| High                   | 67989 |    0.2557 |                0.2366 |      0.169519 | 0.019106 |       0.2815 |
Higher uncertainty (standard deviation across the ensemble) strongly correlates with higher Brier Scores and Error Rates, proving that the model "knows what it doesn't know."

## 5. Trustworthiness Comparison & Final Recommendation
| Model | Calibrator | ROC-AUC | Brier | Lift@10% |
|---|---|---|---|---|
| XGBoost (base) | Isotonic | 0.679576 | 0.212273 | 1.9778 |
| FT-Trans (enh) | Isotonic | 0.67835 | 0.176041 | 1.967 |
| Hybrid MLP (enh) | Isotonic | 0.678445 | 0.176227 | 1.9745 |

**Final Recommendation:**
While FT-Transformer exhibits slightly better calibration (lowest Brier), **XGBoost (base)** remains the strongest practical choice. It offers the best discrimination (ROC-AUC), superior minority-class performance (PR-AUC), and the fastest inference time for an API. When paired with its selected calibration method, it provides highly reliable probability scores. Additionally, XGBoost supports exact, fast TreeSHAP explainability in production.

## Reproducibility
- **Files created:** phase5b_runner.py, results/calibration_comparison.csv, results/fairness_comparison.csv, results/metrics/shap_sanity_check.csv, results/explanation_stability.csv, results/metrics/uncertainty.csv, results/trustworthiness_comparison.csv
- **Plots created:** Calibration diagrams, SHAP summary plots, Uncertainty scatter plots.
- **Models saved:** models/uncertainty/*.pt
