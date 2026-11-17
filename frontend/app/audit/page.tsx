"use client";

import { useEffect, useState, useMemo } from "react";
import { ClipboardList, RefreshCw, Search, Download, User, Clock, ChevronDown, ChevronUp, Shield, Zap, Scale, FileText, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: number;
  actor_id: number | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  metadata_json: Record<string, any>;
  created_at: string;
}

const ACTION_META: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  "application.created":   { color: "#6366f1", bg: "rgba(99,102,241,0.12)",   label: "Application", icon: FileText },
  "application.scored":    { color: "#10b981", bg: "rgba(16,185,129,0.12)",   label: "Scored",      icon: Zap },
  "override.submitted":    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "Override",    icon: Scale },
  "model.activated":       { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",   label: "Model",       icon: Shield },
  "fairness.audit_run":    { color: "#06b6d4", bg: "rgba(6,182,212,0.12)",    label: "Fairness",    icon: Scale },
  "user.created":          { color: "#10b981", bg: "rgba(16,185,129,0.12)",   label: "User Added",  icon: User },
  "user.deleted":          { color: "#ef4444", bg: "rgba(239,68,68,0.12)",    label: "User Removed",icon: User },
  "user.password_changed": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "Security",    icon: KeyRound },
  "borrower.created":      { color: "#6366f1", bg: "rgba(99,102,241,0.12)",   label: "Borrower",    icon: User },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { color: "var(--muted)", bg: "rgba(148,163,184,0.1)", label: "Event", icon: ClipboardList };
}

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* Helper to render human-readable summary of Who did What */
function renderActionSummary(log: AuditLog) {
  const actor = log.actor_name ?? (log.actor_id ? `User #${log.actor_id}` : "System Automated Process");
  const m = log.metadata_json || {};

  switch (log.action) {
    case "override.submitted":
      return (
        <span>
          <strong>{actor}</strong> submitted a human override for <strong>Application #{log.entity_id}</strong> to decision <strong style={{ color: m.decision === "approve" ? "var(--risk-low)" : "var(--risk-critical)", textTransform: "uppercase" }}>{m.decision}</strong>. Reason: <em>"{m.reason_code}"</em>.
        </span>
      );
    case "application.scored":
      return (
        <span>
          <strong>{actor}</strong> triggered AI risk scoring for <strong>Application #{m.application_id ?? log.entity_id}</strong>. Assigned Tier: <strong style={{ color: m.risk_tier === "low" ? "var(--risk-low)" : m.risk_tier === "medium" ? "var(--risk-medium)" : "var(--risk-critical)", textTransform: "uppercase" }}>{m.risk_tier ?? "Scored"}</strong> (PD: {m.probability_default ? `${(m.probability_default * 100).toFixed(1)}%` : "N/A"}).
        </span>
      );
    case "application.created":
      return (
        <span>
          <strong>{actor}</strong> registered a new loan application <strong>#{log.entity_id}</strong> ({m.product ?? "Loan"} for ₹{m.amount ? m.amount.toLocaleString("en-IN") : "N/A"}).
        </span>
      );
    case "borrower.created":
      return (
        <span>
          <strong>{actor}</strong> onboarded new borrower <strong>{m.full_name ?? `Borrower #${log.entity_id}`}</strong> (Credit Score: {m.credit_score ?? "N/A"}, City: {m.city ?? "N/A"}).
        </span>
      );
    case "user.created":
      return (
        <span>
          <strong>{actor}</strong> created a new user account for <strong>{m.email}</strong> with role <strong>{m.role}</strong>.
        </span>
      );
    case "user.deleted":
      return (
        <span>
          <strong>{actor}</strong> removed user account <strong>{m.email}</strong> from the system.
        </span>
      );
    case "user.password_changed":
      return (
        <span>
          <strong>{actor}</strong> successfully updated their platform account password.
        </span>
      );
    case "model.activated":
      return (
        <span>
          <strong>{actor}</strong> activated model version <strong>{m.version ?? `Model #${log.entity_id}`}</strong> ({m.name ?? "Ensemble Model"}, AUC: {m.auc ?? "N/A"}).
        </span>
      );
    case "fairness.audit_run":
      return (
        <span>
          <strong>{actor}</strong> executed a bias fairness audit for protected attribute <strong>"{m.protected_attribute ?? "gender"}"</strong>. Result: <strong style={{ color: m.status === "passed" ? "var(--risk-low)" : "var(--risk-medium)" }}>{m.status?.toUpperCase() ?? "COMPLETED"}</strong> ({m.alert_count ?? 0} alerts).
        </span>
      );
    default:
      return (
        <span>
          <strong>{actor}</strong> performed action <strong>{log.action}</strong> on {log.entity_type} #{log.entity_id ?? "N/A"}.
        </span>
      );
  }
}

function exportCSV(logs: AuditLog[]) {
  const header = ["ID", "Timestamp", "Action", "Entity Type", "Entity ID", "Actor Name", "Actor ID", "Details JSON"];
  const rows = logs.map((l) => [
    l.id,
    new Date(l.created_at).toISOString(),
    l.action,
    l.entity_type,
    l.entity_id ?? "",
    l.actor_name ?? "System",
    l.actor_id ?? "",
    JSON.stringify(l.metadata_json),
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-export-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AuditLog[]>("/audit-logs?limit=200");
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (actionFilter !== "all") result = result.filter((l) => l.action === actionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q) ||
          String(l.entity_id).includes(q) ||
          (l.actor_name ?? "").toLowerCase().includes(q) ||
          JSON.stringify(l.metadata_json).toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, actionFilter, logs]);

  // Group by date for timeline
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of filtered) {
      const date = new Date(log.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(log);
    }
    return map;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: logs.length,
    overrides: logs.filter((l) => l.action.includes("override")).length,
    scored: logs.filter((l) => l.action.includes("scored")).length,
    model: logs.filter((l) => l.action.includes("model")).length,
  }), [logs]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Audit Trail &amp; Governance Inspector</h2>
          <p>Complete, immutable record of who performed what action across the platform with full parameters.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button ghost" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <Download size={15} /> Export CSV
          </button>
          <button className="button ghost" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Total Recorded Events", value: stats.total, color: "var(--brand)" },
          { label: "Human Overrides", value: stats.overrides, color: "#f59e0b" },
          { label: "AI Risk Scoring Events", value: stats.scored, color: "#10b981" },
          { label: "Model Governance", value: stats.model, color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} className="panel" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} className="muted" style={{ position: "absolute", left: 10, top: 11 }} />
          <input
            className="input"
            placeholder="Search by actor name, action, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Action type pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setActionFilter("all")}
            style={{
              padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid",
              borderColor: actionFilter === "all" ? "var(--brand)" : "var(--line)",
              background: actionFilter === "all" ? "rgba(99,102,241,0.15)" : "transparent",
              color: actionFilter === "all" ? "var(--brand)" : "var(--muted)",
            }}
          >All</button>
          {uniqueActions.map((a) => {
            const meta = getActionMeta(a);
            const active = actionFilter === a;
            return (
              <button key={a} onClick={() => setActionFilter(active ? "all" : a)} style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid",
                borderColor: active ? meta.color : "var(--line)",
                background: active ? meta.bg : "transparent",
                color: active ? meta.color : "var(--muted)",
              }}>
                {a.split(".").pop()}
              </button>
            );
          })}
        </div>
        <span className="muted" style={{ fontSize: 12, marginLeft: "auto", whiteSpace: "nowrap" }}>
          Showing {filtered.length} of {logs.length} events
        </span>
      </div>

      {/* Timeline List */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }} className="muted">Loading audit trail...</div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 60, textAlign: "center" }}>
          <ClipboardList size={40} className="muted" style={{ marginBottom: 12 }} />
          <p className="muted">No audit events match your search or filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 32 }}>
          {Array.from(grouped.entries()).map(([date, dayLogs]) => (
            <div key={date}>
              {/* Date Group Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{
                  padding: "3px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800,
                  background: "var(--panel)", border: "1px solid var(--line)", color: "var(--text)",
                  whiteSpace: "nowrap",
                }}>
                  {date}
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span className="muted" style={{ fontSize: 11 }}>{dayLogs.length} events</span>
              </div>

              {/* Event Cards Rail */}
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{
                  position: "absolute", left: 10, top: 0, bottom: 0, width: 2,
                  background: "linear-gradient(to bottom, var(--brand), transparent)",
                  borderRadius: 2,
                }} />

                <div style={{ display: "grid", gap: 12 }}>
                  {dayLogs.map((log) => {
                    const meta = getActionMeta(log.action);
                    const ActionIcon = meta.icon;
                    const dt = new Date(log.created_at);
                    const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const relative = formatRelativeTime(log.created_at);
                    const hasMetadata = Object.keys(log.metadata_json || {}).length > 0;
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <div key={log.id} style={{ position: "relative" }}>
                        {/* Dot */}
                        <div style={{
                          position: "absolute", left: -24, top: 18,
                          width: 10, height: 10, borderRadius: "50%",
                          background: meta.color,
                          boxShadow: `0 0 0 3px ${meta.bg}`,
                          border: `2px solid ${meta.color}`,
                        }} />

                        <div className="panel" style={{
                          padding: "14px 18px",
                          borderLeft: `4px solid ${meta.color}`,
                          borderRadius: "0 12px 12px 0",
                        }}>
                          {/* Header row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                                background: meta.bg, color: meta.color,
                              }}>
                                <ActionIcon size={12} />
                                {meta.label}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                {log.action}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                              <span className="muted" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} /> {timeStr}
                              </span>
                              <span className="muted" style={{ fontSize: 11 }}>({relative})</span>
                            </div>
                          </div>

                          {/* Narrative sentence: Who did What */}
                          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
                            {renderActionSummary(log)}
                          </div>

                          {/* Actor Badge + Quick Metadata Chips */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--brand)" }}>
                              <User size={13} />
                              {log.actor_name ?? (log.actor_id ? `User #${log.actor_id}` : "System Automated")}
                            </div>

                            {/* Metadata Quick Chips */}
                            {hasMetadata && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {Object.entries(log.metadata_json).slice(0, 4).map(([k, v]) => (
                                  <span key={k} style={{
                                    fontSize: 11, padding: "2px 8px", borderRadius: 6,
                                    background: "var(--bg)", border: "1px solid var(--line)",
                                    color: "var(--muted)", fontWeight: 500,
                                  }}>
                                    <strong>{k.replace(/_/g, " ")}:</strong> {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Technical Details Toggle */}
                            {hasMetadata && (
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                style={{
                                  marginLeft: "auto", background: "none", border: "none",
                                  color: "var(--muted)", fontSize: 11, fontWeight: 700,
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                                  padding: "2px 6px", borderRadius: 4,
                                }}
                              >
                                {isExpanded ? <>Hide Specs <ChevronUp size={13} /></> : <>Full Parameters <ChevronDown size={13} /></>}
                              </button>
                            )}
                          </div>

                          {/* Expandable JSON Viewer */}
                          {isExpanded && hasMetadata && (
                            <div style={{
                              marginTop: 12, padding: 12, borderRadius: 8,
                              background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                              fontFamily: "monospace", fontSize: 11, color: "#a5b4fc",
                              overflowX: "auto",
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 6, fontFamily: "inherit" }}>
                                FULL PAYLOAD PARAMETERS (JSON):
                              </div>
                              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                {JSON.stringify(log.metadata_json, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
