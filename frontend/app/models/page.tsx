"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, PlayCircle, BarChart2, TrendingUp } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch } from "@/lib/api";

interface ModelVersion {
  id: number;
  name: string;
  version: string;
  auc: number;
  ks_statistic: number;
  approval_state: string;
  training_dataset: string;
  is_active: boolean;
  created_at: string;
}

function MetricBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "var(--panel-strong)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand-gradient)", borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<number | null>(null);

  const fetchModels = async () => {
    try {
      const data = await apiFetch<ModelVersion[]>("/models");
      setModels(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchModels(); }, []);

  const activateModel = async (id: number) => {
    setActivating(id);
    try {
      await apiFetch(`/models/${id}/activate`, { method: "POST" });
      await fetchModels();
    } catch (err) { console.error(err); } finally { setActivating(null); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }} className="muted">Loading...</div>;

  const active = models.find((m) => m.is_active);
  const archived = models.filter((m) => !m.is_active);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Model Governance</h2>
          <p>Version registry, performance sandbox, approval state, and rollback readiness.</p>
        </div>
        <button className="button primary" type="button">
          <ShieldCheck size={16} /> Submit for approval
        </button>
      </div>

      {/* Active Model Card */}
      {active && (
        <section style={{ marginBottom: 20 }}>
          <div className="panel" style={{
            borderLeft: "4px solid var(--brand)", borderRadius: "0 12px 12px 0",
            background: "linear-gradient(135deg, var(--panel) 0%, color-mix(in srgb, var(--brand) 5%, var(--panel)) 100%)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: "rgba(16,185,129,0.15)", color: "var(--risk-low)",
                  }}>ACTIVE IN PRODUCTION</span>
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>{active.name}</h3>
                <span className="muted" style={{ fontSize: 13 }}>{active.version} · {active.training_dataset}</span>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>{active.auc}</div>
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>AUC-ROC</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>{active.ks_statistic}</div>
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>KS STAT</div>
                </div>
                {active.version.includes("xgboost") || active.version.includes("v1") ? (
                  <>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>84.6%</div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>PRECISION</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>79.2%</div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>RECALL</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>0.818</div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>F1 SCORE</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)" }}>45%</div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>THRESHOLD</div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Model Comparison Sandbox */}
      {models.length >= 2 && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>
            <BarChart2 size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
            Model Performance Sandbox
          </h3>
          <div className="grid cols-2" style={{ gap: 16 }}>
            {models.map((m) => (
              <div key={m.id} className="panel" style={{
                border: m.is_active ? "1px solid var(--brand)" : "1px solid var(--line)",
                opacity: m.approval_state === "archived" ? 0.75 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{m.version}</div>
                  </div>
                  <RiskBadge value={m.approval_state} />
                </div>
                <MetricBar label="AUC-ROC (discrimination)" value={m.auc} />
                <MetricBar label="KS Statistic (separation)" value={m.ks_statistic} />
                {(m.version.includes("xgboost") || m.version.includes("v1")) && (
                  <>
                    <MetricBar label="Precision" value={0.846} max={1} />
                    <MetricBar label="Recall (Sensitivity)" value={0.792} max={1} />
                    <MetricBar label="F1 Score" value={0.818} max={1} />
                  </>
                )}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {m.is_active ? "🟢 Currently active" : `📦 ${m.approval_state}`}
                  </span>
                  {!m.is_active && m.approval_state !== "archived" && (
                    <button className="button ghost" onClick={() => activateModel(m.id)} disabled={activating === m.id} style={{ fontSize: 12, padding: "4px 10px" }}>
                      <PlayCircle size={13} />
                      {activating === m.id ? "Activating…" : "Activate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Registry Table */}
      <section className="table-wrap">
        <div className="table-tools"><h3>Version Registry</h3></div>
        <table>
          <thead>
            <tr>
              <th>Model</th><th>Version</th><th>AUC</th><th>KS</th>
              <th>Dataset</th><th>Status</th><th>Active</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</td>
                <td className="muted" style={{ fontSize: 12 }}>{m.version}</td>
                <td style={{ fontWeight: 700 }}>{m.auc}</td>
                <td style={{ fontWeight: 700 }}>{m.ks_statistic}</td>
                <td className="muted" style={{ fontSize: 12 }}>{m.training_dataset}</td>
                <td><RiskBadge value={m.approval_state} /></td>
                <td>
                  <span style={{ fontWeight: 700, color: m.is_active ? "var(--risk-low)" : "var(--muted)" }}>
                    {m.is_active ? "✓ Yes" : "No"}
                  </span>
                </td>
                <td>
                  {!m.is_active && m.approval_state !== "archived" && (
                    <button className="button ghost" onClick={() => activateModel(m.id)} disabled={activating === m.id} style={{ fontSize: 12, padding: "4px 10px" }}>
                      <PlayCircle size={13} />
                      {activating === m.id ? "Activating…" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={16} />Retraining Queue</h3>
          <p className="muted" style={{ fontSize: 13 }}>14 overrides and 23 repayment signals are available as candidate training labels for the next retraining window.</p>
        </div>
        <div className="panel">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} />Rollback Readiness</h3>
          <p className="muted" style={{ fontSize: 13 }}>Baseline logistic model is archived and available for emergency rollback. Activation requires Admin approval and audit-log confirmation.</p>
        </div>
      </section>
    </>
  );
}
