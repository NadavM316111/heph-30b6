"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface User {
  email: string;
  displayName?: string;
  phone?: string;
  phoneVerified?: boolean;
  avatarColor?: string;
}

interface OTPState {
  code: string;
  sent: boolean;
  verified: boolean;
  target: string; // email or phone
  type: "email" | "phone";
}

type Screen =
  | "landing"
  | "register"
  | "login"
  | "otp-email"
  | "otp-phone"
  | "profile-setup"
  | "home";

// ── Constants ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#E53E3E","#D69E2E","#38A169","#3182CE","#805AD5",
  "#D53F8C","#DD6B20","#2B6CB0","#276749","#6B46C1",
];

const COUNTRY_CODES = [
  { code: "+1",  country: "US/CA" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "IN" },
  { code: "+61", country: "AU" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+81", country: "JP" },
  { code: "+86", country: "CN" },
  { code: "+55", country: "BR" },
  { code: "+27", country: "ZA" },
  { code: "+234", country: "NG" },
  { code: "+971", country: "AE" },
  { code: "+65", country: "SG" },
  { code: "+64", country: "NZ" },
  { code: "+52", country: "MX" },
];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<User | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [avatarColor, setAvatarColor] = useState(randomColor());

  // OTP state
  const [otp, setOtp] = useState<OTPState>({
    code: "", sent: false, verified: false, target: "", type: "email",
  });
  const [otpInput, setOtpInput] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [simulatedOTP, setSimulatedOTP] = useState(""); // shown in dev banner

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"register" | "login">("register");

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname }),
      }).catch(() => {});

      const stored = localStorage.getItem("confi_user");
      const token = localStorage.getItem("confi_token");
      if (stored && token) {
        setUser(JSON.parse(stored));
        setScreen("home");
      }
    })();
  }, []);

  // ── OTP countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const clearError = () => { setError(""); setInfo(""); };

  const saveSession = (u: User, token: string) => {
    localStorage.setItem("confi_user", JSON.stringify(u));
    localStorage.setItem("confi_token", token);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("confi_user");
    localStorage.removeItem("confi_token");
    setUser(null);
    setEmail(""); setPassword(""); setPhone("");
    setDisplayName(""); setOtpInput("");
    setOtp({ code: "", sent: false, verified: false, target: "", type: "email" });
    setScreen("landing");
  };

  // ── Send OTP (simulated — no Twilio key in env) ──────────────────────────────
  const sendOTP = useCallback(
    async (target: string, type: "email" | "phone") => {
      const code = generateOTP();
      setSimulatedOTP(code); // dev only — show in banner
      setOtp({ code, sent: true, verified: false, target, type });
      setOtpTimer(60);
      setOtpInput("");
      setInfo(
        type === "email"
          ? `OTP sent to ${target}. (Demo: see banner above)`
          : `SMS OTP sent to ${target}. (Demo: see banner above — Twilio not configured)`
      );
    },
    []
  );

  const verifyOTP = useCallback(() => {
    if (otpInput.trim() === otp.code) {
      setOtp((prev) => ({ ...prev, verified: true }));
      setInfo("✓ Verified successfully!");
      return true;
    } else {
      setError("Incorrect OTP. Please try again.");
      return false;
    }
  }, [otpInput, otp.code]);

  // ── Register flow ─────────────────────────────────────────────────────────────
  const handleRegisterStep1 = async () => {
    clearError();
    if (!email || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email address."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Registration failed."); return; }
      // Send email OTP
      await sendOTP(email, "email");
      setScreen("otp-email");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOTPVerify = () => {
    clearError();
    if (verifyOTP()) {
      setScreen("otp-phone");
      setOtp((prev) => ({ ...prev, verified: false, sent: false }));
      setOtpInput("");
      setSimulatedOTP("");
    }
  };

  const handleSendPhoneOTP = async () => {
    clearError();
    if (!phone || phone.length < 6) {
      setError("Enter a valid phone number."); return;
    }
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
    await sendOTP(fullPhone, "phone");
  };

  const handlePhoneOTPVerify = () => {
    clearError();
    if (verifyOTP()) {
      setScreen("profile-setup");
      setSimulatedOTP("");
    }
  };

  const handleProfileSetup = () => {
    clearError();
    if (!displayName.trim()) { setError("Display name is required."); return; }
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
    const u: User = {
      email,
      displayName: displayName.trim(),
      phone: fullPhone,
      phoneVerified: true,
      avatarColor,
    };
    // fake JWT-style token
    const token = btoa(JSON.stringify({ email, iat: Date.now() }));
    saveSession(u, token);
    setScreen("home");
  };

  // ── Login flow ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    clearError();
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Login failed."); return; }

      // Try to restore full profile from localStorage backup
      const stored = localStorage.getItem("confi_user");
      let u: User = { email: data.email };
      if (stored) {
        const parsed: User = JSON.parse(stored);
        if (parsed.email === data.email) u = parsed;
      }
      const token = btoa(JSON.stringify({ email: data.email, iat: Date.now() }));
      saveSession(u, token);
      setScreen("home");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const DevBanner = () =>
    simulatedOTP ? (
      <div style={styles.devBanner}>
        🔑 <strong>Dev OTP:</strong> {simulatedOTP} &nbsp;
        <span style={{ fontSize: 11, opacity: 0.8 }}>
          (Twilio not configured — code shown here for demo)
        </span>
      </div>
    ) : null;

  const ErrorBox = () =>
    error ? <div style={styles.errorBox}>{error}</div> : null;

  const InfoBox = () =>
    info ? <div style={styles.infoBox}>{info}</div> : null;

  const OTPInputBlock = ({
    onVerify,
    onResend,
    label,
  }: {
    onVerify: () => void;
    onResend: () => void;
    label: string;
  }) => (
    <div>
      <p style={styles.otpLabel}>{label}</p>
      <div style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input
            key={i}
            type="text"
            maxLength={1}
            value={otpInput[i] || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/, "");
              const arr = otpInput.split("");
              arr[i] = val;
              const next = arr.join("").slice(0, 6);
              setOtpInput(next);
              if (val && i < 5) {
                const nextEl = document.getElementById(`otp-${i + 1}`);
                nextEl?.focus();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !otpInput[i] && i > 0) {
                document.getElementById(`otp-${i - 1}`)?.focus();
              }
            }}
            id={`otp-${i}`}
            style={styles.otpCell}
          />
        ))}
      </div>
      <button
        style={{ ...styles.btn, marginTop: 16 }}
        onClick={onVerify}
        disabled={otpInput.length < 6}
      >
        Verify Code
      </button>
      <div style={styles.resendRow}>
        {otpTimer > 0 ? (
          <span style={styles.timerText}>Resend in {otpTimer}s</span>
        ) : (
          <button style={styles.linkBtn} onClick={onResend}>
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Landing ─────────────────────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoWrap}>
            <div style={styles.logo}>🔐</div>
            <h1 style={styles.appName}>Confi</h1>
            <p style={styles.tagline}>
              Confidential messaging with legally-binding NDA protection.
              <br />
              Your identity is verified. Every conversation is auditable.
            </p>
          </div>
          <div style={styles.featureList}>
            {[
              ["📱", "Phone-verified identity (international NDA-ready)"],
              ["✉️", "Email-anchored account with OTP"],
              ["🔏", "Secure bcrypt password hashing"],
              ["📜", "Confidential mode activates international NDA"],
              ["🕵️", "Provable, auditable party identification"],
            ].map(([icon, text]) => (
              <div key={text as string} style={styles.featureRow}>
                <span style={styles.featureIcon}>{icon}</span>
                <span style={styles.featureText}>{text}</span>
              </div>
            ))}
          </div>
          <button
            style={styles.btn}
            onClick={() => { setMode("register"); setScreen("register"); clearError(); }}
          >
            Create Account
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnSecondary, marginTop: 10 }}
            onClick={() => { setMode("login"); setScreen("login"); clearError(); }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Register ─────────────────────────────────────────────────────────────────
  if (screen === "register") {
    return (
      <div style={styles.page}>
        <DevBanner />
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => { setScreen("landing"); clearError(); }}>← Back</button>
          <h2 style={styles.cardTitle}>Create Account</h2>
          <p style={styles.cardSub}>
            Your email and phone become your legal identity anchor for NDAs.
          </p>
          <ErrorBox />
          <InfoBox />

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
          <div style={styles.pwWrap}>
            <input
              style={{ ...styles.input, marginBottom: 0, paddingRight: 44 }}
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              style={styles.eyeBtn}
              onClick={() => setShowPassword((v) => !v)}
              type="button"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <label style={styles.label}>Confirm Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          <div style={styles.passwordStrength}>
            {password.length === 0 ? null : (
              <>
                <div style={styles.strengthBar}>
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.strengthSegment,
                        backgroundColor:
                          password.length >= (i + 1) * 3
                            ? i < 1 ? "#E53E3E" : i < 2 ? "#D69E2E" : i < 3 ? "#38A169" : "#3182CE"
                            : "#2D3748",
                      }}
                    />
                  ))}
                </div>
                <span style={styles.strengthLabel}>
                  {password.length < 6 ? "Weak" : password.length < 10 ? "Fair" : password.length < 14 ? "Strong" : "Very Strong"}
                </span>
              </>
            )}
          </div>

          <button
            style={styles.btn}
            onClick={handleRegisterStep1}
            disabled={loading}
          >
            {loading ? "Registering…" : "Continue →"}
          </button>
          <p style={styles.switchLink}>
            Already have an account?{" "}
            <button style={styles.linkBtn} onClick={() => { setScreen("login"); clearError(); }}>
              Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => { setScreen("landing"); clearError(); }}>← Back</button>
          <h2 style={styles.cardTitle}>Welcome Back</h2>
          <p style={styles.cardSub}>Sign in to your verified Confi identity.</p>
          <ErrorBox />
          <InfoBox />

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
          <div style={styles.pwWrap}>
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
              type="button"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <button style={styles.btn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <p style={styles.switchLink}>
            No account?{" "}
            <button style={styles.linkBtn} onClick={() => { setScreen("register"); clearError(); }}>
              Create one
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── OTP — Email ──────────────────────────────────────────────────────────────
  if (screen === "otp-email") {
    return (
      <div style={styles.page}>
        <DevBanner />
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Verify Email</h2>
          <p style={styles.cardSub}>
            A 6-digit code was sent to <strong>{email}</strong>.<br />
            Email verification anchors your Confi identity.
          </p>
          <ErrorBox />
          <InfoBox />
          <OTPInputBlock
            label="Enter 6-digit email OTP"
            onVerify={handleEmailOTPVerify}
            onResend={() => sendOTP(email, "email")}
          />
        </div>
      </div>
    );
  }

  // ── OTP — Phone ──────────────────────────────────────────────────────────────
  if (screen === "otp-phone") {
    return (
      <div style={styles.page}>
        <DevBanner />
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Verify Phone Number</h2>
          <p style={styles.cardSub}>
            International NDAs require a verified phone number as your legal
            identity anchor. This number will be recorded in NDA metadata.
          </p>
          <ErrorBox />
          <InfoBox />

          {!otp.sent ? (
            <>
              <label style={styles.label}>Country Code</label>
              <select
                style={styles.input}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.country})
                  </option>
                ))}
              </select>

              <label style={styles.label}>Phone Number</label>
              <input
                style={styles.input}
                type="tel"
                placeholder="e.g. 4155551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/, ""))}
              />

              <button style={styles.btn} onClick={handleSendPhoneOTP}>
                Send SMS Code
              </button>
            </>
          ) : (
            <OTPInputBlock
              label={`Enter 6-digit SMS OTP sent to ${countryCode}${phone}`}
              onVerify={handlePhoneOTPVerify}
              onResend={() => {
                const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
                sendOTP(fullPhone, "phone");
              }}
            />
          )}

          <button
            style={{ ...styles.linkBtn, marginTop: 12, display: "block" }}
            onClick={() => {
              setOtp({ code: "", sent: false, verified: false, target: "", type: "phone" });
              setOtpInput("");
            }}
          >
            {otp.sent ? "Change number" : ""}
          </button>
        </div>
      </div>
    );
  }

  // ── Profile Setup ────────────────────────────────────────────────────────────
  if (screen === "profile-setup") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Set Up Your Profile</h2>
          <p style={styles.cardSub}>
            Your display name will appear in conversations and NDA documents.
          </p>
          <ErrorBox />

          <div style={styles.avatarPickerWrap}>
            <div style={{ ...styles.avatarLarge, backgroundColor: avatarColor }}>
              {displayName ? initials(displayName) : "?"}
            </div>
            <div style={styles.colorSwatches}>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  style={{
                    ...styles.swatch,
                    backgroundColor: c,
                    border: avatarColor === c ? "3px solid #fff" : "3px solid transparent",
                    transform: avatarColor === c ? "scale(1.2)" : "scale(1)",
                  }}
                  onClick={() => setAvatarColor(c)}
                />
              ))}
            </div>
          </div>

          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Your full name (appears in NDAs)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />

          <div style={styles.identitySummary}>
            <div style={styles.identityRow}>
              <span style={styles.identityIcon}>✉️</span>
              <div>
                <div style={styles.identityLabel}>Email</div>
                <div style={styles.identityValue}>{email}</div>
              </div>
              <span style={styles.verifiedBadge}>✓ Verified</span>
            </div>
            <div style={styles.identityRow}>
              <span style={styles.identityIcon}>📱</span>
              <div>
                <div style={styles.identityLabel}>Phone</div>
                <div style={styles.identityValue}>{countryCode}{phone}</div>
              </div>
              <span style={styles.verifiedBadge}>✓ Verified</span>
            </div>
          </div>

          <button style={styles.btn} onClick={handleProfileSetup}>
            Enter Confi →
          </button>
        </div>
      </div>
    );
  }

  // ── Home / Dashboard ─────────────────────────────────────────────────────────
  if (screen === "home" && user) {
    return (
      <div style={styles.appShell}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.sidebarLogo}>🔐 Confi</div>
          </div>

          <div style={styles.profileCard}>
            <div
              style={{
                ...styles.avatarMed,
                backgroundColor: user.avatarColor || "#3182CE",
              }}
            >
              {user.displayName ? initials(user.displayName) : user.email[0].toUpperCase()}
            </div>
            <div style={styles.profileInfo}>
              <div style={styles.profileName}>{user.displayName || "User"}</div>
              <div style={styles.profileEmail}>{user.email}</div>
              {user.phoneVerified && (
                <div style={styles.phoneVerifiedBadge}>
                  📱 {user.phone} · <strong>ID Verified</strong>
                </div>
              )}
            </div>
          </div>

          <div style={styles.ndaStatus}>
            <div style={styles.ndaStatusTitle}>🛡️ NDA Identity Status</div>
            <div style={styles.ndaStatusRow}>
              <span>Email</span>
              <span style={styles.ndaCheck}>✓ Anchored</span>
            </div>
            <div style={styles.ndaStatusRow}>
              <span>Phone</span>
              <span style={user.phoneVerified ? styles.ndaCheck : styles.ndaMissing}>
                {user.phoneVerified ? "✓ Verified" : "⚠ Not verified"}
              </span>
            </div>
            <div style={styles.ndaStatusRow}>
              <span>Identity</span>
              <span style={styles.ndaCheck}>✓ Auditable</span>
            </div>
          </div>

          <div style={styles.sidebarFooter}>
            <button style={styles.logoutBtn} onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Main area */}
        <div style={styles.main}>
          <div style={styles.welcomeWrap}>
            <div style={styles.welcomeIcon}>🔐</div>
            <h2 style={styles.welcomeTitle}>
              Welcome to Confi, {user.displayName?.split(" ")[0] || "User"}
            </h2>
            <p style={styles.welcomeText}>
              Your identity is verified and auditable. You are ready to send
              confidential messages protected by international NDA.
            </p>

            <div style={styles.identityCard}>
              <h3 style={styles.identityCardTitle}>Your Verified Identity Record</h3>
              <table style={styles.idTable}>
                <tbody>
                  <tr>
                    <td style={styles.idKey}>Display Name</td>
                    <td style={styles.idVal}>{user.displayName || "—"}</td>
                  </tr>
                  <tr>
                    <td style={styles.idKey}>Email</td>
                    <td style={styles.idVal}>{user.email}</td>
                  </tr>
                  <tr>
                    <td style={styles.idKey}>Phone</td>
                    <td style={styles.idVal}>
                      {user.phone || "—"}{" "}
                      {user.phoneVerified && (
                        <span style={styles.verifiedBadge}>✓ SMS Verified</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.idKey}>Session Token</td>
                    <td style={styles.idVal}>
                      <span style={styles.tokenPreview}>
                        {(localStorage.getItem("confi_token") || "").slice(0, 24)}…
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.idKey}>NDA Party Status</td>
                    <td style={styles.idVal}>
                      <span style={styles.ndaReadyBadge}>READY — Identity Provable</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={styles.comingSoon}>
              <h3 style={styles.comingSoonTitle}>Coming Next</h3>
              <div style={styles.comingSoonGrid}>
                {[
                  ["💬", "End-to-end encrypted chat"],
                  ["🔏", "Confidential mode + NDA activation"],
                  ["👥", "Group conversations"],
                  ["📎", "Secure file sharing"],
                  ["🗓️", "NDA expiry & renewal"],
                  ["🌍", "Multi-jurisdiction NDA templates"],
                ].map(([icon, label]) => (
                  <div key={label as string} style={styles.comingSoonItem}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <span style={{ fontSize: 13, marginTop: 6 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  devBanner: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    background: "#D69E2E",
    color: "#000",
    textAlign: "center",
    padding: "8px 16px",
    fontSize: 13,
    zIndex: 1000,
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 440,
    color: "#E2E8F0",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  logoWrap: { textAlign: "center", marginBottom: 28 },
  logo: { fontSize: 56 },
  appName: {
    fontSize: 36,
    fontWeight: 800,
    margin: "8px 0 4px",
    background: "linear-gradient(90deg, #A78BFA, #60A5FA)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  tagline: {
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 1.6,
    margin: 0,
  },
  featureList: { margin: "24px 0" },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  featureIcon: { fontSize: 18, width: 24, textAlign: "center" },
  featureText: { fontSize: 13, color: "#CBD5E0", lineHeight: 1.4 },
  cardTitle: {
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 6px",
    color: "#F7FAFC",
  },
  cardSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#94A3B8",
    marginBottom: 4,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#F7FAFC",
    fontSize: 14,
    marginBottom: 4,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  pwWrap: { position: "relative", marginBottom: 4 },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    padding: 2,
  },
  passwordStrength: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    minHeight: 20,
  },
  strengthBar: {
    display: "flex",
    gap: 4,
    flex: 1,
  },
  strengthSegment: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    transition: "background-color 0.3s",
  },
  strengthLabel: { fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" },
  btn: {
    display: "block",
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #7C3AED, #2563EB)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: 8,
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#94A3B8",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    marginBottom: 12,
  },
  errorBox: {
    background: "rgba(229,62,62,0.15)",
    border: "1px solid rgba(229,62,62,0.4)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#FCA5A5",
    marginBottom: 12,
  },
  infoBox: {
    background: "rgba(56,161,105,0.15)",
    border: "1px solid rgba(56,161,105,0.4)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#6EE7B7",
    marginBottom: 12,
  },
  switchLink: {
    textAlign: "center",
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 14,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#A78BFA",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    textDecoration: "underline",
  },
  otpLabel: { fontSize: 13, color: "#94A3B8", marginBottom: 12 },
  otpRow: { display: "flex", gap: 8, justifyContent: "center" },
  otpCell: {
    width: 46,
    height: 54,
    textAlign: "center",
    fontSize: 20,
    fontWeight: 700,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 10,
    color: "#F7FAFC",
    outline: "none",
  },
  resendRow: { textAlign: "center", marginTop: 14 },
  timerText: { fontSize: 12, color: "#94A3B8" },
  avatarPickerWrap: { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  colorSwatches: { display: "flex", flexWrap: "wrap", gap: 6 },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    cursor: "pointer",
    transition: "transform 0.15s",
  },
  identitySummary: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: "12px 14px",
    marginTop: 12,
    marginBottom: 16,
  },
  identityRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
  },
  identityIcon: { fontSize: 16 },
  identityLabel: { fontSize: 11, color: "#94A3B8" },
  identityValue: { fontSize: 13, color: "#E2E8F0", fontWeight: 500 },
  verifiedBadge: {
    marginLeft: "auto",
    background: "rgba(56,161,105,0.2)",
    color: "#6EE7B7",
    border: "1px solid rgba(56,161,105,0.3)",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  // App Shell
  appShell: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: "#0F0C29",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    width: 300,
    background: "rgba(255,255,255,0.04)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    color: "#E2E8F0",
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: "20px 20px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sidebarLogo: {
    fontSize: 20,
    fontWeight: 800,
    background: "linear-gradient(90deg, #A78BFA, #60A5FA)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  profileCard: {
    display: "flex",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    alignItems: "flex-start",
  },
  avatarMed: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontWeight: 700, fontSize: 14, color: "#F7FAFC" },
  profileEmail: {
    fontSize: 12,
    color: "#94A3B8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  phoneVerifiedBadge: {
    fontSize: 11,
    color: "#6EE7B7",
    marginTop: 4,
  },
  ndaStatus: {
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  ndaStatusTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#A78BFA",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  },
  ndaStatusRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 6,
  },
  ndaCheck: { color: "#6EE7B7", fontWeight: 600 },
  ndaMissing: { color: "#FBBF24", fontWeight: 600 },
  sidebarFooter: { marginTop: "auto", padding: "16px 20px" },
  logoutBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#94A3B8",
    fontSize: 13,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "40px 48px",
    color: "#E2E8F0",
  },
  welcomeWrap: { maxWidth: 680, margin: "0 auto" },
  welcomeIcon: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#F7FAFC",
    margin: "0 0 12px",
  },
  welcomeText: {
    fontSize: 15,
    color: "#94A3B8",
    lineHeight: 1.6,
    marginBottom: 32,
  },
  identityCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "24px 28px",
    marginBottom: 28,
  },
  identityCardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#A78BFA",
    marginTop: 0,
    marginBottom: 16,
  },
  idTable: { width: "100%", borderCollapse: "collapse" },
  idKey: {
    fontSize: 12,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    paddingBottom: 10,
    paddingRight: 20,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  idVal: {
    fontSize: 14,
    color: "#E2E8F0",
    paddingBottom: 10,
  },
  tokenPreview: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#94A3B8",
    wordBreak: "break-all",
  },
  ndaReadyBadge: {
    background: "rgba(124,58,237,0.25)",
    color: "#C4B5FD",
    border: "1px solid rgba(124,58,237,0.4)",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  comingSoon: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "24px 28px",
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#60A5FA",
    marginTop: 0,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  comingSoonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
  },
  comingSoonItem: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: "14px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    color: "#94A3B8",
  },
};