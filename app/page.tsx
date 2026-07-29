"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step =
  | "landing"
  | "register"
  | "login"
  | "otp_email"
  | "otp_phone"
  | "profile"
  | "identity"
  | "dashboard";

interface User {
  email: string;
  displayName: string;
  avatar: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityStatus: "unverified" | "pending" | "verified" | "failed";
  idDocumentData?: string;
  selfieData?: string;
  createdAt: string;
}

interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  confidential: boolean;
}

interface Conversation {
  id: string;
  with: string;
  withAvatar: string;
  messages: Message[];
  ndaActive: boolean;
  ndaSignedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  const colors = [
    "#6c63ff",
    "#e91e8c",
    "#00bcd4",
    "#4caf50",
    "#ff9800",
    "#9c27b0",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.35,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function VerifiedBadge({ status }: { status: User["identityStatus"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    unverified: { label: "Unverified", color: "#999", bg: "#f0f0f0" },
    pending: { label: "Pending Review", color: "#f57c00", bg: "#fff3e0" },
    verified: { label: "ID Verified ✓", color: "#2e7d32", bg: "#e8f5e9" },
    failed: { label: "Verification Failed", color: "#c62828", bg: "#ffebee" },
  };
  const s = map[status];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        padding: "2px 8px",
        borderRadius: 99,
        letterSpacing: 0.3,
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Demo contacts ─────────────────────────────────────────────────────────────
const DEMO_CONTACTS = [
  { email: "alice@confi.app", displayName: "Alice Chen", avatar: "" },
  { email: "bob@confi.app", displayName: "Bob Martinez", avatar: "" },
  { email: "carol@confi.app", displayName: "Carol White", avatar: "" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [step, setStep] = useState<Step>("landing");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarData, setAvatarData] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // OTP state
  const [emailOTP, setEmailOTP] = useState("");
  const [phoneOTP, setPhoneOTP] = useState("");
  const [generatedEmailOTP, setGeneratedEmailOTP] = useState("");
  const [generatedPhoneOTP, setGeneratedPhoneOTP] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpResent, setOtpResent] = useState(false);

  // Identity verification state
  const [idDocFile, setIdDocFile] = useState<string>("");
  const [selfieFile, setSelfieFile] = useState<string>("");
  const [idVerifyLoading, setIdVerifyLoading] = useState(false);
  const [idVerifyError, setIdVerifyError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idDocInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const saved = localStorage.getItem("confi_user");
    if (saved) {
      const u = JSON.parse(saved) as User;
      setUser(u);
      const savedConvs = localStorage.getItem("confi_conversations");
      if (savedConvs) setConversations(JSON.parse(savedConvs));
      else initDemoConversations(u.email);
      setStep("dashboard");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv, conversations]);

  function initDemoConversations(userEmail: string) {
    const convs: Conversation[] = DEMO_CONTACTS.map((c) => ({
      id: generateId(),
      with: c.email,
      withAvatar: c.avatar,
      messages: [
        {
          id: generateId(),
          from: c.email,
          text: `Hi! I'm ${c.displayName}. Ready to use Confi securely?`,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          confidential: false,
        },
      ],
      ndaActive: false,
    }));
    setConversations(convs);
    localStorage.setItem("confi_conversations", JSON.stringify(convs));
  }

  function persistUser(u: User) {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
  }

  function persistConversations(convs: Conversation[]) {
    setConversations(convs);
    localStorage.setItem("confi_conversations", JSON.stringify(convs));
  }

  // ── Register ────────────────────────────────────────────────────────────────
  async function handleRegister() {
    setAuthError("");
    if (!email || !password || !confirmPassword || !phone) {
      setAuthError("All fields are required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthError("Invalid email address.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    if (!/^\+?[\d\s\-().]{7,}$/.test(phone)) {
      setAuthError("Enter a valid phone number.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || "Registration failed.");
        return;
      }
      // Generate and "send" email OTP
      const otp = generateOTP();
      setGeneratedEmailOTP(otp);
      setEmailOTP(otp); // In prod this would be sent via email
      // Store partial user
      localStorage.setItem(
        "confi_pending",
        JSON.stringify({ email, phone, password })
      );
      setStep("otp_email");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setAuthError("");
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || "Login failed.");
        return;
      }
      // Check for existing profile
      const existing = localStorage.getItem("confi_user");
      if (existing) {
        const u = JSON.parse(existing) as User;
        if (u.email === data.email) {
          persistUser(u);
          const savedConvs = localStorage.getItem("confi_conversations");
          if (savedConvs) setConversations(JSON.parse(savedConvs));
          else initDemoConversations(u.email);
          setStep("dashboard");
          return;
        }
      }
      // New device – build minimal profile
      const u: User = {
        email: data.email,
        displayName: data.email.split("@")[0],
        avatar: "",
        phone: "",
        emailVerified: true,
        phoneVerified: false,
        identityStatus: "unverified",
        createdAt: new Date().toISOString(),
      };
      persistUser(u);
      initDemoConversations(u.email);
      setStep("dashboard");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // ── OTP Email ────────────────────────────────────────────────────────────────
  function handleVerifyEmailOTP() {
    setOtpError("");
    if (otpInput !== generatedEmailOTP) {
      setOtpError("Incorrect code. Please try again.");
      return;
    }
    const otp = generateOTP();
    setGeneratedPhoneOTP(otp);
    setPhoneOTP(otp);
    setOtpInput("");
    setStep("otp_phone");
  }

  function resendEmailOTP() {
    const otp = generateOTP();
    setGeneratedEmailOTP(otp);
    setEmailOTP(otp);
    setOtpResent(true);
    setTimeout(() => setOtpResent(false), 3000);
  }

  // ── OTP Phone ────────────────────────────────────────────────────────────────
  function handleVerifyPhoneOTP() {
    setOtpError("");
    if (otpInput !== generatedPhoneOTP) {
      setOtpError("Incorrect code. Please try again.");
      return;
    }
    setOtpInput("");
    setStep("profile");
  }

  function resendPhoneOTP() {
    const otp = generateOTP();
    setGeneratedPhoneOTP(otp);
    setPhoneOTP(otp);
    setOtpResent(true);
    setTimeout(() => setOtpResent(false), 3000);
  }

  // ── Profile Setup ─────────────────────────────────────────────────────────────
  function handleProfileSetup() {
    if (!displayName.trim()) {
      setAuthError("Display name is required.");
      return;
    }
    const pending = JSON.parse(localStorage.getItem("confi_pending") || "{}");
    const u: User = {
      email: email || pending.email,
      displayName: displayName.trim(),
      avatar: avatarData,
      phone: phone || pending.phone,
      emailVerified: true,
      phoneVerified: true,
      identityStatus: "unverified",
      createdAt: new Date().toISOString(),
    };
    persistUser(u);
    localStorage.removeItem("confi_pending");
    initDemoConversations(u.email);
    setStep("identity");
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarData(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ── Identity Verification ─────────────────────────────────────────────────────
  function handleIdDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setIdDocFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelfieFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmitIdentity() {
    if (!idDocFile || !selfieFile) {
      setIdVerifyError(
        "Please upload both a government ID and a selfie photo."
      );
      return;
    }
    setIdVerifyLoading(true);
    setIdVerifyError("");
    // Simulate processing delay (in prod: POST to Stripe Identity / Persona)
    await new Promise((r) => setTimeout(r, 2500));
    const u: User = {
      ...user!,
      identityStatus: "pending",
      idDocumentData: idDocFile,
      selfieData: selfieFile,
    };
    persistUser(u);
    setIdVerifyLoading(false);
    // Simulate async approval after 5s
    setTimeout(() => {
      const latest = JSON.parse(
        localStorage.getItem("confi_user") || "{}"
      ) as User;
      const updated: User = { ...latest, identityStatus: "verified" };
      persistUser(updated);
    }, 5000);
    setStep("dashboard");
  }

  function skipIdentity() {
    setStep("dashboard");
  }

  // ── Messaging ─────────────────────────────────────────────────────────────────
  function sendMessage() {
    if (!newMessage.trim() || !activeConv) return;
    const conv = conversations.find((c) => c.id === activeConv);
    if (!conv) return;
    const msg: Message = {
      id: generateId(),
      from: user!.email,
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      confidential: conv.ndaActive,
    };
    const updated = conversations.map((c) =>
      c.id === activeConv ? { ...c, messages: [...c.messages, msg] } : c
    );
    persistConversations(updated);
    setNewMessage("");

    // Simulate reply after 1.5s
    setTimeout(() => {
      const latest = JSON.parse(
        localStorage.getItem("confi_conversations") || "[]"
      ) as Conversation[];
      const reply: Message = {
        id: generateId(),
        from: conv.with,
        text: conv.ndaActive
          ? "📋 (NDA active) Understood. This stays between us."
          : "Got it! Thanks for the message.",
        timestamp: new Date().toISOString(),
        confidential: conv.ndaActive,
      };
      const withReply = latest.map((c) =>
        c.id === activeConv ? { ...c, messages: [...c.messages, reply] } : c
      );
      persistConversations(withReply);
    }, 1500);
  }

  function activateNDA(convId: string) {
    if (user?.identityStatus !== "verified") {
      alert(
        "You must complete identity verification before activating confidential mode."
      );
      return;
    }
    setActiveConv(convId);
    setShowNDAModal(true);
  }

  function confirmNDA() {
    const updated = conversations.map((c) =>
      c.id === activeConv
        ? { ...c, ndaActive: true, ndaSignedAt: new Date().toISOString() }
        : c
    );
    persistConversations(updated);
    // Add system message
    const conv = updated.find((c) => c.id === activeConv)!;
    const sysMsg: Message = {
      id: generateId(),
      from: "system",
      text: `🔒 Confidential Mode activated. This conversation is now covered under an international NDA. All parties agree to strict confidentiality. Signed: ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      confidential: true,
    };
    const withSys = updated.map((c) =>
      c.id === activeConv ? { ...c, messages: [...c.messages, sysMsg] } : c
    );
    persistConversations(withSys);
    setShowNDAModal(false);
  }

  function deactivateNDA(convId: string) {
    const updated = conversations.map((c) =>
      c.id === convId
        ? { ...c, ndaActive: false, ndaSignedAt: undefined }
        : c
    );
    persistConversations(updated);
    const conv = updated.find((c) => c.id === convId)!;
    const sysMsg: Message = {
      id: generateId(),
      from: "system",
      text: `🔓 Confidential Mode deactivated. Previous NDA coverage remains in effect for messages sent during the session.`,
      timestamp: new Date().toISOString(),
      confidential: false,
    };
    const withSys = updated.map((c) =>
      c.id === convId ? { ...c, messages: [...c.messages, sysMsg] } : c
    );
    persistConversations(withSys);
  }

  function logout() {
    localStorage.removeItem("confi_user");
    localStorage.removeItem("confi_conversations");
    localStorage.removeItem("confi_pending");
    setUser(null);
    setConversations([]);
    setActiveConv(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setPhone("");
    setDisplayName("");
    setAvatarData("");
    setStep("landing");
  }

  // ─── Contact name helper ──────────────────────────────────────────────────
  function contactName(email: string): string {
    const found = DEMO_CONTACTS.find((c) => c.email === email);
    return found?.displayName || email.split("@")[0];
  }

  const currentConv = conversations.find((c) => c.id === activeConv) ?? null;

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  // ─── Landing ─────────────────────────────────────────────────────────────────
  if (step === "landing") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={styles.logo}>🔐</div>
            <h1 style={styles.appName}>Confi</h1>
            <p style={styles.tagline}>
              Secure messaging with legally-binding NDA protection
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button style={styles.btnPrimary} onClick={() => setStep("register")}>
              Create Account
            </button>
            <button style={styles.btnSecondary} onClick={() => setStep("login")}>
              Sign In
            </button>
          </div>
          <div style={styles.featureList}>
            {[
              "✅ End-to-end encrypted messaging",
              "📋 International NDA activation",
              "🪪 Government ID verification",
              "⚖️ Legally attributable signatures",
            ].map((f) => (
              <div key={f} style={styles.featureItem}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Register ────────────────────────────────────────────────────────────────
  if (step === "register") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <h2 style={styles.formTitle}>Create Account</h2>
          <p style={styles.formSubtitle}>
            Join Confi — your identity will be verified for NDA features.
          </p>
          {authError && <div style={styles.errorBox}>{authError}</div>}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
          </div>
          <button
            style={{ ...styles.btnPrimary, opacity: authLoading ? 0.7 : 1 }}
            onClick={handleRegister}
            disabled={authLoading}
          >
            {authLoading ? "Creating account…" : "Continue"}
          </button>
          <button
            style={styles.btnLink}
            onClick={() => {
              setStep("login");
              setAuthError("");
            }}
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    );
  }

  // ─── Login ────────────────────────────────────────────────────────────────────
  if (step === "login") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <h2 style={styles.formTitle}>Welcome back</h2>
          <p style={styles.formSubtitle}>Sign in to your Confi account</p>
          {authError && <div style={styles.errorBox}>{authError}</div>}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <button
            style={{ ...styles.btnPrimary, opacity: authLoading ? 0.7 : 1 }}
            onClick={handleLogin}
            disabled={authLoading}
          >
            {authLoading ? "Signing in…" : "Sign In"}
          </button>
          <button
            style={styles.btnLink}
            onClick={() => {
              setStep("register");
              setAuthError("");
            }}
          >
            No account? Create one
          </button>
        </div>
      </div>
    );
  }

  // ─── OTP Email ────────────────────────────────────────────────────────────────
  if (step === "otp_email") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📧</div>
            <h2 style={styles.formTitle}>Verify your email</h2>
            <p style={styles.formSubtitle}>
              We sent a 6-digit code to{" "}
              <strong>{email}</strong>
            </p>
          </div>
          <div
            style={{
              background: "#e8f5e9",
              border: "1px solid #a5d6a7",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              color: "#2e7d32",
              textAlign: "center",
            }}
          >
            Demo mode — your OTP is: <strong>{generatedEmailOTP}</strong>
          </div>
          {otpError && <div style={styles.errorBox}>{otpError}</div>}
          {otpResent && (
            <div style={{ ...styles.errorBox, background: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9" }}>
              A new code has been sent!
            </div>
          )}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Enter 6-digit code</label>
            <input
              style={{ ...styles.input, letterSpacing: 8, fontSize: 24, textAlign: "center" }}
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyEmailOTP()}
            />
          </div>
          <button style={styles.btnPrimary} onClick={handleVerifyEmailOTP}>
            Verify Email
          </button>
          <button style={styles.btnLink} onClick={resendEmailOTP}>
            Resend code
          </button>
          <button style={styles.btnLink} onClick={() => setStep("register")}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ─── OTP Phone ────────────────────────────────────────────────────────────────
  if (step === "otp_phone") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📱</div>
            <h2 style={styles.formTitle}>Verify your phone</h2>
            <p style={styles.formSubtitle}>
              We sent a code to <strong>{phone}</strong>
            </p>
          </div>
          <div
            style={{
              background: "#e8f5e9",
              border: "1px solid #a5d6a7",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              color: "#2e7d32",
              textAlign: "center",
            }}
          >
            Demo mode — your OTP is: <strong>{generatedPhoneOTP}</strong>
          </div>
          {otpError && <div style={styles.errorBox}>{otpError}</div>}
          {otpResent && (
            <div style={{ ...styles.errorBox, background: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9" }}>
              A new code has been sent!
            </div>
          )}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Enter 6-digit code</label>
            <input
              style={{ ...styles.input, letterSpacing: 8, fontSize: 24, textAlign: "center" }}
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPhoneOTP()}
            />
          </div>
          <button style={styles.btnPrimary} onClick={handleVerifyPhoneOTP}>
            Verify Phone
          </button>
          <button style={styles.btnLink} onClick={resendPhoneOTP}>
            Resend code
          </button>
        </div>
      </div>
    );
  }

  // ─── Profile Setup ────────────────────────────────────────────────────────────
  if (step === "profile") {
    return (
      <div style={styles.centered}>
        <div style={styles.card}>
          <h2 style={styles.formTitle}>Set up your profile</h2>
          <p style={styles.formSubtitle}>
            This name and photo will appear in conversations.
          </p>
          {authError && <div style={styles.errorBox}>{authError}</div>}

          {/* Avatar picker */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => avatarInputRef.current?.click()}>
              {avatarData ? (
                <img
                  src={avatarData}
                  alt="avatar"
                  style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover", border: "3px solid #6c63ff" }}
                />
              ) : (
                <div
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    border: "3px dashed #ccc",
                  }}
                >
                  📷
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  background: "#6c63ff",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                +
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: -16, marginBottom: 16 }}>
            Tap to upload profile photo
          </p>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Display Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Your full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleProfileSetup()}
            />
          </div>
          <button style={styles.btnPrimary} onClick={handleProfileSetup}>
            Continue to Identity Verification
          </button>
        </div>
      </div>
    );
  }

  // ─── Identity Verification ────────────────────────────────────────────────────
  if (step === "identity") {
    return (
      <div style={styles.centered}>
        <div style={{ ...styles.card, maxWidth: 500 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48 }}>🪪</div>
            <h2 style={styles.formTitle}>Identity Verification</h2>
            <p style={styles.formSubtitle}>
              To legally sign NDAs, we must verify your real-world identity.
              Your documents are processed securely and never shared.
            </p>
          </div>

          <div style={styles.idvInfoBox}>
            <strong>Why is this required?</strong>
            <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
              NDA signatures must be legally attributable to a verified
              individual. We use the same process as Stripe Identity / Persona
              to confirm your government ID matches your selfie. Verified status
              is stored on your account and required to activate confidential
              mode.
            </p>
          </div>

          {idVerifyError && <div style={styles.errorBox}>{idVerifyError}</div>}

          {/* Government ID upload */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              📄 Government-Issued ID{" "}
              <span style={{ color: "#999", fontWeight: 400 }}>
                (passport, driver&apos;s license, national ID)
              </span>
            </label>
            <div
              style={styles.uploadBox}
              onClick={() => idDocInputRef.current?.click()}
            >
              {idDocFile ? (
                <img
                  src={idDocFile}
                  alt="ID"
                  style={{ maxHeight: 120, borderRadius: 6 }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 32 }}>📁</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
                    Click to upload front of ID
                  </div>
                </>
              )}
            </div>
            <input
              ref={idDocInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleIdDocChange}
            />
          </div>

          {/* Selfie upload */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>🤳 Selfie Photo</label>
            <div
              style={styles.uploadBox}
              onClick={() => selfieInputRef.current?.click()}
            >
              {selfieFile ? (
                <img
                  src={selfieFile}
                  alt="Selfie"
                  style={{ maxHeight: 120, borderRadius: 6, borderRadius: "50%" }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 32 }}>🤳</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
                    Click to upload a clear selfie
                  </div>
                </>
              )}
            </div>
            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleSelfieChange}
            />
          </div>

          <div style={styles.idvStepsBox}>
            <div style={styles.idvStep}>
              <span style={styles.idvStepNum}>1</span>
              Document liveness & authenticity check
            </div>
            <div style={styles.idvStep}>
              <span style={styles.idvStepNum}>2</span>
              Biometric face match
            </div>
            <div style={styles.idvStep}>
              <span style={styles.idvStepNum}>3</span>
              Name & DOB extraction
            </div>
            <div style={styles.idvStep}>
              <span style={styles.idvStepNum}>4</span>
              Verified status stored on account
            </div>
          </div>

          <button
            style={{ ...styles.btnPrimary, opacity: idVerifyLoading ? 0.7 : 1 }}
            onClick={handleSubmitIdentity}
            disabled={idVerifyLoading}
          >
            {idVerifyLoading ? "Submitting for review…" : "Submit for Verification"}
          </button>
          <button style={styles.btnLink} onClick={skipIdentity}>
            Skip for now (NDA features will be locked)
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard / Messenger ────────────────────────────────────────────────────
  if (step === "dashboard" && user) {
    return (
      <div style={styles.appShell}>
        {/* NDA Modal */}
        {showNDAModal && currentConv && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>
                📋
              </div>
              <h3 style={{ margin: "0 0 12px", textAlign: "center" }}>
                Activate Confidential Mode
              </h3>
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
                By activating Confidential Mode, you and{" "}
                <strong>{contactName(currentConv.with)}</strong> agree to be
                bound by an international Non-Disclosure Agreement (NDA)
                covering all messages in this conversation from this point
                forward.
              </p>
              <div style={styles.ndaTermsBox}>
                <strong>Key Terms:</strong>
                <ul style={{ paddingLeft: 18, margin: "8px 0 0", lineHeight: 1.7, fontSize: 13 }}>
                  <li>All shared information is strictly confidential</li>
                  <li>No disclosure to third parties without written consent</li>
                  <li>Governed by international commercial law</li>
                  <li>Breach subject to legal remedies and damages</li>
                  <li>
                    Signatures legally attributable via verified identity (ID:{" "}
                    {user.identityStatus === "verified" ? "✅ Verified" : "❌ Unverified"})
                  </li>
                </ul>
              </div>
              <p style={{ fontSize: 11, color: "#999", marginBottom: 16 }}>
                This agreement is digitally signed and timestamped. Your
                verified identity makes this legally binding.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={{ ...styles.btnSecondary, flex: 1 }}
                  onClick={() => setShowNDAModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.btnPrimary, flex: 1 }}
                  onClick={confirmNDA}
                >
                  I Agree & Sign NDA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <div
          style={{
            ...styles.sidebar,
            display: sidebarOpen ? "flex" : "none",
          }}
        >
          {/* User header */}
          <div style={styles.sidebarHeader}>
            <Avatar src={user.avatar} name={user.displayName} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.displayName}
              </div>
              <VerifiedBadge status={user.identityStatus} />
            </div>
            <button
              style={styles.iconBtn}
              onClick={logout}
              title="Sign out"
            >
              🚪
            </button>
          </div>

          {/* Identity verification prompt */}
          {user.identityStatus !== "verified" && (
            <div
              style={styles.idvBanner}
              onClick={() => setStep("identity")}
            >
              {user.identityStatus === "pending" ? (
                <>⏳ Identity verification in progress — NDA features unlock soon</>
              ) : (
                <>🪪 Verify your identity to unlock NDA features →</>
              )}
            </div>
          )}

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const name = contactName(conv.with);
              return (
                <div
                  key={conv.id}
                  style={{
                    ...styles.convItem,
                    background:
                      activeConv === conv.id ? "#f0eeff" : "transparent",
                    borderLeft:
                      activeConv === conv.id
                        ? "3px solid #6c63ff"
                        : "3px solid transparent",
                  }}
                  onClick={() => {
                    setActiveConv(conv.id);
                    if (window.innerWidth < 700) setSidebarOpen(false);
                  }}
                >
                  <Avatar src={conv.withAvatar} name={name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                      {conv.ndaActive && (
                        <span style={styles.ndaBadge}>🔒 NDA</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#888",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 2,
                      }}
                    >
                      {lastMsg
                        ? lastMsg.from === user.email
                          ? `You: ${lastMsg.text}`
                          : lastMsg.text
                        : "Start a conversation"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Profile settings link */}
          <div
            style={styles.sidebarFooter}
            onClick={() => setStep("profile")}
          >
            ⚙️ Edit Profile
          </div>
        </div>

        {/* Chat area */}
        <div style={styles.chatArea}>
          {!activeConv ? (
            <div style={styles.emptyChat}>
              <div style={{ fontSize: 64 }}>💬</div>
              <h2>Welcome to Confi</h2>
              <p style={{ color: "#888", maxWidth: 320, textAlign: "center" }}>
                Select a conversation to start messaging securely. Activate
                Confidential Mode to cover the conversation under NDA.
              </p>
              {user.identityStatus !== "verified" && (
                <button
                  style={{ ...styles.btnPrimary, marginTop: 16 }}
                  onClick={() => setStep("identity")}
                >
                  Complete Identity Verification
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={styles.chatHeader}>
                <button
                  style={{ ...styles.iconBtn, marginRight: 8 }}
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
                <Avatar
                  src={currentConv?.withAvatar}
                  name={contactName(currentConv?.with ?? "")}
                  size={36}
                />
                <div style={{ flex: 1, marginLeft: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {contactName(currentConv?.with ?? "")}
                  </div>
                  {currentConv?.ndaActive && (
                    <div style={{ fontSize: 11, color: "#6c63ff" }}>
                      🔒 Confidential Mode — NDA Active since{" "}
                      {currentConv.ndaSignedAt
                        ? new Date(currentConv.ndaSignedAt).toLocaleString()
                        : ""}
                    </div>
                  )}
                </div>
                {currentConv?.ndaActive ? (
                  <button
                    style={styles.ndaOffBtn}
                    onClick={() => deactivateNDA(currentConv!.id)}
                  >
                    🔓 Deactivate NDA
                  </button>
                ) : (
                  <button
                    style={styles.ndaOnBtn}
                    onClick={() => activateNDA(currentConv!.id)}
                    title={
                      user.identityStatus !== "verified"
                        ? "Verify your identity first"
                        : "Activate confidential NDA mode"
                    }
                  >
                    🔒 Activate NDA
                  </button>
                )}
              </div>

              {/* Messages */}
              <div style={styles.messages}>
                {currentConv?.messages.map((msg) => {
                  if (msg.from === "system") {
                    return (
                      <div key={msg.id} style={styles.systemMsg}>
                        {msg.text}
                      </div>
                    );
                  }
                  const isMe = msg.from === user.email;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                        marginBottom: 8,
                        gap: 8,
                        alignItems: "flex-end",
                      }}
                    >
                      {!isMe && (
                        <Avatar
                          src={currentConv?.withAvatar}
                          name={contactName(msg.from)}
                          size={28}
                        />
                      )}
                      <div>
                        <div
                          style={{
                            ...styles.bubble,
                            background: isMe
                              ? msg.confidential
                                ? "#4527a0"
                                : "#6c63ff"
                              : msg.confidential
                              ? "#f3e5f5"
                              : "#f0f0f0",
                            color: isMe ? "#fff" : "#222",
                            borderRadius: isMe
                              ? "18px 18px 4px 18px"
                              : "18px 18px 18px 4px",
                          }}
                        >
                          {msg.confidential && (
                            <span style={{ fontSize: 10, opacity: 0.7, display: "block", marginBottom: 2 }}>
                              🔒 NDA protected
                            </span>
                          )}
                          {msg.text}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#bbb",
                            marginTop: 2,
                            textAlign: isMe ? "right" : "left",
                          }}
                        >
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                      {isMe && (
                        <Avatar src={user.avatar} name={user.displayName} size={28} />
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                style={{
                  ...styles.inputRow,
                  background: currentConv?.ndaActive ? "#f3e5f5" : "#fff",
                  borderTop: currentConv?.ndaActive
                    ? "2px solid #9c27b0"
                    : "1px solid #eee",
                }}
              >
                {currentConv?.ndaActive && (
                  <span style={{ fontSize: 16 }}>🔒</span>
                )}
                <input
                  style={styles.msgInput}
                  type="text"
                  placeholder={
                    currentConv?.ndaActive
                      ? "Type a confidential message…"
                      : "Type a message…"
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    background: currentConv?.ndaActive ? "#9c27b0" : "#6c63ff",
                  }}
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  centered: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  appName: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    background: "linear-gradient(135deg, #6c63ff, #e91e8c)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  tagline: {
    margin: "8px 0 0",
    color: "#666",
    fontSize: 14,
    lineHeight: 1.5,
  },
  formTitle: {
    margin: "0 0 6px",
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  formSubtitle: {
    margin: "0 0 20px",
    fontSize: 13,
    color: "#777",
    lineHeight: 1.5,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#444",
  },
  input: {
    border: "1.5px solid #e0e0e0",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
    color: "#1a1a2e",
    background: "#fafafa",
    width: "100%",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6c63ff, #9c27b0)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    marginBottom: 10,
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    background: "#f0f0f0",
    color: "#444",
    border: "none",
    borderRadius: 10,
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    marginBottom: 10,
  },
  btnLink: {
    background: "none",
    border: "none",
    color: "#6c63ff",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 0",
    textDecoration: "underline",
    textAlign: "center" as const,
    width: "100%",
  },
  errorBox: {
    background: "#ffebee",
    border: "1px solid #ef9a9a",
    color: "#c62828",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  featureList: {
    marginTop: 24,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  featureItem: {
    fontSize: 13,
    color: "#555",
    padding: "8px 12px",
    background: "#f8f8ff",
    borderRadius: 8,
  },
  uploadBox: {
    border: "2px dashed #ccc",
    borderRadius: 10,
    padding: 20,
    textAlign: "center",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    background: "#fafafa",
    transition: "border-color 0.2s",
  },
  idvInfoBox: {
    background: "#e8eaf6",
    border: "1px solid #c5cae9",
    borderRadius: 10,
    padding: 14,
    fontSize: 13,
    color: "#3949ab",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  idvStepsBox: {
    background: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  idvStep: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#444",
  },
  idvStepNum: {
    background: "#6c63ff",
    color: "#fff",
    borderRadius: "50%",
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  // App shell
  appShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "#f5f5f5",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  sidebar: {
    width: 320,
    minWidth: 280,
    background: "#fff",
    borderRight: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100vh",
    overflowY: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 14px",
    borderBottom: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  sidebarFooter: {
    padding: "12px 16px",
    borderTop: "1px solid #f0f0f0",
    fontSize: 13,
    color: "#888",
    cursor: "pointer",
    textAlign: "center",
  },
  iconBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
    lineHeight: 1,
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    cursor: "pointer",
    transition: "background 0.15s",
    borderBottom: "1px solid #f8f8f8",
  },
  ndaBadge: {
    fontSize: 10,
    background: "#f3e5f5",
    color: "#7b1fa2",
    padding: "2px 6px",
    borderRadius: 99,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  idvBanner: {
    background: "linear-gradient(135deg, #fff3e0, #fce4ec)",
    padding: "10px 14px",
    fontSize: 12,
    color: "#e65100",
    cursor: "pointer",
    borderBottom: "1px solid #ffcc80",
    fontWeight: 500,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    background: "#fff",
    borderBottom: "1px solid #eee",
    gap: 8,
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  bubble: {
    maxWidth: 300,
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  systemMsg: {
    background: "#fff8e1",
    border: "1px solid #ffe082",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    color: "#f57f17",
    textAlign: "center",
    margin: "8px auto",
    maxWidth: 480,
    lineHeight: 1.5,
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    flexShrink: 0,
  },
  msgInput: {
    flex: 1,
    border: "1.5px solid #e0e0e0",
    borderRadius: 24,
    padding: "10px 16px",
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
  },
  sendBtn: {
    border: "none",
    color: "#fff",
    borderRadius: "50%",
    width: 42,
    height: 42,
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#444",
    gap: 8,
  },
  ndaOnBtn: {
    background: "linear-gradient(135deg, #6c63ff, #9c27b0)",
    color: "#fff",
    border: "none",
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ndaOffBtn: {
    background: "#fff",
    color: "#9c27b0",
    border: "2px solid #9c27b0",
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  // NDA Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  ndaTermsBox: {
    background: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    padding: 14,
    fontSize: 13,
    marginBottom: 14,
    color: "#333",
  },
};