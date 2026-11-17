# Comprehensive Model Metrics Report

## Executive Summary

| Category | Best Model | Value |
|---|---|---|
| Best ROC-AUC | XGBoost (base) | 0.6796 |
| Best PR-AUC | XGBoost (base) | 0.3491 |
| Best F1 | XGBoost (base) | 0.4183 |
| Best MCC | XGBoost (base) | 0.2116 |
| Best Brier | FT-Transformer (enhanced) | 0.1760 |
| Best ECE | Hybrid MLP (enhanced) | 0.1350 |
| Best Lift@10% | XGBoost (enhanced) | 1.99 |

## Model Comparison (Full Table)

| Model               | Feature Set   |   Threshold |    TP |    TN |    FP |    FN |   Accuracy |   Precision |   Recall |   Specificity |       F1 |       F2 |   Balanced-Accuracy |      MCC |   Jaccard |   Jaccard-Macro |      NPV |   Cohen-Kappa |   ROC-AUC |   PR-AUC |       KS |   KS-Threshold |     Gini |    Brier |   LogLoss |      ECE |      MCE |   Cal-Slope |   Cal-Intercept |   Lift@10% |
|:--------------------|:--------------|------------:|------:|------:|------:|------:|-----------:|------------:|---------:|--------------:|---------:|---------:|--------------------:|---------:|----------:|----------------:|---------:|--------------:|----------:|---------:|---------:|---------------:|---------:|---------:|----------:|---------:|---------:|------------:|----------------:|-----------:|
| FT-Transformer      | base          |        0.35 | 29915 | 88333 | 71137 | 12768 |   0.584943 |    0.296036 | 0.700865 |      0.553916 | 0.416252 | 0.550345 |            0.62739  | 0.207962 |  0.262827 |        0.387841 | 0.87371  |      0.16977  |  0.676751 | 0.344197 | 0.255237 |         0.358  | 0.353502 | 0.176764 |  0.539754 | 0.13702  | 0.186068 |    2.62198  |        0.224031 |     1.9583 |
| FT-Transformer      | enhanced      |        0.35 | 29343 | 90769 | 68701 | 13340 |   0.594164 |    0.299284 | 0.687463 |      0.569192 | 0.41702  | 0.545863 |            0.628328 | 0.209586 |  0.26344  |        0.394347 | 0.871865 |      0.174011 |  0.67835  | 0.346634 | 0.258867 |         0.3529 | 0.356699 | 0.176041 |  0.538049 | 0.135607 | 0.182032 |    2.54583  |        0.192984 |     1.967  |
| Logistic Regression | base          |        0.46 | 29801 | 86314 | 73156 | 12882 |   0.574392 |    0.289451 | 0.698194 |      0.541255 | 0.409242 | 0.544432 |            0.619725 | 0.195481 |  0.257262 |        0.379031 | 0.870136 |      0.157835 |  0.666261 | 0.327684 | 0.241011 |         0.4692 | 0.332522 | 0.220483 |  0.635558 | 0.244855 | 0.633068 |    0.818562 |       -1.23851  |     1.8747 |
| Logistic Regression | enhanced      |        0.45 | 29571 | 87851 | 71619 | 13112 |   0.580857 |    0.292232 | 0.692805 |      0.550894 | 0.411071 | 0.54374  |            0.621849 | 0.198916 |  0.258709 |        0.383874 | 0.870131 |      0.162258 |  0.670966 | 0.334461 | 0.245825 |         0.4606 | 0.341931 | 0.215828 |  0.624891 | 0.237111 | 0.620847 |    0.851937 |       -1.21282  |     1.9344 |
| XGBoost             | base          |        0.45 | 29767 | 89584 | 69886 | 12916 |   0.590399 |    0.298707 | 0.697397 |      0.561761 | 0.418264 | 0.550456 |            0.629579 | 0.211556 |  0.264433 |        0.392052 | 0.87399  |      0.174079 |  0.679576 | 0.349143 | 0.261984 |         0.4586 | 0.359151 | 0.212273 |  0.611319 | 0.232332 | 0.283838 |    1.00999  |       -1.19009  |     1.9778 |
| XGBoost             | enhanced      |        0.45 | 29563 | 90025 | 69445 | 13120 |   0.591572 |    0.298592 | 0.692618 |      0.564526 | 0.417288 | 0.547991 |            0.628572 | 0.209935 |  0.263654 |        0.392633 | 0.8728   |      0.17337  |  0.679002 | 0.34857  | 0.259422 |         0.4569 | 0.358005 | 0.211593 |  0.609744 | 0.230694 | 0.282853 |    1.00812  |       -1.18274  |     1.9857 |
| Hybrid MLP          | base          |        0.35 | 29440 | 90586 | 68884 | 13243 |   0.593738 |    0.299418 | 0.689736 |      0.568044 | 0.417568 | 0.547098 |            0.62889  | 0.210488 |  0.263877 |        0.394183 | 0.872454 |      0.17449  |  0.678029 | 0.344241 | 0.258671 |         0.3542 | 0.356059 | 0.176404 |  0.53906  | 0.135379 | 0.248026 |    2.7093   |        0.296761 |     1.9478 |
| Hybrid MLP          | enhanced      |        0.35 | 29277 | 91027 | 68443 | 13406 |   0.595114 |    0.299601 | 0.685917 |      0.57081  | 0.417042 | 0.545293 |            0.628363 | 0.209666 |  0.263458 |        0.395001 | 0.871631 |      0.174388 |  0.678445 | 0.348245 | 0.256961 |         0.3523 | 0.356889 | 0.176227 |  0.538723 | 0.135022 | 0.185178 |    2.69982  |        0.295799 |     1.9745 |

## A. Threshold-Independent Metrics (Ranking Quality)

These metrics use predicted probabilities and do NOT depend on the classification threshold:

- **ROC-AUC**: Overall discriminative ability. Higher is better.
- **PR-AUC**: Performance on the minority default class (~20%). Higher is better.
- **KS Statistic**: Maximum separation between defaulter and non-defaulter distributions.
- **Gini**: 2 * ROC-AUC - 1. Commonly used in credit scoring.
- **Brier Score**: Mean squared error of probability predictions. Lower is better.
- **Log Loss**: Logarithmic scoring of probability predictions. Lower is better.

## B. Threshold-Dependent Metrics (Classification Quality)

These use the validation-selected threshold and would change if the threshold changed:

- Accuracy, Precision, Recall, Specificity, F1, F2
- Balanced Accuracy, NPV, MCC, Cohen's Kappa, Jaccard

Threshold tuning does NOT improve ROC-AUC. It changes the operating point on the ROC curve.

## Probability Quality (Calibration)

- **ECE**: Expected Calibration Error. Weighted average bin calibration gap.
- **MCE**: Maximum Calibration Error. Worst single bin calibration gap.
- **Calibration Slope**: Ideal = 1. Measures discrimination preservation.
- **Calibration Intercept**: Ideal = 0. Measures systematic bias.

Calibration (Platt scaling / isotonic regression) is recommended for models
using Focal Loss (FT-Transformer, Hybrid MLP) before deploying raw probabilities.

## Credit-Risk Analysis

### Lift
Models concentrate defaults effectively in the top risk decile.
See `results/metrics/lift_analysis.csv` for full details.

### Risk Bands
See `results/metrics/risk_band_analysis.csv` for population distribution
and actual default rates across Low/Moderate/High/Critical bands.

### PSI
Population Stability Index comparing training vs test PD distributions.
See `results/metrics/psi_analysis.csv`.

## Statistical Significance

DeLong tests comparing model AUCs are in `results/metrics/statistical_comparison.csv`.
Only differences with p < 0.05 should be considered statistically significant.

## Model Trade-offs

The best model is NOT automatically the one with the highest ROC-AUC.
Consider:

- **Strongest discriminator**: Best ROC-AUC / KS
- **Best probability quality**: Best Brier / ECE
- **Best classification**: Best F1 / MCC
- **Simplest competitive model**: If Logistic Regression is within 1% ROC-AUC
  of a deep learning model, it may be preferred for interpretability and speed.

## Confidence Intervals

95% bootstrap CIs are in `results/metrics/metric_confidence_intervals.csv`.
These were calculated using 1000 bootstrap resamples with seed=42.
They should NOT be used for model selection or threshold tuning.

## Research Integrity Notes

- All metrics calculated from actual predictions and labels
- Test set never used for threshold selection
- Preprocessing fitted on training data only
- No fabricated or approximated metrics
- Calibration slope/intercept estimated diagnostically, not fitted on test data
