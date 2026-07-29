"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "welcome"
  | "signup"
  | "login"
  | "otp"
  | "profile"
  | "pin-setup"
  | "pin-lock"
  | "home";

interface UserSession {
  email: string;
  displayName: string;
  avatarColor: string;
  phone: string;
  verified: boolean;
  pinEnabled: boolean;
  pinHash: string;
  createdAt: string;
}

interface OtpState {
  code: string;
  target: string;
  type: "email" | "phone";
  expires: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6C63FF","#FF6584","#43C6AC","#F7971E","#2193B0",
  "#C779D0","#56AB2F","#F953C6","#00C9FF","#FF6B6B",
];

function hashPin(pin: string): string {
  // Simple deterministic hash for PIN (no bcrypt in browser)
  let hash = 0;
  const salted = `CONFI_SALT_2024_${pin}_SECURE`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `pin_${Math.abs(hash).toString(36)}_${pin.length}`;
}

function generateOtp(): string {
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

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function saveSession(session: UserSession) {
  localStorage.setItem("confi_session", JSON.stringify(session));
  localStorage.setItem("confi_session_at", Date.now().toString());
}

function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem("confi_session");
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("confi_session");
  localStorage.removeItem("confi_session_at");
  localStorage.removeItem("confi_pin_locked");
}

function isSessionExpired(): boolean {
  const at = localStorage.getItem("confi_session_at");
  if (!at) return true;
  const age = Date.now() - parseInt(at, 10);
  return age > 30 * 24 * 60 * 60 * 1000; // 30 days
}

function isPinLocked(): boolean {
  return localStorage.getItem("confi_pin_locked") === "true";
}

function setPinLocked(val: boolean) {
  localStorage.setItem("confi_pin_locked", val ? "true" : "false");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
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
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const digits = Array(6).fill("");
  value.split("").forEach((c, i) => {
    if (i < 6) digits[i] = c;
  });

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          id={`otp_${i}`}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            const next = value.split("");
            next[i] = val;
            const joined = next.join("").slice(0, 6);
            onChange(joined);
            if (val && i < 5) {
              document.getElementById(`otp_${i + 1}`)?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) {
              document.getElementById(`otp_${i - 1}`)?.focus();
            }
          }}
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            border: d ? "2px solid #6C63FF" : "2px solid #ddd",
            borderRadius: 10,
            outline: "none",
            background: d ? "#f0eeff" : "#fafafa",
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function PinDots({ filled, total = 4 }: { filled: number; total?: number }) {
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "24px 0" }}>
      {Array(total)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: i < filled ? "#6C63FF" : "#ddd",
              transition: "background 0.2s",
            }}
          />
        ))}
    </div>
  );
}

function PinPad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        maxWidth: 280,
        margin: "0 auto",
      }}
    >
      {keys.map((k, i) => (
        <button
          key={i}
          onClick={() => {
            if (k === "⌫") onDelete();
            else if (k) onDigit(k);
          }}
          disabled={!k}
          style={{
            height: 64,
            borderRadius: 16,
            border: "none",
            background: k ? "#f5f5f5" : "transparent",
            fontSize: k === "⌫" ? 22 : 24,
            fontWeight: 600,
            cursor: k ? "pointer" : "default",
            color: k === "⌫" ? "#6C63FF" : "#222",
            transition: "background 0.15s",
          }}
          onMouseDown={(e) => {
            const t = e.currentTarget;
            t.style.background = "#e0deff";
          }}
          onMouseUp={(e) => {
            const t = e.currentTarget;
            t.style.background = "#f5f5f5";
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [session, setSession] = useState<UserSession | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [chosenColor, setChosenColor] = useState(randomColor());
  const [otpValue, setOtpValue] = useState("");
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"create" | "confirm">("create");
  const [pinAttempts, setPinAttempts] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpMode, setOtpMode] = useState<"signup" | "login">("signup");

  // Track page view
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Boot: check existing session
  useEffect(() => {
    const stored = loadSession();
    if (!stored || isSessionExpired()) {
      clearSession();
      setTimeout(() => setScreen("welcome"), 1500);
      return;
    }
    setSession(stored);
    if (stored.pinEnabled && isPinLocked()) {
      setTimeout(() => setScreen("pin-lock"), 1500);
    } else {
      setTimeout(() => setScreen("home"), 1500);
    }
  }, []);

  // Lock on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.hidden && session?.pinEnabled) {
        setPinLocked(true);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [session]);

  const showError = (msg: string) => {
    setError(msg);
    setInfo("");
    setTimeout(() => setError(""), 4000);
  };

  const showInfo = (msg: string) => {
    setInfo(msg);
    setError("");
    setTimeout(() => setInfo(""), 4000);
  };

  // ── Sign Up ──────────────────────────────────────────────────────────────

  const handleSignup = async () => {
    setError("");
    if (!email || !phone || !password || !confirmPassword) {
      return showError("Please fill in all fields.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError("Enter a valid email address.");
    }
    if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/\s/g, ""))) {
      return showError("Enter a valid phone number (e.g. +1234567890).");
    }
    if (password.length < 8) {
      return showError("Password must be at least 8 characters.");
    }
    if (password !== confirmPassword) {
      return showError("Passwords do not match.");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLoading(false);
        return showError(data.error || "Sign-up failed. Try a different email.");
      }

      // Generate and store OTP
      const code = generateOtp();
      const otp: OtpState = {
        code,
        target: email,
        type: "email",
        expires: Date.now() + 10 * 60 * 1000,
      };
      setOtpState(otp);
      setOtpMode("signup");
      // In production this would be emailed; we show it for demo
      showInfo(`Demo OTP for ${email}: ${code}`);
      setLoading(false);
      setScreen("otp");
    } catch {
      setLoading(false);
      showError("Network error. Please try again.");
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setError("");
    if (!email || !password) return showError("Enter email and password.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLoading(false);
        return showError(data.error || "Invalid credentials.");
      }

      // Check if existing session data
      const stored = loadSession();
      if (stored && stored.email === email) {
        setSession(stored);
        setLoading(false);
        if (stored.pinEnabled) {
          setPinLocked(true);
          setScreen("pin-lock");
        } else {
          setScreen("home");
        }
        return;
      }

      // New device login — need OTP
      const code = generateOtp();
      const otp: OtpState = {
        code,
        target: email,
        type: "email",
        expires: Date.now() + 10 * 60 * 1000,
      };
      setOtpState(otp);
      setOtpMode("login");
      showInfo(`Demo OTP for ${email}: ${code}`);
      setLoading(false);
      setScreen("otp");
    } catch {
      setLoading(false);
      showError("Network error. Please try again.");
    }
  };

  // ── OTP Verify ───────────────────────────────────────────────────────────

  const handleOtpVerify = useCallback(() => {
    if (!otpState) return showError("OTP session expired.");
    if (Date.now() > otpState.expires) return showError("OTP expired. Please request a new one.");
    if (otpValue.length !== 6) return showError("Enter the 6-digit code.");
    if (otpValue !== otpState.code) return showError("Incorrect code. Try again.");

    setOtpValue("");
    setOtpState(null);
    showInfo("Verified! ✓");

    if (otpMode === "signup") {
      setScreen("profile");
    } else {
      // Login — load existing profile or go to profile creation
      const stored = loadSession();
      if (stored && stored.email === email) {
        setSession(stored);
        setScreen("home");
      } else {
        setScreen("profile");
      }
    }
  }, [otpState, otpValue, otpMode, email]);

  const handleResendOtp = () => {
    if (!otpState) return;
    const code = generateOtp();
    const newOtp: OtpState = {
      ...otpState,
      code,
      expires: Date.now() + 10 * 60 * 1000,
    };
    setOtpState(newOtp);
    showInfo(`New OTP: ${code}`);
  };

  // ── Profile ──────────────────────────────────────────────────────────────

  const handleProfileSave = () => {
    if (!displayName.trim()) return showError("Enter your display name.");
    if (displayName.trim().length < 2) return showError("Name must be at least 2 characters.");

    const newSession: UserSession = {
      email,
      displayName: displayName.trim(),
      avatarColor: chosenColor,
      phone,
      verified: true,
      pinEnabled: false,
      pinHash: "",
      createdAt: new Date().toISOString(),
    };
    saveSession(newSession);
    setSession(newSession);
    setScreen("pin-setup");
  };

  // ── PIN Setup ────────────────────────────────────────────────────────────

  const handlePinDigit = (d: string) => {
    if (pinStep === "create") {
      if (pinInput.length < 4) {
        const next = pinInput + d;
        setPinInput(next);
        if (next.length === 4) {
          setTimeout(() => setPinStep("confirm"), 300);
        }
      }
    } else {
      if (pinConfirm.length < 4) {
        const next = pinConfirm + d;
        setPinConfirm(next);
        if (next.length === 4) {
          setTimeout(() => {
            if (next === pinInput) {
              if (session) {
                const updated = { ...session, pinEnabled: true, pinHash: hashPin(pinInput) };
                saveSession(updated);
                setSession(updated);
              }
              setPinInput("");
              setPinConfirm("");
              setPinStep("create");
              setPinLocked(false);
              showInfo("PIN set successfully!");
              setScreen("home");
            } else {
              showError("PINs don't match. Try again.");
              setPinConfirm("");
              setPinInput("");
              setPinStep("create");
            }
          }, 300);
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === "create") {
      setPinInput((p) => p.slice(0, -1));
    } else {
      setPinConfirm((p) => p.slice(0, -1));
    }
  };

  const handleSkipPin = () => {
    setPinInput("");
    setPinConfirm("");
    setPinStep("create");
    setPinLocked(false);
    setScreen("home");
  };

  // ── PIN Lock ─────────────────────────────────────────────────────────────

  const [lockPin, setLockPin] = useState("");

  const handleLockPinDigit = (d: string) => {
    if (lockPin.length < 4) {
      const next = lockPin + d;
      setLockPin(next);
      if (next.length === 4) {
        setTimeout(() => {
          if (session && hashPin(next) === session.pinHash) {
            setPinLocked(false);
            setPinAttempts(0);
            setLockPin("");
            setScreen("home");
          } else {
            const attempts = pinAttempts + 1;
            setPinAttempts(attempts);
            setLockPin("");
            if (attempts >= 5) {
              showError("Too many attempts. Logging out for security.");
              setTimeout(() => {
                clearSession();
                setSession(null);
                setScreen("welcome");
                setPinAttempts(0);
              }, 2000);
            } else {
              showError(`Wrong PIN. ${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining.`);
            }
          }
        }, 300);
      }
    }
  };

  const handleLockPinDelete = () => setLockPin((p) => p.slice(0, -1));

  // ── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setPinInput("");
    setPinConfirm("");
    setLockPin("");
    setScreen("welcome");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f7fb",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: "0 16px",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 24,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 8px 40px rgba(108,99,255,0.10)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "2px solid #ebebeb",
    fontSize: 15,
    outline: "none",
    transition: "border 0.2s",
    boxSizing: "border-box",
    background: "#fafafa",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    padding: "15px",
    borderRadius: 14,
    border: "none",
    background: loading ? "#b0acf5" : "linear-gradient(135deg, #6C63FF, #48C9B0)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer",
    transition: "opacity 0.2s",
    letterSpacing: 0.3,
  };

  const ghostBtn: React.CSSProperties = {
    width: "100%",
    padding: "13px",
    borderRadius: 14,
    border: "2px solid #6C63FF",
    background: "transparent",
    color: "#6C63FF",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#888",
    marginBottom: 4,
    display: "block",
  };

  const LogoMark = () => (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "linear-gradient(135deg, #6C63FF, #48C9B0)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
          boxShadow: "0 4px 20px rgba(108,99,255,0.3)",
        }}
      >
        <span style={{ fontSize: 28 }}>🔐</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", letterSpacing: -0.5 }}>
        Confi
      </div>
      <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>Secure. Private. Confidential.</div>
    </div>
  );

  const Alert = () =>
    error || info ? (
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          background: error ? "#fff0f0" : "#f0fff8",
          border: `1px solid ${error ? "#ffcdd2" : "#b2dfdb"}`,
          color: error ? "#c62828" : "#00695c",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {error || info}
      </div>
    ) : null;

  // ─── Screens ───────────────────────────────────────────────────────────────

  // SPLASH
  if (screen === "splash") {
    return (
      <div
        style={{
          ...containerStyle,
          background: "linear-gradient(135deg, #6C63FF 0%, #48C9B0 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            animation: "fadeIn 0.8s ease",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              backdropFilter: "blur(10px)",
            }}
          >
            🔐
          </div>
          <div style={{ color: "#fff", fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
            Confi
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
            Loading secure environment…
          </div>
          <div
            style={{
              width: 40,
              height: 4,
              background: "rgba(255,255,255,0.3)",
              borderRadius: 4,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: "70%",
                height: "100%",
                background: "#fff",
                borderRadius: 4,
                animation: "pulse 1s infinite",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // WELCOME
  if (screen === "welcome") {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center", gap: 20 }}>
          <LogoMark />
          <div style={{ color: "#555", fontSize: 14, lineHeight: 1.7 }}>
            The only messaging app where every confidential conversation is legally protected
            by an international NDA. Your identity is the key.
          </div>
          <div
            style={{
              background: "#f5f4ff",
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 13,
              color: "#6C63FF",
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            🛡️ Verified identity anchors NDA signatures
            <br />
            🔒 End-to-end encrypted conversations
            <br />
            ⚖️ Legally binding confidentiality layer
          </div>
          <button style={primaryBtn} onClick={() => setScreen("signup")}>
            Create Account
          </button>
          <button style={ghostBtn} onClick={() => setScreen("login")}>
            Sign In
          </button>
          <div style={{ fontSize: 11, color: "#bbb" }}>
            By continuing you agree to our Terms & Privacy Policy
          </div>
        </div>
      </div>
    );
  }

  // SIGN UP
  if (screen === "signup") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <LogoMark />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", textAlign: "center" }}>
            Create Account
          </div>
          <Alert />

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              style={inputStyle}
              type="tel"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 48 }}
                type={showPass ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#aaa",
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              style={inputStyle}
              type={showPass ? "text" : "password"}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div
            style={{
              background: "#f5f4ff",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "#8880cc",
              lineHeight: 1.6,
            }}
          >
            🔐 Password strength:{" "}
            <strong>
              {password.length === 0
                ? "—"
                : password.length < 8
                ? "Weak"
                : password.length < 12
                ? "Good"
                : "Strong"}
            </strong>
            {password.length > 0 && password.length < 8 && " (need 8+ chars)"}
          </div>

          <button style={primaryBtn} onClick={handleSignup} disabled={loading}>
            {loading ? "Creating Account…" : "Continue →"}
          </button>

          <div style={{ textAlign: "center", fontSize: 14, color: "#888" }}>
            Already have an account?{" "}
            <button
              onClick={() => setScreen("login")}
              style={{
                background: "none",
                border: "none",
                color: "#6C63FF",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN
  if (screen === "login") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <LogoMark />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e", textAlign: "center" }}>
            Welcome Back
          </div>
          <Alert />

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 48 }}
                type={showPass ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#aaa",
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button style={primaryBtn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing In…" : "Sign In"}
          </button>

          <div style={{ textAlign: "center", fontSize: 14, color: "#888" }}>
            No account?{" "}
            <button
              onClick={() => setScreen("signup")}
              style={{
                background: "none",
                border: "none",
                color: "#6C63FF",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // OTP
  if (screen === "otp") {
    const remaining = otpState
      ? Math.max(0, Math.floor((otpState.expires - Date.now()) / 1000))
      : 0;

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <LogoMark />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              Verify Your Identity
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 6, lineHeight: 1.6 }}>
              A 6-digit code was sent to{" "}
              <strong style={{ color: "#6C63FF" }}>{otpState?.target}</strong>.
              <br />
              This links your legal identity to Confi.
            </div>
          </div>

          <Alert />

          <OtpInput value={otpValue} onChange={setOtpValue} />

          <div style={{ textAlign: "center", fontSize: 12, color: "#bbb" }}>
            Expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </div>

          <button
            style={primaryBtn}
            onClick={handleOtpVerify}
            disabled={otpValue.length !== 6}
          >
            Verify Code
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleResendOtp}
              style={{
                background: "none",
                border: "none",
                color: "#6C63FF",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Resend Code
            </button>
          </div>

          <button
            onClick={() => setScreen(otpMode === "signup" ? "signup" : "login")}
            style={{ ...ghostBtn, marginTop: -8 }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // PROFILE CREATION
  if (screen === "profile") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <LogoMark />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              Create Your Profile
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
              Your name will appear on NDA documents
            </div>
          </div>

          <Alert />

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <Avatar
              name={displayName || "?"}
              color={chosenColor}
              size={72}
            />
          </div>

          <div>
            <label style={labelStyle}>Choose Avatar Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setChosenColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c,
                    border: chosenColor === c ? "3px solid #1a1a2e" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "border 0.2s",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Display Name</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Your full legal name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div
            style={{
              background: "#fff8e1",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "#f57f17",
              lineHeight: 1.6,
            }}
          >
            ⚖️ This name will be used on legally binding NDA agreements. Use your real name.
          </div>

          <button style={primaryBtn} onClick={handleProfileSave}>
            Save Profile →
          </button>
        </div>
      </div>
    );
  }

  // PIN SETUP
  if (screen === "pin-setup") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <LogoMark />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              {pinStep === "create" ? "Set Your PIN" : "Confirm Your PIN"}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
              {pinStep === "create"
                ? "Protect your conversations with a 4-digit PIN"
                : "Enter the PIN again to confirm"}
            </div>
          </div>

          <Alert />

          <PinDots filled={pinStep === "create" ? pinInput.length : pinConfirm.length} />
          <PinPad onDigit={handlePinDigit} onDelete={handlePinDelete} />

          <button onClick={handleSkipPin} style={{ ...ghostBtn, marginTop: 8 }}>
            Skip for Now
          </button>
        </div>
      </div>
    );
  }

  // PIN LOCK
  if (screen === "pin-lock") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            {session && (
              <div style={{ marginBottom: 12 }}>
                <Avatar name={session.displayName} color={session.avatarColor} size={56} />
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: "#6C63FF", fontWeight: 600 }}>
              {session?.displayName}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
              Enter your PIN to unlock Confi
            </div>
          </div>

          <Alert />

          <PinDots filled={lockPin.length} />
          <PinPad onDigit={handleLockPinDigit} onDelete={handleLockPinDelete} />

          <button
            onClick={() => {
              clearSession();
              setSession(null);
              setScreen("login");
            }}
            style={{ ...ghostBtn, marginTop: 8 }}
          >
            Use Different Account
          </button>
        </div>
      </div>
    );
  }

  // HOME (Dashboard)
  if (screen === "home" && session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f7f7fb",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #6C63FF, #48C9B0)",
            padding: "20px 20px 28px",
            color: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Confi</div>
            <button
              onClick={handleLogout}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Sign Out
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={session.displayName} color={session.avatarColor} size={52} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{session.displayName}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{session.email}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                {session.phone} · {session.verified ? "✓ Verified" : "Unverified"}
              </div>
            </div>
          </div>
        </div>

        {/* Identity Badge */}
        <div style={{ padding: "16px 20px 0" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 2px 12px rgba(108,99,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #6C63FF22, #48C9B022)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              🪪
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>
                Identity Verified
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>
                NDA anchor ready · Account since{" "}
                {new Date(session.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                background: "#e8f5e9",
                color: "#2e7d32",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ACTIVE
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div style={{ padding: "12px 20px 0" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 2px 12px rgba(108,99,255,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 12 }}>
              SECURITY
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { icon: "🔑", label: "Password", status: "Set", ok: true },
                { icon: "📧", label: "Email Verified", status: "Done", ok: true },
                {
                  icon: "🔢",
                  label: "PIN Lock",
                  status: session.pinEnabled ? "Enabled" : "Not set",
                  ok: session.pinEnabled,
                },
                { icon: "📱", label: "Phone on file", status: session.phone || "—", ok: !!session.phone },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 14, color: "#333", flex: 1 }}>{item.label}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: item.ok ? "#2e7d32" : "#e65100",
                      background: item.ok ? "#e8f5e9" : "#fff3e0",
                      borderRadius: 20,
                      padding: "3px 10px",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            {!session.pinEnabled && (
              <button
                style={{ ...primaryBtn, marginTop: 14 }}
                onClick={() => {
                  setPinInput("");
                  setPinConfirm("");
                  setPinStep("create");
                  setScreen("pin-setup");
                }}
              >
                Enable PIN Lock
              </button>
            )}
          </div>
        </div>

        {/* Messaging preview */}
        <div style={{ padding: "12px 20px 0" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 2px 12px rgba(108,99,255,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 12 }}>
              CONVERSATIONS
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                color: "#bbb",
                fontSize: 14,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
              <div style={{ fontWeight: 600, color: "#888" }}>No conversations yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Start a confidential chat to enable NDA protection
              </div>
              <div
                style={{
                  marginTop: 14,
                  background: "#f5f4ff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#6C63FF",
                  textAlign: "left",
                  lineHeight: 1.7,
                }}
              >
                🔒 When you start a confidential chat, both parties automatically sign an international NDA anchored to your verified identity.
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 32 }} />
      </div>
    );
  }

  return null;
}