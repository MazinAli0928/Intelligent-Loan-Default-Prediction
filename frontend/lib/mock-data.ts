import type { Application, Audit, Borrower, Driver, ModelVersion } from "./types";

export const demoUsers = [
  { role: "Lender Analyst", name: "Asha Mehta", email: "analyst@demo.local" },
  { role: "Compliance Officer", name: "Rahul Verma", email: "compliance@demo.local" },
  { role: "Admin", name: "Nisha Rao", email: "admin@demo.local" }
];

export const borrowers: Borrower[] = [
  {
    id: 1,
    fullName: "Priya Sharma",
    age: 34,
    city: "Mumbai",
    state: "Maharashtra",
    segment: "Salaried prime",
    gender: "Female",
    monthlyIncome: 145000,
    monthlyExpenses: 62000,
    creditScore: 782,
    employmentYears: 8.5,
    existingLoans: 1,
    alternativeSignals: { savingsConsistency: 0.82, utilityPaymentScore: 0.91 }
  },
  {
    id: 2,
    fullName: "Arjun Nair",
    age: 42,
    city: "Bengaluru",
    state: "Karnataka",
    segment: "Self employed",
    gender: "Male",
    monthlyIncome: 98000,
    monthlyExpenses: 76000,
    creditScore: 642,
    employmentYears: 5,
    existingLoans: 3,
    alternativeSignals: { savingsConsistency: 0.38, utilityPaymentScore: 0.74 }
  },
  {
    id: 3,
    fullName: "Farah Khan",
    age: 29,
    city: "Hyderabad",
    state: "Telangana",
    segment: "New to credit",
    gender: "Female",
    monthlyIncome: 72000,
    monthlyExpenses: 39000,
    creditScore: 611,
    employmentYears: 2.2,
    existingLoans: 0,
    alternativeSignals: { savingsConsistency: 0.64, utilityPaymentScore: 0.88 }
  },
  {
    id: 4,
    fullName: "Dev Patel",
    age: 51,
    city: "Ahmedabad",
    state: "Gujarat",
    segment: "Micro business",
    gender: "Male",
    monthlyIncome: 86000,
    monthlyExpenses: 83000,
    creditScore: 586,
    employmentYears: 12,
    existingLoans: 4,
    alternativeSignals: { savingsConsistency: 0.29, utilityPaymentScore: 0.66 }
  }
];

export const applications: Application[] = [
  {
    id: 101,
    borrowerId: 1,
    borrowerName: "Priya Sharma",
    product: "Home Improvement Loan",
    amount: 850000,
    tenureMonths: 60,
    purpose: "debt_consolidation",
    status: "approved",
    assignedReviewer: "Asha Mehta",
    channel: "Digital Portal",
    riskTier: "low",
    probabilityDefault: 0.082,
    lastActivity: "12 mins ago"
  },
  {
    id: 102,
    borrowerId: 2,
    borrowerName: "Arjun Nair",
    product: "MSME Working Capital",
    amount: 1250000,
    tenureMonths: 36,
    purpose: "small_business",
    status: "manual_review",
    assignedReviewer: "Rahul Verma",
    channel: "Branch Direct",
    riskTier: "high",
    probabilityDefault: 0.481,
    lastActivity: "45 mins ago"
  },
  {
    id: 103,
    borrowerId: 3,
    borrowerName: "Farah Khan",
    product: "Personal Loan",
    amount: 320000,
    tenureMonths: 36,
    purpose: "educational",
    status: "submitted",
    assignedReviewer: "Asha Mehta",
    channel: "Fintech Partner",
    riskTier: "medium",
    probabilityDefault: 0.234,
    lastActivity: "2 hours ago"
  },
  {
    id: 104,
    borrowerId: 4,
    borrowerName: "Dev Patel",
    product: "Equipment Finance",
    amount: 975000,
    tenureMonths: 48,
    purpose: "major_purchase",
    status: "rejected",
    assignedReviewer: "Rahul Verma",
    channel: "Branch Direct",
    riskTier: "critical",
    probabilityDefault: 0.648,
    lastActivity: "Yesterday"
  }
];

export const drivers: Driver[] = [
  { label: "FICO Credit Score (fico_n)", value: "782", contribution: -0.142, direction: "protective" },
  { label: "Annual Income (revenue)", value: "$1,740,000", contribution: -0.098, direction: "protective" },
  { label: "Debt-to-Income Ratio (dti_n)", value: "42.8%", contribution: 0.085, direction: "risk" },
  { label: "Loan Amount (loan_amnt)", value: "$850,000", contribution: 0.054, direction: "risk" }
];

export const audits: Audit[] = [
  {
    id: 1,
    modelVersion: "v1.0",
    protectedAttribute: "Gender",
    status: "passed",
    alertCount: 0,
    createdAt: "Today, 10:20",
    metrics: {
      demographicParityGap: 0.08,
      equalizedOddsProxyGap: 0.05,
      groups: {
        Female: { approvalRate: 0.72, highRiskRate: 0.18, averagePd: 0.19 },
        Male: { approvalRate: 0.64, highRiskRate: 0.23, averagePd: 0.24 }
      }
    }
  }
];

export const models: ModelVersion[] = [
  {
    id: 1,
    name: "XGBoost Base + Isotonic Calibration v1.0",
    version: "xgboost-isotonic-v1.0",
    auc: 0.932,
    ksStatistic: 0.729,
    approvalState: "approved",
    trainingDataset: "LendingClub Historical Granted Loans Dataset",
    isActive: true
  }
];

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
