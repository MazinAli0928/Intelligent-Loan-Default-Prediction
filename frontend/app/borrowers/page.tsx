"use client";

import { useEffect, useState } from "react";
import { DriverChart } from "@/components/driver-chart";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch } from "@/lib/api";
import { currency } from "@/lib/mock-data";
import { Loader2, Users } from "lucide-react";

interface Borrower {
  id: number;
  full_name: string;
  age: number;
  city: string;
  state: string;
  segment: string;
  gender: string;
  monthly_income: number;
  monthly_expenses: number;
  credit_score: number;
  employment_years: number;
  existing_loans: number;
  alternative_signals: Record<string, any>;
  created_at: string;
}

interface Application {
  id: number;
  borrower_id: number;
  product: string;
  amount: number;
  tenure_months: number;
  purpose: string;
  status: string;
  assigned_reviewer: string;
  channel: string;
}

interface Prediction {
  id: number;
  application_id: number;
  probability_default: number;
  risk_tier: string;
  confidence: number;
  recommendation: string;
  explanation: Array<{
    feature: string;
    label: string;
    value: string;
    contribution: number;
    direction: string;
  }>;
  narrative: string;
}

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<number | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [borrowerApplications, setBorrowerApplications] = useState<Application[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPred, setLoadingPred] = useState(false);

  useEffect(() => {
    const loadBorrowers = async () => {
      try {
        const res = await apiFetch<any>("/borrowers?size=100");
        const list: Borrower[] = Array.isArray(res) ? res : (res?.items ?? []);
        setBorrowers(list);
        if (list.length > 0) {
          setSelectedBorrowerId(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load borrowers list", err);
        setLoading(false);
      }
    };
    loadBorrowers();
  }, []);

  useEffect(() => {
    if (!selectedBorrowerId) return;

    const loadBorrowerDetails = async () => {
      setLoading(true);
      try {
        // Fetch borrower details
        const details = await apiFetch<Borrower>(`/borrowers/${selectedBorrowerId}`);
        setSelectedBorrower(details);

        // Fetch all applications and filter
        const appsRes = await apiFetch<any>("/applications?size=100");
        const apps: Application[] = Array.isArray(appsRes) ? appsRes : (appsRes?.items ?? []);
        const bApps = apps.filter((app) => app.borrower_id === selectedBorrowerId);
        setBorrowerApplications(bApps);

        // Reset prediction before loading new one
        setLatestPrediction(null);

        // If borrower has applications, try to get prediction of the latest application
        if (bApps.length > 0) {
          setLoadingPred(true);
          const latestApp = bApps[0]; // Application table API orders desc by created_at
          try {
            const pred = await apiFetch<Prediction>(`/applications/${latestApp.id}/prediction`);
            setLatestPrediction(pred);
          } catch (predErr) {
            // It's normal to not have predictions if the application hasn't been scored yet
            console.log("No predictions found for this borrower's latest application");
          } finally {
            setLoadingPred(false);
          }
        }
      } catch (err) {
        console.error("Failed to load borrower details", err);
      } finally {
        setLoading(false);
      }
    };

    loadBorrowerDetails();
  }, [selectedBorrowerId]);

  if (loading && borrowers.length === 0) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <Loader2 size={40} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (borrowers.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h3>No Borrowers Found</h3>
        <p className="muted">Create a borrower in the Applications tab to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ alignItems: "center" }}>
        <div>
          <h2>Borrower 360</h2>
          <p>Financial profile, affordability, alternative signals, and risk history.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Users size={18} style={{ color: "var(--muted)" }} />
          <select 
            className="select" 
            value={selectedBorrowerId || ""}
            onChange={(e) => setSelectedBorrowerId(Number(e.target.value))}
            style={{ minWidth: 220 }}
          >
            {borrowers.map((b) => (
              <option key={b.id} value={b.id}>{b.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedBorrower && (
        <>
          <section className="split">
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{selectedBorrower.full_name}</h3>
                {latestPrediction ? (
                  <RiskBadge value={latestPrediction.risk_tier} />
                ) : (
                  <span className="badge submitted">Unscored</span>
                )}
              </div>
              <div className="grid cols-3" style={{ marginTop: 16 }}>
                <div><span className="muted" style={{ fontSize: 11 }}>Location</span><strong style={{ display: "block" }}>{selectedBorrower.city}, {selectedBorrower.state}</strong></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Segment</span><strong style={{ display: "block" }}>{selectedBorrower.segment.replace("_", " ")}</strong></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Credit score</span><strong style={{ display: "block" }}>{selectedBorrower.credit_score}</strong></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Income</span><strong style={{ display: "block" }}>{currency.format(selectedBorrower.monthly_income)}</strong></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Expenses</span><strong style={{ display: "block" }}>{currency.format(selectedBorrower.monthly_expenses)}</strong></div>
                <div><span className="muted" style={{ fontSize: 11 }}>Existing loans</span><strong style={{ display: "block" }}>{selectedBorrower.existing_loans}</strong></div>
              </div>
            </div>
            <div className="panel">
              <h3>Alternative Signals</h3>
              <div className="stat-list">
                {selectedBorrower.alternative_signals && Object.keys(selectedBorrower.alternative_signals).length > 0 ? (
                  Object.entries(selectedBorrower.alternative_signals).map(([key, value]) => (
                    <div key={key}>
                      <span style={{ textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
                      <strong>{Math.round((value as number) * 100)}%</strong>
                    </div>
                  ))
                ) : (
                  <div className="muted" style={{ padding: "8px 0" }}>No alternative bureau signals stored.</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid cols-2" style={{ marginTop: 14 }}>
            <div className="panel">
              <h3>Score Explanation</h3>
              {loadingPred ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                  <Loader2 className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : latestPrediction ? (
                <>
                  <p style={{ fontSize: 13, marginBottom: 14 }}>{latestPrediction.narrative}</p>
                  <DriverChart drivers={latestPrediction.explanation} />
                </>
              ) : (
                <div className="muted" style={{ padding: "14px 0", textAlign: "center" }}>
                  Please score this borrower's application in the dashboard to generate explainability drivers.
                </div>
              )}
            </div>
            
            <div className="table-wrap">
              <div className="table-tools"><h3>Application History</h3></div>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowerApplications.length > 0 ? (
                    borrowerApplications.map((application) => (
                      <tr key={application.id}>
                        <td>{application.product}</td>
                        <td>{currency.format(application.amount)}</td>
                        <td><RiskBadge value={application.status} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="muted" style={{ textAlign: "center", padding: 16 }}>
                        No application logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
