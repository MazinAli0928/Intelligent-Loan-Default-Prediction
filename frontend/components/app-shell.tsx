"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  Landmark,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  LogOut,
  Moon,
  Sun,
  Zap,
  UserCircle,
} from "lucide-react";
import { apiFetch, setAuthToken } from "@/lib/api";

const navItems = [
  { href: "/", label: "Command Center", icon: Gauge },
  { href: "/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/borrowers", label: "Borrower 360", icon: Users },
  { href: "/score", label: "Score Application", icon: BarChart3 },
  { href: "/simulator", label: "Risk Simulator", icon: Zap },
  { href: "/fairness", label: "Fairness Audit", icon: Scale },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/models", label: "Model Governance", icon: ShieldCheck },
  { href: "/audit", label: "Audit Trail", icon: ClipboardList },
  { href: "/glossary", label: "Glossary", icon: BookOpen },
  { href: "/profile", label: "My Profile", icon: UserCircle },
  { href: "/admin", label: "Admin Settings", icon: Settings },
];

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: {
    name: string;
    permissions: string[];
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [user, setUser] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    if (isLogin) return;
    apiFetch<UserProfile>("/me")
      .then((data) => setUser(data))
      .catch(() => {
        // Not authenticated, fallback to default/login redirection
        setUser(null);
      });
  }, [pathname, isLogin]);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    router.push("/login");
  };

  if (isLogin) {
    return <main>{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>LoanRisk AI</h1>
          <span>AI loan default intelligence</span>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={active ? "active" : ""} href={item.href as any} key={item.href}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="main">
        <header className="topbar">
          <div>
            <strong>Enterprise Lending Workspace</strong>
            <span>US Credit Portfolio | Active model xgboost-isotonic-v1.0</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user ? (
              <>
                <div style={{ textAlign: "right" }}>
                  <Link href={"/profile" as any} style={{ fontWeight: 700, textDecoration: "none", color: "var(--text)" }}>
                    {user.name}
                  </Link>
                  <div className="muted" style={{ fontSize: 11 }}>{user.role.name}</div>
                </div>
                <button className="button ghost" onClick={toggleTheme} style={{ minHeight: 34, padding: "4px 8px" }} title="Toggle Dark Mode">
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <button className="button ghost" onClick={handleLogout} style={{ minHeight: 34, padding: "4px 8px" }} title="Log out">
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </>
            ) : (
              <Link className="button ghost" href="/login">
                <Landmark size={16} aria-hidden="true" />
                Demo Access
              </Link>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </section>
    </div>
  );
}
