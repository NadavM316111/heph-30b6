"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  email: string;
  phone: string;
  username: string;
  displayName: string;
  photoDataUrl: string | null;
  createdAt: string;
}

type Screen =
  | "landing"
  | "phone-entry"
  | "otp-verify"
  | "profile-setup"
  | "home"
  | "settings";

// ─── Country Codes ─────────────────────────────────────────────────────────────
import { COUNTRY_CODES } from "@/lib/countryCodes";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function saveSession(user: User, token: string) {
  localStorage.setItem("confi_user", JSON.stringify(user));
  localStorage.setItem("confi_token", token);
}

function loadSession(): { user: User; token: string } | null {
  try {
    const raw = localStorage.getItem("confi_user");
    const token = localStorage.getItem("confi_token");
    if (!raw || !token) return null;
    return { user: JSON.parse(raw), token };
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("confi_user");
  localStorage.removeItem("confi_token");
}

// Derive a deterministic "email" from phone so we can use the existing /api/auth endpoint
function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `phone_${digits}@confi.internal`;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [user, setUser] = useState<User | null>(null);

  // Phone entry
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // OTP
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Profile setup
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [profileError, setProfileError] = useState("");

  // Settings
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");

  // Loading / misc
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // ─── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const session = loadSession();
    if (session) {
      setUser(session.user);
      setScreen("home");
    }
  }, []);

  // ─── Resend cooldown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ─── Send OTP ─────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    const phone = countryCode + phoneNumber.replace(/\D/g, "");
    if (phoneNumber.replace(/\D/g, "").length < 7) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }
    setPhoneError("");
    setLoading(true);

    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
      setResendCooldown(60);
      setScreen("otp-verify");
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otpDigits.join("");
    if (code.length < 6) {
      setOtpError("Enter the full 6-digit code.");
      return;
    }
    const phone = countryCode + phoneNumber.replace(/\D/g, "");
    setOtpError("");
    setLoading(true);

    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");

      // Now attempt login/signup via existing auth infra
      const email = phoneToEmail(phone);
      // Use OTP code as the password seed (stored hashed server-side)
      const password = `confi_${phone}_${data.secret}`;

      // Try login first
      let authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      let authData = await authRes.json();

      if (!authRes.ok) {
        // New user — signup
        authRes = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "signup", email, password }),
        });
        authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.error || "Auth failed");
        setIsNewUser(true);
      } else {
        setIsNewUser(false);
      }

      // Load or init user record
      const profileRes = await fetch(`/api/profile?phone=${encodeURIComponent(phone)}`);
      const profileData = profileRes.ok ? await profileRes.json() : null;

      if (profileData?.user) {
        const u: User = profileData.user;
        saveSession(u, authData.token || "local");
        setUser(u);
        setScreen("home");
      } else {
        // New user needs profile setup
        localStorage.setItem("confi_pending_phone", phone);
        localStorage.setItem("confi_pending_token", authData.token || "local");
        setScreen("profile-setup");
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── Profile Photo ────────────────────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Photo must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Save Profile ─────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (username.trim().length < 3) {
      setProfileError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username.trim())) {
      setProfileError("Username: only lowercase letters, numbers, underscores.");
      return;
    }
    if (displayName.trim().length < 1) {
      setProfileError("Display name is required.");
      return;
    }
    setProfileError("");
    setLoading(true);

    const phone = localStorage.getItem("confi_pending_phone") || "";
    const token = localStorage.getItem("confi_pending_token") || "";

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone,
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          photoDataUrl: photoDataUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      const u: User = data.user;
      saveSession(u, token);
      setUser(u);
      localStorage.removeItem("confi_pending_phone");
      localStorage.removeItem("confi_pending_token");
      setScreen("home");
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Profile save failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── Settings Save ────────────────────────────────────────────────────────
  async function handleSettingsSave() {
    if (!user) return;
    if (editDisplayName.trim().length < 1) {
      setSettingsMsg("Display name cannot be empty.");
      return;
    }
    setLoading(true);
    setSettingsMsg("");
    const token = localStorage.getItem("confi_token") || "";
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: user.phone,
          displayName: editDisplayName.trim(),
          username: editUsername.trim().toLowerCase(),
          photoDataUrl: photoDataUrl || user.photoDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      const updated = { ...user, displayName: editDisplayName.trim(), username: editUsername.trim().toLowerCase(), photoDataUrl: photoDataUrl || user.photoDataUrl };
      setUser(updated);
      saveSession(updated, token);
      setSettingsMsg("Settings saved ✓");
    } catch (err: unknown) {
      setSettingsMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── OTP Input Handler ────────────────────────────────────────────────────
  function handleOtpInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpDigits];
    next[i] = val.slice(-1);
    setOtpDigits(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  function handleLogout() {
    clearSession();
    setUser(null);
    setPhoneNumber("");
    setOtpDigits(["", "", "", "", "", ""]);
    setPhotoDataUrl(null);
    setUsername("");
    setDisplayName("");
    setScreen("landing");
  }

  // ─── Open Settings ────────────────────────────────────────────────────────
  function openSettings() {
    if (!user) return;
    setEditDisplayName(user.displayName);
    setEditUsername(user.username);
    setPhotoDataUrl(null);
    setSettingsMsg("");
    setScreen("settings");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // ── LANDING ───────────────────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.card}>
          <div className={styles.logo}>🔐</div>
          <h1 className={styles.appName}>Confi</h1>
          <p className={styles.tagline}>
            Messaging with built-in confidentiality agreements. Every conversation, protected by law.
          </p>
          <div className={styles.featureList}>
            <div className={styles.feature}>✅ Phone-verified identity</div>
            <div className={styles.feature}>🤝 International NDA mode</div>
            <div className={styles.feature}>🔒 End-to-end encrypted</div>
            <div className={styles.feature}>⚖️ Legally enforceable agreements</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => setScreen("phone-entry")}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // ── PHONE ENTRY ────────────────────────────────────────────────────────────
  if (screen === "phone-entry") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.card}>
          <button className={styles.back} onClick={() => setScreen("landing")}>← Back</button>
          <div className={styles.logo}>📱</div>
          <h2 className={styles.cardTitle}>Enter your phone number</h2>
          <p className={styles.cardSubtitle}>
            We'll send a verification code. Your number creates your verified identity on Confi.
          </p>
          <div className={styles.phoneRow}>
            <select
              className={styles.countrySelect}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.dial} value={c.dial}>
                  {c.flag} {c.dial}
                </option>
              ))}
            </select>
            <input
              className={styles.phoneInput}
              type="tel"
              placeholder="Phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            />
          </div>
          {phoneError && <p className={styles.error}>{phoneError}</p>}
          <button
            className={styles.btnPrimary}
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send Verification Code"}
          </button>
          <p className={styles.legal}>
            By continuing, you agree to Confi's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  // ── OTP VERIFY ─────────────────────────────────────────────────────────────
  if (screen === "otp-verify") {
    const fullPhone = countryCode + phoneNumber.replace(/\D/g, "");
    return (
      <div className={styles.centerWrap}>
        <div className={styles.card}>
          <button className={styles.back} onClick={() => setScreen("phone-entry")}>← Back</button>
          <div className={styles.logo}>💬</div>
          <h2 className={styles.cardTitle}>Verify your number</h2>
          <p className={styles.cardSubtitle}>
            Enter the 6-digit code sent to <strong>{fullPhone}</strong>
          </p>
          <div className={styles.otpRow}>
            {otpDigits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                className={styles.otpBox}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpInput(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
              />
            ))}
          </div>
          {otpError && <p className={styles.error}>{otpError}</p>}
          <button
            className={styles.btnPrimary}
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? "Verifying…" : "Verify Code"}
          </button>
          <button
            className={styles.btnGhost}
            onClick={handleSendOtp}
            disabled={resendCooldown > 0 || loading}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
          </button>
          <div className={styles.devNote}>
            <strong>Dev mode:</strong> OTP is logged in the server console / returned in the API response for testing.
          </div>
        </div>
      </div>
    );
  }

  // ── PROFILE SETUP ──────────────────────────────────────────────────────────
  if (screen === "profile-setup") {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.card}>
          <div className={styles.logo}>👤</div>
          <h2 className={styles.cardTitle}>Set up your profile</h2>
          <p className={styles.cardSubtitle}>
            Your identity on Confi. This is what other users see — and what NDA agreements will reference.
          </p>

          {/* Photo upload */}
          <div className={styles.photoUploadWrap}>
            <label className={styles.photoUploadLabel} htmlFor="photo-upload">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Profile" className={styles.photoPreview} />
              ) : (
                <div className={styles.photoPlaceholder}>
                  <span style={{ fontSize: 40 }}>📷</span>
                  <span style={{ fontSize: 13, color: "#888", marginTop: 6 }}>Upload photo</span>
                </div>
              )}
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
          </div>

          <label className={styles.fieldLabel}>Username</label>
          <input
            className={styles.textInput}
            type="text"
            placeholder="e.g. john_doe"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          <p className={styles.hint}>Lowercase letters, numbers, underscores only. Min 3 chars.</p>

          <label className={styles.fieldLabel}>Display Name</label>
          <input
            className={styles.textInput}
            type="text"
            placeholder="Your full name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className={styles.hint}>This name will appear in NDA agreements.</p>

          {profileError && <p className={styles.error}>{profileError}</p>}

          <button
            className={styles.btnPrimary}
            onClick={handleSaveProfile}
            disabled={loading}
          >
            {loading ? "Saving…" : "Save Profile & Continue"}
          </button>
        </div>
      </div>
    );
  }

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (screen === "home" && user) {
    return (
      <div className={styles.appShell}>
        {/* Top bar */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.topBarLogo}>🔐 Confi</span>
          </div>
          <div className={styles.topBarRight}>
            <button className={styles.iconBtn} onClick={openSettings} title="Settings">
              {user.photoDataUrl ? (
                <img src={user.photoDataUrl} alt="Profile" className={styles.avatarSmall} />
              ) : (
                <div className={styles.avatarDefault}>{user.displayName?.[0]?.toUpperCase() || "?"}</div>
              )}
            </button>
          </div>
        </header>

        {/* Identity card */}
        <div className={styles.identityCard}>
          <div className={styles.identityAvatar}>
            {user.photoDataUrl ? (
              <img src={user.photoDataUrl} alt="Profile" className={styles.avatarLarge} />
            ) : (
              <div className={styles.avatarDefaultLarge}>{user.displayName?.[0]?.toUpperCase() || "?"}</div>
            )}
          </div>
          <div className={styles.identityInfo}>
            <h2 className={styles.identityName}>{user.displayName}</h2>
            <p className={styles.identityHandle}>@{user.username}</p>
            <p className={styles.identityPhone}>{user.phone}</p>
            <div className={styles.verifiedBadge}>✅ Phone Verified</div>
          </div>
        </div>

        {/* NDA Preview panel */}
        <div className={styles.ndaPanel}>
          <div className={styles.ndaPanelHeader}>
            <span style={{ fontSize: 22 }}>⚖️</span>
            <h3>Confidential Mode</h3>
          </div>
          <p className={styles.ndaDesc}>
            When activated on a conversation, both parties digitally sign an international NDA. Your verified identity (<strong>{user.displayName}</strong>, phone: <strong>{user.phone}</strong>) will be legally bound to that agreement.
          </p>
          <div className={styles.ndaStatus}>
            <span className={styles.ndaDot} />
            Ready to activate on any conversation
          </div>
        </div>

        {/* Placeholder chat list */}
        <div className={styles.chatListPlaceholder}>
          <div className={styles.emptyState}>
            <div style={{ fontSize: 56 }}>💬</div>
            <h3>No conversations yet</h3>
            <p>Start a new chat to experience confidential messaging.</p>
            <button className={styles.btnPrimary} style={{ marginTop: 16 }}>
              + New Conversation
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <nav className={styles.bottomNav}>
          <button className={`${styles.navBtn} ${styles.navBtnActive}`}>
            <span>💬</span>
            <span>Chats</span>
          </button>
          <button className={styles.navBtn}>
            <span>📞</span>
            <span>Calls</span>
          </button>
          <button className={styles.navBtn} onClick={openSettings}>
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </nav>
      </div>
    );
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  if (screen === "settings" && user) {
    return (
      <div className={styles.appShell}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button className={styles.back} onClick={() => setScreen("home")}>← Back</button>
          </div>
          <div className={styles.topBarLeft}>
            <span className={styles.topBarLogo}>Account Settings</span>
          </div>
        </header>

        <div className={styles.settingsBody}>
          {/* Photo */}
          <div className={styles.photoUploadWrap} style={{ marginBottom: 24 }}>
            <label className={styles.photoUploadLabel} htmlFor="settings-photo">
              {(photoDataUrl || user.photoDataUrl) ? (
                <img
                  src={photoDataUrl || user.photoDataUrl || ""}
                  alt="Profile"
                  className={styles.photoPreview}
                />
              ) : (
                <div className={styles.photoPlaceholder}>
                  <span style={{ fontSize: 40 }}>{user.displayName?.[0]?.toUpperCase() || "?"}</span>
                  <span style={{ fontSize: 13, color: "#888", marginTop: 6 }}>Change photo</span>
                </div>
              )}
            </label>
            <input
              id="settings-photo"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
          </div>

          {/* Identity summary — read-only */}
          <div className={styles.settingsSection}>
            <div className={styles.settingsSectionTitle}>Verified Identity</div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Phone</span>
              <span className={styles.settingsValue}>{user.phone} ✅</span>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Member since</span>
              <span className={styles.settingsValue}>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Editable fields */}
          <div className={styles.settingsSection}>
            <div className={styles.settingsSectionTitle}>Profile</div>
            <label className={styles.fieldLabel}>Display Name</label>
            <input
              className={styles.textInput}
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              placeholder="Display name"
            />
            <label className={styles.fieldLabel}>Username</label>
            <input
              className={styles.textInput}
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
              placeholder="username"
            />
          </div>

          {settingsMsg && (
            <p className={settingsMsg.includes("✓") ? styles.success : styles.error}>
              {settingsMsg}
            </p>
          )}

          <button
            className={styles.btnPrimary}
            onClick={handleSettingsSave}
            disabled={loading}
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>

          {/* NDA identity notice */}
          <div className={styles.ndaPanel} style={{ marginTop: 24 }}>
            <div className={styles.ndaPanelHeader}>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <h4 style={{ margin: 0 }}>Legal Identity Notice</h4>
            </div>
            <p className={styles.ndaDesc} style={{ fontSize: 13 }}>
              Your display name and phone number are used as your legal identity in Confi NDA agreements.
              Changes here update future agreements. Existing signed agreements retain the name used at signing time.
            </p>
          </div>

          <div className={styles.settingsSection} style={{ marginTop: 24 }}>
            <button className={styles.btnDanger} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}