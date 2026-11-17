"""
phase6_package_model.py
=======================
Packages the practical production model (XGBoost Base + Isotonic Calibration)
into models/production/xgboost_base/ with full reproducibility artifacts.
"""

import os, sys, json, pickle, warnings
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss, f1_score
import xgboost as xgb

warnings.filterwarnings("ignore")

_THIS = Path(__file__).resolve().parent
_ROOT = _THIS.parent
sys.path.insert(0, str(_THIS))

from data_preprocessing import load_dataset, create_target
from metrics import classification_metrics, calibration_metrics

# Directory setup
PROD_DIR = _ROOT / "models" / "production" / "xgboost_base"
PROD_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR = _ROOT / "results"

SEED = 42
CONT_BASE = ["loan_amnt", "revenue", "dti_n", "fico_n", "experience_c"]
CAT_COLS  = ["emp_length", "home_ownership_n", "purpose"]

USER_TO_MODEL_MAP = {
    "loan_amount": "loan_amnt",
    "annual_income": "revenue",
    "dti": "dti_n",
    "fico_score": "fico_n",
    "credit_history_years": "experience_c",
    "employment_length": "emp_length",
    "home_ownership": "home_ownership_n",
    "loan_purpose": "purpose"
}

def load_temporal_split():
    df = load_dataset(str(_ROOT / "LC_loans_granting_model_dataset.csv"))
    df = create_target(df)
    for c in ["emp_length", "home_ownership_n", "purpose", "addr_state", "zip_code"]:
        if c in df.columns:
            df[c] = df[c].fillna("missing").astype(str)
    
    df["_dt"] = pd.to_datetime(df["issue_d"], format="%b-%Y", errors="coerce")
    df = df.dropna(subset=["_dt"]).sort_values("_dt").reset_index(drop=True)
    
    n = len(df)
    i1 = int(n * 0.70)
    i2 = int(n * 0.85)
    
    tr = df.iloc[:i1].copy()
    va = df.iloc[i1:i2].copy()
    te = df.iloc[i2:].copy()
    return tr, va, te

def main():
    print("Packaging Production Model: XGBoost Base + Isotonic Calibration")
    tr, va, te = load_temporal_split()
    print("  Data split sizes - Train: {:,}, Val: {:,}, Test: {:,}".format(len(tr), len(va), len(te)))
    
    # 1. Preprocessing artifacts
    medians = tr[CONT_BASE].median().to_dict()
    
    tr_c = tr[CONT_BASE].fillna(medians)
    va_c = va[CONT_BASE].fillna(medians)
    te_c = te[CONT_BASE].fillna(medians)
    
    scaler = StandardScaler()
    Xtr_c = scaler.fit_transform(tr_c.values.astype(np.float32))
    Xva_c = scaler.transform(va_c.values.astype(np.float32))
    Xte_c = scaler.transform(te_c.values.astype(np.float32))
    
    encoders = {}
    cards = []
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
        encoders[col] = le
        cards.append(len(le.classes_))
        
    y_tr = tr["target"].values.astype(np.int64)
    y_va = va["target"].values.astype(np.int64)
    y_te = te["target"].values.astype(np.int64)
    
    Xtr = np.hstack([Xtr_c, Xtr_cat])
    Xva = np.hstack([Xva_c, Xva_cat])
    Xte = np.hstack([Xte_c, Xte_cat])
    
    # 2. Train XGBoost Base
    print("  Training XGBoost Base Model...")
    spw = (len(y_tr) - y_tr.sum()) / max(y_tr.sum(), 1)
    mdl = xgb.XGBClassifier(
        n_estimators=300, learning_rate=0.05, max_depth=6,
        scale_pos_weight=spw, random_state=SEED,
        eval_metric="logloss", verbosity=0, tree_method="hist"
    )
    mdl.fit(Xtr, y_tr, verbose=False)
    
    # 3. Fit Isotonic Calibration on Validation Predictions
    print("  Fitting Isotonic Calibration on Validation Set...")
    yp_va = mdl.predict_proba(Xva)[:, 1]
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(yp_va, y_va)
    
    # 4. Evaluate Test Metrics for Traceability
    yp_te_raw = mdl.predict_proba(Xte)[:, 1]
    yp_te_cal = calibrator.predict(yp_te_raw)
    
    threshold = 0.45
    rk_raw = {"ROC-AUC": float(roc_auc_score(y_te, yp_te_raw)), "PR-AUC": float(average_precision_score(y_te, yp_te_raw))}
    rk_cal = {"ROC-AUC": float(roc_auc_score(y_te, yp_te_cal)), "PR-AUC": float(average_precision_score(y_te, yp_te_cal))}
    cal_raw = calibration_metrics(y_te, yp_te_raw)[0]
    cal_cal = calibration_metrics(y_te, yp_te_cal)[0]
    cls_cal = classification_metrics(y_te, yp_te_cal, threshold)
    
    print("  Test Evaluation:")
    print("    ROC-AUC (Raw / Calibrated): {:.4f} / {:.4f}".format(rk_raw["ROC-AUC"], rk_cal["ROC-AUC"]))
    print("    Brier Score (Raw / Calibrated): {:.4f} / {:.4f}".format(brier_score_loss(y_te, yp_te_raw), brier_score_loss(y_te, yp_te_cal)))
    print("    ECE (Raw / Calibrated): {:.4f} / {:.4f}".format(cal_raw["ECE"], cal_cal["ECE"]))

    # 5. Save Artifacts
    print("  Saving Production Artifacts to {} ...".format(PROD_DIR))
    
    # Model
    with open(PROD_DIR / "model.pkl", "wb") as f:
        pickle.dump(mdl, f)
        
    # Calibration
    with open(PROD_DIR / "calibration.pkl", "wb") as f:
        pickle.dump(calibrator, f)
        
    # Preprocessing
    prep_artifact = {
        "scaler": scaler,
        "encoders": encoders,
        "medians": medians,
        "cont_cols": CONT_BASE,
        "cat_cols": CAT_COLS
    }
    with open(PROD_DIR / "preprocessing.pkl", "wb") as f:
        pickle.dump(prep_artifact, f)
        
    # Feature Schema
    schema_artifact = {
        "user_to_model_mapping": USER_TO_MODEL_MAP,
        "user_features": list(USER_TO_MODEL_MAP.keys()),
        "model_features": CONT_BASE + CAT_COLS,
        "numerical_user_features": ["loan_amount", "annual_income", "dti", "fico_score", "credit_history_years"],
        "categorical_user_features": ["employment_length", "home_ownership", "loan_purpose"]
    }
    with open(PROD_DIR / "feature_schema.json", "w") as f:
        json.dump(schema_artifact, f, indent=2)
        
    # Threshold
    threshold_artifact = {
        "threshold": threshold,
        "selection_dataset": "Validation Set",
        "metric_optimized": "F1 / Balanced Accuracy Trade-off",
        "decision_rule": "calibrated_pd >= threshold -> Default (1)"
    }
    with open(PROD_DIR / "threshold.json", "w") as f:
        json.dump(threshold_artifact, f, indent=2)
        
    # Metadata
    metadata_artifact = {
        "model_name": "XGBoost",
        "model_version": "1.0",
        "feature_set": "base",
        "feature_list": CONT_BASE + CAT_COLS,
        "preprocessing_version": "1.0",
        "calibration_method": "IsotonicRegression",
        "calibration_version": "1.0",
        "threshold": threshold,
        "training_data_description": "Lending Club Historical Granting Dataset (Jun-2007 to Apr-2016)",
        "training_period": "Jun-2007 to Apr-2016",
        "validation_period": "Apr-2016 to Feb-2017",
        "test_period": "Feb-2017 to Dec-2018",
        "training_timestamp": datetime.now().isoformat(),
        "random_seed": SEED,
        "key_test_metrics": {
            "ROC-AUC": rk_cal["ROC-AUC"],
            "PR-AUC": rk_cal["PR-AUC"],
            "F1": cls_cal["F1"],
            "Accuracy": cls_cal["Accuracy"],
            "Precision": cls_cal["Precision"],
            "Recall": cls_cal["Recall"],
            "Specificity": cls_cal["Specificity"],
            "Balanced_Accuracy": cls_cal["Balanced-Accuracy"],
            "MCC": cls_cal["MCC"]
        },
        "calibration_metrics": {
            "Brier_Raw": float(brier_score_loss(y_te, yp_te_raw)),
            "Brier_Calibrated": float(brier_score_loss(y_te, yp_te_cal)),
            "ECE_Raw": cal_raw["ECE"],
            "ECE_Calibrated": cal_cal["ECE"],
            "Calibration_Slope": cal_cal["Cal-Slope"],
            "Calibration_Intercept": cal_cal["Cal-Intercept"]
        },
        "traceability_references": [
            "results/final_model_comparison.csv",
            "results/comprehensive_model_metrics.csv",
            "results/calibration_comparison.csv",
            "results/trustworthiness_comparison.csv"
        ]
    }
    with open(PROD_DIR / "metadata.json", "w") as f:
        json.dump(metadata_artifact, f, indent=2)
        
    print("  Artifact packaging successfully completed.")

if __name__ == "__main__":
    main()
