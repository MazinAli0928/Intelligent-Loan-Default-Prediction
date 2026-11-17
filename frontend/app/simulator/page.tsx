"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sliders, TrendingUp, TrendingDown, Zap, RefreshCw, Activity } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { apiFetch } from "@/lib/api";

interface SimResult {
  probability_default: number;
  risk_tier: string;
  confidence: number;
  recommendation: string;
  explanation: Array<{ label: string; value: string; contribution: number; direction: string }>;
  narrative: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SliderField = ({
  label, min, max, step, value, onChange, format
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
        <span style={{
          fontSize: 13, fontWeight: 800, color: "var(--brand)",
          background: "rgba(99,102,241,0.1)", padding: "1px 8px", borderRadius: 6,
        }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span className="muted" style={{ fontSize: 10 }}>{format ? format(min) : min}</span>
        <div style={{
          height: 3, flex: 1, margin: "0 8px", borderRadius: 99,
          background: `linear-gradient(to right, var(--brand) ${pct}%, var(--line) ${pct}%)`,
          alignSelf: "center",
        }} />
        <span className="muted" style={{ fontSize: 10 }}>{format ? format(max) : max}</span>
      </div>
    </div>
  );
};

function PdGauge({ pd }: { pd: number }) {
  const color = pd < 0.18 ? "#10b981" : pd < 0.34 ? "#f59e0b" : pd < 0.55 ? "#ef4444" : "#7f1d1d";
  const angle = pd * 180; // 0–180 degrees
  const r = 70;
  const cx = 90, cy = 90;
  const toRad = (deg: number) => (deg - 180) * (Math.PI / 180);
  const x = cx + r * Math.cos(toRad(angle));
  const y = cy + r * Math.sin(toRad(angle));

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 180 100" width="200" height="110" style={{ overflow: "visible" }}>
        {/* Background arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
        {/* Colored arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`}
          fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          style={{ transition: "all 0.6s ease" }}
        />
        {/* Needle dot */}
        <circle cx={x} cy={y} r="7" fill={color} style={{ transition: "all 0.6s ease" }} />
        {/* Center value */}
        <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 22, fontWeight: 900, fill: color, fontFamily: "inherit" }}>
          {(pd * 100).toFixed(1)}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)", fontFamily: "inherit" }}>
          PROBABILITY OF DEFAULT
        </text>
        {/* Scale labels */}
        <text x={cx - r - 4} y={cy + 16} textAnchor="end" style={{ fontSize: 9, fill: "var(--muted)", fontFamily: "inherit" }}>0%</text>
        <text x={cx + r + 4} y={cy + 16} textAnchor="start" style={{ fontSize: 9, fill: "var(--muted)", fontFamily: "inherit" }}>100%</text>
      </svg>
    </div>
  );
}

export default function SimulatorPage() {
  const [income, setIncome] = useState(98000);
  const [expenses, setExpenses] = useState(55000);
  const [creditScore, setCreditScore] = useState(680);
  const [amount, setAmount] = useState(800000);
  const [tenure, setTenure] = useState(36);
  const [existingLoans, setExistingLoans] = useState(1);
  const [employment, setEmployment] = useState(4);
  const [savings, setSavings] = useState(0.65);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  const params = { income, expenses, creditScore, amount, tenure, existingLoans, employment, savings };
  const debouncedParams = useDebounce(params, 800);

  const run = useCallback(async (p = params) => {
    setLoading(true);
    try {
      const data = await apiFetch<SimResult>("/score/simulate", {
        method: "POST",
        body: JSON.stringify({
          income: p.income, expenses: p.expenses, credit_score: p.creditScore,
          amount: p.amount, tenure_months: p.tenure, existing_loans: p.existingLoans,
          employment_years: p.employment, savings_consistency: p.savings,
        }),
      });
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run when debounced params change
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (autoMode) run(debouncedParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedParams, autoMode]);

  const fmt = (v: number) => `$${v.toLocaleString("en-US")}`;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>What-If Risk Simulator</h2>
          <p>Adjust financial parameters and preview how risk score changes — with live auto-simulation.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <div
              onClick={() => setAutoMode(!autoMode)}
              style={{
                width: 42, height: 24, borderRadius: 999, position: "relative",
                background: autoMode ? "var(--brand)" : "var(--line)",
                cursor: "pointer", transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: autoMode ? 20 : 3, width: 18, height: 18,
                borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
            Live Mode
          </label>
          <Sliders size={22} className="muted" />
        </div>
      </div>

      <div className="split" style={{ gap: 16, alignItems: "start" }}>
        {/* Left: Controls */}
        <div className="panel" style={{ flex: "1 1 360px", position: "sticky", top: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0 }}>Borrower Parameters</h3>
            {autoMode && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                <Activity size={11} /> LIVE
              </span>
            )}
          </div>

          <SliderField label="Monthly Income" min={20000} max={500000} step={5000} value={income} onChange={setIncome} format={fmt} />
          <SliderField label="Monthly Expenses" min={10000} max={400000} step={5000} value={expenses} onChange={setExpenses} format={fmt} />
          <SliderField label="FICO Credit Score" min={300} max={850} step={10} value={creditScore} onChange={setCreditScore} />
          <SliderField label="Loan Amount" min={50000} max={5000000} step={50000} value={amount} onChange={setAmount} format={fmt} />
          <SliderField label="Tenure (months)" min={6} max={84} step={6} value={tenure} onChange={setTenure} format={(v) => `${v} mo`} />
          <SliderField label="Existing Loans" min={0} max={8} step={1} value={existingLoans} onChange={setExistingLoans} />
          <SliderField label="Employment Years" min={0} max={30} step={0.5} value={employment} onChange={setEmployment} format={(v) => `${v} yrs`} />
          <SliderField label="Savings Consistency Signal" min={0} max={1} step={0.05} value={savings} onChange={setSavings} format={pct} />

          {!autoMode && (
            <button className="button primary" style={{ width: "100%", marginTop: 8 }} onClick={() => run()} disabled={loading}>
              {loading ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={16} />}
              {loading ? "Simulating..." : "Run Simulation"}
            </button>
          )}

          {autoMode && loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Updating simulation...
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div style={{ flex: "1 1 380px", display: "grid", gap: 16, alignContent: "start" }}>
          {result ? (
            <>
              {/* Gauge */}
              <div className="panel" style={{ textAlign: "center" }}>
                <PdGauge pd={result.probability_default} />
                <div style={{ marginTop: 8 }}>
                  <RiskBadge value={result.risk_tier} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, textAlign: "left" }}>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>MODEL CONFIDENCE</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{pct(result.confidence)}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>RECOMMENDATION</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3, textTransform: "capitalize" }}>
                      {result.recommendation.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Drivers */}
              <div className="panel">
                <h3 style={{ marginBottom: 14 }}>Key Risk Drivers</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {result.explanation.map((d) => {
                    const isRisk = d.direction === "risk";
                    const barWidth = Math.min(Math.abs(d.contribution) * 600, 100);
                    return (
                      <div key={d.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{d.value}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: isRisk ? "var(--risk-critical)" : "var(--risk-low)" }}>
                            {isRisk ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            <span style={{ fontSize: 12, fontWeight: 700 }}>
                              {d.contribution > 0 ? "+" : ""}{(d.contribution * 100).toFixed(1)}pp
                            </span>
                          </div>
                        </div>
                        {/* Contribution bar */}
                        <div style={{ height: 4, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${barWidth}%`,
                            background: isRisk ? "var(--risk-critical)" : "var(--risk-low)",
                            borderRadius: 99, transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Narrative */}
              <div className="panel" style={{ borderLeft: "3px solid var(--brand)", borderRadius: "0 10px 10px 0" }}>
                <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>AI NARRATIVE</span>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.7 }}>{result.narrative}</p>
              </div>
            </>
          ) : (
            <div className="panel" style={{ display: "grid", placeItems: "center", minHeight: 400, textAlign: "center" }}>
              <div>
                <Zap size={48} className="muted" style={{ marginBottom: 16 }} />
                <p className="muted" style={{ margin: 0 }}>
                  {autoMode
                    ? "Adjust the sliders — simulation will run automatically."
                    : <>Adjust the sliders and click<br /><strong>Run Simulation</strong> to see AI output.</>
                  }
                </p>
                {autoMode && (
                  <div style={{ marginTop: 16 }}>
                    <span style={{
                      padding: "4px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)",
                    }}>
                      Live Mode Active
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
