export type RiskTier = "low" | "medium" | "high" | "critical" | "unscored";

export type Borrower = {
  id: number;
  fullName: string;
  age: number;
  city: string;
  state: string;
  segment: string;
  gender: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  creditScore: number;
  employmentYears: number;
  existingLoans: number;
  alternativeSignals: Record<string, number>;
};

export type Application = {
  id: number;
  borrowerId: number;
  borrowerName: string;
  product: string;
  amount: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  assignedReviewer: string;
  channel: string;
  riskTier: RiskTier;
  probabilityDefault: number;
  lastActivity: string;
};

export type Driver = {
  label: string;
  value: string;
  contribution: number;
  direction: "risk" | "protective";
};

export type Audit = {
  id: number;
  modelVersion: string;
  protectedAttribute: string;
  status: string;
  alertCount: number;
  createdAt: string;
  metrics: {
    demographicParityGap: number;
    equalizedOddsProxyGap: number;
    groups: Record<string, { approvalRate: number; highRiskRate: number; averagePd: number }>;
  };
};

export type ModelVersion = {
  id: number;
  name: string;
  version: string;
  auc: number;
  ksStatistic: number;
  approvalState: string;
  trainingDataset: string;
  isActive: boolean;
};

// ── Phase 8 – Production inference types ──────────────────────────────────
export type ProductionPredictRequest = {
  loan_amnt: number;
  revenue: number;
  dti_n: number;
  fico_n: number;
  experience_c: number;
  emp_length: string;
  home_ownership_n: string;
  purpose: string;
};

export type ProductionSHAPExplanation = {
  feature: string;
  human_feature_name?: string;
  display_name?: string;
  shap_value: number;
  impact_direction?: string;
  direction?: "risk" | "protective";
  feature_value: string | number;
  statement?: string;
};

export type ProductionPredictResponse = {
  calibrated_probability: number;
  raw_probability: number;
  decision: "APPROVE" | "DECLINE";
  risk_tier: string;
  threshold: number;
  shap_explanations: ProductionSHAPExplanation[];
  risk_factors?: ProductionSHAPExplanation[];
  protective_factors?: ProductionSHAPExplanation[];
  model_version: string;
  calibration_method: string;
  uncertainty_available?: boolean;
};
