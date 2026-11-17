"use client";

import { useEffect, useState } from "react";
import { Scale, ShieldCheck, ShieldOff } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch } from "@/lib/api";

interface FairnessAudit {
  id: number;
  model_version: string;
  protected_attribute: string;
  metrics: {
    demographic_parity_gap: number;
    equalized_odds_proxy_gap: number;
    groups: Record<string, { count: number; approval_rate: number; high_risk_rate: number; average_pd: number }>;
    thresholds: { demographic_parity_gap: number; equalized_odds_proxy_gap: number };
  };
  alert_count: number;
  status: string;
  created_at: string;
}

export default function FairnessPage() {
  const [audits, setAudits] = useState<FairnessAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [mitigation, setMitigation] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAudits = async () => {
    try {
      const data = await apiFetch<FairnessAudit[]>("/fairness/audits");
      setAudits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMitigation = async () => {
    try {
      const data = await apiFetch<{ mitigation_active: boolean }>("/fairness/mitigation/status");
      setMitigation(data.mitigation_active);
    } catch { /* non-admin won't have access */ }
  };

  const checkRole = async () => {
    try {
      const me = await apiFetch<{ role: { name: string } }>("/me");
      setIsAdmin(me.role.name === "Admin");
    } catch { /* */ }
  };

  useEffect(() => {
    fetchAudits();
    fetchMitigation();
    checkRole();
  }, []);

  const runAudit = async () => {
    setRunning(true);
    try {
      await apiFetch("/fairness/audits/run", { method: "POST" });
      await fetchAudits();
    } catch (err) { console.error(err); } finally { setRunning(false); }
  };

  const toggleMitigation = async () => {
    setToggling(true);
    try {
      const data = await apiFetch<{ mitigation_active: boolean }>("/fairness/mitigation/toggle", { method: "POST" });
      setMitigation(data.mitigation_active);
    } catch (e) { console.error(e); } finally { setToggling(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }} className="muted">Loading...</div>;

  const audit = audits[0] || null;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Fairness Audit</h2>
          <p>Protected-group monitoring, threshold alerts, mitigation controls, and compliance history.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {isAdmin && (
            <button
              className={`button ${mitigation ? "" : "ghost"}`}
              onClick={toggleMitigation}
              disabled={toggling}
              style={{
                background: mitigation ? "rgba(16,185,129,0.15)" : undefined,
                color: mitigation ? "var(--risk-low)" : undefined,
                borderColor: mitigation ? "var(--risk-low)" : undefined,
              }}
            >
              {mitigation ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
              {toggling ? "Updating…" : mitigation ? "Mitigation ON" : "Mitigation OFF"}
            </button>
          )}
          <button className="button primary" type="button" onClick={runAudit} disabled={running}>
            <Scale size={16} /> {running ? "Running…" : "Run audit"}
          </button>
        </div>
      </div>

      {/* Mitigation Banner */}
      {mitigation && (
        <div style={{
          padding: "12px 18px", borderRadius: 10, marginBottom: 16,
          background: "rgba(16,185,129,0.12)", border: "1px solid var(--risk-low)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <ShieldCheck size={18} style={{ color: "var(--risk-low)", flexShrink: 0 }} />
          <div>
            <strong style={{ color: "var(--risk-low)" }}>Fairness Mitigation Active</strong>
            <span className="muted" style={{ fontSize: 13, marginLeft: 10 }}>
              A post-processing correction of −8pp PD is applied to female borrowers to reduce demographic parity gap.
            </span>
          </div>
        </div>
      )}

      {audit ? (
        <>
          <section className="grid cols-3">
            {[
              {
                label: "Demographic Parity Gap", value: audit.metrics?.demographic_parity_gap ?? 0,
                threshold: audit.metrics?.thresholds?.demographic_parity_gap ?? 0.18,
              },
              {
                label: "Equalized Odds Proxy", value: audit.metrics?.equalized_odds_proxy_gap ?? 0,
                threshold: audit.metrics?.thresholds?.equalized_odds_proxy_gap ?? 0.22,
              },
              { label: "Open Alerts", value: audit.alert_count, threshold: 0 },
            ].map((item) => {
              const breached = item.threshold > 0 && item.value > item.threshold;
              return (
                <div key={item.label} className="panel" style={{
                  borderLeft: `3px solid ${breached ? "var(--risk-critical)" : "var(--risk-low)"}`,
                  borderRadius: "0 12px 12px 0",
                }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{item.label.toUpperCase()}</span>
                  <div style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 4px", color: breached ? "var(--risk-critical)" : "var(--ink)" }}>
                    {typeof item.value === "number" && item.threshold > 0 ? item.value.toFixed(3) : item.value}
                  </div>
                  {item.threshold > 0 && (
                    <span style={{ fontSize: 12, color: breached ? "var(--risk-critical)" : "var(--risk-low)", fontWeight: 700 }}>
                      {breached ? `⚠ Exceeds threshold (${item.threshold})` : `✓ Within threshold (${item.threshold})`}
                    </span>
                  )}
                </div>
              );
            })}
          </section>

          <section className="table-wrap" style={{ marginTop: 14 }}>
            <div className="table-tools">
              <h3>Protected Group Comparison</h3>
              <RiskBadge value={audit.status} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Applications</th>
                  <th>Approval Rate</th>
                  <th>High-Risk Rate</th>
                  <th>Average PD</th>
                  <th>Fairness Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(audit.metrics?.groups || {}).map(([group, m]) => {
                  const approvalRates = Object.values(audit.metrics?.groups || {}).map((g) => g.approval_rate);
                  const maxRate = Math.max(...approvalRates);
                  const gap = maxRate - m.approval_rate;
                  return (
                    <tr key={group}>
                      <td style={{ fontWeight: 600 }}>{group}</td>
                      <td>{m.count}</td>
                      <td>{Math.round(m.approval_rate * 100)}%</td>
                      <td>{Math.round(m.high_risk_rate * 100)}%</td>
                      <td>{Math.round(m.average_pd * 100)}%</td>
                      <td>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: gap > 0.15 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                          color: gap > 0.15 ? "var(--risk-critical)" : "var(--risk-low)",
                        }}>
                          {gap > 0.15 ? `Gap −${Math.round(gap * 100)}pp` : "Fair"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="panel" style={{ marginTop: 14 }}>
            <h3>Compliance Notes</h3>
            <textarea className="textarea" defaultValue="Investigate whether channel mix or segment composition explains the observed approval-rate gap before changing model thresholds." />
          </section>
        </>
      ) : (
        <div className="panel" style={{ textAlign: "center", padding: 48 }}>
          <Scale size={40} className="muted" style={{ marginBottom: 12 }} />
          <p className="muted">No audit results yet. Click <strong>Run audit</strong> to generate the first fairness report.</p>
        </div>
      )}
    </>
  );
}
