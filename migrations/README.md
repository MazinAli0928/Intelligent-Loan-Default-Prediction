# Migrations

The v1 demo creates tables automatically through SQLAlchemy on FastAPI startup. When moving to Postgres or Supabase, add Alembic migrations here and preserve the current entity names:

- `users`, `roles`
- `borrowers`, `loan_applications`
- `predictions`
- `fairness_audits`
- `override_decisions`
- `model_versions`
- `audit_logs`
- `retraining_feedback`
