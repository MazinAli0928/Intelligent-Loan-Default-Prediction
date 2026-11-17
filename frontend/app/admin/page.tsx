"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, ShieldCheck, Lock, AlertCircle, X, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: {
    name: string;
    permissions: string[];
  };
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add User Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role_name: "Lender Analyst",
  });

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<User>("/me");
      setCurrentUser(me);

      if (me.role.name === "Admin") {
        const userList = await apiFetch<User[]>("/admin/users");
        setUsers(userList);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setSuccess(`User "${formData.name}" created successfully!`);
      setShowAddModal(false);
      setFormData({ name: "", email: "", password: "", role_name: "Lender Analyst" });
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to remove user "${user.name}" (${user.email})?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
      setSuccess(`User "${user.name}" removed successfully.`);
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || "Failed to remove user");
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }} className="muted">Loading user management console...</div>;

  if (currentUser?.role.name !== "Admin") {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 20px", marginTop: 40, borderLeft: "4px solid var(--risk-critical)" }}>
        <Lock size={36} style={{ color: "var(--risk-critical)", marginBottom: 12 }} />
        <h3>Access Restricted</h3>
        <p className="muted">You must be logged in as an <strong>Admin</strong> to access user management and system settings.</p>
        <p className="muted" style={{ fontSize: 12 }}>Current user: {currentUser?.name} ({currentUser?.role.name})</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Admin Console & User Governance</h2>
          <p>Manage platform accounts, role-based permissions, risk thresholds, and user access control.</p>
        </div>
        <button className="button primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} /> Add New User
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--risk-critical)", borderRadius: 8, color: "var(--risk-critical)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid var(--risk-low)", borderRadius: 8, color: "var(--risk-low)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={16} /> {success}
        </div>
      )}

      <section className="grid cols-2">
        {/* User List Table */}
        <div className="table-wrap">
          <div className="table-tools" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Platform Users ({users.length})</h3>
            <span className="muted" style={{ fontSize: 12 }}>Admin Authorized</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role & Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.name} {isSelf && <span style={{ fontSize: 10, padding: "2px 6px", background: "rgba(99,102,241,0.15)", color: "#6366f1", borderRadius: 999, marginLeft: 6 }}>YOU</span>}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: u.role.name === "Admin" ? "rgba(99,102,241,0.15)" : u.role.name === "Compliance Officer" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                        color: u.role.name === "Admin" ? "#6366f1" : u.role.name === "Compliance Officer" ? "var(--risk-medium)" : "var(--risk-low)",
                      }}>
                        {u.role.name}
                      </span>
                    </td>
                    <td>
                      {!isSelf ? (
                        <button
                          className="button ghost"
                          onClick={() => handleDeleteUser(u)}
                          style={{ color: "var(--risk-critical)", padding: "4px 8px", minHeight: 28 }}
                          title="Remove user"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>Active Session</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Risk Thresholds Settings Form */}
        <form className="panel">
          <h3>Platform Risk Thresholds</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Configure default probability of default (PD) boundaries for risk tier classification.</p>
          <div className="form-grid">
            <div className="field"><label>Medium risk starts (PD)</label><input className="input" defaultValue="0.18" readOnly /></div>
            <div className="field"><label>High risk starts (PD)</label><input className="input" defaultValue="0.34" readOnly /></div>
            <div className="field"><label>Critical risk starts (PD)</label><input className="input" defaultValue="0.55" readOnly /></div>
            <div className="field"><label>Fairness alert gap</label><input className="input" defaultValue="0.18" readOnly /></div>
          </div>
          <button className="button primary" style={{ marginTop: 16 }} type="button">Save Settings</button>
        </form>
      </section>

      {/* Add User Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
        }}>
          <div className="panel" style={{ width: "100%", maxWidth: 480, background: "var(--panel)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Add New Platform User</h3>
              <button className="button ghost" onClick={() => setShowAddModal(false)} style={{ padding: 4, minHeight: "auto" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
                <div className="field">
                  <label>Full Name</label>
                  <input
                    className="input"
                    required
                    placeholder="e.g. Vikramaditya Sen"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Email Address</label>
                  <input
                    className="input"
                    type="email"
                    required
                    placeholder="user@loanrisk.local"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    className="input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Assign Role</label>
                  <select
                    className="input"
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                  >
                    <option value="Lender Analyst">Lender Analyst (Scoring & Applications)</option>
                    <option value="Compliance Officer">Compliance Officer (Fairness & Audits)</option>
                    <option value="Admin">Admin (Full System Control)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button className="button ghost" type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="button primary" type="submit">Create User Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
