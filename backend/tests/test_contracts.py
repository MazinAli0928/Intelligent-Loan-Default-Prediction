from fastapi.testclient import TestClient

from app.main import app
from app.scoring import score_application
from app.database import Base, engine, get_db
from app.seed_data import seed_database

# Create and seed test database tables
Base.metadata.create_all(bind=engine)
with next(get_db()) as db:
    seed_database(db)

client = TestClient(app)


def test_login_and_dashboard_contract():
    response = client.post("/login", json={"email": "analyst@demo.local", "password": "password123"})
    assert response.status_code == 200
    token = response.json()["token"]

    dashboard = client.get("/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert dashboard.status_code == 200
    payload = dashboard.json()
    assert payload["total_applications"] >= 4
    assert set(payload["risk_distribution"]) == {"low", "medium", "high", "critical"}


def test_scoring_explanation_and_report_contract():
    login = client.post("/login", json={"email": "analyst@demo.local", "password": "password123"}).json()
    headers = {"Authorization": f"Bearer {login['token']}"}

    scored = client.post("/applications/1/score", headers=headers)
    assert scored.status_code == 200
    prediction = scored.json()
    assert 0 <= prediction["probability_default"] <= 1
    assert prediction["risk_tier"] in {"low", "medium", "high", "critical"}
    assert prediction["explanation"]

    explanation = client.get(f"/predictions/{prediction['id']}/explanation", headers=headers)
    assert explanation.status_code == 200
    assert explanation.json()["top_drivers"]

    report = client.get("/reports/1.pdf", headers=headers)
    assert report.status_code == 200
    assert report.headers["content-type"] == "application/pdf"
    assert report.content.startswith(b"%PDF")


def test_fairness_and_override_contract():
    login = client.post("/login", json={"email": "compliance@demo.local", "password": "password123"}).json()
    headers = {"Authorization": f"Bearer {login['token']}"}

    audit = client.post("/fairness/audits/run", headers=headers)
    assert audit.status_code == 200
    metrics = audit.json()["metrics"]
    assert "demographic_parity_gap" in metrics
    assert "groups" in metrics

    # Overrides can only be performed by Lender Analyst or Admin roles
    lender_login = client.post("/login", json={"email": "analyst@demo.local", "password": "password123"}).json()
    lender_headers = {"Authorization": f"Bearer {lender_login['token']}"}

    override = client.post(
        "/applications/2/override",
        headers=lender_headers,
        json={
            "decision": "manual_review",
            "reason_code": "AFFORDABILITY_REVIEW",
            "notes": "Escalated due to high repayment pressure and business cash-flow volatility.",
        },
    )
    assert override.status_code == 200
    assert override.json()["reason_code"] == "AFFORDABILITY_REVIEW"
