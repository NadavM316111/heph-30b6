"use client";

import { useState, useEffect, useCallback } from "react";
import AuthFlow from "@/components/AuthFlow";
import UserProfile from "@/components/UserProfile";
import Dashboard from "@/components/Dashboard";

export type User = {
  email: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
  fullName: string;
  country: string;
  identityVerified: boolean;
  sessionToken: string;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"auth" | "profile" | "dashboard">("auth");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
        setView("dashboard");
      } catch {
        localStorage.removeItem("confi_user");
      }
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    setView("dashboard");
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setView("auth");
  }, []);

  const handleProfileUpdate = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    setView("dashboard");
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading Confi…</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {view === "auth" && <AuthFlow onSuccess={handleAuthSuccess} />}
      {view === "profile" && user && (
        <UserProfile
          user={user}
          onSave={handleProfileUpdate}
          onBack={() => setView("dashboard")}
        />
      )}
      {view === "dashboard" && user && (
        <Dashboard
          user={user}
          onEditProfile={() => setView("profile")}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
  },
  loadingSpinner: {
    width: "48px",
    height: "48px",
    border: "4px solid rgba(255,255,255,0.1)",
    borderTopColor: "#7c3aed",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "16px",
  },
};