# Architecture

The platform is intentionally modular while staying light enough for a portfolio/demo checkout.

## Backend
FastAPI exposes REST endpoints and owns persistence through SQLAlchemy. SQLite is the local default; `DATABASE_URL` can point to Postgres/Supabase later. Tables are seeded on startup when empty.

## ML
The scoring contract returns probability of default, risk tier, confidence, recommendation, and feature contributions. The current implementation is deterministic and explainable, so demos and tests are stable.

## Frontend
Next.js App Router renders a dense enterprise lending portal. The first version uses typed demo data for reliable screens while `lib/api.ts` provides the swap point for live FastAPI calls.

## Governance
Every scoring, override, fairness audit, and model activation writes an audit-log event. Overrides also create retraining feedback records for future model improvement.
