# Setup

## Backend
1. Create a Python virtual environment in `backend/.venv`.
2. Install `backend/requirements.txt`.
3. Run `uvicorn app.main:app --reload --port 8000` from the `backend` directory.
4. Visit `http://localhost:8000/docs`.

The backend defaults to `sqlite:///./loan_risk_demo.db` and seeds demo records on startup.

## Frontend
1. Run `npm install` in `frontend`.
2. Run `npm run dev`.
3. Visit `http://localhost:3000`.

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` if you want to wire live API calls into future screens.
