"use client";

import { useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, TrendingUp, ShieldCheck, Scale,
  BarChart3, AlertTriangle, Users, Cpu, FileText, Database
} from "lucide-react";

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  color: string;
  terms: Term[];
}

interface Term {
  term: string;
  abbr?: string;
  definition: string;
  formula?: string;
  range?: string;
  example?: string;
  thresholds?: { label: string; value: string; color: string }[];
}

const sections: Section[] = [
  {
    id: "scoring",
    icon: BarChart3,
    title: "Credit Scoring & Risk Metrics",
    color: "var(--brand)",
    terms: [
      {
        term: "Probability of Default",
        abbr: "PD",
        definition:
          "The core output of the AI model. Represents the likelihood that a borrower will fail to repay their loan within the agreed tenure. This single number drives the entire risk classification workflow.",
        formula: "PD = IsotonicCalibration(XGBoost_Base(loan_amnt, revenue, dti_n, fico_n, experience_c, emp_length, home_ownership_n, purpose))",
        range: "0% – 96% (clamped)",
        example: "A PD of 0.22 (22%) means there is roughly a 1-in-5 chance the borrower defaults.",
        thresholds: [
          { label: "Low Risk", value: "PD < 18%", color: "var(--risk-low)" },
          { label: "Medium Risk", value: "18% – 34%", color: "var(--risk-medium)" },
          { label: "High Risk", value: "34% – 55%", color: "var(--risk-high)" },
          { label: "Critical Risk", value: "PD > 55%", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Credit Bureau Score",
        definition:
          "A numerical summary (typically 300–850) issued by credit bureaus such as FICO, Experian, or TransUnion, reflecting a borrower's creditworthiness based on their repayment history, credit utilisation, and loan mix. Higher is better.",
        range: "300 – 850",
        example: "A score of 782 is considered prime; below 650 is subprime and attracts high risk weight.",
        thresholds: [
          { label: "Prime", value: "≥ 750", color: "var(--risk-low)" },
          { label: "Near-Prime", value: "650 – 749", color: "var(--risk-medium)" },
          { label: "Subprime", value: "< 650", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Affordability Ratio",
        definition:
          "Measures the size of the requested loan relative to the borrower's income capacity over the loan tenure. A high ratio signals that the borrower is taking on a disproportionately large debt.",
        formula: "affordability_ratio = loan_amount / (monthly_income × tenure_months)",
        range: "0 – ∞ (higher = riskier)",
        example: "Loan $15,000 over 60 months for income $6,250/month → ratio ≈ 0.040 (healthy).",
      },
      {
        term: "Expense Ratio",
        definition:
          "The fraction of monthly income consumed by recurring expenses. Reflects residual cash flow available for loan repayment. High expense ratios indicate thin buffers against financial shocks.",
        formula: "expense_ratio = monthly_expenses / monthly_income",
        range: "0 – 1 (higher = riskier)",
        example: "Expenses $3,800 on income $4,900/month → expense ratio = 0.78 (dangerously high).",
        thresholds: [
          { label: "Healthy", value: "< 45%", color: "var(--risk-low)" },
          { label: "Elevated", value: "45% – 65%", color: "var(--risk-medium)" },
          { label: "Stress Zone", value: "> 65%", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Debt Capacity",
        definition:
          "The net monthly cash surplus a borrower possesses after all expenses. It represents the real headroom available for loan EMI payments. A negative debt capacity is an automatic review trigger.",
        formula: "debt_capacity = monthly_income − monthly_expenses",
        example: "Income $7,250 − Expenses $3,100 = Debt Capacity $4,150/month.",
      },
      {
        term: "Loan Stack Risk",
        definition:
          "A risk penalty learned by the model when a borrower already has multiple active loans. Each additional loan increases the probability of over-indebtedness and payment prioritisation conflicts.",
        example: "Borrowers with 4+ existing loans typically see a large increase in their predicted probability of default.",
      },
      {
        term: "Employment Stability",
        definition:
          "A protective factor learned by the model for long-tenured employees. Steady employment is a strong proxy for consistent income and lower behavioural default risk.",
        example: "8.5 years of employment typically acts as a strong protective factor, lowering predicted PD.",
      },
    ],
  },
  {
    id: "tiers",
    icon: AlertTriangle,
    title: "Risk Tiers & Recommendations",
    color: "var(--risk-high)",
    terms: [
      {
        term: "Low Risk",
        definition:
          "Borrower has strong creditworthiness, healthy cash flow, and no significant risk flags. The AI system automatically recommends approval. These applications are typically fast-tracked with minimal manual intervention.",
        thresholds: [{ label: "PD Range", value: "< 18%", color: "var(--risk-low)" }],
        example: 'Recommendation: "approve" — Standard terms may be offered.',
      },
      {
        term: "Medium Risk",
        definition:
          "Borrower presents moderate risk. Credit quality is acceptable but one or more financial indicators warrant attention (e.g., elevated expense ratio or near-prime credit score). Conditional approval may include a higher interest rate or lower loan amount.",
        thresholds: [{ label: "PD Range", value: "18% – 34%", color: "var(--risk-medium)" }],
        example: 'Recommendation: "approve_with_conditions" — Collateral or guarantor may be required.',
      },
      {
        term: "High Risk",
        definition:
          "Significant risk indicators present. The AI model flags this application for mandatory human review. A Lender Analyst or Admin must examine all underlying financial data, alternative signals, and business context before any decision is made.",
        thresholds: [{ label: "PD Range", value: "34% – 55%", color: "var(--risk-high)" }],
        example: 'Recommendation: "manual_review" — Case goes into the attention queue.',
      },
      {
        term: "Critical Risk",
        definition:
          "The borrower profile poses an extreme default risk. The model recommends outright rejection or escalation to senior credit committee. Multiple adverse indicators are typically present (very low credit score, high expense ratio, large existing debt stack).",
        thresholds: [{ label: "PD Range", value: "> 55%", color: "var(--risk-critical)" }],
        example: 'Recommendation: "reject_or_escalate" — Immediate escalation triggered.',
      },
      {
        term: "Manual Review Override",
        definition:
          "An authorised Lender Analyst or Admin can override the AI model's recommendation to approve or reject an application. All overrides are permanently logged to the audit trail with a mandatory reason code and notes, ensuring accountability and regulatory compliance.",
        example: "Override reason codes include: CREDIT_POLICY_EXCEPTION, BUSINESS_RELATIONSHIP, COLLATERAL_SECURED.",
      },
    ],
  },
  {
    id: "alternative",
    icon: TrendingUp,
    title: "Alternative Credit Signals",
    color: "var(--accent)",
    terms: [
      {
        term: "Savings Consistency Signal",
        definition:
          "A behavioural alternative data signal (0–1) reflecting how regularly and consistently a borrower saves money. Derived from bank statement analysis or fintech data integrations. High scores indicate financial discipline and resilience.",
        range: "0.0 (no savings discipline) – 1.0 (perfect consistency)",
        thresholds: [
          { label: "Strong", value: "> 0.75", color: "var(--risk-low)" },
          { label: "Moderate", value: "0.50 – 0.75", color: "var(--risk-medium)" },
          { label: "Weak", value: "< 0.50", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Utility Payment Score",
        definition:
          "A supplementary alternative signal (0–1) representing the borrower's history of on-time payment of utility bills (electricity, gas, water, telecom). Strong proxy for behavioural creditworthiness in thin-file or new-to-credit segments.",
        range: "0.0 – 1.0",
        example: "Score of 0.91 indicates near-perfect on-time utility payment history.",
      },
      {
        term: "New-to-Credit Segment",
        definition:
          "Borrowers who have little or no formal credit history (no FICO score or very limited records). Alternative signals become the primary input for underwriting decisions in this segment. Common for young earners or thin-file borrowers.",
        example: "Borrowers with 0 existing trades are classified as new_to_credit.",
      },
    ],
  },
  {
    id: "model",
    icon: Cpu,
    title: "AI Model & Explainability",
    color: "#8b5cf6",
    terms: [
      {
        term: "AUC – ROC",
        abbr: "AUC",
        definition:
          "Area Under the Receiver Operating Characteristic Curve. Measures how well the model distinguishes between defaulters and non-defaulters across all possible classification thresholds. A value of 1.0 is perfect; 0.5 is no better than a coin flip.",
        range: "0.5 (random) – 1.0 (perfect)",
        thresholds: [
          { label: "Excellent", value: "> 0.85", color: "var(--risk-low)" },
          { label: "Acceptable", value: "0.75 – 0.85", color: "var(--risk-medium)" },
          { label: "Poor", value: "< 0.75", color: "var(--risk-critical)" },
        ],
        example: "Active model AUC: 0.932 — considered exceptionally strong for consumer credit risk.",
      },
      {
        term: "KS Statistic",
        abbr: "KS",
        definition:
          "Kolmogorov-Smirnov statistic. Measures the maximum separation between the cumulative distribution of defaulters and non-defaulters scored by the model. The higher the KS, the better the model separates good and bad borrowers.",
        range: "0 (no separation) – 1 (perfect separation)",
        example: "Active model KS: 0.729 — exceptionally strong discriminatory power.",
        thresholds: [
          { label: "Excellent", value: "> 0.40", color: "var(--risk-low)" },
          { label: "Acceptable", value: "0.30 – 0.40", color: "var(--risk-medium)" },
          { label: "Poor", value: "< 0.30", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Model Confidence",
        definition:
          "The model's self-assessed certainty in its PD prediction for a specific application. Derived from how far the predicted PD falls from the decision boundaries. Lower confidence scores suggest the case sits in a borderline zone and warrants extra scrutiny.",
        formula: "confidence = clamp(0.92 − |PD − 0.42| × 0.35, 0.72, 0.94)",
        range: "72% – 94%",
      },
      {
        term: "TreeSHAP Feature Attribution",
        abbr: "SHAP",
        definition:
          "A fast, exact algorithm for computing SHAP (SHapley Additive exPlanations) values specifically optimised for tree-based models like XGBoost. For each prediction, TreeSHAP decomposes the model output into per-feature contributions, showing exactly how much each input pushed the probability up (risk) or down (protective).",
        formula: "PD = base_value + Σ SHAP_i(feature_i)",
        example: "A SHAP value of +0.14 for dti_n means the borrower's debt-to-income ratio raised their predicted default probability by 14 percentage points.",
      },
      {
        term: "XGBoost Base Model",
        abbr: "XGB",
        definition:
          "The core gradient-boosted decision tree ensemble trained on the Lending Club dataset. XGBoost builds an additive sequence of shallow trees where each tree corrects residual errors of the prior ensemble. It captures non-linear feature interactions and is robust to missing values and outliers without explicit feature scaling.",
        formula: "F(x) = Σ_k f_k(x), where f_k are regression trees",
        thresholds: [
          { label: "Objective", value: "binary:logistic", color: "var(--brand)" },
          { label: "Max Depth", value: "6", color: "#8b5cf6" },
          { label: "n_estimators", value: "300", color: "var(--risk-low)" },
          { label: "Learning Rate", value: "0.05", color: "var(--risk-medium)" },
        ],
        example: "Active model: 300 trees, max depth 6, trained on 887K Lending Club loan records.",
      },
      {
        term: "Isotonic Calibration",
        definition:
          "A non-parametric post-processing technique applied to XGBoost raw output probabilities to ensure they are well-calibrated (i.e., a predicted PD of 30% truly reflects a 30% empirical default rate). Isotonic regression fits a monotone step-function mapping raw scores to calibrated probabilities using a held-out calibration set.",
        formula: "PD_calibrated = IsotonicRegression(PD_raw)",
        range: "0.0 – 1.0 (monotone mapping)",
        example: "Raw XGBoost score of 0.38 may calibrate to 0.41 after isotonic correction on the validation set.",
      },
      {
        term: "Decision Threshold",
        definition:
          "The calibrated probability cutoff above which an application is classified as DECLINE. Set at 45% (0.45) for the production model, balancing credit loss risk against revenue opportunity. Applications with PD ≥ 45% are declined; PD < 45% are approved.",
        formula: "decision = 'DECLINE' if PD_calibrated ≥ 0.45 else 'APPROVE'",
        thresholds: [
          { label: "Approve", value: "PD < 45%", color: "var(--risk-low)" },
          { label: "Decline", value: "PD ≥ 45%", color: "var(--risk-critical)" },
        ],
        example: "PD = 0.47 → DECLINE | PD = 0.31 → APPROVE",
      },
      {
        term: "Lending Club Dataset",
        abbr: "LC",
        definition:
          "The publicly available peer-to-peer lending dataset used to train the production model. Contains ~887,000 fully-funded loan records with verified financial attributes and 24-month repayment outcomes. Only application-time features (available before loan issuance) are used to prevent data leakage.",
        thresholds: [
          { label: "Records", value: "~887,000 loans", color: "var(--brand)" },
          { label: "Target", value: "loan_status (default / fully paid)", color: "#8b5cf6" },
          { label: "Features used", value: "8 application-time only", color: "var(--risk-low)" },
        ],
      },
      {
        term: "Stratified Train / Calibration Split",
        abbr: "Split",
        definition:
          "The dataset is divided into a training set (80%) used to fit XGBoost and a held-out calibration set (20%) used exclusively to fit the Isotonic Calibration layer. Stratification ensures the same default rate appears in both splits, preventing calibration leakage.",
        formula: "train_test_split(X, y, test_size=0.2, stratify=y)",
        example: "Training: ~709K records | Calibration: ~177K records, default rate preserved in both.",
      },
    ],
  },
  {
    id: "fairness",
    icon: Scale,
    title: "Fairness & Bias Metrics",
    color: "#10b981",
    terms: [
      {
        term: "Demographic Parity Gap",
        definition:
          "Measures the absolute difference in approval rates between the most-approved and least-approved demographic group. A large gap indicates the model is systematically approving loans at different rates based on protected attributes (gender, geography), regardless of creditworthiness.",
        formula: "demographic_parity_gap = max(group_approval_rates) − min(group_approval_rates)",
        thresholds: [
          { label: "Fair", value: "< 18%", color: "var(--risk-low)" },
          { label: "Alert", value: "> 18%", color: "var(--risk-critical)" },
        ],
        example: "Male approval 82%, Female approval 61% → gap = 21% → triggers fairness alert.",
      },
      {
        term: "Equalized Odds Proxy Gap",
        definition:
          "Measures the difference in high-risk classification rates across demographic groups. If the model assigns 'high' or 'critical' risk to one group far more often than another with similar financial profiles, it may indicate discriminatory outcomes.",
        formula: "equalized_odds_proxy_gap = max(group_high_risk_rates) − min(group_high_risk_rates)",
        thresholds: [
          { label: "Fair", value: "< 22%", color: "var(--risk-low)" },
          { label: "Alert", value: "> 22%", color: "var(--risk-critical)" },
        ],
      },
      {
        term: "Protected Attribute",
        definition:
          "A characteristic such as gender, religion, or geography that is legally protected from being used as a basis for lending decisions under FCRA / ECOA fair lending guidelines.",
        example: "Gender and geographic region are the primary protected attributes audited in this platform.",
      },
      {
        term: "Approval Rate",
        definition:
          "The percentage of applications from a specific demographic group that received a PD below the medium-risk threshold (< 34%), making them eligible for approval or conditional approval.",
        formula: "approval_rate = count(PD < 0.34) / total_applications_in_group",
      },
    ],
  },
  {
    id: "portfolio",
    icon: Users,
    title: "Borrower Segments & Products",
    color: "#f59e0b",
    terms: [
      {
        term: "Salaried Prime",
        definition:
          "Borrowers in formal employment with a consistent monthly salary and a strong credit history (credit score ≥ 700). Lowest default risk segment. Standard loan products with competitive rates are typically available.",
      },
      {
        term: "Self-Employed",
        definition:
          "Business owners, freelancers, and professionals with variable income. Income verification is more complex and income volatility raises inherent risk. Expense ratios and alternative signals carry more weight in scoring.",
      },
      {
        term: "Micro Business",
        definition:
          "Small enterprises (typically turnover < $500k/year). Often underbanked with thin credit files. MSME Working Capital products are the primary loan type. Alternative signals and business performance proxies are critical.",
      },
      {
        term: "New-to-Credit",
        definition:
          "Individuals with no or minimal formal credit history. Cannot be scored by traditional bureau-based models. Entirely dependent on alternative data (utility payments, savings behaviour, employment history) for underwriting.",
      },
      {
        term: "MSME Working Capital Loan",
        definition:
          "Short-to-medium term loan designed to finance the day-to-day operational expenses of micro, small, and medium enterprises — inventory, wages, receivables gaps. Typically 12–36 month tenure.",
      },
      {
        term: "Home Improvement Loan",
        definition:
          "Secured or unsecured loan for residential renovation, expansion, or repair. Usually taken by salaried or self-employed borrowers against property value. Longer tenures (up to 60 months) are common.",
      },
      {
        term: "Equipment Finance",
        definition:
          "Asset-backed lending where the financed equipment (machinery, vehicles, tools) serves as collateral. Common in manufacturing and micro-business segments. Moderate tenure (24–48 months).",
      },
      {
        term: "Loan Channel",
        definition: "The origination channel through which the application was submitted.",
        thresholds: [
          { label: "Branch", value: "Walk-in at physical branch", color: "var(--muted)" },
          { label: "Digital", value: "Online / mobile application", color: "var(--accent)" },
          { label: "Partner", value: "DSA / fintech referral", color: "#8b5cf6" },
        ],
      },
    ],
  },
  {
    id: "governance",
    icon: ShieldCheck,
    title: "Model Governance & Audit",
    color: "#6366f1",
    terms: [
      {
        term: "Model Approval State",
        definition:
          "The formal status assigned to a model version by the credit committee or model risk management team after validation. Only models in 'approved' state can be activated for production scoring.",
        thresholds: [
          { label: "Approved", value: "Production-ready", color: "var(--risk-low)" },
          { label: "Under Review", value: "Validation in progress", color: "var(--risk-medium)" },
          { label: "Archived", value: "Deprecated / replaced", color: "var(--muted)" },
        ],
      },
      {
        term: "Audit Log",
        definition:
          "An immutable, timestamped record of every significant action performed on the platform — application creation, scoring, override decisions, login events, and model changes. Required for regulatory compliance (FCRA/ECOA) and internal audit trails.",
      },
      {
        term: "Retraining Feedback Signal",
        definition:
          "Every human override decision is captured as a labelled training signal for future model retraining. This creates a continuous learning loop where the model improves over time based on expert corrections.",
        example: "Override type: human_override. Signal captured: {decision: 'approve', reason_code: 'COLLATERAL_SECURED'}",
      },
      {
        term: "Override Reason Codes",
        definition:
          "Standardised codes that loan officers must select when overriding an AI recommendation. Ensures structured, auditable justification for every human-in-the-loop decision.",
        thresholds: [
          { label: "CREDIT_POLICY_EXCEPTION", value: "Internal policy discretion", color: "var(--risk-medium)" },
          { label: "BUSINESS_RELATIONSHIP", value: "Strategic account exception", color: "var(--accent)" },
          { label: "COLLATERAL_SECURED", value: "Asset backing provided", color: "var(--risk-low)" },
        ],
      },
    ],
  },
  {
    id: "reports",
    icon: FileText,
    title: "Reports & Analytics",
    color: "#ec4899",
    terms: [
      {
        term: "Portfolio Risk Report",
        definition:
          "A summarised view of the entire loan portfolio's risk distribution, average PD, high-risk exposure in dollars, and fairness posture. Generated on-demand and exportable as PDF for board reporting.",
      },
      {
        term: "Average Portfolio PD",
        definition:
          "The mean probability of default across all active loan applications in the portfolio. A key indicator tracked by the Risk Command Center. Rising average PD triggers portfolio-level alerts.",
        formula: "avg_pd = Σ(PD_i) / total_applications",
      },
      {
        term: "High-Risk Exposure ($)",
        definition:
          "The total outstanding principal amount lent to borrowers classified in the 'high' or 'critical' risk tier. Regulators and credit committees monitor this figure as a measure of capital-at-risk.",
      },
      {
        term: "Fairness Audit Report",
        definition:
          "A structured audit of approval rate disparities and high-risk classification rates across gender and geographic demographic groups. Generated for each model version and compared against the defined fairness thresholds.",
      },
    ],
  },
  {
    id: "dataset",
    icon: Database,
    title: "Dataset Lineage & Sources",
    color: "#06b6d4",
    terms: [
      {
        term: "Lending Club Loan Dataset (Production)",
        definition:
          "The primary dataset used to train and calibrate the production XGBoost model. Sourced from Lending Club's public loan book covering 2007–2018, containing ~887,000 fully-funded personal loans with verified financial attributes and 24-month repayment outcomes (fully paid vs. charged off / defaulted). Only 8 application-time features are used to prevent any data leakage.",
        range: "8 features × ~887,000 records",
        example: "Loan amounts range from $500–$40,000 | FICO scores 300–850 | Purposes include debt_consolidation, credit_card, home_improvement, etc.",
        thresholds: [
          { label: "Format", value: "Parquet / CSV", color: "#06b6d4" },
          { label: "Currency", value: "USD ($)", color: "var(--risk-low)" },
          { label: "Domain", value: "US Consumer Credit", color: "var(--brand)" },
        ],
      },
      {
        term: "FICO Credit Score Standards",
        definition:
          "Credit score ranges (300–850) defined by the Fair Isaac Corporation (FICO), the industry standard for US consumer credit risk. The production model uses FICO scores as one of its 8 core features. Higher scores indicate lower default risk and drive significant model weight in prediction.",
        thresholds: [
          { label: "Exceptional", value: "FICO ≥ 800", color: "var(--risk-low)" },
          { label: "Very Good", value: "740 – 799", color: "var(--risk-low)" },
          { label: "Good", value: "670 – 739", color: "var(--risk-medium)" },
          { label: "Fair / Subprime", value: "< 670", color: "var(--risk-critical)" },
        ],
      },
    ],
  },
];

function TermCard({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          background: "var(--panel)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 12,
        }}
      >
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{term.term}</span>
          {term.abbr && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: "var(--panel-strong)",
                color: "var(--muted)",
              }}
            >
              {term.abbr}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div style={{ padding: "16px 18px 20px", background: "var(--panel-strong)", borderTop: "1px solid var(--line)" }}>
          <p style={{ margin: "0 0 14px", lineHeight: 1.7, color: "var(--ink)" }}>{term.definition}</p>

          {term.formula && (
            <div style={{ marginBottom: 12 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>FORMULA</span>
              <code style={{
                display: "block",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontFamily: "monospace",
                color: "var(--brand)",
                wordBreak: "break-word",
              }}>
                {term.formula}
              </code>
            </div>
          )}

          {term.range && (
            <p style={{ margin: "0 0 10px" }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>RANGE: </span>
              <span style={{ fontSize: 13 }}>{term.range}</span>
            </p>
          )}

          {term.thresholds && (
            <div style={{ marginBottom: 12 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8 }}>THRESHOLDS</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {term.thresholds.map((t) => (
                  <span
                    key={t.label}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      border: `1px solid ${t.color}`,
                      color: t.color,
                    }}
                  >
                    {t.label}: {t.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {term.example && (
            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "var(--panel)",
              borderLeft: "3px solid var(--brand)",
              borderRadius: "0 8px 8px 0",
              fontSize: 13,
              color: "var(--muted)",
            }}>
              <strong style={{ color: "var(--ink)" }}>Example: </strong>{term.example}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GlossaryPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const totalTerms = sections.reduce((sum, s) => sum + s.terms.length, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Financial Glossary & Reference</h2>
          <p>Complete guide to all scoring criteria, financial metrics, model concepts, and platform terminology.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BookOpen size={18} className="muted" />
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{totalTerms} terms across {sections.length} categories</span>
        </div>
      </div>

      {/* Performance Metrics Visualizer Section */}
      <section className="panel" style={{ marginBottom: 24, borderLeft: "4px solid #8b5cf6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <TrendingUp size={18} style={{ color: "#8b5cf6" }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Model Performance Visualizer</h3>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Interactive visual metrics curves and confusion matrix reference for production loan risk models.
            </p>
          </div>
          <span style={{ padding: "4px 12px", borderRadius: 999, background: "rgba(139,92,246,0.15)", color: "#8b5cf6", fontSize: 12, fontWeight: 700 }}>
            Model Benchmark: xgboost-isotonic-v1.0
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* ROC Curve Chart */}
          <div style={{ background: "var(--panel-strong)", padding: 16, borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>ROC Curve (Receiver Operating Characteristic)</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--risk-low)" }}>AUC = 0.932</span>
            </div>
            <div style={{ height: 180, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
              <svg viewBox="0 0 300 150" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                {/* Gridlines */}
                <line x1="30" y1="10" x2="290" y2="10" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="30" y1="45" x2="290" y2="45" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="30" y1="80" x2="290" y2="80" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="30" y1="115" x2="290" y2="115" stroke="var(--line)" strokeDasharray="3 3" />
                {/* Random Guess Line */}
                <line x1="30" y1="140" x2="290" y2="10" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.6" />
                {/* ROC Curve Area */}
                <polygon points="30,140 40,70 70,30 130,15 220,11 290,10 290,140" fill="rgba(139,92,246,0.12)" />
                {/* ROC Curve Line */}
                <polyline points="30,140 40,70 70,30 130,15 220,11 290,10" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
                {/* Axis Titles */}
                <text x="160" y="148" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600">False Positive Rate (FPR)</text>
                <text x="15" y="75" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600" transform="rotate(-90 15 75)">True Positive Rate (TPR)</text>
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              <span>0.0 (Strict Threshold)</span>
              <span style={{ color: "#8b5cf6", fontWeight: 700 }}>■ Model Curve</span>
              <span style={{ color: "var(--muted)" }}>- - Random Flip (0.5)</span>
              <span>1.0 (Lenient)</span>
            </div>
          </div>

          {/* KS Statistic Chart */}
          <div style={{ background: "var(--panel-strong)", padding: 16, borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>KS Statistic (Distributions Separation)</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--risk-low)" }}>Max KS = 72.9%</span>
            </div>
            <div style={{ height: 180, display: "flex", flexDirection: "column", justifyContent: "flex-end", position: "relative" }}>
              <svg viewBox="0 0 300 150" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                {/* Gridlines */}
                <line x1="30" y1="10" x2="290" y2="10" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="30" y1="75" x2="290" y2="75" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="30" y1="140" x2="290" y2="140" stroke="var(--line)" />
                {/* Non-Defaulters Cumulative Line */}
                <path d="M 30,140 Q 90,135 120,40 T 290,10" fill="none" stroke="var(--risk-low)" strokeWidth="2.5" />
                {/* Defaulters Cumulative Line */}
                <path d="M 30,140 Q 180,130 220,100 T 290,10" fill="none" stroke="var(--risk-critical)" strokeWidth="2.5" />
                {/* Max KS Gap Line */}
                <line x1="140" y1="45" x2="140" y2="115" stroke="var(--brand)" strokeWidth="2" strokeDasharray="3 2" />
                <circle cx="140" cy="45" r="4" fill="var(--brand)" />
                <circle cx="140" cy="115" r="4" fill="var(--brand)" />
                <text x="146" y="80" fill="var(--brand)" fontSize="10" fontWeight="800">KS = 0.729</text>
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              <span style={{ color: "var(--risk-low)", fontWeight: 700 }}>— Non-Defaulters</span>
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>┊ Max Separation Gap</span>
              <span style={{ color: "var(--risk-critical)", fontWeight: 700 }}>— Defaulters</span>
            </div>
          </div>

          {/* Confusion Matrix & Threshold Metrics */}
          <div style={{ background: "var(--panel-strong)", padding: 16, borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>XGBoost + Isotonic Calibration Decision Matrix (Threshold = 45%)</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--risk-low)" }}>AUC = 0.932</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700 }}>TRUE NEGATIVE (Approved &amp; Repaid)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--risk-low)", marginTop: 2 }}>76.0%</div>
                <div className="muted" style={{ fontSize: 10 }}>Correct Non-Default</div>
              </div>
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700 }}>FALSE POSITIVE (Approved &amp; Defaulted)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--risk-critical)", marginTop: 2 }}>3.2%</div>
                <div className="muted" style={{ fontSize: 10 }}>Type I Error (Credit Loss)</div>
              </div>
              <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700 }}>FALSE NEGATIVE (Rejected Good)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--risk-medium)", marginTop: 2 }}>4.1%</div>
                <div className="muted" style={{ fontSize: 10 }}>Type II Error (Lost Revenue)</div>
              </div>
              <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 10, fontWeight: 700 }}>TRUE POSITIVE (Rejected Default)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#6366f1", marginTop: 2 }}>16.7%</div>
                <div className="muted" style={{ fontSize: 10 }}>Correct Risk Catch</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", fontSize: 11, paddingTop: 4, borderTop: "1px solid var(--line)" }}>
              <span>Precision: <strong style={{ color: "var(--ink)" }}>84.6%</strong></span>
              <span>Recall / Sensitivity: <strong style={{ color: "var(--ink)" }}>79.2%</strong></span>
              <span>F1 Score: <strong style={{ color: "var(--ink)" }}>0.818</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Nav */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {sections.map((s) => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              className={`button ${active ? "" : "ghost"}`}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                minHeight: 32,
                borderColor: active ? s.color : "var(--line)",
                color: active ? s.color : "var(--muted)",
                background: active ? `${s.color}15` : "transparent",
              }}
              onClick={() => {
                setActiveSection(active ? null : s.id);
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Icon size={13} />
              {s.title.split("&")[0].trim()}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                  padding: "14px 20px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderLeft: `4px solid ${section.color}`,
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <Icon size={22} style={{ color: section.color, flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{section.title}</h3>
                  <span className="muted" style={{ fontSize: 13 }}>{section.terms.length} terms</span>
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {section.terms.map((term) => (
                  <TermCard key={term.term} term={term} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
