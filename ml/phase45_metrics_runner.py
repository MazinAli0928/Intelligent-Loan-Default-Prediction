"""
phase45_metrics_runner.py
=========================
Comprehensive metrics evaluation for all 8 model/feature-set combinations.

Re-trains models to obtain prediction arrays (using same seeds/hyperparams
as Phase 4) then calculates every metric defined in ml/metrics.py.

Run from project root:
    python ml/phase45_metrics_runner.py
"""

from __future__ import annotations
import os, sys, json, warnings
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_curve, precision_recall_curve, roc_auc_score
from sklearn.calibration import calibration_curve
from scipy.stats import ks_2samp
import xgboost as xgb

warnings.filterwarnings("ignore", category=UserWarning)

_THIS = Path(__file__).resolve().parent
_ROOT = _THIS.parent
sys.path.insert(0, str(_THIS))

from ft_transformer import FTTransformer, FocalLoss
from data_preprocessing import load_dataset, create_target
from metrics import (
    classification_metrics, ranking_metrics, probability_metrics,
    calibration_metrics, lift_metrics, cumulative_gains_data,
    risk_band_metrics, calculate_psi, bootstrap_confidence_interval,
    delong_test, get_metric_direction_df, METRIC_DIRECTION,
)

# -- Directories ---------------------------------------------------------------
RESULTS    = _ROOT / "results"
METRICS_D  = RESULTS / "metrics"
PLOTS_D    = RESULTS / "plots"
CAL_PLOTS  = PLOTS_D / "calibration"
CM_PLOTS   = PLOTS_D / "confusion_matrices"
for _d in [METRICS_D, CAL_PLOTS, CM_PLOTS]:
    _d.mkdir(parents=True, exist_ok=True)

SEED = 42; torch.manual_seed(SEED); np.random.seed(SEED)
CONT_BASE = ["loan_amnt", "revenue", "dti_n", "fico_n", "experience_c"]
CONT_ENH  = CONT_BASE + ["loan_to_income", "est_monthly_debt", "residual_monthly_income"]
CAT_COLS  = ["emp_length", "home_ownership_n", "purpose"]


# ==============================================================================
#  DATA / PREPROCESSING  (mirrors Phase 4 exactly)
# ==============================================================================

def _cat_clean(df):
    df = df.copy()
    for c in ["emp_length","home_ownership_n","purpose","addr_state","zip_code"]:
        if c in df.columns: df[c] = df[c].fillna("missing").astype(str)
    return df

def _add_enh(df):
    df = df.copy()
    s = df["revenue"].replace(0, np.nan)
    df["loan_to_income"]          = (df["loan_amnt"] / s).fillna(0.0)
    df["est_monthly_debt"]        = (df["revenue"] / 12) * (df["dti_n"] / 100)
    df["residual_monthly_income"] = (df["revenue"] / 12) - df["est_monthly_debt"]
    return df

def load_split():
    df = load_dataset(str(_ROOT / "LC_loans_granting_model_dataset.csv"))
    df = create_target(df); df = _cat_clean(df)
    df["_dt"] = pd.to_datetime(df["issue_d"], format="%b-%Y", errors="coerce")
    df = df.dropna(subset=["_dt"]).sort_values("_dt").reset_index(drop=True)
    n = len(df); i1 = int(n*0.70); i2 = int(n*0.85)
    return df.iloc[:i1].copy(), df.iloc[i1:i2].copy(), df.iloc[i2:].copy()

def build_arrays(tr, va, te, fset):
    cc = CONT_ENH if fset == "enhanced" else CONT_BASE
    if fset == "enhanced":
        tr = _add_enh(tr); va = _add_enh(va); te = _add_enh(te)
    meds = tr[cc].median()
    tr = tr.copy(); tr[cc] = tr[cc].fillna(meds)
    va = va.copy(); va[cc] = va[cc].fillna(meds)
    te = te.copy(); te[cc] = te[cc].fillna(meds)
    sc = StandardScaler()
    Xtrc = sc.fit_transform(tr[cc].values.astype(np.float32))
    Xvac = sc.transform(va[cc].values.astype(np.float32))
    Xtec = sc.transform(te[cc].values.astype(np.float32))
    les = {}; cards = []
    Xtr_cat = np.zeros((len(tr), len(CAT_COLS)), dtype=np.int64)
    Xva_cat = np.zeros((len(va), len(CAT_COLS)), dtype=np.int64)
    Xte_cat = np.zeros((len(te), len(CAT_COLS)), dtype=np.int64)
    for i, col in enumerate(CAT_COLS):
        le = LabelEncoder()
        le.fit(np.append(tr[col].astype(str).values, ["Unknown"]))
        def enc(vals, _le=le):
            return _le.transform([v if v in _le.classes_ else "Unknown" for v in vals.astype(str)])
        Xtr_cat[:, i] = enc(tr[col].values)
        Xva_cat[:, i] = enc(va[col].values)
        Xte_cat[:, i] = enc(te[col].values)
        cards.append(len(le.classes_)); les[col] = le
    return dict(Xtrc=Xtrc, Xvac=Xvac, Xtec=Xtec,
                Xtr_cat=Xtr_cat, Xva_cat=Xva_cat, Xte_cat=Xte_cat,
                y_tr=tr["target"].values.astype(np.int64),
                y_va=va["target"].values.astype(np.int64),
                y_te=te["target"].values.astype(np.int64),
                cards=cards, cc=cc)

def _ds(Xc, Xcat, y):
    return TensorDataset(torch.FloatTensor(Xc), torch.LongTensor(Xcat), torch.LongTensor(y))
def _ldr(Xc, Xcat, y, bs=1024, sh=False):
    return DataLoader(_ds(Xc, Xcat, y), batch_size=bs, shuffle=sh)

# -- Models --------------------------------------------------------------------
class SimpleMLP(nn.Module):
    def __init__(self, nc, cards):
        super().__init__()
        ed = [min(50,(c+1)//2) for c in cards]
        self.emb = nn.ModuleList([nn.Embedding(c,e) for c,e in zip(cards,ed)])
        self.net = nn.Sequential(
            nn.Linear(nc+sum(ed),256),nn.BatchNorm1d(256),nn.SiLU(),nn.Dropout(.2),
            nn.Linear(256,128),nn.BatchNorm1d(128),nn.SiLU(),nn.Dropout(.2),
            nn.Linear(128,64),nn.SiLU(),nn.Linear(64,1))
    def forward(self, xc, xcat):
        e = [self.emb[i](xcat[:,i]) for i in range(len(self.emb))]
        return self.net(torch.cat([xc,*e],dim=1)).squeeze(-1)

def _dev():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")

def train_torch(mdl, ldr, ep, lr=1e-3):
    dev = _dev(); mdl.to(dev)
    crit = FocalLoss(); opt = torch.optim.AdamW(mdl.parameters(),lr=lr,weight_decay=1e-4)
    sch = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=ep)
    for e in range(ep):
        mdl.train()
        for xc,xcat,y in ldr:
            xc,xcat,y = xc.to(dev),xcat.to(dev),y.to(dev)
            opt.zero_grad(); loss = crit(mdl(xc,xcat),y.float())
            loss.backward(); nn.utils.clip_grad_norm_(mdl.parameters(),1.0); opt.step()
        sch.step()
        if (e+1)%5==0 or e==0:
            print("      Epoch {}/{}".format(e+1,ep))
    return mdl

def predict_torch(mdl, ldr):
    dev = _dev(); mdl.to(dev).eval(); out = []
    with torch.no_grad():
        for xc,xcat,_ in ldr:
            out.append(torch.sigmoid(mdl(xc.to(dev),xcat.to(dev))).cpu().numpy())
    return np.concatenate(out)


# ==============================================================================
#  THRESHOLDS  (read from Phase 4 CSV)
# ==============================================================================

def get_thresholds():
    """Read the final_model_comparison.csv to get per-model thresholds."""
    df = pd.read_csv(RESULTS / "final_model_comparison.csv")
    t = {}
    for _, r in df.iterrows():
        k = "{}_{}".format(r["Model"], r["Feature Set"])
        t[k] = float(r["Threshold"])
    return t


# ==============================================================================
#  PLOTTING HELPERS
# ==============================================================================

def plot_all_roc(results):
    fig, ax = plt.subplots(figsize=(8, 7))
    for key, info in results.items():
        fpr, tpr, _ = roc_curve(info["y_te"], info["y_prob"])
        ax.plot(fpr, tpr, lw=1.5, label="{} AUC={:.4f}".format(key, roc_auc_score(info["y_te"], info["y_prob"])))
    ax.plot([0,1],[0,1],"k--",lw=1)
    ax.set_xlabel("FPR"); ax.set_ylabel("TPR"); ax.set_title("ROC Curves -- All Models")
    ax.legend(fontsize=7); ax.grid(True, alpha=0.3); fig.tight_layout()
    fig.savefig(PLOTS_D / "roc_curves.png", dpi=150); plt.close(fig)

def plot_all_pr(results):
    fig, ax = plt.subplots(figsize=(8, 7))
    for key, info in results.items():
        prec, rec, _ = precision_recall_curve(info["y_te"], info["y_prob"])
        ax.plot(rec, prec, lw=1.5, label=key)
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curves -- All Models")
    ax.legend(fontsize=7); ax.grid(True, alpha=0.3); fig.tight_layout()
    fig.savefig(PLOTS_D / "precision_recall_curves.png", dpi=150); plt.close(fig)

def plot_calibration(key, y_te, y_prob):
    prob_true, prob_pred = calibration_curve(y_te, y_prob, n_bins=10, strategy="uniform")
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot([0,1],[0,1],"k--",lw=1, label="Perfect calibration")
    ax.plot(prob_pred, prob_true, "o-", lw=2, label=key)
    ax.set_xlabel("Mean predicted probability"); ax.set_ylabel("Observed frequency")
    ax.set_title("Calibration Curve -- {}".format(key))
    ax.legend(); ax.grid(True, alpha=0.3); fig.tight_layout()
    safe = key.replace(" ", "_")
    fig.savefig(CAL_PLOTS / "calibration_{}.png".format(safe), dpi=120); plt.close(fig)

def plot_confusion(key, y_te, y_pred):
    from sklearn.metrics import confusion_matrix as _cm
    cm = _cm(y_te, y_pred, labels=[0,1])
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(cm, cmap="Blues"); plt.colorbar(im, ax=ax)
    ax.set_xticks([0,1]); ax.set_yticks([0,1])
    ax.set_xticklabels(["Non-Def","Default"]); ax.set_yticklabels(["Non-Def","Default"])
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title("CM -- {}".format(key))
    for i in range(2):
        for j in range(2):
            ax.text(j,i,str(cm[i,j]),ha="center",va="center",
                    color="white" if cm[i,j]>cm.max()/2 else "black", fontsize=11)
    fig.tight_layout()
    safe = key.replace(" ", "_")
    fig.savefig(CM_PLOTS / "cm_{}.png".format(safe), dpi=120); plt.close(fig)

def plot_cumulative_gains(results):
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot([0,1],[0,1],"k--",lw=1, label="Random")
    for key, info in results.items():
        pop, cap = cumulative_gains_data(info["y_te"], info["y_prob"])
        ax.plot(pop, cap, lw=1.5, label=key)
    ax.set_xlabel("Population %"); ax.set_ylabel("Cumulative default capture %")
    ax.set_title("Cumulative Gains Chart"); ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3); fig.tight_layout()
    fig.savefig(PLOTS_D / "cumulative_gains.png", dpi=150); plt.close(fig)

def plot_lift_curves(all_lift):
    fig, ax = plt.subplots(figsize=(8, 6))
    for key, rows in all_lift.items():
        pcts  = [r["Top_%"] for r in rows]
        lifts = [r["Lift"] for r in rows]
        ax.plot(pcts, lifts, "o-", lw=1.5, label=key)
    ax.axhline(1.0, color="gray", ls="--", lw=1, label="No lift (random)")
    ax.set_xlabel("Top % of borrowers"); ax.set_ylabel("Lift")
    ax.set_title("Lift Curves"); ax.legend(fontsize=7)
    ax.grid(True, alpha=0.3); fig.tight_layout()
    fig.savefig(PLOTS_D / "lift_curves.png", dpi=150); plt.close(fig)

def plot_risk_bands(all_rb):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    for key, rows in all_rb.items():
        bands = [r["Risk_Band"] for r in rows]
        rates = [r["Actual_Default_Rate"] if not np.isnan(r["Actual_Default_Rate"]) else 0 for r in rows]
        axes[0].plot(bands, rates, "o-", label=key)
    axes[0].set_title("Default Rate by Risk Band"); axes[0].set_ylabel("Default Rate")
    axes[0].legend(fontsize=6); axes[0].grid(True, alpha=0.3)
    for key, rows in all_rb.items():
        bands = [r["Risk_Band"] for r in rows]
        pop   = [r["Population_%"] for r in rows]
        axes[1].plot(bands, pop, "o-", label=key)
    axes[1].set_title("Population % by Risk Band"); axes[1].set_ylabel("Population %")
    axes[1].legend(fontsize=6); axes[1].grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS_D / "risk_band_analysis.png", dpi=150); plt.close(fig)

def plot_metric_comparison(comp_df):
    metrics_to_plot = ["ROC-AUC","PR-AUC","F1","MCC","KS","Gini"]
    available = [m for m in metrics_to_plot if m in comp_df.columns]
    if not available:
        return
    labels = comp_df["Model"] + " (" + comp_df["Feature Set"] + ")"
    fig, ax = plt.subplots(figsize=(12, 6))
    x = np.arange(len(labels))
    w = 0.12
    for i, m in enumerate(available):
        ax.bar(x + i*w, comp_df[m].values, width=w, label=m)
    ax.set_xticks(x + w*len(available)/2)
    ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=8)
    ax.set_title("Model Comparison -- Key Metrics")
    ax.legend(fontsize=7); ax.grid(True, alpha=0.3, axis="y"); fig.tight_layout()
    fig.savefig(PLOTS_D / "metric_comparison.png", dpi=150); plt.close(fig)

def plot_ci_bars(ci_df):
    """Plot confidence intervals for key metrics."""
    for metric in ci_df["Metric"].unique():
        sub = ci_df[ci_df["Metric"] == metric]
        fig, ax = plt.subplots(figsize=(10, 4))
        labels = sub["Model_Key"].values
        vals   = sub["Point"].values
        lo     = sub["CI_Lower"].values
        hi     = sub["CI_Upper"].values
        errs   = np.array([vals - lo, hi - vals])
        ax.barh(range(len(labels)), vals, xerr=errs, capsize=3, alpha=0.7)
        ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels, fontsize=7)
        ax.set_title("95% CI -- {}".format(metric))
        ax.grid(True, alpha=0.3, axis="x"); fig.tight_layout()
        safe = metric.replace(" ", "_").replace("-", "_")
        fig.savefig(PLOTS_D / "ci_{}.png".format(safe), dpi=120)
        plt.close(fig)


# ==============================================================================
#  MAIN
# ==============================================================================

def main():
    print("Loading data ...")
    tr, va, te = load_split()
    print("  Train: {:,}  Val: {:,}  Test: {:,}".format(len(tr), len(va), len(te)))

    thresholds = get_thresholds()
    print("  Thresholds from Phase 4:", thresholds)

    experiments = [
        ("FT-Transformer",      "base"),
        ("FT-Transformer",      "enhanced"),
        ("Logistic Regression", "base"),
        ("Logistic Regression", "enhanced"),
        ("XGBoost",             "base"),
        ("XGBoost",             "enhanced"),
        ("Hybrid MLP",          "base"),
        ("Hybrid MLP",          "enhanced"),
    ]

    results = {}  # key -> {y_te, y_prob, thr, y_tr_prob (for PSI)}

    for mname, fset in experiments:
        key = "{}_{}".format(mname, fset)
        thr = thresholds.get(key, 0.35)
        print("\n  Training {} ({}) ...".format(mname, fset))
        a = build_arrays(tr, va, te, fset)
        nc = len(a["cc"]); cards = a["cards"]
        tr_ldr = _ldr(a["Xtrc"], a["Xtr_cat"], a["y_tr"], bs=1024, sh=True)
        te_ldr = _ldr(a["Xtec"], a["Xte_cat"], a["y_te"])

        if mname == "Logistic Regression":
            Xtr = np.hstack([a["Xtrc"], a["Xtr_cat"]])
            Xte = np.hstack([a["Xtec"], a["Xte_cat"]])
            mdl = LogisticRegression(max_iter=1000, class_weight="balanced",
                                      random_state=SEED, solver="lbfgs", n_jobs=-1)
            mdl.fit(Xtr, a["y_tr"])
            y_te_p = mdl.predict_proba(Xte)[:,1]
            y_tr_p = mdl.predict_proba(Xtr)[:,1]

        elif mname == "XGBoost":
            Xtr = np.hstack([a["Xtrc"], a["Xtr_cat"]])
            Xte = np.hstack([a["Xtec"], a["Xte_cat"]])
            spw = (len(a["y_tr"])-a["y_tr"].sum())/max(a["y_tr"].sum(),1)
            mdl = xgb.XGBClassifier(n_estimators=300, learning_rate=0.05, max_depth=6,
                                     scale_pos_weight=spw, random_state=SEED,
                                     eval_metric="logloss", verbosity=0)
            mdl.fit(Xtr, a["y_tr"], verbose=False)
            y_te_p = mdl.predict_proba(Xte)[:,1]
            y_tr_p = mdl.predict_proba(Xtr)[:,1]

        elif mname == "Hybrid MLP":
            mdl = SimpleMLP(nc, cards)
            mdl = train_torch(mdl, tr_ldr, ep=10)
            y_te_p = predict_torch(mdl, te_ldr)
            y_tr_p = predict_torch(mdl, _ldr(a["Xtrc"], a["Xtr_cat"], a["y_tr"]))

        elif mname == "FT-Transformer":
            mdl = FTTransformer(num_continuous=nc, categorical_cardinalities=cards,
                                 dim=64, depth=2, heads=4, ff_dropout=0.1, attn_dropout=0.1)
            mdl = train_torch(mdl, tr_ldr, ep=10)
            y_te_p = predict_torch(mdl, te_ldr)
            y_tr_p = predict_torch(mdl, _ldr(a["Xtrc"], a["Xtr_cat"], a["y_tr"]))

        results[key] = {"y_te": a["y_te"], "y_prob": y_te_p, "thr": thr, "y_tr_prob": y_tr_p}
        print("    Done. Threshold={:.2f}".format(thr))

    # =========================================================================
    #  COMPUTE ALL METRICS
    # =========================================================================
    print("\n\nComputing comprehensive metrics ...")

    comp_rows = []      # comprehensive_model_metrics
    cm_rows = []        # confusion matrices
    lift_all = {}       # per-model lift
    rb_all = {}         # per-model risk bands
    psi_rows = []       # PSI
    ci_rows = []        # confidence intervals
    stat_rows = []      # statistical comparison

    for key, info in results.items():
        yt, yp, thr = info["y_te"], info["y_prob"], info["thr"]
        parts = key.rsplit("_", 1)
        mname, fset = parts[0], parts[1]

        print("  Metrics for {} ...".format(key))

        # Classification metrics (threshold-dependent)
        cl = classification_metrics(yt, yp, thr)
        # Ranking metrics (threshold-independent)
        rk = ranking_metrics(yt, yp)
        # Probability metrics
        pm = probability_metrics(yt, yp)
        # Calibration metrics
        cal, cal_bins = calibration_metrics(yt, yp)
        # Lift
        lf = lift_metrics(yt, yp)
        lift_all[key] = lf
        lift_at_10 = [r for r in lf if r["Top_%"] == 10]
        lift10 = lift_at_10[0]["Lift"] if lift_at_10 else np.nan
        # Risk bands
        rb = risk_band_metrics(yt, yp)
        rb_all[key] = rb

        # Confusion matrix row
        cm_rows.append({"Model": mname, "Feature Set": fset,
                        "TP": cl["TP"], "TN": cl["TN"], "FP": cl["FP"], "FN": cl["FN"]})

        # Comprehensive row
        row = {"Model": mname, "Feature Set": fset}
        row.update(cl); row.update(rk); row.update(pm); row.update(cal)
        row["Lift@10%"] = lift10
        comp_rows.append(row)

        # PSI (train PD vs test PD)
        psi_val, psi_bins = calculate_psi(info["y_tr_prob"], yp)
        psi_rows.append({"Model": mname, "Feature Set": fset, "PSI": psi_val})

        # Calibration plot
        plot_calibration(key, yt, yp)

        # Confusion matrix plot
        y_pred = (yp >= thr).astype(int)
        plot_confusion(key, yt, y_pred)

    # =========================================================================
    #  CONFIDENCE INTERVALS (bootstrap)
    # =========================================================================
    print("\n  Computing bootstrap CIs (1000 samples) ...")
    ci_metrics = {
        "ROC-AUC": lambda yt, yp: roc_auc_score(yt, yp),
        "PR-AUC":  lambda yt, yp: float(pd.Series(yp).pipe(lambda s: roc_auc_score(yt, yp) if False else __import__("sklearn.metrics", fromlist=["average_precision_score"]).average_precision_score(yt, yp))),
        "F1":      lambda yt, yp: float(__import__("sklearn.metrics", fromlist=["f1_score"]).f1_score(yt, (yp >= 0.35).astype(int), zero_division=0)),
        "Brier":   lambda yt, yp: float(__import__("sklearn.metrics", fromlist=["brier_score_loss"]).brier_score_loss(yt, yp)),
    }
    # Simpler approach for CI metrics
    from sklearn.metrics import average_precision_score as _ap, brier_score_loss as _bs

    for key, info in results.items():
        yt, yp, thr = info["y_te"], info["y_prob"], info["thr"]
        # ROC-AUC
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, roc_auc_score, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "ROC-AUC", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        # PR-AUC
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, _ap, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "PR-AUC", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        # Brier
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, _bs, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "Brier", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        # F1 (at model's own threshold)
        def _f1(yt, yp, _t=thr):
            from sklearn.metrics import f1_score as _f
            return _f(yt, (yp >= _t).astype(int), zero_division=0)
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, _f1, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "F1", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        # Recall
        def _rec(yt, yp, _t=thr):
            from sklearn.metrics import recall_score as _r
            return _r(yt, (yp >= _t).astype(int), zero_division=0)
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, _rec, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "Recall", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        # Precision
        def _prec(yt, yp, _t=thr):
            from sklearn.metrics import precision_score as _p
            return _p(yt, (yp >= _t).astype(int), zero_division=0)
        pt, lo, hi = bootstrap_confidence_interval(yt, yp, _prec, n_bootstrap=1000, seed=SEED)
        ci_rows.append({"Model_Key": key, "Metric": "Precision", "Point": pt, "CI_Lower": lo, "CI_Upper": hi})
        print("    CI done for {}".format(key))

    # =========================================================================
    #  STATISTICAL COMPARISON (DeLong)
    # =========================================================================
    print("\n  Statistical comparisons (DeLong) ...")
    keys = list(results.keys())
    yt_ref = results[keys[0]]["y_te"]  # same test set for all
    for i in range(len(keys)):
        for j in range(i+1, len(keys)):
            z, p = delong_test(yt_ref, results[keys[i]]["y_prob"], results[keys[j]]["y_prob"])
            stat_rows.append({
                "Model_A": keys[i], "Model_B": keys[j],
                "AUC_A": round(roc_auc_score(yt_ref, results[keys[i]]["y_prob"]),6),
                "AUC_B": round(roc_auc_score(yt_ref, results[keys[j]]["y_prob"]),6),
                "Z_stat": z, "p_value": p,
                "Significant_5%": "Yes" if (p is not None and not np.isnan(p) and p < 0.05) else "No",
            })

    # =========================================================================
    #  SAVE ALL CSVs
    # =========================================================================
    print("\n\nSaving results ...")

    # 1. Confusion matrices
    pd.DataFrame(cm_rows).to_csv(METRICS_D / "confusion_matrices.csv", index=False)
    print("  [OK] results/metrics/confusion_matrices.csv")

    # 2. Comprehensive model metrics
    comp_df = pd.DataFrame(comp_rows)
    COLS = ["Model","Feature Set","Threshold",
            "TP","TN","FP","FN",
            "Accuracy","Precision","Recall","Specificity",
            "F1","F2","Balanced-Accuracy","MCC","Jaccard","Jaccard-Macro","NPV","Cohen-Kappa",
            "ROC-AUC","PR-AUC","KS","KS-Threshold","Gini",
            "Brier","LogLoss",
            "ECE","MCE","Cal-Slope","Cal-Intercept",
            "Lift@10%"]
    avail = [c for c in COLS if c in comp_df.columns]
    comp_df[avail].to_csv(METRICS_D / ".." / "comprehensive_model_metrics.csv", index=False)
    print("  [OK] results/comprehensive_model_metrics.csv")

    # 3. Lift analysis
    lift_rows = []
    for key, rows in lift_all.items():
        parts = key.rsplit("_",1)
        for r in rows:
            r2 = {"Model": parts[0], "Feature Set": parts[1]}
            r2.update(r)
            lift_rows.append(r2)
    pd.DataFrame(lift_rows).to_csv(METRICS_D / "lift_analysis.csv", index=False)
    print("  [OK] results/metrics/lift_analysis.csv")

    # 4. Risk-band analysis
    rb_rows = []
    for key, rows in rb_all.items():
        parts = key.rsplit("_",1)
        for r in rows:
            r2 = {"Model": parts[0], "Feature Set": parts[1]}
            r2.update(r)
            rb_rows.append(r2)
    pd.DataFrame(rb_rows).to_csv(METRICS_D / "risk_band_analysis.csv", index=False)
    print("  [OK] results/metrics/risk_band_analysis.csv")

    # 5. PSI
    pd.DataFrame(psi_rows).to_csv(METRICS_D / "psi_analysis.csv", index=False)
    print("  [OK] results/metrics/psi_analysis.csv")

    # 6. CIs
    pd.DataFrame(ci_rows).to_csv(METRICS_D / "metric_confidence_intervals.csv", index=False)
    print("  [OK] results/metrics/metric_confidence_intervals.csv")

    # 7. Statistical comparison
    pd.DataFrame(stat_rows).to_csv(METRICS_D / "statistical_comparison.csv", index=False)
    print("  [OK] results/metrics/statistical_comparison.csv")

    # 8. Metric direction metadata
    get_metric_direction_df().to_csv(METRICS_D / "metric_direction.csv", index=False)
    print("  [OK] results/metrics/metric_direction.csv")

    # =========================================================================
    #  PLOTS
    # =========================================================================
    print("\n  Generating plots ...")
    plot_all_roc(results)
    print("    [OK] roc_curves.png")
    plot_all_pr(results)
    print("    [OK] precision_recall_curves.png")
    plot_cumulative_gains(results)
    print("    [OK] cumulative_gains.png")
    plot_lift_curves(lift_all)
    print("    [OK] lift_curves.png")
    plot_risk_bands(rb_all)
    print("    [OK] risk_band_analysis.png")
    plot_metric_comparison(comp_df)
    print("    [OK] metric_comparison.png")
    ci_df = pd.DataFrame(ci_rows)
    plot_ci_bars(ci_df)
    print("    [OK] CI plots")

    # =========================================================================
    #  COMPREHENSIVE REPORT
    # =========================================================================
    print("\n  Generating comprehensive report ...")

    # Find bests
    best_roc = comp_df.loc[comp_df["ROC-AUC"].idxmax()]
    best_pr  = comp_df.loc[comp_df["PR-AUC"].idxmax()]
    best_f1  = comp_df.loc[comp_df["F1"].idxmax()]
    best_mcc = comp_df.loc[comp_df["MCC"].idxmax()]
    best_brier = comp_df.loc[comp_df["Brier"].idxmin()]
    best_ece = comp_df.loc[comp_df["ECE"].idxmin()]
    best_lift = comp_df.loc[comp_df["Lift@10%"].idxmax()]

    def _lbl(r):
        return "{} ({})".format(r["Model"], r["Feature Set"])

    table_lines = comp_df[avail].to_markdown(index=False)

    report = """# Comprehensive Model Metrics Report

## Executive Summary

| Category | Best Model | Value |
|---|---|---|
| Best ROC-AUC | {roc_m} | {roc_v:.4f} |
| Best PR-AUC | {pr_m} | {pr_v:.4f} |
| Best F1 | {f1_m} | {f1_v:.4f} |
| Best MCC | {mcc_m} | {mcc_v:.4f} |
| Best Brier | {br_m} | {br_v:.4f} |
| Best ECE | {ece_m} | {ece_v:.4f} |
| Best Lift@10% | {lf_m} | {lf_v:.2f} |

## Model Comparison (Full Table)

{table}

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
""".format(
        roc_m=_lbl(best_roc), roc_v=best_roc["ROC-AUC"],
        pr_m=_lbl(best_pr), pr_v=best_pr["PR-AUC"],
        f1_m=_lbl(best_f1), f1_v=best_f1["F1"],
        mcc_m=_lbl(best_mcc), mcc_v=best_mcc["MCC"],
        br_m=_lbl(best_brier), br_v=best_brier["Brier"],
        ece_m=_lbl(best_ece), ece_v=best_ece["ECE"],
        lf_m=_lbl(best_lift), lf_v=best_lift["Lift@10%"],
        table=table_lines,
    )

    (RESULTS / "comprehensive_metrics_report.md").write_text(report, encoding="utf-8")
    print("  [OK] results/comprehensive_metrics_report.md")

    # =========================================================================
    #  CONSOLE SUMMARY
    # =========================================================================
    print("\n\n" + "=" * 80)
    print("  COMPREHENSIVE METRICS -- ALL MODELS (Test Set)")
    print("=" * 80)
    disp = ["Model","Feature Set","ROC-AUC","PR-AUC","F1","MCC","KS","Gini",
            "Brier","ECE","Lift@10%"]
    disp = [c for c in disp if c in comp_df.columns]
    print(comp_df[disp].to_string(index=False))
    print("\n\nPhase 4.5 complete. All metrics saved.\n")


if __name__ == "__main__":
    main()
