"use client";

import { useState, useEffect, useCallback } from "react";

type Step =
  | "landing"
  | "register"
  | "login"
  | "otp-email"
  | "otp-phone"
  | "legal-name"
  | "password"
  | "tos"
  | "dashboard";

interface DeviceMeta {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  timestamp: string;
}

interface IdentityRecord {
  email: string;
  phone: string;
  legalName: string;
  fingerprint: string;
  tosAcceptedAt: string;
  deviceMeta: DeviceMeta;
  sessionToken: string;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  confidential: boolean;
}

interface Conversation {
  id: string;
  participant: string;
  avatar: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaActive: boolean;
  ndaAcceptedAt?: string;
}

// ── tiny crypto helpers (no external deps) ──────────────────────────────────
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now() }));
  const sig = btoa(`sig_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  return `${header}.${body}.${sig}`;
}

function getDeviceMeta(): DeviceMeta {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),
  };
}

// ── seed conversations ────────────────────────────────────────────────────────
const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    participant: "Alexandra Hartwell",
    avatar: "AH",
    messages: [
      {
        id: "m1",
        sender: "Alexandra Hartwell",
        text: "Hey! Did you get a chance to review the merger proposal?",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        confidential: false,
      },
      {
        id: "m2",
        sender: "me",
        text: "Yes, I'm going through it now. Should we enable confidential mode for this?",
        timestamp: new Date(Date.now() - 3500000).toISOString(),
        confidential: false,
      },
    ],
    confidentialMode: false,
    ndaActive: false,
  },
  {
    id: "conv-2",
    participant: "Marcus Trent",
    avatar: "MT",
    messages: [
      {
        id: "m3",
        sender: "Marcus Trent",
        text: "The source code review is under NDA. Enabling confidential mode now.",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        confidential: true,
      },
    ],
    confidentialMode: true,
    ndaActive: true,
    ndaAcceptedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [step, setStep] = useState<Step>("landing");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [emailOTP, setEmailOTP] = useState("");
  const [phoneOTP, setPhoneOTP] = useState("");
  const [inputEmailOTP, setInputEmailOTP] = useState("");
  const [inputPhoneOTP, setInputPhoneOTP] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [identity, setIdentity] = useState<IdentityRecord | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [pendingNDAConvId, setPendingNDAConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [tosChecked, setTosChecked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Track page
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Restore session
  useEffect(() => {
    const stored = localStorage.getItem("confi_identity");
    const token = localStorage.getItem("confi_token");
    if (stored && token) {
      setIdentity(JSON.parse(stored));
      setSessionToken(token);
      setStep("dashboard");
    }
  }, []);

  const clearError = () => setError("");

  // ── Registration ────────────────────────────────────────────────────────────
  const handleRegisterSubmit = useCallback(async () => {
    clearError();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 10)
      return setError("Enter a valid phone number.");
    setLoading(true);
    const otp = generateOTP();
    const phoneOtp = generateOTP();
    setEmailOTP(otp);
    setPhoneOTP(phoneOtp);
    console.info(`[DEV] Email OTP: ${otp}  Phone OTP: ${phoneOtp}`);
    // In production POST to /api/auth to verify email uniqueness first
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password: "temp_otp_placeholder" }),
      });
    } catch {/* non-blocking */}
    setLoading(false);
    setOtpSent(true);
    setStep("otp-email");
  }, [email, phone]);

  const handleVerifyEmailOTP = useCallback(() => {
    clearError();
    if (inputEmailOTP.trim() !== emailOTP)
      return setError("Incorrect email OTP. Please try again.");
    setStep("otp-phone");
  }, [inputEmailOTP, emailOTP]);

  const handleVerifyPhoneOTP = useCallback(() => {
    clearError();
    if (inputPhoneOTP.trim() !== phoneOTP)
      return setError("Incorrect phone OTP. Please try again.");
    setStep("legal-name");
  }, [inputPhoneOTP, phoneOTP]);

  const handleLegalName = useCallback(() => {
    clearError();
    if (!legalFirstName.trim() || !legalLastName.trim())
      return setError("Both first and last legal name are required.");
    if (!/^[A-Za-z\s\-']+$/.test(legalFirstName + legalLastName))
      return setError("Legal names may only contain letters, hyphens, and apostrophes.");
    setStep("password");
  }, [legalFirstName, legalLastName]);

  const handlePasswordSetup = useCallback(() => {
    clearError();
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    if (!/[A-Z]/.test(password)) return setError("Password must include an uppercase letter.");
    if (!/[0-9]/.test(password)) return setError("Password must include a number.");
    if (!/[^A-Za-z0-9]/.test(password)) return setError("Password must include a special character.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setStep("tos");
  }, [password, confirmPassword]);

  const handleTosAccept = useCallback(async () => {
    clearError();
    if (!tosChecked) return setError("You must accept the Terms of Service to continue.");
    setLoading(true);
    const deviceMeta = getDeviceMeta();
    const fingerprintRaw = `${email}::${phone}::${legalFirstName} ${legalLastName}::${password}::${deviceMeta.timestamp}::${deviceMeta.userAgent}`;
    const fingerprint = await sha256(fingerprintRaw);
    const token = generateJWT({ email, fingerprint, legalName: `${legalFirstName} ${legalLastName}` });
    const record: IdentityRecord = {
      email,
      phone,
      legalName: `${legalFirstName} ${legalLastName}`,
      fingerprint,
      tosAcceptedAt: new Date().toISOString(),
      deviceMeta,
      sessionToken: token,
    };
    // Persist to backend
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
    } catch {/* non-blocking */}
    // Persist identity log via track endpoint
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/tos-acceptance",
        fingerprint,
        legalName: record.legalName,
        tosAcceptedAt: record.tosAcceptedAt,
        deviceMeta,
      }),
    }).catch(() => {});
    localStorage.setItem("confi_identity", JSON.stringify(record));
    localStorage.setItem("confi_token", token);
    setIdentity(record);
    setSessionToken(token);
    setLoading(false);
    setStep("dashboard");
  }, [tosChecked, email, phone, legalFirstName, legalLastName, password]);

  // ── Login ───────────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    clearError();
    if (!email.includes("@")) return setError("Enter a valid email.");
    if (!password) return setError("Enter your password.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLoading(false);
        return setError(data.error || "Login failed.");
      }
      const token = generateJWT({ email });
      const stored = localStorage.getItem("confi_identity");
      if (stored) {
        const rec = JSON.parse(stored) as IdentityRecord;
        setIdentity(rec);
      } else {
        const rec: IdentityRecord = {
          email,
          phone: "",
          legalName: data.email,
          fingerprint: await sha256(email + Date.now()),
          tosAcceptedAt: "",
          deviceMeta: getDeviceMeta(),
          sessionToken: token,
        };
        setIdentity(rec);
        localStorage.setItem("confi_identity", JSON.stringify(rec));
      }
      localStorage.setItem("confi_token", token);
      setSessionToken(token);
      setStep("dashboard");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [email, password]);

  // ── Messaging ───────────────────────────────────────────────────────────────
  const activeConversation = conversations.find((c) => c.id === activeConv) ?? null;

  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !activeConv) return;
    const conv = conversations.find((c) => c.id === activeConv);
    if (!conv) return;
    const msg: Message = {
      id: `m-${Date.now()}`,
      sender: "me",
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      confidential: conv.confidentialMode,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv ? { ...c, messages: [...c.messages, msg] } : c
      )
    );
    setNewMessage("");
  }, [newMessage, activeConv, conversations]);

  const toggleConfidentialMode = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    if (!conv.confidentialMode) {
      // Turning ON → trigger NDA modal
      setPendingNDAConvId(convId);
      setShowNDAModal(true);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, confidentialMode: false, ndaActive: false } : c
        )
      );
    }
  }, [conversations]);

  const acceptNDA = useCallback(async () => {
    if (!pendingNDAConvId || !identity) return;
    const now = new Date().toISOString();
    const ndaFingerprint = await sha256(
      `NDA::${identity.fingerprint}::${pendingNDAConvId}::${now}`
    );
    // Log NDA acceptance
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/nda-acceptance",
        conversationId: pendingNDAConvId,
        identityFingerprint: identity.fingerprint,
        ndaFingerprint,
        legalName: identity.legalName,
        acceptedAt: now,
        deviceMeta: getDeviceMeta(),
      }),
    }).catch(() => {});
    setConversations((prev) =>
      prev.map((c) =>
        c.id === pendingNDAConvId
          ? { ...c, confidentialMode: true, ndaActive: true, ndaAcceptedAt: now }
          : c
      )
    );
    setShowNDAModal(false);
    setPendingNDAConvId(null);
  }, [pendingNDAConvId, identity]);

  const logout = useCallback(() => {
    localStorage.removeItem("confi_identity");
    localStorage.removeItem("confi_token");
    setIdentity(null);
    setSessionToken(null);
    setStep("landing");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPhone("");
    setLegalFirstName("");
    setLegalLastName("");
    setActiveConv(null);
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────────────
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString();

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      {/* ── LANDING ── */}
      {step === "landing" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <p style={S.tagline}>Encrypted messaging with legally-binding confidentiality.</p>
            <button style={S.btnPrimary} onClick={() => setStep("register")}>
              Create Account
            </button>
            <button style={{ ...S.btnSecondary, marginTop: 12 }} onClick={() => setStep("login")}>
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* ── REGISTER ── */}
      {step === "register" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <button style={S.backBtn} onClick={() => setStep("landing")}>← Back</button>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Create your account</h2>
            <p style={S.stepSub}>Step 1 of 5 — Contact Details</p>
            <label style={S.label}>Email Address</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label style={S.label}>Phone Number</label>
            <input
              style={S.input}
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleRegisterSubmit} disabled={loading}>
              {loading ? "Sending OTP…" : "Send Verification Codes"}
            </button>
            <p style={S.hint}>
              We'll send a 6-digit OTP to both your email and phone.
            </p>
          </div>
        </div>
      )}

      {/* ── OTP EMAIL ── */}
      {step === "otp-email" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Verify your email</h2>
            <p style={S.stepSub}>Step 2 of 5 — Email OTP</p>
            <div style={S.otpInfo}>
              <span style={S.otpInfoIcon}>📧</span>
              <span>OTP sent to <strong>{email}</strong></span>
            </div>
            {otpSent && (
              <div style={S.devHint}>
                🛠 Dev mode — check browser console for OTP
              </div>
            )}
            <label style={S.label}>Enter 6-digit OTP</label>
            <input
              style={{ ...S.input, letterSpacing: "0.3em", textAlign: "center", fontSize: 22 }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              value={inputEmailOTP}
              onChange={(e) => setInputEmailOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleVerifyEmailOTP}>
              Verify Email
            </button>
            <button style={S.btnLink} onClick={() => { const o = generateOTP(); setEmailOTP(o); console.info(`[DEV] New Email OTP: ${o}`); }}>
              Resend OTP
            </button>
          </div>
        </div>
      )}

      {/* ── OTP PHONE ── */}
      {step === "otp-phone" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Verify your phone</h2>
            <p style={S.stepSub}>Step 3 of 5 — Phone OTP</p>
            <div style={S.otpInfo}>
              <span style={S.otpInfoIcon}>📱</span>
              <span>OTP sent to <strong>{phone}</strong></span>
            </div>
            <div style={S.devHint}>
              🛠 Dev mode — check browser console for OTP
            </div>
            <label style={S.label}>Enter 6-digit OTP</label>
            <input
              style={{ ...S.input, letterSpacing: "0.3em", textAlign: "center", fontSize: 22 }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              value={inputPhoneOTP}
              onChange={(e) => setInputPhoneOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleVerifyPhoneOTP}>
              Verify Phone
            </button>
            <button style={S.btnLink} onClick={() => { const o = generateOTP(); setPhoneOTP(o); console.info(`[DEV] New Phone OTP: ${o}`); }}>
              Resend OTP
            </button>
          </div>
        </div>
      )}

      {/* ── LEGAL NAME ── */}
      {step === "legal-name" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Your legal name</h2>
            <p style={S.stepSub}>Step 4 of 5 — Identity Verification</p>
            <div style={S.infoBox}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                Your legal name is required to anchor your identity to any NDA agreements
                you enter via Confi. This must match your government-issued ID.
              </p>
            </div>
            <label style={S.label}>Legal First Name</label>
            <input
              style={S.input}
              type="text"
              placeholder="e.g. Jonathan"
              value={legalFirstName}
              onChange={(e) => setLegalFirstName(e.target.value)}
              autoComplete="given-name"
            />
            <label style={S.label}>Legal Last Name</label>
            <input
              style={S.input}
              type="text"
              placeholder="e.g. Smith"
              value={legalLastName}
              onChange={(e) => setLegalLastName(e.target.value)}
              autoComplete="family-name"
            />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleLegalName}>
              Confirm Legal Name
            </button>
          </div>
        </div>
      )}

      {/* ── PASSWORD ── */}
      {step === "password" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Secure your account</h2>
            <p style={S.stepSub}>Step 5 of 5 — Password Setup</p>
            <label style={S.label}>Create Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="Min 10 chars, A-Z, 0-9, special"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label style={S.label}>Confirm Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <PasswordStrength password={password} />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handlePasswordSetup}>
              Set Password
            </button>
          </div>
        </div>
      )}

      {/* ── TOS ── */}
      {step === "tos" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Terms of Service</h2>
            <p style={S.stepSub}>Review & Accept — Final Step</p>
            <div style={S.tosScroll}>
              <TOSText legalName={`${legalFirstName} ${legalLastName}`} email={email} />
            </div>
            <div style={S.checkRow}>
              <input
                id="tos"
                type="checkbox"
                checked={tosChecked}
                onChange={(e) => setTosChecked(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="tos" style={{ cursor: "pointer", fontSize: 14 }}>
                I, <strong>{legalFirstName} {legalLastName}</strong>, accept the Terms of Service
                and understand that my acceptance is cryptographically timestamped and legally binding.
              </label>
            </div>
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleTosAccept} disabled={loading}>
              {loading ? "Finalizing Identity…" : "Accept & Create Account"}
            </button>
          </div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {step === "login" && (
        <div style={S.authShell}>
          <div style={S.authCard}>
            <button style={S.backBtn} onClick={() => setStep("landing")}>← Back</button>
            <div style={S.logo}>🔒 Confi</div>
            <h2 style={S.stepTitle}>Welcome back</h2>
            <label style={S.label}>Email Address</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p style={S.error}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <p style={S.hint}>
              No account?{" "}
              <button style={S.btnLink} onClick={() => { clearError(); setStep("register"); }}>
                Create one
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {step === "dashboard" && identity && (
        <div style={S.appShell}>
          {/* Sidebar */}
          <aside style={{ ...S.sidebar, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)" }}>
            <div style={S.sidebarHeader}>
              <span style={S.sidebarLogo}>🔒 Confi</span>
              <button
                style={S.iconBtn}
                title="Hide sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            </div>
            {/* Identity badge */}
            <div style={S.identityBadge}>
              <div style={S.avatarLg}>
                {identity.legalName ? identity.legalName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "??"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{identity.legalName || identity.email}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{identity.email}</div>
                <div style={S.verifiedBadge}>✓ Verified Identity</div>
              </div>
            </div>
            {/* Conversations */}
            <div style={S.convList}>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  style={{ ...S.convItem, ...(activeConv === conv.id ? S.convItemActive : {}) }}
                  onClick={() => { setActiveConv(conv.id); if (window.innerWidth < 640) setSidebarOpen(false); }}
                >
                  <div style={S.avatar}>{conv.avatar}</div>
                  <div style={S.convMeta}>
                    <div style={S.convName}>
                      {conv.participant}
                      {conv.ndaActive && <span style={S.ndaBadge}>NDA</span>}
                    </div>
                    <div style={S.convPreview}>
                      {conv.messages.at(-1)?.text.slice(0, 40)}…
                    </div>
                  </div>
                  {conv.confidentialMode && <span style={S.lockIcon}>🔒</span>}
                </button>
              ))}
            </div>
            <button style={S.logoutBtn} onClick={logout}>Sign Out</button>
          </aside>

          {/* Main chat area */}
          <main style={S.main}>
            {/* Top bar */}
            <header style={S.topBar}>
              {!sidebarOpen && (
                <button style={S.iconBtn} onClick={() => setSidebarOpen(true)}>☰</button>
              )}
              {activeConversation ? (
                <>
                  <div style={S.avatar}>{activeConversation.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{activeConversation.participant}</div>
                    {activeConversation.ndaActive && (
                      <div style={{ fontSize: 11, color: "#059669" }}>
                        🔒 NDA Active · Accepted {formatDate(activeConversation.ndaAcceptedAt!)}
                      </div>
                    )}
                  </div>
                  <ConfidentialToggle
                    active={activeConversation.confidentialMode}
                    onToggle={() => toggleConfidentialMode(activeConversation.id)}
                  />
                </>
              ) : (
                <span style={{ color: "#9ca3af", fontSize: 15 }}>Select a conversation</span>
              )}
            </header>

            {/* Messages */}
            <div style={S.messageArea}>
              {!activeConversation && (
                <div style={S.emptyState}>
                  <div style={{ fontSize: 48 }}>🔒</div>
                  <p>Select a conversation to start messaging.</p>
                  <p style={{ fontSize: 13, color: "#9ca3af" }}>
                    Enable Confidential Mode on any chat to activate an international NDA.
                  </p>
                </div>
              )}
              {activeConversation?.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{ ...S.messageBubbleWrap, justifyContent: msg.sender === "me" ? "flex-end" : "flex-start" }}
                >
                  <div
                    style={{
                      ...S.messageBubble,
                      ...(msg.sender === "me" ? S.bubbleMe : S.bubbleThem),
                      ...(msg.confidential ? S.bubbleConfidential : {}),
                    }}
                  >
                    {msg.confidential && <span style={S.confLabel}>🔒 Confidential</span>}
                    <p style={{ margin: 0 }}>{msg.text}</p>
                    <span style={S.msgTime}>{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Input area */}
            {activeConversation && (
              <div style={S.inputArea}>
                {activeConversation.confidentialMode && (
                  <div style={S.confBanner}>
                    🔒 Confidential Mode — this conversation is protected by an international NDA
                  </div>
                )}
                <div style={S.inputRow}>
                  <input
                    style={S.msgInput}
                    type="text"
                    placeholder={
                      activeConversation.confidentialMode
                        ? "Send confidential message…"
                        : "Type a message…"
                    }
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <button style={S.sendBtn} onClick={sendMessage}>
                    ➤
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── NDA MODAL ── */}
      {showNDAModal && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={{ fontSize: 32, textAlign: "center" }}>🔒</div>
            <h2 style={S.modalTitle}>Activate Confidential Mode</h2>
            <p style={S.modalSub}>
              By activating Confidential Mode, you and the other participant agree to be bound by
              an <strong>International Non-Disclosure Agreement (NDA)</strong> covering all messages
              sent while this mode is active.
            </p>
            <div style={S.ndaBox}>
              <NDAText identity={identity} conversationId={pendingNDAConvId} />
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
              Your identity fingerprint <code style={{ fontSize: 10, wordBreak: "break-all" }}>{identity?.fingerprint?.slice(0, 32)}…</code> will
              be cryptographically bound to this NDA acceptance.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button style={S.btnSecondary} onClick={() => { setShowNDAModal(false); setPendingNDAConvId(null); }}>
                Cancel
              </button>
              <button style={S.btnDanger} onClick={acceptNDA}>
                I Accept — Activate NDA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "10+ characters", ok: password.length >= 10 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < score ? colors[score - 1] : "#e5e7eb",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {checks.map((c) => (
          <span
            key={c.label}
            style={{ fontSize: 11, color: c.ok ? "#059669" : "#9ca3af" }}
          >
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfidentialToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 20,
        border: "none",
        cursor: "pointer",
        background: active ? "#064e3b" : "#f3f4f6",
        color: active ? "#d1fae5" : "#374151",
        fontSize: 13,
        fontWeight: 600,
        transition: "all 0.2s",
      }}
    >
      {active ? "🔒" : "🔓"}
      {active ? "Confidential ON" : "Enable Confidential"}
    </button>
  );
}

function TOSText({ legalName, email }: { legalName: string; email: string }) {
  return (
    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
      <strong>CONFI MESSAGING — TERMS OF SERVICE & PRIVACY AGREEMENT</strong>
      <br />Last Updated: {new Date().toLocaleDateString()}
      <br /><br />
      <strong>1. PARTIES</strong>
      <br />This agreement is between Confi Technologies Inc. ("Confi") and <strong>{legalName || "the User"}</strong> ({email}) ("User").
      <br /><br />
      <strong>2. IDENTITY VERIFICATION</strong>
      <br />By registering, User confirms their legal name is accurate and matches their government-issued ID. User's verified credentials will be used to anchor legally-binding NDA agreements entered within the platform.
      <br /><br />
      <strong>3. CRYPTOGRAPHIC IDENTITY</strong>
      <br />Upon account creation, a SHA-256 identity fingerprint is generated from User's verified credentials, device metadata, and timestamp. This fingerprint serves as a cryptographic anchor for all NDA agreements User enters on this platform.
      <br /><br />
      <strong>4. CONFIDENTIAL MODE & NDA</strong>
      <br />When User activates Confidential Mode in any conversation, an International Non-Disclosure Agreement automatically comes into effect. This NDA is legally binding in all jurisdictions that recognize electronic agreements, including but not limited to the United States (E-SIGN Act), European Union (eIDAS Regulation), and United Kingdom (Electronic Communications Act 2000).
      <br /><br />
      <strong>5. DATA SECURITY</strong>
      <br />All messages sent in Confidential Mode are treated as confidential information under the applicable NDA. Confi employs industry-standard encryption. User agrees not to screenshot, copy, or redistribute confidential messages.
      <br /><br />
      <strong>6. ACCEPTANCE LOGGING</strong>
      <br />User's acceptance of these Terms is logged with a UTC timestamp, device fingerprint, and IP address. This record constitutes a valid electronic signature under applicable law.
      <br /><br />
      <strong>7. GOVERNING LAW</strong>
      <br />This agreement is governed by the laws of the State of Delaware, USA, without regard to conflict of law provisions.
    </div>
  );
}

function NDAText({ identity, conversationId }: { identity: IdentityRecord | null; conversationId: string | null }) {
  return (
    <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
      <strong>INTERNATIONAL NON-DISCLOSURE AGREEMENT</strong>
      <br />Effective: {new Date().toUTCString()}
      <br /><br />
      <strong>PARTIES:</strong> This NDA is entered into between <strong>{identity?.legalName ?? "User"}</strong> (verified email: {identity?.email ?? "—"}) and all participants in conversation <code>{conversationId ?? "—"}</code>.
      <br /><br />
      <strong>CONFIDENTIAL INFORMATION:</strong> All messages, media, files, and metadata exchanged in this conversation while Confidential Mode is active constitute "Confidential Information" under this Agreement.
      <br /><br />
      <strong>OBLIGATIONS:</strong> Each party agrees to: (i) hold Confidential Information in strict confidence; (ii) not disclose to third parties without prior written consent; (iii) use Confidential Information solely for the purposes of this conversation; (iv) notify the other party immediately upon any unauthorized disclosure.
      <br /><br />
      <strong>TERM:</strong> This NDA remains in effect indefinitely for all Confidential Information exchanged while Confidential Mode was active.
      <br /><br />
      <strong>JURISDICTION:</strong> This NDA is enforceable under U.S. Federal law (E-SIGN Act 15 U.S.C. § 7001), EU eIDAS Regulation (910/2014), UK Electronic Communications Act 2000, and any other applicable jurisdiction recognizing electronic agreements.
      <br /><br />
      <strong>IDENTITY ANCHOR:</strong> Identity Fingerprint: <code style={{ wordBreak: "break-all" }}>{identity?.fingerprint ?? "—"}</code>
      <br /><br />
      <strong>ELECTRONIC SIGNATURE:</strong> By clicking "I Accept", you provide a legally valid electronic signature binding you to this NDA.
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    background: "#f9fafb",
  },
  authShell: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
    padding: 16,
  },
  authCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  tagline: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: "8px 0 2px",
    color: "#111827",
  },
  stepSub: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    background: "#f9fafb",
  },
  btnPrimary: {
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
    width: "100%",
    transition: "background 0.2s",
  },
  btnSecondary: {
    padding: "11px 0",
    borderRadius: 8,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 600,
    fontSize: 15,
    border: "1.5px solid #d1d5db",
    cursor: "pointer",
    flex: 1,
    transition: "background 0.2s",
  },
  btnDanger: {
    padding: "11px 0",
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
    flex: 1,
  },
  btnLink: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 14,
    padding: "8px 0",
    textAlign: "center",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    margin: "6px 0 0",
    padding: "8px 12px",
    background: "#fef2f2",
    borderRadius: 6,
    border: "1px solid #fecaca",
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  otpInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "#f0f9ff",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 8,
    border: "1px solid #bae6fd",
  },
  otpInfoIcon: { fontSize: 20 },
  devHint: {
    padding: "8px 12px",
    background: "#fef9c3",
    borderRadius: 6,
    fontSize: 12,
    color: "#713f12",
    border: "1px solid #fde047",
    marginBottom: 4,
  },
  infoBox: {
    padding: "10px 14px",
    background: "#fef3c7",
    borderRadius: 8,
    border: "1px solid #fcd34d",
    marginBottom: 8,
  },
  tosScroll: {
    maxHeight: 260,
    overflowY: "auto",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    padding: "12px 14px",
    background: "#f9fafb",
    marginBottom: 12,
  },
  checkRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },
  // Dashboard
  appShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "#f9fafb",
  },
  sidebar: {
    width: 300,
    minWidth: 300,
    background: "#ffffff",
    borderRight: "1.5px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.25s",
    position: "relative",
    zIndex: 10,
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px 12px",
    borderBottom: "1.5px solid #e5e7eb",
  },
  sidebarLogo: {
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: "-0.5px",
  },
  identityBadge: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
  },
  avatarLg: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#0f172a",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },
  verifiedBadge: {
    fontSize: 10,
    color: "#059669",
    fontWeight: 700,
    background: "#d1fae5",
    borderRadius: 4,
    padding: "2px 6px",
    marginTop: 2,
    display: "inline-block",
  },
  convList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 0",
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    width: "100%",
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
    transition: "background 0.15s",
  },
  convItemActive: {
    background: "#f0f9ff",
    borderLeft: "3px solid #0f172a",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#e0e7ff",
    color: "#3730a3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  convMeta: { flex: 1, overflow: "hidden" },
  convName: {
    fontWeight: 600,
    fontSize: 14,
    color: "#111827",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  convPreview: {
    fontSize: 12,
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ndaBadge: {
    fontSize: 9,
    fontWeight: 700,
    background: "#065f46",
    color: "#d1fae5",
    borderRadius: 4,
    padding: "1px 5px",
  },
  lockIcon: { fontSize: 14 },
  logoutBtn: {
    margin: "12px",
    padding: "10px",
    borderRadius: 8,
    border: "1.5px solid #fecaca",
    background: "none",
    color: "#dc2626",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    background: "#ffffff",
    borderBottom: "1.5px solid #e5e7eb",
    minHeight: 64,
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    color: "#374151",
    padding: "4px 8px",
    borderRadius: 6,
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    textAlign: "center",
    padding: 40,
    gap: 8,
    height: "100%",
  },
  messageBubbleWrap: {
    display: "flex",
    width: "100%",
  },
  messageBubble: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: 14,
    fontSize: 14,
    lineHeight: 1.5,
    position: "relative",
  },
  bubbleMe: {
    background: "#0f172a",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderBottomLeftRadius: 4,
  },
  bubbleConfidential: {
    background: "#022c22",
    color: "#d1fae5",
    border: "1px solid #065f46",
  },
  confLabel: {
    display: "block",
    fontSize: 10,
    color: "#6ee7b7",
    marginBottom: 4,
    fontWeight: 700,
  },
  msgTime: {
    display: "block",
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
    textAlign: "right",
  },
  inputArea: {
    background: "#ffffff",
    borderTop: "1.5px solid #e5e7eb",
    padding: "12px 16px",
  },
  confBanner: {
    fontSize: 11,
    color: "#065f46",
    background: "#d1fae5",
    borderRadius: 6,
    padding: "6px 12px",
    marginBottom: 8,
    fontWeight: 600,
    border: "1px solid #6ee7b7",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  msgInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 24,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    outline: "none",
    background: "#f9fafb",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#0f172a",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: "28px 24px",
    maxWidth: 520,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
    margin: "8px 0 4px",
  },
  modalSub: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 1.6,
  },
  ndaBox: {
    maxHeight: 240,
    overflowY: "auto",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    padding: "12px 14px",
    background: "#f9fafb",
  },
};