"use client";

import { useEffect, useState, useCallback } from "react";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import { getSession, clearSession, SessionUser } from "@/lib/session";
import { generateFingerprint } from "@/lib/fingerprint";

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    // Track page visit
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Generate device fingerprint
    generateFingerprint().then((fp) => {
      setFingerprint(fp);
      localStorage.setItem("confi_device_fp", fp);
    });

    // Restore session
    const session = getSession();
    if (session) {
      setUser(session);
    }
    setLoading(false);
  }, []);

  const handleAuth = useCallback((u: SessionUser) => {
    setUser(u);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div style={styles.splash}>
        <div style={styles.splashLogo}>🔒</div>
        <div style={styles.splashTitle}>Confi</div>
        <div style={styles.splashSub}>Confidential Messaging</div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {user ? (
        <Dashboard user={user} fingerprint={fingerprint} onLogout={handleLogout} />
      ) : (
        <AuthScreen fingerprint={fingerprint} onAuth={handleAuth} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  splash: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  splashLogo: { fontSize: 56 },
  splashTitle: { fontSize: 32, fontWeight: 700, color: "#6ee7b7", letterSpacing: 2 },
  splashSub: { fontSize: 14, color: "#6b7280" },
};