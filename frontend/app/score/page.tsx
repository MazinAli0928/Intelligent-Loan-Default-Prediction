"use client";

import { useState } from "react";
import { predictLoanRisk } from "@/lib/api";
import type {
  ProductionPredictRequest,
  ProductionPredictResponse,
  ProductionSHAPExplanation,
} from "@/lib/types";
import { DriverChart } from "@/components/driver-chart";
import { 
  Calculator, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  HelpCircle,
  BarChart3,
  DollarSign,
  Briefcase,
  Percent,
  Award,
  Calendar,
  Home,
  Tag,
  RefreshCw
} from "lucide-react";

// ?? Constants ?????????????????????????????????????????????????????????????

const EMP_LENGTH_OPTIONS = [
  "< 1 year", "1 year", "2 years", "3 years", "4 years", "5 years",
  "6 years", "7 years", "8 years", "9 years", "10+ years",
];

const HOME_OWNERSHIP_OPTIONS = ["MORTGAGE", "RENT", "OWN", "ANY", "NONE"];

const PURPOSE_OPTIONS = [
  "debt_consolidation", "credit_card", "home_improvement", "other",
  "major_purchase", "medical", "small_business", "car", "vacation",
  "moving", "house", "wedding", "renewable_energy", "educational",
];

function formatPurpose(p: string) {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function userMessageForError(code: string): string {
  if (code === "VALIDATION_ERROR") return "Please check the highlighted input fields for valid entries.";
  if (code === "SERVER_ERROR") return "The prediction service is temporarily unavailable. Please try again.";
  if (code === "NETWORK_ERROR") return "Unable to connect to the prediction service. Check network/backend status.";
  return "An unexpected error occurred. Please try again.";
}

type FormState = {
  loan_amnt: string;
  revenue: string;
  dti_n: string;
  fico_n: string;
  experience_c: string;
  emp_length: string;
  home_ownership_n: string;
  purpose: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): FieldErrors {
  const e: FieldErrors = {};

  const loanAmnt = parseFloat(f.loan_amnt);
  if (!f.loan_amnt.trim()) e.loan_amnt = "Required field.";
  else if (isNaN(loanAmnt) || loanAmnt <= 0) e.loan_amnt = "Must be positive.";
  else if (loanAmnt < 500 || loanAmnt > 40000) e.loan_amnt = "Must be $500 ? $40,000.";

  const revenue = parseFloat(f.revenue);
  if (!f.revenue.trim()) e.revenue = "Required field.";
  else if (isNaN(revenue) || revenue <= 0) e.revenue = "Must be positive.";

  const dti = parseFloat(f.dti_n);
  if (!f.dti_n.trim()) e.dti_n = "Required field.";
  else if (isNaN(dti) || dti < 0 || dti > 100) e.dti_n = "Must be 0% ? 100%.";

  const fico = parseFloat(f.fico_n);
  if (!f.fico_n.trim()) e.fico_n = "Required field.";
  else if (isNaN(fico) || fico < 300 || fico > 850) e.fico_n = "Must be 300 ? 850.";

  const exp = parseFloat(f.experience_c);
  if (!f.experience_c.trim()) e.experience_c = "Required field.";
  else if (isNaN(exp) || exp < 0) e.experience_c = "Must be >= 0.";

  if (!f.emp_length) e.emp_length = "Required.";
  if (!f.home_ownership_n) e.home_ownership_n = "Required.";
  if (!f.purpose) e.purpose = "Required.";

  return e;
}

const INITIAL_FORM: FormState = {
  loan_amnt: "15000",
  revenue: "75000",
  dti_n: "18.5",
  fico_n: "710",
  experience_c: "10",
  emp_length: "10+ years",
  home_ownership_n: "MORTGAGE",
  purpose: "debt_consolidation",
};

export default function ScorePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductionPredictResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof FormState]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setResult(null);

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const payload: ProductionPredictRequest = {
        loan_amnt: parseFloat(form.loan_amnt),
        revenue: parseFloat(form.revenue),
        dti_n: parseFloat(form.dti_n),
        fico_n: parseFloat(form.fico_n),
        experience_c: parseFloat(form.experience_c),
        emp_length: form.emp_length,
        home_ownership_n: form.home_ownership_n,
        purpose: form.purpose,
      };

      const res = await predictLoanRisk(payload);
      setResult(res);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "SERVER_ERROR";
      setApiError(userMessageForError(code));
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    setResult(null);
    setApiError(null);
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* ?? Page Header ?? */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid var(--line)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "var(--brand-gradient)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)"
            }}>
              <Calculator size={18} color="#ffffff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Loan Risk Appraisal Engine
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Evaluate real-time default probabilities and explainability powered by <strong>XGBoost Base + Isotonic Calibration v1.0</strong>.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "var(--risk-low)", fontSize: 12, fontWeight: 700
          }}>
            <ShieldCheck size={14} /> Production Model Active
          </span>
        </div>
      </div>

      {/* ?? Main Layout ?? */}
      <div style={{ display: "grid", gridTemplateColumns: result ? "1.1fr 0.9fr" : "1fr", gap: 24, transition: "all 0.3s ease" }}>
        
        {/* ?? LEFT: Application Input Form ?? */}
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Applicant Financial Profile</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>Fill in all 8 underwriting variables below</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "transparent", border: "none", color: "var(--muted)",
                fontSize: 12, fontWeight: 600, cursor: "pointer"
              }}
            >
              <RefreshCw size={13} /> Reset Form
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
              
              {/* Loan Amount */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <DollarSign size={14} color="var(--brand)" /> Requested Loan Amount ($)
                </label>
                <input
                  type="number"
                  name="loan_amnt"
                  placeholder="e.g. 15000"
                  value={form.loan_amnt}
                  onChange={handleChange}
                  className="input"
                  style={{ borderColor: fieldErrors.loan_amnt ? "var(--risk-critical)" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Valid range: $500 ? $40,000</span>
                  {fieldErrors.loan_amnt && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.loan_amnt}</span>}
                </div>
              </div>

              {/* Annual Income / Revenue */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Briefcase size={14} color="var(--brand)" /> Annual Income / Revenue ($)
                </label>
                <input
                  type="number"
                  name="revenue"
                  placeholder="e.g. 75000"
                  value={form.revenue}
                  onChange={handleChange}
                  className="input"
                  style={{ borderColor: fieldErrors.revenue ? "var(--risk-critical)" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Verified total yearly earnings</span>
                  {fieldErrors.revenue && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.revenue}</span>}
                </div>
              </div>

              {/* DTI */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Percent size={14} color="var(--brand)" /> Debt-to-Income Ratio (%)
                </label>
                <input
                  type="number"
                  name="dti_n"
                  placeholder="e.g. 18.5"
                  step="0.1"
                  value={form.dti_n}
                  onChange={handleChange}
                  className="input"
                  style={{ borderColor: fieldErrors.dti_n ? "var(--risk-critical)" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Monthly debt Obligations / Income</span>
                  {fieldErrors.dti_n && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.dti_n}</span>}
                </div>
              </div>

              {/* FICO Score */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Award size={14} color="var(--brand)" /> FICO Bureau Score
                </label>
                <input
                  type="number"
                  name="fico_n"
                  placeholder="e.g. 710"
                  value={form.fico_n}
                  onChange={handleChange}
                  className="input"
                  style={{ borderColor: fieldErrors.fico_n ? "var(--risk-critical)" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Credit Bureau Score (300 ? 850)</span>
                  {fieldErrors.fico_n && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.fico_n}</span>}
                </div>
              </div>

              {/* Credit History (years) */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Calendar size={14} color="var(--brand)" /> Credit History (Years)
                </label>
                <input
                  type="number"
                  name="experience_c"
                  placeholder="e.g. 10"
                  step="0.5"
                  value={form.experience_c}
                  onChange={handleChange}
                  className="input"
                  style={{ borderColor: fieldErrors.experience_c ? "var(--risk-critical)" : undefined }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Years since first credit trade-line</span>
                  {fieldErrors.experience_c && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.experience_c}</span>}
                </div>
              </div>

              {/* Employment Length */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Briefcase size={14} color="var(--brand)" /> Employment Length
                </label>
                <select
                  name="emp_length"
                  value={form.emp_length}
                  onChange={handleChange}
                  className="select"
                  style={{ borderColor: fieldErrors.emp_length ? "var(--risk-critical)" : undefined }}
                >
                  <option value="">? Select Employment Tenure ?</option>
                  {EMP_LENGTH_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {fieldErrors.emp_length && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.emp_length}</span>}
              </div>

              {/* Home Ownership */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Home size={14} color="var(--brand)" /> Home Ownership Status
                </label>
                <select
                  name="home_ownership_n"
                  value={form.home_ownership_n}
                  onChange={handleChange}
                  className="select"
                  style={{ borderColor: fieldErrors.home_ownership_n ? "var(--risk-critical)" : undefined }}
                >
                  <option value="">? Select Home Ownership ?</option>
                  {HOME_OWNERSHIP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {fieldErrors.home_ownership_n && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.home_ownership_n}</span>}
              </div>

              {/* Loan Purpose */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  <Tag size={14} color="var(--brand)" /> Primary Loan Purpose
                </label>
                <select
                  name="purpose"
                  value={form.purpose}
                  onChange={handleChange}
                  className="select"
                  style={{ borderColor: fieldErrors.purpose ? "var(--risk-critical)" : undefined }}
                >
                  <option value="">? Select Primary Purpose ?</option>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{formatPurpose(opt)}</option>
                  ))}
                </select>
                {fieldErrors.purpose && <span style={{ fontSize: 11, color: "var(--risk-critical)", fontWeight: 600 }}>{fieldErrors.purpose}</span>}
              </div>

            </div>

            {/* Error Banner */}
            {apiError && (
              <div style={{
                marginTop: 20, padding: "12px 16px", borderRadius: 10,
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--risk-critical)", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <AlertTriangle size={18} />
                <span>{apiError}</span>
              </div>
            )}

            {/* Form Actions */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="button primary"
                disabled={loading}
                style={{ minWidth: 200, height: 44, fontSize: 14 }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                    Calculating Production Risk...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Run Risk Appraisal
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ?? RIGHT: Results & Explainability Panel ?? */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* 1. Primary Decision & Risk Card */}
            <div className="card" style={{
              padding: 24, borderRadius: 16,
              background: result.decision === "APPROVE" 
                ? "linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, var(--panel) 100%)"
                : "linear-gradient(180deg, rgba(239, 68, 68, 0.06) 0%, var(--panel) 100%)",
              border: result.decision === "APPROVE"
                ? "1px solid rgba(16, 185, 129, 0.3)"
                : "1px solid rgba(239, 68, 68, 0.3)"
            }}>
              {/* Decision Badge Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {result.decision === "APPROVE" ? (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={24} color="var(--risk-low)" />
                    </div>
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <XCircle size={24} color="var(--risk-critical)" />
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                      UNDERWRITING DECISION
                    </span>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: result.decision === "APPROVE" ? "var(--risk-low)" : "var(--risk-critical)" }}>
                      {result.decision === "APPROVE" ? "APPROVED" : "DECLINED"}
                    </h3>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 2 }}>RISK TIER</span>
                  <span className={`badge ${result.risk_tier.toLowerCase()}`} style={{ fontSize: 13, padding: "5px 12px" }}>
                    {result.risk_tier.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* PD Probability Highlight */}
              <div style={{
                background: "var(--panel-strong)", borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Calibrated Default Probability</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>
                    {(result.calibrated_probability * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12 }}>
                  <span style={{ color: "var(--muted)", display: "block" }}>Cutoff Threshold</span>
                  <span style={{ fontWeight: 800, color: "var(--brand)" }}>{(result.threshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* 2. TreeSHAP Attribution Breakdown */}
            <div className="card" style={{ padding: 24, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                <BarChart3 size={18} color="var(--brand)" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>TreeSHAP Feature Contributions</h3>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {/* Risk Factors */}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--risk-critical)", display: "block", marginBottom: 8 }}>
                    ? Top Default Drivers (Risk Factors)
                  </span>
                  <DriverChart drivers={(result.shap_explanations || []).filter(s => s.impact_direction === "positive_risk" || s.direction === "risk" || s.shap_value > 0).map(s => ({
                    label: s.human_feature_name || s.display_name || s.feature,
                    value: String(s.feature_value),
                    contribution: s.shap_value,
                    direction: "risk"
                  }))} />
                </div>

                {/* Protective Factors */}
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--risk-low)", display: "block", marginBottom: 8 }}>
                    ⚠ Top Credit Protectors (Protective Factors)
                  </span>
                  <DriverChart drivers={(result.shap_explanations || []).filter(s => s.impact_direction === "protective" || s.direction === "protective" || s.shap_value < 0).map(s => ({
                    label: s.human_feature_name || s.display_name || s.feature,
                    value: String(s.feature_value),
                    contribution: s.shap_value,
                    direction: "protective"
                  }))} />
                </div>
              </div>
            </div>

            {/* 3. Model Transparency & Accordion */}
            <div className="card" style={{ padding: 20, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Info size={16} color="var(--brand)" /> Model Governance & Audit Specs
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Version: {result.model_version}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, background: "var(--panel-strong)", padding: 12, borderRadius: 10 }}>
                <div><strong>Model:</strong> XGBoost Base</div>
                <div><strong>Calibration:</strong> Isotonic Regression</div>
                <div><strong>Decision Cutoff:</strong> {(result.threshold * 100).toFixed(0)}%</div>
                <div><strong>Uncertainty:</strong> {result.uncertainty_available ? "Available" : "Not available"}</div>
              </div>

              {/* Technical Accordion */}
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setTechDetailsOpen(!techDetailsOpen)}
                  style={{
                    background: "transparent", border: "none", color: "var(--brand)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0
                  }}
                >
                  {techDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {techDetailsOpen ? "Hide Raw Model Metrics" : "Show Technical Details"}
                </button>

                {techDetailsOpen && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--line)", fontSize: 12, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">Raw XGBoost Probability:</span>
                      <strong>{(result.raw_probability * 100).toFixed(2)}%</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">Isotonic Calibrated Probability:</span>
                      <strong>{(result.calibrated_probability * 100).toFixed(2)}%</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
