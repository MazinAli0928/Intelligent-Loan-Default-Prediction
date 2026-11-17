# Enterprise AI Loan Default Risk Platform

Greenfield full-stack demo for AI-powered loan default prediction, explainability, fairness auditing, override workflows, PDF reports, and model governance.

## Quick Start (One Click)

Double-click **`start.bat`** in the project root to automatically launch both the backend and frontend servers, then open the portal in your browser.

Or run manually:

**Backend:**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` for the portal and `http://localhost:8000/docs` for the interactive API docs.

---

## Demo Credentials

All demo accounts use the password: **`password123`**

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Lender Analyst** | `analyst@demo.local` | `password123` | Create & approve loans, score applications, view reports |
| **Compliance Officer** | `compliance@demo.local` | `password123` | View dashboard, run fairness audits, read audit logs |
| **Admin** | `admin@demo.local` | `password123` | Full access to all features and settings |

> **Note:** The login page has quick-fill buttons for each role — just click and sign in.

---

## Role-Based Access Control (RBAC)

| Feature | Lender Analyst | Compliance Officer | Admin |
|---------|:--------------:|:------------------:|:-----:|
| View Dashboard | ✅ | ✅ | ✅ |
| Create Applications | ✅ | ❌ | ✅ |
| Score Applications | ✅ | ❌ | ✅ |
| Approve / Reject Loans | ✅ | ❌ | ✅ |
| Override Decisions | ✅ | ❌ | ✅ |
| Run Fairness Audits | ❌ | ✅ | ✅ |
| View Reports | ✅ | ✅ | ✅ |
| Admin Settings | ❌ | ❌ | ✅ |

---

## What Is Included

- `backend/` — FastAPI service with SQLite storage, seeded records, scoring, fairness audits, overrides, reports, and model registry.
- `frontend/` — Next.js enterprise portal with command center, application queue, borrower 360, scoring, fairness, reports, model governance, and admin settings.
- `ml/` — Deterministic demo scoring and pipeline notes (replaceable with a trained Home Credit model).
- `seed/` — Realistic NBFC-style borrower/application seed data.
- `docs/` — Setup, API, architecture, and dataset replacement notes.
- `start.bat` — One-click launcher for the full platform.
