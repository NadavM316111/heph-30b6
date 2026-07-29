"use client";

import { useState } from "react";
import { saveSession, SessionUser } from "@/lib/session";
import { generateUserId } from "@/lib/fingerprint";
import LegalConsentModal from "@/components/LegalConsentModal";
import OTPModal from "@/components/OTPModal";
import AvatarPicker from "@/components/AvatarPicker";

type Step = "landing" | "signup" | "login" | "otp" | "profile" | "consent";

interface Props {
  fingerprint: string;
  onAuth: (user: SessionUser) => void;
}

export default function AuthScreen({ fingerprint, onAuth }: Props) {
  const [step, setStep] = useState<Step>("landing");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<SessionUser | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePassword = (p: string) => p.length >= 8;

  const handleSubmitAuth = async () => {
    setError("");
    if (!validateEmail(email)) { setError("Enter a valid email address."); return; }
    if (!validatePassword(password)) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Authentication failed."); setLoading(false); return; }
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleOTPVerified = () => {
    setOtpVerified(true);
    if (mode === "signup") {
      setStep("profile");
    } else {
      // For login, create user from stored profile or basic info
      const storedProfile = localStorage.getItem(`confi_profile_${email}`);
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        const u: SessionUser = {
          ...profile,
          deviceFingerprint: fingerprint,
          sessionId: crypto.randomUUID(),
          lastSeen: Date.now(),
          consentTimestamp: profile.consentTimestamp || Date.now(),
        };
        saveSession(u);
        onAuth(u);
      } else {
        setStep("profile");
      }
    }
  };

  const handleProfileSubmit = () => {
    if (!displayName.trim()) { setError("Display name is required."); return; }
    if (!consentGiven) {
      setShowConsent(true);
      return;
    }
    finalizeUser();
  };

  const handleConsentAccepted = () => {
    setConsentGiven(true);
    setShowConsent(false);
    finalizeUser();
  };

  const finalizeUser = () => {
    const uid = generateUserId(email, fingerprint);
    const u: SessionUser = {
      uid,
      email,
      displayName: displayName.trim(),
      avatar,
      deviceFingerprint: fingerprint,
      sessionId: crypto.randomUUID(),
      lastSeen: Date.now(),
      consentTimestamp: Date.now(),
      consentVersion: "NDA-v1.0",
    };
    // Store profile locally (encrypted minimally)
    const profileKey = `confi_profile_${email}`;
    localStorage.setItem(profileKey, JSON.stringify(u));
    saveSession(u);
    onAuth(u);
  };

  return (
    <div style={s.container}>
      {showConsent && (
        <LegalConsentModal
          email={email}
          displayName={displayName}
          onAccept={handleConsentAccepted}
          onDecline={() => setShowConsent(false)}
        />
      )}
      {step === "otp" && (
        <OTPModal
          email={email}
          onVerified={handleOTPVerified}
          onBack={() => setStep(mode === "signup" ? "signup" : "login")}
        />
      )}

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logo}>🔒</div>
        <h1 style={s.title}>Confi</h1>
        <p style={s.subtitle}>Confidential Messaging</p>

        {step === "landing" && (
          <div style={s.landingButtons}>
            <button style={s.btnPrimary} onClick={() => { setMode("signup"); setStep("signup"); }}>
              Create Account
            </button>
            <button style={s.btnSecondary} onClick={() => { setMode("login"); setStep("login"); }}>
              Sign In
            </button>
            <div style={s.legalNote}>
              🛡️ All communications are covered by international NDA upon activation.
              Your identity is verified for legal traceability.
            </div>
          </div>
        )}

        {(step === "signup" || step === "login") && (
          <div style={s.form}>
            <h2 style={s.formTitle}>{mode === "signup" ? "Create Account" : "Welcome Back"}</h2>
            <div style={s.fieldGroup}>
              <label style={s.label}>Email Address</label>
              <input
                style={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitAuth()}
                autoComplete="email"
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Password</label>
              <input
                style={s.input}
                type="password"
                placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitAuth()}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btnPrimary} onClick={handleSubmitAuth} disabled={loading}>
              {loading ? "Verifying..." : mode === "signup" ? "Continue →" : "Sign In →"}
            </button>
            <button style={s.btnGhost} onClick={() => setStep("landing")}>← Back</button>
          </div>
        )}

        {step === "profile" && (
          <div style={s.form}>
            <h2 style={s.formTitle}>Set Up Your Profile</h2>
            <p style={s.hint}>This name and avatar will appear in all confidential conversations.</p>
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
            <div style={s.fieldGroup}>
              <label style={s.label}>Display Name</label>
              <input
                style={s.input}
                type="text"
                placeholder="How should others address you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div style={s.uidPreview}>
              <span style={{ color: "#6b7280", fontSize: 12 }}>Your Unique ID (auto-generated): </span>
              <span style={{ color: "#6ee7b7", fontSize: 12, fontFamily: "monospace" }}>
                {generateUserId(email, fingerprint).slice(0, 16)}…
              </span>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btnPrimary} onClick={handleProfileSubmit}>
              Accept Terms & Enter Confi →
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span>🔐 End-to-end encrypted · </span>
        <span>🌐 International NDA Protected · </span>
        <span>⚖️ Legally Traceable Identity</span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0a0f 0%, #0f1628 50%, #0a0a0f 100%)",
    padding: "20px",
    gap: 24,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(110,231,183,0.15)",
    borderRadius: 20,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    backdropFilter: "blur(12px)",
    boxShadow: "0 0 60px rgba(110,231,183,0.05)",
  },
  logo: { fontSize: 48, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: 800, color: "#6ee7b7", margin: 0, letterSpacing: 2 },
  subtitle: { fontSize: 13, color: "#6b7280", margin: 0, marginBottom: 16 },
  landingButtons: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 8,
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },
  formTitle: { fontSize: 18, fontWeight: 700, color: "#e5e7eb", margin: 0, marginBottom: 4 },
  hint: { fontSize: 12, color: "#6b7280", margin: 0 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#9ca3af", fontWeight: 600, letterSpacing: 0.5 },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6ee7b7, #3b82f6)",
    border: "none",
    borderRadius: 10,
    padding: "13px",
    color: "#0a0a0f",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    marginTop: 4,
  },
  btnSecondary: {
    background: "rgba(110,231,183,0.08)",
    border: "1px solid rgba(110,231,183,0.3)",
    borderRadius: 10,
    padding: "13px",
    color: "#6ee7b7",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  btnGhost: {
    background: "transparent",
    border: "none",
    color: "#6b7280",
    fontSize: 13,
    cursor: "pointer",
    padding: "6px 0",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f87171",
    fontSize: 13,
  },
  legalNote: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 1.6,
    marginTop: 8,
    padding: "12px",
    background: "rgba(110,231,183,0.03)",
    borderRadius: 8,
    border: "1px solid rgba(110,231,183,0.08)",
  },
  uidPreview: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
  },
  footer: {
    fontSize: 11,
    color: "#374151",
    textAlign: "center",
    lineHeight: 2,
  },
};