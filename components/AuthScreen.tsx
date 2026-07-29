"use client";

import { useState } from "react";
import type { UserSession } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  onSuccess: (session: UserSession) => void;
}

type Mode = "login" | "signup";

export default function AuthScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const validateEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validatePassword = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!validatePassword(password)) {
      setError(
        "Password must be at least 8 characters, include one uppercase letter and one number."
      );
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Authentication failed. Please try again.");
        return;
      }

      const token = btoa(
        JSON.stringify({ email: data.email, ts: Date.now(), rand: Math.random() })
      );

      onSuccess({
        email: data.email,
        token,
        otpVerified: false,
        profileComplete: false,
      });
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (): { label: string; color: string; width: string } => {
    if (!password) return { label: "", color: "#333", width: "0%" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: "Weak", color: "#f05c5c", width: "25%" };
    if (score === 2) return { label: "Fair", color: "#f0c26c", width: "50%" };
    if (score === 3) return { label: "Good", color: "#6cf07c", width: "75%" };
    return { label: "Strong", color: "#6cf0c2", width: "100%" };
  };

  const strength = passwordStrength();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>🔒</div>
        <h1 style={styles.appName}>Confi</h1>
        <p style={styles.tagline}>Confidential Messaging. Legal Protection.</p>
      </div>

      <div style={styles.card}>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button
            style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              autoComplete="email"
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 chars, uppercase & number"
                style={{ ...styles.input, paddingRight: "48px" }}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
            {mode === "signup" && password && (
              <div style={styles.strengthContainer}>
                <div style={styles.strengthBar}>
                  <div
                    style={{
                      ...styles.strengthFill,
                      width: strength.width,
                      background: strength.color,
                    }}
                  />
                </div>
                <span style={{ ...styles.strengthLabel, color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {mode === "signup" && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                style={{
                  ...styles.input,
                  borderColor:
                    confirmPassword && confirmPassword !== password
                      ? "#f05c5c"
                      : confirmPassword && confirmPassword === password
                      ? "#6cf07c"
                      : "#2a2a3a",
                }}
                required
              />
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          {mode === "signup" && (
            <div style={styles.infoBox}>
              <span style={styles.infoIcon}>ℹ️</span>
              <p style={styles.infoText}>
                After signup, you&apos;ll verify your email via OTP and complete your
                legal profile (required for NDA enforcement).
              </p>
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {mode === "login" && (
          <p style={styles.forgotText}>
            Forgot your password?{" "}
            <button
              style={styles.linkBtn}
              onClick={() => setError("Password reset coming soon. Contact support.")}
            >
              Reset it
            </button>
          </p>
        )}
      </div>

      <p style={styles.legalFooter}>
        🛡️ All accounts are subject to identity verification for NDA enforcement purposes.
      </p>
    </div>
  );
}

// Keep countries import for future use in profile
void COUNTRIES;

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "440px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    boxSizing: "border-box",
    gap: "24px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  logo: {
    fontSize: "48px",
  },
  appName: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#7c6cf0",
    margin: 0,
    letterSpacing: "-1px",
  },
  tagline: {
    fontSize: "14px",
    color: "#666",
    margin: 0,
  },
  card: {
    width: "100%",
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "20px",
    padding: "28px 24px",
    boxSizing: "border-box",
  },
  tabs: {
    display: "flex",
    background: "#1a1a28",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "24px",
  },
  tab: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: "#666",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#7c6cf0",
    color: "#fff",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#aaa",
    letterSpacing: "0.3px",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    background: "#1a1a28",
    border: "1.5px solid #2a2a3a",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  passwordWrapper: {
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    padding: "4px",
  },
  strengthContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "4px",
  },
  strengthBar: {
    flex: 1,
    height: "4px",
    background: "#2a2a3a",
    borderRadius: "2px",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.3s, background 0.3s",
  },
  strengthLabel: {
    fontSize: "11px",
    fontWeight: "600",
    minWidth: "45px",
  },
  errorBox: {
    background: "#2a0f0f",
    border: "1px solid #f05c5c44",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#f05c5c",
    fontSize: "13px",
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
  },
  infoBox: {
    background: "#0f1a2a",
    border: "1px solid #6cf0c244",
    borderRadius: "10px",
    padding: "12px 14px",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  infoIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  infoText: {
    fontSize: "12px",
    color: "#6cf0c2",
    margin: 0,
    lineHeight: "1.5",
  },
  submitBtn: {
    width: "100%",
    padding: "15px",
    background: "linear-gradient(135deg, #7c6cf0, #6cf0c2)",
    border: "none",
    borderRadius: "13px",
    color: "#000",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    marginTop: "4px",
    transition: "opacity 0.2s",
  },
  forgotText: {
    textAlign: "center",
    color: "#666",
    fontSize: "13px",
    marginTop: "16px",
    marginBottom: 0,
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#7c6cf0",
    cursor: "pointer",
    fontSize: "13px",
    textDecoration: "underline",
    padding: 0,
  },
  legalFooter: {
    fontSize: "12px",
    color: "#555",
    textAlign: "center",
    maxWidth: "320px",
    lineHeight: "1.5",
    margin: 0,
  },
};