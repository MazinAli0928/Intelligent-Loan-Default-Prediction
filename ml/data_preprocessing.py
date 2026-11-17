import pandas as pd
import numpy as np

def load_dataset(filepath: str) -> pd.DataFrame:
    """Loads the dataset from the given filepath."""
    return pd.read_csv(filepath, low_memory=False)

def validate_dataset(df: pd.DataFrame) -> None:
    """Validates that expected columns are present."""
    expected_cols = [
        'id', 'issue_d', 'revenue', 'dti_n', 'loan_amnt', 'fico_n', 
        'experience_c', 'emp_length', 'purpose', 'home_ownership_n', 
        'addr_state', 'zip_code', 'Default'
    ]
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns in dataset: {missing}")

def create_target(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validates and maps the target column.
    Removes rows where target is missing.
    """
    if 'Default' not in df.columns:
        raise ValueError("Target column 'Default' not found.")
    
    # Drop rows where target is missing
    df = df.dropna(subset=['Default']).copy()
    
    # Ensure it is numeric 0/1
    df['target'] = df['Default'].astype(int)
    
    return df

def identify_leakage_columns() -> list[str]:
    """
    Returns a list of columns that should be excluded from the model to prevent leakage.
    Reasons:
    - id: Unique identifier, meaningless for prediction.
    - issue_d: Date the loan was issued. This is post-decision temporal leakage. Can be kept for splitting ONLY.
    - Default: The original target variable. Must be dropped to prevent label leakage.
    - title / desc: NLP features intentionally excluded from the primary model for now.
    """
    return ['id', 'issue_d', 'Default', 'title', 'desc']

def clean_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Performs basic deterministic cleaning on features.
    No global scaling or encoding is applied.
    """
    df = df.copy()
    
    # 1. Clean emp_length
    if 'emp_length' in df.columns:
        df['emp_length'] = df['emp_length'].fillna('missing')
    
    # 2. Continuous features: missing values filled with median
    continuous_cols = ['revenue', 'dti_n', 'loan_amnt', 'fico_n', 'experience_c']
    for c in continuous_cols:
        if c in df.columns:
            median_val = df[c].median()
            df[c] = df[c].fillna(median_val)
            
    # 3. Categorical features: fill missing with 'missing'
    categorical_cols = ['purpose', 'home_ownership_n', 'addr_state', 'zip_code']
    for c in categorical_cols:
        if c in df.columns:
            df[c] = df[c].fillna('missing')
            
    return df

def get_model_features() -> list[str]:
    """
    Returns the exact list of application-time features used for the model.
    Note: zip_code, title, desc, and issue_d are EXCLUDED based on requirements.
    Missing requested features (Open Accounts, Total Accounts, Revolving Util, etc.) 
    are omitted because they are not present in the dataset.
    """
    return [
        'loan_amnt',       # Loan Amount
        'revenue',         # Annual Income
        'dti_n',           # DTI
        'emp_length',      # Employment Length
        'home_ownership_n',# Home Ownership
        'fico_n',          # FICO Score
        'experience_c',    # Credit History Length
        'purpose'          # Loan Purpose
    ]

def preprocess_pipeline(filepath: str) -> pd.DataFrame:
    """End-to-end preprocessing."""
    df = load_dataset(filepath)
    validate_dataset(df)
    df = create_target(df)
    df = clean_features(df)
    return df
