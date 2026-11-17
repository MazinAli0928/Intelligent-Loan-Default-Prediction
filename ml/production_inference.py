"""
production_inference.py
========================
Canonical production inference module for AI Loan Default Prediction.
Loads XGBoost Base + Isotonic Calibration artifacts and provides a single
entry point function: `predict_loan_risk(input_data: dict) -> dict`.
"""

import os, sys, json, pickle, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import shap

warnings.filterwarnings("ignore")

_THIS = Path(__file__).resolve().parent
_ROOT = _THIS.parent
PROD_DIR = _ROOT / "models" / "production" / "xgboost_base"

# Documented Risk Band System
RISK_BANDS = [
    (0.00, 0.15, "Low", "Low credit risk profile; recommended for standard approval processing."),
    (0.15, 0.30, "Moderate", "Moderate risk profile; standard underwriting checks recommended."),
    (0.30, 0.45, "High", "Elevated risk profile; requires manual review or secondary documentation."),
    (0.45, 1.00, "Critical", "High probability of default; recommended for decline or strict collateral terms.")
]

HUMAN_FEATURE_NAMES = {
    "loan_amount": "Loan Amount",
    "annual_income": "Annual Income",
    "dti": "Debt-to-Income (DTI)",
    "fico_score": "FICO Score",
    "credit_history_years": "Credit History Length",
    "employment_length": "Employment Length",
    "home_ownership": "Home Ownership Status",
    "loan_purpose": "Loan Purpose"
}


class ProductionLoanModel:
    """Singleton/loader class for production inference artifacts."""
    
    def __init__(self, prod_dir=PROD_DIR):
        self.prod_dir = Path(prod_dir)
        self._load_artifacts()
        self.explainer = shap.TreeExplainer(self.model)

    def _load_artifacts(self):
        if not (self.prod_dir / "model.pkl").exists():
            raise FileNotFoundError("Production artifacts not found in {}. Run ml/phase6_package_model.py first.".format(self.prod_dir))
            
        with open(self.prod_dir / "model.pkl", "rb") as f:
            self.model = pickle.load(f)
            
        with open(self.prod_dir / "calibration.pkl", "rb") as f:
            self.calibrator = pickle.load(f)
            
        with open(self.prod_dir / "preprocessing.pkl", "rb") as f:
            self.prep = pickle.load(f)
            
        with open(self.prod_dir / "feature_schema.json", "r") as f:
            self.schema = json.load(f)
            
        with open(self.prod_dir / "threshold.json", "r") as f:
            self.threshold_data = json.load(f)
            self.threshold = float(self.threshold_data["threshold"])
            
        with open(self.prod_dir / "metadata.json", "r") as f:
            self.metadata = json.load(f)

    def validate_input(self, input_data: dict) -> dict:
        """Validates input keys, types, and ranges. Raises ValueError on failure."""
        if not isinstance(input_data, dict):
            raise ValueError("Input data must be a dictionary.")
            
        user_feats = self.schema["user_features"]
        missing = [f for f in user_feats if f not in input_data]
        if missing:
            raise ValueError("Missing required input features: {}".format(missing))
            
        # Range & Type checks
        val_rules = {
            "loan_amount": (500.0, 100000.0, "float/int"),
            "annual_income": (0.0, 10000000.0, "float/int"),
            "dti": (0.0, 100.0, "float/int"),
            "fico_score": (300.0, 850.0, "float/int"),
            "credit_history_years": (0.0, 70.0, "float/int"),
        }
        
        cleaned = {}
        for k, (min_v, max_v, tname) in val_rules.items():
            val = input_data[k]
            if not isinstance(val, (int, float, np.number)) or np.isnan(val):
                raise ValueError("Invalid numeric value for '{}': {}. Must be a valid number.".format(k, val))
            v_float = float(val)
            if v_float < min_v or v_float > max_v:
                raise ValueError("Value for '{}' ({}) out of acceptable range [{}, {}].".format(k, v_float, min_v, max_v))
            cleaned[k] = v_float
            
        # Categorical checks
        encoders = self.prep["encoders"]
        cat_map = {
            "employment_length": "emp_length",
            "home_ownership": "home_ownership_n",
            "loan_purpose": "purpose"
        }
        
        for u_key, m_key in cat_map.items():
            val_str = str(input_data[u_key]).strip()
            le = encoders[m_key]
            valid_classes = set(c for c in le.classes_ if c != "Unknown")
            if val_str not in valid_classes:
                raise ValueError("Unknown categorical value for '{}': '{}'. Allowed categories: {}".format(
                    u_key, val_str, sorted(list(valid_classes))))
            cleaned[u_key] = val_str
            
        return cleaned

    def transform_input(self, cleaned_input: dict):
        """Transforms validated user dictionary into standardized model feature vector."""
        cont_cols = self.prep["cont_cols"]
        cat_cols = self.prep["cat_cols"]
        scaler = self.prep["scaler"]
        encoders = self.prep["encoders"]
        medians = self.prep["medians"]
        u_map = self.schema["user_to_model_mapping"]
        
        # Continuous
        cont_vals = []
        for m_col in cont_cols:
            u_col = [k for k, v in u_map.items() if v == m_col][0]
            val = cleaned_input[u_col]
            cont_vals.append(val if not np.isnan(val) else medians.get(m_col, 0.0))
            
        cont_arr = np.array([cont_vals], dtype=np.float32)
        cont_scaled = scaler.transform(cont_arr)
        
        # Categorical
        cat_vals = []
        for m_col in cat_cols:
            u_col = [k for k, v in u_map.items() if v == m_col][0]
            val_str = cleaned_input[u_col]
            le = encoders[m_col]
            if val_str in le.classes_:
                encoded = le.transform([val_str])[0]
            else:
                encoded = le.transform(["Unknown"])[0]
            cat_vals.append(encoded)
            
        cat_arr = np.array([cat_vals], dtype=np.int64)
        
        X_vec = np.hstack([cont_scaled, cat_arr])
        return X_vec, cont_vals, cat_vals

    def get_risk_tier(self, pd_val: float) -> dict:
        """Maps calibrated probability to risk tier."""
        for min_v, max_v, tier_name, desc in RISK_BANDS:
            if min_v <= pd_val < max_v or (pd_val >= max_v and tier_name == "Critical"):
                return {
                    "tier": tier_name,
                    "range": "[{:.2f}, {:.2f})".format(min_v, max_v),
                    "description": desc
                }
        return {"tier": "Critical", "range": "[0.45, 1.00]", "description": "High probability of default."}

    def generate_explanations(self, X_vec, cleaned_input: dict) -> list:
        """Generates human-readable SHAP explanations."""
        shap_vals = self.explainer.shap_values(X_vec)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]
        vals = shap_vals[0]
        
        feature_order = self.prep["cont_cols"] + self.prep["cat_cols"]
        u_map = self.schema["user_to_model_mapping"]
        
        explanations = []
        for i, m_col in enumerate(feature_order):
            u_col = [k for k, v in u_map.items() if v == m_col][0]
            s_val = float(vals[i])
            human_name = HUMAN_FEATURE_NAMES.get(u_col, u_col)
            user_val = cleaned_input[u_col]
            
            direction = "increases" if s_val > 0 else "decreases"
            impact = "high" if abs(s_val) > 0.1 else ("medium" if abs(s_val) > 0.03 else "low")
            
            statement = "{} ({}) {} estimated default risk".format(human_name, user_val, direction)
            
            explanations.append({
                "feature": u_col,
                "human_feature_name": human_name,
                "feature_value": user_val,
                "shap_value": round(s_val, 6),
                "impact_direction": "positive_risk" if s_val > 0 else "protective",
                "impact_magnitude": impact,
                "statement": statement
            })
            
        # Sort by absolute SHAP magnitude descending
        explanations.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return explanations

    def predict(self, input_data: dict) -> dict:
        """Canonical prediction pipeline method."""
        cleaned = self.validate_input(input_data)
        X_vec, _, _ = self.transform_input(cleaned)
        
        # XGBoost Raw Prob
        raw_pd = float(self.model.predict_proba(X_vec)[0, 1])
        
        # Calibrated Prob
        cal_pd = float(self.calibrator.predict([raw_pd])[0])
        
        # Classification
        pred_class = 1 if cal_pd >= self.threshold else 0
        
        # Risk Tier
        risk_info = self.get_risk_tier(cal_pd)
        
        # SHAP Explanations
        explanations = self.generate_explanations(X_vec, cleaned)
        
        return {
            "model_name": self.metadata["model_name"],
            "model_version": self.metadata["model_version"],
            "calibration_method": self.metadata["calibration_method"],
            "raw_probability": round(raw_pd, 6),
            "calibrated_probability": round(cal_pd, 6),
            "threshold": self.threshold,
            "predicted_class": int(pred_class),
            "prediction_label": "Default" if pred_class == 1 else "Non-Default",
            "risk_tier": risk_info["tier"],
            "risk_tier_description": risk_info["description"],
            "uncertainty_status": "not_available",
            "explanations": explanations
        }


# Singleton instance for fast API reuse
_MODEL_INSTANCE = None

def get_model():
    global _MODEL_INSTANCE
    if _MODEL_INSTANCE is None:
        _MODEL_INSTANCE = ProductionLoanModel()
    return _MODEL_INSTANCE

def predict_loan_risk(input_data: dict) -> dict:
    """Canonical single-entry inference function."""
    model = get_model()
    return model.predict(input_data)
