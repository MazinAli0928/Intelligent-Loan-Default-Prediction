# Dataset Replacement Guide

The v1 app does not require the full Home Credit dataset. To replace demo scoring with trained artifacts:

1. Add raw data outside Git or in a governed storage bucket.
2. Create preprocessing that maps source columns into the stable application feature contract.
3. Train candidate models and save metadata: version, AUC, KS statistic, training window, protected attributes, and approval state.
4. Replace the deterministic scorer behind `backend/app/scoring.py` while preserving the API response shape.
5. Run fairness audits before activating a new model version.
6. Register the approved model in `model_versions` and activate through `POST /models/{id}/activate`.

Do not change public prediction fields unless frontend and report contracts are updated together.
