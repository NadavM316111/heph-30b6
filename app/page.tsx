"use client";

import { useState, useEffect, useRef } from "react";

// ── types ──────────────────────────────────────────────────────────────────
type Screen =
  | "landing"
  | "register"
  | "login"
  | "otp"
  | "profile-setup"
  | "dashboard";

type OtpTarget = "email" | "phone";

interface UserProfile {
  email: string;
  displayName: string;
  avatar: string; // emoji avatar
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityId: string;
  createdAt: string;
}

const AVATARS = [
  "🦊","🐺","🦁","🐯","🐻","🐼","🐨","🦝","🦄","🐸",
  "🦋","🐢","🦉","🦚","🦜","🐬","🦈","🦭","🐙","🦑",
];

const COUNTRIES = [
  { code: "+1", name: "US/Canada" },
  { code: "+44", name: "UK" },
  { code: "+61", name: "Australia" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+81", name: "Japan" },
  { code: "+86", name: "China" },
  { code: "+91", name: "India" },
  { code: "+55", name: "Brazil" },
  { code: "+27", name: "South Africa" },
];

// ── helpers ────────────────────────────────────────────────────────────────
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateIdentityId(): string {
  return "IDN-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();
}

function saveSession(user: UserProfile) {
  localStorage.setItem("confi_user", JSON.stringify(user));
}

function loadSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem("confi_user");
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("confi_user");
}

// ── main component ─────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<UserProfile | null>(null);

  // form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

  // OTP state
  const [otpTarget, setOtpTarget] = useState<OtpTarget>("email");
  const [otpSent, setOtpSent] = useState("");
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [otpPurpose, setOtpPurpose] = useState<"verify-email" | "verify-phone" | "login-2fa">("verify-email");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ui state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const saved = loadSession();
    if (saved) {
      setUser(saved);
      setScreen("dashboard");
    }
  }, []);

  // ── auth helpers ───────────────────────────────────────────────────────
  async function handleRegister() {
    setError("");
    if (!email || !password || !confirmPassword) {
      setError("All fields are required.");
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
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Registration failed.");
        return;
      }
      // send email OTP
      const otp = generateOtp();
      setOtpSent(otp);
      setPendingUser({ email: data.email, identityId: generateIdentityId(), createdAt: new Date().toISOString() });
      setOtpTarget("email");
      setOtpPurpose("verify-email");
      setOtpInput(["", "", "", "", "", ""]);
      setInfo(`Demo OTP for ${data.email}: ${otp}`);
      setScreen("otp");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Login failed. Check your credentials.");
        return;
      }
      // check for saved profile
      const saved = loadSession();
      if (saved && saved.email === data.email) {
        setUser(saved);
        setScreen("dashboard");
        return;
      }
      // 2FA via email OTP
      const otp = generateOtp();
      setOtpSent(otp);
      setPendingUser({ email: data.email });
      setOtpTarget("email");
      setOtpPurpose("login-2fa");
      setOtpInput(["", "", "", "", "", ""]);
      setInfo(`Demo OTP for ${data.email}: ${otp}`);
      setScreen("otp");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpInput];
    next[idx] = val;
    setOtpInput(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpInput[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  function handleVerifyOtp() {
    setError("");
    const entered = otpInput.join("");
    if (entered.length < 6) {
      setError("Enter the full 6-digit code.");
      return;
    }
    if (entered !== otpSent) {
      setError("Incorrect code. Please try again.");
      return;
    }
    setInfo("");
    if (otpPurpose === "verify-email") {
      setPendingUser((p) => ({ ...p, emailVerified: true }));
      setScreen("profile-setup");
    } else if (otpPurpose === "verify-phone") {
      const updated: UserProfile = {
        ...(pendingUser as UserProfile),
        phone: `${countryCode}${phone}`,
        phoneVerified: true,
      };
      saveSession(updated);
      setUser(updated);
      setScreen("dashboard");
    } else if (otpPurpose === "login-2fa") {
      const saved = loadSession();
      if (saved && saved.email === pendingUser.email) {
        setUser(saved);
        setScreen("dashboard");
      } else {
        // create minimal profile for returning user without local profile
        const newUser: UserProfile = {
          email: pendingUser.email!,
          displayName: pendingUser.email!.split("@")[0],
          avatar: AVATARS[0],
          phone: "",
          emailVerified: true,
          phoneVerified: false,
          identityId: generateIdentityId(),
          createdAt: new Date().toISOString(),
        };
        saveSession(newUser);
        setUser(newUser);
        setScreen("dashboard");
      }
    }
  }

  function handleResendOtp() {
    const otp = generateOtp();
    setOtpSent(otp);
    setOtpInput(["", "", "", "", "", ""]);
    setError("");
    setInfo(
      otpTarget === "email"
        ? `New demo OTP for ${pendingUser.email}: ${otp}`
        : `New demo OTP for ${countryCode}${phone}: ${otp}`
    );
    otpRefs.current[0]?.focus();
  }

  function handleSendPhoneOtp() {
    setError("");
    if (!phone || phone.length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    const otp = generateOtp();
    setOtpSent(otp);
    setOtpTarget("phone");
    setOtpPurpose("verify-phone");
    setOtpInput(["", "", "", "", "", ""]);
    setInfo(`Demo OTP for ${countryCode}${phone}: ${otp}`);
    setScreen("otp");
  }

  function handleCompleteProfile() {
    setError("");
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    const newUser: UserProfile = {
      email: pendingUser.email!,
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      phone: pendingUser.phone || "",
      emailVerified: pendingUser.emailVerified ?? true,
      phoneVerified: pendingUser.phoneVerified ?? false,
      identityId: pendingUser.identityId || generateIdentityId(),
      createdAt: pendingUser.createdAt || new Date().toISOString(),
    };
    if (phone) {
      // send phone OTP
      handleSendPhoneOtp();
      setPendingUser({ ...newUser });
    } else {
      saveSession(newUser);
      setUser(newUser);
      setScreen("dashboard");
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPhone("");
    setDisplayName("");
    setError("");
    setInfo("");
    setScreen("landing");
  }

  // ── render helpers ─────────────────────────────────────────────────────
  const VerifiedBadge = ({ ok }: { ok: boolean }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
      background: ok ? "#d1fae5" : "#fee2e2",
      color: ok ? "#065f46" : "#991b1b",
    }}>
      {ok ? "✓ Verified" : "✗ Unverified"}
    </span>
  );

  // ── SCREENS ────────────────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={styles.logo}>🔐</div>
            <h1 style={styles.title}>Confi</h1>
            <p style={styles.subtitle}>
              Confidential Messaging with Legal-Grade Identity Verification
            </p>
          </div>
          <div style={styles.featureList}>
            {[
              ["📧", "Email OTP verification"],
              ["📱", "Phone number as identity anchor"],
              ["⚖️", "NDA-backed confidential conversations"],
              ["🛡️", "Auditable verified identity records"],
            ].map(([icon, text]) => (
              <div key={text} style={styles.featureItem}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 14, color: "#374151" }}>{text}</span>
              </div>
            ))}
          </div>
          <button style={styles.btnPrimary} onClick={() => { setScreen("register"); setError(""); }}>
            Create Account
          </button>
          <button style={styles.btnSecondary} onClick={() => { setScreen("login"); setError(""); }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => { setScreen("landing"); setError(""); }}>← Back</button>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={styles.logo}>🔐</div>
            <h2 style={styles.title}>Create Account</h2>
            <p style={styles.subtitle}>Start your verified identity</p>
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />
          <label style={styles.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              style={{ ...styles.input, paddingRight: 44 }}
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              style={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              type="button"
            >{showPassword ? "🙈" : "👁️"}</button>
          </div>
          <label style={styles.label}>Confirm Password</label>
          <input
            style={styles.input}
            type={showPassword ? "text" : "password"}
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />
          <div style={styles.passwordStrength}>
            {["8+ chars", "A-Z", "0-9"].map((req) => {
              const met =
                req === "8+ chars" ? password.length >= 8 :
                req === "A-Z" ? /[A-Z]/.test(password) :
                /\d/.test(password);
              return (
                <span key={req} style={{ ...styles.reqBadge, background: met ? "#d1fae5" : "#f3f4f6", color: met ? "#065f46" : "#6b7280" }}>
                  {met ? "✓" : "○"} {req}
                </span>
              );
            })}
          </div>
          <button style={{ ...styles.btnPrimary, marginTop: 8 }} onClick={handleRegister} disabled={loading}>
            {loading ? "Creating account…" : "Continue →"}
          </button>
          <p style={styles.switchText}>
            Already have an account?{" "}
            <button style={styles.linkBtn} onClick={() => { setScreen("login"); setError(""); }}>Sign in</button>
          </p>
        </div>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => { setScreen("landing"); setError(""); }}>← Back</button>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={styles.logo}>🔐</div>
            <h2 style={styles.title}>Welcome Back</h2>
            <p style={styles.subtitle}>Sign in to your verified identity</p>
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label style={styles.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              style={{ ...styles.input, paddingRight: 44 }}
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              style={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              type="button"
            >{showPassword ? "🙈" : "👁️"}</button>
          </div>
          <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
          <p style={styles.switchText}>
            No account?{" "}
            <button style={styles.linkBtn} onClick={() => { setScreen("register"); setError(""); }}>Create one</button>
          </p>
        </div>
      </div>
    );
  }

  if (screen === "otp") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={styles.logo}>{otpTarget === "email" ? "📧" : "📱"}</div>
            <h2 style={styles.title}>Verify {otpTarget === "email" ? "Email" : "Phone"}</h2>
            <p style={styles.subtitle}>
              Enter the 6-digit code sent to{" "}
              <strong>
                {otpTarget === "email" ? pendingUser.email : `${countryCode}${phone}`}
              </strong>
            </p>
          </div>
          {info && (
            <div style={styles.infoBox}>
              <strong>🧪 Demo Mode</strong><br />{info}
            </div>
          )}
          {error && <div style={styles.errorBox}>{error}</div>}
          <div style={styles.otpRow}>
            {otpInput.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { otpRefs.current[idx] = el; }}
                style={styles.otpBox}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              />
            ))}
          </div>
          <button style={{ ...styles.btnPrimary, marginTop: 24 }} onClick={handleVerifyOtp}>
            Verify Code
          </button>
          <button style={styles.btnGhost} onClick={handleResendOtp}>
            Resend Code
          </button>
          {otpPurpose === "verify-phone" && (
            <button style={styles.btnGhost} onClick={() => { setScreen("profile-setup"); setError(""); setInfo(""); }}>
              Skip phone verification
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "profile-setup") {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={styles.logo}>👤</div>
            <h2 style={styles.title}>Set Up Profile</h2>
            <p style={styles.subtitle}>Your identity will be used in NDA agreements</p>
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}

          <label style={styles.label}>Choose Avatar</label>
          <div style={styles.avatarGrid}>
            {AVATARS.map((av) => (
              <button
                key={av}
                style={{
                  ...styles.avatarBtn,
                  background: selectedAvatar === av ? "#ede9fe" : "#f9fafb",
                  border: selectedAvatar === av ? "2px solid #7c3aed" : "2px solid #e5e7eb",
                  transform: selectedAvatar === av ? "scale(1.15)" : "scale(1)",
                }}
                onClick={() => setSelectedAvatar(av)}
              >
                {av}
              </button>
            ))}
          </div>

          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="How should others see you?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <label style={styles.label}>Phone Number (optional — required for NDA signing)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              style={{ ...styles.input, width: 130, flex: "none" }}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} {c.name}</option>
              ))}
            </select>
            <input
              style={{ ...styles.input, flex: 1 }}
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div style={styles.identityCard}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>🛡️ Your Verified Identity Record</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#374151" }}>
              ID: {pendingUser.identityId || "Generating…"}<br />
              Email: {pendingUser.email}<br />
              Registered: {pendingUser.createdAt ? new Date(pendingUser.createdAt).toLocaleString() : "—"}
            </div>
          </div>

          <button style={{ ...styles.btnPrimary, marginTop: 8 }} onClick={handleCompleteProfile}>
            {phone ? "Verify Phone & Finish →" : "Complete Setup →"}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "dashboard" && user) {
    return (
      <div style={styles.root}>
        <div style={{ ...styles.card, maxWidth: 480 }}>
          {/* Header */}
          <div style={styles.dashHeader}>
            <div style={styles.dashAvatar}>{user.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>{user.displayName}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{user.email}</div>
            </div>
            <button style={styles.logoutBtn} onClick={handleLogout} title="Sign out">⎋</button>
          </div>

          {/* Identity Record */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🛡️ Verified Identity Record</h3>
            <div style={styles.identityCard}>
              <div style={styles.identityRow}>
                <span style={styles.identityLabel}>Identity ID</span>
                <span style={{ ...styles.identityValue, fontFamily: "monospace", fontSize: 10 }}>{user.identityId}</span>
              </div>
              <div style={styles.identityRow}>
                <span style={styles.identityLabel}>Email</span>
                <span style={styles.identityValue}>{user.email} <VerifiedBadge ok={user.emailVerified} /></span>
              </div>
              <div style={styles.identityRow}>
                <span style={styles.identityLabel}>Phone</span>
                <span style={styles.identityValue}>
                  {user.phone || <span style={{ color: "#9ca3af" }}>Not provided</span>}{" "}
                  {user.phone && <VerifiedBadge ok={user.phoneVerified} />}
                </span>
              </div>
              <div style={styles.identityRow}>
                <span style={styles.identityLabel}>Registered</span>
                <span style={styles.identityValue}>{new Date(user.createdAt).toLocaleString()}</span>
              </div>
              <div style={styles.identityRow}>
                <span style={styles.identityLabel}>NDA Eligible</span>
                <span style={styles.identityValue}>
                  <VerifiedBadge ok={user.emailVerified} />
                  {!user.emailVerified && <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>Verify email to enable NDA</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Phone verification prompt */}
          {!user.phoneVerified && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📱 Add Phone Verification</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                Phone verification is required to sign NDA agreements. Add your number to unlock confidential messaging.
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  style={{ ...styles.input, width: 130, flex: "none" }}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} {c.name}</option>
                  ))}
                </select>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {error && <div style={styles.errorBox}>{error}</div>}
              <button
                style={styles.btnPrimary}
                onClick={() => {
                  setPendingUser({ ...user });
                  handleSendPhoneOtp();
                }}
              >
                Send Verification Code
              </button>
            </div>
          )}

          {/* Messaging teaser */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💬 Confidential Messaging</h3>
            <div style={styles.featurePreview}>
              <div style={styles.previewItem}>
                <span style={styles.previewIcon}>🔒</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Standard Messages</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>End-to-end encrypted chat</div>
                </div>
                <span style={styles.previewStatus}>Available</span>
              </div>
              <div style={styles.previewItem}>
                <span style={styles.previewIcon}>⚖️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Confidential Mode</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>NDA-backed conversations</div>
                </div>
                <span style={{ ...styles.previewStatus, background: user.emailVerified ? "#fef3c7" : "#fee2e2", color: user.emailVerified ? "#92400e" : "#991b1b" }}>
                  {user.emailVerified ? "Coming Soon" : "Needs Verification"}
                </span>
              </div>
              <div style={styles.previewItem}>
                <span style={styles.previewIcon}>📋</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>NDA Agreements</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>International legal coverage</div>
                </div>
                <span style={{ ...styles.previewStatus, background: user.phoneVerified ? "#fef3c7" : "#fee2e2", color: user.phoneVerified ? "#92400e" : "#991b1b" }}>
                  {user.phoneVerified ? "Coming Soon" : "Needs Phone"}
                </span>
              </div>
            </div>
          </div>

          {/* Legal notice */}
          <div style={styles.legalNotice}>
            <strong>⚠️ Legal Notice:</strong> Your verified identity record (ID: {user.identityId.slice(0, 16)}…) will be
            referenced in all NDA agreements you enter. Ensure your details are accurate — falsified identity in
            NDA contexts may constitute fraud under applicable law.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── styles ─────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 25px 50px rgba(0,0,0,0.35)",
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
    display: "block",
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
    margin: "0 0 6px",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    margin: 0,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 15,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    background: "#f9fafb",
    transition: "border-color 0.15s",
  },
  btnPrimary: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
    letterSpacing: 0.2,
    transition: "opacity 0.15s",
  },
  btnSecondary: {
    width: "100%",
    padding: "13px",
    background: "#f3f4f6",
    color: "#374151",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 10,
  },
  btnGhost: {
    width: "100%",
    padding: "10px",
    background: "transparent",
    color: "#7c3aed",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#7c3aed",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    padding: "0 0 16px",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  infoBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 1.6,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 28,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "#f5f3ff",
    borderRadius: 10,
  },
  passwordStrength: {
    display: "flex",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  reqBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 8,
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
    padding: 0,
    lineHeight: 1,
  },
  otpRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
  },
  otpBox: {
    width: 48,
    height: 56,
    textAlign: "center",
    fontSize: 24,
    fontWeight: 700,
    border: "2px solid #e5e7eb",
    borderRadius: 12,
    color: "#111827",
    outline: "none",
    background: "#f9fafb",
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(10, 1fr)",
    gap: 6,
    marginBottom: 4,
  },
  avatarBtn: {
    border: "none",
    borderRadius: 10,
    fontSize: 22,
    padding: 6,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  identityCard: {
    background: "#f5f3ff",
    border: "1.5px solid #ddd6fe",
    borderRadius: 12,
    padding: "12px 16px",
    marginTop: 12,
    marginBottom: 4,
  },
  dashHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 0 20px",
    borderBottom: "1.5px solid #f3f4f6",
    marginBottom: 20,
  },
  dashAvatar: {
    fontSize: 44,
    width: 56,
    height: 56,
    background: "#f5f3ff",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutBtn: {
    background: "#fef2f2",
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 18,
    cursor: "pointer",
    color: "#dc2626",
  },
  section: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: "1px solid #f3f4f6",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 12px",
  },
  identityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid #ede9fe",
    flexWrap: "wrap",
    gap: 4,
  },
  identityLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    minWidth: 80,
  },
  identityValue: {
    fontSize: 12,
    color: "#374151",
    textAlign: "right",
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  featurePreview: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  previewItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "#f9fafb",
    borderRadius: 10,
    border: "1px solid #f3f4f6",
  },
  previewIcon: {
    fontSize: 24,
    width: 36,
    textAlign: "center",
    flexShrink: 0,
  },
  previewStatus: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 8,
    background: "#d1fae5",
    color: "#065f46",
    marginLeft: "auto",
    flexShrink: 0,
  },
  legalNotice: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 11,
    color: "#9a3412",
    lineHeight: 1.6,
    marginTop: 4,
  },
  switchText: {
    textAlign: "center",
    fontSize: 13,
    color: "#6b7280",
    marginTop: 14,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#7c3aed",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
  },
};