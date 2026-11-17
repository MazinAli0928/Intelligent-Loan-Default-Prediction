"use client";

import { useEffect, useState } from "react";
import { FileDown, Search, Calculator, ShieldAlert, Plus, X, Loader2, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RiskBadge } from "./risk-badge";
import { currency } from "@/lib/mock-data";

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
  created_at: string;
  updated_at: string;
  borrower: Borrower;
}

export function ApplicationTable() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);

  // Form states
  const [createMode, setCreateMode] = useState<"existing" | "new">("existing");
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [newBorrower, setNewBorrower] = useState({
    full_name: "",
    age: 30,
    city: "",
    state: "",
    segment: "salaried_prime",
    gender: "male",
    monthly_income: 50000,
    monthly_expenses: 20000,
    credit_score: 700,
    employment_years: 3,
    existing_loans: 0
  });
  const [newApp, setNewApp] = useState({
    product: "Personal Loan",
    amount: 100000,
    tenure_months: 12,
    purpose: "",
    channel: "branch",
    assigned_reviewer: "Unassigned"
  });

  // Override Form state
  const [overrideData, setOverrideData] = useState({
    decision: "approve",
    reason_code: "CREDIT_POLICY_EXCEPTION",
    notes: ""
  });

  const [canCreateApp, setCanCreateApp] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadData = async (pageNo = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const userProfile = await apiFetch<any>("/me").catch(() => null);
      if (userProfile && ["Lender Analyst", "Admin"].includes(userProfile.role.name)) {
        setCanCreateApp(true);
      } else {
        setCanCreateApp(false);
      }
      
      const appRes = await apiFetch<any>(`/applications?page=${pageNo}&size=10`);
      if (appRes && appRes.items) {
        setApplications(appRes.items);
        setPage(appRes.page);
        setTotalPages(appRes.pages);
        setTotalRecords(appRes.total);
      } else if (Array.isArray(appRes)) {
        setApplications(appRes);
      }

      const borrowerRes = await apiFetch<any>("/borrowers?page=1&size=100");
      const borrowerList = borrowerRes?.items || borrowerRes || [];
      setBorrowers(borrowerList);
      if (borrowerList.length > 0 && !selectedBorrowerId) {
        setSelectedBorrowerId(borrowerList[0].id.toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, search);
  }, []);

  const handleScore = async (id: number) => {
    try {
      await apiFetch(`/applications/${id}/score`, { method: "POST" });
      await loadData();
    } catch (err) {
      alert("Failed to score application: " + err);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let bId = selectedBorrowerId;
      if (createMode === "new") {
        const createdB = await apiFetch<Borrower>("/borrowers", {
          method: "POST",
          body: JSON.stringify(newBorrower)
        });
        bId = createdB.id.toString();
      }

      await apiFetch("/applications", {
        method: "POST",
        body: JSON.stringify({
          borrower_id: parseInt(bId),
          ...newApp
        })
      });

      setShowCreateModal(false);
      // Reset forms
      setNewBorrower({
        full_name: "",
        age: 30,
        city: "",
        state: "",
        segment: "salaried_prime",
        gender: "male",
        monthly_income: 50000,
        monthly_expenses: 20000,
        credit_score: 700,
        employment_years: 3,
        existing_loans: 0
      });
      setNewApp({
        product: "Personal Loan",
        amount: 100000,
        tenure_months: 12,
        purpose: "",
        channel: "branch",
        assigned_reviewer: "Unassigned"
      });
      await loadData();
    } catch (err) {
      alert("Failed to create application: " + err);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) return;
    try {
      await apiFetch(`/applications/${selectedAppId}/override`, {
        method: "POST",
        body: JSON.stringify(overrideData)
      });
      setShowOverrideModal(false);
      setSelectedAppId(null);
      setOverrideData({
        decision: "approve",
        reason_code: "CREDIT_POLICY_EXCEPTION",
        notes: ""
      });
      await loadData();
    } catch (err: any) {
      alert("Override submission failed: " + err.message);
    }
  };

  const filteredApps = applications.filter((app) => {
    const query = search.toLowerCase();
    return (
      app.borrower?.full_name.toLowerCase().includes(query) ||
      app.product.toLowerCase().includes(query) ||
      app.assigned_reviewer.toLowerCase().includes(query) ||
      app.status.toLowerCase().includes(query)
    );
  });

  if (loading && applications.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Loader2 size={32} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <section className="table-wrap" style={{ position: "relative" }}>
      <div className="table-tools">
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 280 }}>
          <Search size={16} aria-hidden="true" style={{ color: "var(--muted)" }} />
          <input 
            className="search" 
            placeholder="Search borrower, product, status..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canCreateApp && (
            <button className="button primary" type="button" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} aria-hidden="true" />
              New Application
            </button>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Borrower</th>
            <th>Product</th>
            <th>Amount</th>
            <th>Term</th>
            <th>Status</th>
            <th>Reviewer</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredApps.length > 0 ? (
            filteredApps.map((application) => {
              const needsScoring = application.status === "submitted";
              const isManualReview = application.status === "manual_review";
              return (
                <tr key={application.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{application.borrower?.full_name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>Bureau Score: {application.borrower?.credit_score}</div>
                  </td>
                  <td>{application.product}</td>
                  <td>{currency.format(application.amount)}</td>
                  <td>{application.tenure_months}m</td>
                  <td>
                    <RiskBadge value={application.status} />
                  </td>
                  <td>{application.assigned_reviewer}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {needsScoring && (
                        <button 
                          className="button primary" 
                          onClick={() => handleScore(application.id)} 
                          style={{ minHeight: 30, padding: "4px 8px", fontSize: 12 }}
                        >
                          <Calculator size={14} /> Score
                        </button>
                      )}
                      {canCreateApp && (isManualReview || application.status === "scored") && (
                        <button 
                          className="button" 
                          onClick={() => {
                            setSelectedAppId(application.id);
                            setShowOverrideModal(true);
                          }} 
                          style={{ minHeight: 30, padding: "4px 8px", fontSize: 12, borderColor: isManualReview ? "var(--risk-medium)" : "var(--border)", color: isManualReview ? "var(--risk-medium)" : "var(--foreground)" }}
                        >
                          <ShieldAlert size={14} /> {isManualReview ? "Override" : "Review"}
                        </button>
                      )}
                      <a 
                        className="button ghost" 
                        href={`http://localhost:8000/reports/${application.id}.pdf`}
                        style={{ minHeight: 30, padding: "4px 8px" }}
                        title="Download Risk Report PDF"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                No applications matching filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Server-Side Pagination Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalRecords} total applications)
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="button ghost"
            disabled={page <= 1}
            onClick={() => loadData(page - 1, search)}
            style={{ fontSize: 12, padding: "4px 12px", minHeight: 30 }}
          >
            ← Previous
          </button>
          <button
            className="button ghost"
            disabled={page >= totalPages}
            onClick={() => loadData(page + 1, search)}
            style={{ fontSize: 12, padding: "4px 12px", minHeight: 30 }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Modal - Create Borrower & Application */}
      {showCreateModal && (
        <div style={modalOverlayStyle}>
          <div className="panel" style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Create New Loan Entry</h3>
              <button onClick={() => setShowCreateModal(false)} style={modalCloseBtnStyle}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateApplication}>
              <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" checked={createMode === "existing"} onChange={() => setCreateMode("existing")} />
                  Use Seeded Borrower
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" checked={createMode === "new"} onChange={() => setCreateMode("new")} />
                  Create New Borrower
                </label>
              </div>

              {createMode === "existing" ? (
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Select Borrower</label>
                  <select 
                    className="select" 
                    value={selectedBorrowerId}
                    onChange={(e) => setSelectedBorrowerId(e.target.value)}
                  >
                    {borrowers.map((b) => (
                      <option key={b.id} value={b.id}>{b.full_name} (Bureau: {b.credit_score})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-grid" style={{ marginBottom: 14 }}>
                  <div className="field">
                    <label>Borrower Full Name</label>
                    <input className="input" required value={newBorrower.full_name} onChange={(e) => setNewBorrower({...newBorrower, full_name: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Age</label>
                    <input className="input" type="number" min={18} max={80} required value={newBorrower.age} onChange={(e) => setNewBorrower({...newBorrower, age: parseInt(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input className="input" required value={newBorrower.city} onChange={(e) => setNewBorrower({...newBorrower, city: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input className="input" required value={newBorrower.state} onChange={(e) => setNewBorrower({...newBorrower, state: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>Monthly Income ($)</label>
                    <input className="input" type="number" min={1} required value={newBorrower.monthly_income} onChange={(e) => setNewBorrower({...newBorrower, monthly_income: parseFloat(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Monthly Expenses ($)</label>
                    <input className="input" type="number" min={0} required value={newBorrower.monthly_expenses} onChange={(e) => setNewBorrower({...newBorrower, monthly_expenses: parseFloat(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Credit Score (FICO)</label>
                    <input className="input" type="number" min={300} max={850} required value={newBorrower.credit_score} onChange={(e) => setNewBorrower({...newBorrower, credit_score: parseInt(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Employment Years</label>
                    <input className="input" type="number" step="0.1" min={0} required value={newBorrower.employment_years} onChange={(e) => setNewBorrower({...newBorrower, employment_years: parseFloat(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Existing Loan Counts</label>
                    <input className="input" type="number" min={0} required value={newBorrower.existing_loans} onChange={(e) => setNewBorrower({...newBorrower, existing_loans: parseInt(e.target.value)})} />
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select className="select" value={newBorrower.gender} onChange={(e) => setNewBorrower({...newBorrower, gender: e.target.value})}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "14px 0" }} />
              <h4>Loan Parameters</h4>
              
              <div className="form-grid" style={{ marginTop: 10 }}>
                <div className="field">
                  <label>Product</label>
                  <select className="select" value={newApp.product} onChange={(e) => setNewApp({...newApp, product: e.target.value})}>
                    <option>MSME Working Capital</option>
                    <option>Personal Loan</option>
                    <option>Home Improvement Loan</option>
                    <option>Equipment Finance</option>
                  </select>
                </div>
                <div className="field">
                  <label>Loan Amount ($)</label>
                  <input className="input" type="number" min={1} required value={newApp.amount} onChange={(e) => setNewApp({...newApp, amount: parseFloat(e.target.value)})} />
                </div>
                <div className="field">
                  <label>Tenure (Months)</label>
                  <input className="input" type="number" min={3} max={360} required value={newApp.tenure_months} onChange={(e) => setNewApp({...newApp, tenure_months: parseInt(e.target.value)})} />
                </div>
                <div className="field">
                  <label>Purpose</label>
                  <input className="input" required value={newApp.purpose} onChange={(e) => setNewApp({...newApp, purpose: e.target.value})} placeholder="e.g. inventory purchase" />
                </div>
                <div className="field">
                  <label>Assign Reviewer</label>
                  <input className="input" value={newApp.assigned_reviewer} onChange={(e) => setNewApp({...newApp, assigned_reviewer: e.target.value})} placeholder="e.g. Asha Mehta" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                <button className="button" type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="button primary" type="submit">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Compliance Override */}
      {showOverrideModal && (
        <div style={modalOverlayStyle}>
          <div className="panel" style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>Compliance Manual Override</h3>
              <button onClick={() => setShowOverrideModal(false)} style={modalCloseBtnStyle}><X size={18} /></button>
            </div>
            <form onSubmit={handleOverrideSubmit}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Review Decision</label>
                <select 
                  className="select"
                  value={overrideData.decision}
                  onChange={(e) => setOverrideData({...overrideData, decision: e.target.value})}
                >
                  <option value="approve">Approve (Force Pass)</option>
                  <option value="reject">Reject (Force Decline)</option>
                  <option value="manual_review">Keep in Review</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Reason Code</label>
                <input 
                  className="input" 
                  required 
                  minLength={3}
                  value={overrideData.reason_code}
                  onChange={(e) => setOverrideData({...overrideData, reason_code: e.target.value.toUpperCase()})}
                  placeholder="e.g. COLLATERAL_STRIP_CONFIRMED"
                />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Lender Notes / Justification</label>
                <textarea 
                  className="textarea" 
                  required 
                  minLength={8}
                  value={overrideData.notes}
                  onChange={(e) => setOverrideData({...overrideData, notes: e.target.value})}
                  placeholder="Provide details for credit policy exception..."
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                <button className="button" type="button" onClick={() => setShowOverrideModal(false)}>Cancel</button>
                <button className="button primary" type="submit">Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// Simple overlay CSS styles
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(16, 24, 40, 0.4)",
  backdropFilter: "blur(4px)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: 16
};

const modalContentStyle: React.CSSProperties = {
  width: "min(600px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 24px -4px rgba(16, 24, 40, 0.1), 0 8px 8px -4px rgba(16, 24, 40, 0.04)"
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid var(--line)",
  paddingBottom: 10,
  marginBottom: 14
};

const modalCloseBtnStyle: React.CSSProperties = {
  border: "0",
  background: "none",
  cursor: "pointer",
  color: "var(--muted)",
  padding: 4
};
