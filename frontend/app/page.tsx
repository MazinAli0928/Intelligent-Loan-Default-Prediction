"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle, FileWarning, TrendingUp, Loader2,
  Activity, ShieldCheck, BarChart3, Zap, Users, Clock,
  ChevronRight, ArrowUpRight, ArrowDownRight, CircleDot,
} from "lucide-react";
import { ApplicationTable } from "@/components/application-table";
import { DriverChart } from "@/components/driver-chart";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch } from "@/lib/api";

interface DashboardSummary {
  total_applications: number;
  high_risk_cases: number;
  average_pd: number;
  fairness_alerts: number;
  active_model: string;
  risk_distribution: { low: number; medium: number; high: number; critical: number };
  recent_queue: Array<{
    id: number; borrower: string; amount: number;
    status: string; risk_tier: string; reviewer: string;
  }>;
}

/* ── Animated counter hook ─────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

/* ── SVG Donut chart ───────────────────────────────────────────── */
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 54, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * circ;
    const slice = { ...d, dash, offset, pct };
    offset += dash;
    return slice;
  });
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={136} height={136} viewBox="0 0 136 136">
          <circle cx={68} cy={68} r={r} fill="none" stroke="var(--line)" strokeWidth={18} />
          {slices.map((s) => (
            <circle key={s.label} cx={68} cy={68} r={r} fill="none" stroke={s.color}
              strokeWidth={hovered === s.label ? 22 : 18}
              strokeDasharray={`${s.dash} ${circ - s.dash}`}
              strokeDashoffset={-(s.offset - circ * 0.25)}
              strokeLinecap="round"
              style={{ transition: "stroke-width 0.2s, opacity 0.2s", opacity: hovered && hovered !== s.label ? 0.35 : 1, cursor: "pointer" }}
              onMouseEnter={() => setHovered(s.label)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text x={68} y={63} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: "var(--ink)", fontFamily: "Inter,sans-serif" }}>{total}</text>
          <text x={68} y={80} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)", fontFamily: "Inter,sans-serif" }}>TOTAL</text>
        </svg>
      </div>
      <div style={{ display: "grid", gap: 10, flex: 1 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", opacity: hovered && hovered !== s.label ? 0.4 : 1, transition: "opacity 0.2s" }}
            onMouseEnter={() => setHovered(s.label)} onMouseLeave={() => setHovered(null)}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: `0 0 8px ${s.color}88` }} />
            <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, textTransform: "capitalize" }}>{s.label}</span>
            <strong style={{ fontSize: 13, fontWeight: 700 }}>{s.value}</strong>
            <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 36, textAlign: "right" }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── AUC Arc Gauge ─────────────────────────────────────────────── */
function AucGauge({ value }: { value: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  const r = 42;
  const circ = 2 * Math.PI * r;
  const trackLen = circ * (240 / 360);
  const gapLen = circ - trackLen;
  const filledLen = animated * trackLen;
  const grade = value >= 0.9 ? "#34d399" : value >= 0.8 ? "#6366f1" : value >= 0.7 ? "#fbbf24" : "#f87171";
  const rot = `rotate(150, 60, 62)`;

  return (
    <svg width={120} height={96} viewBox="0 0 120 96">
      <circle cx={60} cy={62} r={r} fill="none"
        stroke="var(--line)" strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${trackLen} ${gapLen}`}
        transform={rot}
      />
      <circle cx={60} cy={62} r={r} fill="none"
        stroke={grade} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${filledLen} ${circ - filledLen}`}
        transform={rot}
        style={{ transition: "stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
      />
      <text x={60} y={57} textAnchor="middle"
        style={{ fontSize: 19, fontWeight: 800, fill: grade, fontFamily: "Inter,sans-serif" }}>
        {(value * 100).toFixed(1)}%
      </text>
      <text x={60} y={72} textAnchor="middle"
        style={{ fontSize: 9, fill: "var(--muted)", fontFamily: "Inter,sans-serif", letterSpacing: "0.08em" }}>
        AUC-ROC
      </text>
    </svg>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ label, value, raw, subtitle, icon: Icon, color, trend, trendLabel }: {
  label: string; value: string; raw: number; subtitle?: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string; trend?: "up" | "down" | "neutral"; trendLabel?: string;
}) {
  const count = useCountUp(raw);
  const display = value.includes("%") ? `${count}%` : `${count}`;
  return (
    <article style={{
      background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden",
      cursor: "default", transition: "transform 0.22s ease, box-shadow 0.22s ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${color}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: "16px 16px 0 0", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "grid", placeItems: "center", border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600,
            color: trend === "up" ? "var(--risk-low)" : trend === "down" ? "var(--risk-critical)" : "var(--muted)" }}>
            {trend === "up" ? <ArrowUpRight size={13} /> : trend === "down" ? <ArrowDownRight size={13} /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase" }}>{label}</p>
        <strong style={{ display: "block", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{display}</strong>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, color }}>{subtitle}</p>}
      </div>
    </article>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────── */
export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  const fetchSummary = async () => {
    try {
      const data = await apiFetch<DashboardSummary>("/dashboard/summary");
      setSummary(data);
    } catch (err) {
      console.error("Failed to load dashboard summary", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleBatchScoring = async () => {
    setScoring(true);
    try {
      interface Application { id: number; status: string; }
      const res = await apiFetch<any>("/applications?size=100");
      const apps: Application[] = Array.isArray(res) ? res : (res?.items ?? []);
      const submittedApps = apps.filter((app) => app.status === "submitted");
      for (const app of submittedApps) { await apiFetch(`/applications/${app.id}/score`, { method: "POST" }); }
      await fetchSummary();
    } catch (err) {
      console.error("Batch scoring failed", err);
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--brand)", animation: "spin 0.8s linear infinite" }} />
          <Activity size={20} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "var(--brand)" }} />
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Loading Risk Command Center…</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const highRisk = summary?.high_risk_cases ?? 0;
  const averagePd = summary?.average_pd ?? 0;
  const totalApps = summary?.total_applications ?? 0;
  const fairnessAlerts = summary?.fairness_alerts ?? 0;
  const dist = summary?.risk_distribution ?? { low: 0, medium: 0, high: 0, critical: 0 };

  const attentionItems = summary?.recent_queue.filter(
    (item) => item.status === "manual_review" || item.risk_tier === "critical"
  ) || [];

  const donutData = [
    { label: "Low Risk", value: dist.low, color: "#34d399" },
    { label: "Medium", value: dist.medium, color: "#fbbf24" },
    { label: "High", value: dist.high, color: "#fb923c" },
    { label: "Critical", value: dist.critical, color: "#f87171" },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .dash-s { animation: fadeUp 0.45s ease both; }
        .dash-s:nth-child(2) { animation-delay:0.08s }
        .dash-s:nth-child(3) { animation-delay:0.16s }
        .dash-s:nth-child(4) { animation-delay:0.24s }
        .dash-s:nth-child(5) { animation-delay:0.32s }
        .dash-s:nth-child(6) { animation-delay:0.40s }
        .q-item:hover { background: var(--panel-strong) !important; }
      `}</style>

      {/* ── HERO HEADER ─────────────────────────────────────────── */}
      <div className="dash-s" style={{
        background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#0f172a 100%)",
        borderRadius: 20, padding: "28px 32px", marginBottom: 22,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        position: "relative", overflow: "hidden", border: "1px solid rgba(99,102,241,0.2)",
        boxShadow: "0 8px 40px rgba(99,102,241,0.12)",
      }}>
        {/* dot-grid pattern */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.18 }} aria-hidden>
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="#818cf8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
          {/* fade-out mask on the left so dots don't compete with text */}
          <rect width="40%" height="100%" fill="url(#fade-left)" />
          <defs>
            <linearGradient id="fade-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {/* right-side accent bar */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 4, background: "linear-gradient(180deg,#6366f1,#8b5cf6,#34d399)", borderRadius: "0 20px 20px 0", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399", animation: "livePulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live Portfolio Monitoring</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.15,
            background: "linear-gradient(135deg,#ffffff 0%,#c4b5fd 50%,#818cf8 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Risk Command Center
          </h2>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14, maxWidth: 500 }}>
            Portfolio health, credit risk queues, fairness posture, and active AI model performance — in real time.
          </p>
        </div>
        <button className="button primary" type="button" onClick={handleBatchScoring} disabled={scoring}
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.5)", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 14, position: "relative", zIndex: 1, flexShrink: 0 }}>
          {scoring ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Zap size={16} />}
          {scoring ? "Scoring…" : "Run Batch Scoring"}
        </button>
      </div>

      {/* ── STAT CARDS ──────────────────────────────────────────── */}
      <div className="dash-s" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard label="Total Applications" value={`${totalApps}`} raw={totalApps} subtitle="+12% this week" icon={Users} color="#6366f1" trend="up" trendLabel="+12%" />
        <StatCard label="High-Risk Cases" value={`${highRisk}`} raw={highRisk} subtitle={`${highRisk} need review`} icon={AlertTriangle} color="#f87171" trend={highRisk > 5 ? "down" : "neutral"} trendLabel={highRisk > 5 ? "Above threshold" : "In control"} />
        <StatCard label="Average PD" value={`${Math.round(averagePd * 100)}%`} raw={Math.round(averagePd * 100)} subtitle="Within risk appetite" icon={Activity} color="#fbbf24" trend="neutral" trendLabel="Stable" />
        <StatCard label="Fairness Alerts" value={`${fairnessAlerts}`} raw={fairnessAlerts} subtitle="Gender gap review" icon={ShieldCheck} color={fairnessAlerts > 0 ? "#fb923c" : "#34d399"} trend={fairnessAlerts > 0 ? "down" : "up"} trendLabel={fairnessAlerts > 0 ? "Needs attention" : "All clear"} />
      </div>

      {/* ── RISK DISTRIBUTION + MODEL HEALTH ─────────────────────── */}
      <div className="dash-s" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Portfolio Risk Distribution</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>Breakdown by risk tier across all applications</p>
            </div>
            <BarChart3 size={18} style={{ color: "var(--muted)" }} />
          </div>
          <DonutChart data={donutData} />
        </div>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>AI Model Health</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>Active champion model metrics</p>
            </div>
            <ShieldCheck size={18} style={{ color: "var(--risk-low)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AucGauge value={0.932} />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { label: "KS Statistic", value: "0.729", pct: 72.9, color: "#6366f1" },
                { label: "Precision", value: "84.6%", pct: 84.6, color: "#34d399" },
                { label: "Recall (Sensitivity)", value: "79.2%", pct: 79.2, color: "#fbbf24" },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)", fontWeight: 500 }}>{m.label}</span>
                    <strong style={{ fontWeight: 700 }}>{m.value}</strong>
                  </div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 99, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${m.color}88` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(52,211,153,0.06)", borderRadius: 10, border: "1px solid rgba(52,211,153,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CircleDot size={13} style={{ color: "#34d399" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#34d399" }}>CHAMPION — PRODUCTION</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 140, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary?.active_model}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── EXPLAINABILITY + ATTENTION QUEUE ─────────────────────── */}
      <div className="dash-s" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Top Explainability Drivers</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>SHAP feature contributions to default probability</p>
            </div>
            <BarChart3 size={18} style={{ color: "var(--muted)" }} />
          </div>
          <DriverChart />
        </div>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Attention Queue</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>Cases requiring immediate review</p>
            </div>
            <Clock size={18} style={{ color: "var(--muted)" }} />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => {
                const isCritical = item.risk_tier === "critical";
                const accent = isCritical ? "#f87171" : "#fb923c";
                return (
                  <div key={item.id} className="q-item" style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                    borderRadius: 10, border: `1px solid ${accent}28`, background: `${accent}08`,
                    cursor: "pointer", transition: "background 0.18s ease",
                  }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accent}18`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {isCritical ? <FileWarning size={15} style={{ color: accent }} /> : <AlertTriangle size={15} style={{ color: accent }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.borrower}</p>
                      <p style={{ margin: 0, fontSize: 11, color: accent, fontWeight: 600, marginTop: 2 }}>{isCritical ? "Critical Risk" : "Manual Review"} · #{item.id}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                  </div>
                );
              })
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", borderRadius: 12, background: "rgba(52,211,153,0.04)", border: "1px dashed rgba(52,211,153,0.25)" }}>
                <ShieldCheck size={28} style={{ color: "#34d399" }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#34d399" }}>All Clear</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>No pending attention items.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── APPLICATION TABLE ──────────────────────────────────── */}
      <div className="dash-s">
        <ApplicationTable />
      </div>
    </>
  );
}
