"""
ml/metrics.py
=============
Comprehensive, reusable evaluation-metrics library for credit-risk models.

Every function accepts raw numpy arrays so it can be used from any runner.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    f1_score, precision_score, recall_score,
    accuracy_score, balanced_accuracy_score,
    brier_score_loss, log_loss,
    confusion_matrix, roc_curve, precision_recall_curve,
    matthews_corrcoef, cohen_kappa_score, jaccard_score,
    fbeta_score,
)
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression as _LR
from scipy.stats import ks_2samp
import warnings

# ==============================================================================
#  METRIC DIRECTION METADATA
# ==============================================================================

METRIC_DIRECTION = {
    "Accuracy": "higher_is_better",
    "Precision": "higher_is_better",
    "Recall": "higher_is_better",
    "Specificity": "higher_is_better",
    "F1": "higher_is_better",
    "F2": "higher_is_better",
    "Balanced-Accuracy": "higher_is_better",
    "MCC": "higher_is_better",
    "Jaccard": "higher_is_better",
    "Jaccard-Macro": "higher_is_better",
    "NPV": "higher_is_better",
    "Cohen-Kappa": "higher_is_better",
    "ROC-AUC": "higher_is_better",
    "PR-AUC": "higher_is_better",
    "KS": "higher_is_better",
    "Gini": "higher_is_better",
    "Lift@1%": "higher_is_better",
    "Lift@5%": "higher_is_better",
    "Lift@10%": "higher_is_better",
    "Lift@20%": "higher_is_better",
    "Lift@30%": "higher_is_better",
    "Brier": "lower_is_better",
    "LogLoss": "lower_is_better",
    "ECE": "lower_is_better",
    "MCE": "lower_is_better",
    "Cal-Slope": "ideal_is_1",
    "Cal-Intercept": "ideal_is_0",
}


def get_metric_direction_df():
    rows = []
    for m, d in METRIC_DIRECTION.items():
        rows.append({"Metric": m, "Direction": d})
    return pd.DataFrame(rows)


# ==============================================================================
#  1. CONFUSION MATRIX
# ==============================================================================

def generate_confusion_matrix(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)}


# ==============================================================================
#  2. CLASSIFICATION METRICS (threshold-dependent)
# ==============================================================================

def classification_metrics(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)
    cm = generate_confusion_matrix(y_true, y_prob, threshold)
    tp, tn, fp, fn = cm["TP"], cm["TN"], cm["FP"], cm["FN"]

    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    npv  = tn / (tn + fn) if (tn + fn) > 0 else 0.0

    return {
        "Threshold": round(threshold, 4),
        "TP": tp, "TN": tn, "FP": fp, "FN": fn,
        "Accuracy":          round(accuracy_score(y_true, y_pred), 6),
        "Precision":         round(precision_score(y_true, y_pred, zero_division=0), 6),
        "Recall":            round(recall_score(y_true, y_pred, zero_division=0), 6),
        "Specificity":       round(spec, 6),
        "F1":                round(f1_score(y_true, y_pred, zero_division=0), 6),
        "F2":                round(fbeta_score(y_true, y_pred, beta=2, zero_division=0), 6),
        "Balanced-Accuracy": round(balanced_accuracy_score(y_true, y_pred), 6),
        "NPV":               round(npv, 6),
        "MCC":               round(matthews_corrcoef(y_true, y_pred), 6),
        "Cohen-Kappa":       round(cohen_kappa_score(y_true, y_pred), 6),
        "Jaccard":           round(jaccard_score(y_true, y_pred, zero_division=0), 6),
        "Jaccard-Macro":     round(jaccard_score(y_true, y_pred, average="macro", zero_division=0), 6),
    }


# ==============================================================================
#  3. RANKING / THRESHOLD-INDEPENDENT METRICS
# ==============================================================================

def ranking_metrics(y_true, y_prob):
    roc = roc_auc_score(y_true, y_prob)
    pr  = average_precision_score(y_true, y_prob)
    gini = 2 * roc - 1

    pos_probs = y_prob[y_true == 1]
    neg_probs = y_prob[y_true == 0]
    ks_stat, _ = ks_2samp(neg_probs, pos_probs)

    # KS threshold: the point at which KS is maximized
    fpr, tpr, thresholds_roc = roc_curve(y_true, y_prob)
    ks_values = tpr - fpr
    ks_idx = np.argmax(ks_values)
    ks_threshold = float(thresholds_roc[ks_idx]) if ks_idx < len(thresholds_roc) else np.nan

    return {
        "ROC-AUC":      round(roc, 6),
        "PR-AUC":       round(pr, 6),
        "KS":           round(ks_stat, 6),
        "KS-Threshold": round(ks_threshold, 4),
        "Gini":         round(gini, 6),
    }


# ==============================================================================
#  4. PROBABILITY QUALITY METRICS
# ==============================================================================

def probability_metrics(y_true, y_prob):
    y_prob_clipped = np.clip(y_prob, 1e-7, 1 - 1e-7)
    return {
        "Brier":   round(brier_score_loss(y_true, y_prob), 6),
        "LogLoss": round(log_loss(y_true, y_prob_clipped), 6),
    }


# ==============================================================================
#  5. CALIBRATION METRICS
# ==============================================================================

def calibration_metrics(y_true, y_prob, n_bins=10):
    """
    ECE, MCE, calibration slope and intercept.

    ECE = sum_b (n_b / N) * |avg_pred_b - obs_freq_b|
    MCE = max_b |avg_pred_b - obs_freq_b|

    Calibration slope and intercept are estimated by fitting a logistic
    regression of y_true on logit(y_prob). This is a standard diagnostic
    (not a production calibrator). The test data is used only for evaluation.
    """
    y_prob_clipped = np.clip(y_prob, 1e-7, 1 - 1e-7)

    # Bin-based calibration
    bin_edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    mce = 0.0
    n = len(y_true)
    bin_details = []

    for b in range(n_bins):
        mask = (y_prob_clipped >= bin_edges[b]) & (y_prob_clipped < bin_edges[b + 1])
        if b == n_bins - 1:  # include right edge for last bin
            mask = (y_prob_clipped >= bin_edges[b]) & (y_prob_clipped <= bin_edges[b + 1])

        n_b = mask.sum()
        if n_b == 0:
            bin_details.append({
                "bin_lo": round(bin_edges[b], 2),
                "bin_hi": round(bin_edges[b + 1], 2),
                "n": 0, "avg_pred": np.nan, "obs_freq": np.nan, "gap": np.nan,
            })
            continue
        avg_pred = y_prob_clipped[mask].mean()
        obs_freq = y_true[mask].mean()
        gap = abs(avg_pred - obs_freq)
        ece += (n_b / n) * gap
        mce = max(mce, gap)
        bin_details.append({
            "bin_lo": round(bin_edges[b], 2),
            "bin_hi": round(bin_edges[b + 1], 2),
            "n": int(n_b),
            "avg_pred": round(float(avg_pred), 6),
            "obs_freq": round(float(obs_freq), 6),
            "gap": round(float(gap), 6),
        })

    # Calibration slope & intercept via logistic regression on logit(p)
    logit_p = np.log(y_prob_clipped / (1 - y_prob_clipped)).reshape(-1, 1)
    try:
        cal_lr = _LR(solver="lbfgs", max_iter=1000)
        cal_lr.fit(logit_p, y_true)
        cal_slope = float(cal_lr.coef_[0][0])
        cal_intercept = float(cal_lr.intercept_[0])
    except Exception:
        cal_slope = np.nan
        cal_intercept = np.nan

    return {
        "ECE":            round(ece, 6),
        "MCE":            round(mce, 6),
        "Cal-Slope":      round(cal_slope, 6),
        "Cal-Intercept":  round(cal_intercept, 6),
    }, bin_details


# ==============================================================================
#  6. LIFT ANALYSIS
# ==============================================================================

def lift_metrics(y_true, y_prob, percentages=None):
    """
    Calculate lift at various top-% thresholds.
    Returns a list of dicts, one per percentage.
    """
    if percentages is None:
        percentages = [1, 5, 10, 20, 30]

    n = len(y_true)
    overall_default_rate = y_true.mean()
    sorted_idx = np.argsort(-y_prob)  # descending by predicted prob
    sorted_y = y_true[sorted_idx]

    rows = []
    for pct in percentages:
        k = max(1, int(np.ceil(n * pct / 100)))
        selected_y = sorted_y[:k]
        n_defaults = int(selected_y.sum())
        default_rate_selected = selected_y.mean()
        total_defaults = int(y_true.sum())
        capture_rate = n_defaults / total_defaults if total_defaults > 0 else 0.0
        lift = default_rate_selected / overall_default_rate if overall_default_rate > 0 else 0.0

        rows.append({
            "Top_%": pct,
            "N_Selected": k,
            "Defaults_Captured": n_defaults,
            "Default_Capture_Rate": round(capture_rate, 6),
            "Default_Rate_Selected": round(default_rate_selected, 6),
            "Overall_Default_Rate": round(overall_default_rate, 6),
            "Lift": round(lift, 4),
        })
    return rows


# ==============================================================================
#  7. CUMULATIVE GAINS
# ==============================================================================

def cumulative_gains_data(y_true, y_prob, n_points=200):
    """Returns (pop_pct, cum_default_capture_rate) arrays for plotting."""
    n = len(y_true)
    sorted_idx = np.argsort(-y_prob)
    sorted_y = y_true[sorted_idx]
    total_defaults = y_true.sum()
    if total_defaults == 0:
        return np.linspace(0, 1, n_points), np.zeros(n_points)

    cum_defaults = np.cumsum(sorted_y)
    pop_pcts = np.arange(1, n + 1) / n
    capture_rates = cum_defaults / total_defaults

    # Subsample for plotting efficiency
    idx = np.linspace(0, n - 1, n_points, dtype=int)
    return pop_pcts[idx], capture_rates[idx]


# ==============================================================================
#  8. RISK-BAND ANALYSIS
# ==============================================================================

def risk_band_metrics(y_true, y_prob, bands=None):
    """
    Segment borrowers into risk bands based on predicted PD.
    Default bands: Low [0, 0.15), Moderate [0.15, 0.30), High [0.30, 0.50), Critical [0.50, 1.0]
    """
    if bands is None:
        bands = [
            ("Low",      0.00, 0.15),
            ("Moderate", 0.15, 0.30),
            ("High",     0.30, 0.50),
            ("Critical", 0.50, 1.01),
        ]

    total_defaults = int(y_true.sum())
    n = len(y_true)
    rows = []
    for label, lo, hi in bands:
        mask = (y_prob >= lo) & (y_prob < hi)
        n_band = int(mask.sum())
        if n_band == 0:
            rows.append({
                "Risk_Band": label, "N": 0, "Population_%": 0.0,
                "Avg_PD": np.nan, "Actual_Default_Rate": np.nan,
                "N_Defaults": 0, "Default_Capture_%": 0.0,
            })
            continue
        n_def = int(y_true[mask].sum())
        rows.append({
            "Risk_Band": label,
            "N": n_band,
            "Population_%": round(100 * n_band / n, 2),
            "Avg_PD": round(float(y_prob[mask].mean()), 6),
            "Actual_Default_Rate": round(float(y_true[mask].mean()), 6),
            "N_Defaults": n_def,
            "Default_Capture_%": round(100 * n_def / total_defaults, 2) if total_defaults > 0 else 0.0,
        })
    return rows


# ==============================================================================
#  9. POPULATION STABILITY INDEX (PSI)
# ==============================================================================

def calculate_psi(reference, current, n_bins=10):
    """
    PSI between two distributions (e.g. train PD vs test PD).
    Uses equal-width bins defined on the reference distribution.

    PSI = sum_i (p_i - q_i) * ln(p_i / q_i)

    where p_i = fraction of reference in bin i, q_i = fraction of current in bin i.
    """
    eps = 1e-6
    bin_edges = np.linspace(
        min(reference.min(), current.min()) - eps,
        max(reference.max(), current.max()) + eps,
        n_bins + 1,
    )
    ref_counts, _ = np.histogram(reference, bins=bin_edges)
    cur_counts, _ = np.histogram(current,   bins=bin_edges)

    ref_pct = ref_counts / len(reference)
    cur_pct = cur_counts / len(current)

    # Avoid log(0)
    ref_pct = np.clip(ref_pct, eps, None)
    cur_pct = np.clip(cur_pct, eps, None)

    psi = float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))

    bin_rows = []
    for i in range(n_bins):
        bin_rows.append({
            "bin_lo": round(float(bin_edges[i]), 4),
            "bin_hi": round(float(bin_edges[i + 1]), 4),
            "ref_pct": round(float(ref_counts[i] / len(reference)), 6),
            "cur_pct": round(float(cur_counts[i] / len(current)), 6),
            "psi_i": round(float(
                (cur_pct[i] - ref_pct[i]) * np.log(cur_pct[i] / ref_pct[i])
            ), 6),
        })
    return round(psi, 6), bin_rows


# ==============================================================================
#  10. BOOTSTRAP CONFIDENCE INTERVALS
# ==============================================================================

def bootstrap_confidence_interval(y_true, y_prob, metric_fn, n_bootstrap=1000,
                                   confidence=0.95, seed=42):
    """
    Bootstrap CI for a scalar metric_fn(y_true, y_prob) -> float.
    Returns (point_estimate, ci_lower, ci_upper).
    """
    rng = np.random.RandomState(seed)
    n = len(y_true)
    point = metric_fn(y_true, y_prob)
    samples = []
    for _ in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        try:
            val = metric_fn(y_true[idx], y_prob[idx])
            samples.append(val)
        except Exception:
            continue
    if len(samples) == 0:
        return point, np.nan, np.nan
    alpha = 1 - confidence
    lo = np.percentile(samples, 100 * alpha / 2)
    hi = np.percentile(samples, 100 * (1 - alpha / 2))
    return round(point, 6), round(lo, 6), round(hi, 6)


# ==============================================================================
#  11. STATISTICAL COMPARISON (DeLong approximation for ROC-AUC)
# ==============================================================================

def _auc_variance_delong(y_true, y_prob):
    """Variance of AUC estimate using DeLong's method (simplified)."""
    pos = y_prob[y_true == 1]
    neg = y_prob[y_true == 0]
    m = len(pos)
    n = len(neg)
    if m == 0 or n == 0:
        return np.nan

    # For each positive, fraction of negatives it beats
    v10 = np.array([np.mean(neg < p) + 0.5 * np.mean(neg == p) for p in pos])
    # For each negative, fraction of positives that beat it
    v01 = np.array([np.mean(pos > q) + 0.5 * np.mean(pos == q) for q in neg])

    s10 = np.var(v10, ddof=1) if m > 1 else 0.0
    s01 = np.var(v01, ddof=1) if n > 1 else 0.0

    return s10 / m + s01 / n


def delong_test(y_true, y_prob_a, y_prob_b):
    """
    Paired DeLong test comparing two AUCs on the same test set.
    Returns (z_stat, p_value).
    Returns (NaN, NaN) if the test cannot be computed.
    """
    from scipy.stats import norm

    auc_a = roc_auc_score(y_true, y_prob_a)
    auc_b = roc_auc_score(y_true, y_prob_b)

    var_a = _auc_variance_delong(y_true, y_prob_a)
    var_b = _auc_variance_delong(y_true, y_prob_b)

    if np.isnan(var_a) or np.isnan(var_b):
        return np.nan, np.nan

    # Covariance term (simplified - assumes independence as approximation)
    # A full paired DeLong requires placement values; this is an approximation
    se = np.sqrt(var_a + var_b)
    if se < 1e-10:
        return 0.0, 1.0

    z = (auc_a - auc_b) / se
    p = 2 * norm.sf(abs(z))
    return round(float(z), 4), round(float(p), 6)
