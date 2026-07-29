"use client";

import { useState } from "react";
import type { AppUser } from "@/app/page";

type Props = {
  onSuccess: (user: AppUser) => void;
};

type AuthMode = "phone" | "email";
type Step = "input" | "otp" | "password";

export default function AuthScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<AuthMode>("phone");
  const [step, setStep] = useState<Step>("input");
  const [isLogin, setIsLogin] = useState(false);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpDisplay, setOtpDisplay] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const generateOTP = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 7) {
      setError("Enter a valid phone number");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const code = generateOTP();
    setGeneratedOtp(code);
    setOtpDisplay(code);
    setOtpSent(true);
    setStep("otp");
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (otp !== generatedOtp) {
      setError("Invalid OTP. Please try again.");
      return;
    }
    setError("");
    setLoading(true);
    // Use email auth API with phone as pseudo-email
    const pseudoEmail = `${phone.replace(/\D/g, "")}@phone.confi.app`;
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: isLogin ? "login" : "signup",
        email: pseudoEmail,
        password: generatedOtp,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || data.error) {
      if (data.error?.includes("already") && !isLogin) {
        // Try login instead
        const res2 = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "login",
            email: pseudoEmail,
            password: generatedOtp,
          }),
        });
        const data2 = await res2.json();
        if (data2.error) {
          setError("Account exists. Use login or try a different number.");
          return;
        }
        finishAuth(data2.email, phone, undefined, data2.sessionToken || generateSessionToken());
        return;
      }
      setError(data.error || "Auth failed");
      return;
    }
    finishAuth(data.email, phone, undefined, data.sessionToken || generateSessionToken());
  };

  const handleEmailAuth = async () => {
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: isLogin ? "login" : "signup", email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || data.error) {
      setError(data.error || "Authentication failed");
      return;
    }
    finishAuth(data.email, undefined, email, data.sessionToken || generateSessionToken());
  };

  const generateSessionToken = () => {
    return btoa(`${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  };

  const finishAuth = (
    apiEmail: string,
    phoneVal?: string,
    emailVal?: string,
    token?: string
  ) => {
    // Try to get existing profile from localStorage
    const existing = localStorage.getItem("confi_profile");
    let profile: { displayName?: string; avatarUrl?: string; isVerified?: boolean } = {};
    if (existing) {
      try { profile = JSON.parse(existing); } catch { /* empty */ }
    }
    const user: AppUser = {
      id: Date.now(),
      email: apiEmail,
      phone: phoneVal,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isVerified: profile.isVerified || false,
      sessionToken: token || generateSessionToken(),
    };
    onSuccess(user);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🔐</span>
          </div>
          <h1 style={styles.appName}>Confi</h1>
          <p style={styles.tagline}>Confidential Messaging, Legally Protected</p>
        </div>

        {/* Mode toggle */}
        <div style={styles.modeTabs}>
          <button
            style={{ ...styles.modeTab, ...(mode === "phone" ? styles.modeTabActive : {}) }}
            onClick={() => { setMode("phone"); setStep("input"); setError(""); }}
          >
            📱 Phone
          </button>
          <button
            style={{ ...styles.modeTab, ...(mode === "email" ? styles.modeTabActive : {}) }}
            onClick={() => { setMode("email"); setStep("input"); setError(""); }}
          >
            ✉️ Email
          </button>
        </div>

        {/* Auth type toggle */}
        <div style={styles.authToggle}>
          <button
            style={{ ...styles.authToggleBtn, ...(!isLogin ? styles.authToggleBtnActive : {}) }}
            onClick={() => { setIsLogin(false); setStep("input"); setError(""); }}
          >
            Sign Up
          </button>
          <button
            style={{ ...styles.authToggleBtn, ...(isLogin ? styles.authToggleBtnActive : {}) }}
            onClick={() => { setIsLogin(true); setStep("input"); setError(""); }}
          >
            Log In
          </button>
        </div>

        {/* Phone flow */}
        {mode === "phone" && step === "input" && (
          <div style={styles.form}>
            <label style={styles.label}>Phone Number</label>
            <div style={styles.phoneRow}>
              <span style={styles.phoneFlag}>🌍</span>
              <input
                style={styles.input}
                type="tel"
                placeholder="+1 555 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
              />
            </div>
            <button style={styles.btn} onClick={handleSendOTP} disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        )}

        {mode === "phone" && step === "otp" && (
          <div style={styles.form}>
            <div style={styles.otpInfo}>
              <p style={styles.otpInfoText}>OTP sent to {phone}</p>
              {otpDisplay && (
                <div style={styles.otpDemo}>
                  <span style={styles.otpDemoLabel}>Demo OTP (production uses SMS):</span>
                  <span style={styles.otpDemoCode}>{otpDisplay}</span>
                </div>
              )}
            </div>
            <label style={styles.label}>Enter 6-digit OTP</label>
            <input
              style={{ ...styles.input, textAlign: "center", fontSize: "24px", letterSpacing: "8px" }}
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
            />
            <button style={styles.btn} onClick={handleVerifyOTP} disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              style={styles.linkBtn}
              onClick={() => { setStep("input"); setOtp(""); setError(""); }}
            >
              ← Change number
            </button>
          </div>
        )}

        {/* Email flow */}
        {mode === "email" && (
          <div style={styles.form}>
            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
            />
            <button style={styles.btn} onClick={handleEmailAuth} disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Log In" : "Create Account"}
            </button>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <p style={styles.terms}>
          By continuing, you agree to Confi's{" "}
          <span style={styles.termLink}>Terms of Service</span> and{" "}
          <span style={styles.termLink}>Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "420px",
    padding: "16px",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "40px 32px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  logoArea: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logo: {
    width: "72px",
    height: "72px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
  },
  logoIcon: {
    fontSize: "32px",
  },
  appName: {
    color: "#fff",
    fontSize: "28px",
    fontWeight: 700,
    margin: "0 0 4px",
  },
  tagline: {
    color: "#94a3b8",
    fontSize: "13px",
    margin: 0,
  },
  modeTabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    background: "rgba(255,255,255,0.05)",
    padding: "4px",
    borderRadius: "12px",
  },
  modeTab: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    transition: "all 0.2s",
    background: "transparent",
    color: "#94a3b8",
  },
  modeTabActive: {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
  },
  authToggle: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  authToggleBtn: {
    flex: 1,
    padding: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    background: "transparent",
    color: "#94a3b8",
    transition: "all 0.2s",
  },
  authToggleBtnActive: {
    borderColor: "#6366f1",
    color: "#6366f1",
    background: "rgba(99,102,241,0.1)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "2px",
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    overflow: "hidden",
  },
  phoneFlag: {
    padding: "0 12px",
    fontSize: "18px",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  btn: {
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "4px",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
    transition: "opacity 0.2s",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px",
    textAlign: "center",
  },
  otpInfo: {
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "10px",
    padding: "12px",
  },
  otpInfoText: {
    color: "#c7d2fe",
    fontSize: "13px",
    margin: "0 0 8px",
  },
  otpDemo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  otpDemoLabel: {
    color: "#94a3b8",
    fontSize: "11px",
  },
  otpDemoCode: {
    color: "#fbbf24",
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "6px",
  },
  error: {
    marginTop: "12px",
    padding: "10px 14px",
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "14px",
  },
  terms: {
    marginTop: "20px",
    color: "#64748b",
    fontSize: "12px",
    textAlign: "center",
    lineHeight: 1.5,
  },
  termLink: {
    color: "#6366f1",
    cursor: "pointer",
  },
};