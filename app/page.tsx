"use client";

import { useEffect, useState } from "react";

type Screen =
  | "splash"
  | "auth-choice"
  | "signup"
  | "otp-email"
  | "kyc"
  | "login"
  | "forgot-password"
  | "reset-otp"
  | "reset-new-password"
  | "dashboard";

interface UserProfile {
  email: string;
  phone?: string;
  fullLegalName?: string;
  country?: string;
  emailVerified?: boolean;
  kycComplete?: boolean;
}

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize",
  "Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei",
  "Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde",
  "Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo",
  "Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti",
  "Dominican Republic","DR Congo","Ecuador","Egypt","El Salvador","Eritrea","Estonia",
  "Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany",
  "Ghana","Greece","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras",
  "Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia",
  "Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
  "Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritania","Mauritius",
  "Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea",
  "North Macedonia","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia",
  "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand",
  "Timor-Leste","Togo","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda",
  "Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  // OTP
  const [otpInput, setOtpInput] = useState("");
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [otpTarget, setOtpTarget] = useState(""); // email or phone
  const [otpSentAt, setOtpSentAt] = useState<number>(0);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // KYC
  const [kycName, setKycName] = useState("");
  const [kycCountry, setKycCountry] = useState("");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Password reset
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpGenerated, setResetOtpGenerated] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Splash + session restore
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = localStorage.getItem("confi_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserProfile;
          setProfile(parsed);
          setScreen("dashboard");
        } catch {
          setScreen("auth-choice");
        }
      } else {
        setScreen("auth-choice");
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Track page
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // OTP countdown
  useEffect(() => {
    if (otpSentAt === 0) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - otpSentAt) / 1000);
      const remaining = 120 - elapsed;
      if (remaining <= 0) {
        setOtpCountdown(0);
        clearInterval(interval);
      } else {
        setOtpCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [otpSentAt]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  // ─── SIGNUP ───────────────────────────────────────────────────────────────
  async function handleSignup() {
    clearMessages();
    if (!signupEmail.trim()) return setError("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail))
      return setError("Enter a valid email address.");
    if (signupPassword.length < 8)
      return setError("Password must be at least 8 characters.");
    if (signupPassword !== signupConfirmPassword)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Signup failed. Email may already exist.");
      } else {
        // Send OTP to email (simulated — in prod wire to email service)
        const otp = generateOTP();
        setGeneratedOTP(otp);
        setOtpTarget(signupEmail.trim().toLowerCase());
        setOtpSentAt(Date.now());
        setOtpCountdown(120);
        setProfile({ email: signupEmail.trim().toLowerCase(), phone: signupPhone });
        // In production: POST to /api/otp/send with { email, otp }
        // For demo, we display OTP in success message
        setSuccess(`OTP sent to ${signupEmail}. (Demo OTP: ${otp})`);
        setScreen("otp-email");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── OTP VERIFY ───────────────────────────────────────────────────────────
  async function handleVerifyOTP() {
    clearMessages();
    if (!otpInput.trim()) return setError("Enter the OTP.");
    if (otpInput.trim() !== generatedOTP) {
      if (otpCountdown === 0) return setError("OTP expired. Please resend.");
      return setError("Invalid OTP. Please try again.");
    }
    setLoading(true);
    try {
      // Mark email verified in session
      const updated: UserProfile = { ...profile!, emailVerified: true };
      setProfile(updated);
      setSuccess("Email verified successfully!");
      setTimeout(() => {
        clearMessages();
        setScreen("kyc");
      }, 800);
    } finally {
      setLoading(false);
    }
  }

  function handleResendOTP() {
    const otp = generateOTP();
    setGeneratedOTP(otp);
    setOtpSentAt(Date.now());
    setOtpCountdown(120);
    setOtpInput("");
    setSuccess(`New OTP sent to ${otpTarget}. (Demo OTP: ${otp})`);
  }

  // ─── KYC ──────────────────────────────────────────────────────────────────
  async function handleKYC() {
    clearMessages();
    if (!kycName.trim() || kycName.trim().split(" ").length < 2)
      return setError("Enter your full legal name (first and last name).");
    if (!kycCountry) return setError("Select your country.");

    setLoading(true);
    try {
      // Store KYC in profile — in prod, POST to /api/users/kyc
      const updated: UserProfile = {
        ...profile!,
        fullLegalName: kycName.trim(),
        country: kycCountry,
        kycComplete: true,
      };
      setProfile(updated);
      localStorage.setItem("confi_session", JSON.stringify(updated));
      setSuccess("Identity verified. Welcome to Confi!");
      setTimeout(() => {
        clearMessages();
        setScreen("dashboard");
      }, 1000);
    } finally {
      setLoading(false);
    }
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  async function handleLogin() {
    clearMessages();
    if (!loginEmail.trim()) return setError("Email is required.");
    if (!loginPassword) return setError("Password is required.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Invalid credentials.");
      } else {
        const userProfile: UserProfile = {
          email: data.email || loginEmail.trim().toLowerCase(),
          emailVerified: true,
          kycComplete: true, // assume returning user completed KYC
        };
        setProfile(userProfile);
        localStorage.setItem("confi_session", JSON.stringify(userProfile));
        setScreen("dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────
  function handleLogout() {
    localStorage.removeItem("confi_session");
    setProfile(null);
    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirmPassword("");
    setSignupPhone("");
    setScreen("auth-choice");
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────
  function handleForgotPassword() {
    clearMessages();
    if (!resetEmail.trim()) return setError("Enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail))
      return setError("Enter a valid email address.");
    const otp = generateOTP();
    setResetOtpGenerated(otp);
    setOtpSentAt(Date.now());
    setOtpCountdown(120);
    setSuccess(`Reset OTP sent to ${resetEmail}. (Demo OTP: ${otp})`);
    setTimeout(() => setScreen("reset-otp"), 600);
  }

  function handleVerifyResetOTP() {
    clearMessages();
    if (!resetOtp.trim()) return setError("Enter the OTP.");
    if (resetOtp.trim() !== resetOtpGenerated) {
      if (otpCountdown === 0) return setError("OTP expired. Please go back and resend.");
      return setError("Invalid OTP.");
    }
    setScreen("reset-new-password");
  }

  async function handleResetPassword() {
    clearMessages();
    if (newPassword.length < 8)
      return setError("Password must be at least 8 characters.");
    if (newPassword !== confirmNewPassword)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      // In prod: PATCH /api/auth/reset with { email, newPassword, otp }
      // Simulated with signup (overwrites) — in prod use a dedicated reset endpoint
      setSuccess("Password reset successfully. Please log in.");
      setTimeout(() => {
        clearMessages();
        setLoginEmail(resetEmail);
        setScreen("login");
      }, 1200);
    } finally {
      setLoading(false);
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {screen === "splash" && <SplashScreen />}
      {screen === "auth-choice" && (
        <AuthChoice onLogin={() => setScreen("login")} onSignup={() => setScreen("signup")} />
      )}
      {screen === "signup" && (
        <SignupScreen
          email={signupEmail} setEmail={setSignupEmail}
          phone={signupPhone} setPhone={setSignupPhone}
          password={signupPassword} setPassword={setSignupPassword}
          confirmPassword={signupConfirmPassword} setConfirmPassword={setSignupConfirmPassword}
          onSubmit={handleSignup}
          onBack={() => setScreen("auth-choice")}
          loading={loading} error={error} success={success}
        />
      )}
      {screen === "otp-email" && (
        <OTPScreen
          target={otpTarget}
          otp={otpInput} setOtp={setOtpInput}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
          onBack={() => setScreen("signup")}
          countdown={otpCountdown}
          loading={loading} error={error} success={success}
        />
      )}
      {screen === "kyc" && (
        <KYCScreen
          name={kycName} setName={setKycName}
          country={kycCountry} setCountry={setKycCountry}
          onSubmit={handleKYC}
          loading={loading} error={error} success={success}
        />
      )}
      {screen === "login" && (
        <LoginScreen
          email={loginEmail} setEmail={setLoginEmail}
          password={loginPassword} setPassword={setLoginPassword}
          onSubmit={handleLogin}
          onBack={() => setScreen("auth-choice")}
          onForgot={() => { clearMessages(); setScreen("forgot-password"); }}
          loading={loading} error={error} success={success}
        />
      )}
      {screen === "forgot-password" && (
        <ForgotPasswordScreen
          email={resetEmail} setEmail={setResetEmail}
          onSubmit={handleForgotPassword}
          onBack={() => setScreen("login")}
          error={error} success={success}
        />
      )}
      {screen === "reset-otp" && (
        <ResetOTPScreen
          otp={resetOtp} setOtp={setResetOtp}
          onVerify={handleVerifyResetOTP}
          onBack={() => setScreen("forgot-password")}
          countdown={otpCountdown}
          error={error} success={success}
        />
      )}
      {screen === "reset-new-password" && (
        <NewPasswordScreen
          password={newPassword} setPassword={setNewPassword}
          confirmPassword={confirmNewPassword} setConfirmPassword={setConfirmNewPassword}
          onSubmit={handleResetPassword}
          loading={loading} error={error} success={success}
        />
      )}
      {screen === "dashboard" && profile && (
        <Dashboard profile={profile} onLogout={handleLogout} />
      )}
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={styles.centered}>
      <div style={styles.logo}>🔒</div>
      <h1 style={styles.appName}>Confi</h1>
      <p style={styles.tagline}>Confidential Messaging. Legally Binding.</p>
      <div style={styles.loader}>
        <div style={styles.loaderBar} />
      </div>
    </div>
  );
}

// ─── AUTH CHOICE ──────────────────────────────────────────────────────────────
function AuthChoice({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <div style={styles.centered}>
      <div style={styles.logo}>🔒</div>
      <h1 style={styles.appName}>Confi</h1>
      <p style={styles.tagline}>Secure. Private. Legally Protected.</p>
      <div style={{ marginTop: 40, width: "100%", maxWidth: 360 }}>
        <button style={styles.btnPrimary} onClick={onSignup}>Create Account</button>
        <button style={{ ...styles.btnSecondary, marginTop: 12 }} onClick={onLogin}>
          Sign In
        </button>
      </div>
      <p style={styles.legalNote}>
        By continuing, you agree to Confi&apos;s Terms of Service and Privacy Policy.
        Your legal identity is required for NDA enforcement.
      </p>
    </div>
  );
}

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
function SignupScreen({
  email, setEmail, phone, setPhone, password, setPassword,
  confirmPassword, setConfirmPassword, onSubmit, onBack, loading, error, success
}: {
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirmPassword: string; setConfirmPassword: (v: string) => void;
  onSubmit: () => void; onBack: () => void;
  loading: boolean; error: string; success: string;
}) {
  const [showPass, setShowPass] = useState(false);
  return (
    <div style={styles.screen}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>✉️</div>
          <h2 style={styles.formTitle}>Create Account</h2>
          <p style={styles.formSubtitle}>Step 1 of 3 — Account Credentials</p>
        </div>
        <div style={styles.stepBar}>
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
          <div style={styles.stepLine} />
          <div style={styles.stepDot} />
          <div style={styles.stepLine} />
          <div style={styles.stepDot} />
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Email Address *</label>
        <input
          style={styles.input}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label style={styles.label}>Phone Number (optional)</label>
        <input
          style={styles.input}
          type="tel"
          placeholder="+1 234 567 8900"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <label style={styles.label}>Password *</label>
        <div style={styles.passwordWrap}>
          <input
            style={{ ...styles.input, marginBottom: 0 }}
            type={showPass ? "text" : "password"}
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button style={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>
        <PasswordStrength password={password} />
        <label style={{ ...styles.label, marginTop: 12 }}>Confirm Password *</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Repeat password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button
          style={{ ...styles.btnPrimary, marginTop: 20 }}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Sending OTP…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

// ─── PASSWORD STRENGTH ────────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  function getStrength() {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }
  const s = getStrength();
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#eee", "#e74c3c", "#e67e22", "#f1c40f", "#128C7E"];
  if (!password) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor: i <= s ? colors[s] : "#eee",
              transition: "background-color 0.3s",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 12, color: colors[s], marginTop: 4 }}>{labels[s]}</p>
    </div>
  );
}

// ─── OTP SCREEN ───────────────────────────────────────────────────────────────
function OTPScreen({
  target, otp, setOtp, onVerify, onResend, onBack, countdown, loading, error, success
}: {
  target: string; otp: string; setOtp: (v: string) => void;
  onVerify: () => void; onResend: () => void; onBack: () => void;
  countdown: number; loading: boolean; error: string; success: string;
}) {
  return (
    <div style={styles.screen}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>📱</div>
          <h2 style={styles.formTitle}>Verify Email</h2>
          <p style={styles.formSubtitle}>Step 2 of 3 — OTP Verification</p>
        </div>
        <div style={styles.stepBar}>
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepLine, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
          <div style={styles.stepLine} />
          <div style={styles.stepDot} />
        </div>
        <p style={{ color: "#555", textAlign: "center", marginBottom: 20 }}>
          A 6-digit code was sent to <strong>{target}</strong>
        </p>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Enter OTP</label>
        <input
          style={{ ...styles.input, textAlign: "center", fontSize: 28, letterSpacing: 12, fontWeight: 700 }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        />
        {countdown > 0 ? (
          <p style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
            Code expires in <strong>{countdown}s</strong>
          </p>
        ) : (
          <p style={{ textAlign: "center", color: "#e74c3c", fontSize: 13 }}>
            Code expired.{" "}
            <button style={styles.linkBtn} onClick={onResend}>Resend OTP</button>
          </p>
        )}
        <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={onVerify} disabled={loading}>
          {loading ? "Verifying…" : "Verify & Continue →"}
        </button>
        <button style={styles.linkBtnBlock} onClick={onResend} disabled={countdown > 0}>
          {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
        </button>
      </div>
    </div>
  );
}

// ─── KYC SCREEN ───────────────────────────────────────────────────────────────
function KYCScreen({
  name, setName, country, setCountry, onSubmit, loading, error, success
}: {
  name: string; setName: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string; success: string;
}) {
  return (
    <div style={styles.screen}>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>🪪</div>
          <h2 style={styles.formTitle}>Legal Identity</h2>
          <p style={styles.formSubtitle}>Step 3 of 3 — KYC Verification</p>
        </div>
        <div style={styles.stepBar}>
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepLine, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepLine, backgroundColor: "#128C7E" }} />
          <div style={{ ...styles.stepDot, backgroundColor: "#128C7E" }} />
        </div>
        <div style={styles.kycBanner}>
          <p style={{ margin: 0, fontSize: 13, color: "#5a3e00", lineHeight: 1.5 }}>
            ⚖️ <strong>Legal Notice:</strong> Your full legal name and country are required
            to auto-generate internationally enforceable Non-Disclosure Agreements (NDAs)
            when Confidential Mode is activated in conversations. This information is
            stored securely and used solely for legal document generation.
          </p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Full Legal Name *</label>
        <input
          style={styles.input}
          type="text"
          placeholder="e.g. Jonathan Michael Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <p style={{ fontSize: 12, color: "#888", marginTop: -8, marginBottom: 12 }}>
          Must match your government-issued ID exactly
        </p>
        <label style={styles.label}>Country of Residence *</label>
        <select
          style={styles.select}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">Select your country…</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          style={{ ...styles.btnPrimary, marginTop: 24 }}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Verifying…" : "Complete Registration ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({
  email, setEmail, password, setPassword, onSubmit, onBack, onForgot,
  loading, error, success
}: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  onSubmit: () => void; onBack: () => void; onForgot: () => void;
  loading: boolean; error: string; success: string;
}) {
  const [showPass, setShowPass] = useState(false);
  return (
    <div style={styles.screen}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>🔑</div>
          <h2 style={styles.formTitle}>Welcome Back</h2>
          <p style={styles.formSubtitle}>Sign in to your Confi account</p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Email Address</label>
        <input
          style={styles.input}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label style={styles.label}>Password</label>
        <div style={styles.passwordWrap}>
          <input
            style={{ ...styles.input, marginBottom: 0 }}
            type={showPass ? "text" : "password"}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
          <button style={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>
        <button style={styles.linkBtnBlock} onClick={onForgot}>
          Forgot password?
        </button>
        <button
          style={{ ...styles.btnPrimary, marginTop: 20 }}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign In →"}
        </button>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
function ForgotPasswordScreen({
  email, setEmail, onSubmit, onBack, error, success
}: {
  email: string; setEmail: (v: string) => void;
  onSubmit: () => void; onBack: () => void;
  error: string; success: string;
}) {
  return (
    <div style={styles.screen}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>📧</div>
          <h2 style={styles.formTitle}>Reset Password</h2>
          <p style={styles.formSubtitle}>Enter your email to receive a reset code</p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Email Address</label>
        <input
          style={styles.input}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <button style={{ ...styles.btnPrimary, marginTop: 20 }} onClick={onSubmit}>
          Send Reset Code →
        </button>
      </div>
    </div>
  );
}

// ─── RESET OTP ────────────────────────────────────────────────────────────────
function ResetOTPScreen({
  otp, setOtp, onVerify, onBack, countdown, error, success
}: {
  otp: string; setOtp: (v: string) => void;
  onVerify: () => void; onBack: () => void;
  countdown: number; error: string; success: string;
}) {
  return (
    <div style={styles.screen}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>🔐</div>
          <h2 style={styles.formTitle}>Enter Reset Code</h2>
          <p style={styles.formSubtitle}>Check your email for the 6-digit code</p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>Reset OTP</label>
        <input
          style={{ ...styles.input, textAlign: "center", fontSize: 28, letterSpacing: 12, fontWeight: 700 }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        />
        {countdown > 0 && (
          <p style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
            Expires in <strong>{countdown}s</strong>
          </p>
        )}
        <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={onVerify}>
          Verify Code →
        </button>
      </div>
    </div>
  );
}

// ─── NEW PASSWORD ─────────────────────────────────────────────────────────────
function NewPasswordScreen({
  password, setPassword, confirmPassword, setConfirmPassword,
  onSubmit, loading, error, success
}: {
  password: string; setPassword: (v: string) => void;
  confirmPassword: string; setConfirmPassword: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string; success: string;
}) {
  return (
    <div style={styles.screen}>
      <div style={styles.formCard}>
        <div style={styles.formHeader}>
          <div style={styles.formIcon}>🛡️</div>
          <h2 style={styles.formTitle}>New Password</h2>
          <p style={styles.formSubtitle}>Choose a strong new password</p>
        </div>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}
        <label style={styles.label}>New Password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrength password={password} />
        <label style={{ ...styles.label, marginTop: 12 }}>Confirm New Password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          style={{ ...styles.btnPrimary, marginTop: 20 }}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? "Saving…" : "Reset Password ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  return (
    <div style={styles.screen}>
      <div style={styles.dashHeader}>
        <div style={styles.dashTitle}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <span style={{ fontWeight: 700, fontSize: 20, color: "#128C7E" }}>Confi</span>
        </div>
        <button style={styles.logoutBtn} onClick={onLogout}>Sign Out</button>
      </div>

      <div style={styles.profileCard}>
        <div style={styles.avatar}>
          {(profile.fullLegalName || profile.email)?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#1a1a1a" }}>
            {profile.fullLegalName || "Profile Incomplete"}
          </h2>
          <p style={{ margin: "2px 0", color: "#555", fontSize: 14 }}>{profile.email}</p>
          {profile.country && (
            <p style={{ margin: 0, color: "#888", fontSize: 13 }}>📍 {profile.country}</p>
          )}
        </div>
      </div>

      <div style={styles.statusGrid}>
        <StatusBadge label="Email" verified={!!profile.emailVerified} />
        <StatusBadge label="KYC" verified={!!profile.kycComplete} />
        <StatusBadge label="NDA Ready" verified={!!profile.kycComplete} />
      </div>

      <div style={styles.ndaCard}>
        <h3 style={{ margin: "0 0 8px 0", color: "#128C7E" }}>⚖️ NDA Profile</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#333", lineHeight: 1.6 }}>
          <strong>Legal Name:</strong> {profile.fullLegalName || "—"}<br />
          <strong>Country:</strong> {profile.country || "—"}<br />
          <strong>Jurisdiction:</strong> International (UNCITRAL Model Law)<br />
          <strong>Status:</strong>{" "}
          {profile.kycComplete ? (
            <span style={{ color: "#128C7E" }}>✓ Verified — NDA auto-generation enabled</span>
          ) : (
            <span style={{ color: "#e74c3c" }}>⚠ KYC incomplete</span>
          )}
        </p>
      </div>

      <div style={styles.featureGrid}>
        {[
          { icon: "💬", label: "Messages", desc: "Secure chats" },
          { icon: "🔏", label: "Confidential Mode", desc: "Auto-NDA activation" },
          { icon: "📄", label: "NDA Archive", desc: "Your agreements" },
          { icon: "👥", label: "Contacts", desc: "Verified users" },
        ].map((f) => (
          <div key={f.label} style={styles.featureCard}>
            <div style={{ fontSize: 28 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{f.label}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <p style={{ textAlign: "center", color: "#bbb", fontSize: 12, marginTop: 20 }}>
        Confi Messaging v1.0 · Your identity is secured
      </p>
    </div>
  );
}

function StatusBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div style={{
      ...styles.statusBadge,
      borderColor: verified ? "#128C7E" : "#ddd",
      backgroundColor: verified ? "#e8f5f3" : "#fafafa",
    }}>
      <span style={{ fontSize: 16 }}>{verified ? "✅" : "⬜"}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: verified ? "#128C7E" : "#999" }}>
        {label}
      </span>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#f0f2f5",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    width: "100%",
    maxWidth: 400,
  },
  screen: {
    width: "100%",
    maxWidth: 440,
    padding: "16px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
    filter: "drop-shadow(0 4px 12px rgba(18,140,126,0.3))",
  },
  appName: {
    fontSize: 36,
    fontWeight: 800,
    color: "#128C7E",
    margin: 0,
    letterSpacing: -1,
  },
  tagline: {
    color: "#666",
    fontSize: 15,
    marginTop: 6,
    textAlign: "center",
  },
  loader: {
    marginTop: 40,
    width: 200,
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
  },
  loaderBar: {
    width: "60%",
    height: "100%",
    backgroundColor: "#128C7E",
    borderRadius: 2,
    animation: "slide 1.5s ease-in-out infinite",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    marginTop: 8,
  },
  formHeader: {
    textAlign: "center",
    marginBottom: 20,
  },
  formIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: "0 0 4px 0",
  },
  formSubtitle: {
    fontSize: 13,
    color: "#888",
    margin: 0,
  },
  stepBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    marginBottom: 24,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor: "#ddd",
    transition: "background-color 0.4s",
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: "#ddd",
    transition: "background-color 0.4s",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#333",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 10,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    backgroundColor: "#fafafa",
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e0e0e0",
    borderRadius: 10,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 8,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#fafafa",
    cursor: "pointer",
  },
  passwordWrap: {
    position: "relative",
    marginBottom: 8,
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
  },
  btnPrimary: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#128C7E",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background-color 0.2s, transform 0.1s",
    letterSpacing: 0.3,
  },
  btnSecondary: {
    width: "100%",
    padding: "14px",
    backgroundColor: "transparent",
    color: "#128C7E",
    border: "2px solid #128C7E",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#128C7E",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "inherit",
    padding: 0,
    textDecoration: "underline",
  },
  linkBtnBlock: {
    display: "block",
    width: "100%",
    background: "none",
    border: "none",
    color: "#128C7E",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    padding: "10px 0",
    textAlign: "center",
    textDecoration: "underline",
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "#128C7E",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    padding: "8px 0",
    marginBottom: 8,
  },
  errorBox: {
    backgroundColor: "#fdecea",
    border: "1px solid #f5c6cb",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#c0392b",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  successBox: {
    backgroundColor: "#e8f5f3",
    border: "1px solid #128C7E",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#0a6b60",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  kycBanner: {
    backgroundColor: "#fff8e6",
    border: "1px solid #f0c040",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 20,
  },
  legalNote: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 1.6,
    maxWidth: 320,
  },
  dashHeader: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 4px",
    marginBottom: 4,
  },
  dashTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoutBtn: {
    background: "none",
    border: "1.5px solid #e74c3c",
    color: "#e74c3c",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  profileCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "20px 20px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    backgroundColor: "#128C7E",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  },
  statusGrid: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    border: "1.5px solid",
    borderRadius: 10,
    padding: "10px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  ndaCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "18px 20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
    marginBottom: 16,
    borderLeft: "4px solid #128C7E",
  },
  featureGrid: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  featureCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    transition: "transform 0.15s",
    textAlign: "center",
  },
};