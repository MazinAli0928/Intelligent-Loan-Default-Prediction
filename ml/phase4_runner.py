"""
phase4_runner.py
================
Phase 4: Threshold Tuning + Full-Data Training + Final Evaluation + Model Selection.

Run from the project root:
    python ml/phase4_runner.py
"""

from __future__ import annotations
import os
import sys
import json
import pickle
import warnings
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
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    f1_score, precision_score, recall_score,
    brier_score_loss, log_loss,
    accuracy_score, balanced_accuracy_score,
    confusion_matrix, roc_curve,
)
from scipy.stats import ks_2samp
import xgboost as xgb

warnings.filterwarnings("ignore", category=UserWarning)

# -- Paths ----------------------------------------------------------------------
_THIS_DIR  = Path(__file__).resolve().parent
_ROOT_DIR  = _THIS_DIR.parent
_DATA_PATH = _ROOT_DIR / "LC_loans_granting_model_dataset.csv"

if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

from ft_transformer import FTTransformer, FocalLoss
from data_preprocessing import load_dataset, create_target

# -- Output dirs ----------------------------------------------------------------
RESULTS_DIR = _ROOT_DIR / "results"
PLOTS_DIR   = RESULTS_DIR / "plots"
MODELS_DIR  = _ROOT_DIR / "models" / "final_model"
PREPROC_DIR = _ROOT_DIR / "models" / "preprocessing"
THRESH_DIR  = _ROOT_DIR / "models" / "thresholds"

for _d in [RESULTS_DIR, PLOTS_DIR, MODELS_DIR, PREPROC_DIR, THRESH_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)

# -- Feature lists --------------------------------------------------------------
CONT_BASE = ["loan_amnt", "revenue", "dti_n", "fico_n", "experience_c"]
CONT_ENH  = CONT_BASE + ["loan_to_income", "est_monthly_debt", "residual_monthly_income"]
CAT_COLS  = ["emp_length", "home_ownership_n", "purpose"]


# ==============================================================================
#  DATA LOADING & SPLITTING
# ==============================================================================

def load_and_split():
    print("Loading dataset from {} ...".format(_DATA_PATH))
    df = load_dataset(str(_DATA_PATH))
    df = create_target(df)
    df = _cat_clean(df)

    df["_dt"] = pd.to_datetime(df["issue_d"], format="%b-%Y", errors="coerce")
    df = df.dropna(subset=["_dt"]).sort_values("_dt").reset_index(drop=True)

    n = len(df)
    i_val  = int(n * 0.70)
    i_test = int(n * 0.85)

    train = df.iloc[:i_val].copy()
    val   = df.iloc[i_val:i_test].copy()
    test  = df.iloc[i_test:].copy()

    print("  Train : {} -> {}  ({:,} rows)".format(
        train["_dt"].min().strftime("%b-%Y"), train["_dt"].max().strftime("%b-%Y"), len(train)))
    print("  Val   : {} -> {}  ({:,} rows)".format(
        val["_dt"].min().strftime("%b-%Y"), val["_dt"].max().strftime("%b-%Y"), len(val)))
    print("  Test  : {} -> {}  ({:,} rows)".format(
        test["_dt"].min().strftime("%b-%Y"), test["_dt"].max().strftime("%b-%Y"), len(test)))
    print("  Default rate -- Train: {:.2%}  Val: {:.2%}  Test: {:.2%}".format(
        train["target"].mean(), val["target"].mean(), test["target"].mean()))
    return train, val, test


def _cat_clean(df):
    df = df.copy()
    for col in ["emp_length", "home_ownership_n", "purpose", "addr_state", "zip_code"]:
        if col in df.columns:
            df[col] = df[col].fillna("missing").astype(str)
    return df


# ==============================================================================
#  FEATURE ENGINEERING & PREPROCESSING
# ==============================================================================

def _add_enhanced(df):
    df = df.copy()
    safe = df["revenue"].replace(0, np.nan)
    df["loan_to_income"]          = (df["loan_amnt"] / safe).fillna(0.0)
    df["est_monthly_debt"]        = (df["revenue"] / 12) * (df["dti_n"] / 100)
    df["residual_monthly_income"] = (df["revenue"] / 12) - df["est_monthly_debt"]
    return df


def build_arrays(train_df, val_df, test_df, feature_set="base", sample_frac=1.0):
    if sample_frac < 1.0:
        train_df = train_df.sample(frac=sample_frac, random_state=SEED)

    cont_cols = CONT_ENH if feature_set == "enhanced" else CONT_BASE

    if feature_set == "enhanced":
        train_df = _add_enhanced(train_df)
        val_df   = _add_enhanced(val_df)
        test_df  = _add_enhanced(test_df)

    # Impute with train medians only
    medians = train_df[cont_cols].median()
    train_df = train_df.copy(); train_df[cont_cols] = train_df[cont_cols].fillna(medians)
    val_df   = val_df.copy();   val_df[cont_cols]   = val_df[cont_cols].fillna(medians)
    test_df  = test_df.copy();  test_df[cont_cols]  = test_df[cont_cols].fillna(medians)

    scaler = StandardScaler()
    X_tr_c = scaler.fit_transform(train_df[cont_cols].values.astype(np.float32))
    X_va_c = scaler.transform(val_df[cont_cols].values.astype(np.float32))
    X_te_c = scaler.transform(test_df[cont_cols].values.astype(np.float32))

    les = {}
    cards = []
    X_tr_cat = np.zeros((len(train_df), len(CAT_COLS)), dtype=np.int64)
    X_va_cat = np.zeros((len(val_df),   len(CAT_COLS)), dtype=np.int64)
    X_te_cat = np.zeros((len(test_df),  len(CAT_COLS)), dtype=np.int64)

    for i, col in enumerate(CAT_COLS):
        le = LabelEncoder()
        tv = train_df[col].astype(str).values
        le.fit(np.append(tv, ["Unknown"]))
        def enc(vals, _le=le):
            return _le.transform([v if v in _le.classes_ else "Unknown" for v in vals.astype(str)])
        X_tr_cat[:, i] = enc(train_df[col].values)
        X_va_cat[:, i] = enc(val_df[col].values)
        X_te_cat[:, i] = enc(test_df[col].values)
        cards.append(len(le.classes_))
        les[col] = le

    return dict(
        X_tr_c=X_tr_c, X_va_c=X_va_c, X_te_c=X_te_c,
        X_tr_cat=X_tr_cat, X_va_cat=X_va_cat, X_te_cat=X_te_cat,
        y_tr=train_df["target"].values.astype(np.int64),
        y_va=val_df["target"].values.astype(np.int64),
        y_te=test_df["target"].values.astype(np.int64),
        cardinalities=cards, scaler=scaler, les=les,
        cont_cols=cont_cols, medians=medians,
    )


def _ds(Xc, Xcat, y):
    return TensorDataset(
        torch.FloatTensor(Xc), torch.LongTensor(Xcat), torch.LongTensor(y)
    )


def make_loaders(a, batch=1024):
    kw = dict(drop_last=False)
    tr = DataLoader(_ds(a["X_tr_c"], a["X_tr_cat"], a["y_tr"]), batch_size=batch, shuffle=True,  **kw)
    va = DataLoader(_ds(a["X_va_c"], a["X_va_cat"], a["y_va"]), batch_size=batch, shuffle=False, **kw)
    te = DataLoader(_ds(a["X_te_c"], a["X_te_cat"], a["y_te"]), batch_size=batch, shuffle=False, **kw)
    return tr, va, te


# ==============================================================================
#  MODEL DEFINITIONS
# ==============================================================================

class SimpleMLP(nn.Module):
    def __init__(self, n_cont, cards):
        super().__init__()
        edims = [min(50, (c + 1) // 2) for c in cards]
        self.emb = nn.ModuleList([nn.Embedding(c, e) for c, e in zip(cards, edims)])
        self.net = nn.Sequential(
            nn.Linear(n_cont + sum(edims), 256), nn.BatchNorm1d(256), nn.SiLU(), nn.Dropout(0.2),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.SiLU(), nn.Dropout(0.2),
            nn.Linear(128, 64), nn.SiLU(),
            nn.Linear(64, 1),
        )
    def forward(self, xc, xcat):
        embs = [e(xcat[:, i]) for i, e in enumerate(self.emb)]
        return self.net(torch.cat([xc, *embs], dim=1)).squeeze(-1)


# ==============================================================================
#  TRAINING & INFERENCE
# ==============================================================================

def _device():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def train_torch(model, loader, epochs, lr=1e-3):
    device = _device()
    model.to(device)
    crit = FocalLoss(alpha=0.75, gamma=2.0)
    opt  = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    sch  = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    for ep in range(epochs):
        model.train()
        tot, nb = 0.0, 0
        for xc, xcat, y in loader:
            xc, xcat, y = xc.to(device), xcat.to(device), y.to(device)
            opt.zero_grad()
            loss = crit(model(xc, xcat), y.float())
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tot += loss.item(); nb += 1
        sch.step()
        if (ep + 1) % 5 == 0 or ep == 0:
            print("      Epoch {}/{}  loss={:.4f}".format(ep + 1, epochs, tot / nb))
    return model


def predict_torch(model, loader):
    device = _device()
    model.to(device).eval()
    out = []
    with torch.no_grad():
        for xc, xcat, _ in loader:
            out.append(torch.sigmoid(model(xc.to(device), xcat.to(device))).cpu().numpy())
    return np.concatenate(out)


# ==============================================================================
#  METRICS
# ==============================================================================

def calc_metrics(y_true, y_prob, thr=0.5):
    y_pred = (y_prob >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    ks, _ = ks_2samp(y_prob[y_true == 0], y_prob[y_true == 1])
    return {
        "ROC-AUC":           round(roc_auc_score(y_true, y_prob), 6),
        "PR-AUC":            round(average_precision_score(y_true, y_prob), 6),
        "Accuracy":          round(accuracy_score(y_true, y_pred), 6),
        "Balanced-Accuracy": round(balanced_accuracy_score(y_true, y_pred), 6),
        "Precision":         round(precision_score(y_true, y_pred, zero_division=0), 6),
        "Recall":            round(recall_score(y_true, y_pred, zero_division=0), 6),
        "F1":                round(f1_score(y_true, y_pred, zero_division=0), 6),
        "Specificity":       round(spec, 6),
        "KS":                round(ks, 6),
        "Brier":             round(brier_score_loss(y_true, y_prob), 6),
        "LogLoss":           round(log_loss(y_true, y_prob), 6),
        "Threshold":         round(thr, 4),
        "TP": int(tp), "FP": int(fp), "FN": int(fn), "TN": int(tn),
    }


# ==============================================================================
#  THRESHOLD TUNING  (val set only)
# ==============================================================================

def tune_threshold(y_true, y_prob, model_label, feature_set):
    thresholds = np.round(np.arange(0.01, 1.00, 0.01), 2)
    rows = []
    for t in thresholds:
        yp = (y_prob >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, yp, labels=[0, 1]).ravel()
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
        rows.append({
            "Model": model_label, "Feature Set": feature_set, "Threshold": t,
            "Precision":    precision_score(y_true, yp, zero_division=0),
            "Recall":       recall_score(y_true, yp, zero_division=0),
            "F1":           f1_score(y_true, yp, zero_division=0),
            "Specificity":  spec,
            "Accuracy":     accuracy_score(y_true, yp),
            "Balanced-Acc": balanced_accuracy_score(y_true, yp),
        })
    df_t = pd.DataFrame(rows)
    df_t["Youden_J"] = df_t["Recall"] + df_t["Specificity"] - 1.0

    best_f1_thr = float(df_t.loc[df_t["F1"].idxmax(), "Threshold"])

    r80 = df_t[df_t["Recall"] >= 0.80]
    thr_80 = float(r80["Threshold"].max()) if len(r80) else best_f1_thr

    r90 = df_t[df_t["Recall"] >= 0.90]
    thr_90 = float(r90["Threshold"].max()) if len(r90) else best_f1_thr

    thr_yj = float(df_t.loc[df_t["Youden_J"].idxmax(), "Threshold"])

    result = {
        "model": model_label, "feature_set": feature_set,
        "best_f1_threshold":   best_f1_thr,
        "recall_80_threshold": thr_80,
        "recall_90_threshold": thr_90,
        "youden_j_threshold":  thr_yj,
        "f1_at_best":          float(df_t.loc[df_t["F1"].idxmax(), "F1"]),
        "precision_at_best":   float(df_t.loc[df_t["F1"].idxmax(), "Precision"]),
        "recall_at_best":      float(df_t.loc[df_t["F1"].idxmax(), "Recall"]),
    }

    # Plot
    safe = "{}_{}".format(model_label, feature_set).replace(" ", "_")
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(df_t["Threshold"], df_t["F1"],       label="F1",        lw=2)
    ax.plot(df_t["Threshold"], df_t["Precision"], label="Precision", lw=2, ls="--")
    ax.plot(df_t["Threshold"], df_t["Recall"],    label="Recall",    lw=2, ls=":")
    ax.axvline(best_f1_thr, color="red",   ls="-",  alpha=0.7, label="Best-F1 thr={:.2f}".format(best_f1_thr))
    ax.axvline(thr_yj,      color="green", ls="--", alpha=0.7, label="Youden-J thr={:.2f}".format(thr_yj))
    ax.set_xlabel("Threshold"); ax.set_ylabel("Score")
    ax.set_title("Threshold Curves -- {} ({} features)".format(model_label, feature_set))
    ax.legend(); ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS_DIR / "threshold_{}.png".format(safe), dpi=120)
    plt.close(fig)

    return result, df_t


# ==============================================================================
#  CONFUSION MATRIX & ROC PLOTS
# ==============================================================================

def plot_cm(y_true, y_pred, model_label, feature_set):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(cm, cmap="Blues")
    plt.colorbar(im, ax=ax)
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(["Non-Default", "Default"])
    ax.set_yticklabels(["Non-Default", "Default"])
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title("Confusion Matrix\n{} ({})".format(model_label, feature_set))
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=11)
    fig.tight_layout()
    safe = "{}_{}".format(model_label, feature_set).replace(" ", "_")
    fig.savefig(PLOTS_DIR / "confusion_matrix_{}.png".format(safe), dpi=120)
    plt.close(fig)


def plot_roc(y_true, y_prob, model_label, feature_set):
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    auc = roc_auc_score(y_true, y_prob)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, lw=2, label="AUC = {:.4f}".format(auc))
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("FPR"); ax.set_ylabel("TPR")
    ax.set_title("ROC Curve -- {} ({})".format(model_label, feature_set))
    ax.legend(); ax.grid(True, alpha=0.3)
    fig.tight_layout()
    safe = "{}_{}".format(model_label, feature_set).replace(" ", "_")
    fig.savefig(PLOTS_DIR / "roc_{}.png".format(safe), dpi=120)
    plt.close(fig)


# ==============================================================================
#  RUN ONE EXPERIMENT
# ==============================================================================

def run_one_experiment(model_name, feature_set, train_df, val_df, test_df,
                       sample_frac=1.0, epochs=10):
    print("\n  -- {} | {} features | sample={:.0%} --".format(
        model_name, feature_set, sample_frac))

    a = build_arrays(train_df, val_df, test_df,
                     feature_set=feature_set, sample_frac=sample_frac)
    tr_ldr, va_ldr, te_ldr = make_loaders(a)
    n_cont = len(a["cont_cols"])
    cards  = a["cardinalities"]

    # -- Train ------------------------------------------------------------------
    if model_name == "Logistic Regression":
        Xtr = np.hstack([a["X_tr_c"], a["X_tr_cat"]])
        Xva = np.hstack([a["X_va_c"], a["X_va_cat"]])
        Xte = np.hstack([a["X_te_c"], a["X_te_cat"]])
        model = LogisticRegression(max_iter=1000, class_weight="balanced",
                                   random_state=SEED, solver="lbfgs", n_jobs=-1)
        print("    Fitting Logistic Regression ...")
        model.fit(Xtr, a["y_tr"])
        y_va_p = model.predict_proba(Xva)[:, 1]
        y_te_p = model.predict_proba(Xte)[:, 1]

    elif model_name == "XGBoost":
        Xtr = np.hstack([a["X_tr_c"], a["X_tr_cat"]])
        Xva = np.hstack([a["X_va_c"], a["X_va_cat"]])
        Xte = np.hstack([a["X_te_c"], a["X_te_cat"]])
        spw = (len(a["y_tr"]) - a["y_tr"].sum()) / max(a["y_tr"].sum(), 1)
        model = xgb.XGBClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            scale_pos_weight=spw, random_state=SEED,
            eval_metric="logloss", verbosity=0, tree_method="hist", device="cuda" if torch.cuda.is_available() else "cpu",
        )
        print("    Fitting XGBoost (300 trees) ...")
        model.fit(Xtr, a["y_tr"], eval_set=[(Xva, a["y_va"])], verbose=False)
        y_va_p = model.predict_proba(Xva)[:, 1]
        y_te_p = model.predict_proba(Xte)[:, 1]

    elif model_name == "Hybrid MLP":
        model = SimpleMLP(n_cont, cards)
        print("    Training Hybrid MLP ({} epochs) ...".format(epochs))
        model = train_torch(model, tr_ldr, epochs=epochs)
        y_va_p = predict_torch(model, va_ldr)
        y_te_p = predict_torch(model, te_ldr)

    elif model_name == "FT-Transformer":
        model = FTTransformer(
            num_continuous=n_cont, categorical_cardinalities=cards,
            dim=64, depth=2, heads=4, ff_dropout=0.1, attn_dropout=0.1,
        )
        print("    Training FT-Transformer ({} epochs) ...".format(epochs))
        model = train_torch(model, tr_ldr, epochs=epochs)
        y_va_p = predict_torch(model, va_ldr)
        y_te_p = predict_torch(model, te_ldr)

    else:
        raise ValueError("Unknown model: {}".format(model_name))

    # -- Threshold tuning on val only -------------------------------------------
    thr_res, thr_df = tune_threshold(a["y_va"], y_va_p, model_name, feature_set)
    best_thr = thr_res["best_f1_threshold"]
    print("    Best-F1 threshold (val): {:.2f}  F1={:.4f}  Recall={:.4f}".format(
        best_thr, thr_res["f1_at_best"], thr_res["recall_at_best"]))
    print("    NOTE: Threshold tuning changes classification metrics; ROC-AUC is unchanged.")

    # -- Evaluate on test with val-tuned threshold ------------------------------
    test_met = calc_metrics(a["y_te"], y_te_p, thr=best_thr)
    test_met.update({"Model": model_name, "Feature Set": feature_set, "Sample Frac": sample_frac})

    # -- Plots ------------------------------------------------------------------
    y_te_pred = (y_te_p >= best_thr).astype(int)
    plot_cm(a["y_te"], y_te_pred, model_name, feature_set)
    plot_roc(a["y_te"], y_te_p, model_name, feature_set)

    return thr_res, test_met, model, y_va_p, y_te_p, a, thr_df


# ==============================================================================
#  MAIN
# ==============================================================================

def main():
    train_df, val_df, test_df = load_and_split()

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

    torch_epochs = {"FT-Transformer": 10, "Hybrid MLP": 10}

    all_thr_rows     = []
    results_full     = []
    results_10       = []
    saved            = {}

    for model_name, feat_set in experiments:
        ep = torch_epochs.get(model_name, 0)

        # 10% run (for size comparison)
        print("\n" + "=" * 65)
        print(" 10% sample  |  {}  |  {}".format(model_name, feat_set))
        print("=" * 65)
        thr10, met10, *_ = run_one_experiment(
            model_name, feat_set, train_df, val_df, test_df,
            sample_frac=0.10, epochs=ep)
        results_10.append(met10)

        # Full data
        print("\n" + "=" * 65)
        print(" FULL DATA   |  {}  |  {}".format(model_name, feat_set))
        print("=" * 65)
        thr_f, met_f, mdl, y_va_p, y_te_p, a, thr_df = run_one_experiment(
            model_name, feat_set, train_df, val_df, test_df,
            sample_frac=1.00, epochs=ep)

        results_full.append(met_f)
        all_thr_rows.append(thr_df)
        saved["{}_{}".format(model_name, feat_set)] = {
            "model": mdl, "arrays": a,
            "thr": thr_f, "y_va_p": y_va_p, "y_te_p": y_te_p,
        }

    # -- Save CSVs --------------------------------------------------------------
    print("\n\nSaving results ...")

    pd.concat(all_thr_rows, ignore_index=True).to_csv(
        RESULTS_DIR / "threshold_comparison.csv", index=False)
    print("  [OK] results/threshold_comparison.csv")

    COLS = [
        "Model", "Feature Set", "Sample Frac", "Threshold",
        "ROC-AUC", "PR-AUC", "Accuracy", "Balanced-Accuracy",
        "Precision", "Recall", "F1", "Specificity",
        "KS", "Brier", "LogLoss", "TP", "FP", "FN", "TN",
    ]
    full_df = pd.DataFrame(results_full)[COLS]
    full_df.to_csv(RESULTS_DIR / "final_model_comparison.csv", index=False)
    print("  [OK] results/final_model_comparison.csv")

    # Size comparison
    df10  = pd.DataFrame(results_10)
    df100 = pd.DataFrame(results_full)
    DELTA = ["ROC-AUC", "PR-AUC", "F1", "Recall", "Precision", "KS", "Brier"]
    delta_rows = []
    for i in range(len(df100)):
        r10  = df10.iloc[i]
        r100 = df100.iloc[i]
        d = {"Model": r100["Model"], "Feature Set": r100["Feature Set"]}
        for m in DELTA:
            d["{}_10pct".format(m)]  = round(float(r10[m]), 6)
            d["{}_full".format(m)]   = round(float(r100[m]), 6)
            d["{}_delta".format(m)]  = round(float(r100[m]) - float(r10[m]), 6)
        delta_rows.append(d)
    pd.DataFrame(delta_rows).to_csv(RESULTS_DIR / "data_size_comparison.csv", index=False)
    print("  [OK] results/data_size_comparison.csv")

    # -- Model selection --------------------------------------------------------
    print("\n\nPhase 4E -- Model Selection ...")
    full_df2 = full_df.copy()
    full_df2["score"] = (
        0.25 * full_df2["ROC-AUC"] +
        0.25 * full_df2["PR-AUC"] +
        0.20 * full_df2["F1"] +
        0.15 * full_df2["KS"] +
        0.15 * (1 - full_df2["Brier"])
    )
    best_idx  = full_df2["score"].idxmax()
    best_row  = full_df2.loc[best_idx]
    runner    = full_df2.drop(index=best_idx).nlargest(1, "score").iloc[0]
    margin    = float(best_row["ROC-AUC"]) - float(runner["ROC-AUC"])

    print("  Best model : {} ({})".format(best_row["Model"], best_row["Feature Set"]))
    print("  Runner-up  : {} ({})".format(runner["Model"], runner["Feature Set"]))
    print("  ROC-AUC gap: {:.4f}  {}".format(
        margin, "(marginal)" if abs(margin) < 0.005 else "(meaningful)"))

    # -- Save artifacts ---------------------------------------------------------
    print("\nPhase 4F -- Saving artifacts ...")
    best_key  = "{}_{}".format(best_row["Model"], best_row["Feature Set"])
    best_info = saved[best_key]
    best_a    = best_info["arrays"]
    best_mdl  = best_info["model"]
    best_thr  = best_info["thr"]

    if isinstance(best_mdl, (FTTransformer, SimpleMLP)):
        torch.save(best_mdl.state_dict(), MODELS_DIR / "model.pt")
        mtype = type(best_mdl).__name__
        mext  = "pt"
    else:
        with open(MODELS_DIR / "model.pkl", "wb") as f:
            pickle.dump(best_mdl, f)
        mtype = type(best_mdl).__name__
        mext  = "pkl"
    print("  [OK] models/final_model/model.{}".format(mext))

    with open(PREPROC_DIR / "scaler.pkl",          "wb") as f: pickle.dump(best_a["scaler"], f)
    with open(PREPROC_DIR / "label_encoders.pkl",  "wb") as f: pickle.dump(best_a["les"], f)
    with open(PREPROC_DIR / "medians.json",        "w")  as f:
        json.dump({k: float(v) for k, v in best_a["medians"].items()}, f, indent=2)
    print("  [OK] models/preprocessing/")

    with open(THRESH_DIR / "thresholds.json", "w") as f:
        json.dump(best_thr, f, indent=2)
    print("  [OK] models/thresholds/thresholds.json")

    meta = {
        "model_type": mtype, "model_name": best_row["Model"],
        "feature_set": best_row["Feature Set"],
        "cont_cols": best_a["cont_cols"], "cat_cols": CAT_COLS,
        "cardinalities": best_a["cardinalities"], "seed": SEED,
        "best_threshold":      best_thr["best_f1_threshold"],
        "youden_threshold":    best_thr["youden_j_threshold"],
        "recall_80_threshold": best_thr["recall_80_threshold"],
        "recall_90_threshold": best_thr["recall_90_threshold"],
        "test_roc_auc":   float(best_row["ROC-AUC"]),
        "test_pr_auc":    float(best_row["PR-AUC"]),
        "test_f1":        float(best_row["F1"]),
        "test_recall":    float(best_row["Recall"]),
        "test_precision": float(best_row["Precision"]),
        "test_ks":        float(best_row["KS"]),
        "test_brier":     float(best_row["Brier"]),
    }
    with open(_ROOT_DIR / "models" / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("  [OK] models/metadata.json")

    # -- Console results summary ------------------------------------------------
    print("\n\n" + "=" * 70)
    print("  FINAL RESULTS -- Full-Data + Tuned Threshold (Test Set)")
    print("=" * 70)
    disp = ["Model", "Feature Set", "Threshold", "ROC-AUC", "PR-AUC",
            "F1", "Precision", "Recall", "KS", "Brier"]
    print(full_df[disp].to_string(index=False))

    print("\n\n" + "=" * 70)
    print("  SIZE COMPARISON: 10% vs FULL training (delta = full - 10%)")
    print("=" * 70)
    dc = pd.read_csv(RESULTS_DIR / "data_size_comparison.csv")
    dcols = ["Model", "Feature Set"] + [c for c in dc.columns if "_delta" in c]
    print(dc[dcols].to_string(index=False))

    # -- Markdown summary report ------------------------------------------------
    row10_best = df10[(df10["Model"] == best_row["Model"]) &
                      (df10["Feature Set"] == best_row["Feature Set"])].iloc[0]
    roc_delta = float(best_row["ROC-AUC"]) - float(row10_best["ROC-AUC"])

    report = """# Phase 4 -- Final Model Summary Report

## Selected Model

| Property | Value |
|---|---|
| Model | {model} |
| Feature Set | {fset} |
| Threshold (best F1) | {thr_f1} |
| Threshold (Youden J) | {thr_yj} |
| Threshold (80% Recall) | {thr_80} |
| Threshold (90% Recall) | {thr_90} |

## Test Set Performance (full training data, tuned threshold)

| Metric | Value |
|---|---|
| ROC-AUC | {roc:.4f} |
| PR-AUC | {pr:.4f} |
| F1 | {f1:.4f} |
| Precision | {prec:.4f} |
| Recall | {rec:.4f} |
| KS Statistic | {ks:.4f} |
| Brier Score | {brier:.4f} |
| Balanced Accuracy | {ba:.4f} |
| Specificity | {spec:.4f} |

## Did full-data training improve performance?

ROC-AUC delta (full vs 10%): **{roc_delta:+.4f}**

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

ROC-AUC gap vs runner-up: **{margin:+.4f}** ({margin_note})

## Important Notes on Threshold Tuning

Threshold tuning changes classification metrics (F1, Precision, Recall,
Specificity) but does NOT improve ROC-AUC. ROC-AUC measures the model's
ability to rank borrowers by default risk -- this is purely a property of
the predicted probability scores, not the decision threshold.

## Artifacts Saved

- models/final_model/model.{ext}  -- model weights
- models/preprocessing/           -- scaler, label encoders, medians
- models/thresholds/              -- threshold JSON
- models/metadata.json            -- full training configuration
- results/threshold_comparison.csv
- results/final_model_comparison.csv
- results/data_size_comparison.csv
- results/plots/                  -- threshold, ROC, confusion matrix plots
""".format(
        model=best_row["Model"], fset=best_row["Feature Set"],
        thr_f1=best_thr["best_f1_threshold"],
        thr_yj=best_thr["youden_j_threshold"],
        thr_80=best_thr["recall_80_threshold"],
        thr_90=best_thr["recall_90_threshold"],
        roc=float(best_row["ROC-AUC"]), pr=float(best_row["PR-AUC"]),
        f1=float(best_row["F1"]), prec=float(best_row["Precision"]),
        rec=float(best_row["Recall"]), ks=float(best_row["KS"]),
        brier=float(best_row["Brier"]),
        ba=float(best_row["Balanced-Accuracy"]),
        spec=float(best_row["Specificity"]),
        roc_delta=roc_delta, margin=margin,
        margin_note="marginal -- simpler model competitive" if abs(margin) < 0.005 else "meaningful advantage",
        ext=mext,
    )

    (RESULTS_DIR / "final_summary_report.md").write_text(report, encoding="utf-8")
    print("\n  [OK] results/final_summary_report.md")
    print("\nPhase 4 complete.\n")


if __name__ == "__main__":
    main()
