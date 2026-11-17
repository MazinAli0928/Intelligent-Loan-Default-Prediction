# Phase 4 -- Final Model Summary Report

## Selected Model

| Property | Value |
|---|---|
| Model | Hybrid MLP |
| Feature Set | enhanced |
| Threshold (best F1) | 0.35 |
| Threshold (Youden J) | 0.36 |
| Threshold (80% Recall) | 0.33 |
| Threshold (90% Recall) | 0.31 |

## Test Set Performance (full training data, tuned threshold)

| Metric | Value |
|---|---|
| ROC-AUC | 0.6787 |
| PR-AUC | 0.3485 |
| F1 | 0.4172 |
| Precision | 0.2977 |
| Recall | 0.6969 |
| KS Statistic | 0.2579 |
| Brier Score | 0.1768 |
| Balanced Accuracy | 0.6285 |
| Specificity | 0.5600 |

## Did full-data training improve performance?

ROC-AUC delta (full vs 10%): **+0.0045**

See `results/data_size_comparison.csv` for all metrics.

## Calibration Recommended?

Yes. The deep learning models (FT-Transformer, Hybrid MLP) use Focal Loss
which shifts the probability distribution away from true calibration.
Platt scaling or isotonic regression is recommended before using raw
probabilities for business scoring (e.g. expected loss calculation).

## Why This Model Was Selected

Selection used a composite score:
- ROC-AUC (25%) -- overall discriminative ability
- PR-AUC (25%) -- minority-class performance
- F1 at tuned threshold (20%) -- classification quality
- KS statistic (15%) -- population separation
- Brier score inverted (15%) -- probability calibration

ROC-AUC gap vs runner-up: **+0.0004** (marginal -- simpler model competitive)

## Important Notes on Threshold Tuning

Threshold tuning changes classification metrics (F1, Precision, Recall,
Specificity) but does NOT improve ROC-AUC. ROC-AUC measures the model's
ability to rank borrowers by default risk -- this is purely a property of
the predicted probability scores, not the decision threshold.

## Artifacts Saved

- models/final_model/model.pt  -- model weights
- models/preprocessing/           -- scaler, label encoders, medians
- models/thresholds/              -- threshold JSON
- models/metadata.json            -- full training configuration
- results/threshold_comparison.csv
- results/final_model_comparison.csv
- results/data_size_comparison.csv
- results/plots/                  -- threshold, ROC, confusion matrix plots
