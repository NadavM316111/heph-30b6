"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "landing"
  | "method"
  | "phone-entry"
  | "otp-verify"
  | "email-entry"
  | "legal"
  | "profile"
  | "dashboard";

type AuthMethod = "phone" | "email";
type AuthMode = "signup" | "login";

interface UserSession {
  email: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
  phone?: string;
  agreedToNDA: boolean;
  agreedToTerms: boolean;
  fullLegalName: string;
  createdAt: string;
  sessionToken: string;
}

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

// ─── Rate Limiting (client-side guard, server enforces too) ───────────────────

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 min
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 min

function getRateLimit(key: string): RateLimitEntry {
  try {
    const stored = localStorage.getItem(`rl_${key}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { attempts: 0, firstAttempt: Date.now() };
}

function setRateLimit(key: string, entry: RateLimitEntry) {
  try {
    localStorage.setItem(`rl_${key}`, JSON.stringify(entry));
  } catch {}
}

function checkRateLimit(key: string): { allowed: boolean; remainingMs?: number } {
  const entry = getRateLimit(key);
  const now = Date.now();

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, remainingMs: entry.lockedUntil - now };
  }

  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    setRateLimit(key, { attempts: 0, firstAttempt: now });
    return { allowed: true };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const lockUntil = now + LOCKOUT_DURATION;
    setRateLimit(key, { ...entry, lockedUntil: lockUntil });
    return { allowed: false, remainingMs: LOCKOUT_DURATION };
  }

  return { allowed: true };
}

function incrementRateLimit(key: string) {
  const entry = getRateLimit(key);
  const now = Date.now();
  const reset = now - entry.firstAttempt > RATE_LIMIT_WINDOW;
  setRateLimit(key, {
    attempts: reset ? 1 : entry.attempts + 1,
    firstAttempt: reset ? now : entry.firstAttempt,
  });
}

function clearRateLimit(key: string) {
  try {
    localStorage.removeItem(`rl_${key}`);
  } catch {}
}

// ─── OTP Simulation ───────────────────────────────────────────────────────────

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashSimple(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ─── Avatar Colors ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626",
  "#D97706", "#DB2777", "#0891B2", "#65A30D",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMs(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

// ─── Country Codes ────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: "+1", country: "US/CA" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" },
  { code: "+34", country: "ES" },
  { code: "+31", country: "NL" },
  { code: "+46", country: "SE" },
  { code: "+47", country: "NO" },
  { code: "+45", country: "DK" },
  { code: "+41", country: "CH" },
  { code: "+43", country: "AT" },
  { code: "+32", country: "BE" },
  { code: "+351", country: "PT" },
  { code: "+353", country: "IE" },
  { code: "+358", country: "FI" },
  { code: "+48", country: "PL" },
  { code: "+420", country: "CZ" },
  { code: "+36", country: "HU" },
  { code: "+40", country: "RO" },
  { code: "+7", country: "RU" },
  { code: "+380", country: "UA" },
  { code: "+90", country: "TR" },
  { code: "+972", country: "IL" },
  { code: "+971", country: "AE" },
  { code: "+966", country: "SA" },
  { code: "+20", country: "EG" },
  { code: "+27", country: "ZA" },
  { code: "+234", country: "NG" },
  { code: "+254", country: "KE" },
  { code: "+91", country: "IN" },
  { code: "+86", country: "CN" },
  { code: "+81", country: "JP" },
  { code: "+82", country: "KR" },
  { code: "+65", country: "SG" },
  { code: "+60", country: "MY" },
  { code: "+66", country: "TH" },
  { code: "+84", country: "VN" },
  { code: "+62", country: "ID" },
  { code: "+63", country: "PH" },
  { code: "+55", country: "BR" },
  { code: "+52", country: "MX" },
  { code: "+54", country: "AR" },
  { code: "+56", country: "CL" },
  { code: "+57", country: "CO" },
  { code: "+51", country: "PE" },
  { code: "+61", country: "AU" },
  { code: "+64", country: "NZ" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [step, setStep] = useState<Step>("landing");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [session, setSession] = useState<UserSession | null>(null);

  // Phone fields
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [otpExpiry, setOtpExpiry] = useState<number>(0);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Legal fields
  const [fullLegalName, setFullLegalName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToNDA, setAgreedToNDA] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showNDAModal, setShowNDAModal] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lockoutMs, setLockoutMs] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lockoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Session Restore ──────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem("confi_session");
      if (stored) {
        const parsed: UserSession = JSON.parse(stored);
        if (parsed.sessionToken) {
          setSession(parsed);
          setStep("dashboard");
        }
      }
    } catch {}
  }, []);

  // ── Analytics ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // ── OTP Countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (otpCountdown > 0) {
      countdownRef.current = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    }
    return () => { if (countdownRef.current) clearTimeout(countdownRef.current); };
  }, [otpCountdown]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  // ── Lockout Countdown ────────────────────────────────────────────────────────

  useEffect(() => {
    if (lockoutMs > 0) {
      lockoutRef.current = setTimeout(() => setLockoutMs((m) => Math.max(0, m - 1000)), 1000);
    }
    return () => { if (lockoutRef.current) clearTimeout(lockoutRef.current); };
  }, [lockoutMs]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const clearMessages = () => { setError(""); setSuccess(""); };

  const saveSession = (sess: UserSession) => {
    setSession(sess);
    try { localStorage.setItem("confi_session", JSON.stringify(sess)); } catch {}
  };

  const logout = () => {
    setSession(null);
    try { localStorage.removeItem("confi_session"); } catch {}
    setStep("landing");
    setEmail("");
    setPassword("");
    setPhoneNumber("");
    setOtp(["", "", "", "", "", ""]);
    setFullLegalName("");
    setAgreedToTerms(false);
    setAgreedToNDA(false);
    setDisplayName("");
  };

  // ── Send OTP ─────────────────────────────────────────────────────────────────

  const handleSendOTP = useCallback(async () => {
    clearMessages();
    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
    const rlKey = `otp_${fullPhone}`;

    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      setLockoutMs(rl.remainingMs || LOCKOUT_DURATION);
      setError(`Too many attempts. Try again in ${formatMs(rl.remainingMs || LOCKOUT_DURATION)}.`);
      return;
    }

    if (!/^\d{7,15}$/.test(phoneNumber.replace(/\D/g, ""))) {
      setError("Enter a valid phone number.");
      return;
    }

    setLoading(true);
    incrementRateLimit(rlKey);

    // Simulate OTP send (in production, integrate Twilio/AWS SNS)
    await new Promise((r) => setTimeout(r, 800));
    const code = generateOTP();
    setGeneratedOTP(code);
    setOtpExpiry(Date.now() + 5 * 60 * 1000); // 5 min
    setOtpCountdown(300);
    setResendCooldown(60);
    setLoading(false);

    // Dev: show OTP in success message (remove in production)
    setSuccess(`OTP sent to ${fullPhone}. [DEV ONLY: ${code}]`);
    setStep("otp-verify");
  }, [countryCode, phoneNumber]);

  // ── Verify OTP ───────────────────────────────────────────────────────────────

  const handleVerifyOTP = useCallback(async () => {
    clearMessages();
    const enteredOTP = otp.join("");
    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
    const rlKey = `otpverify_${fullPhone}`;

    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      setLockoutMs(rl.remainingMs || LOCKOUT_DURATION);
      setError(`Too many attempts. Locked for ${formatMs(rl.remainingMs || LOCKOUT_DURATION)}.`);
      return;
    }

    if (enteredOTP.length !== 6) { setError("Enter all 6 digits."); return; }
    if (Date.now() > otpExpiry) { setError("OTP expired. Please resend."); return; }

    setLoading(true);
    incrementRateLimit(rlKey);
    await new Promise((r) => setTimeout(r, 500));

    if (enteredOTP !== generatedOTP) {
      setLoading(false);
      setError("Incorrect OTP. Please try again.");
      return;
    }

    clearRateLimit(rlKey);
    setLoading(false);
    setSuccess("Phone verified!");

    // Use phone as email for auth
    const phoneEmail = `${fullPhone.replace(/\+/g, "")}@phone.confi.app`;
    setEmail(phoneEmail);

    // Auto-generate a secure password from OTP + hash
    const autoPass = `Confi_${hashSimple(fullPhone + generatedOTP)}_${Date.now()}`;
    setPassword(autoPass);

    setTimeout(() => setStep("legal"), 800);
  }, [otp, countryCode, phoneNumber, otpExpiry, generatedOTP]);

  // ── Email Auth ───────────────────────────────────────────────────────────────

  const handleEmailAuth = useCallback(async () => {
    clearMessages();
    const rlKey = `email_${email}`;

    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      setLockoutMs(rl.remainingMs || LOCKOUT_DURATION);
      setError(`Too many attempts. Locked for ${formatMs(rl.remainingMs || LOCKOUT_DURATION)}.`);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (authMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    if (authMode === "signup" && !(hasUpper && hasLower && hasNum)) {
      setError("Password must contain uppercase, lowercase, and a number.");
      return;
    }

    setLoading(true);
    incrementRateLimit(rlKey);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email, password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setLoading(false);
        setError(data.error || "Authentication failed.");
        return;
      }

      clearRateLimit(rlKey);
      setLoading(false);

      if (authMode === "login") {
        // On login, check if profile exists
        try {
          const profileRaw = localStorage.getItem(`confi_profile_${email}`);
          if (profileRaw) {
            const profile = JSON.parse(profileRaw);
            const sess: UserSession = {
              ...profile,
              sessionToken: `jwt_${hashSimple(email + Date.now().toString())}`,
            };
            saveSession(sess);
            setStep("dashboard");
            return;
          }
        } catch {}
        setStep("legal");
      } else {
        setStep("legal");
      }
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }, [email, password, confirmPassword, authMode]);

  // ── Legal Agreement ───────────────────────────────────────────────────────────

  const handleLegalConfirm = useCallback(async () => {
    clearMessages();

    if (!fullLegalName.trim() || fullLegalName.trim().split(" ").length < 2) {
      setError("Please enter your full legal name (first and last name).");
      return;
    }
    if (!/^[a-zA-Z\s\-'.]+$/.test(fullLegalName.trim())) {
      setError("Name may only contain letters, spaces, hyphens, and apostrophes.");
      return;
    }
    if (!agreedToTerms) { setError("You must agree to the Terms of Service."); return; }
    if (!agreedToNDA) { setError("You must agree to the NDA Framework to continue."); return; }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    setStep("profile");
  }, [fullLegalName, agreedToTerms, agreedToNDA]);

  // ── Profile Creation ─────────────────────────────────────────────────────────

  const handleProfileCreate = useCallback(async () => {
    clearMessages();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (displayName.trim().length > 30) {
      setError("Display name must be 30 characters or fewer.");
      return;
    }

    setLoading(true);

    const sess: UserSession = {
      email,
      displayName: displayName.trim(),
      avatarColor: selectedColor,
      avatarInitials: getInitials(displayName.trim()),
      phone: authMethod === "phone" ? `${countryCode}${phoneNumber}` : undefined,
      agreedToNDA,
      agreedToTerms,
      fullLegalName: fullLegalName.trim(),
      createdAt: new Date().toISOString(),
      sessionToken: `jwt_${hashSimple(email + Date.now().toString())}`,
    };

    // Persist profile for login re-use
    try {
      localStorage.setItem(`confi_profile_${email}`, JSON.stringify(sess));
    } catch {}

    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    saveSession(sess);
    setStep("dashboard");
  }, [displayName, selectedColor, email, authMethod, countryCode, phoneNumber, agreedToNDA, agreedToTerms, fullLegalName]);

  // ── OTP Input Handling ────────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Background */}
      <div style={styles.bgGradient} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🔒</span>
          <span style={styles.logoText}>Confi</span>
        </div>
        {session && (
          <button onClick={logout} style={styles.logoutBtn}>
            Sign Out
          </button>
        )}
      </header>

      {/* Main Content */}
      <main style={styles.main}>

        {/* ── LANDING ─────────────────────────────────────────────────────── */}
        {step === "landing" && (
          <div style={styles.card}>
            <div style={styles.heroIcon}>🔐</div>
            <h1 style={styles.heroTitle}>Confi Messaging</h1>
            <p style={styles.heroSubtitle}>
              The world's first messaging app with built-in international NDA
              protection. Every confidential conversation is legally covered.
            </p>
            <div style={styles.featureList}>
              {[
                "🛡️  International NDA activation per conversation",
                "✅  Legal identity verification",
                "🔏  End-to-end encrypted messaging",
                "⚖️  Enforceable confidentiality agreements",
              ].map((f) => (
                <div key={f} style={styles.featureItem}>{f}</div>
              ))}
            </div>
            <button onClick={() => { setAuthMode("signup"); setStep("method"); }} style={styles.primaryBtn}>
              Get Started — It's Free
            </button>
            <button onClick={() => { setAuthMode("login"); setStep("method"); }} style={styles.secondaryBtn}>
              Sign In to Existing Account
            </button>
          </div>
        )}

        {/* ── METHOD SELECTION ─────────────────────────────────────────────── */}
        {step === "method" && (
          <div style={styles.card}>
            <BackBtn onClick={() => setStep("landing")} />
            <h2 style={styles.cardTitle}>
              {authMode === "signup" ? "Create Your Account" : "Welcome Back"}
            </h2>
            <p style={styles.cardSubtitle}>Choose how you'd like to continue</p>
            <div style={styles.methodGrid}>
              <button
                onClick={() => { setAuthMethod("phone"); setStep("phone-entry"); clearMessages(); }}
                style={styles.methodCard}
              >
                <span style={styles.methodIcon}>📱</span>
                <span style={styles.methodLabel}>Phone Number</span>
                <span style={styles.methodDesc}>Verify with SMS OTP</span>
              </button>
              <button
                onClick={() => { setAuthMethod("email"); setStep("email-entry"); clearMessages(); }}
                style={styles.methodCard}
              >
                <span style={styles.methodIcon}>✉️</span>
                <span style={styles.methodLabel}>Email</span>
                <span style={styles.methodDesc}>
                  {authMode === "signup" ? "Sign up with email" : "Sign in with email"}
                </span>
              </button>
            </div>
            <p style={styles.toggleAuth}>
              {authMode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <span
                style={styles.link}
                onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
              >
                {authMode === "signup" ? "Sign In" : "Sign Up"}
              </span>
            </p>
          </div>
        )}

        {/* ── PHONE ENTRY ──────────────────────────────────────────────────── */}
        {step === "phone-entry" && (
          <div style={styles.card}>
            <BackBtn onClick={() => { setStep("method"); clearMessages(); }} />
            <h2 style={styles.cardTitle}>Enter Your Phone</h2>
            <p style={styles.cardSubtitle}>We'll send a 6-digit verification code</p>

            {error && <AlertBox type="error" message={error} />}
            {success && <AlertBox type="success" message={success} />}

            {lockoutMs > 0 && (
              <AlertBox type="error" message={`Account locked. Try again in ${formatMs(lockoutMs)}.`} />
            )}

            <div style={styles.phoneRow}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={styles.countrySelect}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.country} value={c.code}>
                    {c.code} {c.country}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={styles.phoneInput}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
              />
            </div>

            <button
              onClick={handleSendOTP}
              disabled={loading || lockoutMs > 0}
              style={{ ...styles.primaryBtn, ...(loading ? styles.disabledBtn : {}) }}
            >
              {loading ? "Sending…" : "Send Verification Code"}
            </button>
          </div>
        )}

        {/* ── OTP VERIFY ───────────────────────────────────────────────────── */}
        {step === "otp-verify" && (
          <div style={styles.card}>
            <BackBtn onClick={() => { setStep("phone-entry"); clearMessages(); setOtp(["", "", "", "", "", ""]); }} />
            <h2 style={styles.cardTitle}>Verify Your Phone</h2>
            <p style={styles.cardSubtitle}>
              Enter the 6-digit code sent to {countryCode} {phoneNumber}
            </p>

            {error && <AlertBox type="error" message={error} />}
            {success && <AlertBox type="success" message={success} />}

            <div style={styles.otpContainer}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  style={styles.otpInput}
                />
              ))}
            </div>

            {otpCountdown > 0 && (
              <p style={styles.otpTimer}>
                Code expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, "0")}
              </p>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join("").length !== 6}
              style={{ ...styles.primaryBtn, ...(otp.join("").length !== 6 ? styles.disabledBtn : {}) }}
            >
              {loading ? "Verifying…" : "Verify Code"}
            </button>

            <button
              onClick={handleSendOTP}
              disabled={resendCooldown > 0 || loading}
              style={styles.ghostBtn}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
            </button>
          </div>
        )}

        {/* ── EMAIL ENTRY ──────────────────────────────────────────────────── */}
        {step === "email-entry" && (
          <div style={styles.card}>
            <BackBtn onClick={() => { setStep("method"); clearMessages(); }} />
            <h2 style={styles.cardTitle}>
              {authMode === "signup" ? "Sign Up with Email" : "Sign In with Email"}
            </h2>
            <p style={styles.cardSubtitle}>
              {authMode === "signup"
                ? "Create your secure Confi account"
                : "Welcome back — sign in to continue"}
            </p>

            {error && <AlertBox type="error" message={error} />}
            {lockoutMs > 0 && (
              <AlertBox type="error" message={`Too many attempts. Try again in ${formatMs(lockoutMs)}.`} />
            )}

            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
            />

            <label style={styles.label}>Password</label>
            <div style={styles.passwordRow}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={authMode === "signup" ? "Min 8 chars, upper+lower+number" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {authMode === "signup" && (
              <>
                <PasswordStrength password={password} />
                <label style={styles.label}>Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
                />
              </>
            )}

            <button
              onClick={handleEmailAuth}
              disabled={loading || lockoutMs > 0}
              style={{ ...styles.primaryBtn, ...(loading ? styles.disabledBtn : {}) }}
            >
              {loading ? (authMode === "signup" ? "Creating Account…" : "Signing In…")
                : (authMode === "signup" ? "Create Account" : "Sign In")}
            </button>

            <p style={styles.toggleAuth}>
              {authMode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <span
                style={styles.link}
                onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); clearMessages(); }}
              >
                {authMode === "signup" ? "Sign In" : "Sign Up"}
              </span>
            </p>
          </div>
        )}

        {/* ── LEGAL ────────────────────────────────────────────────────────── */}
        {step === "legal" && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Legal Identity Confirmation</h2>
            <p style={styles.cardSubtitle}>
              Required for NDA enforcement. This binds your legal identity to any
              confidentiality agreements you activate on Confi.
            </p>

            {error && <AlertBox type="error" message={error} />}

            <div style={styles.legalBanner}>
              <span style={{ fontSize: 20 }}>⚖️</span>
              <span style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.4 }}>
                Confi's confidential conversations are covered by an international
                NDA framework enforceable in 90+ jurisdictions. Your legal name
                is required for binding effect.
              </span>
            </div>

            <label style={styles.label}>Full Legal Name</label>
            <input
              type="text"
              placeholder="e.g. Jane Elizabeth Smith"
              value={fullLegalName}
              onChange={(e) => setFullLegalName(e.target.value)}
              style={styles.input}
              autoComplete="name"
            />
            <p style={styles.fieldHint}>
              Must match your government-issued ID. Used for NDA binding only.
            </p>

            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={styles.checkbox}
              />
              <label htmlFor="terms" style={styles.checkboxLabel}>
                I agree to the{" "}
                <span style={styles.link} onClick={() => setShowTermsModal(true)}>
                  Terms of Service
                </span>{" "}
                and Privacy Policy
              </label>
            </div>

            <div style={styles.checkboxRow}>
              <input
                type="checkbox"
                id="nda"
                checked={agreedToNDA}
                onChange={(e) => setAgreedToNDA(e.target.checked)}
                style={styles.checkbox}
              />
              <label htmlFor="nda" style={styles.checkboxLabel}>
                I agree to the{" "}
                <span style={styles.link} onClick={() => setShowNDAModal(true)}>
                  Confi NDA Framework
                </span>{" "}
                and understand it creates legally binding obligations when
                I activate confidential mode in any conversation
              </label>
            </div>

            <button
              onClick={handleLegalConfirm}
              disabled={loading || !agreedToTerms || !agreedToNDA}
              style={{
                ...styles.primaryBtn,
                ...(!agreedToTerms || !agreedToNDA ? styles.disabledBtn : {}),
              }}
            >
              {loading ? "Confirming…" : "Confirm & Continue"}
            </button>

            {/* Terms Modal */}
            {showTermsModal && (
              <LegalModal
                title="Terms of Service"
                onClose={() => setShowTermsModal(false)}
                onAccept={() => { setAgreedToTerms(true); setShowTermsModal(false); }}
              >
                <TermsContent />
              </LegalModal>
            )}

            {/* NDA Modal */}
            {showNDAModal && (
              <LegalModal
                title="Confi NDA Framework"
                onClose={() => setShowNDAModal(false)}
                onAccept={() => { setAgreedToNDA(true); setShowNDAModal(false); }}
              >
                <NDAContent />
              </LegalModal>
            )}
          </div>
        )}

        {/* ── PROFILE ──────────────────────────────────────────────────────── */}
        {step === "profile" && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Create Your Profile</h2>
            <p style={styles.cardSubtitle}>
              How should others see you on Confi?
            </p>

            {error && <AlertBox type="error" message={error} />}

            <div style={styles.avatarPreview}>
              <div style={{ ...styles.avatarCircle, backgroundColor: selectedColor }}>
                {displayName.trim()
                  ? getInitials(displayName.trim())
                  : "?"}
              </div>
              <p style={styles.avatarPreviewLabel}>Your avatar preview</p>
            </div>

            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              placeholder="e.g. Jane S. or JaneSmith"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={styles.input}
              maxLength={30}
            />
            <p style={styles.fieldHint}>
              {displayName.length}/30 characters — visible to your contacts
            </p>

            <label style={styles.label}>Avatar Color</label>
            <div style={styles.colorGrid}>
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    ...styles.colorSwatch,
                    backgroundColor: color,
                    outline: selectedColor === color ? "3px solid #1e293b" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>

            <div style={styles.identityBadge}>
              <span style={{ fontSize: 14 }}>✅</span>
              <div>
                <p style={styles.identityBadgeName}>{fullLegalName}</p>
                <p style={styles.identityBadgeNote}>Legal identity confirmed • NDA framework accepted</p>
              </div>
            </div>

            <button
              onClick={handleProfileCreate}
              disabled={loading || displayName.trim().length < 2}
              style={{
                ...styles.primaryBtn,
                ...(displayName.trim().length < 2 ? styles.disabledBtn : {}),
              }}
            >
              {loading ? "Creating Profile…" : "Launch Confi 🚀"}
            </button>
          </div>
        )}

        {/* ── DASHBOARD ────────────────────────────────────────────────────── */}
        {step === "dashboard" && session && (
          <div style={styles.dashboardContainer}>
            {/* Sidebar */}
            <div style={styles.sidebar}>
              <div style={styles.sidebarHeader}>
                <div style={{ ...styles.avatarCircle, ...styles.avatarSm, backgroundColor: session.avatarColor }}>
                  {session.avatarInitials}
                </div>
                <div style={styles.sidebarUserInfo}>
                  <p style={styles.sidebarName}>{session.displayName}</p>
                  <p style={styles.sidebarEmail}>{session.email}</p>
                </div>
              </div>

              <div style={styles.ndaBadge}>
                <span style={{ fontSize: 13 }}>⚖️</span>
                <span style={{ fontSize: 12, color: "#065f46", fontWeight: 600 }}>
                  NDA Framework Active
                </span>
              </div>

              <div style={styles.identityCard}>
                <p style={styles.identityLabel}>Legal Identity</p>
                <p style={styles.identityValue}>{session.fullLegalName}</p>
                <p style={styles.identityMeta}>
                  Verified {new Date(session.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div style={styles.chatListHeader}>Conversations</div>

              {DEMO_CONVERSATIONS.map((conv) => (
                <div key={conv.id} style={styles.chatItem}>
                  <div style={{ ...styles.avatarCircle, ...styles.avatarSm, backgroundColor: conv.color }}>
                    {conv.initials}
                  </div>
                  <div style={styles.chatItemText}>
                    <div style={styles.chatItemName}>
                      {conv.name}
                      {conv.confidential && (
                        <span style={styles.confiBadge}>🔒 Confi</span>
                      )}
                    </div>
                    <div style={styles.chatItemPreview}>{conv.preview}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Panel */}
            <div style={styles.mainPanel}>
              <div style={styles.welcomePanel}>
                <div style={{ fontSize: 64 }}>🔐</div>
                <h2 style={styles.welcomeTitle}>
                  Welcome to Confi, {session.displayName}!
                </h2>
                <p style={styles.welcomeText}>
                  Your identity is verified and your NDA framework is active.
                  Start a new conversation and toggle{" "}
                  <strong>Confidential Mode</strong> to activate international
                  NDA protection on any conversation.
                </p>

                <div style={styles.statusGrid}>
                  <StatusCard
                    icon="✅"
                    label="Identity Verified"
                    value={session.fullLegalName}
                    color="#059669"
                  />
                  <StatusCard
                    icon="⚖️"
                    label="NDA Framework"
                    value="Active & Enforceable"
                    color="#7C3AED"
                  />
                  <StatusCard
                    icon="📅"
                    label="Member Since"
                    value={new Date(session.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    color="#2563EB"
                  />
                  <StatusCard
                    icon="🔏"
                    label="Session Security"
                    value="JWT Token Active"
                    color="#D97706"
                  />
                </div>

                <div style={styles.sessionTokenBox}>
                  <p style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                    Session Token: {session.sessionToken}
                  </p>
                </div>

                <button
                  onClick={logout}
                  style={{ ...styles.secondaryBtn, maxWidth: 240, margin: "0 auto" }}
                >
                  Sign Out Securely
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={styles.backBtn}>
      ← Back
    </button>
  );
}

function AlertBox({ type, message }: { type: "error" | "success"; message: string }) {
  return (
    <div style={type === "error" ? styles.errorBox : styles.successBox}>
      {type === "error" ? "⚠️" : "✅"} {message}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Lowercase", pass: /[a-z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special char", pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.strengthBar}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              ...styles.strengthSegment,
              backgroundColor: i < score ? colors[score - 1] : "#e2e8f0",
            }}
          />
        ))}
      </div>
      <div style={styles.strengthChecks}>
        {checks.map((c) => (
          <span
            key={c.label}
            style={{ ...styles.strengthCheck, color: c.pass ? "#16a34a" : "#94a3b8" }}
          >
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegalModal({
  title,
  onClose,
  onAccept,
  children,
}: {
  title: string;
  onClose: () => void;
  onAccept: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} style={styles.modalClose}>✕</button>
        </div>
        <div style={styles.modalBody}>{children}</div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.secondaryBtn}>
            Close
          </button>
          <button onClick={onAccept} style={styles.primaryBtn}>
            I Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <div style={{ ...styles.statusCard, borderLeft: `4px solid ${color}` }}>
      <div style={styles.statusIcon}>{icon}</div>
      <div>
        <p style={styles.statusLabel}>{label}</p>
        <p style={styles.statusValue}>{value}</p>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <div style={styles.legalText}>
      <h4>Confi Messaging — Terms of Service</h4>
      <p><strong>Effective Date:</strong> January 1, 2025</p>
      <h5>1. Acceptance of Terms</h5>
      <p>By creating an account on Confi, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
      <h5>2. Eligibility</h5>
      <p>You must be at least 18 years of age to use Confi. By agreeing, you represent that you meet this requirement.</p>
      <h5>3. Account Security</h5>
      <p>You are responsible for maintaining the confidentiality of your account credentials. Confi employs industry-standard encryption and security practices.</p>
      <h5>4. Acceptable Use</h5>
      <p>You may not use Confi to transmit illegal content, engage in harassment, or violate any applicable laws. Confidential mode is for legitimate business and personal use only.</p>
      <h5>5. Confidential Feature</h5>
      <p>The Confi confidential feature activates an international NDA framework. Users are legally bound by their agreements once activated. Misuse of the confidential feature for illegal purposes is strictly prohibited and may result in account termination and legal action.</p>
      <h5>6. Data and Privacy</h5>
      <p>Confi collects minimal personal data necessary to operate the service. Your legal name is stored securely and used solely for NDA binding purposes. We do not sell your data to third parties.</p>
      <h5>7. Limitation of Liability</h5>
      <p>Confi is not liable for the legal enforceability of any specific NDA in any specific jurisdiction. Users are advised to seek independent legal counsel for high-stakes agreements.</p>
      <h5>8. Termination</h5>
      <p>We reserve the right to terminate accounts that violate these Terms. Upon termination, your obligation under any active NDAs remains in force.</p>
      <h5>9. Governing Law</h5>
      <p>These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law provisions.</p>
    </div>
  );
}

function NDAContent() {
  return (
    <div style={styles.legalText}>
      <h4>Confi International NDA Framework</h4>
      <p><strong>Version 1.0 — Effective January 1, 2025</strong></p>
      <p style={{ background: "#fef3c7", padding: 10, borderRadius: 6, fontSize: 13 }}>
        ⚠️ This framework becomes legally binding ONLY when you activate Confidential Mode in a specific conversation. Your agreement here enables that feature.
      </p>
      <h5>1. Definition of Confidential Information</h5>
      <p>"Confidential Information" means any information disclosed through a Confi conversation in which Confidential Mode has been activated by any party, including but not limited to: trade secrets, business strategies, financial data, personal information, intellectual property, and any other information marked or treated as confidential.</p>
      <h5>2. Obligations of Receiving Party</h5>
      <p>Each party receiving Confidential Information agrees to: (a) hold it in strict confidence; (b) use it solely for purposes discussed within the conversation; (c) not disclose it to any third party without prior written consent; (d) protect it with at least the same degree of care used for their own confidential information, but no less than reasonable care.</p>
      <h5>3. International Scope</h5>
      <p>This NDA framework is designed to be enforceable under the laws of participating jurisdictions including but not limited to: the United States, the European Union member states, United Kingdom, Canada, Australia, Singapore, Japan, and any jurisdiction that recognizes mutual non-disclosure agreements. Enforcement shall be sought in the jurisdiction most favorable to the non-breaching party.</p>
      <h5>4. Duration</h5>
      <p>Confidentiality obligations under any activated conversation remain in force for five (5) years from the date of disclosure, unless a different period is expressly agreed within the conversation or required by applicable law.</p>
      <h5>5. Exceptions</h5>
      <p>Obligations do not apply to information that: (a) was publicly known at time of disclosure; (b) becomes public through no fault of the receiving party; (c) was independently developed; (d) must be disclosed by law or court order (with prior notice where legally permitted).</p>
      <h5>6. Remedies</h5>
      <p>Breach of this NDA may cause irreparable harm. Each party agrees that the non-breaching party shall be entitled to seek injunctive relief and any other remedies available at law or equity. Liquidated damages of no less than USD $50,000 per material breach may apply.</p>
      <h5>7. Binding Effect</h5>
      <p>By accepting this framework and subsequently activating Confidential Mode in any Confi conversation, you enter into a legally binding mutual NDA with all other parties in that conversation. Your legal identity as provided during registration serves as your electronic signature for purposes of the ESIGN Act and equivalent international laws.</p>
      <h5>8. Severability</h5>
      <p>If any provision of this framework is found unenforceable, the remaining provisions continue in full force.</p>
    </div>
  );
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_CONVERSATIONS = [
  { id: 1, name: "Alex Rivera", initials: "AR", color: "#7C3AED", preview: "Let's discuss the merger terms...", confidential: true },
  { id: 2, name: "Sarah Chen", initials: "SC", color: "#059669", preview: "Did you review the contract?", confidential: true },
  { id: 3, name: "Marketing Team", initials: "MT", color: "#D97706", preview: "Q4 campaign draft attached", confidential: false },
  { id: 4, name: "Jordan Lee", initials: "JL", color: "#2563EB", preview: "Thanks for the update!", confidential: false },
  { id: 5, name: "Board Meeting", initials: "BM", color: "#DC2626", preview: "Agenda for Thursday", confidential: true },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    position: "relative",
    backgroundColor: "#0f172a",
  },
  bgGradient: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(ellipse at 20% 50%, #1e1b4b 0%, #0f172a 50%, #0c1a2e 100%)",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(15,23,42,0.8)",
    backdropFilter: "blur(12px)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: { fontSize: 24 },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: "#e2e8f0",
    letterSpacing: "-0.5px",
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#cbd5e1",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  main: {
    position: "relative",
    zIndex: 1,
    minHeight: "calc(100vh - 65px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "40px 16px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
    position: "relative",
  },
  heroIcon: {
    fontSize: 56,
    textAlign: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 800,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: "-1px",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    lineHeight: 1.6,
    marginBottom: 24,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 28,
  },
  featureItem: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#334155",
    fontWeight: 500,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 1.5,
  },
  methodGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 24,
  },
  methodCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "20px 12px",
    backgroundColor: "#f8fafc",
    border: "2px solid #e2e8f0",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  methodIcon: { fontSize: 28 },
  methodLabel: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  methodDesc: { fontSize: 12, color: "#64748b" },
  primaryBtn: {
    display: "block",
    width: "100%",
    padding: "14px",
    backgroundColor: "#7C3AED",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
    textAlign: "center",
    transition: "background 0.2s",
  },
  secondaryBtn: {
    display: "block",
    width: "100%",
    padding: "13px",
    backgroundColor: "transparent",
    color: "#7C3AED",
    border: "2px solid #7C3AED",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
    textAlign: "center",
  },
  ghostBtn: {
    display: "block",
    width: "100%",
    padding: "12px",
    backgroundColor: "transparent",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 8,
  },
  disabledBtn: {
    backgroundColor: "#cbd5e1",
    cursor: "not-allowed",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 14,
    cursor: "pointer",
    marginBottom: 16,
    padding: "4px 0",
    fontWeight: 600,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    marginBottom: 4,
    boxSizing: "border-box",
    outline: "none",
  },
  fieldHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
    lineHeight: 1.4,
  },
  passwordRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  eyeBtn: {
    background: "#f1f5f9",
    border: "1.5px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px",
    cursor: "pointer",
    fontSize: 16,
  },
  phoneRow: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  countrySelect: {
    padding: "12px 8px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 13,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    cursor: "pointer",
    minWidth: 110,
  },
  phoneInput: {
    flex: 1,
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    outline: "none",
  },
  otpContainer: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  otpInput: {
    width: 46,
    height: 52,
    border: "2px solid #e2e8f0",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    outline: "none",
  },
  otpTimer: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  successBox: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#16a34a",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  toggleAuth: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  link: {
    color: "#7C3AED",
    cursor: "pointer",
    fontWeight: 600,
    textDecoration: "underline",
  },
  strengthBar: {
    display: "flex",
    gap: 4,
    marginTop: 8,
    marginBottom: 6,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    transition: "background 0.3s",
  },
  strengthChecks: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  strengthCheck: {
    fontSize: 11,
    fontWeight: 500,
  },
  legalBanner: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 16,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    cursor: "pointer",
    accentColor: "#7C3AED",
    flexShrink: 0,
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  avatarPreview: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.5px",
  },
  avatarSm: {
    width: 40,
    height: 40,
    fontSize: 14,
    flexShrink: 0,
  },
  avatarPreviewLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
  },
  colorGrid: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    transition: "transform 0.15s",
  },
  identityBadge: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 20,
  },
  identityBadgeName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  identityBadgeNote: {
    fontSize: 11,
    color: "#059669",
    margin: "2px 0 0",
  },
  // Dashboard
  dashboardContainer: {
    display: "flex",
    width: "100%",
    maxWidth: 1100,
    height: "calc(100vh - 105px)",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  },
  sidebar: {
    width: 300,
    backgroundColor: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  sidebarHeader: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "20px 16px 12px",
    borderBottom: "1px solid #e2e8f0",
  },
  sidebarUserInfo: { flex: 1, minWidth: 0 },
  sidebarName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sidebarEmail: {
    fontSize: 11,
    color: "#94a3b8",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ndaBadge: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#d1fae5",
    borderRadius: 8,
    padding: "8px 12px",
    margin: "10px 12px",
  },
  identityCard: {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    margin: "0 12px 12px",
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
  },
  identityValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    margin: "2px 0 0",
  },
  identityMeta: {
    fontSize: 11,
    color: "#94a3b8",
    margin: "2px 0 0",
  },
  chatListHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "8px 16px 4px",
  },
  chatItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
  },
  chatItemText: { flex: 1, minWidth: 0 },
  chatItemName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  confiBadge: {
    fontSize: 10,
    backgroundColor: "#ede9fe",
    color: "#7C3AED",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
  },
  chatItemPreview: {
    fontSize: 12,
    color: "#94a3b8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mainPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    overflowY: "auto",
  },
  welcomePanel: {
    textAlign: "center",
    maxWidth: 560,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 12,
    letterSpacing: "-0.5px",
  },
  welcomeText: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 1.7,
    marginBottom: 28,
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
    textAlign: "left",
  },
  statusCard: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: "14px 16px",
    border: "1px solid #e2e8f0",
  },
  statusIcon: { fontSize: 20 },
  statusLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    margin: "2px 0 0",
  },
  sessionTokenBox: {
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 20,
    wordBreak: "break-all",
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 540,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px 16px",
    borderBottom: "1px solid #e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  modalClose: {
    background: "#f1f5f9",
    border: "none",
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontSize: 14,
    color: "#64748b",
  },
  modalBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
  },
  modalFooter: {
    display: "flex",
    gap: 10,
    padding: "16px 24px",
    borderTop: "1px solid #e2e8f0",
  },
  legalText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 1.7,
  },
};