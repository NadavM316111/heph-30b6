"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "landing"
  | "signup-contact"
  | "signup-otp"
  | "signup-kyc"
  | "signup-profile"
  | "login"
  | "login-otp"
  | "recover"
  | "recover-otp"
  | "recover-reset"
  | "home";

interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  legalName: string;
  phone: string;
  avatarColor: string;
  avatarInitials: string;
  kycAcknowledged: boolean;
  kycTimestamp: string;
  createdAt: string;
  sessionToken: string;
}

interface SignupDraft {
  email: string;
  phone: string;
  password: string;
  otp: string;
  legalName: string;
  displayName: string;
  avatarColor: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6C63FF", "#FF6584", "#43C59E", "#F5A623", "#4A90D9",
  "#9B59B6", "#E74C3C", "#1ABC9C", "#F39C12", "#2980B9",
];

const STORAGE_KEY = "confi_user_profile";
const SESSIONS_KEY = "confi_sessions";
const RECOVERY_KEY = "confi_recovery";

function generateId(): string {
  return "usr_" + Math.random().toString(36).slice(2, 11).toUpperCase();
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Signup state
  const [draft, setDraft] = useState<SignupDraft>({
    email: "",
    phone: "",
    password: "",
    otp: "",
    legalName: "",
    displayName: "",
    avatarColor: randomColor(),
  });
  const [pendingOtp, setPendingOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpTarget, setOtpTarget] = useState("email");
  const [kycChecked, setKycChecked] = useState(false);
  const [kycNdaChecked, setKycNdaChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginPendingOtp, setLoginPendingOtp] = useState("");
  const [loginUser, setLoginUser] = useState<UserProfile | null>(null);

  // Recovery state
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverOtp, setRecoverOtp] = useState("");
  const [recoverPendingOtp, setRecoverPendingOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Track page view
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Check for existing session
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: UserProfile = JSON.parse(stored);
        if (parsed.sessionToken) {
          setUser(parsed);
          setTimeout(() => setScreen("home"), 1200);
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setTimeout(() => setScreen("landing"), 1200);
  }, []);

  const clearError = () => setError("");
  const showInfo = (msg: string) => {
    setInfo(msg);
    setTimeout(() => setInfo(""), 4000);
  };

  // ── Auth Helpers ───────────────────────────────────────────────────────────

  const apiAuth = useCallback(
    async (mode: "signup" | "login", email: string, password: string) => {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      return res.json() as Promise<{ ok?: boolean; email?: string; error?: string }>;
    },
    []
  );

  // ── Step 1: Contact Info ───────────────────────────────────────────────────

  const handleSignupContact = async () => {
    clearError();
    if (!draft.email || !draft.phone || !draft.password) {
      setError("All fields are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!/^\+?[\d\s\-()]{7,15}$/.test(draft.phone)) {
      setError("Enter a valid phone number (include country code).");
      return;
    }
    if (draft.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(draft.password) || !/[0-9]/.test(draft.password)) {
      setError("Password needs at least one uppercase letter and one number.");
      return;
    }

    setLoading(true);
    // Simulate OTP send
    await new Promise((r) => setTimeout(r, 800));
    const otp = generateOTP();
    setPendingOtp(otp);
    setOtpTarget(draft.email);
    setLoading(false);

    // In production this would send via SMS/email provider
    console.info(`[CONFI DEV] OTP for ${draft.email}: ${otp}`);
    showInfo(`OTP sent to ${draft.email} (dev: check console)`);
    setScreen("signup-otp");
  };

  // ── Step 2: OTP Verification ───────────────────────────────────────────────

  const handleSignupOtp = async () => {
    clearError();
    if (otpInput.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (otpInput !== pendingOtp) {
      setError("Incorrect OTP. Please try again.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
    setScreen("signup-kyc");
  };

  const resendOtp = () => {
    const otp = generateOTP();
    setPendingOtp(otp);
    console.info(`[CONFI DEV] New OTP: ${otp}`);
    showInfo("New OTP sent (dev: check console)");
  };

  // ── Step 3: KYC / Legal Name ───────────────────────────────────────────────

  const handleKyc = async () => {
    clearError();
    if (!draft.legalName.trim()) {
      setError("Legal name is required for NDA enforceability.");
      return;
    }
    if (draft.legalName.trim().split(" ").length < 2) {
      setError("Please enter your full legal name (first and last).");
      return;
    }
    if (!kycChecked) {
      setError("You must confirm your legal name is accurate.");
      return;
    }
    if (!kycNdaChecked) {
      setError("You must acknowledge the NDA terms to continue.");
      return;
    }
    setDraft((d) => ({ ...d, displayName: d.legalName.split(" ")[0] }));
    setScreen("signup-profile");
  };

  // ── Step 4: Profile Setup ──────────────────────────────────────────────────

  const handleProfileSetup = async () => {
    clearError();
    if (!draft.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (draft.displayName.length < 2 || draft.displayName.length > 30) {
      setError("Display name must be 2–30 characters.");
      return;
    }

    setLoading(true);

    // Register with the auth API
    const result = await apiAuth("signup", draft.email, draft.password);
    if (result.error) {
      // If already exists, allow continuing with login approach
      if (!result.error.toLowerCase().includes("exist")) {
        setError(result.error);
        setLoading(false);
        return;
      }
    }

    const profile: UserProfile = {
      userId: generateId(),
      email: draft.email,
      displayName: draft.displayName.trim(),
      legalName: draft.legalName.trim(),
      phone: draft.phone,
      avatarColor: draft.avatarColor,
      avatarInitials: getInitials(draft.displayName),
      kycAcknowledged: true,
      kycTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      sessionToken: "tok_" + Math.random().toString(36).slice(2, 18),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

    // Store session record
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    sessions.push({
      userId: profile.userId,
      token: profile.sessionToken,
      createdAt: profile.createdAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    setUser(profile);
    setLoading(false);
    setScreen("home");
  };

  // ── Login ──────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    clearError();
    if (!loginEmail || !loginPassword) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const result = await apiAuth("login", loginEmail, loginPassword);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Issue login OTP
    const otp = generateOTP();
    setLoginPendingOtp(otp);
    console.info(`[CONFI DEV] Login OTP: ${otp}`);
    showInfo(`Login OTP sent to ${loginEmail} (dev: check console)`);

    // Restore profile from storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: UserProfile = JSON.parse(stored);
        setLoginUser(parsed);
      } catch {
        // fresh user
      }
    }

    setScreen("login-otp");
  };

  const handleLoginOtp = async () => {
    clearError();
    if (loginOtp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (loginOtp !== loginPendingOtp) {
      setError("Incorrect OTP.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    const stored = localStorage.getItem(STORAGE_KEY);
    let profile = loginUser;

    if (stored) {
      try {
        profile = JSON.parse(stored);
      } catch {
        //
      }
    }

    if (!profile) {
      // Create a minimal profile if none exists
      profile = {
        userId: generateId(),
        email: loginEmail,
        displayName: loginEmail.split("@")[0],
        legalName: "",
        phone: "",
        avatarColor: randomColor(),
        avatarInitials: loginEmail.slice(0, 2).toUpperCase(),
        kycAcknowledged: false,
        kycTimestamp: "",
        createdAt: new Date().toISOString(),
        sessionToken: "",
      };
    }

    // Rotate session token
    const newToken = "tok_" + Math.random().toString(36).slice(2, 18);
    profile = { ...profile, sessionToken: newToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    sessions.push({
      userId: profile.userId,
      token: newToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    setUser(profile);
    setLoading(false);
    setScreen("home");
  };

  // ── Account Recovery ───────────────────────────────────────────────────────

  const handleRecoverRequest = async () => {
    clearError();
    if (!recoverEmail) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const otp = generateOTP();
    setRecoverPendingOtp(otp);
    console.info(`[CONFI DEV] Recovery OTP: ${otp}`);
    showInfo("Recovery OTP sent (dev: check console)");
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ email: recoverEmail, otp, ts: Date.now() }));
    setLoading(false);
    setScreen("recover-otp");
  };

  const handleRecoverOtp = async () => {
    clearError();
    if (recoverOtp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    const stored = localStorage.getItem(RECOVERY_KEY);
    if (stored) {
      const rec = JSON.parse(stored);
      if (rec.otp !== recoverOtp) {
        setError("Incorrect OTP.");
        return;
      }
      if (Date.now() - rec.ts > 15 * 60 * 1000) {
        setError("OTP expired. Request a new one.");
        return;
      }
    } else if (recoverOtp !== recoverPendingOtp) {
      setError("Incorrect OTP.");
      return;
    }
    setScreen("recover-reset");
  };

  const handleRecoverReset = async () => {
    clearError();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password needs at least one uppercase letter and one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    // Re-register with new password via auth API
    await apiAuth("signup", recoverEmail, newPassword);
    await new Promise((r) => setTimeout(r, 600));
    localStorage.removeItem(RECOVERY_KEY);
    setLoading(false);
    showInfo("Password updated! Please log in.");
    setScreen("login");
  };

  // ── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginOtp("");
    setOtpInput("");
    setDraft({ email: "", phone: "", password: "", otp: "", legalName: "", displayName: "", avatarColor: randomColor() });
    setScreen("landing");
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const Avatar = ({ profile, size = 56 }: { profile: UserProfile; size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: profile.avatarColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.3)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      {profile.avatarInitials}
    </div>
  );

  const ErrorBox = ({ msg }: { msg: string }) =>
    msg ? (
      <div style={S.errorBox}>
        <span style={{ marginRight: 6 }}>⚠️</span>
        {msg}
      </div>
    ) : null;

  const InfoBox = ({ msg }: { msg: string }) =>
    msg ? (
      <div style={S.infoBox}>
        <span style={{ marginRight: 6 }}>✅</span>
        {msg}
      </div>
    ) : null;

  const Input = ({
    type = "text",
    placeholder,
    value,
    onChange,
    maxLength,
    style: extraStyle,
    autoComplete,
  }: {
    type?: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    maxLength?: number;
    style?: React.CSSProperties;
    autoComplete?: string;
  }) => (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...S.input, ...extraStyle }}
    />
  );

  const Btn = ({
    label,
    onClick,
    disabled,
    variant = "primary",
    style: extraStyle,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary" | "ghost";
    style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...S.btn,
        ...(variant === "primary" ? S.btnPrimary : variant === "secondary" ? S.btnSecondary : S.btnGhost),
        ...(disabled || loading ? S.btnDisabled : {}),
        ...extraStyle,
      }}
    >
      {loading && variant === "primary" ? "⏳ Working…" : label}
    </button>
  );

  const BackLink = ({ to, label = "← Back" }: { to: Screen; label?: string }) => (
    <button onClick={() => setScreen(to)} style={S.backLink}>
      {label}
    </button>
  );

  const StepIndicator = ({ step, total }: { step: number; total: number }) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i < step ? 28 : 8,
            height: 8,
            borderRadius: 4,
            background: i < step ? "#6C63FF" : "rgba(108,99,255,0.2)",
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );

  // ── Screens ────────────────────────────────────────────────────────────────

  // SPLASH
  if (screen === "splash") {
    return (
      <div style={S.splash}>
        <div style={S.splashLogo}>
          <div style={S.logoIcon}>🔐</div>
          <h1 style={S.logoText}>Confi</h1>
          <p style={S.logoSub}>Confidential Messaging</p>
        </div>
        <div style={S.splashLoader}>
          <div style={S.loaderDot} />
          <div style={{ ...S.loaderDot, animationDelay: "0.2s" }} />
          <div style={{ ...S.loaderDot, animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  // LANDING
  if (screen === "landing") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🔐</div>
            <h1 style={S.h1}>Confi</h1>
            <p style={S.subtitle}>
              Secure messaging with legally-binding confidentiality.
              <br />
              Every conversation protected by international NDA.
            </p>
          </div>
          <div style={S.featureGrid}>
            {[
              ["🔒", "End-to-end encrypted"],
              ["📜", "International NDA"],
              ["✅", "KYC-verified identities"],
              ["🔑", "OTP two-factor login"],
            ].map(([icon, text]) => (
              <div key={text} style={S.featureChip}>
                <span>{icon}</span>
                <span style={{ fontSize: 12, color: "#555" }}>{text}</span>
              </div>
            ))}
          </div>
          <Btn label="Create Account" onClick={() => setScreen("signup-contact")} />
          <Btn
            label="Sign In"
            onClick={() => setScreen("login")}
            variant="secondary"
            style={{ marginTop: 10 }}
          />
        </div>
      </div>
    );
  }

  // SIGNUP — CONTACT INFO
  if (screen === "signup-contact") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="landing" />
          <StepIndicator step={1} total={4} />
          <h2 style={S.h2}>Create Account</h2>
          <p style={S.hint}>Step 1 of 4 — Contact Information</p>
          <ErrorBox msg={error} />
          <InfoBox msg={info} />

          <label style={S.label}>Email Address</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={draft.email}
            onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
            autoComplete="email"
          />

          <label style={S.label}>Phone Number</label>
          <Input
            type="tel"
            placeholder="+1 555 000 0000"
            value={draft.phone}
            onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
            autoComplete="tel"
          />

          <label style={S.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={draft.password}
              autoComplete="new-password"
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              style={{ ...S.input, paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPassword((s) => !s)}
              style={S.eyeBtn}
              type="button"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div style={S.passwordStrength}>
            {["8+ chars", "Uppercase", "Number"].map((req) => {
              const met =
                req === "8+ chars"
                  ? draft.password.length >= 8
                  : req === "Uppercase"
                  ? /[A-Z]/.test(draft.password)
                  : /[0-9]/.test(draft.password);
              return (
                <span key={req} style={{ color: met ? "#43C59E" : "#bbb", fontSize: 11 }}>
                  {met ? "✓" : "○"} {req}
                </span>
              );
            })}
          </div>

          <Btn label="Send OTP →" onClick={handleSignupContact} />

          <p style={S.footerNote}>
            Already have an account?{" "}
            <button onClick={() => setScreen("login")} style={S.link}>
              Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  // SIGNUP — OTP
  if (screen === "signup-otp") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="signup-contact" />
          <StepIndicator step={2} total={4} />
          <h2 style={S.h2}>Verify Your Email</h2>
          <p style={S.hint}>
            A 6-digit OTP was sent to{" "}
            <strong style={{ color: "#6C63FF" }}>{otpTarget}</strong>
          </p>
          <p style={{ ...S.hint, fontSize: 12, color: "#f5a623" }}>
            🛠️ Dev mode: check browser console for OTP
          </p>
          <ErrorBox msg={error} />
          <InfoBox msg={info} />

          <label style={S.label}>Enter OTP</label>
          <Input
            type="text"
            placeholder="000000"
            value={otpInput}
            onChange={(v) => setOtpInput(v.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />

          <Btn label="Verify OTP →" onClick={handleSignupOtp} />

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={resendOtp} style={S.link}>
              Resend OTP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SIGNUP — KYC
  if (screen === "signup-kyc") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="signup-otp" />
          <StepIndicator step={3} total={4} />
          <h2 style={S.h2}>Identity Verification</h2>
          <p style={S.hint}>Step 3 of 4 — KYC & Legal Acknowledgment</p>
          <ErrorBox msg={error} />

          <div style={S.kycBanner}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📜</div>
            <strong>Why we need this</strong>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              Confi activates international NDAs on confidential conversations.
              Your legal name makes these agreements enforceable under applicable law.
            </p>
          </div>

          <label style={S.label}>Full Legal Name</label>
          <Input
            type="text"
            placeholder="As it appears on your ID (First Last)"
            value={draft.legalName}
            onChange={(v) => setDraft((d) => ({ ...d, legalName: v }))}
            autoComplete="name"
          />

          <label style={{ ...S.checkLabel, marginTop: 16 }}>
            <input
              type="checkbox"
              checked={kycChecked}
              onChange={(e) => setKycChecked(e.target.checked)}
              style={{ marginRight: 10, accentColor: "#6C63FF" }}
            />
            <span>
              I confirm that the name entered above is my accurate legal name and matches
              my government-issued identification.
            </span>
          </label>

          <label style={{ ...S.checkLabel, marginTop: 12 }}>
            <input
              type="checkbox"
              checked={kycNdaChecked}
              onChange={(e) => setKycNdaChecked(e.target.checked)}
              style={{ marginRight: 10, accentColor: "#6C63FF" }}
            />
            <span>
              I acknowledge that enabling Confidential Mode on any conversation will bind
              me to an international Non-Disclosure Agreement (NDA) under the laws of the
              applicable jurisdiction, and that my verified identity will be associated
              with that agreement.
            </span>
          </label>

          <div style={S.legalNote}>
            <strong>⚖️ Legal Notice:</strong> By proceeding, you agree that your legal
            identity is verified for NDA enforceability purposes. False information
            constitutes fraud under applicable law.
          </div>

          <Btn label="Confirm & Continue →" onClick={handleKyc} />
        </div>
      </div>
    );
  }

  // SIGNUP — PROFILE
  if (screen === "signup-profile") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="signup-kyc" />
          <StepIndicator step={4} total={4} />
          <h2 style={S.h2}>Set Up Your Profile</h2>
          <p style={S.hint}>Step 4 of 4 — How others see you</p>
          <ErrorBox msg={error} />

          {/* Avatar preview */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: draft.avatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 28,
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                border: "3px solid white",
                cursor: "pointer",
              }}
              title="Click to change color"
              onClick={() =>
                setDraft((d) => ({ ...d, avatarColor: randomColor() }))
              }
            >
              {getInitials(draft.displayName || draft.legalName)}
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#888", marginBottom: 16 }}>
            Tap avatar to change color
          </p>

          <div style={S.colorPicker}>
            {AVATAR_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setDraft((d) => ({ ...d, avatarColor: c }))}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: c,
                  cursor: "pointer",
                  border: draft.avatarColor === c ? "3px solid #222" : "2px solid transparent",
                  transition: "transform 0.15s",
                  transform: draft.avatarColor === c ? "scale(1.25)" : "scale(1)",
                }}
              />
            ))}
          </div>

          <label style={S.label}>Display Name</label>
          <Input
            type="text"
            placeholder="How you appear in chats"
            value={draft.displayName}
            onChange={(v) => setDraft((d) => ({ ...d, displayName: v }))}
            maxLength={30}
          />
          <p style={{ fontSize: 11, color: "#aaa", marginTop: -8, marginBottom: 12 }}>
            Your legal name is stored separately and used only for NDA enforcement.
          </p>

          <div style={S.profilePreview}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: draft.avatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {getInitials(draft.displayName || draft.legalName)}
            </div>
            <div style={{ marginLeft: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {draft.displayName || "Your Name"}
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>{draft.email}</div>
              <div style={{ fontSize: 11, color: "#43C59E", marginTop: 2 }}>✅ KYC Verified</div>
            </div>
          </div>

          <Btn
            label="Create Account 🎉"
            onClick={handleProfileSetup}
          />
        </div>
      </div>
    );
  }

  // LOGIN
  if (screen === "login") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="landing" />
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 40 }}>🔐</div>
            <h2 style={S.h2}>Welcome Back</h2>
          </div>
          <ErrorBox msg={error} />
          <InfoBox msg={info} />

          <label style={S.label}>Email Address</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={loginEmail}
            onChange={setLoginEmail}
            autoComplete="email"
          />

          <label style={S.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              value={loginPassword}
              autoComplete="current-password"
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{ ...S.input, paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPassword((s) => !s)}
              style={S.eyeBtn}
              type="button"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div style={{ textAlign: "right", marginTop: -8, marginBottom: 16 }}>
            <button
              onClick={() => {
                setRecoverEmail(loginEmail);
                setScreen("recover");
              }}
              style={S.link}
            >
              Forgot password?
            </button>
          </div>

          <Btn label="Sign In →" onClick={handleLogin} />

          <p style={S.footerNote}>
            New to Confi?{" "}
            <button onClick={() => setScreen("signup-contact")} style={S.link}>
              Create Account
            </button>
          </p>
        </div>
      </div>
    );
  }

  // LOGIN — OTP
  if (screen === "login-otp") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="login" />
          <h2 style={S.h2}>Two-Factor Verification</h2>
          <p style={S.hint}>
            OTP sent to <strong style={{ color: "#6C63FF" }}>{loginEmail}</strong>
          </p>
          <p style={{ ...S.hint, fontSize: 12, color: "#f5a623" }}>
            🛠️ Dev mode: check browser console for OTP
          </p>
          <ErrorBox msg={error} />

          <label style={S.label}>Enter OTP</label>
          <Input
            type="text"
            placeholder="000000"
            value={loginOtp}
            onChange={(v) => setLoginOtp(v.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />

          <Btn label="Verify & Sign In →" onClick={handleLoginOtp} />

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={() => {
                const otp = generateOTP();
                setLoginPendingOtp(otp);
                console.info(`[CONFI DEV] New Login OTP: ${otp}`);
                showInfo("New OTP sent");
              }}
              style={S.link}
            >
              Resend OTP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RECOVER — EMAIL
  if (screen === "recover") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="login" />
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 40 }}>🔑</div>
            <h2 style={S.h2}>Account Recovery</h2>
            <p style={S.hint}>Enter your email to receive a recovery OTP</p>
          </div>
          <ErrorBox msg={error} />
          <InfoBox msg={info} />

          <label style={S.label}>Email Address</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={recoverEmail}
            onChange={setRecoverEmail}
          />

          <Btn label="Send Recovery OTP →" onClick={handleRecoverRequest} />
        </div>
      </div>
    );
  }

  // RECOVER — OTP
  if (screen === "recover-otp") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <BackLink to="recover" />
          <h2 style={S.h2}>Recovery Verification</h2>
          <p style={S.hint}>
            OTP sent to <strong style={{ color: "#6C63FF" }}>{recoverEmail}</strong>
          </p>
          <p style={{ ...S.hint, fontSize: 12, color: "#f5a623" }}>
            🛠️ Dev mode: check browser console for OTP
          </p>
          <ErrorBox msg={error} />

          <label style={S.label}>Enter Recovery OTP</label>
          <Input
            type="text"
            placeholder="000000"
            value={recoverOtp}
            onChange={(v) => setRecoverOtp(v.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22, fontWeight: 700 }}
          />

          <Btn label="Verify OTP →" onClick={handleRecoverOtp} />
        </div>
      </div>
    );
  }

  // RECOVER — RESET PASSWORD
  if (screen === "recover-reset") {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h2 style={S.h2}>Reset Password</h2>
          <p style={S.hint}>Choose a new secure password</p>
          <ErrorBox msg={error} />

          <label style={S.label}>New Password</label>
          <Input
            type="password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />

          <label style={S.label}>Confirm Password</label>
          <Input
            type="password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          <Btn label="Reset Password →" onClick={handleRecoverReset} />
        </div>
      </div>
    );
  }

  // HOME / PROFILE
  if (screen === "home" && user) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, maxWidth: 480 }}>
          {/* Header */}
          <div style={S.homeHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: "#1a1a2e" }}>Confi</h2>
              <span style={{ fontSize: 12, color: "#888" }}>Confidential Messaging</span>
            </div>
            <button onClick={handleLogout} style={S.logoutBtn}>
              Sign Out
            </button>
          </div>

          {/* Profile Card */}
          <div style={S.profileCard}>
            <div style={{ position: "relative" }}>
              <Avatar profile={user} size={72} />
              {user.kycAcknowledged && (
                <div style={S.kycBadge} title="KYC Verified">✓</div>
              )}
            </div>
            <div style={{ marginLeft: 16, flex: 1 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 20, color: "#1a1a2e" }}>
                {user.displayName}
              </h3>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>{user.email}</p>
              {user.phone && (
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>📱 {user.phone}</p>
              )}
              <div style={S.userIdChip}>
                🆔 {user.userId}
              </div>
            </div>
          </div>

          {/* KYC Status */}
          {user.kycAcknowledged && (
            <div style={S.kycStatus}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>📜</span>
                <strong style={{ color: "#1a1a2e" }}>Identity Verified</strong>
                <span style={{ marginLeft: "auto", background: "#43C59E", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 99 }}>
                  ACTIVE
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: "#888" }}>Legal Name</span>
                  <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{user.legalName}</div>
                </div>
                <div>
                  <span style={{ color: "#888" }}>Verified On</span>
                  <div style={{ fontWeight: 600, color: "#1a1a2e" }}>
                    {new Date(user.kycTimestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Session Info */}
          <div style={S.sessionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span>🔐</span>
              <strong style={{ fontSize: 14 }}>Current Session</strong>
              <span
                style={{
                  marginLeft: "auto",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#43C59E",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: "#43C59E" }}>Active</span>
            </div>
            <div style={{ fontSize: 12, color: "#888", wordBreak: "break-all" }}>
              <span style={{ color: "#555" }}>Token:</span>{" "}
              {user.sessionToken.slice(0, 16)}…
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              <span style={{ color: "#555" }}>Member since:</span>{" "}
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          {/* NDA Feature Preview */}
          <div style={S.ndaPreview}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>🛡️</div>
              <div>
                <strong style={{ fontSize: 15, color: "#1a1a2e" }}>Confidential Mode</strong>
                <div style={{ fontSize: 12, color: "#666" }}>Activates international NDA on conversation</div>
              </div>
              <div style={S.toggleOff}>OFF</div>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>
              When enabled on a conversation, both parties are bound by a legally
              enforceable NDA. Your verified identity ({user.legalName}) will be
              associated with the agreement.
            </p>
          </div>

          {/* Security Overview */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, color: "#888", marginBottom: 10, fontWeight: 500 }}>
              ACCOUNT SECURITY
            </h4>
            <div style={S.securityList}>
              {[
                ["✅", "Email verified", true],
                ["✅", "Phone registered", !!user.phone],
                ["✅", "KYC completed", user.kycAcknowledged],
                ["✅", "Two-factor auth", true],
                ["✅", "Session token active", true],
              ].map(([icon, label, active]) => (
                <div key={String(label)} style={S.securityRow}>
                  <span style={{ fontSize: 16 }}>{active ? "✅" : "⬜"}</span>
                  <span style={{ fontSize: 14, color: active ? "#1a1a2e" : "#bbb" }}>
                    {String(label)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "#ccc", marginTop: 20 }}>
            Confi v1.0 · Identity Layer Active
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  splash: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  },
  splashLogo: {
    textAlign: "center",
  },
  logoIcon: {
    fontSize: 72,
    marginBottom: 8,
    filter: "drop-shadow(0 0 20px rgba(108,99,255,0.6))",
  },
  logoText: {
    margin: 0,
    fontSize: 48,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-1px",
  },
  logoSub: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
  },
  splashLoader: {
    display: "flex",
    gap: 8,
    marginTop: 48,
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6C63FF",
    animation: "bounce 0.8s infinite alternate",
  },
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8f7ff 0%, #ede8ff 100%)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "24px 16px 48px",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 8px 40px rgba(108,99,255,0.12)",
    padding: "28px 28px",
    width: "100%",
    maxWidth: 440,
  },
  h1: {
    margin: "0 0 8px",
    fontSize: 36,
    fontWeight: 800,
    color: "#1a1a2e",
    letterSpacing: "-1px",
  },
  h2: {
    margin: "0 0 6px",
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  subtitle: {
    color: "#666",
    fontSize: 15,
    lineHeight: 1.6,
    margin: 0,
  },
  hint: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#444",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1.5px solid #e0ddf7",
    fontSize: 15,
    background: "#fafafe",
    color: "#1a1a2e",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    marginBottom: 14,
    fontFamily: "inherit",
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
    padding: 0,
    lineHeight: 1,
    marginTop: -7,
  },
  passwordStrength: {
    display: "flex",
    gap: 12,
    marginBottom: 16,
    marginTop: -8,
  },
  btn: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6C63FF, #8B5CF6)",
    color: "#fff",
    boxShadow: "0 4px 16px rgba(108,99,255,0.35)",
  },
  btnSecondary: {
    background: "transparent",
    color: "#6C63FF",
    border: "1.5px solid #6C63FF",
  },
  btnGhost: {
    background: "transparent",
    color: "#888",
    border: "none",
    padding: "8px",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  errorBox: {
    background: "#fff5f5",
    border: "1.5px solid #fed7d7",
    color: "#c53030",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
  },
  infoBox: {
    background: "#f0fff4",
    border: "1.5px solid #9ae6b4",
    color: "#276749",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 24,
  },
  featureChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    background: "#f8f7ff",
    borderRadius: 10,
    fontSize: 13,
  },
  footerNote: {
    textAlign: "center" as const,
    fontSize: 13,
    color: "#888",
    marginTop: 16,
  },
  link: {
    background: "none",
    border: "none",
    color: "#6C63FF",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "inherit",
    padding: 0,
    fontFamily: "inherit",
  },
  backLink: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 14,
    cursor: "pointer",
    padding: "0 0 16px",
    display: "block",
    fontFamily: "inherit",
  },
  kycBanner: {
    background: "linear-gradient(135deg, #f8f7ff, #ede8ff)",
    border: "1.5px solid #d6d0ff",
    borderRadius: 14,
    padding: "16px",
    marginBottom: 20,
    color: "#1a1a2e",
    fontSize: 14,
    textAlign: "center" as const,
  },
  checkLabel: {
    display: "flex",
    alignItems: "flex-start",
    fontSize: 13,
    color: "#444",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  legalNote: {
    background: "#fffbeb",
    border: "1.5px solid #f6e05e",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 12,
    color: "#744210",
    marginTop: 16,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  colorPicker: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  profilePreview: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    background: "#f8f7ff",
    borderRadius: 12,
    marginBottom: 16,
    border: "1.5px solid #e0ddf7",
  },
  homeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid #f0eeff",
  },
  logoutBtn: {
    background: "none",
    border: "1.5px solid #e0ddf7",
    color: "#888",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  profileCard: {
    display: "flex",
    alignItems: "center",
    padding: "20px",
    background: "linear-gradient(135deg, #f8f7ff, #ede8ff)",
    borderRadius: 16,
    marginBottom: 16,
    position: "relative" as const,
  },
  kycBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#43C59E",
    color: "#fff",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #fff",
    fontWeight: 700,
  },
  userIdChip: {
    display: "inline-block",
    background: "#fff",
    border: "1px solid #e0ddf7",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    color: "#6C63FF",
    fontFamily: "monospace",
    marginTop: 4,
  },
  kycStatus: {
    background: "#f0fff8",
    border: "1.5px solid #9ae6b4",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 12,
  },
  sessionCard: {
    background: "#f8f7ff",
    border: "1.5px solid #e0ddf7",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 12,
  },
  ndaPreview: {
    background: "linear-gradient(135deg, #1a1a2e, #16213e)",
    borderRadius: 14,
    padding: "16px",
    marginBottom: 12,
    color: "#fff",
  },
  toggleOff: {
    marginLeft: "auto",
    background: "rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.5)",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
  },
  securityList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  securityRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: "#fafafe",
    borderRadius: 10,
    border: "1px solid #f0eeff",
  },
};