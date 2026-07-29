"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { COUNTRIES } from "@/lib/countries";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "splash"
  | "phone-entry"
  | "otp-verify"
  | "email-backup"
  | "profile-setup"
  | "kyc"
  | "pin-setup"
  | "dashboard";

interface SessionUser {
  email: string;
  phone: string;
  displayName: string;
  handle: string;
  avatarColor: string;
  avatarInitials: string;
  country: string;
  legalName: string;
  pinHash: string;
  emailBackup?: string;
  kycComplete: boolean;
  sessionToken: string;
  refreshToken: string;
  sessionExpiry: number; // ms epoch
  createdAt: number;
}

interface Toast {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPin(pin: string): string {
  // Simple deterministic hash (no crypto dependency, good enough for local PIN)
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = (h * 33) ^ pin.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function generateToken(prefix: string): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return prefix + "_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateHandle(displayName: string): string {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return "@" + (base || "user") + suffix;
}

function getInitials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2) || "?";
}

const AVATAR_COLORS = [
  "#25D366", "#128C7E", "#075E54", "#34B7F1",
  "#6B4FBB", "#E91E8C", "#FF6B35", "#0088CC"
];

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function SESSION_KEY() { return "confi_session"; }
function OTP_KEY() { return "confi_otp_cache"; }

function saveSession(user: SessionUser) {
  localStorage.setItem(SESSION_KEY(), JSON.stringify(user));
}

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY());
    if (!raw) return null;
    const user: SessionUser = JSON.parse(raw);
    // Check expiry
    if (Date.now() > user.sessionExpiry) {
      // Try refresh — extend by 30 days
      user.sessionToken = generateToken("sess");
      user.sessionExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      saveSession(user);
    }
    return user;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY());
  localStorage.removeItem(OTP_KEY());
}

// Phone formatting
function formatPhone(raw: string, dialCode: string): string {
  const digits = raw.replace(/\D/g, "");
  return dialCode + digits;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiIdentityPage() {
  const [step, setStep] = useState<Step>("splash");
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Form state
  const [dialCode, setDialCode] = useState("+1");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [otpSentTo, setOtpSentTo] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [emailBackup, setEmailBackup] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState("United States");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [pinConfirm, setPinConfirm] = useState(["", "", "", "", "", ""]);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [avatarColor] = useState(randomColor());

  // Session
  const [session, setSession] = useState<SessionUser | null>(null);
  const [appLocked, setAppLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState(["", "", "", "", "", ""]);
  const [unlockError, setUnlockError] = useState("");

  // Countdown for OTP
  useEffect(() => {
    if (otpExpiry === 0) return;
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
      setOtpCountdown(remaining);
      if (remaining === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [otpExpiry]);

  // Track page
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Load session on mount
  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s);
      setStep("dashboard");
    } else {
      setTimeout(() => setStep("phone-entry"), 2000);
    }
  }, []);

  // Auto-generate handle from display name
  useEffect(() => {
    if (!handleEdited && displayName) {
      setHandle(generateHandle(displayName));
    }
  }, [displayName, handleEdited]);

  // ─── Toast ─────────────────────────────────────────────────────────────────

  const toast = useCallback((msg: string, type: Toast["type"] = "info") => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ─── OTP Logic (simulated — no SMS key) ────────────────────────────────────

  function simulateOTP(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async function sendOTP() {
    const phone = formatPhone(phoneRaw, dialCode);
    if (phoneRaw.replace(/\D/g, "").length < 7) {
      toast("Enter a valid phone number", "error");
      return;
    }
    setLoading(true);
    try {
      const code = simulateOTP();
      const expiry = Date.now() + 5 * 60 * 1000; // 5 min
      localStorage.setItem(OTP_KEY(), JSON.stringify({ code, expiry, phone }));
      setOtpSentTo(phone);
      setOtpExpiry(expiry);
      setOtpCountdown(300);
      setStep("otp-verify");
      toast(`OTP sent to ${phone} (demo: ${code})`, "success");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP() {
    const entered = otpInput.join("");
    if (entered.length < 6) {
      toast("Enter the 6-digit code", "error");
      return;
    }
    const cached = localStorage.getItem(OTP_KEY());
    if (!cached) { toast("Session expired. Resend OTP.", "error"); return; }
    const { code, expiry } = JSON.parse(cached);
    if (Date.now() > expiry) { toast("OTP expired. Resend.", "error"); return; }
    if (entered !== code) { toast("Incorrect code", "error"); return; }
    setLoading(true);
    try {
      // Create account with phone-derived email
      const email = otpSentTo.replace(/\+/g, "") + "@confi.phone";
      const password = generateToken("pw");
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!data.ok && data.error && !data.error.includes("already")) {
        // Try login
        const r2 = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "login", email, password }),
        });
        const d2 = await r2.json();
        if (!d2.ok) { toast("Auth failed. Try again.", "error"); return; }
      }
      setStep("email-backup");
      toast("Phone verified ✓", "success");
    } finally {
      setLoading(false);
    }
  }

  // ─── Profile / KYC / PIN ───────────────────────────────────────────────────

  function finalizeSession() {
    if (!displayName.trim()) { toast("Enter your display name", "error"); return; }
    if (!handle.trim()) { toast("Choose a handle", "error"); return; }
    setStep("kyc");
  }

  function finalizeKYC() {
    if (!legalName.trim()) { toast("Legal name required for NDA", "error"); return; }
    if (!country) { toast("Select your country", "error"); return; }
    setStep("pin-setup");
  }

  function handlePinInput(
    idx: number,
    val: string,
    arr: string[],
    setArr: (a: string[]) => void,
    next: () => void
  ) {
    if (!/^\d?$/.test(val)) return;
    const updated = [...arr];
    updated[idx] = val;
    setArr(updated);
    if (val && idx < 5) {
      (document.getElementById(`pin-${idx + 1}`) as HTMLInputElement)?.focus();
    }
    if (updated.every(d => d !== "") && idx === 5) next();
  }

  function completeSignup() {
    const p1 = pin.join("");
    const p2 = pinConfirm.join("");
    if (p1.length < 6) { toast("Enter 6-digit PIN", "error"); return; }
    if (p1 !== p2) { toast("PINs don't match", "error"); setPinStep("enter"); setPin(["", "", "", "", "", ""]); setPinConfirm(["", "", "", "", "", ""]); return; }

    const phone = otpSentTo || "unknown";
    const email = phone.replace(/\+/g, "") + "@confi.phone";
    const newSession: SessionUser = {
      email,
      phone,
      displayName: displayName.trim(),
      handle: handle.startsWith("@") ? handle : "@" + handle,
      avatarColor,
      avatarInitials: getInitials(displayName),
      country,
      legalName: legalName.trim(),
      pinHash: hashPin(p1),
      emailBackup: emailBackup || undefined,
      kycComplete: true,
      sessionToken: generateToken("sess"),
      refreshToken: generateToken("ref"),
      sessionExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    };
    saveSession(newSession);
    setSession(newSession);
    setStep("dashboard");
    toast("Welcome to Confi! 🔐", "success");
  }

  function lockApp() {
    setAppLocked(true);
    setUnlockPin(["", "", "", "", "", ""]);
    setUnlockError("");
  }

  function attemptUnlock() {
    const entered = unlockPin.join("");
    if (!session) return;
    if (hashPin(entered) === session.pinHash) {
      setAppLocked(false);
      setUnlockError("");
      setUnlockPin(["", "", "", "", "", ""]);
    } else {
      setUnlockError("Incorrect PIN");
      setUnlockPin(["", "", "", "", "", ""]);
      setTimeout(() => (document.getElementById("upin-0") as HTMLInputElement)?.focus(), 50);
    }
  }

  function logout() {
    clearSession();
    setSession(null);
    setStep("phone-entry");
    setPhoneRaw("");
    setOtpInput(["", "", "", "", "", ""]);
    setEmailBackup("");
    setDisplayName("");
    setHandle("");
    setHandleEdited(false);
    setLegalName("");
    setCountry("United States");
    setPin(["", "", "", "", "", ""]);
    setPinConfirm(["", "", "", "", "", ""]);
    setPinStep("enter");
    setAppLocked(false);
  }

  // ─── OTP input ref handling ─────────────────────────────────────────────────

  function handleOtpChange(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const updated = [...otpInput];
    updated[idx] = val;
    setOtpInput(updated);
    if (val && idx < 5) {
      (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
    }
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpInput[idx] && idx > 0) {
      (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Toasts */}
      <div style={styles.toastContainer}>
        {toasts.map(t => (
          <div key={t.id} style={{ ...styles.toast, ...(t.type === "error" ? styles.toastError : t.type === "success" ? styles.toastSuccess : styles.toastInfo) }}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* App Lock Overlay */}
      {appLocked && session && (
        <div style={styles.overlay}>
          <div style={styles.lockCard}>
            <div style={{ ...styles.avatar, background: session.avatarColor, fontSize: 32, width: 72, height: 72, lineHeight: "72px" }}>
              {session.avatarInitials}
            </div>
            <h2 style={styles.lockTitle}>Confi is Locked</h2>
            <p style={styles.lockSub}>{session.displayName}</p>
            <div style={styles.pinRow}>
              {unlockPin.map((d, i) => (
                <input
                  key={i}
                  id={`upin-${i}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  style={styles.pinBox}
                  onChange={e => {
                    if (!/^\d?$/.test(e.target.value)) return;
                    const updated = [...unlockPin];
                    updated[i] = e.target.value;
                    setUnlockPin(updated);
                    if (e.target.value && i < 5) {
                      (document.getElementById(`upin-${i + 1}`) as HTMLInputElement)?.focus();
                    }
                    if (updated.every(x => x !== "") && i === 5) {
                      // auto-attempt
                      const entered = updated.join("");
                      if (hashPin(entered) === session.pinHash) {
                        setAppLocked(false);
                        setUnlockError("");
                        setUnlockPin(["", "", "", "", "", ""]);
                      } else {
                        setUnlockError("Incorrect PIN");
                        setUnlockPin(["", "", "", "", "", ""]);
                        setTimeout(() => (document.getElementById("upin-0") as HTMLInputElement)?.focus(), 50);
                      }
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === "Backspace" && !unlockPin[i] && i > 0) {
                      (document.getElementById(`upin-${i - 1}`) as HTMLInputElement)?.focus();
                    }
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {unlockError && <p style={styles.errorText}>{unlockError}</p>}
            <button style={styles.btnPrimary} onClick={attemptUnlock}>Unlock</button>
            <button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={logout}>Sign out instead</button>
          </div>
        </div>
      )}

      {/* ── SPLASH ── */}
      {step === "splash" && (
        <div style={styles.splash}>
          <div style={styles.splashLogo}>🔐</div>
          <h1 style={styles.splashTitle}>Confi</h1>
          <p style={styles.splashSub}>Confidential Messaging</p>
          <div style={styles.splashDots}>
            <span style={{ ...styles.dot, animationDelay: "0s" }} />
            <span style={{ ...styles.dot, animationDelay: "0.2s" }} />
            <span style={{ ...styles.dot, animationDelay: "0.4s" }} />
          </div>
        </div>
      )}

      {/* ── PHONE ENTRY ── */}
      {step === "phone-entry" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.logoSmall}>🔐</div>
            <h1 style={styles.cardTitle}>Enter your phone number</h1>
            <p style={styles.cardSub}>Confi will send an OTP to verify your number. Your privacy is protected.</p>
          </div>
          <div style={styles.phoneRow}>
            <select
              style={styles.dialSelect}
              value={dialCode}
              onChange={e => setDialCode(e.target.value)}
            >
              {COUNTRIES.map(c => (
                <option key={c.code + c.dial} value={c.dial}>
                  {c.flag} {c.dial}
                </option>
              ))}
            </select>
            <input
              style={styles.phoneInput}
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={phoneRaw}
              onChange={e => setPhoneRaw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendOTP()}
            />
          </div>
          <p style={styles.hintText}>
            Full number: {phoneRaw ? formatPhone(phoneRaw, dialCode) : "—"}
          </p>
          <button style={styles.btnPrimary} onClick={sendOTP} disabled={loading}>
            {loading ? "Sending…" : "Send OTP"}
          </button>
          <p style={styles.legalNote}>
            By continuing you agree to Confi's Terms of Service and Privacy Policy. 
            Your verified identity is required for NDA enforceability.
          </p>
        </div>
      )}

      {/* ── OTP VERIFY ── */}
      {step === "otp-verify" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.logoSmall}>📱</div>
            <h1 style={styles.cardTitle}>Verify your number</h1>
            <p style={styles.cardSub}>
              Enter the 6-digit code sent to <strong>{otpSentTo}</strong>
            </p>
          </div>
          <div style={styles.otpRow}>
            {otpInput.map((d, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                style={styles.otpBox}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>
          <p style={styles.hintText}>
            {otpCountdown > 0
              ? `Code expires in ${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, "0")}`
              : "Code expired"}
          </p>
          <button style={styles.btnPrimary} onClick={verifyOTP} disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
          <button
            style={styles.btnGhost}
            disabled={otpCountdown > 240}
            onClick={() => { setStep("phone-entry"); setOtpInput(["", "", "", "", "", ""]); }}
          >
            Change number / Resend
          </button>
        </div>
      )}

      {/* ── EMAIL BACKUP ── */}
      {step === "email-backup" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.logoSmall}>📧</div>
            <h1 style={styles.cardTitle}>Backup email</h1>
            <p style={styles.cardSub}>Optional but recommended. Used for account recovery and NDA delivery.</p>
          </div>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com (optional)"
            value={emailBackup}
            onChange={e => setEmailBackup(e.target.value)}
          />
          <button
            style={styles.btnPrimary}
            onClick={() => setStep("profile-setup")}
          >
            {emailBackup ? "Continue" : "Skip for now"}
          </button>
        </div>
      )}

      {/* ── PROFILE SETUP ── */}
      {step === "profile-setup" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.avatar, background: avatarColor }}>
              {displayName ? getInitials(displayName) : "?"}
            </div>
            <h1 style={styles.cardTitle}>Your profile</h1>
            <p style={styles.cardSub}>How others will see you on Confi.</p>
          </div>
          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Alexandra Chen"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <label style={styles.label}>Unique Handle</label>
          <div style={styles.handleRow}>
            <span style={styles.atSign}>@</span>
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              type="text"
              placeholder="yourhandle"
              value={handle.replace(/^@/, "")}
              onChange={e => {
                setHandleEdited(true);
                setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase());
              }}
            />
          </div>
          <p style={styles.hintText}>Handle can be changed once. Used in secure NDA invites.</p>
          <button style={styles.btnPrimary} onClick={finalizeSession}>
            Continue
          </button>
        </div>
      )}

      {/* ── KYC ── */}
      {step === "kyc" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.logoSmall}>🪪</div>
            <h1 style={styles.cardTitle}>Identity verification</h1>
            <p style={styles.cardSub}>
              Required for NDA enforceability. Your legal name and country are encrypted and only disclosed under valid legal process.
            </p>
          </div>
          <div style={styles.kycBadge}>
            <span>🔒</span>
            <span style={{ marginLeft: 8 }}>KYC data is end-to-end encrypted</span>
          </div>
          <label style={styles.label}>Legal Full Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="As on government ID"
            value={legalName}
            onChange={e => setLegalName(e.target.value)}
          />
          <label style={styles.label}>Country of Residence</label>
          <select
            style={styles.select}
            value={country}
            onChange={e => setCountry(e.target.value)}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>
          <p style={styles.hintText}>
            Confi activates jurisdiction-appropriate NDAs based on your country.
          </p>
          <button style={styles.btnPrimary} onClick={finalizeKYC}>
            Confirm Identity
          </button>
        </div>
      )}

      {/* ── PIN SETUP ── */}
      {step === "pin-setup" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.logoSmall}>🔑</div>
            <h1 style={styles.cardTitle}>
              {pinStep === "enter" ? "Create app PIN" : "Confirm PIN"}
            </h1>
            <p style={styles.cardSub}>
              {pinStep === "enter"
                ? "6-digit PIN to lock the app. Keep it secret."
                : "Re-enter your PIN to confirm."}
            </p>
          </div>
          <div style={styles.pinRow}>
            {(pinStep === "enter" ? pin : pinConfirm).map((d, i) => (
              <input
                key={i}
                id={`pin-${i}`}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                style={styles.pinBox}
                autoFocus={i === 0}
                onChange={e => {
                  if (pinStep === "enter") {
                    handlePinInput(i, e.target.value, pin, setPin, () => setPinStep("confirm"));
                  } else {
                    handlePinInput(i, e.target.value, pinConfirm, setPinConfirm, completeSignup);
                  }
                }}
                onKeyDown={e => {
                  const arr = pinStep === "enter" ? pin : pinConfirm;
                  if (e.key === "Backspace" && !arr[i] && i > 0) {
                    (document.getElementById(`pin-${i - 1}`) as HTMLInputElement)?.focus();
                  }
                }}
              />
            ))}
          </div>
          {pinStep === "confirm" && (
            <button style={styles.btnGhost} onClick={() => { setPinStep("enter"); setPin(["", "", "", "", "", ""]); setPinConfirm(["", "", "", "", "", ""]); }}>
              ← Re-enter PIN
            </button>
          )}
          <button style={styles.btnPrimary} onClick={completeSignup}>
            {pinStep === "enter" ? "Set PIN" : "Confirm & Finish"}
          </button>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {step === "dashboard" && session && !appLocked && (
        <div style={styles.dashboard}>
          {/* Header */}
          <div style={styles.dashHeader}>
            <div style={styles.dashBrand}>
              <span style={{ fontSize: 22 }}>🔐</span>
              <span style={styles.dashBrandName}>Confi</span>
            </div>
            <div style={styles.dashActions}>
              <button style={styles.iconBtn} onClick={lockApp} title="Lock app">🔒</button>
              <button style={styles.iconBtn} onClick={logout} title="Sign out">↩️</button>
            </div>
          </div>

          {/* Profile Card */}
          <div style={styles.profileCard}>
            <div style={{ ...styles.avatar, background: session.avatarColor, width: 72, height: 72, fontSize: 28, lineHeight: "72px" }}>
              {session.avatarInitials}
            </div>
            <div style={styles.profileInfo}>
              <h2 style={styles.profileName}>{session.displayName}</h2>
              <p style={styles.profileHandle}>{session.handle}</p>
              <p style={styles.profilePhone}>{session.phone}</p>
            </div>
          </div>

          {/* Identity Status */}
          <div style={styles.sectionTitle}>Identity Status</div>
          <div style={styles.statusGrid}>
            <StatusItem icon="📱" label="Phone Verified" status="verified" />
            <StatusItem icon="🪪" label="KYC Complete" status={session.kycComplete ? "verified" : "pending"} />
            <StatusItem icon="📧" label="Email Backup" status={session.emailBackup ? "verified" : "optional"} />
            <StatusItem icon="🔑" label="App PIN" status="verified" />
            <StatusItem icon="🔐" label="NDA Ready" status={session.kycComplete ? "verified" : "pending"} />
            <StatusItem icon="🌍" label="Jurisdiction" status="verified" detail={session.country} />
          </div>

          {/* Session Info */}
          <div style={styles.sectionTitle}>Session & Security</div>
          <div style={styles.infoCard}>
            <InfoRow label="Session Token" value={session.sessionToken.slice(0, 24) + "…"} mono />
            <InfoRow label="Refresh Token" value={session.refreshToken.slice(0, 24) + "…"} mono />
            <InfoRow label="Expires" value={new Date(session.sessionExpiry).toLocaleDateString()} />
            <InfoRow label="Member since" value={new Date(session.createdAt).toLocaleDateString()} />
          </div>

          {/* KYC Details */}
          <div style={styles.sectionTitle}>KYC Details (Encrypted)</div>
          <div style={styles.infoCard}>
            <InfoRow label="Legal Name" value={session.legalName} />
            <InfoRow label="Country" value={session.country} />
            <InfoRow label="NDA Jurisdiction" value={`${session.country} — International`} />
          </div>

          {/* NDA Teaser */}
          <div style={styles.ndaTeaser}>
            <span style={{ fontSize: 28 }}>📜</span>
            <div style={{ marginLeft: 12 }}>
              <div style={styles.ndaTeaserTitle}>NDA Protection Ready</div>
              <div style={styles.ndaTeaserSub}>
                Your identity is verified. Start a confidential conversation to activate an international NDA that covers all messages under strict confidentiality rules.
              </div>
            </div>
          </div>

          {/* Coming Soon */}
          <div style={styles.sectionTitle}>Coming Soon</div>
          <div style={styles.comingSoonGrid}>
            {[
              { icon: "💬", label: "Messaging" },
              { icon: "📜", label: "NDA Activation" },
              { icon: "🔑", label: "Key Exchange" },
              { icon: "📁", label: "Secure Files" },
            ].map(f => (
              <div key={f.label} style={styles.comingSoonItem}>
                <span style={{ fontSize: 28 }}>{f.icon}</span>
                <span style={styles.comingSoonLabel}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusItem({ icon, label, status, detail }: { icon: string; label: string; status: "verified" | "pending" | "optional"; detail?: string }) {
  const colors = { verified: "#25D366", pending: "#FFA500", optional: "#888" };
  const labels = { verified: "✓ Active", pending: "⏳ Pending", optional: "— Optional" };
  return (
    <div style={styles.statusItem}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={styles.statusLabel}>{label}</div>
        {detail && <div style={styles.statusDetail}>{detail}</div>}
      </div>
      <span style={{ ...styles.statusBadge, color: colors[status], borderColor: colors[status] }}>
        {labels[status]}
      </span>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={{ ...styles.infoValue, fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0A0E14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#E8EDF3",
    padding: "0 0 40px",
  },
  toastContainer: {
    position: "fixed",
    top: 16,
    right: 16,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 320,
  },
  toast: {
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    animation: "slideIn 0.3s ease",
  },
  toastSuccess: { background: "#1B4332", color: "#6FCF97", border: "1px solid #27AE60" },
  toastError: { background: "#4A1C1C", color: "#F87171", border: "1px solid #EF4444" },
  toastInfo: { background: "#1A2535", color: "#93C5FD", border: "1px solid #3B82F6" },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.95)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  lockCard: {
    background: "#131920",
    borderRadius: 20,
    padding: "40px 32px",
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    border: "1px solid #1E2D3D",
  },
  lockTitle: { fontSize: 22, fontWeight: 700, margin: 0, color: "#E8EDF3" },
  lockSub: { fontSize: 14, color: "#7B8EA0", margin: 0 },

  splash: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  splashLogo: { fontSize: 72 },
  splashTitle: { fontSize: 42, fontWeight: 800, margin: 0, color: "#25D366", letterSpacing: "-1px" },
  splashSub: { fontSize: 16, color: "#7B8EA0", margin: 0 },
  splashDots: { display: "flex", gap: 8, marginTop: 24 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#25D366",
    animation: "pulse 1.2s ease-in-out infinite",
  },

  card: {
    background: "#131920",
    borderRadius: 20,
    padding: "36px 28px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    border: "1px solid #1E2D3D",
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    margin: "20px 16px",
  },
  cardHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  logoSmall: { fontSize: 40 },
  cardTitle: { fontSize: 22, fontWeight: 700, margin: 0, textAlign: "center" },
  cardSub: { fontSize: 14, color: "#7B8EA0", textAlign: "center", lineHeight: 1.5, margin: 0 },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 700,
    color: "#fff",
    textAlign: "center",
    lineHeight: "60px",
    userSelect: "none",
    flexShrink: 0,
  },

  phoneRow: { display: "flex", gap: 8 },
  dialSelect: {
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#E8EDF3",
    padding: "12px 8px",
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
    maxWidth: 110,
  },
  phoneInput: {
    flex: 1,
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#E8EDF3",
    padding: "12px 14px",
    fontSize: 16,
    outline: "none",
  },

  input: {
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#E8EDF3",
    padding: "13px 14px",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 2,
  },
  select: {
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#E8EDF3",
    padding: "13px 14px",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  label: { fontSize: 13, fontWeight: 600, color: "#7B8EA0", marginBottom: -8 },

  handleRow: {
    display: "flex",
    alignItems: "center",
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    overflow: "hidden",
  },
  atSign: {
    padding: "13px 12px",
    color: "#25D366",
    fontWeight: 700,
    fontSize: 16,
    userSelect: "none",
  },

  otpRow: { display: "flex", gap: 8, justifyContent: "center" },
  otpBox: {
    width: 44,
    height: 52,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#25D366",
    outline: "none",
  },

  pinRow: { display: "flex", gap: 10, justifyContent: "center" },
  pinBox: {
    width: 44,
    height: 52,
    textAlign: "center",
    fontSize: 24,
    fontWeight: 700,
    background: "#1E2D3D",
    border: "1.5px solid #2A3F54",
    borderRadius: 10,
    color: "#25D366",
    outline: "none",
  },

  btnPrimary: {
    background: "linear-gradient(135deg, #25D366, #128C7E)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
  },
  btnGhost: {
    background: "transparent",
    color: "#25D366",
    border: "1.5px solid #25D366",
    borderRadius: 12,
    padding: "12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },

  hintText: { fontSize: 12, color: "#7B8EA0", textAlign: "center", margin: "0 0 4px" },
  errorText: { fontSize: 13, color: "#F87171", textAlign: "center" },
  legalNote: { fontSize: 11, color: "#4A5A6A", textAlign: "center", lineHeight: 1.5 },

  kycBadge: {
    display: "flex",
    alignItems: "center",
    background: "#0D1F2D",
    border: "1px solid #1E3A4A",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#93C5FD",
  },

  // Dashboard
  dashboard: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100vh",
    background: "#0A0E14",
    padding: "0 0 60px",
  },
  dashHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    background: "#131920",
    borderBottom: "1px solid #1E2D3D",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  dashBrand: { display: "flex", alignItems: "center", gap: 8 },
  dashBrandName: { fontSize: 20, fontWeight: 800, color: "#25D366" },
  dashActions: { display: "flex", gap: 4 },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 20,
    padding: "6px 8px",
    borderRadius: 8,
  },

  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "20px",
    background: "#131920",
    margin: "12px 16px",
    borderRadius: 16,
    border: "1px solid #1E2D3D",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: 700, margin: "0 0 2px" },
  profileHandle: { fontSize: 14, color: "#25D366", margin: "0 0 2px", fontWeight: 600 },
  profilePhone: { fontSize: 13, color: "#7B8EA0", margin: 0 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#7B8EA0",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "8px 20px 4px",
  },
  statusGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    margin: "0 16px",
    background: "#131920",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #1E2D3D",
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid #1A2535",
  },
  statusLabel: { fontSize: 14, fontWeight: 500 },
  statusDetail: { fontSize: 11, color: "#7B8EA0", marginTop: 1 },
  statusBadge: {
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
    borderRadius: 6,
    padding: "2px 8px",
    whiteSpace: "nowrap",
  },

  infoCard: {
    margin: "0 16px 8px",
    background: "#131920",
    borderRadius: 16,
    border: "1px solid #1E2D3D",
    overflow: "hidden",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #1A2535",
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: "#7B8EA0", flexShrink: 0 },
  infoValue: { fontSize: 13, color: "#C8D6E5", textAlign: "right", wordBreak: "break-all" },

  ndaTeaser: {
    display: "flex",
    alignItems: "flex-start",
    margin: "12px 16px",
    padding: "16px",
    background: "linear-gradient(135deg, #0D2218, #0A1A2E)",
    borderRadius: 16,
    border: "1px solid #1E3D2A",
  },
  ndaTeaserTitle: { fontSize: 15, fontWeight: 700, color: "#25D366", marginBottom: 4 },
  ndaTeaserSub: { fontSize: 13, color: "#7B8EA0", lineHeight: 1.5 },

  comingSoonGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    margin: "0 16px",
  },
  comingSoonItem: {
    background: "#131920",
    border: "1px solid #1E2D3D",
    borderRadius: 12,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    opacity: 0.7,
  },
  comingSoonLabel: { fontSize: 13, fontWeight: 600, color: "#C8D6E5" },
};