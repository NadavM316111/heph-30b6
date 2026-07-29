"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserProfile {
  email: string;
  username: string;
  legalName: string;
  phone: string;
  profilePhoto: string;
  verifiedAt: string;
  deviceFingerprint: string;
  sessionToken: string;
  refreshToken: string;
  pinHash: string;
  biometricEnabled: boolean;
  otpVerified: boolean;
}

type Screen =
  | "splash"
  | "welcome"
  | "signup"
  | "otp"
  | "profile-setup"
  | "pin-setup"
  | "login"
  | "login-otp"
  | "pin-lock"
  | "dashboard";

// ─── Utilities ────────────────────────────────────────────────────────────────
function generateToken(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  array.forEach((b) => (result += chars[b % chars.length]));
  return result;
}

function generateOTP(): string {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b % 10)
    .join("");
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "confi-salt-2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform || "",
  ].join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(components);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function encryptData(data: string, key: string): string {
  const keyBytes = key.split("").map((c) => c.charCodeAt(0));
  return btoa(
    data
      .split("")
      .map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ keyBytes[i % keyBytes.length])
      )
      .join("")
  );
}

function decryptData(encrypted: string, key: string): string {
  const keyBytes = key.split("").map((c) => c.charCodeAt(0));
  const decoded = atob(encrypted);
  return decoded
    .split("")
    .map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ keyBytes[i % keyBytes.length])
    )
    .join("");
}

const STORAGE_KEY = "confi_secure_session";
const LOCK_KEY = "confi_lock_state";

function saveSession(profile: UserProfile): void {
  const deviceId = profile.deviceFingerprint.slice(0, 16);
  const encrypted = encryptData(JSON.stringify(profile), deviceId);
  localStorage.setItem(STORAGE_KEY, encrypted);
  localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: false, ts: Date.now() }));
}

function loadSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const fingerprint = localStorage.getItem("confi_fp") || "";
    const deviceId = fingerprint.slice(0, 16);
    const decrypted = decryptData(raw, deviceId);
    return JSON.parse(decrypted) as UserProfile;
  } catch {
    return null;
  }
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem("confi_fp");
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,

  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 440,
    margin: "0 auto",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
  } as React.CSSProperties,

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center" as const,
  },

  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center" as const,
    marginBottom: 32,
    lineHeight: 1.5,
  },

  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    display: "block",
  },

  input: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  } as React.CSSProperties,

  btn: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s, transform 0.1s",
    marginTop: 8,
  } as React.CSSProperties,

  btnSecondary: {
    width: "100%",
    padding: "13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    marginTop: 8,
  } as React.CSSProperties,

  error: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#fca5a5",
    fontSize: 13,
    marginBottom: 16,
  } as React.CSSProperties,

  success: {
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#86efac",
    fontSize: 13,
    marginBottom: 16,
  } as React.CSSProperties,

  fieldGroup: {
    marginBottom: 18,
  } as React.CSSProperties,

  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  } as React.CSSProperties,

  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  } as React.CSSProperties,

  otpGrid: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginBottom: 24,
  } as React.CSSProperties,

  otpBox: {
    width: 50,
    height: 56,
    borderRadius: 12,
    border: "2px solid rgba(124,58,237,0.5)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center" as const,
    outline: "none",
  } as React.CSSProperties,

  pinGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    maxWidth: 260,
    margin: "0 auto 24px",
  } as React.CSSProperties,

  pinKey: {
    padding: "16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 20,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center" as const,
  } as React.CSSProperties,

  pinDots: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginBottom: 28,
  } as React.CSSProperties,

  avatarWrap: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    marginBottom: 24,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    marginBottom: 10,
    cursor: "pointer",
    border: "3px solid rgba(255,255,255,0.2)",
    overflow: "hidden" as const,
  } as React.CSSProperties,

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 20,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
    color: "#86efac",
    fontSize: 12,
    fontWeight: 600,
    marginTop: 6,
  } as React.CSSProperties,

  ndaBanner: {
    background: "rgba(124,58,237,0.15)",
    border: "1px solid rgba(124,58,237,0.4)",
    borderRadius: 12,
    padding: "12px 16px",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 20,
  } as React.CSSProperties,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Auth fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [usePhone, setUsePhone] = useState(false);

  // OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Profile setup
  const [legalName, setLegalName] = useState("");
  const [username, setUsername] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  // PIN
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"create" | "confirm">("create");
  const [tempPin, setTempPin] = useState("");

  // Lock screen
  const [lockPin, setLockPin] = useState("");
  const [lockAttempts, setLockAttempts] = useState(0);

  // Session
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [deviceFp, setDeviceFp] = useState("");

  // ── On mount: fingerprint + session check ──
  useEffect(() => {
    const init = async () => {
      const fp = await getDeviceFingerprint();
      setDeviceFp(fp);
      localStorage.setItem("confi_fp", fp);

      // Track page
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: window.location.pathname }),
        });
      } catch {}

      // Check existing session
      const existing = loadSession();
      if (existing) {
        setProfile(existing);
        // Check lock state
        const lockRaw = localStorage.getItem(LOCK_KEY);
        if (lockRaw) {
          const lock = JSON.parse(lockRaw);
          const elapsed = Date.now() - lock.ts;
          // Auto-lock after 5 minutes
          if (elapsed > 5 * 60 * 1000) {
            setScreen("pin-lock");
          } else {
            setScreen("dashboard");
          }
        } else {
          setScreen("pin-lock");
        }
      } else {
        setTimeout(() => setScreen("welcome"), 1800);
      }
    };
    init();
  }, []);

  // ── Activity tracker for auto-lock ──
  useEffect(() => {
    if (screen !== "dashboard") return;
    const updateActivity = () => {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: false, ts: Date.now() }));
    };
    window.addEventListener("click", updateActivity);
    window.addEventListener("keydown", updateActivity);
    return () => {
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("keydown", updateActivity);
    };
  }, [screen]);

  const clearErrors = () => {
    setError("");
    setInfo("");
  };

  // ── Send OTP (simulated — shows in info banner for demo) ──
  const sendOtp = useCallback(() => {
    const code = generateOTP();
    setGeneratedOtp(code);
    setInfo(`📱 OTP sent! (Demo mode: ${code})`);
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, []);

  // ── Signup flow ──
  const handleSignup = async () => {
    clearErrors();
    const identifier = usePhone ? phone : email;
    if (!identifier) return setError("Please enter your email or phone number.");
    if (!password || password.length < 8)
      return setError("Password must be at least 8 characters.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Signup failed. Try a different email.");
      } else {
        sendOtp();
        setScreen("otp");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verification ──
  const handleVerifyOtp = () => {
    clearErrors();
    const entered = otp.join("");
    if (entered.length < 6) return setError("Please enter all 6 digits.");
    if (entered !== generatedOtp) {
      return setError("Incorrect OTP. Please try again.");
    }
    setInfo("✅ OTP verified successfully!");
    setTimeout(() => {
      clearErrors();
      setScreen("profile-setup");
    }, 800);
  };

  // ── Profile setup ──
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Photo must be under 5MB.");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSetup = () => {
    clearErrors();
    if (!legalName.trim() || legalName.trim().split(" ").length < 2)
      return setError("Please enter your full legal name (first and last name).");
    if (!username.trim() || username.length < 3)
      return setError("Username must be at least 3 characters.");
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return setError("Username can only contain letters, numbers, and underscores.");
    setScreen("pin-setup");
  };

  // ── PIN setup ──
  const handlePinKey = (key: string) => {
    if (key === "⌫") {
      if (pinStep === "create") {
        setPin((p) => p.slice(0, -1));
      } else {
        setConfirmPin((p) => p.slice(0, -1));
      }
      return;
    }
    if (pinStep === "create") {
      const next = pin + key;
      setPin(next);
      if (next.length === 6) {
        setTempPin(next);
        setPinStep("confirm");
        setPin("");
      }
    } else {
      const next = confirmPin + key;
      setConfirmPin(next);
      if (next.length === 6) {
        if (next !== tempPin) {
          setError("PINs do not match. Please try again.");
          setConfirmPin("");
          setPin("");
          setPinStep("create");
          setTempPin("");
        } else {
          finishRegistration(next);
        }
      }
    }
  };

  const finishRegistration = async (finalPin: string) => {
    setLoading(true);
    try {
      const hashed = await hashPin(finalPin);
      const now = new Date().toISOString();
      const sessionToken = generateToken(64);
      const refreshToken = generateToken(128);

      const identifier = usePhone ? phone : email;
      const newProfile: UserProfile = {
        email: identifier,
        username: username.trim().toLowerCase(),
        legalName: legalName.trim(),
        phone: usePhone ? phone : "",
        profilePhoto,
        verifiedAt: now,
        deviceFingerprint: deviceFp,
        sessionToken,
        refreshToken,
        pinHash: hashed,
        biometricEnabled: false,
        otpVerified: true,
      };

      saveSession(newProfile);
      setProfile(newProfile);
      clearErrors();
      setScreen("dashboard");
    } catch {
      setError("Failed to complete registration.");
    } finally {
      setLoading(false);
    }
  };

  // ── Login flow ──
  const handleLogin = async () => {
    clearErrors();
    const identifier = usePhone ? phone : email;
    if (!identifier) return setError("Please enter your email or phone.");
    if (!password) return setError("Please enter your password.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email: identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Invalid credentials.");
      } else {
        sendOtp();
        setScreen("login-otp");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginOtpVerify = () => {
    clearErrors();
    const entered = otp.join("");
    if (entered !== generatedOtp) return setError("Incorrect OTP.");

    // Restore session from storage
    const existing = loadSession();
    if (existing) {
      // Refresh session token
      const refreshed = {
        ...existing,
        sessionToken: generateToken(64),
      };
      saveSession(refreshed);
      setProfile(refreshed);
      setScreen("pin-lock");
    } else {
      setError("Session not found. Please sign up.");
    }
  };

  // ── PIN lock ──
  const handleLockPin = async (key: string) => {
    clearErrors();
    if (key === "⌫") {
      setLockPin((p) => p.slice(0, -1));
      return;
    }
    const next = lockPin + key;
    setLockPin(next);
    if (next.length === 6) {
      const hashed = await hashPin(next);
      if (profile && hashed === profile.pinHash) {
        setLockAttempts(0);
        setLockPin("");
        localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: false, ts: Date.now() }));
        setScreen("dashboard");
      } else {
        const attempts = lockAttempts + 1;
        setLockAttempts(attempts);
        setLockPin("");
        if (attempts >= 5) {
          clearSession();
          setProfile(null);
          setScreen("welcome");
          setError("Too many failed attempts. Please log in again.");
        } else {
          setError(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
        }
      }
    }
  };

  const handleLogout = () => {
    clearSession();
    setProfile(null);
    setEmail("");
    setPhone("");
    setPassword("");
    setLegalName("");
    setUsername("");
    setProfilePhoto("");
    setOtp(["", "", "", "", "", ""]);
    setPin("");
    setConfirmPin("");
    setPinStep("create");
    setTempPin("");
    setLockPin("");
    setScreen("welcome");
  };

  // ── OTP input handling ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ─── SCREENS ───────────────────────────────────────────────────────────────

  // Splash
  if (screen === "splash") {
    return (
      <div style={{ ...S.app, flexDirection: "column", gap: 16 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 22,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            animation: "pulse 1.5s infinite",
          }}
        >
          🔐
        </div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0 }}>
          Confi
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, fontSize: 15 }}>
          Confidential Messaging
        </p>
      </div>
    );
  }

  // Welcome
  if (screen === "welcome") {
    return (
      <div style={S.app}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>🔐</div>
          </div>
          <h1 style={S.title}>Welcome to Confi</h1>
          <p style={S.subtitle}>
            Secure messaging with legally-binding confidentiality agreements.
            Every conversation protected by international NDA law.
          </p>
          <div style={S.ndaBanner}>
            🛡️ By creating an account, your verified identity will be used to
            enforce confidentiality agreements under international law. Your
            legal name and verification timestamp are captured for NDA
            enforceability.
          </div>
          <button style={S.btn} onClick={() => { clearErrors(); setScreen("signup"); }}>
            Create Account
          </button>
          <button style={S.btnSecondary} onClick={() => { clearErrors(); setScreen("login"); }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Sign Up
  if (screen === "signup") {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>✉️</div>
          </div>
          <h2 style={S.title}>Create Account</h2>
          <p style={S.subtitle}>We&apos;ll verify your identity with an OTP.</p>

          {error && <div style={S.error}>{error}</div>}
          {info && <div style={S.success}>{info}</div>}

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              style={{
                ...S.btnSecondary,
                width: "auto",
                flex: 1,
                marginTop: 0,
                background: !usePhone ? "rgba(124,58,237,0.3)" : "transparent",
                border: !usePhone ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.2)",
                fontSize: 13,
                padding: "10px",
              }}
              onClick={() => setUsePhone(false)}
            >
              📧 Email
            </button>
            <button
              style={{
                ...S.btnSecondary,
                width: "auto",
                flex: 1,
                marginTop: 0,
                background: usePhone ? "rgba(124,58,237,0.3)" : "transparent",
                border: usePhone ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.2)",
                fontSize: 13,
                padding: "10px",
              }}
              onClick={() => setUsePhone(true)}
            >
              📱 Phone
            </button>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{usePhone ? "Phone Number" : "Email Address"}</label>
            <input
              style={S.input}
              type={usePhone ? "tel" : "email"}
              placeholder={usePhone ? "+1 555 000 0000" : "you@example.com"}
              value={usePhone ? phone : email}
              onChange={(e) => usePhone ? setPhone(e.target.value) : setEmail(e.target.value)}
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
            />
          </div>

          <button style={S.btn} onClick={handleSignup} disabled={loading}>
            {loading ? "Creating account…" : "Send OTP & Continue"}
          </button>
          <button style={S.btnSecondary} onClick={() => { clearErrors(); setScreen("welcome"); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // OTP Verification (signup)
  if (screen === "otp" || screen === "login-otp") {
    const isLogin = screen === "login-otp";
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>🔢</div>
          </div>
          <h2 style={S.title}>Verify OTP</h2>
          <p style={S.subtitle}>
            Enter the 6-digit code sent to{" "}
            <strong style={{ color: "#a78bfa" }}>
              {usePhone ? phone : email}
            </strong>
          </p>

          {error && <div style={S.error}>{error}</div>}
          {info && <div style={S.success}>{info}</div>}

          <div style={S.otpGrid}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                style={S.otpBox}
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                inputMode="numeric"
              />
            ))}
          </div>

          <button
            style={S.btn}
            onClick={isLogin ? handleLoginOtpVerify : handleVerifyOtp}
          >
            Verify Code
          </button>
          <button
            style={S.btnSecondary}
            onClick={() => {
              sendOtp();
              setError("");
            }}
          >
            Resend OTP
          </button>
          <button
            style={S.btnSecondary}
            onClick={() => { clearErrors(); setScreen(isLogin ? "login" : "signup"); }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Profile Setup
  if (screen === "profile-setup") {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <h2 style={S.title}>Complete Your Profile</h2>
          <p style={S.subtitle}>
            Your legal name is required for NDA enforceability under
            international law.
          </p>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.avatarWrap}>
            <div style={S.avatar} onClick={() => photoInputRef.current?.click()}>
              {profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhoto}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                "👤"
              )}
            </div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              Tap to upload photo
            </span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoUpload}
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>
              Legal Full Name <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              style={S.input}
              type="text"
              placeholder="First Middle Last (as on ID)"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4, display: "block" }}>
              ⚖️ Required for legally binding NDA contracts
            </span>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Username</label>
            <input
              style={S.input}
              type="text"
              placeholder="e.g. john_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </div>

          <button style={S.btn} onClick={handleProfileSetup}>
            Continue to PIN Setup
          </button>
        </div>
      </div>
    );
  }

  // PIN Setup
  if (screen === "pin-setup") {
    const currentPin = pinStep === "create" ? pin : confirmPin;
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>🔑</div>
          </div>
          <h2 style={S.title}>
            {pinStep === "create" ? "Create PIN" : "Confirm PIN"}
          </h2>
          <p style={S.subtitle}>
            {pinStep === "create"
              ? "Choose a 6-digit PIN to lock your app."
              : "Re-enter your PIN to confirm."}
          </p>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.pinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i < currentPin.length ? "#7c3aed" : "rgba(255,255,255,0.2)",
                  transition: "background 0.15s",
                }}
              />
            ))}
          </div>

          <div style={S.pinGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
              (key, i) => (
                <button
                  key={i}
                  style={{
                    ...S.pinKey,
                    visibility: key === "" ? "hidden" : "visible",
                    background: key === "⌫" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                  }}
                  onClick={() => key && handlePinKey(key)}
                  disabled={loading}
                >
                  {key}
                </button>
              )
            )}
          </div>
          {loading && (
            <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: 13 }}>
              Setting up your account…
            </p>
          )}
        </div>
      </div>
    );
  }

  // Login
  if (screen === "login") {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>🔐</div>
          </div>
          <h2 style={S.title}>Welcome Back</h2>
          <p style={S.subtitle}>Sign in to your Confi account.</p>

          {error && <div style={S.error}>{error}</div>}
          {info && <div style={S.success}>{info}</div>}

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              style={{
                ...S.btnSecondary,
                width: "auto",
                flex: 1,
                marginTop: 0,
                background: !usePhone ? "rgba(124,58,237,0.3)" : "transparent",
                border: !usePhone ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.2)",
                fontSize: 13,
                padding: "10px",
              }}
              onClick={() => setUsePhone(false)}
            >
              📧 Email
            </button>
            <button
              style={{
                ...S.btnSecondary,
                width: "auto",
                flex: 1,
                marginTop: 0,
                background: usePhone ? "rgba(124,58,237,0.3)" : "transparent",
                border: usePhone ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.2)",
                fontSize: 13,
                padding: "10px",
              }}
              onClick={() => setUsePhone(true)}
            >
              📱 Phone
            </button>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>{usePhone ? "Phone Number" : "Email Address"}</label>
            <input
              style={S.input}
              type={usePhone ? "tel" : "email"}
              placeholder={usePhone ? "+1 555 000 0000" : "you@example.com"}
              value={usePhone ? phone : email}
              onChange={(e) => usePhone ? setPhone(e.target.value) : setEmail(e.target.value)}
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button style={S.btn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Send OTP & Sign In"}
          </button>
          <button style={S.btnSecondary} onClick={() => { clearErrors(); setScreen("welcome"); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // PIN Lock Screen
  if (screen === "pin-lock") {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>🔒</div>
          </div>
          <h2 style={S.title}>App Locked</h2>
          <p style={S.subtitle}>
            Enter your 6-digit PIN to unlock Confi.
          </p>

          {error && <div style={S.error}>{error}</div>}

          {profile?.profilePhoto ? (
            <div style={S.avatarWrap}>
              <div style={{ ...S.avatar, cursor: "default" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.profilePhoto}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                @{profile.username}
              </span>
            </div>
          ) : (
            profile && (
              <div style={S.avatarWrap}>
                <div style={{ ...S.avatar, cursor: "default", fontSize: 28 }}>
                  {profile.legalName?.charAt(0) || "?"}
                </div>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                  @{profile.username}
                </span>
              </div>
            )
          )}

          <div style={S.pinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: i < lockPin.length ? "#7c3aed" : "rgba(255,255,255,0.2)",
                  transition: "background 0.15s",
                }}
              />
            ))}
          </div>

          <div style={S.pinGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
              (key, i) => (
                <button
                  key={i}
                  style={{
                    ...S.pinKey,
                    visibility: key === "" ? "hidden" : "visible",
                    background: key === "⌫" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                  }}
                  onClick={() => key && handleLockPin(key)}
                >
                  {key}
                </button>
              )
            )}
          </div>

          <button
            style={{ ...S.btnSecondary, marginTop: 8 }}
            onClick={handleLogout}
          >
            Sign Out Instead
          </button>
        </div>
      </div>
    );
  }

  // Dashboard
  if (screen === "dashboard" && profile) {
    return (
      <div style={S.app}>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.2)",
                  flexShrink: 0,
                }}
              >
                {profile.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profilePhoto}
                    alt="Profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  profile.legalName?.charAt(0) || "?"
                )}
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: 600, margin: 0, fontSize: 16 }}>
                  {profile.legalName}
                </p>
                <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 13 }}>
                  @{profile.username}
                </p>
              </div>
            </div>
            <button
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                color: "#fca5a5",
                fontSize: 12,
                cursor: "pointer",
                padding: "6px 12px",
              }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>

          <div style={S.badge}>
            <span>✅</span> Identity Verified
          </div>

          <div
            style={{
              marginTop: 20,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            {[
              { icon: "⚖️", label: "Legal Name", value: profile.legalName },
              { icon: "📧", label: "Account", value: profile.email },
              { icon: "👤", label: "Username", value: `@${profile.username}` },
              {
                icon: "🕐",
                label: "Verified At",
                value: new Date(profile.verifiedAt).toLocaleString(),
              },
              {
                icon: "📱",
                label: "Device ID",
                value: profile.deviceFingerprint.slice(0, 16) + "…",
              },
              {
                icon: "🔑",
                label: "Session",
                value: profile.sessionToken.slice(0, 16) + "…",
              },
              { icon: "🔒", label: "OTP Verified", value: "Yes" },
              { icon: "🌐", label: "NDA Status", value: "Active — International" },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                  {row.icon} {row.label}
                </span>
                <span
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 500,
                    maxWidth: "55%",
                    textAlign: "right",
                    wordBreak: "break-all",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ ...S.ndaBanner, marginTop: 20, marginBottom: 0 }}>
            🛡️ Your identity metadata is stored securely and will be used to
            generate legally binding NDA contracts. All confidential conversations
            are protected under international confidentiality law with your
            verified legal name: <strong>{profile.legalName}</strong>.
          </div>
        </div>
      </div>
    );
  }

  return null;
}