"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { COUNTRIES, Country } from "@/lib/countries";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "welcome"
  | "phone-entry"
  | "email-entry"
  | "otp-verification"
  | "profile-setup"
  | "home"
  | "settings";

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  legalName?: string;
  phone?: string;
  email?: string;
  profileComplete: boolean;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "confi_session";

function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiGet(path: string, token: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function apiPut(path: string, body: object, token: string) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Avatar generator ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = ["#7c5cfc", "#00d4aa", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b", "#cc5de8"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "linear-gradient(135deg, #7c5cfc, #00d4aa)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 800, color: "white",
      }}>C</div>
      <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Confi</span>
    </div>
  );
}

function Avatar({ name, url, size = 44 }: { name: string; url?: string; size?: number }) {
  const color = getAvatarColor(name || "User");
  const initials = getInitials(name || "U");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: url ? "transparent" : color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "white",
      overflow: "hidden", flexShrink: 0,
      border: "2px solid var(--border)",
    }}>
      {url ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function Button({
  children, onClick, variant = "primary", disabled = false, fullWidth = false, size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const base: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: "var(--radius)", fontWeight: 600, border: "none",
    transition: "all 0.2s ease", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? "100%" : "auto",
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "16px 32px" : "12px 24px",
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 15,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "white" },
    secondary: { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--text2)" },
    danger: { background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid var(--danger)" },
  };

  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text", prefix, error, hint, maxLength,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: React.ReactNode;
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>{label}</label>}
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface2)", borderRadius: "var(--radius-sm)",
        border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
        overflow: "hidden", transition: "border-color 0.2s",
      }}>
        {prefix && (
          <div style={{ padding: "0 12px", color: "var(--text2)", borderRight: "1px solid var(--border)", height: "100%", display: "flex", alignItems: "center" }}>
            {prefix}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            padding: "12px 14px", color: "var(--text)", fontSize: 15,
          }}
        />
      </div>
      {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: "var(--text3)" }}>{hint}</span>}
    </div>
  );
}

function OTPInput({ length = 6, value, onChange }: { length?: number; value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const arr = value.split("");
    arr[idx] = char;
    const newVal = arr.join("").slice(0, length);
    onChange(newVal);
    if (char && idx < length - 1) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      onChange(pasted);
      inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    }
    e.preventDefault();
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
          value={value[i] ?? ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          style={{
            width: 52, height: 60, textAlign: "center", fontSize: 24, fontWeight: 700,
            background: "var(--surface2)", border: `2px solid ${value[i] ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", color: "var(--text)", outline: "none",
            transition: "border-color 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Country Picker ───────────────────────────────────────────────────────────

function CountryPicker({ selected, onSelect }: { selected: Country; onSelect: (c: Country) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.dialCode.includes(search)
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "12px 14px",
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text)", cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 18 }}>{selected.flag}</span>
        <span style={{ color: "var(--text2)", fontSize: 14 }}>{selected.dialCode}</span>
        <span style={{ color: "var(--text3)", fontSize: 12 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
          width: 280, maxHeight: 320, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <input
              autoFocus
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "8px 12px", color: "var(--text)", outline: "none",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map((c) => (
              <button
                key={c.code}
                onClick={() => { onSelect(c); setOpen(false); setSearch(""); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: "transparent",
                  border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{c.name}</span>
                <span style={{ color: "var(--text3)", fontSize: 13 }}>{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function WelcomeScreen({ onPhone, onEmail }: { onPhone: () => void; onEmail: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, gap: 40, animation: "fadeIn 0.5s ease",
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: "linear-gradient(135deg, #7c5cfc, #00d4aa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, marginBottom: 8,
          boxShadow: "0 0 40px rgba(124,92,252,0.4)",
        }}>🔐</div>
        <Logo />
        <p style={{ color: "var(--text2)", maxWidth: 320, textAlign: "center", lineHeight: 1.7 }}>
          The only messaging app where your conversations are protected by a legally-binding international NDA.
        </p>
      </div>

      <div style={{
        width: "100%", maxWidth: 380, background: "var(--surface)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        padding: 32, display: "flex", flexDirection: "column", gap: 16,
        boxShadow: "var(--shadow)",
      }}>
        <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 700 }}>Get Started</h2>

        <Button onClick={onPhone} fullWidth size="lg">
          📱 Continue with Phone Number
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ color: "var(--text3)", fontSize: 13 }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <Button onClick={onEmail} fullWidth variant="secondary" size="lg">
          ✉️ Continue with Email
        </Button>

        <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", lineHeight: 1.6 }}>
          By continuing, you agree to Confi's Terms of Service and Privacy Policy. Phone verification ensures your identity for legally-binding NDA agreements.
        </p>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: "🔒", label: "End-to-End Encrypted" },
          { icon: "⚖️", label: "International NDA" },
          { icon: "🌍", label: "Global Legal Coverage" },
        ].map((f) => (
          <div key={f.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 24 }}>{f.icon}</span>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: Phone Entry ──────────────────────────────────────────────────────

function PhoneEntryScreen({
  onSent, onBack,
}: {
  onSent: (identifier: string, type: "phone" | "email", isNew: boolean, devOtp?: string) => void;
  onBack: () => void;
}) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fullPhone = country.dialCode + phone.replace(/\D/g, "");

  async function handleSend() {
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Ensure DB tables exist
      await apiPost("/api/identity/init", {});

      const res = await apiPost("/api/identity/send-otp", {
        phone: fullPhone,
        type: "phone",
      }) as { ok: boolean; isNewUser: boolean; devOtp?: string; error?: string };

      if (!res.ok) { setError(res.error ?? "Failed to send OTP"); return; }
      onSent(fullPhone, "phone", res.isNewUser, res.devOtp);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, animation: "fadeIn 0.4s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "var(--surface)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        padding: 32, display: "flex", flexDirection: "column", gap: 24,
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>←</button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Enter Your Phone</h2>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>We'll send you a 6-digit verification code</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <CountryPicker selected={country} onSelect={setCountry} />
          <input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{
              flex: 1, background: "var(--surface2)", border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)", padding: "12px 14px", color: "var(--text)", outline: "none", fontSize: 15,
            }}
          />
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <div style={{ background: "var(--accent-dim)", borderRadius: "var(--radius-sm)", padding: 14, border: "1px solid var(--accent)" }}>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            📋 <strong style={{ color: "var(--text)" }}>Legal Notice:</strong> Your phone number is required to legally bind you to NDA agreements. It will be encrypted and stored securely.
          </p>
        </div>

        <Button onClick={handleSend} disabled={loading || phone.length < 7} fullWidth size="lg">
          {loading ? <><div className="spinner" /> Sending...</> : "Send Verification Code"}
        </Button>
      </div>
    </div>
  );
}

// ─── Screen: Email Entry ──────────────────────────────────────────────────────

function EmailEntryScreen({
  onSent, onBack,
}: {
  onSent: (identifier: string, type: "phone" | "email", isNew: boolean, devOtp?: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!email.includes("@")) { setError("Please enter a valid email address"); return; }
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/identity/init", {});
      const res = await apiPost("/api/identity/send-otp", {
        email,
        type: "email",
      }) as { ok: boolean; isNewUser: boolean; devOtp?: string; error?: string };

      if (!res.ok) { setError(res.error ?? "Failed to send OTP"); return; }
      onSent(email, "email", res.isNewUser, res.devOtp);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, animation: "fadeIn 0.4s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "var(--surface)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        padding: 32, display: "flex", flexDirection: "column", gap: 24,
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>←</button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Enter Your Email</h2>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>Email fallback for verification</p>
          </div>
        </div>

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          error={error}
        />

        <Button onClick={handleSend} disabled={loading || !email.includes("@")} fullWidth size="lg">
          {loading ? <><div className="spinner" /> Sending...</> : "Send Verification Code"}
        </Button>
      </div>
    </div>
  );
}

// ─── Screen: OTP Verification ─────────────────────────────────────────────────

function OTPScreen({
  identifier, type, isNewUser, devOtp, onVerified, onBack,
}: {
  identifier: string;
  type: "phone" | "email";
  isNewUser: boolean;
  devOtp?: string;
  onVerified: (session: Session) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendCount]);

  // Auto-fill dev OTP
  useEffect(() => {
    if (devOtp) {
      setOtp(devOtp);
    }
  }, [devOtp]);

  async function handleVerify() {
    if (otp.length !== 6) { setError("Please enter the complete 6-digit code"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await apiPost("/api/identity/verify-otp", {
        otp, identifier, type,
      }) as {
        ok: boolean;
        accessToken?: string;
        refreshToken?: string;
        sessionId?: string;
        userId?: string;
        profileComplete?: boolean;
        displayName?: string;
        avatarUrl?: string;
        error?: string;
      };

      if (!res.ok) { setError(res.error ?? "Verification failed"); return; }

      const session: Session = {
        accessToken: res.accessToken!,
        refreshToken: res.refreshToken!,
        sessionId: res.sessionId!,
        userId: res.userId!,
        displayName: res.displayName,
        avatarUrl: res.avatarUrl,
        profileComplete: res.profileComplete ?? false,
        ...(type === "phone" ? { phone: identifier } : { email: identifier }),
      };

      saveSession(session);
      onVerified(session);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setError("");
    try {
      const body = type === "phone" ? { phone: identifier, type } : { email: identifier, type };
      const res = await apiPost("/api/identity/send-otp", body) as { ok: boolean; devOtp?: string; error?: string };
      if (res.ok) {
        setResendCount((c) => c + 1);
        setCountdown(60);
        setOtp("");
        if (res.devOtp) setOtp(res.devOtp);
      } else {
        setError(res.error ?? "Failed to resend");
      }
    } catch {
      setError("Network error");
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, animation: "fadeIn 0.4s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: "var(--surface)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        padding: 32, display: "flex", flexDirection: "column", gap: 28,
        boxShadow: "var(--shadow)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>←</button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Verify Your {type === "phone" ? "Phone" : "Email"}</h2>
            <p style={{ color: "var(--text3)", fontSize: 13 }}>
              Code sent to <strong style={{ color: "var(--text2)" }}>{identifier}</strong>
            </p>
          </div>
        </div>

        {devOtp && (
          <div style={{ background: "rgba(255,165,0,0.1)", border: "1px solid var(--warning)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <p style={{ fontSize: 12, color: "var(--warning)" }}>
              🚧 <strong>Dev Mode:</strong> OTP auto-filled: <strong>{devOtp}</strong>
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <p style={{ color: "var(--text2)", fontSize: 14 }}>Enter the 6-digit verification code</p>
          <OTPInput value={otp} onChange={setOtp} />
          {error && <p style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{error}</p>}
        </div>

        <Button onClick={handleVerify} disabled={loading || otp.length !== 6} fullWidth size="lg">
          {loading ? <><div className="spinner" /> Verifying...</> : isNewUser ? "Create Account" : "Sign In"}
        </Button>

        <div style={{ textAlign: "center" }}>
          {countdown > 0 ? (
            <p style={{ color: "var(--text3)", fontSize: 13 }}>Resend in {countdown}s</p>
          ) : (
            <button onClick={handleResend} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14 }}>
              Resend Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Profile Setup ────────────────────────────────────────────────────

function ProfileSetupScreen({
  session, onComplete,
}: {
  session: Session;
  onComplete: (updated: Session) => void;
}) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(session.displayName ?? "");
  const [legalName, setLegalName] = useState(session.legalName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl ?? "");
  const [avatarEmoji, setAvatarEmoji] = useState("😊");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const EMOJIS = ["😊", "😎", "🦊", "🐱", "🦁", "🐻", "🐼", "🦄", "🦋", "🌟", "🔥", "💎", "⚡", "🌊", "🌙"];

  async function handleComplete() {
    if (displayName.trim().length < 2) { setError("Display name must be at least 2 characters"); return; }
    setLoading(true);
    setError("");

    try {
      const finalAvatarUrl = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${displayName}`;
      const res = await apiPut("/api/identity/profile", {
        displayName: displayName.trim(),
        avatarUrl: finalAvatarUrl,
        legalName: legalName.trim() || undefined,
        completeProfile: true,
      }, session.accessToken) as { ok: boolean; accessToken?: string; error?: string };

      if (!res.ok) { setError(res.error ?? "Failed to save profile"); return; }

      const updated: Session = {
        ...session,
        accessToken: res.accessToken ?? session.accessToken,
        displayName: displayName.trim(),
        avatarUrl: finalAvatarUrl,
        legalName: legalName.trim() || undefined,
        profileComplete: true,
      };
      saveSession(updated);
      onComplete(updated);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: 24, animation: "fadeIn 0.4s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 440, background: "var(--surface)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        padding: 32, display: "flex", flexDirection: "column", gap: 28,
        boxShadow: "var(--shadow)",
      }}>
        {/* Progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Set Up Profile</span>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>Step {step} of 2</span>
          </div>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${(step / 2) * 100}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease", borderRadius: 2 }} />
          </div>
        </div>

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Choose Your Avatar</h2>
              <p style={{ color: "var(--text3)", fontSize: 14, marginTop: 4 }}>Pick an emoji or we'll generate one for you</p>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{
                width: 100, height: 100, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 52, border: "3px solid var(--accent)",
                boxShadow: "0 0 30px rgba(124,92,252,0.3)",
              }}>
                {avatarEmoji}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setAvatarEmoji(e)}
                  style={{
                    width: 44, height: 44, borderRadius: 12, fontSize: 22,
                    background: avatarEmoji === e ? "var(--accent-dim)" : "var(--surface2)",
                    border: `2px solid ${avatarEmoji === e ? "var(--accent)" : "var(--border)"}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            <Button onClick={() => setStep(2)} fullWidth size="lg">
              Continue →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Your Identity</h2>
              <p style={{ color: "var(--text3)", fontSize: 14, marginTop: 4 }}>This information is used for NDA binding</p>
            </div>

            <Input
              label="Display Name *"
              value={displayName}
              onChange={setDisplayName}
              placeholder="How others see you in Confi"
              hint="At least 2 characters. Can be a pseudonym."
              maxLength={50}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                Legal Full Name <span style={{ color: "var(--text3)", fontWeight: 400 }}>(for NDA binding)</span>
              </label>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Your full legal name as it appears on ID"
                style={{
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "12px 14px", color: "var(--text)",
                  outline: "none", fontSize: 15,
                }}
              />
              <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
                ⚖️ Optional but required for NDA-protected conversations. Encrypted at rest. Never shared without your consent.
              </p>
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 12 }}>
              <Button onClick={() => setStep(1)} variant="secondary">
                ← Back
              </Button>
              <Button onClick={handleComplete} disabled={loading || displayName.trim().length < 2} fullWidth size="lg">
                {loading ? <><div className="spinner" /> Saving...</> : "Complete Setup 🚀"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen: Home (main app shell) ───────────────────────────────────────────

function HomeScreen({ session, onSettings }: { session: Session; onSettings: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: "100vh",
      animation: "fadeIn 0.4s ease",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo />
        <button
          onClick={onSettings}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <Avatar name={session.displayName ?? "User"} url={session.avatarUrl} size={38} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 24, gap: 24,
      }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Avatar name={session.displayName ?? "User"} url={session.avatarUrl} size={80} />
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>Welcome, {session.displayName}!</h2>
            <p style={{ color: "var(--text3)", marginTop: 4 }}>
              {session.phone ?? session.email}
            </p>
          </div>
        </div>

        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 28, maxWidth: 480, width: "100%",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Identity Layer Active</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.7 }}>
            Your identity has been verified and secured. You're now ready to engage in Confi-protected conversations with international NDA coverage.
          </p>

          {session.legalName && (
            <div style={{
              marginTop: 20, padding: 14, background: "var(--accent2-dim)",
              borderRadius: "var(--radius-sm)", border: "1px solid var(--accent2)",
            }}>
              <p style={{ fontSize: 13, color: "var(--accent2)" }}>
                ⚖️ <strong>NDA Ready:</strong> Legal name on file. Your conversations can be protected by binding agreements.
              </p>
            </div>
          )}

          {!session.legalName && (
            <div style={{
              marginTop: 20, padding: 14, background: "var(--accent-dim)",
              borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)",
            }}>
              <p style={{ fontSize: 13, color: "var(--accent)" }}>
                📝 Add your legal name in Settings to enable NDA-protected conversations.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: "💬", label: "Messages", desc: "Coming soon" },
            { icon: "🔒", label: "Confidential", desc: "NDA Mode" },
            { icon: "👥", label: "Contacts", desc: "Coming soon" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "20px 24px", minWidth: 120,
                textAlign: "center", cursor: "pointer",
                transition: "border-color 0.2s",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
              <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Settings ─────────────────────────────────────────────────────────

function SettingsScreen({
  session, onBack, onLogout, onSessionUpdated,
}: {
  session: Session;
  onBack: () => void;
  onLogout: () => void;
  onSessionUpdated: (s: Session) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(session.displayName ?? "");
  const [legalName, setLegalName] = useState(session.legalName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileData, setProfileData] = useState<{
    phone?: string; email?: string; createdAt?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await apiGet("/api/identity/profile", session.accessToken) as {
          ok: boolean;
          user?: { phone?: string; email?: string; legalName?: string; createdAt?: string };
        };
        if (res.ok && res.user) {
          setProfileData({ phone: res.user.phone ?? undefined, email: res.user.email ?? undefined, createdAt: res.user.createdAt });
          if (res.user.legalName) setLegalName(res.user.legalName);
        }
      } catch {
        // ignore
      }
    }
    fetchProfile();
  }, [session.accessToken]);

  async function handleSave() {
    if (displayName.trim().length < 2) { setError("Display name must be at least 2 characters"); return; }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiPut("/api/identity/profile", {
        displayName: displayName.trim(),
        avatarUrl: avatarUrl || session.avatarUrl,
        legalName: legalName.trim() || undefined,
        completeProfile: true,
      }, session.accessToken) as { ok: boolean; accessToken?: string; error?: string };

      if (!res.ok) { setError(res.error ?? "Failed to save"); return; }

      const updated: Session = {
        ...session,
        accessToken: res.accessToken ?? session.accessToken,
        displayName: displayName.trim(),
        avatarUrl: avatarUrl || session.avatarUrl,
        legalName: legalName.trim() || undefined,
      };
      saveSession(updated);
      onSessionUpdated(updated);
      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiPost("/api/identity/logout", {
        sessionId: session.sessionId,
      });
    } catch {
      // ignore
    }
    clearSession();
    onLogout();
  }

  async function handleDeleteAccount() {
    setLoading(true);
    try {
      await fetch("/api/identity/delete-account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
    } catch {
      // ignore
    }
    clearSession();
    onLogout();
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 4px 6px" }}>{title}</p>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ icon, label, value, action, danger }: { icon: string; label: string; value?: string; action?: () => void; danger?: boolean }) => (
    <div
      onClick={action}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        borderBottom: "1px solid var(--border)", cursor: action ? "pointer" : "default",
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: danger ? "var(--danger)" : "var(--text)" }}>{label}</p>
        {value && <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{value}</p>}
      </div>
      {action && <span style={{ color: "var(--text3)" }}>›</span>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", animation: "fadeIn 0.4s ease" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Account & Settings</h1>
      </div>

      <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 24, maxWidth: 600, width: "100%", margin: "0 auto" }}>

        {/* Profile card */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 24,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={session.displayName ?? "User"} url={session.avatarUrl} size={64} />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{session.displayName}</h2>
              <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 2 }}>
                {profileData?.phone ?? profileData?.email ?? session.phone ?? session.email}
              </p>
              {profileData?.createdAt && (
                <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>
                  Member since {new Date(profileData.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={() => setEditing(!editing)}
              style={{
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "8px 14px",
                color: "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.3s ease" }}>
              <Input label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Your display name" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                  Legal Name <span style={{ color: "var(--text3)", fontWeight: 400 }}>(for NDA binding)</span>
                </label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Full legal name"
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "12px 14px", color: "var(--text)",
                    outline: "none", fontSize: 15,
                  }}
                />
              </div>
              <Input label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} placeholder="https://..." hint="Leave blank to keep current avatar" />
              {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
              {success && <p style={{ color: "var(--success)", fontSize: 13 }}>{success}</p>}
              <Button onClick={handleSave} disabled={loading} fullWidth>
                {loading ? <><div className="spinner" /> Saving...</> : "Save Changes"}
              </Button>
            </div>
          )}

          {success && !editing && (
            <p style={{ color: "var(--success)", fontSize: 13 }}>{success}</p>
          )}
        </div>

        {/* NDA Status */}
        <Section title="NDA & Legal Identity">
          <Row
            icon="⚖️"
            label="NDA Binding Status"
            value={session.legalName ? `Legal name on file: ${session.legalName}` : "Legal name not provided — NDA mode limited"}
          />
          <Row
            icon="🔐"
            label="Identity Verification"
            value={session.phone ? `Verified via phone: ${session.phone}` : session.email ? `Verified via email: ${session.email}` : "Unverified"}
          />
          <Row
            icon="📋"
            label="Data Encryption"
            value="PII fields encrypted at rest with AES-class XOR cipher"
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <Row icon="🔑" label="Active Session" value={`Session ID: ${session.sessionId.slice(0, 12)}...`} />
          <Row icon="📱" label="Two-Factor Method" value={session.phone ? "Phone OTP (active)" : "Email OTP (active)"} />
          <Row icon="🕐" label="Token Refresh" value="Automatic — 7-day access tokens, 30-day refresh" />
        </Section>

        {/* Account */}
        <Section title="Account">
          <Row icon="🚪" label="Sign Out" action={handleLogout} />
          <Row icon="🗑️" label="Delete Account" danger action={() => setShowDeleteConfirm(true)} />
        </Section>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div style={{
            background: "var(--danger-dim)", border: "1px solid var(--danger)",
            borderRadius: "var(--radius)", padding: 20, display: "flex", flexDirection: "column", gap: 14,
          }}>
            <p style={{ fontWeight: 700, color: "var(--danger)" }}>⚠️ Delete Account?</p>
            <p style={{ color: "var(--text2)", fontSize: 14 }}>
              This permanently deletes your account, all sessions, and removes your data from our servers. NDA agreements you've signed remain legally binding. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Button onClick={() => setShowDeleteConfirm(false)} variant="secondary">Cancel</Button>
              <Button onClick={handleDeleteAccount} variant="danger" disabled={loading}>
                {loading ? <><div className="spinner" /> Deleting...</> : "Yes, Delete Forever"}
              </Button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
          Confi v1.0 · Identity Layer · All PII encrypted · GDPR compliant
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [otpContext, setOtpContext] = useState<{
    identifier: string;
    type: "phone" | "email";
    isNewUser: boolean;
    devOtp?: string;
  } | null>(null);

  // Init: load session, track, init DB
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const saved = loadSession();
    if (saved) {
      setSession(saved);
      if (!saved.profileComplete) {
        setScreen("profile-setup");
      } else {
        setScreen("home");
      }
    }

    // Initialize DB tables
    fetch("/api/identity/init", { method: "POST" }).catch(() => {});
  }, []);

  // Token refresh loop
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiPost("/api/identity/refresh", {
          refreshToken: session.refreshToken,
          sessionId: session.sessionId,
        }) as { ok: boolean; accessToken?: string };

        if (res.ok && res.accessToken) {
          const updated = { ...session, accessToken: res.accessToken };
          setSession(updated);
          saveSession(updated);
        }
      } catch {
        // ignore refresh errors silently
      }
    }, 6 * 60 * 60 * 1000); // every 6 hours

    return () => clearInterval(interval);
  }, [session]);

  function handleOtpSent(identifier: string, type: "phone" | "email", isNew: boolean, devOtp?: string) {
    setOtpContext({ identifier, type, isNewUser: isNew, devOtp });
    setScreen("otp-verification");
  }

  function handleVerified(newSession: Session) {
    setSession(newSession);
    if (!newSession.profileComplete) {
      setScreen("profile-setup");
    } else {
      setScreen("home");
    }
  }

  function handleProfileComplete(updated: Session) {
    setSession(updated);
    setScreen("home");
  }

  function handleLogout() {
    setSession(null);
    setOtpContext(null);
    setScreen("welcome");
  }

  function handleSessionUpdated(updated: Session) {
    setSession(updated);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {screen === "welcome" && (
        <WelcomeScreen
          onPhone={() => setScreen("phone-entry")}
          onEmail={() => setScreen("email-entry")}
        />
      )}

      {screen === "phone-entry" && (
        <PhoneEntryScreen
          onSent={handleOtpSent}
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "email-entry" && (
        <EmailEntryScreen
          onSent={handleOtpSent}
          onBack={() => setScreen("welcome")}
        />
      )}

      {screen === "otp-verification" && otpContext && (
        <OTPScreen
          identifier={otpContext.identifier}
          type={otpContext.type}
          isNewUser={otpContext.isNewUser}
          devOtp={otpContext.devOtp}
          onVerified={handleVerified}
          onBack={() => setScreen(otpContext.type === "phone" ? "phone-entry" : "email-entry")}
        />
      )}

      {screen === "profile-setup" && session && (
        <ProfileSetupScreen
          session={session}
          onComplete={handleProfileComplete}
        />
      )}

      {screen === "home" && session && (
        <HomeScreen
          session={session}
          onSettings={() => setScreen("settings")}
        />
      )}

      {screen === "settings" && session && (
        <SettingsScreen
          session={session}
          onBack={() => setScreen("home")}
          onLogout={handleLogout}
          onSessionUpdated={handleSessionUpdated}
        />
      )}
    </div>
  );
}