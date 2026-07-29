"use client";

import { useEffect, useState, useCallback } from "react";

type Screen =
  | "splash"
  | "auth"
  | "register"
  | "verify-email"
  | "verify-phone"
  | "profile-setup"
  | "home";

type User = {
  email: string;
  displayName: string;
  phone: string;
  avatarColor: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityToken: string;
  createdAt: string;
};

type Session = {
  user: User;
  token: string;
  expiresAt: number;
};

const AVATAR_COLORS = [
  "#6C63FF","#FF6584","#43B89C","#F59E0B","#3B82F6",
  "#EC4899","#10B981","#8B5CF6","#EF4444","#14B8A6",
];

function generateToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateIdentityToken(email: string, phone: string): string {
  const raw = `CONFI-IDENTITY::${email}::${phone}::${Date.now()}::${generateToken(16)}`;
  return btoa(raw).replace(/=/g, "").substring(0, 48);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem("confi_session");
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem("confi_session");
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  localStorage.setItem("confi_session", JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem("confi_session");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 22, height: 22,
      border: "3px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      display: "inline-block",
    }} />
  );
}

function Avatar({ user, size = 48 }: { user: User; size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: user.avatarColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
      fontSize: size * 0.36,
      flexShrink: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      userSelect: "none",
    }}>
      {getInitials(user.displayName || user.email)}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "linear-gradient(135deg,#10B981,#059669)",
      color: "#fff", fontSize: 11, fontWeight: 700,
      padding: "2px 8px", borderRadius: 20,
      letterSpacing: 0.5,
    }}>
      ✓ VERIFIED IDENTITY
    </span>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
    }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🔒</div>
      <h1 style={{ color: "#fff", fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: 1 }}>
        Confi
      </h1>
      <p style={{ color: "rgba(255,255,255,0.55)", marginTop: 8, fontSize: 15 }}>
        Confidential Messaging
      </p>
      <div style={{ marginTop: 40 }}>
        <Spinner />
      </div>
    </div>
  );
}

function AuthScreen({ onLogin, onRegister }: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🔒</div>
        <h1 style={{ color: "#fff", fontSize: 34, fontWeight: 800, margin: 0 }}>Confi</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 10, fontSize: 15, maxWidth: 280 }}>
          Real identity. Real confidentiality. Every message protected by NDA.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={onRegister} style={btnStylePrimary}>
          Create Account
        </button>
        <button onClick={onLogin} style={btnStyleSecondary}>
          Sign In
        </button>
      </div>

      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 36, textAlign: "center", maxWidth: 300 }}>
        Anonymous accounts are not permitted. A verified identity is required for legal NDA enforcement.
      </p>
    </div>
  );
}

function LoginScreen({ onBack, onSuccess }: {
  onBack: () => void;
  onSuccess: (session: Session) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email || !password) { setError("Enter your email and password."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Login failed."); setLoading(false); return; }

      // Restore profile from localStorage if present
      const storedProfile = localStorage.getItem(`confi_profile_${email}`);
      let user: User;
      if (storedProfile) {
        user = JSON.parse(storedProfile);
      } else {
        user = {
          email: data.email,
          displayName: data.email.split("@")[0],
          phone: "",
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          emailVerified: true,
          phoneVerified: false,
          identityToken: "",
          createdAt: new Date().toISOString(),
        };
      }

      const session: Session = {
        user,
        token: generateToken(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      saveSession(session);
      onSuccess(session);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <ScreenShell onBack={onBack} title="Sign In">
      <p style={subtitleStyle}>Welcome back to Confi</p>

      <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
      <InputField label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" />

      {error && <ErrorBox>{error}</ErrorBox>}

      <button onClick={handleLogin} disabled={loading} style={{ ...btnStylePrimary, marginTop: 8 }}>
        {loading ? <Spinner /> : "Sign In"}
      </button>
    </ScreenShell>
  );
}

function RegisterScreen({ onBack, onNext }: {
  onBack: () => void;
  onNext: (data: { email: string; password: string; phone: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (!email.includes("@")) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    if (!phone.match(/^\+?[1-9]\d{6,14}$/)) return "Enter a valid international phone number (e.g. +1234567890).";
    return null;
  }

  async function handleRegister() {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Registration failed."); setLoading(false); return; }
      onNext({ email: data.email, password, phone });
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <ScreenShell onBack={onBack} title="Create Account">
      <p style={subtitleStyle}>Real identity required for NDA enforcement</p>

      <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
      <InputField label="Phone Number" type="tel" value={phone} onChange={setPhone} placeholder="+1 555 000 0000" />
      <InputField label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
      <InputField label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat password" />

      {error && <ErrorBox>{error}</ErrorBox>}

      <InfoBox>
        📋 Your identity will be cryptographically linked to any NDA you accept. Anonymous accounts are not permitted.
      </InfoBox>

      <button onClick={handleRegister} disabled={loading} style={{ ...btnStylePrimary, marginTop: 8 }}>
        {loading ? <Spinner /> : "Continue →"}
      </button>
    </ScreenShell>
  );
}

function VerifyEmailScreen({ email, onBack, onVerified }: {
  email: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [sentOTP] = useState(() => generateOTP());
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    // Simulate sending OTP — show it in console for demo
    console.log(`[CONFI] Email OTP for ${email}: ${sentOTP}`);
  }, [email, sentOTP]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  function verify() {
    if (entered === sentOTP) {
      onVerified();
    } else {
      setError("Invalid code. Please try again.");
    }
  }

  function resend() {
    setResent(true);
    setCountdown(30);
    console.log(`[CONFI] Resent Email OTP for ${email}: ${sentOTP}`);
    setTimeout(() => setResent(false), 3000);
  }

  return (
    <ScreenShell onBack={onBack} title="Verify Email">
      <p style={subtitleStyle}>We sent a 6-digit code to</p>
      <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: 16, marginBottom: 20, textAlign: "center" }}>
        {email}
      </p>

      <OTPInput value={entered} onChange={setEntered} />

      {error && <ErrorBox>{error}</ErrorBox>}
      {resent && <SuccessBox>Code resent!</SuccessBox>}

      <button onClick={verify} style={{ ...btnStylePrimary, marginTop: 12 }}>
        Verify Email
      </button>

      <button
        onClick={resend}
        disabled={countdown > 0}
        style={{ ...btnStyleGhost, marginTop: 8 }}
      >
        {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
      </button>

      <InfoBox>
        🔍 <strong>Demo mode:</strong> Check the browser console for your OTP code.
      </InfoBox>
    </ScreenShell>
  );
}

function VerifyPhoneScreen({ phone, onBack, onVerified }: {
  phone: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [sentOTP] = useState(() => generateOTP());
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    console.log(`[CONFI] SMS OTP for ${phone}: ${sentOTP}`);
  }, [phone, sentOTP]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  function verify() {
    if (entered === sentOTP) {
      onVerified();
    } else {
      setError("Invalid code. Please try again.");
    }
  }

  return (
    <ScreenShell onBack={onBack} title="Verify Phone">
      <p style={subtitleStyle}>We sent a 6-digit SMS to</p>
      <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: 16, marginBottom: 20, textAlign: "center" }}>
        {phone}
      </p>

      <OTPInput value={entered} onChange={setEntered} />

      {error && <ErrorBox>{error}</ErrorBox>}

      <button onClick={verify} style={{ ...btnStylePrimary, marginTop: 12 }}>
        Verify Phone
      </button>

      <button
        disabled={countdown > 0}
        onClick={() => {
          setCountdown(30);
          console.log(`[CONFI] Resent SMS OTP for ${phone}: ${sentOTP}`);
        }}
        style={{ ...btnStyleGhost, marginTop: 8 }}
      >
        {countdown > 0 ? `Resend in ${countdown}s` : "Resend SMS"}
      </button>

      <InfoBox>
        🔍 <strong>Demo mode:</strong> Check the browser console for your SMS OTP.
      </InfoBox>
    </ScreenShell>
  );
}

function ProfileSetupScreen({ email, phone, onComplete }: {
  email: string;
  phone: string;
  onComplete: (session: Session) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");

  function handleComplete() {
    if (!displayName.trim()) { setError("Please enter your display name."); return; }
    if (displayName.trim().length < 2) { setError("Name must be at least 2 characters."); return; }

    const identityToken = generateIdentityToken(email, phone);

    const user: User = {
      email,
      displayName: displayName.trim(),
      phone,
      avatarColor: selectedColor,
      emailVerified: true,
      phoneVerified: true,
      identityToken,
      createdAt: new Date().toISOString(),
    };

    // Persist profile locally
    localStorage.setItem(`confi_profile_${email}`, JSON.stringify(user));
    // Store identity record separately for future NDA linking
    localStorage.setItem(`confi_identity_${identityToken}`, JSON.stringify({
      identityToken,
      email,
      phone,
      displayName: user.displayName,
      verifiedAt: new Date().toISOString(),
      emailVerified: true,
      phoneVerified: true,
    }));

    const session: Session = {
      user,
      token: generateToken(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    saveSession(session);
    onComplete(session);
  }

  return (
    <ScreenShell title="Set Up Profile">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: selectedColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#fff",
          boxShadow: `0 4px 20px ${selectedColor}66`,
          marginBottom: 16, transition: "background 0.2s",
        }}>
          {displayName ? getInitials(displayName) : "?"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              style={{
                width: 28, height: 28, borderRadius: "50%", background: c, border: "none",
                cursor: "pointer",
                outline: selectedColor === c ? `3px solid #fff` : "none",
                outlineOffset: 2,
                transform: selectedColor === c ? "scale(1.15)" : "scale(1)",
                transition: "all 0.15s",
              }}
            />
          ))}
        </div>
      </div>

      <InputField
        label="Display Name"
        type="text"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Your full name"
      />

      <div style={{
        background: "rgba(108,99,255,0.12)",
        border: "1px solid rgba(108,99,255,0.3)",
        borderRadius: 12, padding: 14, marginTop: 4,
      }}>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          🪪 <strong style={{ color: "#fff" }}>Identity Record Created</strong><br />
          Your email and phone are now verified. A unique identity token has been generated and will be cryptographically linked to any NDA you sign.
        </p>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <button onClick={handleComplete} style={{ ...btnStylePrimary, marginTop: 16 }}>
        Enter Confi →
      </button>
    </ScreenShell>
  );
}

function HomeScreen({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [showProfile, setShowProfile] = useState(false);
  const { user } = session;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.2)",
        backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>Confi</span>
        </div>
        <button
          onClick={() => setShowProfile(!showProfile)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Avatar user={user} size={38} />
        </button>
      </div>

      {/* Profile Panel */}
      {showProfile && (
        <div style={{
          background: "rgba(15,12,41,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: 24,
          animation: "slideDown 0.2s ease",
        }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Avatar user={user} size={64} />
            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#fff", margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
                {user.displayName}
              </h3>
              <p style={{ color: "rgba(255,255,255,0.5)", margin: "0 0 8px", fontSize: 13 }}>
                {user.email}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <VerifiedBadge />
                {user.phoneVerified && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(59,130,246,0.2)", color: "#93C5FD",
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  }}>
                    📱 Phone Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 20, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: 14,
          }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>
              Identity Token
            </p>
            <p style={{ color: "#6C63FF", fontSize: 12, fontFamily: "monospace", margin: 0, wordBreak: "break-all" }}>
              {user.identityToken}
            </p>
          </div>

          <div style={{
            marginTop: 12, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: 14,
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 1 }}>Phone</p>
              <p style={{ color: "#fff", fontSize: 13, margin: 0 }}>{user.phone}</p>
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 1 }}>Member Since</p>
              <p style={{ color: "#fff", fontSize: 13, margin: 0 }}>
                {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          <button onClick={onLogout} style={{ ...btnStyleDanger, marginTop: 16, width: "100%" }}>
            Sign Out
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>
            Welcome, {user.displayName.split(" ")[0]}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.6, margin: "0 0 28px" }}>
            Your identity is verified and secured. Messaging and confidential NDA features are coming in the next build.
          </p>

          <div style={{
            background: "rgba(108,99,255,0.12)",
            border: "1px solid rgba(108,99,255,0.3)",
            borderRadius: 16, padding: 20, textAlign: "left",
          }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 12px", fontWeight: 600 }}>
              🔐 Your Verified Identity Record
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <IdentityRow label="Email" value={user.email} verified />
              <IdentityRow label="Phone" value={user.phone} verified />
              <IdentityRow label="Name" value={user.displayName} />
              <IdentityRow
                label="Token"
                value={user.identityToken.substring(0, 20) + "…"}
              />
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 20 }}>
            This identity will be cryptographically bound to every NDA you accept.
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentityRow({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, minWidth: 48 }}>{label}</span>
      <span style={{ color: "#fff", fontSize: 12, fontFamily: "monospace", flex: 1, textAlign: "right" }}>{value}</span>
      {verified && <span style={{ color: "#10B981", fontSize: 12 }}>✓</span>}
    </div>
  );
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function ScreenShell({ children, title, onBack }: {
  children: React.ReactNode;
  title: string;
  onBack?: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0 0 40px",
    }}>
      <div style={{
        width: "100%", padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.7)",
              fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1,
            }}
          >
            ←
          </button>
        )}
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ width: "100%", maxWidth: 400, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, type, value, onChange, placeholder }: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", marginTop: 6,
          background: "rgba(255,255,255,0.07)",
          border: `1.5px solid ${focused ? "#6C63FF" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 10, padding: "12px 14px",
          color: "#fff", fontSize: 15, outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
      />
    </div>
  );
}

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").substring(0, 6))}
        placeholder="000000"
        style={{
          width: 200, textAlign: "center",
          background: "rgba(255,255,255,0.07)",
          border: "1.5px solid rgba(108,99,255,0.4)",
          borderRadius: 12, padding: "14px 16px",
          color: "#fff", fontSize: 28, fontWeight: 700,
          letterSpacing: 10, outline: "none",
          fontFamily: "monospace",
        }}
      />
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 10, padding: "10px 14px",
      color: "#FCA5A5", fontSize: 13,
    }}>
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(16,185,129,0.12)",
      border: "1px solid rgba(16,185,129,0.3)",
      borderRadius: 10, padding: "10px 14px",
      color: "#6EE7B7", fontSize: 13,
    }}>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(245,158,11,0.1)",
      border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 10, padding: "10px 14px",
      color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnStylePrimary: React.CSSProperties = {
  width: "100%", padding: "14px 20px",
  background: "linear-gradient(135deg,#6C63FF,#8B5CF6)",
  border: "none", borderRadius: 12,
  color: "#fff", fontSize: 16, fontWeight: 700,
  cursor: "pointer", outline: "none",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 4px 20px rgba(108,99,255,0.35)",
  transition: "opacity 0.15s",
};

const btnStyleSecondary: React.CSSProperties = {
  width: "100%", padding: "14px 20px",
  background: "rgba(255,255,255,0.08)",
  border: "1.5px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  color: "#fff", fontSize: 16, fontWeight: 600,
  cursor: "pointer", outline: "none",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const btnStyleGhost: React.CSSProperties = {
  width: "100%", padding: "12px 20px",
  background: "none", border: "none",
  color: "rgba(255,255,255,0.5)", fontSize: 14,
  cursor: "pointer", outline: "none",
};

const btnStyleDanger: React.CSSProperties = {
  padding: "12px 20px",
  background: "rgba(239,68,68,0.15)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 10,
  color: "#FCA5A5", fontSize: 14, fontWeight: 600,
  cursor: "pointer", outline: "none",
};

const subtitleStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.5)", fontSize: 14,
  margin: "0 0 8px", textAlign: "center",
};

// ─── Main App ─────────────────────────────────────────────────────────────────

type RegisterData = { email: string; password: string; phone: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [session, setSession] = useState<Session | null>(null);
  const [registerData, setRegisterData] = useState<RegisterData | null>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  const handleSessionRestore = useCallback(() => {
    const existing = loadSession();
    if (existing) {
      setSession(existing);
      setScreen("home");
    } else {
      setScreen("auth");
    }
  }, []);

  function handleLoginSuccess(s: Session) {
    setSession(s);
    setScreen("home");
  }

  function handleRegisterNext(data: RegisterData) {
    setRegisterData(data);
    setScreen("verify-email");
  }

  function handleEmailVerified() {
    setScreen("verify-phone");
  }

  function handlePhoneVerified() {
    setScreen("profile-setup");
  }

  function handleProfileComplete(s: Session) {
    setSession(s);
    setScreen("home");
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setRegisterData(null);
    setScreen("auth");
  }

  if (screen === "splash") return <SplashScreen onDone={handleSessionRestore} />;
  if (screen === "auth") return (
    <AuthScreen
      onLogin={() => setScreen("auth-login")}
      onRegister={() => setScreen("register")}
    />
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (screen === ("auth-login" as any)) return (
    <LoginScreen
      onBack={() => setScreen("auth")}
      onSuccess={handleLoginSuccess}
    />
  );
  if (screen === "register") return (
    <RegisterScreen
      onBack={() => setScreen("auth")}
      onNext={handleRegisterNext}
    />
  );
  if (screen === "verify-email" && registerData) return (
    <VerifyEmailScreen
      email={registerData.email}
      onBack={() => setScreen("register")}
      onVerified={handleEmailVerified}
    />
  );
  if (screen === "verify-phone" && registerData) return (
    <VerifyPhoneScreen
      phone={registerData.phone}
      onBack={() => setScreen("verify-email")}
      onVerified={handlePhoneVerified}
    />
  );
  if (screen === "profile-setup" && registerData) return (
    <ProfileSetupScreen
      email={registerData.email}
      phone={registerData.phone}
      onComplete={handleProfileComplete}
    />
  );
  if (screen === "home" && session) return (
    <HomeScreen session={session} onLogout={handleLogout} />
  );

  return null;
}