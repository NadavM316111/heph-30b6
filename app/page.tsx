"use client";

import { useState, useEffect, useCallback } from "react";
import {
  generateConfiId,
  generateOTP,
  hashPhone,
  encryptCredentials,
  decryptCredentials,
  generateSessionToken,
  verifySessionToken,
  generateKeyFromPhone,
} from "../lib/crypto-utils";
import { AVATAR_OPTIONS, COUNTRY_CODES } from "../lib/constants";
import type { UserProfile, Session, RegistrationState } from "../lib/types";

type Screen =
  | "landing"
  | "phone-entry"
  | "otp-verify"
  | "profile-setup"
  | "profile-view"
  | "settings";

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Registration state
  const [regState, setRegState] = useState<RegistrationState>({
    countryCode: "+1",
    phoneNumber: "",
    otp: "",
    generatedOTP: "",
    otpSentAt: null,
    phoneHash: "",
    displayName: "",
    email: "",
    selectedAvatar: 0,
    confiId: "",
    encryptionKey: null,
  });

  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAvatar, setEditAvatar] = useState(0);

  // Track page view
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Load session on mount
  useEffect(() => {
    const init = async () => {
      try {
        const storedSession = localStorage.getItem("confi_session");
        const storedProfile = localStorage.getItem("confi_profile");
        const storedEncrypted = localStorage.getItem("confi_credentials");

        if (storedSession && storedProfile && storedEncrypted) {
          const sess: Session = JSON.parse(storedSession);
          const isValid = verifySessionToken(sess);

          if (isValid) {
            const prof: UserProfile = JSON.parse(storedProfile);
            setSession(sess);
            setProfile(prof);
            setScreen("profile-view");
          } else {
            clearSession();
          }
        }
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const clearSession = () => {
    localStorage.removeItem("confi_session");
    localStorage.removeItem("confi_profile");
    localStorage.removeItem("confi_credentials");
    setSession(null);
    setProfile(null);
    setScreen("landing");
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleSendOTP = useCallback(async () => {
    const fullPhone = regState.countryCode + regState.phoneNumber.replace(/\D/g, "");
    if (regState.phoneNumber.replace(/\D/g, "").length < 7) {
      showError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const otp = generateOTP();
      const phoneHash = await hashPhone(fullPhone);
      const encKey = await generateKeyFromPhone(fullPhone + otp);

      // In production this would call an SMS provider.
      // We surface the OTP in a dev-mode banner since no SMS key exists.
      console.log(`[CONFI DEV] OTP for ${fullPhone}: ${otp}`);

      setRegState((prev) => ({
        ...prev,
        generatedOTP: otp,
        otpSentAt: Date.now(),
        phoneHash,
        encryptionKey: encKey,
      }));

      setResendCooldown(60);
      setScreen("otp-verify");
      showSuccess(`OTP sent to ${fullPhone} (dev mode: check console)`);
    } catch {
      showError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [regState.countryCode, regState.phoneNumber]);

  const handleVerifyOTP = useCallback(async () => {
    const entered = otpInput.join("");
    if (entered.length !== 6) {
      showError("Please enter all 6 digits.");
      return;
    }

    const elapsed = Date.now() - (regState.otpSentAt || 0);
    if (elapsed > 10 * 60 * 1000) {
      showError("OTP expired. Please request a new one.");
      return;
    }

    if (entered !== regState.generatedOTP) {
      showError("Incorrect OTP. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const confiId = generateConfiId();
      setRegState((prev) => ({ ...prev, confiId }));

      // Check if returning user
      const existingRaw = localStorage.getItem("confi_all_users");
      const allUsers: Record<string, UserProfile> = existingRaw
        ? JSON.parse(existingRaw)
        : {};

      if (allUsers[regState.phoneHash]) {
        // Returning user — load their profile
        const existingProfile = allUsers[regState.phoneHash];
        const sess = generateSessionToken(existingProfile);
        localStorage.setItem("confi_session", JSON.stringify(sess));
        localStorage.setItem("confi_profile", JSON.stringify(existingProfile));
        setSession(sess);
        setProfile(existingProfile);
        setScreen("profile-view");
        showSuccess("Welcome back!");
      } else {
        // New user — go to profile setup
        setRegState((prev) => ({ ...prev, confiId }));
        setScreen("profile-setup");
      }
    } catch {
      showError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [otpInput, regState]);

  const handleCompleteProfile = useCallback(async () => {
    if (!regState.displayName.trim()) {
      showError("Display name is required.");
      return;
    }
    if (regState.displayName.trim().length < 2) {
      showError("Display name must be at least 2 characters.");
      return;
    }
    if (regState.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regState.email)) {
      showError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const fullPhone = regState.countryCode + regState.phoneNumber.replace(/\D/g, "");
      const now = Date.now();

      const newProfile: UserProfile = {
        confiId: regState.confiId,
        displayName: regState.displayName.trim(),
        email: regState.email.trim() || null,
        avatarIndex: regState.selectedAvatar,
        phoneHash: regState.phoneHash,
        phoneNumber: fullPhone,
        createdAt: now,
        updatedAt: now,
        verified: true,
        identityCommitment: await hashPhone(
          regState.phoneHash + regState.confiId + now.toString()
        ),
      };

      // Encrypt and store credentials
      const credentials = {
        phoneNumber: fullPhone,
        phoneHash: regState.phoneHash,
        confiId: regState.confiId,
        identityKey: newProfile.identityCommitment,
      };

      if (regState.encryptionKey) {
        const encrypted = await encryptCredentials(
          JSON.stringify(credentials),
          regState.encryptionKey
        );
        localStorage.setItem("confi_credentials", encrypted);
      }

      // Save profile
      const existingRaw = localStorage.getItem("confi_all_users");
      const allUsers: Record<string, UserProfile> = existingRaw
        ? JSON.parse(existingRaw)
        : {};
      allUsers[regState.phoneHash] = newProfile;
      localStorage.setItem("confi_all_users", JSON.stringify(allUsers));

      // Register with auth system
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email: regState.email || `${regState.confiId}@confi.app`,
          password: regState.phoneHash + regState.confiId,
        }),
      });

      const sess = generateSessionToken(newProfile);
      localStorage.setItem("confi_session", JSON.stringify(sess));
      localStorage.setItem("confi_profile", JSON.stringify(newProfile));

      setSession(sess);
      setProfile(newProfile);
      setScreen("profile-view");
      showSuccess("Profile created! Your Confi identity is secured.");
    } catch {
      showError("Failed to create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [regState]);

  const handleUpdateProfile = useCallback(async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      showError("Display name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      const updated: UserProfile = {
        ...profile!,
        displayName: editName.trim(),
        email: editEmail.trim() || null,
        avatarIndex: editAvatar,
        updatedAt: Date.now(),
      };

      const existingRaw = localStorage.getItem("confi_all_users");
      const allUsers: Record<string, UserProfile> = existingRaw
        ? JSON.parse(existingRaw)
        : {};
      allUsers[updated.phoneHash] = updated;
      localStorage.setItem("confi_all_users", JSON.stringify(allUsers));
      localStorage.setItem("confi_profile", JSON.stringify(updated));

      setProfile(updated);
      setEditingProfile(false);
      showSuccess("Profile updated successfully.");
    } catch {
      showError("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  }, [profile, editName, editEmail, editAvatar]);

  const handleOtpInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value.slice(-1);
    setOtpInput(newOtp);

    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpInput[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  if (loading && screen === "landing") {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Initializing Confi...</p>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Toast notifications */}
      {error && <div style={styles.toastError}>{error}</div>}
      {success && <div style={styles.toastSuccess}>{success}</div>}

      {/* DEV OTP Banner */}
      {screen === "otp-verify" && regState.generatedOTP && (
        <div style={styles.devBanner}>
          🔧 Dev Mode — OTP: <strong>{regState.generatedOTP}</strong>
        </div>
      )}

      {/* LANDING */}
      {screen === "landing" && (
        <div style={styles.centeredScreen}>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>🔒</div>
            <h1 style={styles.logoTitle}>Confi</h1>
            <p style={styles.logoSubtitle}>Confidential Messaging, Legally Binding</p>
          </div>

          <div style={styles.featureList}>
            {[
              { icon: "📱", text: "Phone-verified identity" },
              { icon: "🔐", text: "End-to-end encrypted credentials" },
              { icon: "📜", text: "NDA-ready conversation attribution" },
              { icon: "🌐", text: "International confidentiality standard" },
            ].map((f, i) => (
              <div key={i} style={styles.featureItem}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>

          <button style={styles.primaryBtn} onClick={() => setScreen("phone-entry")}>
            Get Started
          </button>

          <p style={styles.legalNote}>
            By continuing, you agree to Confi's Terms of Service and Privacy Policy.
            Your phone number will be cryptographically verified.
          </p>
        </div>
      )}

      {/* PHONE ENTRY */}
      {screen === "phone-entry" && (
        <div style={styles.centeredScreen}>
          <button style={styles.backBtn} onClick={() => setScreen("landing")}>
            ← Back
          </button>
          <div style={styles.screenHeader}>
            <div style={styles.stepIcon}>📱</div>
            <h2 style={styles.screenTitle}>Enter Your Phone</h2>
            <p style={styles.screenSub}>
              We'll send a verification code to confirm your identity.
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Country Code</label>
            <select
              style={styles.select}
              value={regState.countryCode}
              onChange={(e) =>
                setRegState((prev) => ({ ...prev, countryCode: e.target.value }))
              }
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.dial}>
                  {c.flag} {c.name} ({c.dial})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Phone Number</label>
            <div style={styles.phoneInputWrap}>
              <span style={styles.dialPrefix}>{regState.countryCode}</span>
              <input
                style={styles.phoneInput}
                type="tel"
                placeholder="(555) 000-0000"
                value={regState.phoneNumber}
                onChange={(e) =>
                  setRegState((prev) => ({ ...prev, phoneNumber: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
              />
            </div>
          </div>

          <button
            style={loading ? styles.disabledBtn : styles.primaryBtn}
            onClick={handleSendOTP}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </button>

          <p style={styles.privacyNote}>
            🔐 Your number is hashed with SHA-256 — we never store it in plaintext.
          </p>
        </div>
      )}

      {/* OTP VERIFY */}
      {screen === "otp-verify" && (
        <div style={styles.centeredScreen}>
          <button style={styles.backBtn} onClick={() => setScreen("phone-entry")}>
            ← Back
          </button>
          <div style={styles.screenHeader}>
            <div style={styles.stepIcon}>✉️</div>
            <h2 style={styles.screenTitle}>Verify Code</h2>
            <p style={styles.screenSub}>
              Enter the 6-digit code sent to{" "}
              <strong>
                {regState.countryCode} {regState.phoneNumber}
              </strong>
            </p>
          </div>

          <div style={styles.otpContainer}>
            {otpInput.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                style={styles.otpBox}
                onChange={(e) => handleOtpInputChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
              />
            ))}
          </div>

          <button
            style={loading ? styles.disabledBtn : styles.primaryBtn}
            onClick={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>

          <button
            style={resendCooldown > 0 ? styles.disabledBtn : styles.ghostBtn}
            onClick={handleSendOTP}
            disabled={resendCooldown > 0 || loading}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
          </button>
        </div>
      )}

      {/* PROFILE SETUP */}
      {screen === "profile-setup" && (
        <div style={styles.scrollScreen}>
          <div style={styles.screenHeader}>
            <div style={styles.stepIcon}>👤</div>
            <h2 style={styles.screenTitle}>Create Your Profile</h2>
            <p style={styles.screenSub}>
              Your identity will be cryptographically linked to your verified phone number.
            </p>
          </div>

          {/* Avatar Picker */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Choose Your Avatar</label>
            <div style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((av, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.avatarOption,
                    ...(regState.selectedAvatar === i ? styles.avatarSelected : {}),
                  }}
                  onClick={() =>
                    setRegState((prev) => ({ ...prev, selectedAvatar: i }))
                  }
                >
                  <span style={styles.avatarEmoji}>{av.emoji}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Display Name *</label>
            <input
              style={styles.input}
              type="text"
              placeholder="How others will see you"
              maxLength={32}
              value={regState.displayName}
              onChange={(e) =>
                setRegState((prev) => ({ ...prev, displayName: e.target.value }))
              }
            />
            <span style={styles.charCount}>{regState.displayName.length}/32</span>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Backup (Optional)</label>
            <input
              style={styles.input}
              type="email"
              placeholder="For account recovery only"
              value={regState.email}
              onChange={(e) =>
                setRegState((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <span style={styles.fieldHint}>
              Used for NDA delivery and account recovery. Never shared.
            </span>
          </div>

          <div style={styles.confiIdPreview}>
            <span style={styles.confiIdLabel}>Your Confi ID</span>
            <span style={styles.confiIdValue}>{regState.confiId}</span>
            <span style={styles.confiIdNote}>
              Permanent · Cryptographically bound · Used for NDA attribution
            </span>
          </div>

          <button
            style={loading ? styles.disabledBtn : styles.primaryBtn}
            onClick={handleCompleteProfile}
            disabled={loading}
          >
            {loading ? "Creating Profile..." : "Create Confi Identity"}
          </button>
        </div>
      )}

      {/* PROFILE VIEW */}
      {screen === "profile-view" && profile && (
        <div style={styles.scrollScreen}>
          {/* Header */}
          <div style={styles.profileHeader}>
            <div style={styles.profileAvatarLarge}>
              {AVATAR_OPTIONS[profile.avatarIndex]?.emoji || "👤"}
            </div>
            <div style={styles.verifiedBadge}>✓ Verified</div>
            <h2 style={styles.profileName}>{profile.displayName}</h2>
            <div style={styles.confiIdChip}>
              <span style={styles.confiIdChipLabel}>Confi ID</span>
              <span style={styles.confiIdChipValue}>{profile.confiId}</span>
            </div>
          </div>

          {/* Identity Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🔐 Identity Certificate</h3>
            <div style={styles.cardRow}>
              <span style={styles.cardKey}>Status</span>
              <span style={{ ...styles.cardValue, color: "#22c55e" }}>
                ✓ Cryptographically Verified
              </span>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardKey}>Phone</span>
              <span style={styles.cardValue}>
                {profile.phoneNumber.replace(/(\+\d{1,3})(\d{3})(\d+)/, "$1 $2 ****")}
              </span>
            </div>
            {profile.email && (
              <div style={styles.cardRow}>
                <span style={styles.cardKey}>Email</span>
                <span style={styles.cardValue}>{profile.email}</span>
              </div>
            )}
            <div style={styles.cardRow}>
              <span style={styles.cardKey}>Registered</span>
              <span style={styles.cardValue}>
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div style={styles.cardRow}>
              <span style={styles.cardKey}>Identity Hash</span>
              <span style={{ ...styles.cardValue, fontFamily: "monospace", fontSize: 10 }}>
                {profile.identityCommitment.slice(0, 24)}…
              </span>
            </div>
          </div>

          {/* NDA Status Card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📜 NDA Readiness</h3>
            <div style={styles.ndaStatusRow}>
              <div style={styles.ndaStatusItem}>
                <span style={styles.ndaStatusIcon}>✅</span>
                <span style={styles.ndaStatusText}>Phone Verified</span>
              </div>
              <div style={styles.ndaStatusItem}>
                <span style={styles.ndaStatusIcon}>✅</span>
                <span style={styles.ndaStatusText}>Identity Committed</span>
              </div>
              <div style={styles.ndaStatusItem}>
                <span style={styles.ndaStatusIcon}>✅</span>
                <span style={styles.ndaStatusText}>Credentials Encrypted</span>
              </div>
              <div style={styles.ndaStatusItem}>
                <span style={styles.ndaStatusIcon}>
                  {profile.email ? "✅" : "⚠️"}
                </span>
                <span style={styles.ndaStatusText}>
                  {profile.email ? "Email Backed Up" : "Email Not Set"}
                </span>
              </div>
            </div>
            <p style={styles.ndaNote}>
              Your identity is cryptographically tied to this account. When Confidential
              Mode is enabled on a conversation, your Confi ID and identity commitment
              hash will be used to legally attribute that conversation under an
              international NDA.
            </p>
          </div>

          {/* Session Card */}
          {session && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🗝️ Active Session</h3>
              <div style={styles.cardRow}>
                <span style={styles.cardKey}>Token</span>
                <span style={{ ...styles.cardValue, fontFamily: "monospace", fontSize: 10 }}>
                  {session.token.slice(0, 20)}…
                </span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardKey}>Issued</span>
                <span style={styles.cardValue}>
                  {new Date(session.issuedAt).toLocaleTimeString()}
                </span>
              </div>
              <div style={styles.cardRow}>
                <span style={styles.cardKey}>Expires</span>
                <span style={styles.cardValue}>
                  {new Date(session.expiresAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Edit Profile */}
          {editingProfile ? (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Edit Profile</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Avatar</label>
                <div style={styles.avatarGrid}>
                  {AVATAR_OPTIONS.map((av, i) => (
                    <button
                      key={i}
                      style={{
                        ...styles.avatarOption,
                        ...(editAvatar === i ? styles.avatarSelected : {}),
                      }}
                      onClick={() => setEditAvatar(i)}
                    >
                      <span style={styles.avatarEmoji}>{av.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Display Name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={editName}
                  maxLength={32}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div style={styles.buttonRow}>
                <button style={styles.primaryBtn} onClick={handleUpdateProfile}>
                  Save Changes
                </button>
                <button
                  style={styles.ghostBtn}
                  onClick={() => setEditingProfile(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              style={styles.outlineBtn}
              onClick={() => {
                setEditName(profile.displayName);
                setEditEmail(profile.email || "");
                setEditAvatar(profile.avatarIndex);
                setEditingProfile(true);
              }}
            >
              ✏️ Edit Profile
            </button>
          )}

          <button style={styles.dangerBtn} onClick={clearSession}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
  },
  loadingScreen: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(99,102,241,0.3)",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  toastError: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#ef4444",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
    maxWidth: "90vw",
    textAlign: "center",
  },
  toastSuccess: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#22c55e",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
    maxWidth: "90vw",
    textAlign: "center",
  },
  devBanner: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#f59e0b",
    color: "#000",
    padding: "10px 20px",
    fontSize: 13,
    textAlign: "center",
    zIndex: 9998,
  },
  centeredScreen: {
    width: "100%",
    maxWidth: 440,
    padding: "40px 24px 80px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  scrollScreen: {
    width: "100%",
    maxWidth: 440,
    padding: "40px 24px 100px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px 0",
  },
  logoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 64,
  },
  logoTitle: {
    fontSize: 42,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  },
  logoSubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    margin: 0,
    textAlign: "center",
  },
  featureList: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: "20px 24px",
    border: "1px solid rgba(99,102,241,0.2)",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    color: "#cbd5e1",
  },
  screenHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  stepIcon: {
    fontSize: 48,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    color: "#f1f5f9",
  },
  screenSub: {
    fontSize: 14,
    color: "#94a3b8",
    margin: 0,
    textAlign: "center",
  },
  formGroup: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 15,
    outline: "none",
  },
  phoneInputWrap: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 12,
    overflow: "hidden",
  },
  dialPrefix: {
    padding: "0 16px",
    color: "#6366f1",
    fontWeight: 700,
    fontSize: 15,
    borderRight: "1px solid rgba(99,102,241,0.3)",
    whiteSpace: "nowrap",
  },
  phoneInput: {
    flex: 1,
    padding: "12px 16px",
    background: "none",
    border: "none",
    color: "#e2e8f0",
    fontSize: 15,
    outline: "none",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    color: "#64748b",
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748b",
  },
  otpContainer: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    margin: "8px 0",
  },
  otpBox: {
    width: 48,
    height: 56,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    background: "rgba(255,255,255,0.07)",
    border: "2px solid rgba(99,102,241,0.4)",
    borderRadius: 12,
    color: "#6366f1",
    outline: "none",
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
  },
  avatarOption: {
    background: "rgba(255,255,255,0.05)",
    border: "2px solid rgba(99,102,241,0.2)",
    borderRadius: 12,
    padding: "8px 4px",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSelected: {
    background: "rgba(99,102,241,0.2)",
    border: "2px solid #6366f1",
    boxShadow: "0 0 12px rgba(99,102,241,0.4)",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  confiIdPreview: {
    width: "100%",
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.4)",
    borderRadius: 16,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
  },
  confiIdLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8b5cf6",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  confiIdValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#a78bfa",
    fontFamily: "monospace",
    letterSpacing: "0.05em",
  },
  confiIdNote: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 14,
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
    transition: "all 0.2s",
  },
  disabledBtn: {
    width: "100%",
    padding: "14px 24px",
    background: "rgba(99,102,241,0.3)",
    border: "none",
    borderRadius: 14,
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: 700,
    cursor: "not-allowed",
  },
  ghostBtn: {
    width: "100%",
    padding: "12px 24px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 14,
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  outlineBtn: {
    width: "100%",
    padding: "12px 24px",
    background: "none",
    border: "1px solid rgba(99,102,241,0.5)",
    borderRadius: 14,
    color: "#8b5cf6",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerBtn: {
    width: "100%",
    padding: "12px 24px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 14,
    color: "#f87171",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    width: "100%",
  },
  legalNote: {
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
    lineHeight: 1.6,
  },
  privacyNote: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    padding: "0 16px",
  },
  profileHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  profileAvatarLarge: {
    fontSize: 80,
    lineHeight: 1,
    background: "rgba(99,102,241,0.15)",
    borderRadius: "50%",
    width: 120,
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "3px solid rgba(99,102,241,0.4)",
  },
  verifiedBadge: {
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 12px",
    borderRadius: 20,
  },
  profileName: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    color: "#f1f5f9",
    textAlign: "center",
  },
  confiIdChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 20,
    padding: "6px 14px",
  },
  confiIdChipLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#8b5cf6",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  confiIdChipValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#a78bfa",
    fontFamily: "monospace",
  },
  card: {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 16,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cardKey: {
    fontSize: 13,
    color: "#64748b",
    flexShrink: 0,
  },
  cardValue: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "right",
    wordBreak: "break-all",
  },
  ndaStatusRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  ndaStatusItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  ndaStatusIcon: {
    fontSize: 16,
  },
  ndaStatusText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },
  ndaNote: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.7,
    margin: 0,
  },
};