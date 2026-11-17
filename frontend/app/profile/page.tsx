"use client";

import { useEffect, useState } from "react";
import {
  User, Mail, ShieldCheck, KeyRound, CheckCircle2, AlertCircle,
  Lock, Eye, EyeOff, Loader2, Award,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: {
    name: string;
    permissions: string[];
  };
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  Admin:                { color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  "Compliance Officer": { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  "Lender Analyst":     { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

const PERMISSION_LABELS: Record<string, string> = {
  "read:applications":    "View Applications",
  "write:applications":   "Create Applications",
  "read:borrowers":       "View Borrowers",
  "write:borrowers":      "Add Borrowers",
  "read:reports":         "Download Reports",
  "write:overrides":      "Submit Overrides",
  "read:fairness":        "View Fairness Data",
  "write:fairness":       "Run Fairness Audits",
  "admin:users":          "Manage Users",
  "admin:settings":       "Platform Settings",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password form state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  useEffect(() => {
    apiFetch<UserProfile>("/me")
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (newPwd.length < 8) {
      setPwdError("New password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("New password and confirmation do not match.");
      return;
    }
    if (newPwd === currentPwd) {
      setPwdError("New password must be different from the current password.");
      return;
    }

    setPwdLoading(true);
    try {
      await apiFetch("/me/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      });
      setPwdSuccess(true);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      setPwdError(err?.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <Loader2 size={32} className="muted" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 20px", borderLeft: "4px solid var(--risk-critical)" }}>
        <AlertCircle size={36} style={{ color: "var(--risk-critical)", marginBottom: 12 }} />
        <p className="muted">Could not load your profile. Please log in again.</p>
      </div>
    );
  }

  const roleStyle = ROLE_COLORS[profile.role.name] ?? { color: "var(--brand)", bg: "rgba(99,102,241,0.12)" };
  const strength = newPwd.length === 0 ? null : newPwd.length < 8 ? "weak" : newPwd.length < 12 ? "fair" : "strong";
  const strengthColors: Record<string, string> = { weak: "var(--risk-critical)", fair: "var(--risk-medium)", strong: "var(--risk-low)" };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>My Profile &amp; Security</h2>
          <p>Manage your account information, role permissions, and password settings.</p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
          borderRadius: 999, background: roleStyle.bg, border: `1px solid ${roleStyle.color}40`,
        }}>
          <ShieldCheck size={16} style={{ color: roleStyle.color }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: roleStyle.color }}>{profile.role.name}</span>
        </div>
      </div>

      <div className="split" style={{ gap: 20, alignItems: "start" }}>
        {/* Left: Profile Info */}
        <div style={{ flex: "1 1 340px", display: "grid", gap: 16 }}>
          {/* Identity Card */}
          <div className="panel" style={{
            background: "linear-gradient(135deg, var(--panel), color-mix(in srgb, var(--brand) 8%, var(--panel)))",
            borderTop: `3px solid ${roleStyle.color}`,
          }}>
            {/* Avatar */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", textAlign: "center" }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: `linear-gradient(135deg, ${roleStyle.color}, ${roleStyle.color}99)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 900, color: "#fff",
                boxShadow: `0 8px 24px -4px ${roleStyle.color}60`,
                marginBottom: 14,
              }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{profile.name}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{profile.email}</span>
              <div style={{ marginTop: 12 }}>
                <span style={{
                  padding: "4px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800,
                  background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.color}40`,
                }}>
                  {profile.role.name}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="panel">
            <h3 style={{ marginBottom: 16 }}>Account Details</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {[
                { icon: <User size={15} />, label: "Full Name", value: profile.name },
                { icon: <Mail size={15} />, label: "Email Address", value: profile.email },
                { icon: <Award size={15} />, label: "Platform Role", value: profile.role.name },
                { icon: <ShieldCheck size={15} />, label: "User ID", value: `USR-${String(profile.id).padStart(4, "0")}` },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    padding: 8, borderRadius: 8, background: "var(--bg)",
                    color: "var(--brand)", flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 1 }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="panel">
            <h3 style={{ marginBottom: 14 }}>Role Permissions</h3>
            <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
              Your <strong>{profile.role.name}</strong> role grants access to the following capabilities:
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {profile.role.permissions.length > 0 ? (
                profile.role.permissions.map((perm) => (
                  <div key={perm} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={14} style={{ color: "var(--risk-low)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>
                      {PERMISSION_LABELS[perm] ?? perm}
                    </span>
                    <code style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", opacity: 0.7 }}>{perm}</code>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>No specific permissions assigned.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Password Change */}
        <div style={{ flex: "1 1 340px", display: "grid", gap: 16 }}>
          <div className="panel">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "var(--brand)" }}>
                <Lock size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Change Password</h3>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Update your credentials for continued secure access.
                </p>
              </div>
            </div>

            {pwdSuccess && (
              <div style={{
                padding: "12px 16px", borderRadius: 8, background: "rgba(16,185,129,0.1)",
                border: "1px solid var(--risk-low)", color: "var(--risk-low)",
                fontSize: 13, fontWeight: 600, marginBottom: 20,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <CheckCircle2 size={16} /> Password updated successfully.
              </div>
            )}

            {pwdError && (
              <div style={{
                padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.1)",
                border: "1px solid var(--risk-critical)", color: "var(--risk-critical)",
                fontSize: 13, fontWeight: 600, marginBottom: 20,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={16} /> {pwdError}
              </div>
            )}

            <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: 16 }}>
              {/* Current Password */}
              <div className="field">
                <label>Current Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showCurrent ? "text" : "password"}
                    required
                    placeholder="Your current password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    style={{ paddingLeft: 38, paddingRight: 38, height: 42 }}
                  />
                  <KeyRound size={15} className="muted" style={{ position: "absolute", left: 12, top: 14 }} />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{
                    position: "absolute", right: 10, top: 10, background: "none", border: "none",
                    cursor: "pointer", color: "var(--muted)", padding: 2,
                  }}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="field">
                <label>New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showNew ? "text" : "password"}
                    required
                    placeholder="Min. 8 characters"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    style={{ paddingLeft: 38, paddingRight: 38, height: 42 }}
                  />
                  <Lock size={15} className="muted" style={{ position: "absolute", left: 12, top: 14 }} />
                  <button type="button" onClick={() => setShowNew(!showNew)} style={{
                    position: "absolute", right: 10, top: 10, background: "none", border: "none",
                    cursor: "pointer", color: "var(--muted)", padding: 2,
                  }}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar */}
                {strength && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {["weak", "fair", "strong"].map((level, i) => {
                        const filled = ["weak", "fair", "strong"].indexOf(strength) >= i;
                        return (
                          <div key={level} style={{
                            flex: 1, height: 4, borderRadius: 99,
                            background: filled ? strengthColors[strength] : "var(--line)",
                            transition: "background 0.3s",
                          }} />
                        );
                      })}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: strengthColors[strength], textTransform: "capitalize" }}>
                      {strength} password
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="field">
                <label>Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type="password"
                    required
                    placeholder="Repeat new password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    style={{
                      paddingLeft: 38, height: 42,
                      borderColor: confirmPwd && confirmPwd !== newPwd ? "var(--risk-critical)" : undefined,
                    }}
                  />
                  <Lock size={15} className="muted" style={{ position: "absolute", left: 12, top: 14 }} />
                </div>
                {confirmPwd && confirmPwd !== newPwd && (
                  <span style={{ fontSize: 11, color: "var(--risk-critical)", marginTop: 4, display: "block" }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <button
                className="button primary"
                type="submit"
                disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                style={{ height: 44, marginTop: 4, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
              >
                {pwdLoading ? (
                  <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {pwdLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>

          {/* Security Note */}
          <div className="panel" style={{ borderLeft: "3px solid var(--brand)", borderRadius: "0 10px 10px 0", padding: "14px 18px" }}>
            <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>SECURITY NOTICE</span>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0 0", lineHeight: 1.6 }}>
              All password changes are recorded in the immutable audit trail. Use a strong, unique password of at least 12 characters. Never share your credentials with colleagues.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
