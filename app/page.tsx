"use client";

import { useState, useEffect, useCallback } from "react";
import { getAvatar, AVATARS } from "@/lib/avatars";

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen =
  | "welcome"
  | "register"
  | "otp"
  | "login"
  | "profile-setup"
  | "legal-name"
  | "dashboard";

interface UserProfile {
  id: number;
  email: string;
  displayName: string | null;
  legalFullName: string | null;
  legalNameVerified: boolean;
  avatar: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

function saveAuth(auth: AuthState) {
  if (typeof window === "undefined") return;
  localStorage.setItem("confi_access", auth.accessToken ?? "");
  localStorage.setItem("confi_refresh", auth.refreshToken ?? "");
  localStorage.setItem("confi_user", JSON.stringify(auth.user ?? {}));
}

function loadAuth(): AuthState {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, user: null };
  }
  const accessToken = localStorage.getItem("confi_access") || null;
  const refreshToken = localStorage.getItem("confi_refresh") || null;
  const userStr = localStorage.getItem("confi_user");
  let user: UserProfile | null = null;
  try {
    if (userStr) user = JSON.parse(userStr);
  } catch {}
  return { accessToken, refreshToken, user };
}

function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("confi_access");
  localStorage.removeItem("confi_refresh");
  localStorage.removeItem("confi_user");
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    user: null,
  });
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Track page view ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // ── Restore session on mount ───────────────────────────────────────────────
  const tryRefreshSession = useCallback(async (refreshToken: string) => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.ok) return false;

      // Fetch profile with new access token
      const profileRes = await fetch("/api/profile/me", {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      if (!profileRes.ok) return false;
      const profileData = await profileRes.json();

      const newAuth: AuthState = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: profileData.user,
      };
      setAuth(newAuth);
      saveAuth(newAuth);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = loadAuth();
    if (stored.refreshToken) {
      tryRefreshSession(stored.refreshToken).then((ok) => {
        if (!ok) clearAuth();
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [tryRefreshSession]);

  useEffect(() => {
    if (loading) return;
    if (auth.user) {
      if (!auth.user.displayName) {
        setScreen("profile-setup");
      } else if (!auth.user.legalNameVerified) {
        setScreen("legal-name");
      } else {
        setScreen("dashboard");
      }
    } else {
      setScreen("welcome");
    }
  }, [auth.user, loading]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  // ─── Loading Screen ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.loadingSpinner} />
        <p style={{ color: "var(--text-secondary)", marginTop: 16 }}>
          Loading Confi...
        </p>
      </div>
    );
  }

  // ─── Screen Router ──────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {screen === "welcome" && (
        <WelcomeScreen
          onRegister={() => { clearMessages(); setScreen("register"); }}
          onLogin={() => { clearMessages(); setScreen("login"); }}
        />
      )}
      {screen === "register" && (
        <RegisterScreen
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onOTPSent={(email) => {
            setPendingEmail(email);
            setScreen("otp");
          }}
          onBack={() => { clearMessages(); setScreen("welcome"); }}
        />
      )}
      {screen === "otp" && (
        <OTPScreen
          email={pendingEmail}
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onVerified={(accessToken, refreshToken) => {
            clearMessages();
            const newAuth: AuthState = {
              accessToken,
              refreshToken,
              user: { id: 0, email: pendingEmail, displayName: null, legalFullName: null, legalNameVerified: false, avatar: "avatar1" },
            };
            setAuth(newAuth);
            saveAuth(newAuth);
          }}
          onBack={() => { clearMessages(); setScreen("register"); }}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onLoggedIn={(accessToken, refreshToken, user) => {
            clearMessages();
            const newAuth: AuthState = { accessToken, refreshToken, user };
            setAuth(newAuth);
            saveAuth(newAuth);
          }}
          onBack={() => { clearMessages(); setScreen("welcome"); }}
        />
      )}
      {screen === "profile-setup" && auth.accessToken && (
        <ProfileSetupScreen
          accessToken={auth.accessToken}
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onComplete={(newAccessToken, newRefreshToken, displayName, avatar) => {
            clearMessages();
            const updatedUser: UserProfile = {
              ...(auth.user!),
              displayName,
              avatar,
            };
            const newAuth: AuthState = {
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              user: updatedUser,
            };
            setAuth(newAuth);
            saveAuth(newAuth);
          }}
        />
      )}
      {screen === "legal-name" && auth.accessToken && auth.user && (
        <LegalNameScreen
          accessToken={auth.accessToken}
          user={auth.user}
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
          onComplete={(newAccessToken, legalFullName) => {
            clearMessages();
            const updatedUser: UserProfile = {
              ...auth.user!,
              legalFullName,
              legalNameVerified: true,
            };
            const newAuth: AuthState = {
              accessToken: newAccessToken,
              refreshToken: auth.refreshToken,
              user: updatedUser,
            };
            setAuth(newAuth);
            saveAuth(newAuth);
          }}
        />
      )}
      {screen === "dashboard" && auth.user && (
        <DashboardScreen
          user={auth.user}
          accessToken={auth.accessToken!}
          onLogout={async () => {
            await fetch("/api/auth/logout", {
              method: "POST",
              headers: { Authorization: `Bearer ${auth.accessToken}` },
            });
            clearAuth();
            setAuth({ accessToken: null, refreshToken: null, user: null });
            setScreen("welcome");
          }}
          onSetupLegalName={() => setScreen("legal-name")}
        />
      )}
    </div>
  );
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function WelcomeScreen({
  onRegister,
  onLogin,
}: {
  onRegister: () => void;
  onLogin: () => void;
}) {
  return (
    <div style={styles.centered}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logo}>🔐</div>
          <h1 style={styles.logoText}>Confi</h1>
          <p style={styles.logoSub}>Confidential Messaging</p>
        </div>

        <div style={styles.featurePills}>
          <span style={styles.pill}>🛡️ End-to-End Encrypted</span>
          <span style={styles.pill}>📜 NDA Protected</span>
          <span style={styles.pill}>⚖️ Legally Binding</span>
        </div>

        <p style={{ color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6, marginBottom: 32 }}>
          The world's first messaging platform where turning on Confidential Mode activates an international NDA — making every message legally protected.
        </p>

        <button style={styles.btnPrimary} onClick={onRegister}>
          Create Account
        </button>
        <button style={{ ...styles.btnSecondary, marginTop: 12 }} onClick={onLogin}>
          Sign In
        </button>
      </div>
    </div>
  );
}

// ─── Register Screen ─────────────────────────────────────────────────────────

function RegisterScreen({
  error,
  success,
  setError,
  setSuccess,
  onOTPSent,
  onBack,
}: {
  error: string;
  success: string;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
  onOTPSent: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (pw.length === 0) return { label: "", color: "transparent", width: "0%" };
    if (pw.length < 8) return { label: "Too short", color: "#ef4444", width: "20%" };
    let score = 0;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "#ef4444", width: "33%" };
    if (score === 2) return { label: "Fair", color: "#f59e0b", width: "55%" };
    if (score === 3) return { label: "Good", color: "#10b981", width: "77%" };
    return { label: "Strong", color: "#10b981", width: "100%" };
  };

  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      const msg = data._devOtp
        ? `OTP sent! (Dev mode — your OTP: ${data._devOtp})`
        : "OTP sent to your email. Check your inbox.";
      setSuccess(msg);
      setTimeout(() => onOTPSent(email), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.centered}>
      <div style={styles.card}>
        <BackButton onClick={onBack} />
        <h2 style={styles.heading}>Create Account</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Join Confi for legally protected messaging
        </p>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <form onSubmit={handleSubmit}>
          <Field label="Email Address">
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="Password">
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingRight: 44 }}
                type={showPass ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
            {password && (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: strength.width, background: strength.color, transition: "width 0.3s, background 0.3s", borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: strength.color, marginTop: 2, display: "block" }}>
                  {strength.label}
                </span>
              </div>
            )}
          </Field>

          <Field label="Confirm Password">
            <input
              style={styles.input}
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </Field>

          <button
            style={{ ...styles.btnPrimary, marginTop: 8 }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Sending OTP…" : "Continue →"}
          </button>
        </form>

        <p style={styles.switchText}>
          Already have an account?{" "}
          <button style={styles.linkBtn} onClick={onBack}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── OTP Screen ──────────────────────────────────────────────────────────────

function OTPScreen({
  email,
  error,
  success,
  setError,
  setSuccess,
  onVerified,
  onBack,
}: {
  email: string;
  error: string;
  success: string;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
  onVerified: (accessToken: string, refreshToken: string) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      setSuccess("Email verified! Setting up your profile…");
      setTimeout(() => onVerified(data.accessToken, data.refreshToken), 1000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to resend");
        return;
      }
      const msg = data._devOtp
        ? `New OTP: ${data._devOtp}`
        : "New OTP sent to your email";
      setSuccess(msg);
      setResendCooldown(60);
    } catch {
      setError("Network error");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={styles.centered}>
      <div style={styles.card}>
        <BackButton onClick={onBack} />
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <h2 style={styles.heading}>Verify Your Email</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            We sent a 6-digit code to
          </p>
          <p style={{ color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>
            {email}
          </p>
        </div>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <form onSubmit={handleVerify}>
          <Field label="6-Digit OTP Code">
            <input
              style={{ ...styles.input, textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
            />
          </Field>

          <button
            style={{ ...styles.btnPrimary, marginTop: 8 }}
            type="submit"
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying…" : "Verify OTP"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            style={{
              ...styles.linkBtn,
              opacity: resendCooldown > 0 || resendLoading ? 0.5 : 1,
              cursor: resendCooldown > 0 || resendLoading ? "not-allowed" : "pointer",
            }}
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendLoading}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resendLoading
              ? "Sending…"
              : "Resend OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({
  error,
  success,
  setError,
  setSuccess,
  onLoggedIn,
  onBack,
}: {
  error: string;
  success: string;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
  onLoggedIn: (
    accessToken: string,
    refreshToken: string,
    user: UserProfile
  ) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      setSuccess("Welcome back!");
      setTimeout(() => onLoggedIn(data.accessToken, data.refreshToken, data.user), 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.centered}>
      <div style={styles.card}>
        <BackButton onClick={onBack} />
        <h2 style={styles.heading}>Welcome Back</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Sign in to your Confi account
        </p>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <form onSubmit={handleSubmit}>
          <Field label="Email Address">
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="Password">
            <div style={{ position: "relative" }}>
              <input
                style={{ ...styles.input, paddingRight: 44 }}
                type={showPass ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>

          <button
            style={{ ...styles.btnPrimary, marginTop: 8 }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={styles.switchText}>
          Don't have an account?{" "}
          <button style={styles.linkBtn} onClick={onBack}>
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Profile Setup Screen ─────────────────────────────────────────────────────

function ProfileSetupScreen({
  accessToken,
  error,
  success,
  setError,
  setSuccess,
  onComplete,
}: {
  accessToken: string;
  error: string;
  success: string;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
  onComplete: (
    accessToken: string,
    refreshToken: string,
    displayName: string,
    avatar: string
  ) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar1");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ displayName, avatar: selectedAvatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Profile setup failed");
        return;
      }
      setSuccess("Profile created!");
      setTimeout(
        () => onComplete(data.accessToken, data.refreshToken, displayName, selectedAvatar),
        800
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const av = getAvatar(selectedAvatar);

  return (
    <div style={styles.centered}>
      <div style={{ ...styles.card, maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: av.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              margin: "0 auto 16px",
              border: "3px solid var(--accent)",
            }}
          >
            {av.emoji}
          </div>
          <h2 style={styles.heading}>Set Up Your Profile</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Choose how others will see you in Confi
          </p>
        </div>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <form onSubmit={handleSubmit}>
          <Field label="Display Name">
            <input
              style={styles.input}
              type="text"
              placeholder="How you'll appear in chats"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              required
              autoFocus
            />
          </Field>

          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Choose Your Avatar</label>
            <div style={styles.avatarGrid}>
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  style={{
                    ...styles.avatarBtn,
                    background: a.bg,
                    border: selectedAvatar === a.id
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                    transform: selectedAvatar === a.id ? "scale(1.1)" : "scale(1)",
                  }}
                  onClick={() => setSelectedAvatar(a.id)}
                  title={a.label}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            style={styles.btnPrimary}
            type="submit"
            disabled={loading || displayName.trim().length < 2}
          >
            {loading ? "Saving…" : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Legal Name Screen ────────────────────────────────────────────────────────

function LegalNameScreen({
  accessToken,
  user,
  error,
  success,
  setError,
  setSuccess,
  onComplete,
}: {
  accessToken: string;
  user: UserProfile;
  error: string;
  success: string;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
  onComplete: (newAccessToken: string, legalFullName: string) => void;
}) {
  const [legalFullName, setLegalFullName] = useState("");
  const [confirmLegalFullName, setConfirmLegalFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const av = getAvatar(user.avatar);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("You must agree to the terms before submitting your legal name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile/verify-legal-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ legalFullName, confirmLegalFullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      setSuccess("Legal identity verified! You're all set.");
      setTimeout(() => onComplete(data.accessToken, legalFullName), 1200);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.centered}>
      <div style={{ ...styles.card, maxWidth: 540 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚖️</div>
          <h2 style={styles.heading}>Identity Verification</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
            Your legal name will be bound to all NDA agreements made on Confi.
            This is a one-time verification and cannot be changed.
          </p>
        </div>

        <div style={styles.ndaNotice}>
          <div style={styles.ndaNoticeBadge}>📜 Legal Notice</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
            By submitting your legal name, you acknowledge that:
          </p>
          <ul style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.9, paddingLeft: 20, marginTop: 8 }}>
            <li>Your name as entered will be your legal identity on this platform</li>
            <li>Any NDA you enter via Confi's Confidential Mode will be signed under this name</li>
            <li>Providing a false name may constitute fraud under applicable law</li>
            <li>This name cannot be changed once verified</li>
          </ul>
        </div>

        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: 12, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {av.emoji}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{user.displayName}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Legal Full Name">
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Jane Marie Smith"
              value={legalFullName}
              onChange={(e) => setLegalFullName(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="Confirm Legal Full Name">
            <input
              style={{
                ...styles.input,
                borderColor: confirmLegalFullName && confirmLegalFullName !== legalFullName
                  ? "var(--danger)"
                  : undefined,
              }}
              type="text"
              placeholder="Re-enter your full legal name"
              value={confirmLegalFullName}
              onChange={(e) => setConfirmLegalFullName(e.target.value)}
              required
            />
            {confirmLegalFullName && confirmLegalFullName !== legalFullName && (
              <span style={{ fontSize: 12, color: "var(--danger)", marginTop: 4, display: "block" }}>
                Names do not match
              </span>
            )}
          </Field>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              I confirm this is my true legal name and I understand it will be used for legally binding NDA agreements on this platform.
            </span>
          </label>

          <button
            style={{
              ...styles.btnPrimary,
              marginTop: 16,
              background: agreed ? "var(--accent)" : "var(--text-muted)",
            }}
            type="submit"
            disabled={loading || !agreed}
          >
            {loading ? "Verifying…" : "🔐 Verify Legal Identity"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen({
  user,
  accessToken,
  onLogout,
  onSetupLegalName,
}: {
  user: UserProfile;
  accessToken: string;
  onLogout: () => void;
  onSetupLegalName: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chats" | "profile">("chats");
  const [loggingOut, setLoggingOut] = useState(false);
  const av = getAvatar(user.avatar);

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
  };

  return (
    <div style={styles.appShell}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: av.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {av.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.displayName}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </p>
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--success)",
              flexShrink: 0,
            }}
            title="Online"
          />
        </div>

        <nav style={styles.sidebarNav}>
          <button
            style={{
              ...styles.navBtn,
              background: activeTab === "chats" ? "var(--accent-light)" : "transparent",
              color: activeTab === "chats" ? "var(--accent)" : "var(--text-secondary)",
            }}
            onClick={() => setActiveTab("chats")}
          >
            💬 Chats
          </button>
          <button
            style={{
              ...styles.navBtn,
              background: activeTab === "profile" ? "var(--accent-light)" : "transparent",
              color: activeTab === "profile" ? "var(--accent)" : "var(--text-secondary)",
            }}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profile
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          {user.legalNameVerified && (
            <div style={styles.verifiedBadge}>
              ✅ Identity Verified
            </div>
          )}
          <button
            style={styles.logoutBtn}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "🚪 Sign Out"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.mainContent}>
        {activeTab === "chats" && (
          <ChatsPlaceholder user={user} onSetupLegalName={onSetupLegalName} />
        )}
        {activeTab === "profile" && (
          <ProfileView user={user} onSetupLegalName={onSetupLegalName} />
        )}
      </div>
    </div>
  );
}

// ─── Chats Placeholder ─────────────────────────────────────────────────────────

function ChatsPlaceholder({
  user,
  onSetupLegalName,
}: {
  user: UserProfile;
  onSetupLegalName: () => void;
}) {
  return (
    <div style={styles.emptyState}>
      {!user.legalNameVerified && (
        <div style={{ ...styles.ndaNotice, maxWidth: 500, marginBottom: 32, textAlign: "left" }}>
          <div style={styles.ndaNoticeBadge}>⚠️ Action Required</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 12 }}>
            Complete your identity verification to access Confi's NDA-protected messaging features.
          </p>
          <button style={styles.btnPrimary} onClick={onSetupLegalName}>
            ⚖️ Verify Legal Identity
          </button>
        </div>
      )}

      <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        No conversations yet
      </h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 300, textAlign: "center", lineHeight: 1.6 }}>
        Start a new chat or wait for someone to reach out. Enable Confidential Mode to add NDA protection.
      </p>

      <div style={styles.featureGrid}>
        <div style={styles.featureCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <h4 style={{ fontWeight: 700, marginBottom: 4 }}>Confidential Mode</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Activate international NDA protection on any conversation
          </p>
        </div>
        <div style={styles.featureCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚖️</div>
          <h4 style={{ fontWeight: 700, marginBottom: 4 }}>Legally Binding</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Your verified identity makes every NDA enforceable
          </p>
        </div>
        <div style={styles.featureCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
          <h4 style={{ fontWeight: 700, marginBottom: 4 }}>Auditable</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Full audit trail for every confidential conversation
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView({
  user,
  onSetupLegalName,
}: {
  user: UserProfile;
  onSetupLegalName: () => void;
}) {
  const av = getAvatar(user.avatar);

  return (
    <div style={styles.profileView}>
      <div style={styles.profileHero}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: av.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            border: "4px solid var(--accent)",
            marginBottom: 16,
          }}
        >
          {av.emoji}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>{user.displayName}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{user.email}</p>

        {user.legalNameVerified && (
          <div style={{ ...styles.verifiedBadge, marginTop: 12, fontSize: 13, padding: "6px 16px" }}>
            ✅ Identity Verified
          </div>
        )}
      </div>

      <div style={styles.profileSections}>
        <ProfileSection title="Account Details">
          <ProfileRow label="Display Name" value={user.displayName ?? "—"} />
          <ProfileRow label="Email" value={user.email} />
          <ProfileRow label="Email Verified" value="✅ Yes" />
        </ProfileSection>

        <ProfileSection title="Legal Identity">
          {user.legalNameVerified ? (
            <>
              <ProfileRow
                label="Legal Full Name"
                value={user.legalFullName ?? "—"}
                note="This name is binding on all NDA agreements"
              />
              <ProfileRow
                label="NDA Signatory Status"
                value="✅ Verified & Active"
              />
              <div style={styles.ndaInfo}>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  🔐 Your legal identity is confirmed. Any conversation you protect with Confidential Mode will have an NDA signed under the name <strong style={{ color: "var(--text-primary)" }}>{user.legalFullName}</strong>.
                </p>
              </div>
            </>
          ) : (
            <div style={{ padding: 16 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                You haven't verified your legal identity yet. This is required to use Confi's NDA-protected Confidential Mode.
              </p>
              <button style={styles.btnPrimary} onClick={onSetupLegalName}>
                ⚖️ Verify Legal Identity
              </button>
            </div>
          )}
        </ProfileSection>

        <ProfileSection title="Security">
          <ProfileRow label="Sessions" value="1 active device" />
          <ProfileRow label="Account Type" value="Standard" />
          <ProfileRow label="Two-Factor Auth" value="Coming soon" />
        </ProfileSection>
      </div>
    </div>
  );
}

// ─── Small UI Components ──────────────────────────────────────────────────────

function Alert({ type, message }: { type: "error" | "success" | "warning"; message: string }) {
  const colors = {
    error: { bg: "var(--danger-light)", border: "var(--danger)", text: "#ef4444" },
    success: { bg: "var(--success-light)", border: "var(--success)", text: "#10b981" },
    warning: { bg: "var(--warning-light)", border: "var(--warning)", text: "#f59e0b" },
  };
  const c = colors[type];
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius-sm)",
        padding: "12px 16px",
        marginBottom: 16,
        color: c.text,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      style={{
        background: "none",
        border: "none",
        color: "var(--text-secondary)",
        cursor: "pointer",
        fontSize: 14,
        padding: "0 0 16px 0",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onClick={onClick}
    >
      ← Back
    </button>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.profileSection}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function ProfileRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div style={styles.profileRow}>
      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
        {note && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "var(--bg-primary)",
  },
  centered: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 36,
    width: "100%",
    maxWidth: 460,
    boxShadow: "var(--shadow)",
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    border: "3px solid var(--border)",
    borderTop: "3px solid var(--accent)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  logoWrap: {
    textAlign: "center",
    marginBottom: 28,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 900,
    color: "var(--text-primary)",
    letterSpacing: -1,
  },
  logoSub: {
    color: "var(--text-secondary)",
    fontSize: 14,
    marginTop: 4,
  },
  featurePills: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  pill: {
    background: "var(--accent-light)",
    color: "var(--accent)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
  },
  heading: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 6,
    color: "var(--text-primary)",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: "var(--bg-input)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    padding: "12px 14px",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
  btnPrimary: {
    width: "100%",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "13px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
  },
  btnSecondary: {
    width: "100%",
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    cursor: "pointer",
    fontSize: "inherit",
    padding: 0,
    textDecoration: "underline",
  },
  switchText: {
    textAlign: "center",
    marginTop: 20,
    color: "var(--text-secondary)",
    fontSize: 14,
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    marginTop: 8,
  },
  avatarBtn: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    cursor: "pointer",
    transition: "transform 0.2s, border 0.2s",
    padding: 0,
  },
  ndaNotice: {
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "var(--radius-sm)",
    padding: 16,
    marginBottom: 20,
  },
  ndaNoticeBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--warning)",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  checkboxRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    cursor: "pointer",
    marginTop: 8,
  },
  appShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
  },
  sidebar: {
    width: 260,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: "20px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid var(--border)",
  },
  sidebarNav: {
    padding: "12px 8px",
    flex: 1,
    overflowY: "auto" as const,
  },
  navBtn: {
    width: "100%",
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    textAlign: "left" as const,
    padding: "10px 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 4,
    transition: "background 0.15s, color 0.15s",
  },
  sidebarFooter: {
    padding: "16px",
    borderTop: "1px solid var(--border)",
  },
  verifiedBadge: {
    background: "var(--success-light)",
    border: "1px solid rgba(16,185,129,0.3)",
    color: "var(--success)",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 700,
    display: "inline-block",
    marginBottom: 10,
  },
  logoutBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)",
    padding: "9px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
    textAlign: "left" as const,
  },
  mainContent: {
    flex: 1,
    overflow: "auto",
    background: "var(--bg-primary)",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
    padding: 40,
    textAlign: "center",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginTop: 40,
    maxWidth: 600,
    width: "100%",
  },
  featureCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    textAlign: "center",
  },
  profileView: {
    maxWidth: 640,
    margin: "0 auto",
    padding: 40,
  },
  profileHero: {
    textAlign: "center",
    marginBottom: 40,
  },
  profileSections: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  profileSection: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  profileRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
  },
  ndaInfo: {
    padding: "14px 20px",
    background: "rgba(99,102,241,0.05)",
  },
};