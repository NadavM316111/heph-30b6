"use client";

import { useState, useEffect, useCallback } from "react";
import AuthScreen from "@/components/AuthScreen";
import ProfileScreen from "@/components/ProfileScreen";
import ContactsScreen from "@/components/ContactsScreen";
import { getSession, clearSession, Session } from "@/lib/session";

type Screen = "auth" | "profile" | "contacts";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("auth");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
      setScreen("contacts");
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = useCallback((s: Session) => {
    setSession(s);
    setScreen("profile");
  }, []);

  const handleProfileSaved = useCallback(() => {
    setScreen("contacts");
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setScreen("auth");
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Confi Messaging</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {screen === "auth" && (
        <AuthScreen onSuccess={handleAuthSuccess} />
      )}
      {screen === "profile" && session && (
        <ProfileScreen
          session={session}
          onSaved={handleProfileSaved}
          onLogout={handleLogout}
        />
      )}
      {screen === "contacts" && session && (
        <ContactsScreen
          session={session}
          onLogout={handleLogout}
          onEditProfile={() => setScreen("profile")}
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
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
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
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #7c3aed",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#a78bfa",
    fontSize: "20px",
    fontWeight: 600,
    letterSpacing: "0.05em",
  },
};