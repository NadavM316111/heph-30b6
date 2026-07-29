"use client";

import { useEffect, useState, useCallback } from "react";
import AuthScreen from "@/components/AuthScreen";
import MainApp from "@/components/MainApp";

export default function Home() {
  const [session, setSession] = useState<{
    email: string;
    token: string;
    userId: number;
    displayName: string;
    avatarColor: string;
    kycVerified: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const stored = localStorage.getItem("confi_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.email) {
          setSession(parsed);
        }
      } catch {}
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback(
    (sess: {
      email: string;
      token: string;
      userId: number;
      displayName: string;
      avatarColor: string;
      kycVerified: boolean;
    }) => {
      localStorage.setItem("confi_session", JSON.stringify(sess));
      setSession(sess);
    },
    []
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("confi_session");
    setSession(null);
  }, []);

  const handleSessionUpdate = useCallback(
    (updates: Partial<typeof session>) => {
      if (!session) return;
      const updated = { ...session, ...updates };
      localStorage.setItem("confi_session", JSON.stringify(updated));
      setSession(updated);
    },
    [session]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0f1e",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 28,
            }}
          >
            🔐
          </div>
          <p style={{ color: "#8892b0", fontSize: 14 }}>Loading Confi…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <MainApp
      session={session}
      onLogout={handleLogout}
      onSessionUpdate={handleSessionUpdate}
    />
  );
}