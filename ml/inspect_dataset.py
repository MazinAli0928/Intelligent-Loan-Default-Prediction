import pandas as pd
from data_preprocessing import load_dataset, validate_dataset, create_target, clean_features, get_model_features, identify_leakage_columns

def main():
    filepath = '../LC_loans_granting_model_dataset.csv'
    try:
        df = load_dataset(filepath)
    except FileNotFoundError:
        filepath = 'LC_loans_granting_model_dataset.csv'
        df = load_dataset(filepath)

    print("=" * 50)
    print("DATASET INFORMATION")
    print("=" * 50)
    print(f"Number of rows: {len(df)}")
    print(f"Number of columns: {len(df.columns)}")
    print("Column names:", df.columns.tolist())
    print("\nData Types:")
    print(df.dtypes)
    
    print("\n" + "=" * 50)
    print("TARGET")
    print("=" * 50)
    
    df_with_target = create_target(df)
    target_counts = df_with_target['target'].value_counts(dropna=False)
    default_count = target_counts.get(1, 0)
    non_default_count = target_counts.get(0, 0)
    total_valid = default_count + non_default_count
    
    print(f"Class distribution:\n{target_counts}")
    print(f"Default percentage: {default_count / total_valid * 100:.2f}%" if total_valid > 0 else "0%")
    print(f"Missing target count: {len(df) - total_valid}")
    
    print("\n" + "=" * 50)
    print("SELECTED FEATURES")
    print("=" * 50)
    
    features = get_model_features()
    # Also we map the requested 14 features to see which are present
    requested = {
        'Loan Amount': 'loan_amnt',
        'Annual Income': 'revenue',
        'DTI': 'dti_n',
        'Employment Length': 'emp_length',
        'Home Ownership': 'home_ownership_n',
        'FICO Score': 'fico_n',
        'Credit History Length': 'experience_c',
        'Open Accounts': 'N/A',
        'Total Accounts': 'N/A',
        'Revolving Credit Utilization': 'N/A',
        'Recent Credit Inquiries': 'N/A',
        'Previous Delinquencies': 'N/A',
        'Loan Purpose': 'purpose',
        'Loan Term': 'N/A'
    }
    
    print(f"{'Feature':<30} | {'Source Column':<15} | {'Type':<10} | {'Missing %':<10} | {'Used?'}")
    print("-" * 80)
    for feat_name, col in requested.items():
        if col in df.columns:
            dtype = str(df[col].dtype)
            missing_pct = df[col].isna().mean() * 100
            used = "Yes" if col in features else "No"
            print(f"{feat_name:<30} | {col:<15} | {dtype:<10} | {missing_pct:>9.2f}% | {used}")
        else:
            print(f"{feat_name:<30} | {col:<15} | {'---':<10} | {'---':>10} | No (Missing in CSV)")

    print("\n" + "=" * 50)
    print("LEAKAGE & EXCLUDED COLUMNS")
    print("=" * 50)
    leakage = identify_leakage_columns()
    print("Columns excluded:")
    for l in leakage:
        print(f"- {l}")
        
    print("\n" + "=" * 50)
    print("TEMPORAL INFORMATION")
    print("=" * 50)
    if 'issue_d' in df.columns:
        # Assuming issue_d is format like "Dec-2015"
        try:
            df['issue_date_parsed'] = pd.to_datetime(df['issue_d'], format='%b-%Y')
            print(f"Earliest date: {df['issue_date_parsed'].min().strftime('%b-%Y')}")
            print(f"Latest date: {df['issue_date_parsed'].max().strftime('%b-%Y')}")
            print(f"Unique months/years: {df['issue_d'].nunique()}")
        except Exception as e:
            print(f"Could not parse dates: {e}")
            print(f"Unique values: {df['issue_d'].nunique()}")
    
if __name__ == "__main__":
    main()
