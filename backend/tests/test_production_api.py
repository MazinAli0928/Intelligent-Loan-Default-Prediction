"""
test_production_api.py
======================
Automated API tests for Phase 7 FastAPI production endpoint: POST /api/predict

Tests:
1. Valid request (HTTP 200)
2. Missing field (HTTP 422)
3. Invalid numeric value out of range (HTTP 422)
4. Unknown category (HTTP 422)
5. Production consistency (API prediction matches predict_loan_risk)
6. Probability validity (0 <= calibrated_probability <= 1)
7. Threshold consistency (calibrated_pd >= threshold -> decision Decline / predicted_class 1)
8. Model version (model_version == "v1.0")
9. SHAP consistency (risk_factors, protective_factors, shap_explanations returned)
10. Error handling (no stack traces or internal paths leaked to client on errors)
"""

import sys, os, unittest
from pathlib import Path
from fastapi.testclient import TestClient

_THIS = Path(__file__).resolve().parent
_BACKEND = _THIS.parent
_ROOT = _BACKEND.parent

if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.main import app
from ml.production_inference import predict_loan_risk

client = TestClient(app)

SAMPLE_USER_INPUT = {
    "loan_amount": 15000.0,
    "annual_income": 75000.0,
    "dti": 18.5,
    "fico_score": 710.0,
    "credit_history_years": 10.0,
    "employment_length": "10+ years",
    "home_ownership": "MORTGAGE",
    "loan_purpose": "debt_consolidation"
}

SAMPLE_ALIAS_INPUT = {
    "loan_amnt": 15000.0,
    "revenue": 75000.0,
    "dti_n": 18.5,
    "fico_n": 710.0,
    "experience_c": 10.0,
    "emp_length": "10+ years",
    "home_ownership_n": "MORTGAGE",
    "purpose": "debt_consolidation"
}


class TestProductionAPI(unittest.TestCase):

    def test_1_valid_request(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_name"], "XGBoost")
        self.assertEqual(data["model_version"], "v1.0")
        self.assertIn(data["predicted_class"], [0, 1])
        self.assertIn(data["decision"], ["Approve", "Decline"])
        self.assertIn(data["risk_tier"], ["Low", "Moderate", "High", "Critical"])
        self.assertEqual(data["uncertainty_status"], "not_available")

    def test_1b_valid_alias_request(self):
        response = client.post("/api/predict", json=SAMPLE_ALIAS_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_version"], "v1.0")

    def test_2_missing_field(self):
        bad_input = SAMPLE_USER_INPUT.copy()
        del bad_input["dti"]
        response = client.post("/api/predict", json=bad_input)
        self.assertEqual(response.status_code, 422)

    def test_3_invalid_numeric_range(self):
        bad_input = SAMPLE_USER_INPUT.copy()
        bad_input["fico_score"] = 999.0  # Invalid > 850
        response = client.post("/api/predict", json=bad_input)
        self.assertEqual(response.status_code, 422)

    def test_4_unknown_category(self):
        bad_input = SAMPLE_USER_INPUT.copy()
        bad_input["home_ownership"] = "PENTHOUSE"
        response = client.post("/api/predict", json=bad_input)
        self.assertEqual(response.status_code, 422)

    def test_5_production_consistency(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        api_data = response.json()
        
        direct_data = predict_loan_risk(SAMPLE_USER_INPUT)
        
        self.assertEqual(api_data["raw_probability"], direct_data["raw_probability"])
        self.assertEqual(api_data["calibrated_probability"], direct_data["calibrated_probability"])
        self.assertEqual(api_data["predicted_class"], direct_data["predicted_class"])
        self.assertEqual(api_data["risk_tier"], direct_data["risk_tier"])

    def test_6_probability_validity(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(0.0 <= data["raw_probability"] <= 1.0)
        self.assertTrue(0.0 <= data["calibrated_probability"] <= 1.0)

    def test_7_threshold_consistency(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        cal_pd = data["calibrated_probability"]
        thr = data["threshold"]
        
        if cal_pd >= thr:
            self.assertEqual(data["predicted_class"], 1)
            self.assertEqual(data["decision"], "Decline")
        else:
            self.assertEqual(data["predicted_class"], 0)
            self.assertEqual(data["decision"], "Approve")

    def test_8_model_version(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_version"], "v1.0")

    def test_9_shap_consistency(self):
        response = client.post("/api/predict", json=SAMPLE_USER_INPUT)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("shap_explanations", data)
        self.assertEqual(len(data["shap_explanations"]), 8)
        self.assertIn("risk_factors", data)
        self.assertIn("protective_factors", data)

    def test_10_error_handling_security(self):
        bad_input = SAMPLE_USER_INPUT.copy()
        bad_input["loan_amount"] = -500.0  # Invalid negative
        response = client.post("/api/predict", json=bad_input)
        self.assertEqual(response.status_code, 422)
        err_msg = str(response.json())
        self.assertNotIn("Traceback", err_msg)
        self.assertNotIn("models/production", err_msg)
        self.assertNotIn("C:\\", err_msg)


if __name__ == "__main__":
    unittest.main()
