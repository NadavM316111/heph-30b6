"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

type AuthMode = "signup" | "login";

interface UserSession {
  email: string;
  displayName: string;
  avatar: string;
  phone: string;
  createdAt: string;
  sessionToken: string;
  pinHash: string | null;
}

interface OtpState {
  code: string;
  expiresAt: number;
  contact: string;
  type: "email" | "phone";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPin(pin: string): string {
  // Simple deterministic hash for PIN (no bcrypt in browser; server handles real hashing)
  let hash = 0;
  const salted = `confi_pin_salt_${pin}_2024`;
  for (let i = 0; i < salted.length; i++) {
    const chr = salted.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `pin_${Math.abs(hash).toString(36)}_${pin.length}`;
}

function verifyPin(pin: string, stored: string): boolean {
  return hashPin(pin) === stored;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

const AVATARS = [
  "🦊","🐺","🦁","🐯","🐻","🐼","🦅","🦋","🐬","🦄",
  "🌟","🔥","💎","🌙","⚡","🎭","🛡️","🗝️","🌊","🎯",
];

const COUNTRIES = [
  { code: "+1", name: "US/CA" },
  { code: "+44", name: "UK" },
  { code: "+91", name: "IN" },
  { code: "+49", name: "DE" },
  { code: "+33", name: "FR" },
  { code: "+81", name: "JP" },
  { code: "+86", name: "CN" },
  { code: "+55", name: "BR" },
  { code: "+234", name: "NG" },
  { code: "+27", name: "ZA" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 24, height: 24, border: "3px solid rgba(255,255,255,0.3)",
      borderTop: "3px solid #fff", borderRadius: "50%",
      animation: "spin 0.8s linear infinite", display: "inline-block"
    }} />
  );
}

function OtpInput({
  value, onChange, length = 6
}: { value: string; onChange: (v: string) => void; length?: number }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = value.split("");
    arr[i] = v;
    const next = arr.join("").slice(0, length);
    onChange(next);
    if (v && i < length - 1) inputs.current[i + 1]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          style={{
            width: 46, height: 56, textAlign: "center", fontSize: 24,
            fontWeight: 700, border: "2px solid",
            borderColor: value[i] ? "#00c896" : "rgba(255,255,255,0.2)",
            borderRadius: 12, background: "rgba(255,255,255,0.05)",
            color: "#fff", outline: "none", transition: "border-color 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function PinPad({
  value, onChange, maxLen = 6
}: { value: string; onChange: (v: string) => void; maxLen?: number }) {
  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 280, margin: "0 auto" }}>
      {digits.map((d, i) => (
        <button
          key={i}
          onClick={() => {
            if (d === "⌫") onChange(value.slice(0, -1));
            else if (d && value.length < maxLen) onChange(value + d);
          }}
          style={{
            height: 72, borderRadius: 16, fontSize: d === "⌫" ? 22 : 28,
            fontWeight: 600, border: "none", cursor: d ? "pointer" : "default",
            background: d ? "rgba(255,255,255,0.08)" : "transparent",
            color: d === "⌫" ? "#ff6b6b" : "#fff",
            transition: "background 0.15s", opacity: d ? 1 : 0,
          }}
          onMouseDown={(e) => { (e.currentTarget.style.background = "rgba(0,200,150,0.2)"); }}
          onMouseUp={(e) => { (e.currentTarget.style.background = "rgba(255,255,255,0.08)"); }}
        />
      ))}
    </div>
  );
}

function PinDots({ value, max = 6 }: { value: string; max?: number }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "24px 0" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 16, height: 16, borderRadius: "50%",
          background: i < value.length ? "#00c896" : "rgba(255,255,255,0.2)",
          transition: "background 0.15s, transform 0.1s",
          transform: i === value.length - 1 ? "scale(1.3)" : "scale(1)",
        }} />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");

  // OTP
  const [otpValue, setOtpValue] = useState("");
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpTarget, setOtpTarget] = useState<"email" | "phone">("email");
  const [pendingAuthMode, setPendingAuthMode] = useState<AuthMode>("signup");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

  // PIN
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [pinError, setPinError] = useState("");
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinLockUntil, setPinLockUntil] = useState(0);
  const [useBiometric, setUseBiometric] = useState(false);

  // Session
  const [session, setSession] = useState<UserSession | null>(null);

  // Track analytics on load
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Splash → check session
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = localStorage.getItem("confi_session");
      if (stored) {
        try {
          const parsed: UserSession = JSON.parse(stored);
          setSession(parsed);
          if (parsed.pinHash) {
            setScreen("pin-lock");
          } else {
            setScreen("home");
          }
        } catch {
          setScreen("welcome");
        }
      } else {
        setScreen("welcome");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // OTP countdown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [otpCooldown]);

  // PIN lock timer
  useEffect(() => {
    if (pinLockUntil <= 0) return;
    const t = setInterval(() => {
      if (Date.now() > pinLockUntil) {
        setPinLocked(false);
        setPinLockUntil(0);
        setPinAttempts(0);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [pinLockUntil]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // ── Send OTP (simulated — real SMS requires a key we don't have) ──
  const sendOtp = useCallback((target: "email" | "phone", mode: AuthMode) => {
    const code = generateOtp();
    const contact = target === "email" ? email : `${countryCode}${phone}`;
    const otp: OtpState = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      contact,
      type: target,
    };
    setOtpState(otp);
    setOtpTarget(target);
    setPendingAuthMode(mode);
    setOtpCooldown(60);
    setOtpValue("");
    // In production this would be sent via server. We display it in toast for demo.
    showToast(`OTP for ${contact}: ${code} (expires 5 min)`);
    setScreen("otp");
  }, [email, phone, countryCode, showToast]);

  // ── Handle Auth Submit ──
  const handleAuth = useCallback(async (mode: AuthMode) => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!phone) { setError("Phone number is required."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }
      // Auth passed — verify identity via OTP
      sendOtp("email", mode);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, phone, sendOtp]);

  // ── Verify OTP ──
  const verifyOtp = useCallback(() => {
    if (!otpState) return;
    if (Date.now() > otpState.expiresAt) {
      setError("OTP expired. Please request a new one.");
      return;
    }
    if (otpValue !== otpState.code) {
      setError("Incorrect OTP. Please try again.");
      return;
    }
    setError("");
    // OTP verified — proceed
    if (pendingAuthMode === "signup") {
      setScreen("profile");
    } else {
      // Login: restore profile if exists
      const stored = localStorage.getItem("confi_session");
      if (stored) {
        const parsed: UserSession = JSON.parse(stored);
        const newSession: UserSession = {
          ...parsed,
          sessionToken: generateToken(),
        };
        setSession(newSession);
        localStorage.setItem("confi_session", JSON.stringify(newSession));
        if (parsed.pinHash) {
          setScreen("pin-lock");
        } else {
          setScreen("home");
        }
      } else {
        setScreen("profile");
      }
    }
  }, [otpState, otpValue, pendingAuthMode]);

  // ── Save Profile ──
  const saveProfile = useCallback(() => {
    if (!displayName.trim()) { setError("Display name is required."); return; }
    setError("");
    const newSession: UserSession = {
      email,
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      phone: `${countryCode}${phone}`,
      createdAt: new Date().toISOString(),
      sessionToken: generateToken(),
      pinHash: null,
    };
    setSession(newSession);
    localStorage.setItem("confi_session", JSON.stringify(newSession));
    setScreen("pin-setup");
  }, [displayName, selectedAvatar, email, phone, countryCode]);

  // ── Setup PIN ──
  const handlePinSetup = useCallback(() => {
    if (pinStep === "enter") {
      if (pinValue.length < 4) { setPinError("PIN must be at least 4 digits."); return; }
      setPinError("");
      setPinStep("confirm");
      setPinConfirm(pinValue);
      setPinValue("");
    } else {
      if (pinValue !== pinConfirm) {
        setPinError("PINs do not match. Try again.");
        setPinStep("enter");
        setPinValue("");
        setPinConfirm("");
        return;
      }
      const hash = hashPin(pinValue);
      const updated = { ...session!, pinHash: hash };
      setSession(updated);
      localStorage.setItem("confi_session", JSON.stringify(updated));
      setPinValue("");
      setPinStep("enter");
      showToast("PIN set successfully!");
      setScreen("home");
    }
  }, [pinStep, pinValue, pinConfirm, session, showToast]);

  // ── Skip PIN ──
  const skipPin = useCallback(() => {
    showToast("You can set a PIN anytime from settings.");
    setScreen("home");
  }, [showToast]);

  // ── Verify PIN lock ──
  const verifyPinLock = useCallback(() => {
    if (pinLocked) return;
    if (!session?.pinHash) { setScreen("home"); return; }
    if (verifyPin(pinValue, session.pinHash)) {
      setPinAttempts(0);
      setPinValue("");
      setScreen("home");
    } else {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      setPinValue("");
      if (attempts >= 5) {
        setPinLocked(true);
        const until = Date.now() + 30000;
        setPinLockUntil(until);
        setPinError("Too many attempts. Locked for 30 seconds.");
      } else {
        setPinError(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
      }
    }
  }, [pinValue, session, pinAttempts, pinLocked]);

  // ── Logout ──
  const logout = useCallback(() => {
    localStorage.removeItem("confi_session");
    setSession(null);
    setEmail(""); setPassword(""); setPhone("");
    setDisplayName(""); setPinValue(""); setPinConfirm("");
    setPinStep("enter"); setOtpValue(""); setOtpState(null);
    setPinAttempts(0); setPinLocked(false);
    setScreen("welcome");
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // ── RENDER ──
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg,#0a0f1e 0%,#0d1a2d 50%,#061218 100%)",
      color: "#fff", fontFamily: "'Inter',system-ui,sans-serif", position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div style={{
        position: "fixed", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(0,200,150,0.08) 0%,transparent 70%)",
        top: -100, right: -100, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(100,100,255,0.06) 0%,transparent 70%)",
        bottom: -50, left: -50, pointerEvents: "none",
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,200,150,0.95)", color: "#000", padding: "12px 24px",
          borderRadius: 40, fontWeight: 600, fontSize: 13, zIndex: 1000,
          boxShadow: "0 8px 32px rgba(0,200,150,0.3)", maxWidth: "90vw", textAlign: "center",
          animation: "fadeIn 0.3s ease",
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── SPLASH ── */}
        {screen === "splash" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ fontSize: 80, animation: "pulse 2s ease-in-out infinite" }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
                Confi
              </h1>
              <p style={{ margin: "4px 0 0", color: "#00c896", fontSize: 14, letterSpacing: 3, textTransform: "uppercase" }}>
                Confidential Messaging
              </p>
            </div>
            <div style={{ marginTop: 40 }}>
              <Spinner />
            </div>
          </div>
        )}

        {/* ── WELCOME ── */}
        {screen === "welcome" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>🛡️</div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
                Welcome to Confi
              </h1>
              <p style={{ marginTop: 12, color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.6 }}>
                Secure messaging with legally-binding confidentiality. Your identity. Your terms.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
              {[
                { icon: "🔐", label: "End-to-end encrypted" },
                { icon: "⚖️", label: "International NDA protection" },
                { icon: "🪪", label: "Verified identity required" },
                { icon: "🔑", label: "Biometric / PIN security" },
              ].map((f) => (
                <div key={f.label} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px", borderRadius: 14,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <span style={{ fontSize: 22 }}>{f.icon}</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{f.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
              <button onClick={() => { setAuthMode("signup"); setScreen("signup"); }} style={btnPrimary}>
                Create Account
              </button>
              <button onClick={() => { setAuthMode("login"); setScreen("login"); }} style={btnSecondary}>
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* ── SIGNUP / LOGIN ── */}
        {(screen === "signup" || screen === "login") && (
          <div style={{ flex: 1, padding: "60px 24px 40px" }}>
            <button onClick={() => setScreen("welcome")} style={backBtn}>← Back</button>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>
              {screen === "signup" ? "Create Account" : "Welcome Back"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 32px" }}>
              {screen === "signup"
                ? "Join Confi — your verified identity is your security."
                : "Sign in to your secure Confi account."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Email */}
              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>Password {screen === "signup" && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>(min 8 chars)</span>}</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Secure password"
                    style={{ ...inputStyle, paddingRight: 50 }}
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "rgba(255,255,255,0.5)",
                    }}
                  >{showPass ? "🙈" : "👁️"}</button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={labelStyle}>Phone Number <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>(for OTP)</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={{ ...inputStyle, width: 90, flex: "none", paddingLeft: 8 }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} {c.name}</option>
                    ))}
                  </select>
                  <input
                    type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="Phone number"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <button
                onClick={() => handleAuth(screen === "signup" ? "signup" : "login")}
                disabled={loading}
                style={{ ...btnPrimary, marginTop: 8 }}
              >
                {loading ? <Spinner /> : screen === "signup" ? "Continue with OTP →" : "Sign In with OTP →"}
              </button>

              <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                {screen === "signup" ? "Already have an account? " : "Need an account? "}
                <button
                  onClick={() => { setError(""); setScreen(screen === "signup" ? "login" : "signup"); }}
                  style={{ background: "none", border: "none", color: "#00c896", cursor: "pointer", fontSize: 13 }}
                >
                  {screen === "signup" ? "Sign In" : "Sign Up"}
                </button>
              </p>

              <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
                By continuing, you agree to Confi&apos;s Terms of Service and Privacy Policy. Your credentials are securely hashed and never stored in plain text.
              </p>
            </div>
          </div>
        )}

        {/* ── OTP VERIFICATION ── */}
        {screen === "otp" && (
          <div style={{ flex: 1, padding: "60px 24px 40px" }}>
            <button onClick={() => setScreen(pendingAuthMode === "signup" ? "signup" : "login")} style={backBtn}>← Back</button>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>
                {otpTarget === "email" ? "📧" : "📱"}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Verify Your Identity</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                A 6-digit code was sent to<br />
                <strong style={{ color: "#00c896" }}>{otpState?.contact}</strong>
              </p>
              {otpState && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                  background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.3)",
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, color: "#ffb347",
                }}>
                  ⏱ Expires in {Math.max(0, Math.floor((otpState.expiresAt - Date.now()) / 1000))}s
                </div>
              )}
            </div>

            <OtpInput value={otpValue} onChange={setOtpValue} />

            {error && <div style={{ marginTop: 16 }}><ErrorBox msg={error} /></div>}

            <button
              onClick={verifyOtp}
              disabled={otpValue.length < 6}
              style={{ ...btnPrimary, marginTop: 32, opacity: otpValue.length < 6 ? 0.5 : 1 }}
            >
              Verify & Continue
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Didn&apos;t receive a code?</p>
              <button
                onClick={() => sendOtp(otpTarget, pendingAuthMode)}
                disabled={otpCooldown > 0}
                style={{
                  background: "none", border: "none", cursor: otpCooldown > 0 ? "default" : "pointer",
                  color: otpCooldown > 0 ? "rgba(255,255,255,0.3)" : "#00c896", fontSize: 14, fontWeight: 600,
                }}
              >
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend Code"}
              </button>
            </div>

            <div style={{
              marginTop: 24, padding: "12px 16px", borderRadius: 12,
              background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)",
              fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.6,
            }}>
              🔒 This OTP verifies your identity before any confidentiality agreement can be created under your name.
            </div>
          </div>
        )}

        {/* ── PROFILE CREATION ── */}
        {screen === "profile" && (
          <div style={{ flex: 1, padding: "60px 24px 40px" }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>Create Your Profile</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 32px" }}>
              This identity will be associated with all your confidential agreements.
            </p>

            {/* Avatar selection */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ ...labelStyle, marginBottom: 12, display: "block" }}>Choose Avatar</label>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", fontSize: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg,rgba(0,200,150,0.2),rgba(100,100,255,0.2))",
                  border: "3px solid #00c896", margin: "0 auto",
                }}>
                  {selectedAvatar}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    style={{
                      height: 52, borderRadius: 12, fontSize: 26, border: "2px solid",
                      borderColor: selectedAvatar === av ? "#00c896" : "rgba(255,255,255,0.1)",
                      background: selectedAvatar === av ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.04)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >{av}</button>
                ))}
              </div>
            </div>

            {/* Display name */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Display Name <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>(visible to others)</span></label>
              <input
                type="text" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or alias"
                maxLength={32}
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
                {displayName.length}/32 — this name will appear on confidentiality agreements
              </p>
            </div>

            {/* Identity summary */}
            <div style={{
              padding: "14px 18px", borderRadius: 14,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 20, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.8,
            }}>
              <div>📧 <strong style={{ color: "#fff" }}>{email}</strong></div>
              <div>📱 <strong style={{ color: "#fff" }}>{countryCode}{phone}</strong></div>
              <div>✅ <span style={{ color: "#00c896" }}>Identity verified via OTP</span></div>
            </div>

            {error && <ErrorBox msg={error} />}

            <button onClick={saveProfile} style={btnPrimary}>
              Save Profile & Continue →
            </button>
          </div>
        )}

        {/* ── PIN SETUP ── */}
        {screen === "pin-setup" && (
          <div style={{ flex: 1, padding: "60px 24px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>
              {pinStep === "enter" ? "🔐" : "✅"}
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              {pinStep === "enter" ? "Set App PIN" : "Confirm PIN"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 8, marginBottom: 0 }}>
              {pinStep === "enter"
                ? "This PIN protects your app and conversations."
                : "Enter the same PIN again to confirm."}
            </p>

            <PinDots value={pinValue} max={6} />
            <PinPad value={pinValue} onChange={setPinValue} maxLen={6} />

            {pinError && <div style={{ marginTop: 12 }}><ErrorBox msg={pinError} /></div>}

            <button
              onClick={handlePinSetup}
              disabled={pinValue.length < 4}
              style={{ ...btnPrimary, marginTop: 24, opacity: pinValue.length < 4 ? 0.5 : 1 }}
            >
              {pinStep === "enter" ? "Next →" : "Confirm PIN"}
            </button>

            <button onClick={skipPin} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.4)",
              cursor: "pointer", fontSize: 13, marginTop: 16, display: "block", width: "100%",
            }}>
              Skip for now
            </button>

            <div style={{
              marginTop: 20, padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.2)",
              fontSize: 11, color: "rgba(255,200,100,0.7)", lineHeight: 1.6,
            }}>
              ⚠️ You&apos;ll need this PIN every time you open Confi. Store it safely.
            </div>
          </div>
        )}

        {/* ── PIN LOCK ── */}
        {screen === "pin-lock" && (
          <div style={{ flex: 1, padding: "60px 24px 40px", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", fontSize: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,rgba(0,200,150,0.2),rgba(100,100,255,0.2))",
              border: "3px solid #00c896", margin: "0 auto 16px",
            }}>
              {session?.avatar || "🛡️"}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              {session?.displayName || "Welcome back"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Enter your PIN to unlock Confi
            </p>

            {pinLocked ? (
              <div style={{ marginTop: 40, padding: "20px", borderRadius: 14, background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)" }}>
                <div style={{ fontSize: 36 }}>🚫</div>
                <p style={{ color: "#ff6b6b", marginTop: 8, fontSize: 14 }}>
                  Too many failed attempts.<br />
                  Locked for {Math.max(0, Math.ceil((pinLockUntil - Date.now()) / 1000))} seconds.
                </p>
              </div>
            ) : (
              <>
                <PinDots value={pinValue} max={6} />
                <PinPad value={pinValue} onChange={setPinValue} maxLen={6} />

                {pinError && <div style={{ marginTop: 12 }}><ErrorBox msg={pinError} /></div>}

                <button
                  onClick={verifyPinLock}
                  disabled={pinValue.length < 4}
                  style={{ ...btnPrimary, marginTop: 24, opacity: pinValue.length < 4 ? 0.5 : 1 }}
                >
                  Unlock →
                </button>
              </>
            )}

            <button onClick={logout} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.3)",
              cursor: "pointer", fontSize: 12, marginTop: 24, display: "block", width: "100%",
            }}>
              Not you? Sign out
            </button>
          </div>
        )}

        {/* ── HOME ── */}
        {screen === "home" && session && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)",
              position: "sticky", top: 0, zIndex: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 32 }}>{session.avatar}</div>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Confi</h1>
                    <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      Confidential Messaging
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#00c896",
                    boxShadow: "0 0 8px #00c896", marginTop: 4,
                  }} />
                </div>
              </div>
            </div>

            {/* Identity Card */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{
                background: "linear-gradient(135deg,rgba(0,200,150,0.12),rgba(100,100,255,0.08))",
                border: "1px solid rgba(0,200,150,0.2)", borderRadius: 20, padding: "20px 24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%", fontSize: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,200,150,0.15)", border: "2px solid #00c896",
                  }}>
                    {session.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{session.displayName}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{session.email}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{session.phone}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { icon: "✅", label: "Identity Verified" },
                    { icon: "🔐", label: session.pinHash ? "PIN Active" : "No PIN" },
                    { icon: "⚖️", label: "NDA Ready" },
                  ].map((b) => (
                    <div key={b.label} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.25)",
                      color: "#00c896",
                    }}>
                      {b.icon} {b.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features teaser */}
            <div style={{ padding: "0 24px", flex: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", margin: "0 0 14px" }}>
                Your Secure Space
              </h3>
              {[
                { icon: "💬", title: "Confidential Chats", desc: "Start a legally-protected conversation", badge: "Coming soon", color: "#00c896" },
                { icon: "📜", title: "Active NDAs", desc: "View your confidentiality agreements", badge: "0 active", color: "#6464ff" },
                { icon: "🔍", title: "Find People", desc: "Search verified Confi users", badge: "Soon", color: "#ff9500" },
                { icon: "⚙️", title: "Security Settings", desc: "Manage PIN, biometrics & sessions", badge: null, color: "#ff6b6b" },
              ].map((item) => (
                <div key={item.title} style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                  borderRadius: 16, marginBottom: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer", transition: "background 0.15s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget.style.background = "rgba(255,255,255,0.07)"); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.background = "rgba(255,255,255,0.03)"); }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, fontSize: 22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${item.color}18`, border: `1px solid ${item.color}30`,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{item.desc}</div>
                  </div>
                  {item.badge && (
                    <div style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${item.color}18`, color: item.color, border: `1px solid ${item.color}30`,
                    }}>
                      {item.badge}
                    </div>
                  )}
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>›</div>
                </div>
              ))}
            </div>

            {/* Session info */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{
                padding: "12px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)", fontSize: 11, color: "rgba(255,255,255,0.3)",
                lineHeight: 1.8,
              }}>
                <div>🕐 Session started: {timeAgo(new Date(session.createdAt).getTime())}</div>
                <div>🔑 Token: {session.sessionToken.slice(0, 8)}…{session.sessionToken.slice(-8)}</div>
                <div>📱 {session.phone}</div>
              </div>
              <button onClick={logout} style={{ ...btnSecondary, marginTop: 12, fontSize: 14 }}>
                Sign Out
              </button>
              {!session.pinHash && (
                <button
                  onClick={() => { setPinStep("enter"); setPinValue(""); setPinError(""); setScreen("pin-setup"); }}
                  style={{ ...btnPrimary, marginTop: 8, fontSize: 14 }}
                >
                  🔐 Set PIN Lock
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Shared style objects ──────────────────────────────────────────────────────
function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: "12px 16px", borderRadius: 12,
      background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)",
      color: "#ff8080", fontSize: 13, lineHeight: 1.5,
    }}>
      ⚠️ {msg}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "16px", borderRadius: 14, border: "none",
  background: "linear-gradient(135deg,#00c896,#00a07a)", color: "#fff",
  fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", gap: 8,
  boxShadow: "0 4px 24px rgba(0,200,150,0.3)", transition: "opacity 0.2s",
};

const btnSecondary: React.CSSProperties = {
  width: "100%", padding: "14px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)",
  color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 15,
  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)",
  display: "block", marginBottom: 8,
};

const backBtn: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.5)",
  cursor: "pointer", fontSize: 14, padding: "0 0 20px", display: "block",
};