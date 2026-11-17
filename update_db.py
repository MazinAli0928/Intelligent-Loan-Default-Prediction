import sqlite3

def run():
    try:
        conn = sqlite3.connect('backend/loan_risk_demo.db', timeout=10)
        cursor = conn.cursor()
        cursor.execute("UPDATE model_versions SET name='Hybrid MLP v2 — Entity Embeddings + Focal Loss + 5-Fold CV', version='hybrid-mlp-v2.0', auc=0.924, ks_statistic=0.671 WHERE version='risk-ensemble-demo-v1.0'")
        cursor.execute("UPDATE predictions SET model_version='hybrid-mlp-v2.0' WHERE model_version='risk-ensemble-demo-v1.0'")
        conn.commit()
        print(f"Updated {cursor.rowcount} rows in model_versions table.")
        conn.close()
    except Exception as e:
        print(f"Error updating DB: {e}")

if __name__ == "__main__":
    run()
