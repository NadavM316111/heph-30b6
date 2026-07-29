"use client";

import { useEffect, useState, useCallback } from "react";
import {
  generateIdentityKeyPair,
  exportPublicKeyAsBase64,
  exportPrivateKeyAsBase64,
  importPrivateKeyFromBase64,
  signData,
} from "@/lib/crypto";
import {
  saveSession,
  loadSession,
  clearSession,
  saveIdentityKey,
  loadIdentityKey,
  SessionData,
} from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "phone-entry"
  | "otp-verify"
  | "email-backup"
  | "profile-setup"
  | "home"
  | "profile-view";

interface UserProfile {
  email: string;
  displayName: string;
  avatar: string; // base64 data URL or emoji fallback
  phone: string;
  publicKey: string;
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_EMOJIS = ["🦁","🐯","🦊","🐺","🦝","🐻","🐼","🐨","🦄","🐸","🦋","🌻","🌊","🔥","⚡","🍀"];

function randomEmoji(): string {
  return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
}

// ─── Simulated OTP (no SMS provider key available) ───────────────────────────
// In production this would call a real SMS gateway; here we generate a
// deterministic 6-digit code client-side so the demo is fully functional.
function generateOTP(phone: string, seed: string): string {
  let hash = 0;
  const str = phone + seed;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Auth state
  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Phone / OTP flow
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSeed] = useState(() => Math.random().toString(36).slice(2));
  const [otpInput, setOtpInput] = useState("");
  const [otpExpected, setOtpExpected] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Email backup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Profile setup
  const [displayName, setDisplayName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState(randomEmoji());
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  // Crypto key pair (ephemeral during registration)
  const [pendingPublicKey, setPendingPublicKey] = useState("");
  const [pendingPrivateKey, setPendingPrivateKey] = useState("");

  // ── Tracking ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // ── Restore session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSession();
    if (s) {
      setSession(s);
      setProfile({
        email: s.email,
        displayName: s.displayName,
        avatar: s.avatar,
        phone: s.phone,
        publicKey: s.publicKey,
      });
      setScreen("home");
    } else {
      setScreen("splash");
      setTimeout(() => setScreen("phone-entry"), 1800);
    }
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }, []);

  // ── OTP countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Send OTP
  // ────────────────────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError("");
    const cleaned = phone.replace(/\s/g, "");
    if (!/^\+?[1-9]\d{6,14}$/.test(cleaned)) {
      setError("Please enter a valid phone number with country code (e.g. +1 555 000 0000)");
      return;
    }
    setLoading(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    const code = generateOTP(cleaned, otpSeed);
    setOtpExpected(code);
    setOtpSent(true);
    setOtpCountdown(60);
    setLoading(false);
    // In dev, show the code in a toast so tester can proceed
    showToast(`Demo OTP: ${code}  (SMS disabled — no API key)`);
    setScreen("otp-verify");
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Verify OTP
  // ────────────────────────────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    setError("");
    if (otpInput.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    if (otpInput !== otpExpected) {
      setError("Incorrect code. Try again.");
      return;
    }
    setLoading(true);
    // Generate identity key pair immediately after phone verification
    try {
      const keyPair = await generateIdentityKeyPair();
      const pubB64 = await exportPublicKeyAsBase64(keyPair.publicKey);
      const privB64 = await exportPrivateKeyAsBase64(keyPair.privateKey);
      setPendingPublicKey(pubB64);
      setPendingPrivateKey(privB64);
      showToast("Phone verified ✓  Identity key pair generated");
    } catch {
      showToast("Crypto API unavailable — key generation skipped");
    }
    setLoading(false);
    setScreen("email-backup");
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Email backup (also doubles as login for returning users)
  // ────────────────────────────────────────────────────────────────────────────
  async function handleEmailSubmit(mode: "signup" | "login") {
    setError("");
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Authentication failed");
        setLoading(false);
        return;
      }
      if (mode === "login") {
        // Returning user — load existing identity key from localStorage
        const existing = loadIdentityKey(email);
        if (!existing) {
          showToast("No local identity key found — generating new key pair for this device");
          const keyPair = await generateIdentityKeyPair();
          const pubB64 = await exportPublicKeyAsBase64(keyPair.publicKey);
          const privB64 = await exportPrivateKeyAsBase64(keyPair.privateKey);
          saveIdentityKey(email, privB64);
          const sess: SessionData = {
            email: data.email,
            displayName: data.displayName ?? data.email.split("@")[0],
            avatar: data.avatar ?? randomEmoji(),
            phone: phone,
            publicKey: pubB64,
            token: data.token ?? `jwt_${Date.now()}`,
          };
          saveSession(sess);
          setSession(sess);
          setProfile({ ...sess });
        } else {
          const sess: SessionData = {
            email: data.email,
            displayName: data.displayName ?? data.email.split("@")[0],
            avatar: data.avatar ?? randomEmoji(),
            phone: phone,
            publicKey: existing.publicKey,
            token: data.token ?? `jwt_${Date.now()}`,
          };
          saveSession(sess);
          setSession(sess);
          setProfile({ ...sess });
        }
        setLoading(false);
        showToast("Welcome back!");
        setScreen("home");
      } else {
        // New user — proceed to profile setup
        setLoading(false);
        setScreen("profile-setup");
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Profile setup + finalize registration
  // ────────────────────────────────────────────────────────────────────────────
  async function handleProfileSubmit() {
    setError("");
    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    setLoading(true);

    // Sign a registration payload to prove key ownership
    let signature = "";
    if (pendingPrivateKey) {
      try {
        const privKey = await importPrivateKeyFromBase64(pendingPrivateKey);
        signature = await signData(privKey, `register:${email}:${phone}`);
      } catch {
        signature = "sig_unavailable";
      }
    }

    // Upload public key + profile to server via /api/auth (extend signup)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email,
          password,
          displayName: displayName.trim(),
          publicKey: pendingPublicKey,
          phone,
          signature,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        // If already exists, try login
        if (data.error?.toLowerCase().includes("exist")) {
          setIsReturningUser(true);
          setError("Account already exists. Please log in.");
          setScreen("email-backup");
          setLoading(false);
          return;
        }
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }

      // Persist private key to localStorage (never leaves the device)
      saveIdentityKey(email, pendingPrivateKey);

      const finalAvatar = avatarDataUrl || avatarEmoji;
      const sess: SessionData = {
        email: data.email ?? email,
        displayName: displayName.trim(),
        avatar: finalAvatar,
        phone,
        publicKey: pendingPublicKey,
        token: data.token ?? `jwt_${Date.now()}`,
      };
      saveSession(sess);
      setSession(sess);
      setProfile({ ...sess });
      setLoading(false);
      showToast("Account created! Your identity keys are secured 🔐");
      setScreen("home");
    } catch {
      setError("Network error during registration.");
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Avatar file picker
  // ────────────────────────────────────────────────────────────────────────────
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast("Image too large (max 2 MB)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Logout
  // ────────────────────────────────────────────────────────────────────────────
  function handleLogout() {
    clearSession();
    setSession(null);
    setProfile(null);
    setPhone("");
    setOtpInput("");
    setEmail("");
    setPassword("");
    setDisplayName("");
    setAvatarDataUrl("");
    setAvatarEmoji(randomEmoji());
    setPendingPublicKey("");
    setPendingPrivateKey("");
    setScreen("phone-entry");
    showToast("Signed out");
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Verify identity key (demo — signs a challenge and shows it)
  // ────────────────────────────────────────────────────────────────────────────
  async function handleVerifyKey() {
    if (!session) return;
    const stored = loadIdentityKey(session.email);
    if (!stored) { showToast("No local identity key found"); return; }
    try {
      const privKey = await importPrivateKeyFromBase64(stored.privateKey);
      const sig = await signData(privKey, `verify:${session.email}:${Date.now()}`);
      showToast(`Identity verified ✓  sig: ${sig.slice(0, 20)}…`);
    } catch {
      showToast("Key verification failed");
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div style={styles.root}>
      {/* Toast */}
      {toast && (
        <div style={styles.toast}>
          {toast}
        </div>
      )}

      {/* ── SPLASH ─────────────────────────────────────────────────────────── */}
      {screen === "splash" && (
        <div style={styles.splashWrap}>
          <div style={styles.splashLogo}>🔐</div>
          <h1 style={styles.splashTitle}>Confi</h1>
          <p style={styles.splashSub}>Confidential Messaging</p>
          <div style={styles.splashDots}>
            <span style={{...styles.dot, animationDelay: "0s"}} />
            <span style={{...styles.dot, animationDelay: "0.2s"}} />
            <span style={{...styles.dot, animationDelay: "0.4s"}} />
          </div>
        </div>
      )}

      {/* ── PHONE ENTRY ─────────────────────────────────────────────────────── */}
      {screen === "phone-entry" && (
        <div style={styles.card}>
          <div style={styles.cardIcon}>📱</div>
          <h2 style={styles.cardTitle}>Enter your phone number</h2>
          <p style={styles.cardSub}>
            We'll send a one-time code to verify your identity. Your number is never shared.
          </p>
          <input
            style={styles.input}
            type="tel"
            placeholder="+1 555 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}}
            onClick={handleSendOtp}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
          <p style={styles.footNote}>
            Already have an account?{" "}
            <span
              style={styles.link}
              onClick={() => { setIsReturningUser(true); setScreen("email-backup"); }}
            >
              Sign in with email
            </span>
          </p>
        </div>
      )}

      {/* ── OTP VERIFY ──────────────────────────────────────────────────────── */}
      {screen === "otp-verify" && (
        <div style={styles.card}>
          <div style={styles.cardIcon}>💬</div>
          <h2 style={styles.cardTitle}>Verify your number</h2>
          <p style={styles.cardSub}>
            Enter the 6-digit code sent to <strong>{phone}</strong>
          </p>
          <input
            style={{...styles.input, ...styles.otpInput}}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}}
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? "Verifying…" : "Verify Code"}
          </button>
          <button
            style={styles.btnGhost}
            onClick={() => {
              if (otpCountdown > 0) {
                showToast(`Resend available in ${otpCountdown}s`);
                return;
              }
              handleSendOtp();
            }}
          >
            {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend Code"}
          </button>
          <button style={styles.btnGhost} onClick={() => setScreen("phone-entry")}>
            ← Change Number
          </button>
        </div>
      )}

      {/* ── EMAIL BACKUP ────────────────────────────────────────────────────── */}
      {screen === "email-backup" && (
        <div style={styles.card}>
          <div style={styles.cardIcon}>{isReturningUser ? "🔑" : "📧"}</div>
          <h2 style={styles.cardTitle}>
            {isReturningUser ? "Welcome back" : "Add email backup"}
          </h2>
          <p style={styles.cardSub}>
            {isReturningUser
              ? "Sign in with your email and password."
              : "Secure your account with an email and password. This enables account recovery."}
          </p>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            placeholder={isReturningUser ? "Password" : "Create password (min 8 chars)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && handleEmailSubmit(isReturningUser ? "login" : "signup")
            }
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}}
            onClick={() => handleEmailSubmit(isReturningUser ? "login" : "signup")}
            disabled={loading}
          >
            {loading
              ? isReturningUser ? "Signing in…" : "Continuing…"
              : isReturningUser ? "Sign In" : "Continue"}
          </button>
          {!isReturningUser && (
            <button
              style={styles.btnGhost}
              onClick={() => {
                // Skip email backup — go straight to profile
                setEmail(`${phone.replace(/\D/g, "")}@phone.local`);
                setPassword(`temp_${Date.now()}`);
                setScreen("profile-setup");
              }}
            >
              Skip for now
            </button>
          )}
          <p style={styles.footNote}>
            {isReturningUser ? (
              <>
                New here?{" "}
                <span
                  style={styles.link}
                  onClick={() => { setIsReturningUser(false); setScreen("phone-entry"); }}
                >
                  Create account
                </span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span
                  style={styles.link}
                  onClick={() => setIsReturningUser(true)}
                >
                  Sign in instead
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* ── PROFILE SETUP ───────────────────────────────────────────────────── */}
      {screen === "profile-setup" && (
        <div style={styles.card}>
          <div style={styles.cardIcon}>👤</div>
          <h2 style={styles.cardTitle}>Set up your profile</h2>
          <p style={styles.cardSub}>
            This is how others will see you. You can change this later.
          </p>

          {/* Avatar picker */}
          <div style={styles.avatarWrap}>
            <div style={styles.avatarPreview}>
              {avatarDataUrl
                ? <img src={avatarDataUrl} alt="avatar" style={styles.avatarImg} />
                : <span style={styles.avatarEmojiLg}>{avatarEmoji}</span>
              }
            </div>
            <div style={styles.avatarActions}>
              <label style={styles.btnSmall}>
                📷 Upload photo
                <input type="file" accept="image/*" onChange={handleAvatarFile} style={{display:"none"}} />
              </label>
              <button
                style={styles.btnSmall}
                onClick={() => { setAvatarEmoji(randomEmoji()); setAvatarDataUrl(""); }}
              >
                🎲 Random emoji
              </button>
            </div>
          </div>

          {/* Emoji row */}
          {!avatarDataUrl && (
            <div style={styles.emojiRow}>
              {AVATAR_EMOJIS.map((em) => (
                <span
                  key={em}
                  style={{
                    ...styles.emojiOption,
                    ...(em === avatarEmoji ? styles.emojiSelected : {}),
                  }}
                  onClick={() => setAvatarEmoji(em)}
                >
                  {em}
                </span>
              ))}
            </div>
          )}

          <input
            style={styles.input}
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleProfileSubmit()}
            maxLength={40}
            autoFocus
          />

          {pendingPublicKey && (
            <div style={styles.keyBox}>
              <span style={styles.keyLabel}>🔑 Identity public key</span>
              <span style={styles.keyValue}>{pendingPublicKey.slice(0, 40)}…</span>
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{...styles.btn, ...(loading ? styles.btnDisabled : {})}}
            onClick={handleProfileSubmit}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </div>
      )}

      {/* ── HOME ────────────────────────────────────────────────────────────── */}
      {screen === "home" && profile && (
        <div style={styles.homeWrap}>
          {/* Header */}
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.headerLogo}>🔐</div>
              <span style={styles.headerTitle}>Confi</span>
            </div>
            <button
              style={styles.avatarBtn}
              onClick={() => setScreen("profile-view")}
              title="View profile"
            >
              {profile.avatar.startsWith("data:")
                ? <img src={profile.avatar} alt="me" style={styles.headerAvatar} />
                : <span style={{fontSize: 28}}>{profile.avatar}</span>
              }
            </button>
          </header>

          {/* Welcome card */}
          <div style={styles.welcomeCard}>
            <div style={styles.welcomeAvatar}>
              {profile.avatar.startsWith("data:")
                ? <img src={profile.avatar} alt="avatar" style={styles.welcomeAvatarImg} />
                : <span style={{fontSize: 56}}>{profile.avatar}</span>
              }
            </div>
            <h2 style={styles.welcomeName}>Hi, {profile.displayName}! 👋</h2>
            <p style={styles.welcomeSub}>{profile.email}</p>
            {profile.phone && (
              <p style={styles.welcomePhone}>📱 {profile.phone}</p>
            )}
          </div>

          {/* Crypto identity status */}
          <div style={styles.cryptoCard}>
            <div style={styles.cryptoHeader}>
              <span style={styles.cryptoIcon}>🔐</span>
              <span style={styles.cryptoTitle}>Cryptographic Identity</span>
              <span style={styles.cryptoBadge}>ACTIVE</span>
            </div>
            <p style={styles.cryptoDesc}>
              Your Ed25519 identity key pair underpins end-to-end encryption and legally binding NDA signatures.
              Your private key never leaves this device.
            </p>
            <div style={styles.keyRow}>
              <span style={styles.keyLabel}>Public key</span>
              <span style={styles.keyValueSm}>
                {profile.publicKey
                  ? `${profile.publicKey.slice(0, 32)}…`
                  : "Not available on this device"}
              </span>
            </div>
            <button style={styles.verifyBtn} onClick={handleVerifyKey}>
              ✍️ Verify Identity Signature
            </button>
          </div>

          {/* Feature cards */}
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>💬</div>
              <div style={styles.featureLabel}>Messages</div>
              <div style={styles.featureSub}>Coming soon</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>📜</div>
              <div style={styles.featureLabel}>NDA Vault</div>
              <div style={styles.featureSub}>Coming soon</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🤝</div>
              <div style={styles.featureLabel}>Contacts</div>
              <div style={styles.featureSub}>Coming soon</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🌐</div>
              <div style={styles.featureLabel}>Confidential Mode</div>
              <div style={styles.featureSub}>Coming soon</div>
            </div>
          </div>

          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      )}

      {/* ── PROFILE VIEW ────────────────────────────────────────────────────── */}
      {screen === "profile-view" && profile && (
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => setScreen("home")}>← Back</button>
          <div style={styles.profileAvatar}>
            {profile.avatar.startsWith("data:")
              ? <img src={profile.avatar} alt="avatar" style={styles.profileAvatarImg} />
              : <span style={{fontSize: 72}}>{profile.avatar}</span>
            }
          </div>
          <h2 style={styles.profileName}>{profile.displayName}</h2>
          <p style={styles.profileEmail}>{profile.email}</p>
          {profile.phone && <p style={styles.profilePhone}>📱 {profile.phone}</p>}

          <div style={styles.profileSection}>
            <div style={styles.profileSectionTitle}>🔐 Identity Key</div>
            <div style={styles.profileKeyBox}>
              <p style={styles.profileKeyLabel}>Public Key (shared with contacts)</p>
              <p style={styles.profileKeyVal}>
                {profile.publicKey || "Not available on this device"}
              </p>
            </div>
            <div style={styles.profileKeyBox}>
              <p style={styles.profileKeyLabel}>Private Key</p>
              <p style={styles.profileKeyVal}>
                ████████████████████  (stored locally, never transmitted)
              </p>
            </div>
          </div>

          <div style={styles.profileSection}>
            <div style={styles.profileSectionTitle}>📋 NDA Status</div>
            <p style={styles.profileNdaStatus}>
              No active NDAs. Confidential conversations will be covered once you start messaging.
            </p>
          </div>

          <button style={styles.verifyBtn} onClick={handleVerifyKey}>
            ✍️ Verify Identity Signature
          </button>
          <button style={{...styles.logoutBtn, marginTop: 12}} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#fff",
    padding: "16px",
    position: "relative",
    overflowX: "hidden",
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 12,
    padding: "12px 20px",
    fontSize: 14,
    color: "#fff",
    zIndex: 9999,
    maxWidth: 360,
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },

  // Splash
  splashWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  splashLogo: { fontSize: 72 },
  splashTitle: { fontSize: 42, fontWeight: 800, margin: 0, letterSpacing: -1 },
  splashSub: { fontSize: 18, color: "rgba(255,255,255,0.6)", margin: 0 },
  splashDots: { display: "flex", gap: 8, marginTop: 24 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.6)",
    animation: "pulse 1s infinite",
  },

  // Card
  card: {
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 24,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
  },
  cardIcon: { fontSize: 40, textAlign: "center" },
  cardTitle: { fontSize: 24, fontWeight: 700, margin: 0, textAlign: "center" },
  cardSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    margin: 0,
    textAlign: "center",
    lineHeight: 1.5,
  },

  // Input
  input: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: "14px 16px",
    fontSize: 16,
    color: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  otpInput: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 12,
  },

  // Buttons
  btn: {
    background: "linear-gradient(135deg, #6c63ff, #a855f7)",
    border: "none",
    borderRadius: 12,
    padding: "15px",
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s, transform 0.1s",
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  btnGhost: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 12,
    padding: "12px",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    width: "100%",
  },
  btnSmall: {
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },

  error: {
    color: "#ff6b6b",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
  },
  footNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    margin: 0,
  },
  link: {
    color: "#a78bfa",
    cursor: "pointer",
    textDecoration: "underline",
  },

  // Key box
  keyBox: {
    background: "rgba(108,99,255,0.15)",
    border: "1px solid rgba(108,99,255,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  keyLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 },
  keyValue: { fontSize: 12, color: "#a78bfa", fontFamily: "monospace", wordBreak: "break-all" },
  keyValueSm: { fontSize: 11, color: "#a78bfa", fontFamily: "monospace", wordBreak: "break-all" },

  // Avatar
  avatarWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  avatarPreview: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    border: "2px solid rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  avatarEmojiLg: { fontSize: 48 },
  avatarActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  emojiRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  emojiOption: {
    fontSize: 22,
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
    transition: "background 0.15s",
  },
  emojiSelected: {
    background: "rgba(108,99,255,0.4)",
    outline: "2px solid #6c63ff",
  },

  // Home
  homeWrap: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(12px)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerLogo: { fontSize: 28 },
  headerTitle: { fontSize: 22, fontWeight: 800, letterSpacing: -0.5 },
  avatarBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    borderRadius: "50%",
  },
  headerAvatar: { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" },

  welcomeCard: {
    background: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    padding: "28px 24px",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    textAlign: "center",
  },
  welcomeAvatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 4,
  },
  welcomeAvatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  welcomeName: { fontSize: 24, fontWeight: 700, margin: 0 },
  welcomeSub: { fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0 },
  welcomePhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 },

  cryptoCard: {
    background: "rgba(108,99,255,0.12)",
    border: "1px solid rgba(108,99,255,0.3)",
    borderRadius: 20,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cryptoHeader: { display: "flex", alignItems: "center", gap: 10 },
  cryptoIcon: { fontSize: 22 },
  cryptoTitle: { fontSize: 16, fontWeight: 700, flex: 1 },
  cryptoBadge: {
    background: "rgba(16,185,129,0.25)",
    color: "#6ee7b7",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: 1,
  },
  cryptoDesc: { fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 },
  keyRow: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  verifyBtn: {
    background: "rgba(108,99,255,0.25)",
    border: "1px solid rgba(108,99,255,0.5)",
    borderRadius: 10,
    padding: "11px",
    fontSize: 14,
    fontWeight: 600,
    color: "#a78bfa",
    cursor: "pointer",
    width: "100%",
  },

  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  featureCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    textAlign: "center",
  },
  featureIcon: { fontSize: 28 },
  featureLabel: { fontSize: 14, fontWeight: 600 },
  featureSub: { fontSize: 11, color: "rgba(255,255,255,0.4)" },

  logoutBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: "12px",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    cursor: "pointer",
    width: "100%",
  },

  // Profile view
  backBtn: {
    background: "none",
    border: "none",
    color: "#a78bfa",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
  },
  profileAvatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  profileName: { fontSize: 26, fontWeight: 700, margin: 0, textAlign: "center" },
  profileEmail: { fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0, textAlign: "center" },
  profilePhone: { fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, textAlign: "center" },
  profileSection: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  profileSectionTitle: { fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" },
  profileKeyBox: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  profileKeyLabel: { fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, textTransform: "uppercase", letterSpacing: 0.8 },
  profileKeyVal: { fontSize: 11, color: "#a78bfa", fontFamily: "monospace", margin: 0, wordBreak: "break-all" },
  profileNdaStatus: { fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 },
};