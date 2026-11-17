# API Contract

## Auth
- `POST /auth/login`: accepts `{ "email": "analyst@demo.local" }` and returns a demo bearer token.
- `GET /me`: returns user, role, and permissions.

## Portfolio
- `GET /dashboard/summary`
- `GET /borrowers`
- `POST /borrowers`
- `GET /borrowers/{id}`
- `GET /applications`
- `POST /applications`
- `GET /applications/{id}`

## Risk Workflow
- `POST /applications/{id}/score`: creates a prediction with probability of default, tier, confidence, recommendation, and feature drivers.
- `GET /predictions/{id}/explanation`: returns SHAP-style driver data and lender narrative.
- `POST /applications/{id}/override`: records a reviewer decision and retraining feedback signal.
- `GET /reports/{application_id}.pdf`: returns a generated PDF risk report.

## Governance
- `GET /fairness/audits`
- `POST /fairness/audits/run`
- `GET /models`
- `POST /models/{id}/activate`
