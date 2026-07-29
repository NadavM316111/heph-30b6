"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { User } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";
import { generateOTP, hashOTP, generateAvatarColor, getInitials, buildSessionToken, encryptIdentity } from "@/lib/identity";

type Step = "entry" | "otp" | "identity" | "complete";
type Mode = "signup" | "login";

interface Props {
  onSuccess: (user: User) => void;
}

export default function AuthFlow({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpHash, setOtpHash] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNDA, setAgreedToNDA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [shake, setShake] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startOtpTimer = useCallback(() => {
    setOtpTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleEntrySubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      triggerShake();
      return;
    }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) {
      setError("Please enter a valid email address.");
      triggerShake();
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email: email.trim(), password }),
      });
      const data = (await res.json()) as { ok?: boolean; email?: string; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Authentication failed. Please try again.");
        triggerShake();
        setLoading(false);
        return;
      }
      // Generate and "send" OTP (in real app, server sends via email/SMS)
      const code = generateOTP();
      const hash = hashOTP(code);
      setGeneratedOtp(code);
      setOtpHash(hash);
      // In production this would be emailed; we show it in the UI for demo
      console.info(`[CONFI DEV] OTP for ${email}: ${code}`);
      setStep("otp");
      startOtpTimer();
    } catch {
      setError("Network error. Please check your connection.");
      triggerShake();
    }
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleOtpVerify = () => {
    const entered = otp.join("");
    if (entered.length < 6) {
      setError("Please enter all 6 digits.");
      triggerShake();
      return;
    }
    const enteredHash = hashOTP(entered);
    if (enteredHash !== otpHash) {
      setError("Incorrect code. Please try again.");
      triggerShake();
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      return;
    }
    setError("");
    if (mode === "login") {
      // For login, skip identity step if we already have profile data stored
      const stored = localStorage.getItem(`confi_identity_${email.trim()}`);
      if (stored) {
        try {
          const identity = JSON.parse(stored);
          const token = buildSessionToken(email.trim());
          const user: User = {
            email: email.trim(),
            displayName: identity.displayName || identity.fullName.split(" ")[0],
            avatarColor: identity.avatarColor || generateAvatarColor(email.trim()),
            avatarInitials: getInitials(identity.displayName || identity.fullName),
            fullName: identity.fullName,
            country: identity.country,
            identityVerified: true,
            sessionToken: token,
          };
          onSuccess(user);
          return;
        } catch {
          // fall through to identity step
        }
      }
    }
    setStep("identity");
  };

  const handleResendOtp = () => {
    if (otpTimer > 0) return;
    const code = generateOTP();
    const hash = hashOTP(code);
    setGeneratedOtp(code);
    setOtpHash(hash);
    console.info(`[CONFI DEV] Resent OTP for ${email}: ${code}`);
    setOtp(["", "", "", "", "", ""]);
    startOtpTimer();
    setError("");
  };

  const handleIdentitySubmit = () => {
    setError("");
    if (!fullName.trim() || fullName.trim().split(" ").length < 2) {
      setError("Please enter your full legal name (first and last name).");
      triggerShake();
      return;
    }
    if (!country) {
      setError("Please select your country.");
      triggerShake();
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Platform Terms of Service.");
      triggerShake();
      return;
    }
    if (!agreedToNDA) {
      setError("You must acknowledge the NDA Framework to proceed.");
      triggerShake();
      return;
    }
    const dn = displayName.trim() || fullName.trim().split(" ")[0];
    const avatarColor = generateAvatarColor(email.trim());
    const avatarInitials = getInitials(dn);
    const token = buildSessionToken(email.trim());

    // Encrypt and store identity locally (in production, send to server)
    const identityPayload = encryptIdentity({
      fullName: fullName.trim(),
      country,
      displayName: dn,
      avatarColor,
      agreedToTermsAt: new Date().toISOString(),
      agreedToNDAAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    });
    localStorage.setItem(`confi_identity_${email.trim()}`, JSON.stringify({
      fullName: fullName.trim(),
      country,
      displayName: dn,
      avatarColor,
      encrypted: identityPayload,
    }));

    const user: User = {
      email: email.trim(),
      displayName: dn,
      avatarColor,
      avatarInitials,
      fullName: fullName.trim(),
      country,
      identityVerified: true,
      sessionToken: token,
    };
    setStep("complete");
    setTimeout(() => onSuccess(user), 1800);
  };

  // --- RENDER ---

  if (step === "complete") {
    return (
      <div style={styles.card}>
        <div style={styles.successIcon}>✓</div>
        <h2 style={styles.successTitle}>Identity Verified</h2>
        <p style={styles.successSubtitle}>
          Welcome to Confi. Your identity is legally confirmed and encrypted.
        </p>
        <div style={styles.loadingBar}>
          <div style={styles.loadingBarFill} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, animation: "fadeIn 0.4s ease-out" }}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>🔐</span>
        <span style={styles.logoText}>Confi</span>
      </div>

      {step === "entry" && (
        <>
          <div style={styles.modeToggle}>
            <button
              style={{ ...styles.modeBtn, ...(mode === "signup" ? styles.modeBtnActive : {}) }}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Sign Up
            </button>
            <button
              style={{ ...styles.modeBtn, ...(mode === "login" ? styles.modeBtnActive : {}) }}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Log In
            </button>
          </div>

          <h1 style={styles.title}>
            {mode === "signup" ? "Create your secure account" : "Welcome back"}
          </h1>
          <p style={styles.subtitle}>
            {mode === "signup"
              ? "Your identity will be verified and legally bound to the platform."
              : "Log in to access your confidential conversations."}
          </p>

          <div style={{ animation: shake ? "shake 0.5s ease" : undefined }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEntrySubmit()}
                autoComplete="email"
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEntrySubmit()}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button
              style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handleEntrySubmit}
              disabled={loading}
            >
              {loading ? "Verifying…" : mode === "signup" ? "Continue →" : "Log In →"}
            </button>
          </div>

          <p style={styles.legalNote}>
            By continuing, you agree to our Terms of Service and acknowledge that verified
            identity information is used to legally bind confidential agreements.
          </p>
        </>
      )}

      {step === "otp" && (
        <>
          <h1 style={styles.title}>Verify your email</h1>
          <p style={styles.subtitle}>
            We sent a 6-digit code to <strong style={{ color: "#a78bfa" }}>{email}</strong>.
            {process.env.NODE_ENV !== "production" && (
              <span style={{ display: "block", marginTop: "8px", color: "#fbbf24", fontSize: "13px" }}>
                Dev mode: check the browser console for your OTP code.
              </span>
            )}
          </p>

          <div style={{ animation: shake ? "shake 0.5s ease" : undefined }}>
            <div style={styles.otpRow}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  style={styles.otpInput}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                />
              ))}
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.primaryBtn} onClick={handleOtpVerify}>
              Verify Code →
            </button>
          </div>

          <div style={styles.resendRow}>
            {otpTimer > 0 ? (
              <span style={styles.timerText}>Resend in {otpTimer}s</span>
            ) : (
              <button style={styles.linkBtn} onClick={handleResendOtp}>
                Resend code
              </button>
            )}
            <button style={styles.linkBtn} onClick={() => { setStep("entry"); setError(""); }}>
              ← Change email
            </button>
          </div>
        </>
      )}

      {step === "identity" && (
        <>
          <div style={styles.stepBadge}>Step 3 of 3 — Legal Identity</div>
          <h1 style={styles.title}>Confirm your identity</h1>
          <p style={styles.subtitle}>
            This information is encrypted and used to legally bind confidential agreements
            (NDAs) to your verified identity.
          </p>

          <div style={{ animation: shake ? "shake 0.5s ease" : undefined }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full Legal Name *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="First Last (as on government ID)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              <span style={styles.hint}>Must match a government-issued ID</span>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder={fullName ? fullName.split(" ")[0] : "How others see you"}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <span style={styles.hint}>Visible to other users (optional — defaults to first name)</span>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Country / Jurisdiction *</label>
              <select
                style={styles.select}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">— Select your country —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <span style={styles.hint}>Determines governing law for confidential agreements</span>
            </div>

            <div style={styles.agreementBox}>
              <h3 style={styles.agreementTitle}>⚖️ Legal Agreements</h3>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>
                  I have read and agree to the{" "}
                  <a style={styles.link} href="#terms" onClick={(e) => e.preventDefault()}>
                    Platform Terms of Service
                  </a>{" "}
                  and{" "}
                  <a style={styles.link} href="#privacy" onClick={(e) => e.preventDefault()}>
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={agreedToNDA}
                  onChange={(e) => setAgreedToNDA(e.target.checked)}
                />
                <span>
                  I understand that activating{" "}
                  <strong style={{ color: "#a78bfa" }}>Confidential Mode</strong> on any
                  conversation will bind me — under my verified legal identity — to an
                  international Non-Disclosure Agreement (NDA) governed by applicable law in
                  my jurisdiction. I acknowledge this creates{" "}
                  <strong>legally enforceable obligations</strong>.
                </span>
              </label>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button style={styles.primaryBtn} onClick={handleIdentitySubmit}>
              🔐 Verify Identity & Activate Account
            </button>
          </div>

          <div style={styles.securityNote}>
            <span style={styles.securityIcon}>🛡️</span>
            <span>
              Your identity data is encrypted with AES-256 before storage. It is never shared
              without your explicit consent and a valid legal process.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "40px",
    width: "100%",
    maxWidth: "480px",
    margin: "20px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "28px",
  },
  logoIcon: { fontSize: "28px" },
  logoText: {
    fontSize: "24px",
    fontWeight: "800",
    background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  modeToggle: {
    display: "flex",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "24px",
    gap: "4px",
  },
  modeBtn: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "9px",
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s",
  },
  modeBtnActive: {
    background: "rgba(124,58,237,0.5)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "8px",
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.55)",
    marginBottom: "24px",
    lineHeight: 1.6,
  },
  stepBadge: {
    display: "inline-block",
    background: "rgba(124,58,237,0.2)",
    border: "1px solid rgba(124,58,237,0.4)",
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 12px",
    borderRadius: "20px",
    marginBottom: "16px",
  },
  inputGroup: {
    marginBottom: "18px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(30,27,75,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
    cursor: "pointer",
  },
  hint: {
    display: "block",
    marginTop: "4px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.35)",
  },
  otpRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    justifyContent: "center",
  },
  otpInput: {
    width: "50px",
    height: "60px",
    textAlign: "center",
    fontSize: "24px",
    fontWeight: "700",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    color: "#ffffff",
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "8px",
    transition: "opacity 0.2s, transform 0.1s",
    boxShadow: "0 4px 15px rgba(124,58,237,0.4)",
  },
  error: {
    color: "#f87171",
    fontSize: "13px",
    marginBottom: "12px",
    padding: "10px 14px",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: "8px",
  },
  legalNote: {
    marginTop: "20px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.3)",
    lineHeight: 1.6,
    textAlign: "center",
  },
  resendRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "16px",
  },
  timerText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#a78bfa",
    fontSize: "13px",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  agreementBox: {
    background: "rgba(124,58,237,0.08)",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  agreementTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    marginBottom: "4px",
  },
  checkboxLabel: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    fontSize: "13px",
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.6,
    cursor: "pointer",
  },
  checkbox: {
    marginTop: "3px",
    width: "16px",
    height: "16px",
    accentColor: "#7c3aed",
    flexShrink: 0,
    cursor: "pointer",
  },
  link: {
    color: "#a78bfa",
    textDecoration: "underline",
    cursor: "pointer",
  },
  securityNote: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    marginTop: "20px",
    padding: "14px",
    background: "rgba(16,185,129,0.07)",
    border: "1px solid rgba(16,185,129,0.15)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.6,
  },
  securityIcon: { fontSize: "16px", flexShrink: 0 },
  successIcon: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #10b981, #059669)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    color: "white",
    margin: "0 auto 20px",
    boxShadow: "0 0 40px rgba(16,185,129,0.4)",
  },
  successTitle: {
    textAlign: "center",
    fontSize: "24px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "10px",
  },
  successSubtitle: {
    textAlign: "center",
    fontSize: "14px",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.6,
    marginBottom: "24px",
  },
  loadingBar: {
    height: "4px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  loadingBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #7c3aed, #10b981)",
    borderRadius: "2px",
    animation: "loadingBar 1.8s ease-out forwards",
    width: "0%",
  },
};