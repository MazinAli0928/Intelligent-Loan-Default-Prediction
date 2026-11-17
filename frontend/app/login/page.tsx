"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, KeyRound, Mail, ShieldCheck, Zap, Scale, Eye, EyeOff, Lock, ArrowRight } from "lucide-react";
import { apiFetch, setAuthToken } from "@/lib/api";

interface LoginResponse {
  token: string;
  user: { name: string; email: string; role: { name: string } };
}

const ROLES = [
  {
    id: "analyst",
    label: "Analyst",
    email: "analyst@demo.local",
    icon: Zap,
    color: "#6366f1",
    glow: "rgba(99,102,241,0.4)",
    desc: "Loan scoring & applications",
  },
  {
    id: "auditor",
    label: "Auditor",
    email: "compliance@demo.local",
    icon: Scale,
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.4)",
    desc: "Fairness & compliance",
  },
  {
    id: "admin",
    label: "Admin",
    email: "admin@demo.local",
    icon: ShieldCheck,
    color: "#10b981",
    glow: "rgba(16,185,129,0.4)",
    desc: "Full platform control",
  },
];

const STATS = [
  { label: "Model AUC", value: "93.2%", sub: "XGBoost + Isotonic" },
  { label: "Portfolio AUM", value: "$2.8B", sub: "Active Loans" },
  { label: "Applications", value: "12,847", sub: "Processed" },
  { label: "Risk Accuracy", value: "84.6%", sub: "Precision @ 45% cutoff" },
];

/* Animated counter hook */
function useCounter(target: number, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

/* Hex grid SVG background */
function HexGrid() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon
            points="28,2 52,14 52,38 28,50 4,38 4,14"
            fill="none"
            stroke="#6366f1"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  );
}

/* Floating ambient orb */
function Orb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x, top: y,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: "blur(60px)",
      animation: `orbFloat ${6 + delay}s ease-in-out infinite alternate`,
      animationDelay: `${delay}s`,
      pointerEvents: "none",
    }} />
  );
}

/* Live PD gauge (pure SVG) */
function RiskGauge() {
  const [pd, setPd] = useState(0.23);
  useEffect(() => {
    const id = setInterval(() => {
      setPd(0.12 + Math.random() * 0.45);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const pct = pd;
  const angle = pct * 180;
  const r = 62, cx = 80, cy = 80;
  const toRad = (deg: number) => (deg - 180) * (Math.PI / 180);
  const nx = cx + r * Math.cos(toRad(angle));
  const ny = cy + r * Math.sin(toRad(angle));
  const tierColor = pct < 0.18 ? "#10b981" : pct < 0.34 ? "#f59e0b" : pct < 0.55 ? "#ef4444" : "#991b1b";
  const tierLabel = pct < 0.18 ? "LOW RISK" : pct < 0.34 ? "MEDIUM" : pct < 0.55 ? "HIGH" : "CRITICAL";

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 160 100" width="180" height="112">
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        {/* Active arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
          fill="none" stroke={tierColor} strokeWidth="10" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${tierColor})`, transition: "all 1.2s ease" }}
        />
        {/* Needle */}
        <circle cx={nx} cy={ny} r="6" fill={tierColor}
          style={{ filter: `drop-shadow(0 0 8px ${tierColor})`, transition: "all 1.2s ease" }}
        />
        {/* PD value */}
        <text x={cx} y={cy - 10} textAnchor="middle"
          style={{ fontSize: 20, fontWeight: 900, fill: "#fff", fontFamily: "inherit" }}>
          {(pct * 100).toFixed(0)}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle"
          style={{ fontSize: 8, fill: tierColor, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.08em", transition: "all 1.2s ease" }}>
          {tierLabel}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle"
          style={{ fontSize: 7, fill: "rgba(255,255,255,0.4)", fontFamily: "inherit" }}>
          PROBABILITY OF DEFAULT
        </text>
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(0);
  const [email, setEmail] = useState(ROLES[0].email);
  const [password, setPassword] = useState("password123");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const selectRole = (i: number) => {
    setSelectedRole(i);
    setEmail(ROLES[i].email);
    setPassword("password123");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.token);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Invalid credentials.");
      setLoading(false);
    }
  };

  const role = ROLES[selectedRole];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050915",
      display: "flex",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Hex grid background */}
      <HexGrid />

      {/* Ambient orbs */}
      <Orb x="-10%" y="-20%" size={500} color="rgba(99,102,241,0.25)" delay={0} />
      <Orb x="60%" y="50%" size={400} color="rgba(139,92,246,0.2)" delay={2} />
      <Orb x="30%" y="70%" size={350} color="rgba(16,185,129,0.12)" delay={4} />
      <Orb x="80%" y="-10%" size={300} color="rgba(245,158,11,0.1)" delay={1} />

      {/* ── LEFT PANEL ─────────────────────────────── */}
      <div style={{
        flex: "1 1 54%",
        display: "flex",
        flexDirection: "column",
        padding: "48px 56px",
        position: "relative",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateX(-24px)",
        transition: "all 0.7s cubic-bezier(0.22,1,0.36,1)",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 64 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px -4px rgba(99,102,241,0.6)",
          }}>
            <Landmark size={24} color="#fff" />
          </div>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em",
              background: "linear-gradient(90deg, #e0e7ff, #c7d2fe)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>LoanRisk AI</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginTop: 1 }}>
              AI CREDIT INTELLIGENCE PLATFORM
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 999, marginBottom: 20,
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", letterSpacing: "0.06em" }}>
              SYSTEM ONLINE · FCRA / ECOA COMPLIANT ARCHITECTURE
            </span>
          </div>
          <h1 style={{
            margin: "0 0 16px", fontSize: "clamp(32px, 3.5vw, 46px)",
            fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em",
            color: "#fff",
          }}>
            Next-Gen AI<br />
            <span style={{
              background: "linear-gradient(135deg, #818cf8, #c084fc, #38bdf8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Risk Intelligence
            </span>
          </h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,0.45)", maxWidth: 440 }}>
            Automated probability-of-default scoring, SHAP explainability, demographic bias auditing, and instant PDF credit appraisal memoranda.
          </p>
        </div>

        {/* Live Gauge + Stats */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "28px 32px",
          backdropFilter: "blur(12px)",
          marginBottom: 40,
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 8 }}>
                LIVE MODEL OUTPUT
              </div>
              <RiskGauge />
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minWidth: 220 }}>
              {STATS.map((s) => (
                <div key={s.label} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#e0e7ff", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", marginTop: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { icon: "🧠", text: "XGBoost + TreeSHAP Explainability" },
            { icon: "⚖️", text: "Demographic Fairness & Parity" },
            { icon: "📄", text: "Instant Credit Appraisal PDFs" },
          ].map((f) => (
            <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Card ────────────────── */}
      <div style={{
        flex: "0 0 420px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
        position: "relative",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateX(24px)",
        transition: "all 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s",
      }}>
        {/* Glow behind card */}
        <div style={{
          position: "absolute",
          width: 360, height: 360,
          background: `radial-gradient(circle, ${role.glow} 0%, transparent 70%)`,
          filter: "blur(80px)",
          transition: "background 0.6s ease",
          pointerEvents: "none",
        }} />

        <div style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "36px 32px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: `0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)`,
          position: "relative",
          zIndex: 1,
        }}>
          {/* Card header */}
          <div style={{ marginBottom: 28, textAlign: "center" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
              Welcome Back
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Select your role and sign in to continue
            </p>
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 14,
              padding: 5,
            }}>
              {ROLES.map((r, i) => {
                const Icon = r.icon;
                const active = selectedRole === i;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRole(i)}
                    style={{
                      padding: "10px 4px",
                      borderRadius: 10,
                      border: "none",
                      background: active ? "rgba(255,255,255,0.1)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.2s ease",
                      boxShadow: active ? `0 0 0 1px ${r.color}60, 0 4px 12px rgba(0,0,0,0.3)` : "none",
                    }}
                  >
                    <Icon size={17} color={active ? r.color : "rgba(255,255,255,0.35)"} />
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      color: active ? r.color : "rgba(255,255,255,0.4)",
                      letterSpacing: "0.02em",
                    }}>{r.label}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
              {role.desc}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5", fontSize: 13, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            {/* Email */}
            <div style={{ position: "relative" }}>
              <Mail size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: "100%", height: 46, paddingLeft: 40, paddingRight: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, color: "#fff", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = role.color;
                  e.target.style.boxShadow = `0 0 0 3px ${role.color}22`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Password */}
            <div style={{ position: "relative" }}>
              <KeyRound size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%", height: 46, paddingLeft: 40, paddingRight: 46,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, color: "#fff", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = role.color;
                  e.target.style.boxShadow = `0 0 0 3px ${role.color}22`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6, height: 50, width: "100%",
                border: "none", borderRadius: 13, cursor: "pointer",
                background: `linear-gradient(135deg, ${role.color}, ${role.color}cc)`,
                color: "#fff", fontSize: 15, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: `0 8px 24px -4px ${role.glow}`,
                transition: "all 0.25s ease",
                opacity: loading ? 0.7 : 1,
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 14px 32px -4px ${role.glow}`;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 24px -4px ${role.glow}`;
              }}
            >
              {loading ? (
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <>Access Platform <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Security note */}
          <div style={{ marginTop: 20, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Lock size={11} color="rgba(255,255,255,0.25)" />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              256-bit TLS · Token-based · Session-secured
            </span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbFloat {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-30px) scale(1.06); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #10b981; }
          50% { opacity: 0.5; box-shadow: 0 0 12px #10b981; }
        }

        /* Override global input styling for dark login page */
        .login-scope input::placeholder { color: rgba(255,255,255,0.2); }

        @media (max-width: 860px) {
          .login-layout { flex-direction: column !important; }
          .login-left { padding: 32px 24px !important; }
          .login-right { flex: none !important; width: 100% !important; padding: 24px !important; }
        }
      `}</style>
    </div>
  );
}
