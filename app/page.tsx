"use client";

import { useEffect, useState, useCallback } from "react";

type AppScreen =
  | "splash"
  | "welcome"
  | "register"
  | "login"
  | "otp"
  | "legal-name"
  | "profile-setup"
  | "dashboard"
  | "recovery"
  | "recovery-otp"
  | "reset-password";

interface User {
  email: string;
  displayName: string;
  legalName: string;
  legalNameVerified: boolean;
  phone: string;
  avatar: string;
  sessionToken: string;
  createdAt: string;
}

const AVATARS = ["👤", "🦁", "🐯", "🦊", "🐺", "🦅", "🦋", "🌟", "🔥", "💎", "🛡️", "⚡"];

const COUNTRIES = [
  { code: "+1", name: "US/Canada" },
  { code: "+44", name: "UK" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+81", name: "Japan" },
  { code: "+86", name: "China" },
  { code: "+91", name: "India" },
  { code: "+61", name: "Australia" },
  { code: "+55", name: "Brazil" },
  { code: "+27", name: "South Africa" },
  { code: "+971", name: "UAE" },
  { code: "+65", name: "Singapore" },
];

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hashPassword(password: string): string {
  // Simple deterministic hash for demo (real bcrypt is server-side via /api/auth)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (Math.imul(31, hash) + password.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36) + password.length.toString(36);
}

export default function ConfiApp() {
  const [screen, setScreen] = useState<AppScreen>("splash");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Registration fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCountryCode, setRegCountryCode] = useState("+1");
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // OTP
  const [otpCode, setOtpCode] = useState("");
  const [otpGenerated, setOtpGenerated] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<"register" | "recovery">("register");
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpExpired, setOtpExpired] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  // Legal name
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [legalDOB, setLegalDOB] = useState("");
  const [legalNationality, setLegalNationality] = useState("");
  const [legalAgreed, setLegalAgreed] = useState(false);

  // Profile setup
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("👤");

  // Recovery
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Dashboard
  const [activeTab, setActiveTab] = useState<"chats" | "profile" | "security">("chats");

  useEffect(() => {
    // Track page view
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Check for existing session
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        const parsed: User = JSON.parse(stored);
        if (parsed.sessionToken) {
          setUser(parsed);
          setScreen("dashboard");
          return;
        }
      } catch {
        localStorage.removeItem("confi_user");
      }
    }

    setTimeout(() => setScreen("welcome"), 2000);
  }, []);

  // OTP timer
  useEffect(() => {
    if (screen !== "otp" && screen !== "recovery-otp") return;
    setOtpTimer(60);
    setOtpExpired(false);
    const interval = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setOtpExpired(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const handleRegister = async () => {
    clearMessages();
    if (!regEmail || !regPassword || !regConfirmPassword) {
      setError("Please fill all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(regPassword)) {
      setError("Password must contain at least one uppercase letter and one number.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: regEmail, password: regPassword }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Registration failed. Email may already be in use.");
        setLoading(false);
        return;
      }

      const otp = generateOTP();
      setOtpGenerated(otp);
      setPendingEmail(regEmail);
      setPendingPassword(regPassword);
      setOtpPurpose("register");

      // In production, OTP sent via email/SMS. Showing for demo:
      setSuccess(`OTP sent to ${regEmail}. Demo code: ${otp}`);
      setTimeout(() => {
        setLoading(false);
        setScreen("otp");
      }, 1000);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    clearMessages();
    if (!loginEmail || !loginPassword) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Restore existing user profile if available
      const stored = localStorage.getItem(`confi_profile_${loginEmail}`);
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          const sessionUser: User = {
            ...profile,
            sessionToken: generateToken(),
          };
          setUser(sessionUser);
          localStorage.setItem("confi_user", JSON.stringify(sessionUser));
          setLoading(false);
          setScreen("dashboard");
          return;
        } catch {
          // fall through to profile setup
        }
      }

      // New login without profile - go to legal name
      setPendingEmail(loginEmail);
      const token = generateToken();
      const newUser: User = {
        email: loginEmail,
        displayName: "",
        legalName: "",
        legalNameVerified: false,
        phone: "",
        avatar: "👤",
        sessionToken: token,
        createdAt: new Date().toISOString(),
      };
      setUser(newUser);
      setLoading(false);
      setScreen("legal-name");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    clearMessages();
    if (otpExpired) {
      setError("OTP has expired. Please request a new one.");
      return;
    }
    if (otpCode !== otpGenerated) {
      setError("Invalid OTP. Please check and try again.");
      return;
    }

    setSuccess("Verification successful!");

    if (otpPurpose === "recovery") {
      setTimeout(() => setScreen("reset-password"), 800);
      return;
    }

    const token = generateToken();
    const newUser: User = {
      email: pendingEmail,
      displayName: "",
      legalName: "",
      legalNameVerified: false,
      phone: regCountryCode + regPhone,
      avatar: "👤",
      sessionToken: token,
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    setTimeout(() => {
      setOtpCode("");
      setScreen("legal-name");
    }, 800);
  };

  const handleResendOTP = () => {
    const otp = generateOTP();
    setOtpGenerated(otp);
    setOtpCode("");
    setOtpExpired(false);
    setOtpTimer(60);
    setSuccess(`New OTP sent. Demo code: ${otp}`);
  };

  const handleLegalNameSubmit = () => {
    clearMessages();
    if (!legalFirstName.trim() || !legalLastName.trim()) {
      setError("Please enter your full legal name.");
      return;
    }
    if (legalFirstName.trim().length < 2 || legalLastName.trim().length < 2) {
      setError("Name fields must be at least 2 characters.");
      return;
    }
    if (!legalDOB) {
      setError("Please enter your date of birth.");
      return;
    }
    const dob = new Date(legalDOB);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) {
      setError("You must be 18 or older to use Confi.");
      return;
    }
    if (!legalNationality) {
      setError("Please select your nationality.");
      return;
    }
    if (!legalAgreed) {
      setError("You must confirm your legal name for NDA enforcement.");
      return;
    }

    const fullLegalName = `${legalFirstName.trim()} ${legalLastName.trim()}`;
    if (user) {
      const updated: User = {
        ...user,
        legalName: fullLegalName,
        legalNameVerified: true,
      };
      setUser(updated);
    }
    setScreen("profile-setup");
  };

  const handleProfileSetup = () => {
    clearMessages();
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    if (user) {
      const finalUser: User = {
        ...user,
        displayName: displayName.trim(),
        avatar: selectedAvatar,
      };
      setUser(finalUser);
      localStorage.setItem("confi_user", JSON.stringify(finalUser));
      localStorage.setItem(`confi_profile_${finalUser.email}`, JSON.stringify(finalUser));
      setScreen("dashboard");
    }
  };

  const handleRecovery = async () => {
    clearMessages();
    if (!recoveryEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    const otp = generateOTP();
    setOtpGenerated(otp);
    setOtpPurpose("recovery");
    setPendingEmail(recoveryEmail);

    await new Promise((r) => setTimeout(r, 1000));
    setSuccess(`Recovery OTP sent to ${recoveryEmail}. Demo code: ${otp}`);
    setLoading(false);
    setTimeout(() => setScreen("recovery-otp"), 800);
  };

  const handleResetPassword = async () => {
    clearMessages();
    if (!newPassword || !confirmNewPassword) {
      setError("Please fill all fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter and one number.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Re-register with new password (using signup which upserts)
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: pendingEmail, password: newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess("Password reset successfully! Please log in.");
        setTimeout(() => {
          setLoginEmail(pendingEmail);
          setScreen("login");
        }, 1500);
      } else {
        setError(data.error || "Reset failed.");
      }
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setLoginEmail("");
    setLoginPassword("");
    setRegEmail("");
    setRegPassword("");
    setRegConfirmPassword("");
    setScreen("welcome");
  };

  const handleUpdateProfile = () => {
    if (user && displayName.trim()) {
      const updated: User = { ...user, displayName: displayName.trim(), avatar: selectedAvatar };
      setUser(updated);
      localStorage.setItem("confi_user", JSON.stringify(updated));
      localStorage.setItem(`confi_profile_${updated.email}`, JSON.stringify(updated));
      setSuccess("Profile updated successfully!");
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (screen === "splash") {
    return (
      <div style={styles.splash}>
        <div style={styles.splashInner}>
          <div style={styles.splashLogo}>🔒</div>
          <h1 style={styles.splashTitle}>Confi</h1>
          <p style={styles.splashSubtitle}>Confidential Messaging</p>
          <div style={styles.splashLoader}>
            <div style={styles.splashDot} />
            <div style={{ ...styles.splashDot, animationDelay: "0.2s" }} />
            <div style={{ ...styles.splashDot, animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeHero}>
          <div style={styles.welcomeLogo}>🔒</div>
          <h1 style={styles.welcomeTitle}>Confi</h1>
          <p style={styles.welcomeTagline}>Messaging backed by international NDA</p>
        </div>
        <div style={styles.welcomeFeatures}>
          {[
            { icon: "🛡️", text: "Conversations protected by legal NDA" },
            { icon: "✍️", text: "Verified identity for enforceable agreements" },
            { icon: "🔐", text: "End-to-end encrypted by design" },
          ].map((f) => (
            <div key={f.text} style={styles.featureRow}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <span style={styles.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
        <div style={styles.welcomeActions}>
          <button style={styles.btnPrimary} onClick={() => setScreen("register")}>
            Create Account
          </button>
          <button style={styles.btnSecondary} onClick={() => setScreen("login")}>
            Sign In
          </button>
        </div>
        <p style={styles.welcomeFooter}>By continuing, you agree to our Terms and Privacy Policy</p>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("welcome"); }}>
          ← Back
        </button>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>📱</div>
          <h2 style={styles.formTitle}>Create Account</h2>
          <p style={styles.formSubtitle}>Join Confi — secure, confidential messaging</p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.form}>
          <label style={styles.label}>Email Address *</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            autoComplete="email"
          />

          <label style={styles.label}>Phone Number</label>
          <div style={styles.phoneRow}>
            <select
              style={styles.countrySelect}
              value={regCountryCode}
              onChange={(e) => setRegCountryCode(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              type="tel"
              placeholder="555 123 4567"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
            />
          </div>

          <label style={styles.label}>Password *</label>
          <div style={styles.passwordRow}>
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <label style={styles.label}>Confirm Password *</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Repeat password"
            value={regConfirmPassword}
            onChange={(e) => setRegConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          <div style={styles.strengthBar}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  ...styles.strengthSegment,
                  backgroundColor:
                    regPassword.length === 0
                      ? "#e5e7eb"
                      : regPassword.length < 6
                      ? i <= 1 ? "#ef4444" : "#e5e7eb"
                      : regPassword.length < 10
                      ? i <= 2 ? "#f59e0b" : "#e5e7eb"
                      : /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(regPassword)
                      ? "#10b981"
                      : i <= 3 ? "#3b82f6" : "#e5e7eb",
                }}
              />
            ))}
            <span style={styles.strengthLabel}>
              {regPassword.length === 0
                ? ""
                : regPassword.length < 6
                ? "Weak"
                : regPassword.length < 10
                ? "Fair"
                : /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(regPassword)
                ? "Strong"
                : "Good"}
            </span>
          </div>

          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Continue →"}
          </button>

          <p style={styles.switchPrompt}>
            Already have an account?{" "}
            <button style={styles.linkBtn} onClick={() => { clearMessages(); setScreen("login"); }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("welcome"); }}>
          ← Back
        </button>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>🔑</div>
          <h2 style={styles.formTitle}>Sign In</h2>
          <p style={styles.formSubtitle}>Welcome back to Confi</p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            autoComplete="email"
          />

          <label style={styles.label}>Password</label>
          <div style={styles.passwordRow}>
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <button
            style={styles.forgotBtn}
            onClick={() => { clearMessages(); setScreen("recovery"); }}
          >
            Forgot password?
          </button>

          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <p style={styles.switchPrompt}>
            New to Confi?{" "}
            <button style={styles.linkBtn} onClick={() => { clearMessages(); setScreen("register"); }}>
              Create account
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (screen === "otp" || screen === "recovery-otp") {
    return (
      <div style={styles.container}>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>📧</div>
          <h2 style={styles.formTitle}>Verify Your Email</h2>
          <p style={styles.formSubtitle}>
            Enter the 6-digit code sent to{" "}
            <strong>{screen === "recovery-otp" ? recoveryEmail : pendingEmail}</strong>
          </p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.form}>
          <div style={styles.otpContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                style={{
                  ...styles.otpInput,
                  borderColor: otpCode[i] ? "#6366f1" : "#d1d5db",
                }}
                type="text"
                maxLength={1}
                value={otpCode[i] || ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/, "");
                  const arr = otpCode.split("");
                  arr[i] = val;
                  const newOtp = arr.join("").slice(0, 6);
                  setOtpCode(newOtp);
                  if (val && i < 5) {
                    const next = document.getElementById(`otp-${i + 1}`);
                    if (next) (next as HTMLInputElement).focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otpCode[i] && i > 0) {
                    const prev = document.getElementById(`otp-${i - 1}`);
                    if (prev) (prev as HTMLInputElement).focus();
                  }
                }}
                id={`otp-${i}`}
              />
            ))}
          </div>

          <div style={styles.otpTimerRow}>
            {otpExpired ? (
              <span style={styles.otpExpired}>Code expired</span>
            ) : (
              <span style={styles.otpTimer}>Expires in {otpTimer}s</span>
            )}
            <button style={styles.linkBtn} onClick={handleResendOTP}>
              Resend Code
            </button>
          </div>

          <button
            style={{ ...styles.btnPrimary, opacity: otpCode.length < 6 ? 0.5 : 1 }}
            onClick={handleVerifyOTP}
            disabled={otpCode.length < 6}
          >
            Verify →
          </button>
        </div>
      </div>
    );
  }

  if (screen === "legal-name") {
    return (
      <div style={styles.container}>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>⚖️</div>
          <h2 style={styles.formTitle}>Legal Identity</h2>
          <p style={styles.formSubtitle}>
            Your legal name is required for NDA enforcement. It will be kept separate from your
            display name and used only in confidential agreements.
          </p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <div style={styles.ndaBanner}>
          <span style={styles.ndaIcon}>🔏</span>
          <div>
            <strong>Why we need this</strong>
            <p style={styles.ndaText}>
              When you activate Confi Mode in a conversation, an international NDA is generated with
              your verified legal name as a signatory. This makes the agreement legally enforceable
              across jurisdictions.
            </p>
          </div>
        </div>

        <div style={styles.form}>
          <label style={styles.label}>Legal First Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="As shown on government ID"
            value={legalFirstName}
            onChange={(e) => setLegalFirstName(e.target.value)}
          />

          <label style={styles.label}>Legal Last Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="As shown on government ID"
            value={legalLastName}
            onChange={(e) => setLegalLastName(e.target.value)}
          />

          <label style={styles.label}>Date of Birth *</label>
          <input
            style={styles.input}
            type="date"
            value={legalDOB}
            onChange={(e) => setLegalDOB(e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
          />

          <label style={styles.label}>Nationality *</label>
          <select
            style={styles.input}
            value={legalNationality}
            onChange={(e) => setLegalNationality(e.target.value)}
          >
            <option value="">Select nationality…</option>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <div style={styles.checkboxRow}>
            <input
              type="checkbox"
              id="legal-agree"
              checked={legalAgreed}
              onChange={(e) => setLegalAgreed(e.target.checked)}
              style={styles.checkbox}
            />
            <label htmlFor="legal-agree" style={styles.checkboxLabel}>
              I confirm this is my full legal name as it appears on my government-issued
              identification. I understand this will be used in legally binding NDA agreements when
              I activate Confi Mode.
            </label>
          </div>

          <button style={styles.btnPrimary} onClick={handleLegalNameSubmit}>
            Confirm Legal Identity →
          </button>
        </div>
      </div>
    );
  }

  if (screen === "profile-setup") {
    return (
      <div style={styles.container}>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>✨</div>
          <h2 style={styles.formTitle}>Set Up Profile</h2>
          <p style={styles.formSubtitle}>
            Choose how others will see you. This is separate from your legal name.
          </p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <div style={styles.form}>
          <div style={styles.avatarGrid}>
            {AVATARS.map((a) => (
              <button
                key={a}
                style={{
                  ...styles.avatarOption,
                  borderColor: selectedAvatar === a ? "#6366f1" : "transparent",
                  backgroundColor: selectedAvatar === a ? "#ede9fe" : "#f9fafb",
                  transform: selectedAvatar === a ? "scale(1.15)" : "scale(1)",
                }}
                onClick={() => setSelectedAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>

          <label style={styles.label}>Display Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="How others see you"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
          />
          <p style={styles.charCount}>{displayName.length}/30</p>

          {user?.legalNameVerified && (
            <div style={styles.verifiedBadge}>
              ✅ Legal identity verified — NDA signing enabled
            </div>
          )}

          <button style={styles.btnPrimary} onClick={handleProfileSetup}>
            Enter Confi →
          </button>
        </div>
      </div>
    );
  }

  if (screen === "recovery") {
    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => { clearMessages(); setScreen("login"); }}>
          ← Back
        </button>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>🔄</div>
          <h2 style={styles.formTitle}>Account Recovery</h2>
          <p style={styles.formSubtitle}>
            Enter your email and we&apos;ll send you a recovery code.
          </p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
          />

          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
            onClick={handleRecovery}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send Recovery Code →"}
          </button>
        </div>
      </div>
    );
  }

  if (screen === "reset-password") {
    return (
      <div style={styles.container}>
        <div style={styles.formHeader}>
          <div style={styles.formHeaderIcon}>🔐</div>
          <h2 style={styles.formTitle}>Reset Password</h2>
          <p style={styles.formSubtitle}>Choose a new secure password for your account.</p>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}

        <div style={styles.form}>
          <label style={styles.label}>New Password *</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <label style={styles.label}>Confirm New Password *</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Repeat new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />

          <button
            style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }}
            onClick={handleResetPassword}
            disabled={loading}
          >
            {loading ? "Resetting…" : "Reset Password →"}
          </button>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  if (screen === "dashboard" && user) {
    return (
      <div style={styles.dashboard}>
        {/* Header */}
        <div style={styles.dashHeader}>
          <div style={styles.dashHeaderLeft}>
            <div style={styles.dashAvatar}>{user.avatar}</div>
            <div>
              <div style={styles.dashName}>{user.displayName || user.email}</div>
              <div style={styles.dashStatus}>
                {user.legalNameVerified ? "⚖️ NDA Ready" : "⚠️ Identity unverified"}
              </div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        {/* Tab Bar */}
        <div style={styles.tabBar}>
          {(["chats", "profile", "security"] as const).map((tab) => (
            <button
              key={tab}
              style={{
                ...styles.tab,
                borderBottomColor: activeTab === tab ? "#6366f1" : "transparent",
                color: activeTab === tab ? "#6366f1" : "#6b7280",
                fontWeight: activeTab === tab ? 600 : 400,
              }}
              onClick={() => { setActiveTab(tab); clearMessages(); }}
            >
              {tab === "chats" ? "💬 Chats" : tab === "profile" ? "👤 Profile" : "🛡️ Security"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={styles.tabContent}>
          {activeTab === "chats" && (
            <div>
              <div style={styles.sectionTitle}>Your Conversations</div>
              <div style={styles.emptyChats}>
                <div style={styles.emptyIcon}>💬</div>
                <p style={styles.emptyTitle}>No conversations yet</p>
                <p style={styles.emptySubtitle}>
                  Start a new chat and activate Confi Mode to protect it with an international NDA
                </p>
                <button style={styles.btnPrimary}>
                  + New Conversation
                </button>
              </div>

              {user.legalNameVerified && (
                <div style={styles.ndaReadyCard}>
                  <div style={styles.ndaReadyHeader}>
                    <span>🔏</span>
                    <strong>NDA-Ready Account</strong>
                  </div>
                  <p style={styles.ndaReadyText}>
                    Your identity is verified. When you start a Confi conversation, both parties
                    will be bound by an international NDA covering all shared information under
                    strict confidentiality rules.
                  </p>
                  <div style={styles.ndaStats}>
                    <div style={styles.ndaStat}>
                      <span style={styles.ndaStatNum}>0</span>
                      <span style={styles.ndaStatLabel}>Active NDAs</span>
                    </div>
                    <div style={styles.ndaStat}>
                      <span style={styles.ndaStatNum}>0</span>
                      <span style={styles.ndaStatLabel}>Protected Chats</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <div style={styles.sectionTitle}>Your Profile</div>

              {error && <div style={styles.errorBanner}>{error}</div>}
              {success && <div style={styles.successBanner}>{success}</div>}

              <div style={styles.profileCard}>
                <div style={styles.profileAvatarLarge}>{user.avatar}</div>
                <div style={styles.profileInfo}>
                  <div style={styles.profileName}>{user.displayName}</div>
                  <div style={styles.profileEmail}>{user.email}</div>
                  {user.phone && <div style={styles.profilePhone}>📞 {user.phone}</div>}
                </div>
              </div>

              <label style={styles.label}>Avatar</label>
              <div style={styles.avatarGrid}>
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    style={{
                      ...styles.avatarOption,
                      borderColor: selectedAvatar === a || (!selectedAvatar && user.avatar === a) ? "#6366f1" : "transparent",
                      backgroundColor: selectedAvatar === a || (!selectedAvatar && user.avatar === a) ? "#ede9fe" : "#f9fafb",
                    }}
                    onClick={() => setSelectedAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>

              <label style={styles.label}>Display Name</label>
              <input
                style={styles.input}
                type="text"
                value={displayName || user.displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />

              <button style={styles.btnPrimary} onClick={handleUpdateProfile}>
                Save Changes
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <div style={styles.sectionTitle}>Security & Identity</div>

              <div style={styles.securityCard}>
                <div style={styles.securityCardHeader}>
                  <span>⚖️</span>
                  <div>
                    <strong>Legal Identity</strong>
                    <div style={styles.securityStatus}>
                      {user.legalNameVerified ? (
                        <span style={styles.verifiedText}>✅ Verified</span>
                      ) : (
                        <span style={styles.unverifiedText}>⚠️ Not verified</span>
                      )}
                    </div>
                  </div>
                </div>
                {user.legalNameVerified ? (
                  <div style={styles.legalNameDisplay}>
                    <strong>Legal Name on File:</strong>
                    <div style={styles.legalNameValue}>{user.legalName}</div>
                    <p style={styles.legalNameNote}>
                      This name will appear on all NDA documents when you activate Confi Mode.
                    </p>
                  </div>
                ) : (
                  <button style={styles.btnSecondary} onClick={() => setScreen("legal-name")}>
                    Verify Legal Identity →
                  </button>
                )}
              </div>

              <div style={styles.securityCard}>
                <div style={styles.securityCardHeader}>
                  <span>🔐</span>
                  <div>
                    <strong>Password</strong>
                    <div style={styles.securityStatus}>Last changed: account creation</div>
                  </div>
                </div>
                <button
                  style={styles.btnSecondary}
                  onClick={() => {
                    setRecoveryEmail(user.email);
                    setScreen("recovery");
                  }}
                >
                  Change Password →
                </button>
              </div>

              <div style={styles.securityCard}>
                <div style={styles.securityCardHeader}>
                  <span>📅</span>
                  <div>
                    <strong>Account Created</strong>
                    <div style={styles.securityStatus}>
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.securityCard}>
                <div style={styles.securityCardHeader}>
                  <span>🌐</span>
                  <div>
                    <strong>NDA Jurisdiction</strong>
                    <div style={styles.securityStatus}>
                      International — UNCITRAL Model Law compliant
                    </div>
                  </div>
                </div>
                <p style={styles.ndaJurisdictionText}>
                  Confi Mode NDAs are governed by international commercial law and are enforceable
                  across 170+ signatory nations. Your verified identity acts as a digital signature
                  under applicable e-signature legislation.
                </p>
              </div>

              <div style={styles.dangerZone}>
                <div style={styles.dangerTitle}>⚠️ Danger Zone</div>
                <button style={styles.btnDanger} onClick={handleLogout}>
                  Sign Out of This Device
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  splash: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)",
  },
  splashInner: {
    textAlign: "center",
    color: "#fff",
  },
  splashLogo: {
    fontSize: 80,
    marginBottom: 16,
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
  },
  splashTitle: {
    fontSize: 48,
    fontWeight: 800,
    margin: "0 0 8px",
    letterSpacing: "-1px",
  },
  splashSubtitle: {
    fontSize: 18,
    opacity: 0.85,
    marginBottom: 32,
  },
  splashLoader: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
  },
  splashDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.7)",
    animation: "bounce 0.8s infinite alternate",
  },
  container: {
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    padding: "20px 24px 40px",
    backgroundColor: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    color: "#6366f1",
    padding: "8px 0",
    marginBottom: 8,
  },
  formHeader: {
    textAlign: "center",
    marginBottom: 28,
    paddingTop: 16,
  },
  formHeaderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px",
  },
  formSubtitle: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 1.5,
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    border: "1.5px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
    outline: "none",
    marginBottom: 4,
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  phoneRow: {
    display: "flex",
    gap: 8,
    marginBottom: 4,
    alignItems: "center",
  },
  countrySelect: {
    border: "1.5px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 8px",
    fontSize: 13,
    backgroundColor: "#f9fafb",
    color: "#111827",
    outline: "none",
    minWidth: 130,
  },
  passwordRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  eyeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 20,
    padding: 4,
  },
  strengthBar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    transition: "background-color 0.3s",
  },
  strengthLabel: {
    fontSize: 12,
    color: "#6b7280",
    minWidth: 40,
    textAlign: "right",
  },
  forgotBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    color: "#6366f1",
    textAlign: "right",
    marginTop: 4,
    marginBottom: 16,
    padding: 0,
    alignSelf: "flex-end",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 20,
    transition: "opacity 0.2s, transform 0.1s",
    boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
  },
  btnSecondary: {
    background: "#fff",
    color: "#6366f1",
    border: "2px solid #6366f1",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 12,
    transition: "background 0.2s",
  },
  btnDanger: {
    background: "#fff",
    color: "#ef4444",
    border: "2px solid #ef4444",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    width: "100%",
  },
  switchPrompt: {
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
    marginTop: 20,
  },
  linkBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6366f1",
    fontWeight: 600,
    fontSize: "inherit",
    padding: 0,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  successBanner: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#16a34a",
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  // OTP
  otpContainer: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  otpInput: {
    width: 48,
    height: 56,
    textAlign: "center",
    fontSize: 24,
    fontWeight: 700,
    border: "2px solid #d1d5db",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    color: "#111827",
    outline: "none",
    transition: "border-color 0.2s",
  },
  otpTimerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  otpTimer: {
    fontSize: 13,
    color: "#6b7280",
  },
  otpExpired: {
    fontSize: 13,
    color: "#ef4444",
  },
  // Legal name
  ndaBanner: {
    display: "flex",
    gap: 12,
    backgroundColor: "#ede9fe",
    border: "1px solid #c4b5fd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  ndaIcon: {
    fontSize: 24,
    flexShrink: 0,
  },
  ndaText: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },
  checkboxRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 16,
    marginBottom: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    accentColor: "#6366f1",
    flexShrink: 0,
  },
  checkboxLabel: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  // Profile setup
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  avatarOption: {
    fontSize: 26,
    borderRadius: 10,
    border: "2px solid transparent",
    cursor: "pointer",
    padding: 6,
    transition: "all 0.15s",
    lineHeight: 1,
  },
  charCount: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    margin: "2px 0 0",
  },
  verifiedBadge: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "#16a34a",
    fontWeight: 500,
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  // Welcome
  welcomeHero: {
    textAlign: "center",
    paddingTop: 60,
    paddingBottom: 32,
  },
  welcomeLogo: {
    fontSize: 72,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: 800,
    color: "#111827",
    margin: "0 0 8px",
    letterSpacing: "-1px",
  },
  welcomeTagline: {
    fontSize: 17,
    color: "#6b7280",
    margin: 0,
  },
  welcomeFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginBottom: 36,
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: "12px 16px",
    border: "1px solid #e5e7eb",
  },
  featureIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: 500,
  },
  welcomeActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  welcomeFooter: {
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 20,
  },
  // Dashboard
  dashboard: {
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    backgroundColor: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  dashHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "#fff",
  },
  dashHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  dashAvatar: {
    fontSize: 36,
    lineHeight: 1,
  },
  dashName: {
    fontSize: 16,
    fontWeight: 700,
  },
  dashStatus: {
    fontSize: 12,
    opacity: 0.85,
    marginTop: 2,
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: 8,
    color: "#fff",
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
  },
  tab: {
    flex: 1,
    background: "none",
    border: "none",
    borderBottom: "2.5px solid transparent",
    padding: "14px 8px",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  tabContent: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 16,
  },
  emptyChats: {
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 8px",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.6,
    margin: "0 0 20px",
  },
  ndaReadyCard: {
    backgroundColor: "#ede9fe",
    border: "1px solid #c4b5fd",
    borderRadius: 14,
    padding: 20,
    marginTop: 20,
  },
  ndaReadyHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    marginBottom: 10,
    color: "#4c1d95",
  },
  ndaReadyText: {
    fontSize: 13,
    color: "#5b21b6",
    lineHeight: 1.6,
    margin: "0 0 14px",
  },
  ndaStats: {
    display: "flex",
    gap: 24,
  },
  ndaStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  ndaStatNum: {
    fontSize: 24,
    fontWeight: 800,
    color: "#4c1d95",
  },
  ndaStatLabel: {
    fontSize: 11,
    color: "#7c3aed",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  // Profile tab
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    border: "1px solid #e5e7eb",
  },
  profileAvatarLarge: {
    fontSize: 52,
    lineHeight: 1,
    flexShrink: 0,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  // Security tab
  securityCard: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  securityCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    fontSize: 20,
  },
  securityStatus: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  verifiedText: {
    color: "#16a34a",
    fontWeight: 500,
  },
  unverifiedText: {
    color: "#d97706",
    fontWeight: 500,
  },
  legalNameDisplay: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
  },
  legalNameValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    fontFamily: "Georgia, serif",
    marginTop: 4,
    marginBottom: 6,
  },
  legalNameNote: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.5,
    margin: 0,
  },
  ndaJurisdictionText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.6,
    margin: "10px 0 0",
  },
  dangerZone: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    border: "1px solid #fecaca",
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#dc2626",
    marginBottom: 10,
  },
};