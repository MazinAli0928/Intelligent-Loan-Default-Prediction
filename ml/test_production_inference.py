"""
test_production_inference.py
=============================
Automated test suite and Golden Inference Consistency test for Phase 6.

Tests:
1. Valid input prediction
2. Missing input handling
3. Out-of-range numeric input handling
4. Unknown categorical handling
5. Zero annual income edge case
6. Reproducibility test
7. Model artifact loading test
8. SHAP explanation structure and consistency test
9. Golden Inference Consistency test (training-time vs production-time vector equality)
"""

import sys, os, json, unittest, warnings
from pathlib import Path
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

_THIS = Path(__file__).resolve().parent
_ROOT = _THIS.parent
sys.path.insert(0, str(_THIS))

from production_inference import predict_loan_risk, ProductionLoanModel
from phase45_metrics_runner import load_split, build_arrays

# Standard valid sample
SAMPLE_VALID = {
    "loan_amount": 15000.0,
    "annual_income": 75000.0,
    "dti": 18.5,
    "fico_score": 710.0,
    "credit_history_years": 10.0,
    "employment_length": "10+ years",
    "home_ownership": "MORTGAGE",
    "loan_purpose": "debt_consolidation"
}


class TestProductionInference(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.model_instance = ProductionLoanModel()

    def test_valid_input(self):
        res = predict_loan_risk(SAMPLE_VALID)
        self.assertEqual(res["model_name"], "XGBoost")
        self.assertEqual(res["model_version"], "1.0")
        self.assertIn(res["predicted_class"], [0, 1])
        self.assertIn(res["risk_tier"], ["Low", "Moderate", "High", "Critical"])
        self.assertEqual(res["uncertainty_status"], "not_available")
        self.assertGreaterEqual(res["raw_probability"], 0.0)
        self.assertLessEqual(res["raw_probability"], 1.0)
        self.assertGreaterEqual(res["calibrated_probability"], 0.0)
        self.assertLessEqual(res["calibrated_probability"], 1.0)
        self.assertEqual(len(res["explanations"]), 8)

    def test_missing_input(self):
        sample = SAMPLE_VALID.copy()
        del sample["dti"]
        with self.assertRaises(ValueError) as ctx:
            predict_loan_risk(sample)
        self.assertIn("Missing required input features", str(ctx.exception))

    def test_invalid_numeric_range(self):
        sample = SAMPLE_VALID.copy()
        sample["fico_score"] = 950.0  # Invalid FICO > 850
        with self.assertRaises(ValueError) as ctx:
            predict_loan_risk(sample)
        self.assertIn("out of acceptable range", str(ctx.exception))

    def test_unknown_category(self):
        sample = SAMPLE_VALID.copy()
        sample["home_ownership"] = "CASTLE"
        with self.assertRaises(ValueError) as ctx:
            predict_loan_risk(sample)
        self.assertIn("Unknown categorical value", str(ctx.exception))

    def test_zero_income(self):
        sample = SAMPLE_VALID.copy()
        sample["annual_income"] = 0.0
        res = predict_loan_risk(sample)
        self.assertGreaterEqual(res["calibrated_probability"], 0.0)
        self.assertIn(res["predicted_class"], [0, 1])

    def test_reproducibility(self):
        res1 = predict_loan_risk(SAMPLE_VALID)
        res2 = predict_loan_risk(SAMPLE_VALID)
        self.assertEqual(res1["raw_probability"], res2["raw_probability"])
        self.assertEqual(res1["calibrated_probability"], res2["calibrated_probability"])
        self.assertEqual(res1["predicted_class"], res2["predicted_class"])
        self.assertEqual(res1["risk_tier"], res2["risk_tier"])

    def test_shap_explanation_consistency(self):
        res = predict_loan_risk(SAMPLE_VALID)
        exps = res["explanations"]
        self.assertEqual(len(exps), 8)
        for e in exps:
            self.assertIn("feature", e)
            self.assertIn("human_feature_name", e)
            self.assertIn("shap_value", e)
            self.assertIn("impact_direction", e)
            self.assertIn("statement", e)
            
        # Verify FICO score high (710) is protective
        fico_exp = [e for e in exps if e["feature"] == "fico_score"][0]
        self.assertEqual(fico_exp["impact_direction"], "protective")

    def test_golden_inference_consistency(self):
        """Proves training-time preprocessing and production-time preprocessing match exactly."""
        tr, va, te = load_split()
        a_base = build_arrays(tr, va, te, "base")
        
        # Pick row 0 from Test set
        test_row = te.iloc[0]
        
        # Map row columns to user inputs
        golden_user_input = {
            "loan_amount": float(test_row["loan_amnt"]),
            "annual_income": float(test_row["revenue"]),
            "dti": float(test_row["dti_n"]),
            "fico_score": float(test_row["fico_n"]),
            "credit_history_years": float(test_row["experience_c"]),
            "employment_length": str(test_row["emp_length"]),
            "home_ownership": str(test_row["home_ownership_n"]),
            "loan_purpose": str(test_row["purpose"])
        }
        
        # 1. Training-time vector representation
        X_training = a_base["Xtec"][0:1] # Continuous scaled
        X_cat_training = a_base["Xte_cat"][0:1]
        vec_training = np.hstack([X_training, X_cat_training])
        
        # 2. Production-time vector representation
        cleaned = self.model_instance.validate_input(golden_user_input)
        vec_prod, _, _ = self.model_instance.transform_input(cleaned)
        
        # Assert exact vector equivalence
        np.testing.assert_allclose(vec_training, vec_prod, rtol=1e-5, atol=1e-5,
                                   err_msg="Training and production preprocessing vectors do NOT match!")
                                   
        # Predict using canonical pipeline
        res = predict_loan_risk(golden_user_input)
        
        golden_artifact = {
            "test_case_description": "Golden Borrower Case from Test Set Row 0",
            "input": golden_user_input,
            "transformed_vector_training": vec_training.tolist(),
            "transformed_vector_production": vec_prod.tolist(),
            "preprocessing_vector_match": True,
            "expected_raw_probability": res["raw_probability"],
            "expected_calibrated_probability": res["calibrated_probability"],
            "expected_predicted_class": res["predicted_class"],
            "expected_risk_tier": res["risk_tier"]
        }
        
        out_path = _ROOT / "results" / "golden_inference_test.json"
        with open(out_path, "w") as f:
            json.dump(golden_artifact, f, indent=2)
            
        print("\n  [OK] Golden Inference Consistency Test Passed. Saved to results/golden_inference_test.json")


def run_all_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestProductionInference)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()


if __name__ == "__main__":
    success = run_all_tests()
    if not success:
        sys.exit(1)
