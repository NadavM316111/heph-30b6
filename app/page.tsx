"use client";

import { useState, useEffect, useRef } from "react";

type Screen =
  | "landing"
  | "register"
  | "login"
  | "otp"
  | "profile-setup"
  | "dashboard"
  | "recover";

interface User {
  email: string;
  displayName?: string;
  avatar?: string;
  phone?: string;
}

interface Session {
  user: User;
  token: string;
  createdAt: number;
}

const OTP_LENGTH = 6;
const SESSION_KEY = "confi_session";
const PROFILE_KEY = "confi_profile";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateJWT(email: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({ sub: email, iat: Date.now(), exp: Date.now() + 86400000 * 7 })
  );
  const sig = btoa(`confi_sig_${email}_${Date.now()}`);
  return `${header}.${payload}.${sig}`;
}

function parseJWTPayload(token: string): { sub: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

function isSessionValid(session: Session): boolean {
  const payload = parseJWTPayload(session.token);
  if (!payload) return false;
  return payload.exp > Date.now();
}

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpInput, setOtpInput] = useState(["", "", "", "", "", ""]);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpMode, setOtpMode] = useState<"register" | "login" | "recover">("register");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string>("");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [registerMode, setRegisterMode] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<"email" | "otp" | "reset">("email");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed: Session = JSON.parse(stored);
        if (isSessionValid(parsed)) {
          setSession(parsed);
          const profile = localStorage.getItem(PROFILE_KEY + "_" + parsed.user.email);
          if (profile) {
            const p = JSON.parse(profile);
            parsed.user.displayName = p.displayName;
            parsed.user.avatar = p.avatar;
            parsed.user.phone = p.phone;
            setSession({ ...parsed });
          }
          setScreen("dashboard");
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (screen === "otp") {
      setOtpTimer(60);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setOtpTimer((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleRegister = async () => {
    clearMessages();
    if (!email && registerMode === "email") {
      setError("Please enter your email address.");
      return;
    }
    if (!phone && registerMode === "phone") {
      setError("Please enter your phone number.");
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
      const identifier = registerMode === "email" ? email : `${phone}@phone.confi`;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: identifier, password }),
      });
      const data = await res.json();
      if (data.ok) {
        const otp = generateOTP();
        setGeneratedOTP(otp);
        setOtpMode("register");
        console.info(`[CONFI DEV] OTP for ${identifier}: ${otp}`);
        setSuccess(`OTP sent to ${registerMode === "email" ? email : phone}. Check console for dev OTP.`);
        setScreen("otp");
      } else {
        setError(data.error || "Registration failed. Try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    clearMessages();
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
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
      if (data.ok) {
        const otp = generateOTP();
        setGeneratedOTP(otp);
        setOtpMode("login");
        console.info(`[CONFI DEV] Login OTP for ${email}: ${otp}`);
        setSuccess("OTP sent to your email. Check console for dev OTP.");
        setScreen("otp");
      } else {
        setError(data.error || "Login failed. Check your credentials.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value.slice(-1);
    setOtpInput(newOtp);
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpInput[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = () => {
    clearMessages();
    const entered = otpInput.join("");
    if (entered.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (entered !== generatedOTP) {
      setError("Invalid OTP. Please try again.");
      return;
    }

    if (otpMode === "register") {
      setOtpInput(["", "", "", "", "", ""]);
      setScreen("profile-setup");
      setSuccess("Email verified! Set up your profile.");
    } else if (otpMode === "login") {
      const token = generateJWT(email);
      const newSession: Session = {
        user: { email },
        token,
        createdAt: Date.now(),
      };
      const profileData = localStorage.getItem(PROFILE_KEY + "_" + email);
      if (profileData) {
        const p = JSON.parse(profileData);
        newSession.user.displayName = p.displayName;
        newSession.user.avatar = p.avatar;
        newSession.user.phone = p.phone;
      }
      setSession(newSession);
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setOtpInput(["", "", "", "", "", ""]);
      setScreen("dashboard");
      setSuccess("Welcome back!");
    } else if (otpMode === "recover") {
      setOtpInput(["", "", "", "", "", ""]);
      setRecoveryStep("reset");
      setScreen("recover");
    }
  };

  const handleResendOTP = () => {
    if (otpTimer > 0) return;
    const otp = generateOTP();
    setGeneratedOTP(otp);
    setOtpInput(["", "", "", "", "", ""]);
    console.info(`[CONFI DEV] Resent OTP: ${otp}`);
    setSuccess("OTP resent. Check console for dev OTP.");
    setOtpTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
      setAvatar(result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = () => {
    clearMessages();
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    const identifier = registerMode === "email" ? email : `${phone}@phone.confi`;
    const userEmail = identifier;
    const profileData = {
      displayName: displayName.trim(),
      avatar: avatar || "",
      phone: phone || "",
    };
    localStorage.setItem(PROFILE_KEY + "_" + userEmail, JSON.stringify(profileData));

    const token = generateJWT(userEmail);
    const newSession: Session = {
      user: {
        email: userEmail,
        displayName: profileData.displayName,
        avatar: profileData.avatar,
        phone: profileData.phone,
      },
      token,
      createdAt: Date.now(),
    };
    setSession(newSession);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setScreen("dashboard");
    setSuccess("Profile saved! Welcome to Confi.");
  };

  const handleRecoverInit = () => {
    clearMessages();
    if (!recoverEmail) {
      setError("Please enter your email.");
      return;
    }
    const otp = generateOTP();
    setGeneratedOTP(otp);
    setEmail(recoverEmail);
    setOtpMode("recover");
    console.info(`[CONFI DEV] Recovery OTP for ${recoverEmail}: ${otp}`);
    setSuccess("Recovery OTP sent. Check console for dev OTP.");
    setOtpInput(["", "", "", "", "", ""]);
    setScreen("otp");
  };

  const handlePasswordReset = async () => {
    clearMessages();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: recoverEmail, password: newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess("Password reset successful! Please login.");
        setRecoveryStep("email");
        setRecoverEmail("");
        setNewPassword("");
        setTimeout(() => setScreen("login"), 1500);
      } else {
        setError(data.error || "Reset failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = () => {
    setError("Google OAuth requires server-side OAuth configuration. Use email registration for now.");
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setEmail("");
    setPassword("");
    setPhone("");
    setDisplayName("");
    setAvatar("");
    setAvatarPreview("");
    setOtpInput(["", "", "", "", "", ""]);
    setScreen("landing");
    clearMessages();
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return "CF";
  };

  return (
    <div style={styles.app}>
      {screen === "landing" && (
        <div style={styles.landing}>
          <div style={styles.landingInner}>
            <div style={styles.logoWrap}>
              <div style={styles.logoIcon}>🔐</div>
              <h1 style={styles.logoText}>Confi</h1>
              <p style={styles.logoSub}>Confidential Messaging with Legal Protection</p>
            </div>
            <div style={styles.featureList}>
              {[
                { icon: "🛡️", text: "NDA-backed confidential conversations" },
                { icon: "🔒", text: "End-to-end encrypted identity" },
                { icon: "⚖️", text: "International legal compliance" },
                { icon: "✅", text: "Verified user identities" },
              ].map((f, i) => (
                <div key={i} style={styles.featureItem}>
                  <span style={styles.featureIcon}>{f.icon}</span>
                  <span style={styles.featureText}>{f.text}</span>
                </div>
              ))}
            </div>
            <div style={styles.landingButtons}>
              <button style={styles.btnPrimary} onClick={() => { clearMessages(); setScreen("register"); }}>
                Create Account
              </button>
              <button style={styles.btnSecondary} onClick={() => { clearMessages(); setScreen("login"); }}>
                Sign In
              </button>
            </div>
            <p style={styles.landingLegal}>
              By continuing, you agree to Confi&apos;s Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      )}

      {screen === "register" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("landing"); }}>← Back</button>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>🔐</div>
              <h2 style={styles.authTitle}>Create Account</h2>
              <p style={styles.authSub}>Join Confi for secure, legally-protected messaging</p>
            </div>

            <button style={styles.googleBtn} onClick={handleGoogleOAuth}>
              <span style={{ fontSize: 18, marginRight: 8 }}>G</span>
              Continue with Google
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <span style={styles.dividerLine} />
            </div>

            <div style={styles.toggleRow}>
              <button
                style={registerMode === "email" ? styles.toggleActive : styles.toggleInactive}
                onClick={() => setRegisterMode("email")}
              >
                📧 Email
              </button>
              <button
                style={registerMode === "phone" ? styles.toggleActive : styles.toggleInactive}
                onClick={() => setRegisterMode("phone")}
              >
                📱 Phone
              </button>
            </div>

            {registerMode === "email" ? (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            ) : (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone Number</label>
                <div style={styles.phoneRow}>
                  <span style={styles.phoneFlag}>🌍 +</span>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    type="tel"
                    placeholder="1 555 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.passwordWrap}>
                <input
                  style={styles.inputPassword}
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              <div style={styles.strengthBar}>
                <div
                  style={{
                    ...styles.strengthFill,
                    width: `${Math.min(100, (password.length / 12) * 100)}%`,
                    backgroundColor:
                      password.length < 6 ? "#ef4444" : password.length < 10 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
              <span style={styles.strengthLabel}>
                {password.length === 0 ? "" : password.length < 6 ? "Weak" : password.length < 10 ? "Medium" : "Strong"}
              </span>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            <button style={loading ? styles.btnDisabled : styles.btnPrimary} onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account…" : "Create Account & Verify"}
            </button>

            <p style={styles.switchLink}>
              Already have an account?{" "}
              <span style={styles.link} onClick={() => { clearMessages(); setScreen("login"); }}>
                Sign in
              </span>
            </p>
          </div>
        </div>
      )}

      {screen === "login" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("landing"); }}>← Back</button>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>🔑</div>
              <h2 style={styles.authTitle}>Welcome Back</h2>
              <p style={styles.authSub}>Sign in to your Confi account</p>
            </div>

            <button style={styles.googleBtn} onClick={handleGoogleOAuth}>
              <span style={{ fontSize: 18, marginRight: 8 }}>G</span>
              Continue with Google
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <span style={styles.dividerLine} />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.passwordWrap}>
                <input
                  style={styles.inputPassword}
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              style={styles.forgotLink}
              onClick={() => { clearMessages(); setRecoveryStep("email"); setScreen("recover"); }}
            >
              Forgot password?
            </button>

            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            <button style={loading ? styles.btnDisabled : styles.btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <p style={styles.switchLink}>
              No account?{" "}
              <span style={styles.link} onClick={() => { clearMessages(); setScreen("register"); }}>
                Create one
              </span>
            </p>
          </div>
        </div>
      )}

      {screen === "otp" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen(otpMode === "register" ? "register" : otpMode === "recover" ? "recover" : "login"); }}>
              ← Back
            </button>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>📲</div>
              <h2 style={styles.authTitle}>Verify Your Identity</h2>
              <p style={styles.authSub}>
                Enter the 6-digit OTP sent to{" "}
                <strong>{registerMode === "phone" && otpMode === "register" ? phone : otpMode === "recover" ? recoverEmail : email}</strong>
              </p>
            </div>

            <div style={styles.otpRow}>
              {otpInput.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  style={styles.otpBox}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                />
              ))}
            </div>

            <div style={styles.otpTimer}>
              {otpTimer > 0 ? (
                <span>Resend OTP in <strong>{otpTimer}s</strong></span>
              ) : (
                <span style={styles.link} onClick={handleResendOTP}>Resend OTP</span>
              )}
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            <button style={styles.btnPrimary} onClick={handleVerifyOTP}>
              Verify OTP
            </button>

            <div style={styles.devNote}>
              🔧 Dev mode: OTP logged to browser console (F12)
            </div>
          </div>
        </div>
      )}

      {screen === "profile-setup" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>👤</div>
              <h2 style={styles.authTitle}>Set Up Your Profile</h2>
              <p style={styles.authSub}>Your identity is tied to your legal NDA agreements</p>
            </div>

            <div style={styles.avatarSection}>
              <div
                style={styles.avatarCircle}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" style={styles.avatarImg} />
                ) : (
                  <span style={styles.avatarPlaceholder}>📷</span>
                )}
              </div>
              <button style={styles.avatarUploadBtn} onClick={() => fileInputRef.current?.click()}>
                {avatarPreview ? "Change Photo" : "Upload Photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Display Name *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="How others will see you"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
              />
            </div>

            {registerMode === "email" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone Number (optional)</label>
                <input
                  style={styles.input}
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}

            <div style={styles.ndaNotice}>
              <span style={{ fontSize: 16, marginRight: 8 }}>⚖️</span>
              <span>
                Your display name and verified email will be used as your legal identity in Confi NDA agreements.
                This information is encrypted and stored securely.
              </span>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}

            <button style={styles.btnPrimary} onClick={handleProfileSave}>
              Save Profile & Enter Confi
            </button>
          </div>
        </div>
      )}

      {screen === "recover" && recoveryStep === "email" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("login"); }}>← Back</button>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>📧</div>
              <h2 style={styles.authTitle}>Account Recovery</h2>
              <p style={styles.authSub}>Enter your email to receive a recovery OTP</p>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
              />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <button style={styles.btnPrimary} onClick={handleRecoverInit}>
              Send Recovery OTP
            </button>
          </div>
        </div>
      )}

      {screen === "recover" && recoveryStep === "reset" && (
        <div style={styles.authScreen}>
          <div style={styles.authCard}>
            <div style={styles.authHeader}>
              <div style={styles.authIcon}>🔓</div>
              <h2 style={styles.authTitle}>Set New Password</h2>
              <p style={styles.authSub}>Choose a strong password for your account</p>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>New Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {success && <div style={styles.successBox}>{success}</div>}
            <button
              style={loading ? styles.btnDisabled : styles.btnPrimary}
              onClick={handlePasswordReset}
              disabled={loading}
            >
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </div>
      )}

      {screen === "dashboard" && session && (
        <div style={styles.dashboard}>
          <div style={styles.dashboardHeader}>
            <div style={styles.dashUserRow}>
              <div style={styles.dashAvatar}>
                {session.user.avatar ? (
                  <img src={session.user.avatar} alt="Avatar" style={styles.dashAvatarImg} />
                ) : (
                  <span style={styles.dashAvatarInitials}>
                    {getInitials(session.user.displayName, session.user.email)}
                  </span>
                )}
              </div>
              <div style={styles.dashUserInfo}>
                <span style={styles.dashUserName}>
                  {session.user.displayName || session.user.email}
                </span>
                <span style={styles.dashUserEmail}>{session.user.email}</span>
              </div>
            </div>
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          </div>

          <div style={styles.dashContent}>
            <div style={styles.identityCard}>
              <div style={styles.identityTitle}>
                <span style={{ marginRight: 8 }}>🛡️</span>Identity Verified
              </div>
              <div style={styles.identityRows}>
                <div style={styles.identityRow}>
                  <span style={styles.identityLabel}>Legal Name</span>
                  <span style={styles.identityValue}>
                    {session.user.displayName || "Not set"}
                  </span>
                </div>
                <div style={styles.identityRow}>
                  <span style={styles.identityLabel}>Email</span>
                  <span style={styles.identityValue}>{session.user.email}</span>
                </div>
                {session.user.phone && (
                  <div style={styles.identityRow}>
                    <span style={styles.identityLabel}>Phone</span>
                    <span style={styles.identityValue}>{session.user.phone}</span>
                  </div>
                )}
                <div style={styles.identityRow}>
                  <span style={styles.identityLabel}>Session Token</span>
                  <span style={{ ...styles.identityValue, fontFamily: "monospace", fontSize: 10 }}>
                    {session.token.slice(0, 32)}…
                  </span>
                </div>
                <div style={styles.identityRow}>
                  <span style={styles.identityLabel}>Status</span>
                  <span style={{ ...styles.identityValue, color: "#22c55e", fontWeight: 700 }}>
                    ✅ Active & Verified
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.dashGrid}>
              {[
                { icon: "💬", title: "Messages", desc: "Start a confidential conversation", badge: "Coming Soon" },
                { icon: "🤝", title: "NDA Agreements", desc: "View your active NDAs", badge: "Coming Soon" },
                { icon: "👥", title: "Contacts", desc: "Manage verified contacts", badge: "Coming Soon" },
                { icon: "⚙️", title: "Settings", desc: "Privacy & security settings", badge: "Coming Soon" },
              ].map((item, i) => (
                <div key={i} style={styles.dashCard}>
                  <div style={styles.dashCardIcon}>{item.icon}</div>
                  <div style={styles.dashCardTitle}>{item.title}</div>
                  <div style={styles.dashCardDesc}>{item.desc}</div>
                  <div style={styles.dashCardBadge}>{item.badge}</div>
                </div>
              ))}
            </div>

            <div style={styles.legalBanner}>
              <span style={{ fontSize: 20, marginBottom: 8, display: "block" }}>⚖️</span>
              <strong>Confi Identity Layer Active</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.85 }}>
                Your verified identity is secured with JWT session management and encrypted PII storage.
                All confidential conversations will be legally bound to this identity under international NDA protocols.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    backgroundColor: "#0f1117",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#e2e8f0",
  },
  landing: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    background: "linear-gradient(135deg, #0f1117 0%, #1a1f2e 50%, #0f1117 100%)",
  },
  landingInner: {
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
  },
  logoWrap: {
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 800,
    margin: "0 0 8px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  logoSub: {
    fontSize: 15,
    color: "#94a3b8",
    margin: 0,
  },
  featureList: {
    marginBottom: 36,
    textAlign: "left",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #1e2433",
  },
  featureIcon: {
    fontSize: 22,
    width: 32,
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    color: "#cbd5e1",
  },
  landingButtons: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
  },
  landingLegal: {
    fontSize: 11,
    color: "#475569",
    margin: 0,
  },
  authScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    backgroundColor: "#0f1117",
  },
  authCard: {
    backgroundColor: "#1a1f2e",
    borderRadius: 20,
    padding: "32px 28px",
    maxWidth: 420,
    width: "100%",
    border: "1px solid #2a2f3e",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  authHeader: {
    textAlign: "center",
    marginBottom: 24,
  },
  authIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 6px",
    color: "#f1f5f9",
  },
  authSub: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
  },
  googleBtn: {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 10,
    border: "1px solid #2a2f3e",
    backgroundColor: "#0f1117",
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    transition: "background 0.2s",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2a2f3e",
  },
  dividerText: {
    fontSize: 12,
    color: "#475569",
  },
  toggleRow: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  toggleActive: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #6366f1",
    backgroundColor: "#6366f1",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  toggleInactive: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #2a2f3e",
    backgroundColor: "transparent",
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #2a2f3e",
    backgroundColor: "#0f1117",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  passwordWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputPassword: {
    width: "100%",
    padding: "12px 44px 12px 14px",
    borderRadius: 10,
    border: "1px solid #2a2f3e",
    backgroundColor: "#0f1117",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 0,
  },
  strengthBar: {
    height: 3,
    backgroundColor: "#2a2f3e",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
    transition: "width 0.3s, background-color 0.3s",
  },
  strengthLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    display: "block",
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  phoneFlag: {
    fontSize: 13,
    color: "#94a3b8",
    whiteSpace: "nowrap",
  },
  forgotLink: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    marginBottom: 16,
    display: "block",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#fca5a5",
    marginBottom: 14,
  },
  successBox: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#86efac",
    marginBottom: 14,
  },
  btnPrimary: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 14,
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    border: "1px solid #2a2f3e",
    backgroundColor: "transparent",
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 14,
  },
  btnDisabled: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "#374151",
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: 700,
    cursor: "not-allowed",
    marginBottom: 14,
  },
  switchLink: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    margin: 0,
  },
  link: {
    color: "#6366f1",
    cursor: "pointer",
    fontWeight: 600,
  },
  otpRow: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginBottom: 20,
  },
  otpBox: {
    width: 46,
    height: 54,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    borderRadius: 10,
    border: "1px solid #2a2f3e",
    backgroundColor: "#0f1117",
    color: "#f1f5f9",
    outline: "none",
  },
  otpTimer: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 20,
  },
  devNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#475569",
    marginTop: 12,
    padding: "8px",
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    borderRadius: 6,
    border: "1px solid rgba(99, 102, 241, 0.1)",
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    backgroundColor: "#0f1117",
    border: "2px dashed #2a2f3e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    marginBottom: 10,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  avatarPlaceholder: {
    fontSize: 28,
  },
  avatarUploadBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
    padding: 0,
  },
  ndaNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 0,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 12,
    color: "#a5b4fc",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  dashboard: {
    minHeight: "100vh",
    backgroundColor: "#0f1117",
    display: "flex",
    flexDirection: "column",
  },
  dashboardHeader: {
    backgroundColor: "#1a1f2e",
    borderBottom: "1px solid #2a2f3e",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  dashUserRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  dashAvatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    backgroundColor: "#6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  dashAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  dashAvatarInitials: {
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
  },
  dashUserInfo: {
    display: "flex",
    flexDirection: "column",
  },
  dashUserName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  dashUserEmail: {
    fontSize: 12,
    color: "#64748b",
  },
  logoutBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #2a2f3e",
    backgroundColor: "transparent",
    color: "#ef4444",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  dashContent: {
    flex: 1,
    padding: "20px 16px",
    maxWidth: 640,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  identityCard: {
    backgroundColor: "#1a1f2e",
    border: "1px solid #2a2f3e",
    borderRadius: 16,
    padding: "20px",
    marginBottom: 20,
  },
  identityTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
  },
  identityRows: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  identityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottom: "1px solid #1e2433",
  },
  identityLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    flexShrink: 0,
    marginRight: 12,
  },
  identityValue: {
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "right",
    wordBreak: "break-all",
  },
  dashGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  dashCard: {
    backgroundColor: "#1a1f2e",
    border: "1px solid #2a2f3e",
    borderRadius: 14,
    padding: "18px 14px",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  dashCardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  dashCardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 4,
  },
  dashCardDesc: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 8,
    lineHeight: 1.4,
  },
  dashCardBadge: {
    fontSize: 10,
    color: "#6366f1",
    fontWeight: 700,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    padding: "2px 8px",
    borderRadius: 20,
    display: "inline-block",
  },
  legalBanner: {
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.25)",
    borderRadius: 14,
    padding: "18px 20px",
    color: "#a5b4fc",
    fontSize: 13,
    lineHeight: 1.5,
    textAlign: "center",
  },
};