"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "welcome"
  | "signup_email"
  | "signup_phone"
  | "signup_otp"
  | "signup_legal"
  | "signup_password"
  | "signup_profile"
  | "signup_complete"
  | "login"
  | "home";

interface UserSession {
  email: string;
  displayName: string;
  legalName: string;
  phone: string;
  avatarColor: string;
  createdAt: string;
  token: string;
}

interface OTPState {
  code: string;
  target: string;
  type: "email" | "phone";
  expires: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#25D366", "#128C7E", "#075E54", "#34B7F1",
  "#7B68EE", "#FF6B6B", "#FFD93D", "#6BCB77",
  "#4D96FF", "#FF922B", "#CC5DE8", "#F06595",
];

const COUNTRIES = [
  { code: "+1", name: "United States" },
  { code: "+44", name: "United Kingdom" },
  { code: "+91", name: "India" },
  { code: "+86", name: "China" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+81", name: "Japan" },
  { code: "+55", name: "Brazil" },
  { code: "+7", name: "Russia" },
  { code: "+61", name: "Australia" },
  { code: "+82", name: "South Korea" },
  { code: "+34", name: "Spain" },
  { code: "+39", name: "Italy" },
  { code: "+52", name: "Mexico" },
  { code: "+31", name: "Netherlands" },
  { code: "+27", name: "South Africa" },
  { code: "+234", name: "Nigeria" },
  { code: "+254", name: "Kenya" },
  { code: "+20", name: "Egypt" },
  { code: "+971", name: "UAE" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function saveSession(session: UserSession) {
  localStorage.setItem("confi_session", JSON.stringify(session));
}

function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem("confi_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("confi_session");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({
  name,
  color,
  size = 48,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {getInitials(name || "?")}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  autoFocus,
  disabled,
  inputMode,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <div style={{ marginBottom: 16, width: "100%" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "#667781",
            marginBottom: 6,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode={inputMode}
        style={{
          width: "100%",
          padding: "13px 16px",
          border: "1.5px solid #e0e0e0",
          borderRadius: 12,
          fontSize: 15,
          outline: "none",
          background: disabled ? "#f5f5f5" : "#fff",
          color: "#111",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#25D366";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#e0e0e0";
        }}
      />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const bgMap = {
    primary: disabled || loading ? "#a8e6c0" : "#25D366",
    secondary: "#f0f2f5",
    ghost: "transparent",
  };
  const colorMap = {
    primary: "#fff",
    secondary: "#111",
    ghost: "#25D366",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%",
        padding: "14px 24px",
        background: bgMap[variant],
        color: colorMap[variant],
        border: "none",
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        marginBottom: 12,
        letterSpacing: 0.3,
        transition: "opacity 0.2s",
      }}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: "#fff0f0",
        border: "1px solid #ffcdd2",
        borderRadius: 10,
        padding: "10px 14px",
        color: "#c62828",
        fontSize: 13,
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {msg}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: 12,
        padding: "14px 16px",
        fontSize: 13,
        color: "#2e7d32",
        marginBottom: 20,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);

  // Signup state
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [otpState, setOtpState] = useState<OTPState | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  // Legal identity
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [legalDob, setLegalDob] = useState("");
  const [legalConfirmed, setLegalConfirmed] = useState(false);

  // Password
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // OTP countdown
  const [otpCountdown, setOtpCountdown] = useState(0);

  // ── Track page ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // ── Session restore ───────────────────────────────────────────────────────

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      setSession(stored);
      setScreen("home");
    } else {
      setTimeout(() => setScreen("welcome"), 1800);
    }
  }, []);

  // ── OTP countdown ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const sendOTP = useCallback(
    (target: string, type: "email" | "phone") => {
      const code = generateOTP();
      const expires = Date.now() + 10 * 60 * 1000; // 10 min
      setOtpState({ code, target, type, expires });
      setOtpCountdown(60);
      setOtpInput("");
      // In production this would call an SMS/email gateway
      // For demo: show it in a toast-like alert
      setTimeout(() => {
        alert(
          `[CONFI DEV MODE]\n\nYour verification code:\n\n${code}\n\n(In production this is sent to ${target})`
        );
      }, 300);
    },
    []
  );

  const handleStartSignup = (method: "email" | "phone") => {
    setSignupMethod(method);
    setError("");
    setScreen(method === "email" ? "signup_email" : "signup_phone");
  };

  const handleSendEmailOTP = () => {
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    sendOTP(em, "email");
    setScreen("signup_otp");
  };

  const handleSendPhoneOTP = () => {
    const ph = phone.trim().replace(/\D/g, "");
    if (!ph || ph.length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setError("");
    const full = `${countryCode}${ph}`;
    setPhone(ph);
    sendOTP(full, "phone");
    setScreen("signup_otp");
  };

  const handleVerifyOTP = () => {
    if (!otpState) return;
    if (Date.now() > otpState.expires) {
      setError("This code has expired. Please request a new one.");
      return;
    }
    if (otpInput.trim() !== otpState.code) {
      setError("Incorrect code. Please try again.");
      return;
    }
    setError("");
    setOtpVerified(true);
    setScreen("signup_legal");
  };

  const handleResendOTP = () => {
    if (!otpState) return;
    sendOTP(otpState.target, otpState.type);
    setError("");
  };

  const handleLegalContinue = () => {
    const fn = legalFirstName.trim();
    const ln = legalLastName.trim();
    if (!fn || !ln) {
      setError("Please enter your full legal name.");
      return;
    }
    if (!legalDob) {
      setError("Date of birth is required for identity confirmation.");
      return;
    }
    const dob = new Date(legalDob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (age < 18) {
      setError("You must be 18 or older to use Confi.");
      return;
    }
    if (!legalConfirmed) {
      setError(
        "Please confirm that your legal name and date of birth are accurate."
      );
      return;
    }
    setError("");
    setDisplayName(fn);
    setScreen("signup_password");
  };

  const handlePasswordContinue = () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setScreen("signup_profile");
  };

  const handleCompleteSignup = async () => {
    const dn = displayName.trim();
    if (!dn) {
      setError("Please enter a display name.");
      return;
    }
    setLoading(true);
    setError("");

    const legalName = `${legalFirstName.trim()} ${legalLastName.trim()}`;
    const contactEmail =
      signupMethod === "email" ? email.trim().toLowerCase() : "";
    const contactPhone =
      signupMethod === "phone" ? `${countryCode}${phone.trim()}` : "";

    // We use email for auth API; if phone-only signup use a generated placeholder
    const authEmail =
      contactEmail || `${phone.trim()}@phone.confi.app`;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email: authEmail,
          password,
          // Extra fields stored in the user record
          displayName: dn,
          legalName,
          phone: contactPhone,
          avatarColor,
          legalDob,
          createdAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }

      const newSession: UserSession = {
        email: data.email || authEmail,
        displayName: dn,
        legalName,
        phone: contactPhone,
        avatarColor,
        createdAt: new Date().toISOString(),
        token: data.token || data.email || authEmail,
      };
      saveSession(newSession);
      setSession(newSession);
      setScreen("signup_complete");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const em = loginEmail.trim().toLowerCase();
    if (!em || !loginPassword) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email: em,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Invalid credentials.");
        setLoading(false);
        return;
      }

      // Restore or build session from stored data
      const stored = loadSession();
      const restored: UserSession = {
        email: data.email || em,
        displayName: stored?.displayName || em.split("@")[0],
        legalName: stored?.legalName || "",
        phone: stored?.phone || "",
        avatarColor: stored?.avatarColor || AVATAR_COLORS[0],
        createdAt: stored?.createdAt || new Date().toISOString(),
        token: data.token || data.email || em,
      };
      saveSession(restored);
      setSession(restored);
      setScreen("home");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setScreen("welcome");
    // Reset all state
    setEmail("");
    setPhone("");
    setOtpState(null);
    setOtpInput("");
    setOtpVerified(false);
    setLegalFirstName("");
    setLegalLastName("");
    setLegalDob("");
    setLegalConfirmed(false);
    setPassword("");
    setPasswordConfirm("");
    setDisplayName("");
    setAvatarColor(AVATAR_COLORS[0]);
    setLoginEmail("");
    setLoginPassword("");
    setError("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: "#f0f2f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
    margin: "0 auto",
  };

  const logoStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 28,
  };

  const logoIconStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #25D366 0%, #075E54 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  };

  // ─ Splash ─────────────────────────────────────────────────────────────────
  if (screen === "splash") {
    return (
      <div
        style={{
          ...containerStyle,
          background: "linear-gradient(160deg, #075E54 0%, #25D366 100%)",
          flexDirection: "column",
        }}
      >
        <div style={logoIconStyle}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              d="M18 3C9.716 3 3 9.716 3 18c0 2.628.676 5.1 1.86 7.248L3 33l7.944-2.076A14.94 14.94 0 0018 33c8.284 0 15-6.716 15-15S26.284 3 18 3z"
              fill="white"
            />
          </svg>
        </div>
        <h1
          style={{
            color: "#fff",
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: -0.5,
            margin: 0,
          }}
        >
          Confi
        </h1>
        <p style={{ color: "rgba(255,255,255,0.8)", marginTop: 6, fontSize: 15 }}>
          Confidential Messaging
        </p>
      </div>
    );
  }

  // ─ Welcome ────────────────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={logoStyle}>
            <div style={logoIconStyle}>
              <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                <path
                  d="M18 3C9.716 3 3 9.716 3 18c0 2.628.676 5.1 1.86 7.248L3 33l7.944-2.076A14.94 14.94 0 0018 33c8.284 0 15-6.716 15-15S26.284 3 18 3z"
                  fill="white"
                />
              </svg>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#111" }}>
              Confi
            </h1>
            <p style={{ color: "#667781", fontSize: 14, marginTop: 4 }}>
              Confidential Messaging — Legally Protected
            </p>
          </div>

          <InfoBox>
            🔒 Confi activates an international NDA over your conversations,
            giving you real legal protection under confidentiality law.
          </InfoBox>

          <PrimaryButton onClick={() => handleStartSignup("email")}>
            Sign up with Email
          </PrimaryButton>
          <PrimaryButton
            onClick={() => handleStartSignup("phone")}
            variant="secondary"
          >
            Sign up with Phone Number
          </PrimaryButton>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                setError("");
                setScreen("login");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#25D366",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              Already have an account? Log in →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─ Login ──────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button
            onClick={() => {
              setScreen("welcome");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#667781",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 20,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <div style={logoStyle}>
            <div style={logoIconStyle}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <path
                  d="M18 3C9.716 3 3 9.716 3 18c0 2.628.676 5.1 1.86 7.248L3 33l7.944-2.076A14.94 14.94 0 0018 33c8.284 0 15-6.716 15-15S26.284 3 18 3z"
                  fill="white"
                />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Welcome back
            </h2>
            <p style={{ color: "#667781", fontSize: 13, marginTop: 4 }}>
              Log in to your Confi account
            </p>
          </div>

          <ErrorMsg msg={error} />

          <Input
            label="Email Address"
            value={loginEmail}
            onChange={setLoginEmail}
            type="email"
            placeholder="you@example.com"
            inputMode="email"
            autoFocus
          />
          <Input
            label="Password"
            value={loginPassword}
            onChange={setLoginPassword}
            type="password"
            placeholder="Your password"
          />

          <PrimaryButton onClick={handleLogin} loading={loading}>
            Log In
          </PrimaryButton>

          <div style={{ textAlign: "center", marginTop: 4 }}>
            <button
              onClick={() => {
                setScreen("welcome");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#25D366",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Create new account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─ Signup: Email ──────────────────────────────────────────────────────────
  if (screen === "signup_email") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button
            onClick={() => {
              setScreen("welcome");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#667781",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 20,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>
            Enter your email
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            We'll send a 6-digit verification code to confirm your address.
          </p>

          <ErrorMsg msg={error} />

          <Input
            label="Email Address"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="you@example.com"
            inputMode="email"
            autoFocus
          />

          <PrimaryButton onClick={handleSendEmailOTP}>
            Send Verification Code
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Signup: Phone ──────────────────────────────────────────────────────────
  if (screen === "signup_phone") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button
            onClick={() => {
              setScreen("welcome");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#667781",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 20,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>
            Enter your phone number
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            We'll send a 6-digit verification code via SMS.
          </p>

          <ErrorMsg msg={error} />

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#667781",
                marginBottom: 6,
              }}
            >
              Country
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 16px",
                border: "1.5px solid #e0e0e0",
                borderRadius: 12,
                fontSize: 15,
                outline: "none",
                background: "#fff",
                color: "#111",
                boxSizing: "border-box",
              }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            type="tel"
            placeholder="Enter number without country code"
            inputMode="tel"
            autoFocus
          />

          <PrimaryButton onClick={handleSendPhoneOTP}>
            Send Verification Code
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Signup: OTP ────────────────────────────────────────────────────────────
  if (screen === "signup_otp") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button
            onClick={() => {
              setScreen(
                signupMethod === "email" ? "signup_email" : "signup_phone"
              );
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#667781",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 20,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>
            Enter verification code
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            A 6-digit code was sent to{" "}
            <strong>{otpState?.target}</strong>
          </p>

          <ErrorMsg msg={error} />

          <Input
            label="6-Digit Code"
            value={otpInput}
            onChange={(v) => setOtpInput(v.replace(/\D/g, "").slice(0, 6))}
            type="text"
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />

          <PrimaryButton
            onClick={handleVerifyOTP}
            disabled={otpInput.length !== 6}
          >
            Verify Code
          </PrimaryButton>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            {otpCountdown > 0 ? (
              <span style={{ color: "#667781", fontSize: 13 }}>
                Resend code in {otpCountdown}s
              </span>
            ) : (
              <button
                onClick={handleResendOTP}
                style={{
                  background: "none",
                  border: "none",
                  color: "#25D366",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Resend Code
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─ Signup: Legal Identity ─────────────────────────────────────────────────
  if (screen === "signup_legal") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div
            style={{
              background: "linear-gradient(135deg, #25D366, #075E54)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 24,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>⚖️ Legal Identity</div>
            <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
              Confi uses your legal name as the signatory identity when our NDA
              feature is activated. This information is protected and encrypted.
            </div>
          </div>

          <ErrorMsg msg={error} />

          <Input
            label="Legal First Name"
            value={legalFirstName}
            onChange={setLegalFirstName}
            placeholder="As it appears on government ID"
            autoFocus
          />
          <Input
            label="Legal Last Name"
            value={legalLastName}
            onChange={setLegalLastName}
            placeholder="As it appears on government ID"
          />

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#667781",
                marginBottom: 6,
              }}
            >
              Date of Birth
            </label>
            <input
              type="date"
              value={legalDob}
              onChange={(e) => setLegalDob(e.target.value)}
              max={new Date(
                new Date().setFullYear(new Date().getFullYear() - 18)
              )
                .toISOString()
                .split("T")[0]}
              style={{
                width: "100%",
                padding: "13px 16px",
                border: "1.5px solid #e0e0e0",
                borderRadius: 12,
                fontSize: 15,
                outline: "none",
                background: "#fff",
                color: "#111",
                boxSizing: "border-box",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 20,
              cursor: "pointer",
              fontSize: 13,
              color: "#333",
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={legalConfirmed}
              onChange={(e) => setLegalConfirmed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            I confirm that the legal name and date of birth I have provided are
            accurate and match my government-issued identification. I understand
            this information will be used as my signatory identity for legally
            binding NDA agreements on Confi.
          </label>

          <PrimaryButton onClick={handleLegalContinue}>Continue</PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Signup: Password ───────────────────────────────────────────────────────
  if (screen === "signup_password") {
    const strength =
      password.length === 0
        ? 0
        : password.length < 6
        ? 1
        : password.length < 8 || !/[A-Z]/.test(password)
        ? 2
        : !/[0-9]/.test(password)
        ? 3
        : 4;

    const strengthColors = ["#e0e0e0", "#f44336", "#ff9800", "#ffd600", "#25D366"];
    const strengthLabels = ["", "Too short", "Weak", "Fair", "Strong"];

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>
            Create password
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            Must be 8+ characters with at least one uppercase letter and number.
          </p>

          <ErrorMsg msg={error} />

          <Input
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Create a strong password"
            autoFocus
          />

          {/* Strength bar */}
          {password.length > 0 && (
            <div style={{ marginBottom: 16, marginTop: -8 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "#e0e0e0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(strength / 4) * 100}%`,
                    height: "100%",
                    background: strengthColors[strength],
                    transition: "width 0.3s, background 0.3s",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: strengthColors[strength],
                  fontWeight: 600,
                }}
              >
                {strengthLabels[strength]}
              </span>
            </div>
          )}

          <Input
            label="Confirm Password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            type="password"
            placeholder="Repeat your password"
          />

          <PrimaryButton
            onClick={handlePasswordContinue}
            disabled={!password || !passwordConfirm}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Signup: Profile ────────────────────────────────────────────────────────
  if (screen === "signup_profile") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>
            Set up your profile
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            This is how others will see you on Confi.
          </p>

          <ErrorMsg msg={error} />

          {/* Avatar preview */}
          <div
            style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}
          >
            <Avatar name={displayName || "?"} color={avatarColor} size={72} />
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="How you appear to others"
            autoFocus
            maxLength={32}
          />

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#667781",
                marginBottom: 10,
              }}
            >
              Avatar Colour
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 8,
              }}
            >
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: c,
                    border: avatarColor === c ? "3px solid #111" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                />
              ))}
            </div>
          </div>

          <PrimaryButton
            onClick={handleCompleteSignup}
            loading={loading}
            disabled={!displayName.trim()}
          >
            Create Account
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Signup: Complete ───────────────────────────────────────────────────────
  if (screen === "signup_complete") {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>
            Welcome to Confi!
          </h2>
          <p style={{ color: "#667781", fontSize: 14, marginBottom: 24 }}>
            Your account is ready. Your legal identity has been confirmed and
            secured as your NDA signatory profile.
          </p>

          {session && (
            <div
              style={{
                background: "#f0faf4",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 24,
                textAlign: "left",
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
                <Avatar
                  name={session.displayName}
                  color={session.avatarColor}
                  size={48}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {session.displayName}
                  </div>
                  <div style={{ color: "#667781", fontSize: 13 }}>
                    {session.email}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                <div>
                  ⚖️ <strong>Legal Name:</strong> {session.legalName}
                </div>
                {session.phone && (
                  <div>
                    📱 <strong>Phone:</strong> {session.phone}
                  </div>
                )}
                <div>
                  📅 <strong>Member since:</strong>{" "}
                  {new Date(session.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          <PrimaryButton onClick={() => setScreen("home")}>
            Go to Confi →
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─ Home ───────────────────────────────────────────────────────────────────
  if (screen === "home" && session) {
    return <HomeScreen session={session} onLogout={handleLogout} />;
  }

  return null;
}

// ─── Home Screen Component ────────────────────────────────────────────────────

function HomeScreen({
  session,
  onLogout,
}: {
  session: UserSession;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chats" | "profile">("chats");
  const [showNDAInfo, setShowNDAInfo] = useState(false);

  const MOCK_CHATS = [
    {
      id: 1,
      name: "Alice Chen",
      lastMsg: "See you at the meeting tomorrow",
      time: "10:24",
      unread: 2,
      color: "#FF6B6B",
      nda: false,
    },
    {
      id: 2,
      name: "Bob Martinez",
      lastMsg: "The contract is ready for review",
      time: "09:15",
      unread: 0,
      color: "#4D96FF",
      nda: true,
    },
    {
      id: 3,
      name: "Sarah Johnson",
      lastMsg: "Can we keep this confidential?",
      time: "Yesterday",
      unread: 1,
      color: "#CC5DE8",
      nda: false,
    },
    {
      id: 4,
      name: "Tech Ventures Ltd",
      lastMsg: "NDA terms agreed by all parties",
      time: "Mon",
      unread: 0,
      color: "#25D366",
      nda: true,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f0f2f5",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#075E54",
          padding: "16px 20px 12px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              margin: 0,
              letterSpacing: -0.3,
            }}
          >
            Confi
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => setShowNDAInfo(!showNDAInfo)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 20,
                padding: "6px 12px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚖️ NDA
            </button>
          </div>
        </div>

        {/* NDA Info Banner */}
        {showNDAInfo && (
          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "12px 14px",
              marginTop: 12,
              color: "#fff",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            🔒 <strong>Confi NDA Feature:</strong> When activated on any
            conversation, an internationally-recognised Non-Disclosure Agreement
            is applied, binding all parties under confidentiality law. Your legal
            identity (<em>{session.legalName}</em>) serves as the signatory.
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            marginTop: 16,
            borderBottom: "2px solid rgba(255,255,255,0.2)",
          }}
        >
          {(["chats", "profile"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab
                    ? "2px solid #25D366"
                    : "2px solid transparent",
                color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.6)",
                fontWeight: activeTab === tab ? 700 : 400,
                fontSize: 14,
                padding: "8px 16px",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: -2,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "chats" && (
          <div>
            {MOCK_CHATS.map((chat) => (
              <div
                key={chat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: "1px solid #f0f2f5",
                  background: "#fff",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    "#f9f9f9")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    "#fff")
                }
              >
                <div style={{ position: "relative", marginRight: 14 }}>
                  <Avatar name={chat.name} color={chat.color} size={50} />
                  {chat.nda && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        background: "#25D366",
                        borderRadius: "50%",
                        width: 18,
                        height: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        border: "2px solid #fff",
                      }}
                    >
                      🔒
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
                      {chat.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: chat.unread > 0 ? "#25D366" : "#667781",
                      }}
                    >
                      {chat.time}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "#667781",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "80%",
                      }}
                    >
                      {chat.nda ? "🔒 " : ""}
                      {chat.lastMsg}
                    </span>
                    {chat.unread > 0 && (
                      <span
                        style={{
                          background: "#25D366",
                          color: "#fff",
                          borderRadius: 10,
                          padding: "2px 6px",
                          fontSize: 11,
                          fontWeight: 700,
                          minWidth: 18,
                          textAlign: "center",
                        }}
                      >
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Info card */}
            <div style={{ padding: "20px" }}>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "16px",
                  border: "1.5px dashed #25D366",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#444",
                    lineHeight: 1.6,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
                  <strong>NDA Protection Active</strong>
                  <br />
                  Conversations marked with 🔒 are protected under an
                  international NDA signed as{" "}
                  <strong>{session.legalName}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div style={{ padding: "24px 20px" }}>
            {/* Profile card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: "24px 20px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}
              >
                <Avatar
                  name={session.displayName}
                  color={session.avatarColor}
                  size={80}
                />
              </div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 700 }}>
                {session.displayName}
              </h2>
              <p style={{ color: "#667781", margin: 0, fontSize: 14 }}>
                {session.email}
              </p>
            </div>

            {/* Identity card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: "20px",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#667781",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ⚖️ Legal Identity (NDA Signatory)
              </h3>

              {[
                { label: "Legal Name", value: session.legalName },
                {
                  label: "Email",
                  value: session.email.includes("@phone.confi.app")
                    ? "—"
                    : session.email,
                },
                {
                  label: "Phone",
                  value: session.phone || "—",
                },
                {
                  label: "Member Since",
                  value: new Date(session.createdAt).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  ),
                },
              ].map((field) => (
                <div
                  key={field.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#667781" }}>
                    {field.label}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 600, color: "#111" }}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
            </div>

            {/* NDA Status */}
            <div
              style={{
                background: "#e8f5e9",
                borderRadius: 16,
                padding: "16px 20px",
                marginBottom: 16,
                border: "1px solid #a5d6a7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>🔒</span>
                <strong style={{ fontSize: 14, color: "#2e7d32" }}>
                  Identity Verified for NDA Signing
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#388e3c", lineHeight: 1.5 }}>
                Your legal identity has been confirmed. When you activate Confi
                Mode on any conversation, you automatically enter into an
                internationally-recognised NDA as <strong>{session.legalName}</strong>,
                binding all parties to strict confidentiality.
              </p>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              style={{
                width: "100%",
                padding: "14px",
                background: "#fff0f0",
                border: "1px solid #ffcdd2",
                borderRadius: 12,
                color: "#c62828",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}