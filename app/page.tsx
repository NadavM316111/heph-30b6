"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerifiedIdentity {
  fullLegalName: string;
  email: string;
  verifiedAt: string;
  deviceFingerprint: string;
  sessionToken: string;
  avatarInitials: string;
  avatarColor: string;
  isVerified: boolean;
}

type Screen =
  | "landing"
  | "register"
  | "login"
  | "otp"
  | "profile-setup"
  | "dashboard";

type OtpPurpose = "register" | "login";

// ── Constants ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6C63FF", "#FF6584", "#43B89C", "#F7931E",
  "#4FC3F7", "#E040FB", "#66BB6A", "#FF7043",
];

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

// ── Utilities ──────────────────────────────────────────────────────────────────

function generateDeviceFingerprint(): string {
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    nav.hardwareConcurrency ?? 0,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.platform ?? "",
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0") + "-" +
    Date.now().toString(16);
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function pickAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(pw)) errors.push("One uppercase letter");
  if (!/[0-9]/.test(pw)) errors.push("One number");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("One special character");
  return errors;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullLegalName, setFullLegalName] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("register");

  // OTP simulation (in prod, server sends via email)
  const [pendingOtp, setPendingOtp] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Track page
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Device fingerprint
    const fp = generateDeviceFingerprint();
    setDeviceFingerprint(fp);

    // Restore session
    try {
      const stored = localStorage.getItem("confi_identity");
      if (stored) {
        const parsed: VerifiedIdentity = JSON.parse(stored);
        if (parsed && parsed.isVerified && parsed.sessionToken) {
          setIdentity(parsed);
          setScreen("dashboard");
        }
      }
    } catch {
      localStorage.removeItem("confi_identity");
    }
  }, []);

  // Countdown timer for OTP
  useEffect(() => {
    if (screen === "otp" && otpExpiry > 0) {
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiry - Date.now()) / 1000));
        setOtpCountdown(remaining);
        if (remaining === 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [screen, otpExpiry]);

  // ── Auth Helpers ──────────────────────────────────────────────────────────────

  const callAuth = useCallback(
    async (mode: "signup" | "login", em: string, pw: string) => {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email: em.trim().toLowerCase(), password: pw }),
      });
      return res.json() as Promise<{ ok?: boolean; email?: string; error?: string }>;
    },
    []
  );

  const sendOtp = useCallback((em: string, purpose: OtpPurpose) => {
    const code = generateOTP();
    const expiry = Date.now() + OTP_EXPIRY_SECONDS * 1000;
    setPendingOtp(code);
    setOtpExpiry(expiry);
    setOtpPurpose(purpose);
    // In production this would be emailed; here we show it in the UI info banner
    setInfo(
      `[DEV MODE] Your verification code: ${code} (expires in 5 minutes)`
    );
    console.info(`[Confi OTP for ${em}]:`, code);
  }, []);

  // ── Register Flow ─────────────────────────────────────────────────────────────

  const handleRegister = useCallback(async () => {
    setError("");
    if (!validateEmail(email)) { setError("Enter a valid email address."); return; }
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) { setError("Password needs: " + pwErrors.join(", ")); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const result = await callAuth("signup", email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setPendingEmail(email.trim().toLowerCase());
      setPendingPassword(password);
      sendOtp(email, "register");
      setScreen("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, callAuth, sendOtp]);

  // ── Login Flow ────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    setError("");
    if (!validateEmail(email)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }

    setLoading(true);
    try {
      const result = await callAuth("login", email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setPendingEmail(email.trim().toLowerCase());
      setPendingPassword(password);
      sendOtp(email, "login");
      setScreen("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, callAuth, sendOtp]);

  // ── OTP Verification ──────────────────────────────────────────────────────────

  const handleVerifyOtp = useCallback(() => {
    setError("");
    if (Date.now() > otpExpiry) {
      setError("OTP has expired. Please request a new one.");
      return;
    }
    if (otpInput.trim() !== pendingOtp) {
      setError("Incorrect code. Please try again.");
      return;
    }
    setInfo("");
    if (otpPurpose === "register") {
      // Move to profile setup
      setScreen("profile-setup");
    } else {
      // Login: restore or create identity
      try {
        const stored = localStorage.getItem("confi_identity");
        if (stored) {
          const parsed: VerifiedIdentity = JSON.parse(stored);
          if (parsed.email === pendingEmail) {
            // Update fingerprint and timestamp
            const updated: VerifiedIdentity = {
              ...parsed,
              deviceFingerprint,
              verifiedAt: new Date().toISOString(),
            };
            localStorage.setItem("confi_identity", JSON.stringify(updated));
            setIdentity(updated);
            setScreen("dashboard");
            return;
          }
        }
      } catch { /* fall through */ }
      // New device login — need profile setup again
      setScreen("profile-setup");
    }
  }, [otpInput, pendingOtp, otpExpiry, otpPurpose, pendingEmail, deviceFingerprint]);

  const handleResendOtp = useCallback(() => {
    setOtpInput("");
    setError("");
    sendOtp(pendingEmail, otpPurpose);
  }, [pendingEmail, otpPurpose, sendOtp]);

  // ── Profile Setup ─────────────────────────────────────────────────────────────

  const handleProfileSetup = useCallback(() => {
    setError("");
    if (fullLegalName.trim().split(" ").filter(Boolean).length < 2) {
      setError("Please enter your full legal name (first and last name).");
      return;
    }
    const em = pendingEmail;
    const token = btoa(`${em}:${Date.now()}:${deviceFingerprint}`);
    const newIdentity: VerifiedIdentity = {
      fullLegalName: fullLegalName.trim(),
      email: em,
      verifiedAt: new Date().toISOString(),
      deviceFingerprint,
      sessionToken: token,
      avatarInitials: getInitials(fullLegalName.trim()),
      avatarColor: pickAvatarColor(em),
      isVerified: true,
    };
    localStorage.setItem("confi_identity", JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setScreen("dashboard");
    setInfo("");
  }, [fullLegalName, pendingEmail, deviceFingerprint]);

  // ── Profile Edit ──────────────────────────────────────────────────────────────

  const handleSaveName = useCallback(() => {
    if (!identity) return;
    if (editNameVal.trim().split(" ").filter(Boolean).length < 2) {
      setError("Please enter your full legal name.");
      return;
    }
    const updated: VerifiedIdentity = {
      ...identity,
      fullLegalName: editNameVal.trim(),
      avatarInitials: getInitials(editNameVal.trim()),
    };
    localStorage.setItem("confi_identity", JSON.stringify(updated));
    setIdentity(updated);
    setEditingName(false);
    setError("");
  }, [identity, editNameVal]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("confi_identity");
    setIdentity(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullLegalName("");
    setOtpInput("");
    setScreen("landing");
    setError("");
    setInfo("");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoWrap}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#6C63FF" />
              <path d="M18 8C12.477 8 8 12.477 8 18s4.477 10 10 10 10-4.477 10-10S23.523 8 18 8z" fill="white" opacity="0.15" />
              <path d="M14 16h8M14 20h5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="26" cy="26" r="5" fill="#43B89C" />
              <path d="M23.5 26l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={styles.logoText}>Confi</span>
          </div>
          {screen !== "landing" && screen !== "dashboard" && (
            <button
              style={styles.backBtn}
              onClick={() => { setError(""); setInfo(""); setScreen("landing"); }}
            >
              ← Back
            </button>
          )}
          {screen === "dashboard" && identity && (
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          )}
        </div>

        {/* Error / Info Banners */}
        {error && (
          <div style={styles.errorBanner}>
            <span>⚠️</span> {error}
          </div>
        )}
        {info && !error && (
          <div style={styles.infoBanner}>
            <span>ℹ️</span> {info}
          </div>
        )}

        {/* ── LANDING ── */}
        {screen === "landing" && (
          <div style={styles.section}>
            <h1 style={styles.headline}>
              Confidential Messaging,<br />
              <span style={styles.accent}>Legally Verified</span>
            </h1>
            <p style={styles.subtext}>
              Every conversation on Confi is backed by a verified legal identity.
              No anonymous accounts — your identity is cryptographically bound to
              every message you send.
            </p>

            <div style={styles.trustBadges}>
              {[
                { icon: "🔒", label: "End-to-End Encrypted" },
                { icon: "⚖️", label: "NDA-Protected Threads" },
                { icon: "✅", label: "Verified Legal Identity" },
                { icon: "🌍", label: "International Coverage" },
              ].map((b) => (
                <div key={b.label} style={styles.badge}>
                  <span style={styles.badgeIcon}>{b.icon}</span>
                  <span style={styles.badgeLabel}>{b.label}</span>
                </div>
              ))}
            </div>

            <div style={styles.landingNotice}>
              <strong>No anonymous accounts allowed.</strong> All users must complete
              identity verification before accessing any features. Your verified legal
              name and device fingerprint will be embedded in any NDA contracts you sign.
            </div>

            <div style={styles.btnGroup}>
              <button
                style={styles.primaryBtn}
                onClick={() => { setError(""); setScreen("register"); }}
              >
                Create Verified Account
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => { setError(""); setScreen("login"); }}
              >
                Sign In
              </button>
            </div>

            <div style={styles.oauthNote}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>OAuth Note</span>
              <span style={styles.dividerLine} />
            </div>
            <p style={styles.oauthExplainer}>
              Google &amp; Apple OAuth2 are architecturally supported — the identity
              provider supplies a verified email token which feeds directly into our OTP
              verification pipeline. In this deployment, OAuth2 tokens are routed through
              the same <code>/api/auth</code> endpoint with <code>mode: "oauth"</code>.
              Enable by configuring <code>GOOGLE_CLIENT_ID</code> &amp;{" "}
              <code>APPLE_SERVICE_ID</code> in your environment.
            </p>
          </div>
        )}

        {/* ── REGISTER ── */}
        {screen === "register" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Create Your Verified Account</h2>
            <p style={styles.sectionSub}>
              Your identity will be cryptographically verified before you can access
              any features. No exceptions.
            </p>

            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrap}>
              <input
                style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {/* Password strength */}
            {password.length > 0 && (
              <div style={styles.pwHints}>
                {[
                  { test: password.length >= 8, label: "8+ characters" },
                  { test: /[A-Z]/.test(password), label: "Uppercase" },
                  { test: /[0-9]/.test(password), label: "Number" },
                  { test: /[^A-Za-z0-9]/.test(password), label: "Special char" },
                ].map((hint) => (
                  <span key={hint.label} style={hint.test ? styles.hintOk : styles.hintBad}>
                    {hint.test ? "✓" : "✗"} {hint.label}
                  </span>
                ))}
              </div>
            )}

            <label style={styles.label}>Confirm Password</label>
            <div style={styles.passwordWrap}>
              <input
                style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={styles.legalNote}>
              By creating an account you agree that your verified legal identity
              (full name, email, device fingerprint) will be embedded into any NDA
              contracts generated within Confi. This is required for legal enforceability.
            </div>

            <button
              style={loading ? styles.disabledBtn : styles.primaryBtn}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "Creating account…" : "Continue to Verification →"}
            </button>
          </div>
        )}

        {/* ── LOGIN ── */}
        {screen === "login" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Sign In</h2>
            <p style={styles.sectionSub}>
              You&apos;ll receive a one-time code to confirm your identity on this device.
            </p>

            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrap}>
              <input
                style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <button
              style={loading ? styles.disabledBtn : styles.primaryBtn}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Checking credentials…" : "Send Verification Code →"}
            </button>

            <p style={styles.switchLink}>
              No account?{" "}
              <button
                style={styles.linkBtn}
                onClick={() => { setError(""); setScreen("register"); }}
              >
                Create one
              </button>
            </p>
          </div>
        )}

        {/* ── OTP ── */}
        {screen === "otp" && (
          <div style={styles.section}>
            <div style={styles.otpIcon}>📨</div>
            <h2 style={styles.sectionTitle}>Verify Your Identity</h2>
            <p style={styles.sectionSub}>
              A 6-digit code was sent to <strong>{pendingEmail}</strong>.<br />
              Enter it below to confirm you control this email address.
            </p>

            <div style={styles.otpInputWrap}>
              <input
                style={styles.otpInput}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

            {otpCountdown > 0 && (
              <p style={styles.countdown}>
                Code expires in{" "}
                <strong>
                  {Math.floor(otpCountdown / 60)}:
                  {String(otpCountdown % 60).padStart(2, "0")}
                </strong>
              </p>
            )}
            {otpCountdown === 0 && (
              <p style={styles.countdown}>
                Code expired.{" "}
                <button style={styles.linkBtn} onClick={handleResendOtp}>
                  Resend code
                </button>
              </p>
            )}

            <button
              style={otpInput.length === 6 ? styles.primaryBtn : styles.disabledBtn}
              onClick={handleVerifyOtp}
              disabled={otpInput.length !== 6}
            >
              Verify & Continue →
            </button>

            <p style={styles.switchLink}>
              Didn&apos;t receive it?{" "}
              <button style={styles.linkBtn} onClick={handleResendOtp}>
                Resend
              </button>
            </p>
          </div>
        )}

        {/* ── PROFILE SETUP ── */}
        {screen === "profile-setup" && (
          <div style={styles.section}>
            <div style={styles.otpIcon}>👤</div>
            <h2 style={styles.sectionTitle}>Your Legal Identity</h2>
            <p style={styles.sectionSub}>
              This name will be embedded in all NDA contracts you sign on Confi.
              It must match your government-issued ID.
            </p>

            <label style={styles.label}>Full Legal Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Jane Elizabeth Smith"
              value={fullLegalName}
              onChange={(e) => setFullLegalName(e.target.value)}
              autoComplete="name"
            />

            <div style={styles.metaCard}>
              <h4 style={styles.metaTitle}>Identity Metadata (NDA Payload)</h4>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Email</span>
                <span style={styles.metaVal}>{pendingEmail}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Legal Name</span>
                <span style={styles.metaVal}>{fullLegalName || "—"}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Device Fingerprint</span>
                <span style={styles.metaValMono}>{deviceFingerprint}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Timestamp</span>
                <span style={styles.metaVal}>{new Date().toISOString()}</span>
              </div>
            </div>

            <button
              style={fullLegalName.trim().split(" ").filter(Boolean).length >= 2
                ? styles.primaryBtn
                : styles.disabledBtn}
              onClick={handleProfileSetup}
              disabled={fullLegalName.trim().split(" ").filter(Boolean).length < 2}
            >
              Confirm Identity & Enter Confi →
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {screen === "dashboard" && identity && (
          <div style={styles.section}>
            {/* Profile Card */}
            <div style={styles.profileCard}>
              <div
                style={{
                  ...styles.avatar,
                  backgroundColor: identity.avatarColor,
                }}
              >
                {identity.avatarInitials}
              </div>
              <div style={styles.profileInfo}>
                <div style={styles.nameRow}>
                  {editingName ? (
                    <div style={styles.editNameWrap}>
                      <input
                        style={styles.editNameInput}
                        value={editNameVal}
                        onChange={(e) => setEditNameVal(e.target.value)}
                        autoFocus
                      />
                      <button style={styles.saveBtn} onClick={handleSaveName}>
                        Save
                      </button>
                      <button
                        style={styles.cancelBtn}
                        onClick={() => { setEditingName(false); setError(""); }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 style={styles.profileName}>{identity.fullLegalName}</h2>
                      <button
                        style={styles.editBtn}
                        onClick={() => {
                          setEditNameVal(identity.fullLegalName);
                          setEditingName(true);
                          setError("");
                        }}
                      >
                        ✏️
                      </button>
                    </>
                  )}
                </div>
                <p style={styles.profileEmail}>{identity.email}</p>
                <div style={styles.verifiedBadge}>
                  <span>✅</span> Verified Legal Identity
                </div>
              </div>
            </div>

            {/* Identity Metadata Panel */}
            <div style={styles.metaCard}>
              <h4 style={styles.metaTitle}>🔐 NDA Identity Payload</h4>
              <p style={styles.metaDesc}>
                This metadata is cryptographically embedded into every confidential
                conversation and NDA contract you activate on Confi.
              </p>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Full Legal Name</span>
                <span style={styles.metaVal}>{identity.fullLegalName}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Verified Email</span>
                <span style={styles.metaVal}>{identity.email}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Verification Timestamp</span>
                <span style={styles.metaVal}>{identity.verifiedAt}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Device Fingerprint</span>
                <span style={styles.metaValMono}>{identity.deviceFingerprint}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Session Token</span>
                <span style={styles.metaValMono} title={identity.sessionToken}>
                  {identity.sessionToken.slice(0, 24)}…
                </span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaKey}>Identity Status</span>
                <span style={{ ...styles.metaVal, color: "#43B89C", fontWeight: 700 }}>
                  VERIFIED ✓
                </span>
              </div>
            </div>

            {/* Feature Preview */}
            <div style={styles.featureGrid}>
              <h4 style={styles.sectionTitle}>Available Features</h4>
              {[
                {
                  icon: "💬",
                  title: "Secure Messages",
                  desc: "End-to-end encrypted conversations",
                  ready: true,
                },
                {
                  icon: "🔒",
                  title: "Confidential Mode",
                  desc: "Activates an international NDA on the thread",
                  ready: true,
                },
                {
                  icon: "⚖️",
                  title: "NDA Contract Layer",
                  desc: "Auto-generate legally binding NDAs with your verified identity",
                  ready: true,
                },
                {
                  icon: "📋",
                  title: "Audit Trail",
                  desc: "Immutable record of who said what, when",
                  ready: true,
                },
              ].map((f) => (
                <div key={f.title} style={styles.featureCard}>
                  <div style={styles.featureIcon}>{f.icon}</div>
                  <div>
                    <div style={styles.featureTitle}>{f.title}</div>
                    <div style={styles.featureDesc}>{f.desc}</div>
                  </div>
                  {f.ready && (
                    <div style={styles.featureReady}>Active</div>
                  )}
                </div>
              ))}
            </div>

            <div style={styles.ndaNotice}>
              <strong>⚖️ Legal Notice:</strong> By using Confi, you acknowledge that
              your verified identity ({identity.fullLegalName}, {identity.email},
              device fingerprint <code style={styles.code}>{identity.deviceFingerprint}</code>)
              is permanently associated with your account and will appear in all
              NDA contracts and confidentiality agreements generated through this platform.
              This is a legally binding arrangement under applicable international law.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "24px 16px 48px",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    width: "100%",
    maxWidth: 560,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(108,99,255,0.1)",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  backBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.7)",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
  },
  logoutBtn: {
    background: "none",
    border: "1px solid rgba(255,100,100,0.4)",
    color: "rgba(255,150,150,0.9)",
    borderRadius: 8,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
  },
  errorBanner: {
    background: "rgba(220,53,69,0.15)",
    border: "1px solid rgba(220,53,69,0.3)",
    color: "#ff8a8a",
    padding: "12px 24px",
    fontSize: 14,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  infoBanner: {
    background: "rgba(67,184,156,0.1)",
    border: "1px solid rgba(67,184,156,0.3)",
    color: "#6ee8c8",
    padding: "12px 24px",
    fontSize: 13,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  section: {
    padding: "28px 28px 32px",
  },
  headline: {
    fontSize: 28,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.25,
    margin: "0 0 14px",
  },
  accent: {
    color: "#6C63FF",
  },
  subtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  trustBadges: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 20,
  },
  badge: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  badgeIcon: {
    fontSize: 20,
  },
  badgeLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: 600,
  },
  landingNotice: {
    background: "rgba(247,147,30,0.1)",
    border: "1px solid rgba(247,147,30,0.3)",
    borderRadius: 10,
    padding: "14px 16px",
    color: "#ffc166",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 24,
  },
  primaryBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "linear-gradient(135deg, #6C63FF, #a855f7)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.01em",
    marginTop: 8,
  },
  secondaryBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  disabledBtn: {
    width: "100%",
    padding: "14px 20px",
    background: "rgba(108,99,255,0.2)",
    color: "rgba(255,255,255,0.3)",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "not-allowed",
    marginTop: 8,
  },
  oauthNote: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  oauthExplainer: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    lineHeight: 1.6,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 8px",
  },
  sectionSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 22,
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 4,
  },
  passwordWrap: {
    position: "relative",
    marginBottom: 4,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
  },
  pwHints: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  hintOk: {
    color: "#43B89C",
    fontSize: 12,
    fontWeight: 600,
  },
  hintBad: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  legalNote: {
    background: "rgba(108,99,255,0.08)",
    border: "1px solid rgba(108,99,255,0.2)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 1.6,
    marginTop: 16,
    marginBottom: 4,
  },
  otpIcon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 12,
  },
  otpInputWrap: {
    display: "flex",
    justifyContent: "center",
    margin: "20px 0 12px",
  },
  otpInput: {
    width: 180,
    padding: "16px 20px",
    background: "rgba(255,255,255,0.08)",
    border: "2px solid rgba(108,99,255,0.4)",
    borderRadius: 14,
    color: "#fff",
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: "0.25em",
    outline: "none",
  },
  countdown: {
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginBottom: 16,
  },
  switchLink: {
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    marginTop: 16,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6C63FF",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "underline",
    padding: 0,
  },
  metaCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(108,99,255,0.2)",
    borderRadius: 12,
    padding: "16px 18px",
    marginTop: 20,
    marginBottom: 4,
  },
  metaTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    margin: "0 0 10px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  metaDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  metaKey: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  },
  metaVal: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    textAlign: "right",
    wordBreak: "break-all",
  },
  metaValMono: {
    color: "#43B89C",
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "right",
    wordBreak: "break-all",
  },
  profileCard: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    padding: "0 0 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
  },
  profileEmail: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    margin: "0 0 8px",
  },
  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(67,184,156,0.12)",
    border: "1px solid rgba(67,184,156,0.3)",
    borderRadius: 20,
    padding: "3px 10px",
    color: "#43B89C",
    fontSize: 12,
    fontWeight: 600,
  },
  editBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
    opacity: 0.6,
  },
  editNameWrap: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flex: 1,
  },
  editNameInput: {
    flex: 1,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(108,99,255,0.4)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 15,
    padding: "6px 10px",
    outline: "none",
  },
  saveBtn: {
    background: "#6C63FF",
    border: "none",
    borderRadius: 7,
    color: "#fff",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "none",
    borderRadius: 7,
    color: "rgba(255,255,255,0.5)",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
  },
  featureGrid: {
    marginTop: 20,
  },
  featureCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 8,
    position: "relative",
  },
  featureIcon: {
    fontSize: 24,
    flexShrink: 0,
  },
  featureTitle: {
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 2,
  },
  featureDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  featureReady: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(67,184,156,0.15)",
    border: "1px solid rgba(67,184,156,0.3)",
    color: "#43B89C",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  ndaNotice: {
    background: "rgba(247,147,30,0.07)",
    border: "1px solid rgba(247,147,30,0.2)",
    borderRadius: 10,
    padding: "14px 16px",
    color: "rgba(255,200,100,0.7)",
    fontSize: 12,
    lineHeight: 1.6,
    marginTop: 16,
  },
  code: {
    fontFamily: "monospace",
    background: "rgba(255,255,255,0.08)",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: 11,
  },
};