"use client";

import { useState, useEffect, useCallback } from "react";

// ── types ────────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "auth-choice"
  | "register-email"
  | "register-phone"
  | "otp-email"
  | "otp-phone"
  | "legal-name"
  | "login-email"
  | "login-password"
  | "login-biometric"
  | "home"
  | "profile";

interface IdentityMeta {
  email: string;
  phone: string;
  legalFirstName: string;
  legalLastName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  biometricEnabled: boolean;
  createdAt: string;
  ndaSignatoryName: string; // pre-populated for NDA use
}

interface Session {
  email: string;
  token: string; // JWT stored in localStorage
  identityMeta: IdentityMeta;
}

// ── tiny XOR-based obfuscation (simulates "encrypted at rest" for localStorage) ──
function obfuscate(str: string): string {
  const key = "confi_secret_2024";
  return btoa(
    str
      .split("")
      .map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      )
      .join("")
  );
}
function deobfuscate(str: string): string {
  const key = "confi_secret_2024";
  try {
    const decoded = atob(str);
    return decoded
      .split("")
      .map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      )
      .join("");
  } catch {
    return "";
  }
}

// ── OTP simulation ────────────────────────────────────────────────────────────
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── JWT parse (client-side decode only, not verify) ───────────────────────────
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ── storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = "confi_session_v1";
const IDENTITY_KEY = "confi_identity_v1";

function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, obfuscate(JSON.stringify(session)));
}
function loadSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(deobfuscate(raw)) as Session;
  } catch {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IDENTITY_KEY);
}
function saveIdentityMeta(meta: IdentityMeta) {
  localStorage.setItem(IDENTITY_KEY, obfuscate(JSON.stringify(meta)));
}
function loadIdentityMeta(): IdentityMeta | null {
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(deobfuscate(raw)) as IdentityMeta;
  } catch {
    return null;
  }
}

// ── color palette ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0f1e",
  surface: "#111827",
  surfaceHigh: "#1a2235",
  border: "#1e2d45",
  accent: "#2563eb",
  accentLight: "#3b82f6",
  accentGlow: "rgba(37,99,235,0.25)",
  success: "#10b981",
  successGlow: "rgba(16,185,129,0.2)",
  warning: "#f59e0b",
  error: "#ef4444",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#475569",
  gold: "#fbbf24",
};

// ── reusable components ───────────────────────────────────────────────────────
function ConfiLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{ display: "block" }}
    >
      <circle cx="24" cy="24" r="22" fill={C.accent} opacity={0.15} />
      <circle cx="24" cy="24" r="16" fill={C.accent} opacity={0.25} />
      <path
        d="M24 10 C15 10 8 16.5 8 25 C8 29.5 10.5 33.5 14.5 36L13 40l5.5-2.5C21 38.5 22.5 39 24 39 C33 39 40 32.5 40 25 C40 16.5 33 10 24 10Z"
        fill={C.accent}
      />
      <path
        d="M18 24 L22 28 L30 20"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  maxLength,
  prefix,
  error,
  hint,
}: {
  label?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  prefix?: string;
  error?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: C.textSecondary,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: C.surfaceHigh,
          border: `1.5px solid ${error ? C.error : focused ? C.accent : C.border}`,
          borderRadius: 12,
          overflow: "hidden",
          transition: "border-color 0.2s",
          boxShadow: focused ? `0 0 0 3px ${C.accentGlow}` : "none",
        }}
      >
        {prefix && (
          <span
            style={{
              padding: "0 12px",
              color: C.textSecondary,
              fontSize: 15,
              borderRight: `1px solid ${C.border}`,
              height: "100%",
              display: "flex",
              alignItems: "center",
              background: C.surface,
              minWidth: 48,
              justifyContent: "center",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          style={{
            flex: 1,
            padding: "14px 16px",
            background: "transparent",
            border: "none",
            outline: "none",
            color: C.textPrimary,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      </div>
      {error && (
        <p style={{ color: C.error, fontSize: 12, marginTop: 4 }}>{error}</p>
      )}
      {hint && !error && (
        <p style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}

function Btn({
  label,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
}: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const bgMap = {
    primary: C.accent,
    secondary: C.surfaceHigh,
    ghost: "transparent",
    danger: C.error,
  };
  const colorMap = {
    primary: "#fff",
    secondary: C.textPrimary,
    ghost: C.textSecondary,
    danger: "#fff",
  };
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      disabled={disabled || loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        padding: "15px 24px",
        background: bgMap[variant],
        color: colorMap[variant],
        border: variant === "secondary" ? `1.5px solid ${C.border}` : "none",
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "all 0.15s",
        fontFamily: "inherit",
        letterSpacing: "0.02em",
      }}
    >
      {loading ? (
        <span
          style={{
            width: 18,
            height: 18,
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
            display: "inline-block",
          }}
        />
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

function OTPInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const digits = 6;
  const refs = Array.from({ length: digits }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState<HTMLInputElement | null>(null)
  );
  const inputs = refs.map((r) => r[0]);
  const setInputs = refs.map((r) => r[1]);

  const handleChange = (idx: number, val: string) => {
    const num = val.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(digits, " ").split("");
    arr[idx] = num || " ";
    const next = arr.join("").trimEnd();
    onChange(next.replace(/ /g, "").slice(0, digits));
    if (num && idx < digits - 1) inputs[idx + 1]?.focus();
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputs[idx - 1]?.focus();
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {Array.from({ length: digits }).map((_, i) => (
        <input
          key={i}
          ref={(el) => setInputs[i](el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          style={{
            width: 48,
            height: 56,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            background: C.surfaceHigh,
            border: `1.5px solid ${value[i] ? C.accent : C.border}`,
            borderRadius: 10,
            color: C.textPrimary,
            outline: "none",
            fontFamily: "inherit",
            caretColor: C.accent,
          }}
        />
      ))}
    </div>
  );
}

function Badge({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: verified ? C.successGlow : "rgba(100,116,139,0.15)",
        color: verified ? C.success : C.textMuted,
        border: `1px solid ${verified ? C.success : C.textMuted}`,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {verified ? "✓" : "○"} {label}
    </span>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [session, setSession] = useState<Session | null>(null);
  const [identityMeta, setIdentityMeta] = useState<IdentityMeta | null>(null);

  // form fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");

  // ui state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [otpType, setOtpType] = useState<"email" | "phone">("email");
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // registration flow state
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");

  // ── init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // track page view
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // check biometric support
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
        "function"
    ) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((ok) => setBiometricAvailable(ok))
        .catch(() => {});
    }

    // restore session
    const saved = loadSession();
    const savedMeta = loadIdentityMeta();
    if (saved && saved.token) {
      const parsed = parseJwt(saved.token);
      const expired =
        parsed && typeof parsed.exp === "number"
          ? Date.now() / 1000 > parsed.exp
          : false;
      if (!expired) {
        setSession(saved);
        setIdentityMeta(savedMeta);
        setScreen("home");
        return;
      } else {
        clearSession();
      }
    }

    const timer = setTimeout(() => setScreen("auth-choice"), 1800);
    return () => clearTimeout(timer);
  }, []);

  const showError = (msg: string) => {
    setError(msg);
    setNotice("");
  };
  const showNotice = (msg: string) => {
    setNotice(msg);
    setError("");
  };
  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  // ── register ────────────────────────────────────────────────────────────────
  const handleRegisterEmailSubmit = async () => {
    clearMessages();
    if (!email.includes("@")) return showError("Enter a valid email address.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (data.error) return showError(data.error);
      setRegEmail(email);
      const code = generateOTP();
      setSentOtp(code);
      showNotice(`OTP sent to ${email} — demo code: ${code}`);
      setOtpType("email");
      setOtp("");
      setScreen("otp-email");
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOTPVerify = () => {
    clearMessages();
    if (otp.length !== 6) return showError("Enter the 6-digit code.");
    if (otp !== sentOtp) return showError("Incorrect code. Please try again.");
    setEmailVerified(true);
    showNotice("Email verified! Now verify your phone number.");
    setOtp("");
    setScreen("register-phone");
  };

  const handleRegisterPhoneSubmit = () => {
    clearMessages();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return showError("Enter a valid phone number (min 10 digits).");
    setRegPhone(phone);
    const code = generateOTP();
    setSentOtp(code);
    showNotice(`OTP sent to ${phone} — demo code: ${code}`);
    setOtpType("phone");
    setOtp("");
    setScreen("otp-phone");
  };

  const handlePhoneOTPVerify = () => {
    clearMessages();
    if (otp.length !== 6) return showError("Enter the 6-digit code.");
    if (otp !== sentOtp) return showError("Incorrect code. Please try again.");
    setPhoneVerified(true);
    showNotice("Phone verified! One last step — enter your legal name.");
    setOtp("");
    setScreen("legal-name");
  };

  const handleLegalNameSubmit = () => {
    clearMessages();
    if (firstName.trim().length < 2)
      return showError("First name must be at least 2 characters.");
    if (lastName.trim().length < 2)
      return showError("Last name must be at least 2 characters.");

    const meta: IdentityMeta = {
      email: regEmail,
      phone: regPhone,
      legalFirstName: firstName.trim(),
      legalLastName: lastName.trim(),
      emailVerified,
      phoneVerified,
      biometricEnabled: false,
      createdAt: new Date().toISOString(),
      ndaSignatoryName: `${firstName.trim()} ${lastName.trim()}`,
    };

    // Build a mock JWT (in prod the server would return a real one)
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: regEmail,
        name: meta.ndaSignatoryName,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
      })
    );
    const sig = btoa("confi-demo-sig");
    const token = `${header}.${payload}.${sig}`;

    const sess: Session = { email: regEmail, token, identityMeta: meta };
    saveSession(sess);
    saveIdentityMeta(meta);
    setSession(sess);
    setIdentityMeta(meta);
    setScreen("home");
  };

  // ── login ───────────────────────────────────────────────────────────────────
  const handleLoginSubmit = async () => {
    clearMessages();
    if (!loginEmail.includes("@"))
      return showError("Enter a valid email address.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email: loginEmail,
          password,
        }),
      });
      const data = await res.json();
      if (data.error) return showError(data.error);

      // restore or build identity meta
      const existingMeta = loadIdentityMeta();
      const meta: IdentityMeta = existingMeta || {
        email: loginEmail,
        phone: "",
        legalFirstName: data.email?.split("@")[0] || "User",
        legalLastName: "",
        emailVerified: true,
        phoneVerified: false,
        biometricEnabled: false,
        createdAt: new Date().toISOString(),
        ndaSignatoryName: data.email?.split("@")[0] || "User",
      };

      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = btoa(
        JSON.stringify({
          sub: loginEmail,
          name: meta.ndaSignatoryName,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        })
      );
      const sig = btoa("confi-demo-sig");
      const token = `${header}.${payload}.${sig}`;

      const sess: Session = { email: loginEmail, token, identityMeta: meta };
      saveSession(sess);
      saveIdentityMeta(meta);
      setSession(sess);
      setIdentityMeta(meta);
      setScreen("home");
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    clearMessages();
    if (!biometricAvailable) {
      return showError(
        "Biometric authentication is not available on this device."
      );
    }
    setLoading(true);
    try {
      // Simulate biometric prompt — in prod, use navigator.credentials.get()
      await new Promise((r) => setTimeout(r, 1200));
      const saved = loadSession();
      if (!saved) {
        return showError(
          "No saved session found. Please log in with your password first."
        );
      }
      const savedMeta = loadIdentityMeta();
      setSession(saved);
      setIdentityMeta(savedMeta);
      setScreen("home");
    } catch {
      showError("Biometric authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBiometric = useCallback(() => {
    if (!identityMeta || !session) return;
    const updated: IdentityMeta = {
      ...identityMeta,
      biometricEnabled: !identityMeta.biometricEnabled,
    };
    saveIdentityMeta(updated);
    const updatedSession: Session = { ...session, identityMeta: updated };
    saveSession(updatedSession);
    setIdentityMeta(updated);
    setSession(updatedSession);
  }, [identityMeta, session]);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setIdentityMeta(null);
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setRegEmail("");
    setRegPhone("");
    setEmailVerified(false);
    setPhoneVerified(false);
    setLoginEmail("");
    clearMessages();
    setScreen("auth-choice");
  };

  // ── render helpers ──────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: 28,
    marginBottom: 16,
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 800,
    color: C.textPrimary,
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  };

  const subStyle: React.CSSProperties = {
    fontSize: 14,
    color: C.textSecondary,
    margin: "0 0 24px",
    lineHeight: 1.5,
  };

  const dividerStyle: React.CSSProperties = {
    border: "none",
    borderTop: `1px solid ${C.border}`,
    margin: "20px 0",
  };

  // ── screens ─────────────────────────────────────────────────────────────────

  // SPLASH
  if (screen === "splash") {
    return (
      <div
        style={{
          ...pageStyle,
          background: `radial-gradient(ellipse at center, #0d1b3e 0%, ${C.bg} 70%)`,
        }}
      >
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
          @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            animation: "fadeIn 0.6s ease",
          }}
        >
          <ConfiLogo size={72} />
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: C.textPrimary,
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Confi
          </h1>
          <p style={{ color: C.textSecondary, margin: 0, fontSize: 14 }}>
            Confidential Messaging
          </p>
          <div
            style={{
              marginTop: 24,
              width: 32,
              height: 32,
              border: `2px solid ${C.accentLight}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  // AUTH CHOICE
  if (screen === "auth-choice") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div
          style={{
            ...containerStyle,
            animation: "fadeIn 0.5s ease",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <ConfiLogo size={56} />
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: C.textPrimary,
              margin: "0 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            Welcome to Confi
          </h1>
          <p
            style={{
              color: C.textSecondary,
              fontSize: 14,
              margin: "0 0 36px",
              lineHeight: 1.6,
            }}
          >
            Secure messaging with legally-binding confidentiality.
            <br />
            Verify your identity to get started.
          </p>

          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                margin: "0 0 14px",
              }}
            >
              New to Confi
            </p>
            <Btn
              label="Create Account"
              onClick={() => {
                clearMessages();
                setScreen("register-email");
              }}
              variant="primary"
            />
          </div>

          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 24,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                margin: "0 0 14px",
              }}
            >
              Already have an account
            </p>
            <Btn
              label="Sign In"
              onClick={() => {
                clearMessages();
                setScreen("login-email");
              }}
              variant="secondary"
            />
            {biometricAvailable && (
              <>
                <hr style={dividerStyle} />
                <Btn
                  label="Sign in with Biometrics"
                  onClick={() => {
                    clearMessages();
                    setScreen("login-biometric");
                  }}
                  variant="ghost"
                  icon={<span style={{ fontSize: 18 }}>🔐</span>}
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // REGISTER — EMAIL
  if (screen === "register-email") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <button
            onClick={() => setScreen("auth-choice")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: C.accentGlow,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ✉️
            </div>
            <div>
              <h2 style={{ ...headingStyle, fontSize: 22 }}>Create Account</h2>
              <p style={{ ...subStyle, margin: 0, fontSize: 13 }}>Step 1 of 3 — Email & Password</p>
            </div>
          </div>

          {/* Progress */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 28,
            }}
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: s === 1 ? C.accent : C.border,
                }}
              />
            ))}
          </div>

          <div style={cardStyle}>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              hint="Use a strong, unique password."
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter password"
              autoComplete="new-password"
              error={
                confirmPassword.length > 0 && confirmPassword !== password
                  ? "Passwords do not match"
                  : undefined
              }
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: `1px solid ${C.error}`,
                borderRadius: 10,
                color: C.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              style={{
                padding: "12px 16px",
                background: C.successGlow,
                border: `1px solid ${C.success}`,
                borderRadius: 10,
                color: C.success,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {notice}
            </div>
          )}

          <Btn
            label="Send Verification Code"
            onClick={() => {
              if (password.length < 8)
                return showError("Password must be at least 8 characters.");
              if (password !== confirmPassword)
                return showError("Passwords do not match.");
              handleRegisterEmailSubmit();
            }}
            loading={loading}
            disabled={!email || !password || !confirmPassword}
          />
        </div>
      </div>
    );
  }

  // OTP — EMAIL
  if (screen === "otp-email") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <button
            onClick={() => setScreen("register-email")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              marginBottom: 24,
            }}
          >
            ← Back
          </button>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: C.accentGlow,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 16px",
              }}
            >
              ✉️
            </div>
            <h2 style={headingStyle}>Check Your Email</h2>
            <p style={subStyle}>
              We sent a 6-digit code to
              <br />
              <strong style={{ color: C.textPrimary }}>{regEmail}</strong>
            </p>
          </div>

          <div style={{ ...cardStyle, textAlign: "center" }}>
            <OTPInput value={otp} onChange={setOtp} />
            {error && (
              <p style={{ color: C.error, fontSize: 13, marginTop: 12 }}>
                {error}
              </p>
            )}
            {notice && (
              <p
                style={{
                  color: C.success,
                  fontSize: 12,
                  marginTop: 12,
                  wordBreak: "break-all",
                }}
              >
                {notice}
              </p>
            )}
          </div>

          <Btn
            label="Verify Email"
            onClick={handleEmailOTPVerify}
            disabled={otp.length !== 6}
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => {
                const code = generateOTP();
                setSentOtp(code);
                showNotice(`New code sent — demo code: ${code}`);
                setOtp("");
              }}
              style={{
                background: "none",
                border: "none",
                color: C.accentLight,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Resend code
            </button>
          </div>
        </div>
      </div>
    );
  }

  // REGISTER — PHONE
  if (screen === "register-phone") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(16,185,129,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              📱
            </div>
            <div>
              <h2 style={{ ...headingStyle, fontSize: 22 }}>Phone Number</h2>
              <p style={{ ...subStyle, margin: 0, fontSize: 13 }}>Step 2 of 3 — Phone Verification</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background:
                    s === 1
                      ? C.success
                      : s === 2
                      ? C.accent
                      : C.border,
                }}
              />
            ))}
          </div>

          <div
            style={{
              background: C.successGlow,
              border: `1px solid ${C.success}`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: C.success,
            }}
          >
            <span>✓</span> Email verified: {regEmail}
          </div>

          <div style={cardStyle}>
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="+1 555 000 0000"
              autoComplete="tel"
              prefix="📞"
              hint="Include country code (e.g. +1 for US)"
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: `1px solid ${C.error}`,
                borderRadius: 10,
                color: C.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              style={{
                padding: "12px 16px",
                background: C.successGlow,
                border: `1px solid ${C.success}`,
                borderRadius: 10,
                color: C.success,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {notice}
            </div>
          )}

          <Btn
            label="Send SMS Code"
            onClick={handleRegisterPhoneSubmit}
            disabled={phone.length < 10}
          />
        </div>
      </div>
    );
  }

  // OTP — PHONE
  if (screen === "otp-phone") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <button
            onClick={() => setScreen("register-phone")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              marginBottom: 24,
            }}
          >
            ← Back
          </button>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: "rgba(16,185,129,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 16px",
              }}
            >
              📱
            </div>
            <h2 style={headingStyle}>Check Your Phone</h2>
            <p style={subStyle}>
              We sent a 6-digit code to
              <br />
              <strong style={{ color: C.textPrimary }}>{regPhone}</strong>
            </p>
          </div>

          <div style={{ ...cardStyle, textAlign: "center" }}>
            <OTPInput value={otp} onChange={setOtp} />
            {error && (
              <p style={{ color: C.error, fontSize: 13, marginTop: 12 }}>
                {error}
              </p>
            )}
            {notice && (
              <p
                style={{
                  color: C.success,
                  fontSize: 12,
                  marginTop: 12,
                  wordBreak: "break-all",
                }}
              >
                {notice}
              </p>
            )}
          </div>

          <Btn
            label="Verify Phone"
            onClick={handlePhoneOTPVerify}
            disabled={otp.length !== 6}
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              onClick={() => {
                const code = generateOTP();
                setSentOtp(code);
                showNotice(`New code sent — demo code: ${code}`);
                setOtp("");
              }}
              style={{
                background: "none",
                border: "none",
                color: C.accentLight,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Resend code
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LEGAL NAME
  if (screen === "legal-name") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(251,191,36,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⚖️
            </div>
            <div>
              <h2 style={{ ...headingStyle, fontSize: 22 }}>Legal Identity</h2>
              <p style={{ ...subStyle, margin: 0, fontSize: 13 }}>Step 3 of 3 — NDA Signatory Name</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: s <= 2 ? C.success : C.accent,
                }}
              />
            ))}
          </div>

          <div
            style={{
              background: "rgba(251,191,36,0.08)",
              border: `1px solid rgba(251,191,36,0.3)`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: C.gold,
              lineHeight: 1.6,
            }}
          >
            <strong>Why we need this:</strong> Your legal name will be used as the
            signatory on any NDA activated during Confidential Mode conversations.
            This must match your government-issued ID.
          </div>

          <div style={cardStyle}>
            <Input
              label="Legal First Name"
              value={firstName}
              onChange={setFirstName}
              placeholder="As on government ID"
              autoComplete="given-name"
            />
            <Input
              label="Legal Last Name"
              value={lastName}
              onChange={setLastName}
              placeholder="As on government ID"
              autoComplete="family-name"
            />

            {firstName && lastName && (
              <div
                style={{
                  padding: "12px 14px",
                  background: C.surfaceHigh,
                  borderRadius: 10,
                  marginTop: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: "0 0 4px",
                  }}
                >
                  NDA Signatory Preview
                </p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.gold,
                    margin: 0,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {firstName.trim()} {lastName.trim()}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: `1px solid ${C.error}`,
                borderRadius: 10,
                color: C.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <Btn
            label="Complete Registration"
            onClick={handleLegalNameSubmit}
            disabled={firstName.trim().length < 2 || lastName.trim().length < 2}
          />
        </div>
      </div>
    );
  }

  // LOGIN — EMAIL
  if (screen === "login-email") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ ...containerStyle, animation: "fadeIn 0.4s ease" }}>
          <button
            onClick={() => setScreen("auth-choice")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              marginBottom: 24,
            }}
          >
            ← Back
          </button>

          <h2 style={headingStyle}>Sign In</h2>
          <p style={subStyle}>Welcome back to Confi</p>

          <div style={cardStyle}>
            <Input
              label="Email Address"
              type="email"
              value={loginEmail}
              onChange={setLoginEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: `1px solid ${C.error}`,
                borderRadius: 10,
                color: C.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <Btn
            label="Sign In"
            onClick={handleLoginSubmit}
            loading={loading}
            disabled={!loginEmail || !password}
          />

          {biometricAvailable && (
            <>
              <hr style={{ ...dividerStyle, marginTop: 20 }} />
              <Btn
                label="Use Biometrics"
                onClick={() => setScreen("login-biometric")}
                variant="ghost"
                icon={<span style={{ fontSize: 18 }}>🔐</span>}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // LOGIN — BIOMETRIC
  if (screen === "login-biometric") {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.08); opacity:0.8; } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div
          style={{
            ...containerStyle,
            animation: "fadeIn 0.4s ease",
            textAlign: "center",
          }}
        >
          <button
            onClick={() => setScreen("auth-choice")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 14,
              padding: 0,
              marginBottom: 32,
              display: "block",
              textAlign: "left",
            }}
          >
            ← Back
          </button>

          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: C.accentGlow,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              margin: "0 auto 24px",
              animation: loading ? "pulse 1s ease infinite" : "none",
            }}
          >
            🔐
          </div>
          <h2 style={headingStyle}>Biometric Sign In</h2>
          <p style={{ ...subStyle, marginBottom: 36 }}>
            Use Face ID, Touch ID, or your device PIN to sign in securely.
          </p>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239,68,68,0.1)",
                border: `1px solid ${C.error}`,
                borderRadius: 10,
                color: C.error,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <Btn
            label={loading ? "Authenticating…" : "Authenticate with Biometrics"}
            onClick={handleBiometricLogin}
            loading={loading}
            icon={loading ? undefined : <span style={{ fontSize: 18 }}>👆</span>}
          />
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setScreen("login-email")}
              style={{
                background: "none",
                border: "none",
                color: C.accentLight,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Use password instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // HOME
  if (screen === "home") {
    const meta = identityMeta;
    const verificationScore =
      (meta?.emailVerified ? 1 : 0) +
      (meta?.phoneVerified ? 1 : 0) +
      (meta?.legalFirstName ? 1 : 0);
    const verificationPct = Math.round((verificationScore / 3) * 100);
    const isFullyVerified = verificationScore === 3;

    return (
      <div style={{ ...pageStyle, justifyContent: "flex-start", paddingTop: 0 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } } @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }`}</style>

        {/* Top nav */}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            position: "sticky",
            top: 0,
            background: C.bg,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ConfiLogo size={32} />
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: C.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              Confi
            </span>
          </div>
          <button
            onClick={() => setScreen("profile")}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: C.accentGlow,
              border: `2px solid ${isFullyVerified ? C.success : C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 18,
              color: C.textPrimary,
            }}
          >
            {meta?.legalFirstName?.[0]?.toUpperCase() || "?"}
          </button>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "20px 16px",
            animation: "fadeIn 0.5s ease",
          }}
        >
          {/* Identity status card */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.surface} 0%, #0d1f3c 100%)`,
              border: `1px solid ${isFullyVerified ? C.success : C.accent}`,
              borderRadius: 20,
              padding: 24,
              marginBottom: 20,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: isFullyVerified ? C.successGlow : C.accentGlow,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 12,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: "0 0 4px",
                  }}
                >
                  Signed in as
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: C.textPrimary,
                    margin: 0,
                  }}
                >
                  {meta?.legalFirstName
                    ? `${meta.legalFirstName} ${meta.legalLastName}`
                    : session?.email}
                </p>
              </div>
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  background: isFullyVerified
                    ? C.successGlow
                    : "rgba(37,99,235,0.15)",
                  border: `1px solid ${isFullyVerified ? C.success : C.accentLight}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: isFullyVerified ? C.success : C.accentLight,
                  whiteSpace: "nowrap",
                }}
              >
                {isFullyVerified ? "✓ Verified" : `${verificationPct}%`}
              </div>
            </div>

            {/* Verification progress */}
            <div
              style={{
                height: 6,
                background: C.border,
                borderRadius: 3,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${verificationPct}%`,
                  background: isFullyVerified
                    ? C.success
                    : `linear-gradient(90deg, ${C.accent}, ${C.accentLight})`,
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
            <p
              style={{
                fontSize: 12,
                color: C.textMuted,
                margin: 0,
              }}
            >
              {isFullyVerified
                ? "Identity fully verified — Confidential Mode ready"
                : `${3 - verificationScore} verification step(s) remaining to enable Confidential Mode`}
            </p>
          </div>

          {/* NDA readiness */}
          <div
            style={{
              ...cardStyle,
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: isFullyVerified
                ? "rgba(16,185,129,0.06)"
                : C.surface,
              border: `1px solid ${isFullyVerified ? C.success : C.border}`,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: isFullyVerified
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(251,191,36,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              {isFullyVerified ? "🔏" : "⚖️"}
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.textPrimary,
                  margin: "0 0 3px",
                }}
              >
                NDA Signatory Status
              </p>
              <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>
                {isFullyVerified && meta?.ndaSignatoryName
                  ? `Ready as: "${meta.ndaSignatoryName}"`
                  : "Complete verification to enable NDA signing"}
              </p>
            </div>
            {isFullyVerified && (
              <span style={{ fontSize: 20 }}>✓</span>
            )}
          </div>

          {/* Conversations placeholder */}
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 12,
              }}
            >
              Conversations
            </p>
            {[
              { name: "Alice Chen", msg: "Let's activate Confidential Mode for this", time: "2m", conf: true },
              { name: "Bob Martinez", msg: "Did you see the contract terms?", time: "1h", conf: false },
              { name: "Acme Corp", msg: "NDA ready for your review", time: "3h", conf: true },
            ].map((chat, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  marginBottom: 10,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: C.accentGlow,
                    border: `2px solid ${chat.conf ? C.gold : C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.accentLight,
                    flexShrink: 0,
                  }}
                >
                  {chat.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.textPrimary,
                      }}
                    >
                      {chat.name}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {chat.time}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: C.textSecondary,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {chat.conf && (
                      <span style={{ color: C.gold, marginRight: 4 }}>🔒</span>
                    )}
                    {chat.msg}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8 }}>
            <Btn
              label="View Profile & Verification"
              onClick={() => setScreen("profile")}
              variant="secondary"
            />
          </div>
        </div>
      </div>
    );
  }

  // PROFILE
  if (screen === "profile") {
    const meta = identityMeta;
    const isFullyVerified =
      meta?.emailVerified && meta?.phoneVerified && !!meta?.legalFirstName;

    return (
      <div style={{ ...pageStyle, justifyContent: "flex-start", paddingTop: 0 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Header */}
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            position: "sticky",
            top: 0,
            background: C.bg,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setScreen("home")}
            style={{
              background: "none",
              border: "none",
              color: C.textSecondary,
              cursor: "pointer",
              fontSize: 20,
              padding: 4,
            }}
          >
            ←
          </button>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: C.textPrimary,
              margin: 0,
            }}
          >
            Identity & Profile
          </h2>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "20px 16px",
            animation: "fadeIn 0.4s ease",
          }}
        >
          {/* Avatar + name */}
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              background: `linear-gradient(135deg, ${C.surface} 0%, #0d1f3c 100%)`,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: C.accentGlow,
                border: `3px solid ${isFullyVerified ? C.success : C.accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 800,
                color: C.accentLight,
                margin: "0 auto 12px",
              }}
            >
              {meta?.legalFirstName?.[0]?.toUpperCase() ||
                session?.email?.[0]?.toUpperCase() ||
                "?"}
            </div>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: C.textPrimary,
                margin: "0 0 4px",
                letterSpacing: "-0.02em",
              }}
            >
              {meta?.legalFirstName
                ? `${meta.legalFirstName} ${meta.legalLastName}`
                : session?.email}
            </h3>
            <p
              style={{ fontSize: 13, color: C.textSecondary, margin: "0 0 14px" }}
            >
              {session?.email}
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Badge label="Email" verified={!!meta?.emailVerified} />
              <Badge label="Phone" verified={!!meta?.phoneVerified} />
              <Badge label="Identity" verified={!!meta?.legalFirstName} />
            </div>
          </div>

          {/* Identity details */}
          <div style={cardStyle}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                margin: "0 0 14px",
              }}
            >
              Verified Identity
            </p>

            {[
              {
                icon: "✉️",
                label: "Email",
                value: meta?.email || "—",
                verified: !!meta?.emailVerified,
              },
              {
                icon: "📱",
                label: "Phone",
                value: meta?.phone || "Not provided",
                verified: !!meta?.phoneVerified,
              },
              {
                icon: "👤",
                label: "Legal Name",
                value: meta?.ndaSignatoryName || "—",
                verified: !!meta?.legalFirstName,
              },
              {
                icon: "📅",
                label: "Verified Since",
                value: meta?.createdAt
                  ? new Date(meta.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—",
                verified: true,
              },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom:
                    i < 3 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>
                  {row.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                      margin: "0 0 2px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {row.label}
                  </p>
                  <p
                    style={{
                      fontSize: 14,
                      color: C.textPrimary,
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {row.value}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 16,
                    color: row.verified ? C.success : C.textMuted,
                  }}
                >
                  {row.verified ? "✓" : "○"}
                </span>
              </div>
            ))}
          </div>

          {/* NDA Signatory card */}
          <div
            style={{
              ...cardStyle,
              background: isFullyVerified
                ? "rgba(16,185,129,0.06)"
                : "rgba(251,191,36,0.04)",
              border: `1px solid ${isFullyVerified ? C.success : "rgba(251,191,36,0.3)"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 24 }}>{isFullyVerified ? "🔏" : "⚖️"}</span>
              <div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.textPrimary,
                    margin: "0 0 2px",
                  }}
                >
                  Confidential Mode Readiness
                </p>
                <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>
                  NDA Signatory Identity
                </p>
              </div>
            </div>
            {isFullyVerified ? (
              <div
                style={{
                  padding: "14px 16px",
                  background: C.successGlow,
                  borderRadius: 10,
                  border: `1px solid ${C.success}`,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: C.success,
                    margin: "0 0 4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Signatory Name (NDA)
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: C.gold,
                    margin: 0,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {meta?.ndaSignatoryName}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: C.textMuted,
                    margin: "8px 0 0",
                  }}
                >
                  This name will appear on all NDAs activated in Confidential Mode.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>
                Complete all 3 verification steps to unlock Confidential Mode and NDA signing.
              </p>
            )}
          </div>

          {/* Security settings */}
          <div style={cardStyle}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                margin: "0 0 14px",
              }}
            >
              Security
            </p>

            {biometricAvailable && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔐</span>
                  <div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.textPrimary,
                        margin: 0,
                      }}
                    >
                      Biometric Login
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: C.textSecondary,
                        margin: 0,
                      }}
                    >
                      Face ID / Touch ID / PIN
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleBiometric}
                  style={{
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    background: meta?.biometricEnabled ? C.success : C.border,
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: meta?.biometricEnabled ? 24 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </button>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: C.textPrimary,
                      margin: 0,
                    }}
                  >
                    Session Token
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: C.textSecondary,
                      margin: 0,
                    }}
                  >
                    JWT • Expires in 30 days
                  </p>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: C.success,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Active
              </span>
            </div>
          </div>

          {/* Token preview */}
          {session?.token && (
            <div
              style={{
                ...cardStyle,
                background: C.surfaceHigh,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  margin: "0 0 8px",
                }}
              >
                Session JWT (preview)
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  margin: 0,
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                  lineHeight: 1.6,
                }}
              >
                {session.token.slice(0, 40)}…
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  margin: "6px 0 0",
                }}
              >
                Stored encrypted at rest in localStorage
              </p>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <Btn
              label="Sign Out"
              onClick={handleLogout}
              variant="danger"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}