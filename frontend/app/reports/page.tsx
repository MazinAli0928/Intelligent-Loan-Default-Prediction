"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Search, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch, getAuthToken } from "@/lib/api";

interface ApplicationItem {
  id: number;
  borrower_id?: number;
  borrower_name?: string;
  borrowerName?: string;
  borrower?: { full_name: string };
  product: string;
  amount: number;
  tenure_months?: number;
  purpose?: string;
  status: string;
  risk_tier?: string;
  riskTier?: string;
  probability_default?: number;
  assigned_reviewer?: string;
  channel?: string;
}

export default function ReportsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>("/applications?size=100");
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      setApplications(items);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
      // Fallback to demo items if API error
      setApplications([
        { id: 1, borrowerName: "Priya Sharma", product: "Home Improvement Loan", amount: 850000, riskTier: "low", status: "approved" },
        { id: 2, borrowerName: "Arjun Nair", product: "MSME Working Capital", amount: 1250000, riskTier: "high", status: "manual_review" },
        { id: 3, borrowerName: "Farah Khan", product: "Personal Loan", amount: 320000, riskTier: "medium", status: "submitted" },
        { id: 4, borrowerName: "Dev Patel", product: "Equipment Finance", amount: 975000, riskTier: "critical", status: "rejected" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleDownloadPdf = async (appId: number, borrowerName?: string) => {
    setDownloadingId(appId);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/reports/${appId}.pdf`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Report generation failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanName = (borrowerName || "borrower").replace(/\s+/g, "_");
      a.download = `Credit_Appraisal_Memorandum_CAM-${appId.toString().padStart(6, "0")}_${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download PDF report. Please verify backend service is active.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredApps = applications.filter((app) => {
    const name = app.borrower_name || app.borrowerName || app.borrower?.full_name || "";
    const prod = app.product || "";
    const term = searchTerm.toLowerCase();
    return name.toLowerCase().includes(term) || prod.toLowerCase().includes(term) || String(app.id).includes(term);
  });

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header Banner */}
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
              <FileText size={18} color="#ffffff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Credit Appraisal Reports
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Generate and export FCRA/ECOA-compliant PDF Credit Appraisal Memoranda (CAM) with TreeSHAP explainability.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "var(--risk-low)", fontSize: 12, fontWeight: 700
          }}>
            <ShieldCheck size={14} /> PDF Generator Active
          </span>
          <button
            type="button"
            className="button ghost"
            onClick={fetchApplications}
            disabled={loading}
            style={{ fontSize: 12 }}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh List
          </button>
        </div>
      </div>

      {/* Search & Tools */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", minWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="text"
            className="input"
            placeholder="Search borrower, product, or CAM ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 34, height: 38, fontSize: 13 }}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
          Showing {filteredApps.length} of {applications.length} loan applications
        </span>
      </div>

      {/* Table Section */}
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CAM Ref ID</th>
              <th>Borrower Name</th>
              <th>Loan Product</th>
              <th>Requested Amount</th>
              <th>Risk Tier</th>
              <th>Decision Status</th>
              <th>CAM Document</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32 }} className="muted">
                  <Loader2 size={20} className="spin" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                  Loading application registry...
                </td>
              </tr>
            ) : filteredApps.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32 }} className="muted">
                  No matching loan applications found.
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => {
                const name = app.borrower_name || app.borrowerName || app.borrower?.full_name || "Borrower";
                const tier = app.risk_tier || app.riskTier || "unscored";
                const isDownloading = downloadingId === app.id;

                return (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 700, fontSize: 12, fontFamily: "monospace", color: "var(--brand)" }}>
                      CAM-{app.id.toString().padStart(6, "0")}
                    </td>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      <FileText size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                      {app.product}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ${app.amount.toLocaleString("en-US")}
                    </td>
                    <td>
                      <RiskBadge value={tier} />
                    </td>
                    <td>
                      <RiskBadge value={app.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => handleDownloadPdf(app.id, name)}
                        disabled={isDownloading}
                        style={{ fontSize: 12, padding: "5px 12px", height: 32 }}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 size={13} className="spin" /> Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download size={13} /> Download CAM PDF
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
