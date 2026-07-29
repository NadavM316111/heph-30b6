"use client";

import { useState } from "react";
import { Session, saveSession } from "@/lib/session";
import { generateOTP, storeOTP, verifyOTP } from "@/lib/otp";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { COUNTRY_CODES } from "@/lib/countryCodes";

type Mode = "login" | "signup";
type Step = "credentials" | "otp" | "done";

interface Props {
  onSuccess: (session: Session) => void;
}

export default function AuthScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("signup");
  const [step, setStep] = useState<Step>("credentials");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState("");

  const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

  const validateCredentials = (): string | null => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address.";
    }
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      return "Please enter a valid phone number.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (mode === "signup" && password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleSendOTP = async () => {
    setError("");
    const validationError = validateCredentials();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const otp = generateOTP();
      storeOTP(fullPhone, otp);
      // In production this calls your SMS gateway; here we log to console
      console.log(`[CONFI OTP] Code for ${fullPhone}: ${otp}`);
      setOtpSentTo(fullPhone);
      setStep("otp");
    } catch {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    if (otpInput.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    const valid = verifyOTP(fullPhone, otpInput);
    if (!valid) {
      setError("Invalid or expired OTP. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const hashed = await hashPassword(password);
      const payload =
        mode === "signup"
          ? { mode: "signup", email, password: hashed, phone: fullPhone }
          : { mode: "login", email, password };

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }

      const session: Session = {
        email: data.email,
        phone: fullPhone,
        token: data.token || btoa(`${data.email}:${Date.now()}`),
        issuedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      saveSession(session);
      onSuccess(session);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginDirect = async () => {
    setError("");
    const validationError = validateCredentials();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Login failed. Check your credentials.");
        setLoading(false);
        return;
      }
      const session: Session = {
        email: data.email,
        phone: fullPhone || data.phone || "",
        token: data.token || btoa(`${data.email}:${Date.now()}`),
        issuedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      saveSession(session);
      onSuccess(session);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>🔐</div>
        <h1 style={styles.title}>Confi</h1>
        <p style={styles.subtitle}>Secure. Confidential. Trusted.</p>
      </div>

      {/* Mode toggle */}
      <div style={styles.modeToggle}>
        <button
          style={{ ...styles.modeBtn, ...(mode === "signup" ? styles.modeBtnActive : {}) }}
          onClick={() => { setMode("signup"); setStep("credentials"); setError(""); }}
        >
          Sign Up
        </button>
        <button
          style={{ ...styles.modeBtn, ...(mode === "login" ? styles.modeBtnActive : {}) }}
          onClick={() => { setMode("login"); setStep("credentials"); setError(""); }}
        >
          Log In
        </button>
      </div>

      {/* Step: Credentials */}
      {step === "credentials" && (
        <div style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label style={styles.label}>Phone Number</label>
          <div style={styles.phoneRow}>
            <select
              style={styles.countrySelect}
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code + c.dial} value={c.dial}>
                  {c.flag} {c.dial}
                </option>
              ))}
            </select>
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              type="tel"
              placeholder="555 000 1234"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <>
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          {mode === "signup" ? (
            <button style={styles.primaryBtn} onClick={handleSendOTP} disabled={loading}>
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          ) : (
            <>
              <button style={styles.primaryBtn} onClick={handleLoginDirect} disabled={loading}>
                {loading ? "Logging in..." : "Log In"}
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={handleSendOTP}
                disabled={loading}
              >
                Log in with OTP instead
              </button>
            </>
          )}
        </div>
      )}

      {/* Step: OTP */}
      {step === "otp" && (
        <div style={styles.form}>
          <div style={styles.otpInfo}>
            <span style={styles.otpIcon}>📱</span>
            <p style={styles.otpText}>
              A 6-digit code was sent to{" "}
              <strong style={{ color: "#a78bfa" }}>{otpSentTo}</strong>
            </p>
            <p style={styles.otpHint}>(Check browser console for demo code)</p>
          </div>

          <label style={styles.label}>Verification Code</label>
          <input
            style={{ ...styles.input, textAlign: "center", fontSize: "28px", letterSpacing: "12px", fontWeight: 700 }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otpInput}
            onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.primaryBtn} onClick={handleVerifyOTP} disabled={loading}>
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => { setStep("credentials"); setOtpInput(""); setError(""); }}
          >
            ← Back
          </button>
          <button
            style={styles.ghostBtn}
            onClick={() => {
              const otp = generateOTP();
              storeOTP(fullPhone, otp);
              console.log(`[CONFI OTP] Resent code for ${fullPhone}: ${otp}`);
            }}
          >
            Resend Code
          </button>
        </div>
      )}

      <p style={styles.legal}>
        By continuing, you agree to Confi&apos;s Terms of Service and Privacy Policy.
        All data is stored with minimal PII practices.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "440px",
    margin: "20px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  header: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logo: {
    fontSize: "48px",
    marginBottom: "8px",
  },
  title: {
    color: "#ffffff",
    fontSize: "32px",
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "#8b8fa8",
    fontSize: "14px",
    marginTop: "6px",
  },
  modeToggle: {
    display: "flex",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "28px",
  },
  modeBtn: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "#8b8fa8",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modeBtnActive: {
    background: "#7c3aed",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
  },
  label: {
    color: "#a0a3b1",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "6px",
    marginTop: "16px",
  },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "15px",
    padding: "12px 14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "0",
    transition: "border-color 0.2s",
  },
  phoneRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  countrySelect: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "14px",
    padding: "12px 8px",
    outline: "none",
    cursor: "pointer",
    minWidth: "80px",
  },
  primaryBtn: {
    marginTop: "24px",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(124,58,237,0.4)",
    transition: "opacity 0.2s",
  },
  secondaryBtn: {
    marginTop: "10px",
    background: "rgba(255,255,255,0.06)",
    color: "#c4b5fd",
    border: "1px solid rgba(124,58,237,0.3)",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    marginTop: "8px",
    background: "transparent",
    color: "#6b7280",
    border: "none",
    padding: "10px",
    fontSize: "13px",
    cursor: "pointer",
    textDecoration: "underline",
  },
  error: {
    color: "#f87171",
    fontSize: "13px",
    marginTop: "10px",
    padding: "10px 14px",
    background: "rgba(248,113,113,0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(248,113,113,0.2)",
  },
  otpInfo: {
    textAlign: "center",
    padding: "20px",
    background: "rgba(124,58,237,0.1)",
    borderRadius: "12px",
    border: "1px solid rgba(124,58,237,0.2)",
    marginBottom: "8px",
  },
  otpIcon: {
    fontSize: "32px",
    display: "block",
    marginBottom: "8px",
  },
  otpText: {
    color: "#e2e8f0",
    fontSize: "14px",
    margin: 0,
  },
  otpHint: {
    color: "#6b7280",
    fontSize: "12px",
    marginTop: "6px",
    marginBottom: 0,
  },
  legal: {
    color: "#4b5563",
    fontSize: "11px",
    textAlign: "center",
    marginTop: "24px",
    lineHeight: 1.5,
  },
};