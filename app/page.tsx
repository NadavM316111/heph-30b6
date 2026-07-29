"use client";

import { useEffect, useState, useRef } from "react";

type Stage =
  | "landing"
  | "register-phone"
  | "register-otp"
  | "register-email"
  | "register-profile"
  | "login-phone"
  | "login-otp"
  | "login-email"
  | "login-password"
  | "recovery"
  | "recovery-otp"
  | "recovery-reset"
  | "home";

interface UserProfile {
  email: string;
  phone?: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [serverOtp, setServerOtp] = useState(""); // dev-only: shown in UI
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const saved = localStorage.getItem("confi_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setStage("home");
      } catch {}
    }
  }, []);

  function clearErrors() {
    setError("");
    setInfo("");
  }

  function logout() {
    localStorage.removeItem("confi_user");
    localStorage.removeItem("confi_session");
    setUser(null);
    setStage("landing");
    setPhone("");
    setEmail("");
    setPassword("");
    setOtp("");
    setDisplayName("");
    setHandle("");
    setAvatarPreview("");
    setAvatarBase64("");
    setServerOtp("");
    clearErrors();
  }

  async function sendOtp(targetPhone: string) {
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const data = await res.json();
      if (data.ok) {
        setOtpSent(true);
        if (data.devOtp) {
          setServerOtp(data.devOtp);
          setInfo(`Dev mode — OTP: ${data.devOtp}`);
        } else {
          setInfo("OTP sent to " + targetPhone);
        }
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch {
      setError("Network error sending OTP");
    }
    setLoading(false);
  }

  async function verifyOtp(targetPhone: string, code: string): Promise<boolean> {
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: targetPhone, otp: code }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) return true;
      setError(data.error || "Invalid OTP");
      return false;
    } catch {
      setError("Network error verifying OTP");
      setLoading(false);
      return false;
    }
  }

  async function checkHandleAvailability(h: string) {
    if (!h || h.length < 3) {
      setHandleAvailable(null);
      return;
    }
    setCheckingHandle(true);
    try {
      const res = await fetch(`/api/handle/check?handle=${encodeURIComponent(h)}`);
      const data = await res.json();
      setHandleAvailable(data.available);
    } catch {
      setHandleAvailable(null);
    }
    setCheckingHandle(false);
  }

  function onHandleChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setHandle(clean);
    setHandleAvailable(null);
    if (handleDebounceRef.current) clearTimeout(handleDebounceRef.current);
    handleDebounceRef.current = setTimeout(() => checkHandleAvailability(clean), 600);
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result);
    };
    reader.readAsDataURL(file);
  }

  // ── REGISTER FLOW ──────────────────────────────────────────────────────────

  async function handleRegisterPhoneNext() {
    if (!phone.match(/^\+?[1-9]\d{7,14}$/)) {
      setError("Enter a valid phone number with country code, e.g. +12125551234");
      return;
    }
    await sendOtp(phone);
    if (!error) setStage("register-otp");
  }

  async function handleRegisterOtpNext() {
    if (otp.length < 4) { setError("Enter the OTP"); return; }
    const ok = await verifyOtp(phone, otp);
    if (ok) {
      setOtp("");
      setStage("register-email");
    }
  }

  async function handleRegisterEmailNext() {
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setStage("register-profile");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  async function handleRegisterProfileNext() {
    if (!displayName.trim()) { setError("Display name is required"); return; }
    if (!handle || handle.length < 3) { setError("Handle must be at least 3 characters"); return; }
    if (handleAvailable === false) { setError("Handle is taken"); return; }

    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          displayName: displayName.trim(),
          handle,
          avatarBase64,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const profile: UserProfile = {
          email,
          phone,
          displayName: displayName.trim(),
          handle,
          avatarUrl: data.avatarUrl || avatarPreview,
        };
        localStorage.setItem("confi_user", JSON.stringify(profile));
        setUser(profile);
        setStage("home");
        setInfo("Welcome to Confi, " + displayName.trim() + "!");
      } else {
        setError(data.error || "Profile save failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  // ── LOGIN FLOW ─────────────────────────────────────────────────────────────

  async function handleLoginPhoneNext() {
    if (!phone.match(/^\+?[1-9]\d{7,14}$/)) {
      setError("Enter a valid phone number");
      return;
    }
    await sendOtp(phone);
    if (!error) setStage("login-otp");
  }

  async function handleLoginOtpNext() {
    if (otp.length < 4) { setError("Enter the OTP"); return; }
    const ok = await verifyOtp(phone, otp);
    if (ok) {
      // Look up account by phone
      setLoading(true);
      try {
        const res = await fetch("/api/profile/by-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (data.ok && data.profile) {
          localStorage.setItem("confi_user", JSON.stringify(data.profile));
          setUser(data.profile);
          setStage("home");
        } else {
          setError("No account found for this phone number. Please register.");
        }
      } catch {
        setError("Network error");
      }
      setLoading(false);
    }
  }

  async function handleLoginEmailNext() {
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setStage("login-password");
  }

  async function handleLoginPasswordNext() {
    if (!password) { setError("Enter your password"); return; }
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        // Load profile
        const pRes = await fetch("/api/profile/by-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const pData = await pRes.json();
        const profile: UserProfile = pData.profile || { email };
        localStorage.setItem("confi_user", JSON.stringify(profile));
        setUser(profile);
        setStage("home");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  // ── RECOVERY FLOW ──────────────────────────────────────────────────────────

  async function handleRecoveryNext() {
    if (!phone.match(/^\+?[1-9]\d{7,14}$/) && !email.includes("@")) {
      setError("Enter a valid phone number or email");
      return;
    }
    if (phone.match(/^\+?[1-9]\d{7,14}$/)) {
      await sendOtp(phone);
      if (!error) setStage("recovery-otp");
    } else {
      // Email recovery
      setLoading(true);
      clearErrors();
      try {
        const res = await fetch("/api/recovery/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) {
          setInfo("Recovery instructions sent to " + email);
          if (data.devToken) {
            setInfo(`Dev mode — recovery token: ${data.devToken}`);
            setStage("recovery-reset");
          }
        } else {
          setError(data.error || "Recovery failed");
        }
      } catch {
        setError("Network error");
      }
      setLoading(false);
    }
  }

  async function handleRecoveryOtpNext() {
    if (otp.length < 4) { setError("Enter the OTP"); return; }
    const ok = await verifyOtp(phone, otp);
    if (ok) {
      setOtp("");
      setStage("recovery-reset");
    }
  }

  async function handleRecoveryResetNext() {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    clearErrors();
    try {
      const res = await fetch("/api/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone || undefined, email: email || undefined, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setInfo("Password reset! Please log in.");
        setStage("login-email");
        setPassword("");
        setConfirmPassword("");
      } else {
        setError(data.error || "Reset failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>🔐 Confi</div>
          <div style={styles.tagline}>Confidential Messaging</div>
        </div>

        {/* Alerts */}
        {error && <div style={styles.alertError}>{error}</div>}
        {info && <div style={styles.alertInfo}>{info}</div>}

        {/* ── LANDING ── */}
        {stage === "landing" && (
          <div style={styles.section}>
            <p style={styles.description}>
              Secure, confidential messaging protected by internationally enforceable NDA. Every
              conversation is legally shielded. Register to get started.
            </p>
            <button style={styles.btnPrimary} onClick={() => { clearErrors(); setStage("register-phone"); }}>
              Create Account
            </button>
            <button style={styles.btnSecondary} onClick={() => { clearErrors(); setStage("login-phone"); }}>
              Log In with Phone
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("login-email"); }}>
              Log In with Email
            </button>
          </div>
        )}

        {/* ── REGISTER: PHONE ── */}
        {stage === "register-phone" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Step 1 — Verify Your Phone</h2>
            <p style={styles.hint}>Your phone number is your primary identity on Confi.</p>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+12125551234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRegisterPhoneNext}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("landing"); }}>Back</button>
          </div>
        )}

        {/* ── REGISTER: OTP ── */}
        {stage === "register-otp" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Step 1 — Enter OTP</h2>
            <p style={styles.hint}>Enter the code sent to {phone}</p>
            <label style={styles.label}>One-Time Password</label>
            <input
              style={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRegisterOtpNext}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            <button style={styles.btnGhost} onClick={() => sendOtp(phone)}>Resend OTP</button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("register-phone"); }}>Back</button>
          </div>
        )}

        {/* ── REGISTER: EMAIL ── */}
        {stage === "register-email" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Step 2 — Email & Password</h2>
            <p style={styles.hint}>Email is used for account recovery and legal notices.</p>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label style={styles.label}>Confirm Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRegisterEmailNext}>
              {loading ? "Creating…" : "Continue"}
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("register-otp"); }}>Back</button>
          </div>
        )}

        {/* ── REGISTER: PROFILE ── */}
        {stage === "register-profile" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Step 3 — Set Up Profile</h2>

            {/* Avatar */}
            <div style={styles.avatarRow}>
              <div
                style={{ ...styles.avatarCircle, backgroundImage: avatarPreview ? `url(${avatarPreview})` : "none" }}
                onClick={() => fileInputRef.current?.click()}
              >
                {!avatarPreview && <span style={styles.avatarPlaceholder}>+</span>}
              </div>
              <div>
                <div style={styles.hint}>Tap to upload avatar (max 2MB)</div>
                <button style={styles.btnGhost} onClick={() => fileInputRef.current?.click()}>Choose Image</button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAvatarChange}
              />
            </div>

            <label style={styles.label}>Display Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Your Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

            <label style={styles.label}>Unique Handle</label>
            <div style={styles.handleRow}>
              <span style={styles.atSign}>@</span>
              <input
                style={{ ...styles.input, flex: 1, margin: 0 }}
                type="text"
                placeholder="yourhandle"
                value={handle}
                onChange={(e) => onHandleChange(e.target.value)}
                maxLength={30}
              />
            </div>
            {checkingHandle && <div style={styles.hint}>Checking…</div>}
            {!checkingHandle && handleAvailable === true && handle.length >= 3 && (
              <div style={{ color: "#22c55e", fontSize: 13 }}>✓ @{handle} is available</div>
            )}
            {!checkingHandle && handleAvailable === false && (
              <div style={{ color: "#ef4444", fontSize: 13 }}>✗ @{handle} is taken</div>
            )}

            <button
              style={styles.btnPrimary}
              disabled={loading || handleAvailable === false || checkingHandle}
              onClick={handleRegisterProfileNext}
            >
              {loading ? "Saving…" : "Create My Account"}
            </button>
          </div>
        )}

        {/* ── LOGIN: PHONE ── */}
        {stage === "login-phone" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Log In — Phone OTP</h2>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+12125551234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleLoginPhoneNext}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("login-email"); }}>
              Use Email Instead
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("landing"); }}>Back</button>
          </div>
        )}

        {/* ── LOGIN: OTP ── */}
        {stage === "login-otp" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Log In — Enter OTP</h2>
            <p style={styles.hint}>Enter the code sent to {phone}</p>
            <label style={styles.label}>One-Time Password</label>
            <input
              style={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleLoginOtpNext}>
              {loading ? "Verifying…" : "Log In"}
            </button>
            <button style={styles.btnGhost} onClick={() => sendOtp(phone)}>Resend OTP</button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("login-phone"); }}>Back</button>
          </div>
        )}

        {/* ── LOGIN: EMAIL ── */}
        {stage === "login-email" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Log In — Email</h2>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button style={styles.btnPrimary} onClick={handleLoginEmailNext}>Continue</button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("login-phone"); }}>
              Use Phone Instead
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("landing"); }}>Back</button>
          </div>
        )}

        {/* ── LOGIN: PASSWORD ── */}
        {stage === "login-password" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Log In — Password</h2>
            <p style={styles.hint}>{email}</p>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleLoginPasswordNext}>
              {loading ? "Logging in…" : "Log In"}
            </button>
            <button
              style={styles.btnGhost}
              onClick={() => { clearErrors(); setEmail(""); setStage("recovery"); }}
            >
              Forgot Password
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("login-email"); }}>Back</button>
          </div>
        )}

        {/* ── RECOVERY ── */}
        {stage === "recovery" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Account Recovery</h2>
            <p style={styles.hint}>Enter your phone number or email to recover your account.</p>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+12125551234 (preferred)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div style={styles.orDivider}>— or —</div>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRecoveryNext}>
              {loading ? "Sending…" : "Send Recovery Code"}
            </button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("landing"); }}>Back</button>
          </div>
        )}

        {/* ── RECOVERY OTP ── */}
        {stage === "recovery-otp" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Recovery — Verify OTP</h2>
            <p style={styles.hint}>Enter the code sent to {phone}</p>
            <label style={styles.label}>One-Time Password</label>
            <input
              style={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRecoveryOtpNext}>
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button style={styles.btnGhost} onClick={() => sendOtp(phone)}>Resend OTP</button>
            <button style={styles.btnGhost} onClick={() => { clearErrors(); setStage("recovery"); }}>Back</button>
          </div>
        )}

        {/* ── RECOVERY RESET ── */}
        {stage === "recovery-reset" && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Recovery — New Password</h2>
            <label style={styles.label}>New Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label style={styles.label}>Confirm Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button style={styles.btnPrimary} disabled={loading} onClick={handleRecoveryResetNext}>
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        )}

        {/* ── HOME ── */}
        {stage === "home" && user && (
          <div style={styles.section}>
            <div style={styles.profileCard}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" style={styles.avatarImg} />
              ) : (
                <div style={styles.avatarFallback}>
                  {(user.displayName || user.email)[0].toUpperCase()}
                </div>
              )}
              <div>
                <div style={styles.profileName}>{user.displayName || "User"}</div>
                {user.handle && <div style={styles.profileHandle}>@{user.handle}</div>}
                <div style={styles.profileEmail}>{user.email}</div>
                {user.phone && <div style={styles.profilePhone}>{user.phone}</div>}
              </div>
            </div>

            <div style={styles.statusBox}>
              <span style={styles.statusDot}>●</span>
              <span style={styles.statusText}>Identity Verified</span>
            </div>

            <div style={styles.ndaBox}>
              <div style={styles.ndaTitle}>🔒 Confi NDA Shield</div>
              <div style={styles.ndaBody}>
                Your verified identity is now tied to Confi's International Confidentiality
                Framework. All conversations you mark confidential are covered under legally
                binding NDA terms, enforceable across 190+ jurisdictions via the Hague
                Convention and mutual recognition treaties.
              </div>
              <div style={styles.ndaStatus}>Ready to activate on conversations</div>
            </div>

            <div style={styles.comingSoon}>
              <div style={styles.comingSoonTitle}>Coming Next</div>
              <ul style={styles.featureList}>
                <li>💬 End-to-end encrypted messaging</li>
                <li>🔏 Per-conversation NDA activation</li>
                <li>📋 NDA agreement & audit trail</li>
                <li>👥 Contacts with verified @handles</li>
                <li>📞 Voice & video calls</li>
              </ul>
            </div>

            <button style={styles.btnDanger} onClick={logout}>Log Out</button>
          </div>
        )}

        {/* Progress indicator */}
        {["register-phone", "register-otp", "register-email", "register-profile"].includes(stage) && (
          <div style={styles.progress}>
            {[1, 2, 3, 4].map((n) => {
              const current =
                stage === "register-phone" ? 1 :
                stage === "register-otp" ? 1 :
                stage === "register-email" ? 2 : 3;
              return (
                <div
                  key={n}
                  style={{
                    ...styles.progressDot,
                    background: n <= current ? "#6366f1" : "#e2e8f0",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
  },
  header: {
    textAlign: "center",
    marginBottom: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: "#4f46e5",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e1b4b",
    margin: 0,
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
    margin: 0,
  },
  hint: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: -6,
  },
  input: {
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    color: "#1e293b",
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.3,
  },
  btnSecondary: {
    background: "#f1f5f9",
    color: "#4f46e5",
    border: "1.5px solid #c7d2fe",
    borderRadius: 10,
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnGhost: {
    background: "transparent",
    color: "#6366f1",
    border: "none",
    borderRadius: 10,
    padding: "8px 0",
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "underline",
  },
  btnDanger: {
    background: "#fee2e2",
    color: "#dc2626",
    border: "1.5px solid #fca5a5",
    borderRadius: 10,
    padding: "12px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  alertError: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 8,
  },
  alertInfo: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#166534",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 8,
    fontFamily: "monospace",
  },
  avatarRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#e0e7ff",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "3px dashed #a5b4fc",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    fontSize: 28,
    color: "#6366f1",
    fontWeight: 700,
  },
  handleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    paddingLeft: 10,
  },
  atSign: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  orDivider: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
  },
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#f8fafc",
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 8,
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #a5b4fc",
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e293b",
  },
  profileHandle: {
    fontSize: 14,
    color: "#6366f1",
    fontWeight: 600,
  },
  profileEmail: {
    fontSize: 12,
    color: "#94a3b8",
  },
  profilePhone: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statusBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 8,
    padding: "8px 14px",
  },
  statusDot: {
    color: "#22c55e",
    fontSize: 12,
  },
  statusText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: 600,
  },
  ndaBox: {
    background: "linear-gradient(135deg, #1e1b4b, #312e81)",
    borderRadius: 14,
    padding: "18px 20px",
    color: "#fff",
  },
  ndaTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 8,
  },
  ndaBody: {
    fontSize: 12,
    lineHeight: 1.7,
    color: "#c7d2fe",
    marginBottom: 10,
  },
  ndaStatus: {
    fontSize: 12,
    color: "#a5b4fc",
    fontStyle: "italic",
  },
  comingSoon: {
    background: "#fafafa",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "14px 18px",
  },
  comingSoonTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  featureList: {
    margin: 0,
    padding: "0 0 0 4px",
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  progress: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    transition: "background 0.3s",
  },
};