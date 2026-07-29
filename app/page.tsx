"use client";

import { useEffect, useState, useRef } from "react";
import AuthScreen from "@/components/AuthScreen";
import ProfileSetup from "@/components/ProfileSetup";
import VerificationScreen from "@/components/VerificationScreen";
import Dashboard from "@/components/Dashboard";

export type AppUser = {
  id: number;
  email: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  isVerified: boolean;
  sessionToken: string;
};

type AppStage = "auth" | "profile" | "verification" | "dashboard";

export default function Home() {
  const [stage, setStage] = useState<AppStage>("auth");
  const [user, setUser] = useState<AppUser | null>(null);
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
        const parsed: AppUser = JSON.parse(stored);
        setUser(parsed);
        if (!parsed.displayName) {
          setStage("profile");
        } else if (!parsed.isVerified) {
          setStage("verification");
        } else {
          setStage("dashboard");
        }
      } catch {
        localStorage.removeItem("confi_user");
        setStage("auth");
      }
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = (u: AppUser) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    if (!u.displayName) {
      setStage("profile");
    } else if (!u.isVerified) {
      setStage("verification");
    } else {
      setStage("dashboard");
    }
  };

  const handleProfileComplete = (u: AppUser) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    setStage("verification");
  };

  const handleVerificationComplete = (u: AppUser) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    setStage("dashboard");
  };

  const handleSkipVerification = () => {
    setStage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setStage("auth");
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading Confi...</p>
      </div>
    );
  }

  return (
    <main style={styles.main}>
      {stage === "auth" && <AuthScreen onSuccess={handleAuthSuccess} />}
      {stage === "profile" && user && (
        <ProfileSetup user={user} onComplete={handleProfileComplete} />
      )}
      {stage === "verification" && user && (
        <VerificationScreen
          user={user}
          onComplete={handleVerificationComplete}
          onSkip={handleSkipVerification}
        />
      )}
      {stage === "dashboard" && user && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
  },
  loadingSpinner: {
    width: "48px",
    height: "48px",
    border: "3px solid rgba(99,102,241,0.3)",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: "16px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
};