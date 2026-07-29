"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: number;
  phone: string;
  email?: string;
  display_name: string;
  avatar_color: string;
  kyc_verified: boolean;
  kyc_name?: string;
  kyc_dob?: string;
  created_at: string;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

type Screen =
  | "phone_entry"
  | "otp_verify"
  | "profile_setup"
  | "email_backup"
  | "dashboard"
  | "kyc"
  | "settings";

const AVATAR_COLORS = [
  "#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7",
  "#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

async function apiFetch(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("phone_entry");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Phone entry
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");

  // OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpRefs] = useState(() => Array.from({ length: 6 }, () => ({ current: null as HTMLInputElement | null })));
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpExpired, setOtpExpired] = useState(false);
  const [devOtp, setDevOtp] = useState(""); // shown in dev for demo

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  // Email
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // KYC
  const [kycName, setKycName] = useState("");
  const [kycDob, setKycDob] = useState("");

  // Settings
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [showRefreshInfo, setShowRefreshInfo] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── On mount: restore session ──────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("confi_session");
    if (stored) {
      try {
        const parsed: Session = JSON.parse(stored);
        setSession(parsed);
        setScreen("dashboard");
      } catch {
        localStorage.removeItem("confi_session");
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    });
  }, []);

  // ── OTP countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === "otp_verify") {
      setOtpTimer(60);
      setOtpExpired(false);
      timerRef.current = setInterval(() => {
        setOtpTimer((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setOtpExpired(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  function saveSession(s: Session) {
    setSession(s);
    localStorage.setItem("confi_session", JSON.stringify(s));
  }

  function clearError() { setError(""); }
  function clearSuccess() { setSuccess(""); }

  // ── Refresh token silently ─────────────────────────────────────────────────
  async function refreshSession(current: Session): Promise<Session | null> {
    const data = await apiFetch("/api/auth/refresh", { refreshToken: current.refreshToken });
    if (data.ok) {
      const updated = { ...current, accessToken: data.accessToken };
      saveSession(updated);
      return updated;
    }
    return null;
  }

  // ── Send OTP ───────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    clearError();
    const fullPhone = countryCode + phone.replace(/\D/g, "");
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    const data = await apiFetch("/api/auth/otp/send", { phone: fullPhone });
    setLoading(false);
    if (data.ok) {
      setDevOtp(data.devOtp || "");
      setScreen("otp_verify");
    } else {
      setError(data.error || "Failed to send OTP.");
    }
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    clearError();
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code."); return; }
    const fullPhone = countryCode + phone.replace(/\D/g, "");
    setLoading(true);
    const data = await apiFetch("/api/auth/otp/verify", { phone: fullPhone, code });
    setLoading(false);
    if (data.ok) {
      if (data.isNewUser) {
        // New user — go to profile setup, store temp token
        localStorage.setItem("confi_temp_phone", fullPhone);
        localStorage.setItem("confi_temp_token", data.tempToken);
        setScreen("profile_setup");
      } else {
        saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
        setScreen("dashboard");
      }
    } else {
      setError(data.error || "Invalid code.");
    }
  }

  // ── Create Profile ─────────────────────────────────────────────────────────
  async function handleCreateProfile() {
    clearError();
    if (!displayName.trim()) { setError("Display name required."); return; }
    const tempPhone = localStorage.getItem("confi_temp_phone") || "";
    const tempToken = localStorage.getItem("confi_temp_token") || "";
    setLoading(true);
    const data = await apiFetch("/api/auth/profile/create", {
      phone: tempPhone,
      tempToken,
      displayName: displayName.trim(),
      avatarColor,
    });
    setLoading(false);
    if (data.ok) {
      localStorage.removeItem("confi_temp_phone");
      localStorage.removeItem("confi_temp_token");
      saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      setScreen("email_backup");
    } else {
      setError(data.error || "Failed to create profile.");
    }
  }

  // ── Add Email Backup ───────────────────────────────────────────────────────
  async function handleAddEmail() {
    clearError();
    if (!email.includes("@")) { setError("Enter a valid email."); return; }
    if (emailPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!session) return;
    setLoading(true);
    const data = await apiFetch("/api/auth/email/add", { email, password: emailPassword }, session.accessToken);
    setLoading(false);
    if (data.ok) {
      saveSession({ ...session, user: { ...session.user, email } });
      setSuccess("Email backup added!");
      setTimeout(() => { setSuccess(""); setScreen("dashboard"); }, 1500);
    } else {
      setError(data.error || "Failed to add email.");
    }
  }

  // ── Submit KYC ─────────────────────────────────────────────────────────────
  async function handleKyc() {
    clearError();
    if (!kycName.trim() || kycName.trim().split(" ").length < 2) {
      setError("Enter your full legal name (first and last).");
      return;
    }
    if (!kycDob) { setError("Date of birth required."); return; }
    const dob = new Date(kycDob);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age < 18) { setError("You must be 18 or older to activate Confidential Mode."); return; }
    if (!session) return;
    setLoading(true);
    const data = await apiFetch("/api/auth/kyc", { kycName: kycName.trim(), kycDob }, session.accessToken);
    setLoading(false);
    if (data.ok) {
      const updatedSession = { ...session, user: { ...session.user, kyc_verified: true, kyc_name: kycName.trim(), kyc_dob: kycDob } };
      saveSession(updatedSession);
      setSuccess("KYC verified! You can now activate Confidential Mode.");
      setTimeout(() => { setSuccess(""); setScreen("settings"); }, 2000);
    } else {
      setError(data.error || "KYC submission failed.");
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    if (session) {
      await apiFetch("/api/auth/logout", { refreshToken: session.refreshToken }, session.accessToken);
    }
    localStorage.removeItem("confi_session");
    setSession(null);
    setScreen("phone_entry");
    setPhone("");
    setOtp(["","","","","",""]);
    setDisplayName("");
    setEmail("");
    setEmailPassword("");
    setConfidentialMode(false);
  }

  // ── OTP input handler ──────────────────────────────────────────────────────
  function handleOtpChange(index: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const updated = [...otp];
    updated[index] = val.slice(-1);
    setOtp(updated);
    if (val && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const S = styles;

  return (
    <div style={S.app}>
      {/* ── PHONE ENTRY ── */}
      {screen === "phone_entry" && (
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={S.logo}>🔒</div>
            <h1 style={S.appName}>Confi</h1>
            <p style={S.tagline}>Confidential Messaging</p>
          </div>
          <h2 style={S.heading}>Enter your phone number</h2>
          <p style={S.sub}>We'll send a verification code via SMS</p>
          <div style={S.phoneRow}>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={S.countrySelect}>
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
              ))}
            </select>
            <input
              style={S.input}
              type="tel"
              placeholder="(555) 000-0000"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            />
          </div>
          {error && <p style={S.error}>{error}</p>}
          <button style={S.btn} onClick={handleSendOtp} disabled={loading}>
            {loading ? "Sending…" : "Send Code"}
          </button>
          <p style={S.disclaimer}>
            By continuing, you agree to Confi's Terms of Service and Privacy Policy.
            All conversations are subject to international confidentiality standards.
          </p>
        </div>
      )}

      {/* ── OTP VERIFY ── */}
      {screen === "otp_verify" && (
        <div style={S.card}>
          <button style={S.backBtn} onClick={() => { setScreen("phone_entry"); setOtp(["","","","","",""]); clearError(); }}>← Back</button>
          <div style={S.logoWrap}>
            <div style={S.logo}>📱</div>
          </div>
          <h2 style={S.heading}>Verify your number</h2>
          <p style={S.sub}>Enter the 6-digit code sent to {countryCode} {formatPhone(phone)}</p>
          {devOtp && (
            <div style={S.devBadge}>
              🧪 Dev mode OTP: <strong>{devOtp}</strong>
            </div>
          )}
          <div style={S.otpRow}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs[i].current = el; }}
                style={{ ...S.otpInput, ...(digit ? S.otpInputFilled : {}) }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
              />
            ))}
          </div>
          {error && <p style={S.error}>{error}</p>}
          <button style={S.btn} onClick={handleVerifyOtp} disabled={loading || otpExpired}>
            {loading ? "Verifying…" : "Verify Code"}
          </button>
          {!otpExpired ? (
            <p style={S.sub}>Code expires in {otpTimer}s</p>
          ) : (
            <button style={S.linkBtn} onClick={() => { setScreen("phone_entry"); setOtp(["","","","","",""]); }}>
              Resend Code
            </button>
          )}
        </div>
      )}

      {/* ── PROFILE SETUP ── */}
      {screen === "profile_setup" && (
        <div style={S.card}>
          <div style={S.logoWrap}>
            <div style={{ ...S.avatarPreview, background: avatarColor }}>
              {displayName ? getInitials(displayName) : "?"}
            </div>
          </div>
          <h2 style={S.heading}>Create your profile</h2>
          <p style={S.sub}>Choose a display name and avatar color</p>
          <input
            style={S.input}
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
          />
          <div style={S.colorGrid}>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                style={{ ...S.colorSwatch, background: c, ...(avatarColor === c ? S.colorSwatchActive : {}) }}
                onClick={() => setAvatarColor(c)}
              />
            ))}
          </div>
          {error && <p style={S.error}>{error}</p>}
          <button style={S.btn} onClick={handleCreateProfile} disabled={loading}>
            {loading ? "Creating…" : "Create Profile"}
          </button>
        </div>
      )}

      {/* ── EMAIL BACKUP ── */}
      {screen === "email_backup" && (
        <div style={S.card}>
          <div style={S.logoWrap}><div style={S.logo}>✉️</div></div>
          <h2 style={S.heading}>Add email backup</h2>
          <p style={S.sub}>Optional — helps you recover your account. Your password is stored securely (hashed).</p>
          <input
            style={S.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={S.input}
            type="password"
            placeholder="Password (min 8 chars)"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
          />
          {error && <p style={S.error}>{error}</p>}
          {success && <p style={S.successMsg}>{success}</p>}
          <button style={S.btn} onClick={handleAddEmail} disabled={loading}>
            {loading ? "Saving…" : "Add Email"}
          </button>
          <button style={S.linkBtn} onClick={() => setScreen("dashboard")}>
            Skip for now
          </button>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {screen === "dashboard" && session && (
        <div style={S.dashWrap}>
          {/* Sidebar */}
          <div style={S.sidebar}>
            <div style={S.sidebarHeader}>
              <div style={{ ...S.avatarSm, background: session.user.avatar_color }}>
                {getInitials(session.user.display_name)}
              </div>
              <div>
                <div style={S.sidebarName}>{session.user.display_name}</div>
                <div style={S.sidebarPhone}>{session.user.phone}</div>
              </div>
            </div>

            <div style={S.navSection}>
              <button style={S.navBtn} onClick={() => setScreen("settings")}>⚙️ Settings</button>
              {!session.user.kyc_verified && (
                <button style={{ ...S.navBtn, ...S.navBtnKyc }} onClick={() => setScreen("kyc")}>
                  🪪 Verify Identity
                </button>
              )}
              {session.user.kyc_verified && (
                <div style={S.kycBadge}>✅ Identity Verified</div>
              )}
              <button style={{ ...S.navBtn, ...S.navBtnLogout }} onClick={handleLogout}>
                🚪 Sign Out
              </button>
            </div>

            <div style={S.confidentialToggle}>
              <div style={S.confLabel}>
                🔏 Confidential Mode
                {confidentialMode && <span style={S.confActive}>ACTIVE</span>}
              </div>
              <label style={S.toggleWrap}>
                <input
                  type="checkbox"
                  style={{ display: "none" }}
                  checked={confidentialMode}
                  onChange={() => {
                    if (!session.user.kyc_verified) {
                      setError("Complete KYC verification to activate Confidential Mode.");
                      setTimeout(clearError, 3000);
                    } else {
                      setConfidentialMode((v) => !v);
                    }
                  }}
                />
                <div style={{ ...S.toggleTrack, ...(confidentialMode ? S.toggleTrackOn : {}) }}>
                  <div style={{ ...S.toggleThumb, ...(confidentialMode ? S.toggleThumbOn : {}) }} />
                </div>
              </label>
            </div>
            {error && <p style={{ ...S.error, margin: "0 0 8px 0", fontSize: "0.75rem" }}>{error}</p>}
          </div>

          {/* Main chat area */}
          <div style={S.chatArea}>
            {confidentialMode && (
              <div style={S.ndaBanner}>
                🔒 <strong>Confidential Mode Active</strong> — All conversations in this session are covered under an
                international Non-Disclosure Agreement. Parties: <em>{session.user.kyc_name || session.user.display_name}</em>.
                Unauthorized disclosure is prohibited under applicable international law.
              </div>
            )}
            <div style={S.welcomeMsg}>
              <div style={{ fontSize: "4rem" }}>💬</div>
              <h2 style={{ color: "#1a1a2e", margin: "16px 0 8px" }}>Welcome to Confi</h2>
              <p style={{ color: "#666", maxWidth: 340, textAlign: "center" }}>
                Select a contact to start messaging. Enable Confidential Mode to activate international NDA protection.
              </p>
              <div style={S.statsRow}>
                <div style={S.statBox}>
                  <div style={S.statNum}>🔐</div>
                  <div style={S.statLabel}>E2E Encrypted</div>
                </div>
                <div style={S.statBox}>
                  <div style={S.statNum}>📜</div>
                  <div style={S.statLabel}>NDA Protected</div>
                </div>
                <div style={S.statBox}>
                  <div style={S.statNum}>🌍</div>
                  <div style={S.statLabel}>International</div>
                </div>
              </div>
              <button
                style={{ ...S.btn, marginTop: 24, width: "auto", padding: "12px 32px" }}
                onClick={() => { if (!session.user.kyc_verified) setScreen("kyc"); else setScreen("settings"); }}
              >
                {session.user.kyc_verified ? "⚙️ Open Settings" : "🪪 Verify Identity for NDA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KYC ── */}
      {screen === "kyc" && session && (
        <div style={S.card}>
          <button style={S.backBtn} onClick={() => setScreen("dashboard")}>← Back</button>
          <div style={S.logoWrap}><div style={S.logo}>🪪</div></div>
          <h2 style={S.heading}>Identity Verification</h2>
          <p style={S.sub}>
            NDAs require identifiable parties to be enforceable. Your information is stored encrypted and used only for legal identification purposes.
          </p>
          <div style={S.kycInfo}>
            <strong>Why is this required?</strong>
            <p>International NDAs are only legally binding when parties can be unambiguously identified. We collect your legal name and date of birth as minimum identifying information.</p>
          </div>
          <label style={S.label}>Full Legal Name</label>
          <input
            style={S.input}
            type="text"
            placeholder="e.g. Jane Marie Smith"
            value={kycName}
            onChange={(e) => setKycName(e.target.value)}
          />
          <label style={S.label}>Date of Birth</label>
          <input
            style={S.input}
            type="date"
            value={kycDob}
            onChange={(e) => setKycDob(e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
          />
          {error && <p style={S.error}>{error}</p>}
          {success && <p style={S.successMsg}>{success}</p>}
          <button style={S.btn} onClick={handleKyc} disabled={loading}>
            {loading ? "Submitting…" : "Submit KYC"}
          </button>
          <p style={S.disclaimer}>
            Your data is protected under GDPR, CCPA, and international privacy law. We do not sell your information.
          </p>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {screen === "settings" && session && (
        <div style={S.card}>
          <button style={S.backBtn} onClick={() => setScreen("dashboard")}>← Back</button>
          <div style={S.logoWrap}>
            <div style={{ ...S.avatarPreview, background: session.user.avatar_color }}>
              {getInitials(session.user.display_name)}
            </div>
          </div>
          <h2 style={S.heading}>{session.user.display_name}</h2>
          <p style={S.sub}>{session.user.phone}</p>
          {session.user.email && <p style={{ ...S.sub, marginTop: -8 }}>✉️ {session.user.email}</p>}

          <div style={S.settingsSection}>
            <div style={S.settingsRow}>
              <span>📱 Phone</span>
              <span style={S.settingsVal}>{session.user.phone}</span>
            </div>
            <div style={S.settingsRow}>
              <span>✉️ Email</span>
              <span style={S.settingsVal}>{session.user.email || "Not set"}</span>
            </div>
            <div style={S.settingsRow}>
              <span>🪪 KYC Status</span>
              <span style={{ ...S.settingsVal, color: session.user.kyc_verified ? "#27ae60" : "#e74c3c" }}>
                {session.user.kyc_verified ? "✅ Verified" : "❌ Not verified"}
              </span>
            </div>
            {session.user.kyc_verified && (
              <div style={S.settingsRow}>
                <span>👤 Legal Name</span>
                <span style={S.settingsVal}>{session.user.kyc_name}</span>
              </div>
            )}
            <div style={S.settingsRow}>
              <span>🔐 Confidential Mode</span>
              <span style={{ ...S.settingsVal, color: confidentialMode ? "#27ae60" : "#999" }}>
                {confidentialMode ? "Active" : "Inactive"}
              </span>
            </div>
            <div style={S.settingsRow}>
              <span>📅 Member since</span>
              <span style={S.settingsVal}>{new Date(session.user.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <button style={S.linkBtn} onClick={() => setShowRefreshInfo((v) => !v)}>
            {showRefreshInfo ? "Hide" : "Show"} Session Info
          </button>
          {showRefreshInfo && (
            <div style={S.tokenInfo}>
              <p><strong>Access Token (truncated):</strong></p>
              <code style={S.tokenCode}>{session.accessToken.slice(0, 40)}…</code>
              <p><strong>Refresh Token (truncated):</strong></p>
              <code style={S.tokenCode}>{session.refreshToken.slice(0, 40)}…</code>
              <button style={{ ...S.btn, marginTop: 8 }} onClick={() => refreshSession(session)}>
                🔄 Refresh Access Token
              </button>
            </div>
          )}

          {!session.user.kyc_verified && (
            <button style={{ ...S.btn, background: "#8e44ad" }} onClick={() => setScreen("kyc")}>
              🪪 Complete KYC Verification
            </button>
          )}
          {!session.user.email && (
            <button style={{ ...S.btn, background: "#2980b9", marginTop: 8 }} onClick={() => setScreen("email_backup")}>
              ✉️ Add Email Backup
            </button>
          )}
          <button style={{ ...S.navBtn, ...S.navBtnLogout, width: "100%", marginTop: 16 }} onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Static Data ──────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+1", flag: "🇺🇸", name: "USA/Canada" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+30", flag: "🇬🇷", name: "Greece" },
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+64", flag: "🇳🇿", name: "New Zealand" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    padding: "16px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "relative",
  },
  logoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  logo: { fontSize: "3rem" },
  appName: { margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#1a1a2e" },
  tagline: { margin: 0, fontSize: "0.85rem", color: "#888", letterSpacing: "0.05em" },
  heading: { margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a2e", textAlign: "center" },
  sub: { margin: "0", fontSize: "0.9rem", color: "#666", textAlign: "center" },
  phoneRow: { display: "flex", gap: "8px" },
  countrySelect: {
    padding: "12px 8px",
    borderRadius: "12px",
    border: "2px solid #e8e8e8",
    fontSize: "0.9rem",
    background: "#f8f8f8",
    cursor: "pointer",
    outline: "none",
    minWidth: "90px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "2px solid #e8e8e8",
    fontSize: "1rem",
    outline: "none",
    background: "#fafafa",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  label: { fontSize: "0.85rem", fontWeight: 600, color: "#444", marginBottom: "-8px" },
  btn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #0f3460, #533483)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    letterSpacing: "0.02em",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#0f3460",
    fontSize: "0.9rem",
    cursor: "pointer",
    textDecoration: "underline",
    padding: "4px",
    textAlign: "center",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#666",
    fontSize: "0.9rem",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
    marginBottom: "-8px",
  },
  error: {
    color: "#e74c3c",
    fontSize: "0.85rem",
    background: "#fdf2f2",
    padding: "10px 14px",
    borderRadius: "8px",
    margin: 0,
    borderLeft: "3px solid #e74c3c",
  },
  successMsg: {
    color: "#27ae60",
    fontSize: "0.85rem",
    background: "#f0fdf4",
    padding: "10px 14px",
    borderRadius: "8px",
    margin: 0,
    borderLeft: "3px solid #27ae60",
  },
  disclaimer: {
    fontSize: "0.75rem",
    color: "#aaa",
    textAlign: "center",
    lineHeight: "1.5",
    margin: 0,
  },
  devBadge: {
    background: "#fffbe6",
    border: "1px solid #f0c040",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "0.82rem",
    color: "#7a5c00",
    textAlign: "center",
  },
  otpRow: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  otpInput: {
    width: "48px",
    height: "56px",
    textAlign: "center",
    fontSize: "1.4rem",
    fontWeight: 700,
    border: "2px solid #e8e8e8",
    borderRadius: "12px",
    outline: "none",
    background: "#fafafa",
    transition: "border-color 0.2s",
  },
  otpInputFilled: {
    borderColor: "#0f3460",
    background: "#f0f4ff",
  },
  avatarPreview: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.8rem",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.05em",
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "10px",
  },
  colorSwatch: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: "50%",
    border: "3px solid transparent",
    cursor: "pointer",
    transition: "transform 0.1s",
  },
  colorSwatchActive: {
    border: "3px solid #1a1a2e",
    transform: "scale(1.15)",
  },
  kycInfo: {
    background: "#f0f4ff",
    border: "1px solid #c5d5ff",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "0.85rem",
    color: "#333",
    lineHeight: "1.5",
  },
  // Dashboard
  dashWrap: {
    display: "flex",
    width: "100%",
    maxWidth: "900px",
    height: "600px",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  },
  sidebar: {
    width: "280px",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    padding: "20px 16px",
    gap: "8px",
    borderRight: "1px solid #f0f0f0",
    flexShrink: 0,
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px",
    background: "#f8f9ff",
    borderRadius: "12px",
    marginBottom: "8px",
  },
  avatarSm: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1rem",
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  sidebarName: { fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" },
  sidebarPhone: { fontSize: "0.75rem", color: "#888" },
  navSection: { display: "flex", flexDirection: "column", gap: "4px" },
  navBtn: {
    background: "none",
    border: "none",
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "0.9rem",
    color: "#333",
    fontWeight: 500,
    transition: "background 0.15s",
  },
  navBtnKyc: { color: "#8e44ad", fontWeight: 600 },
  navBtnLogout: { color: "#e74c3c", marginTop: "auto" },
  kycBadge: {
    padding: "8px 12px",
    background: "#f0fdf4",
    borderRadius: "10px",
    fontSize: "0.82rem",
    color: "#27ae60",
    fontWeight: 600,
  },
  confidentialToggle: {
    marginTop: "auto",
    background: "#1a1a2e",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confLabel: {
    color: "#fff",
    fontSize: "0.8rem",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  confActive: {
    fontSize: "0.7rem",
    background: "#27ae60",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: "4px",
    width: "fit-content",
  },
  toggleWrap: { cursor: "pointer" },
  toggleTrack: {
    width: "44px",
    height: "24px",
    background: "#444",
    borderRadius: "12px",
    position: "relative",
    transition: "background 0.25s",
  },
  toggleTrackOn: { background: "#27ae60" },
  toggleThumb: {
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "18px",
    height: "18px",
    background: "#fff",
    borderRadius: "50%",
    transition: "left 0.25s",
  },
  toggleThumbOn: { left: "23px" },
  chatArea: {
    flex: 1,
    background: "#f8f9ff",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  ndaBanner: {
    background: "linear-gradient(135deg, #1a1a2e, #533483)",
    color: "#fff",
    padding: "12px 20px",
    fontSize: "0.82rem",
    lineHeight: "1.5",
  },
  welcomeMsg: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  },
  statsRow: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
  },
  statBox: {
    background: "#fff",
    borderRadius: "12px",
    padding: "12px 16px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  statNum: { fontSize: "1.5rem" },
  statLabel: { fontSize: "0.72rem", color: "#666", marginTop: "4px" },
  // Settings
  settingsSection: {
    background: "#f8f9ff",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid #e8eaf6",
  },
  settingsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #e8eaf6",
    fontSize: "0.88rem",
    color: "#333",
  },
  settingsVal: { color: "#666", fontWeight: 500, fontSize: "0.85rem", maxWidth: "180px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" },
  tokenInfo: {
    background: "#f0f0f0",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "0.75rem",
    wordBreak: "break-all",
  },
  tokenCode: {
    display: "block",
    background: "#1a1a2e",
    color: "#7fffb2",
    padding: "8px",
    borderRadius: "6px",
    margin: "4px 0 12px",
    fontSize: "0.7rem",
  },
};