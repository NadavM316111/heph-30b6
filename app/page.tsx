"use client";

import { useEffect, useState, useCallback } from "react";
import AuthScreen from "@/components/AuthScreen";
import MessagingApp from "@/components/MessagingApp";
import { getSession, clearSession } from "@/lib/session";
import { generateDeviceFingerprint } from "@/lib/fingerprint";

export default function Home() {
  const [user, setUser] = useState<{ email: string; displayName: string; avatar: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const fp = generateDeviceFingerprint();
    setFingerprint(fp);

    const session = getSession();
    if (session) {
      setUser(session);
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback((userData: { email: string; displayName: string; avatar: string }) => {
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingLogo}>🔒</div>
        <p style={styles.loadingText}>Confi</p>
        <p style={styles.loadingSubtext}>Secure. Confidential. Yours.</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {user ? (
        <MessagingApp user={user} fingerprint={fingerprint} onLogout={handleLogout} />
      ) : (
        <AuthScreen onLogin={handleLogin} fingerprint={fingerprint} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    color: "#fff",
  },
  loadingLogo: {
    fontSize: "64px",
    marginBottom: "16px",
    animation: "pulse 2s infinite",
  },
  loadingText: {
    fontSize: "36px",
    fontWeight: "700",
    margin: "0 0 8px 0",
    letterSpacing: "4px",
    color: "#00d4ff",
  },
  loadingSubtext: {
    fontSize: "14px",
    color: "#8892b0",
    margin: 0,
    letterSpacing: "2px",
  },
};