"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "register"
  | "login"
  | "otp"
  | "profile_setup"
  | "home"
  | "chat";

interface User {
  email: string;
  displayName: string;
  avatar: string; // emoji avatar
  phone: string;
  phoneVerified: boolean;
  createdAt: string;
}

interface Message {
  id: string;
  from: string;
  text: string;
  ts: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  with: string;
  withAvatar: string;
  messages: Message[];
  ndaActive: boolean;
  ndaAcceptedAt?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const AVATARS = ["🧑", "👩", "🧔", "👨‍💻", "👩‍💻", "🧑‍🎤", "👩‍🎨", "🧑‍🚀", "👩‍🔬", "🧑‍⚖️"];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv_1",
    with: "Alice Chen",
    withAvatar: "👩‍💻",
    ndaActive: false,
    messages: [
      { id: "m1", from: "Alice Chen", text: "Hey! Are you there?", ts: Date.now() - 3600000, confidential: false },
      { id: "m2", from: "me", text: "Yes, just got in!", ts: Date.now() - 3500000, confidential: false },
    ],
  },
  {
    id: "conv_2",
    with: "Bob Martinez",
    withAvatar: "🧔",
    ndaActive: true,
    ndaAcceptedAt: new Date(Date.now() - 86400000).toISOString(),
    messages: [
      { id: "m3", from: "Bob Martinez", text: "This is under our NDA, right?", ts: Date.now() - 7200000, confidential: true },
      { id: "m4", from: "me", text: "Absolutely. Confidential mode is on.", ts: Date.now() - 7100000, confidential: true },
    ],
  },
];

// ── NDA Text ───────────────────────────────────────────────────────────────────
const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of electronic acceptance by the parties identified by their verified Confi Messaging accounts.

1. CONFIDENTIALITY OBLIGATION
   Each party agrees to hold in strict confidence all information shared within Confidential Mode conversations and not to disclose such information to any third party without prior written consent.

2. SCOPE
   This Agreement covers all messages, files, media, and metadata exchanged while Confidential Mode is active, regardless of jurisdiction.

3. JURISDICTION & GOVERNING LAW
   This Agreement shall be governed by the laws of international commerce and, where applicable, the domestic laws of each party's jurisdiction of residence as verified by their phone number on record.

4. IDENTITY VERIFICATION
   Parties acknowledge that their identity has been verified via phone number and email address registered with Confi Messaging. Electronic acceptance constitutes a legally binding signature under applicable e-signature laws (ESIGN Act, eIDAS Regulation, etc.).

5. DURATION
   Obligations under this Agreement survive termination of the conversation and remain in effect for a period of five (5) years.

6. REMEDIES
   Breach of this Agreement may result in legal action including injunctive relief and monetary damages.

By activating Confidential Mode, you acknowledge that you have read, understood, and agree to be bound by this Agreement.`;

// ── Utilities ──────────────────────────────────────────────────────────────────
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [showNdaToggleModal, setShowNdaToggleModal] = useState(false);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpMode, setOtpMode] = useState<"email" | "phone">("phone");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // chat state
  const [messageInput, setMessageInput] = useState("");
  const [confidentialMode, setConfidentialMode] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const saved = localStorage.getItem("confi_user");
    if (saved) {
      setUser(JSON.parse(saved));
      setScreen("home");
    } else {
      setTimeout(() => setScreen("login"), 1800);
    }

    const savedConvs = localStorage.getItem("confi_conversations");
    if (savedConvs) setConversations(JSON.parse(savedConvs));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  // ── Auth Handlers ────────────────────────────────────────────────────────────
  async function handleRegister() {
    setFormError("");
    if (!email || !password || !phone) {
      setFormError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/\s/g, ""))) {
      setFormError("Enter a valid phone number with country code (e.g. +14155552671).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); setLoading(false); return; }

      // simulate OTP send
      const otp = generateOTP();
      setGeneratedOtp(otp);
      setOtpMode("phone");
      console.info(`[CONFI] Simulated OTP for ${phone}: ${otp}`); // visible in dev console
      setFormSuccess(`OTP sent to ${phone} (check browser console for demo OTP)`);
      setScreen("otp");
    } catch {
      setFormError("Network error. Please try again.");
    }
    setLoading(false);
  }

  async function handleLogin() {
    setFormError("");
    if (!email || !password) { setFormError("Enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); setLoading(false); return; }

      const savedUser = localStorage.getItem("confi_user");
      if (savedUser) {
        const u = JSON.parse(savedUser) as User;
        if (u.email === email) {
          setUser(u);
          setScreen("home");
          setLoading(false);
          return;
        }
      }
      // new login — go to profile setup
      setScreen("profile_setup");
    } catch {
      setFormError("Network error. Please try again.");
    }
    setLoading(false);
  }

  function handleVerifyOtp() {
    setFormError("");
    if (otpInput.trim() === generatedOtp) {
      setFormSuccess("Phone verified! Set up your profile.");
      setScreen("profile_setup");
    } else {
      setFormError("Incorrect OTP. Please try again.");
    }
  }

  function handleResendOtp() {
    const otp = generateOTP();
    setGeneratedOtp(otp);
    setOtpInput("");
    setFormError("");
    console.info(`[CONFI] Resent OTP: ${otp}`);
    setFormSuccess("OTP resent (check browser console).");
  }

  function handleProfileSave() {
    setFormError("");
    if (!displayName.trim()) { setFormError("Display name is required."); return; }
    const newUser: User = {
      email,
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      phone: phone || "",
      phoneVerified: !!generatedOtp,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("confi_user", JSON.stringify(newUser));
    setUser(newUser);
    setScreen("home");
  }

  function handleLogout() {
    localStorage.removeItem("confi_user");
    setUser(null);
    setEmail(""); setPassword(""); setPhone("");
    setDisplayName(""); setGeneratedOtp(""); setOtpInput("");
    setActiveConv(null);
    setScreen("login");
  }

  // ── Chat Handlers ────────────────────────────────────────────────────────────
  function openConversation(conv: Conversation) {
    setActiveConv(conv);
    setConfidentialMode(conv.ndaActive);
    setScreen("chat");
  }

  function sendMessage() {
    if (!messageInput.trim() || !activeConv || !user) return;

    // if turning on confidential mode for first time in this convo, show NDA
    if (confidentialMode && !activeConv.ndaActive) {
      setShowNdaModal(true);
      return;
    }

    const msg: Message = {
      id: `m_${Date.now()}`,
      from: "me",
      text: messageInput.trim(),
      ts: Date.now(),
      confidential: confidentialMode,
    };

    const updated = conversations.map((c) =>
      c.id === activeConv.id
        ? { ...c, messages: [...c.messages, msg] }
        : c
    );
    setConversations(updated);
    setActiveConv({ ...activeConv, messages: [...activeConv.messages, msg] });
    localStorage.setItem("confi_conversations", JSON.stringify(updated));
    setMessageInput("");
  }

  function activateNDA() {
    if (!activeConv) return;
    const now = new Date().toISOString();
    const msg: Message = {
      id: `m_nda_${Date.now()}`,
      from: "system",
      text: `🔒 Confidential Mode activated. International NDA now covers this conversation. Accepted at ${formatDate(now)}.`,
      ts: Date.now(),
      confidential: true,
    };
    const updatedConv: Conversation = {
      ...activeConv,
      ndaActive: true,
      ndaAcceptedAt: now,
      messages: [...activeConv.messages, msg],
    };
    const updated = conversations.map((c) => c.id === activeConv.id ? updatedConv : c);
    setConversations(updated);
    setActiveConv(updatedConv);
    localStorage.setItem("confi_conversations", JSON.stringify(updated));
    setShowNdaModal(false);
    setConfidentialMode(true);
  }

  function toggleConfidentialMode() {
    if (!activeConv) return;
    if (!confidentialMode) {
      // turning on — check if NDA already accepted
      if (!activeConv.ndaActive) {
        setShowNdaModal(true);
      } else {
        setConfidentialMode(true);
      }
    } else {
      setShowNdaToggleModal(true);
    }
  }

  function deactivateConfidentialMode() {
    setConfidentialMode(false);
    setShowNdaToggleModal(false);
  }

  // ── Render helpers ───────────────────────────────────────────────────────────
  function InputField({
    label, value, onChange, type = "text", placeholder, maxLength,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string; maxLength?: number;
  }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={styles.label}>{label}</label>
        <input
          style={styles.input}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
        />
      </div>
    );
  }

  // ── Screens ──────────────────────────────────────────────────────────────────

  if (screen === "splash") {
    return (
      <div style={styles.splashContainer}>
        <div style={styles.splashLogo}>🔒</div>
        <h1 style={styles.splashTitle}>Confi</h1>
        <p style={styles.splashSub}>Confidential Messaging</p>
        <div style={styles.splashSpinner} />
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>🔒</div>
          <h2 style={styles.authTitle}>Create Account</h2>
          <p style={styles.authSub}>
            Your phone number is your legal identity anchor for NDA enforcement.
          </p>

          {formError && <div style={styles.errorBox}>{formError}</div>}
          {formSuccess && <div style={styles.successBox}>{formSuccess}</div>}

          <InputField label="Email Address" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <InputField label="Password (min 8 chars)" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          <InputField
            label="Phone Number (with country code)"
            value={phone}
            onChange={setPhone}
            type="tel"
            placeholder="+14155552671"
          />

          <div style={styles.legalNote}>
            <span style={{ fontSize: 14 }}>⚖️</span>
            <span>
              Your phone number will be used to legally attribute your identity to any NDA-protected conversations. It will be encrypted at rest.
            </span>
          </div>

          <button style={styles.primaryBtn} onClick={handleRegister} disabled={loading}>
            {loading ? "Creating account…" : "Create Account & Send OTP"}
          </button>
          <button style={styles.ghostBtn} onClick={() => { setFormError(""); setScreen("login"); }}>
            Already have an account? Sign in
          </button>
        </div>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>🔒</div>
          <h2 style={styles.authTitle}>Welcome back</h2>
          <p style={styles.authSub}>Sign in to your Confi account</p>

          {formError && <div style={styles.errorBox}>{formError}</div>}
          {formSuccess && <div style={styles.successBox}>{formSuccess}</div>}

          <InputField label="Email Address" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <InputField label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

          <button style={styles.primaryBtn} onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <button style={styles.ghostBtn} onClick={() => { setFormError(""); setScreen("register"); }}>
            New here? Create an account
          </button>
        </div>
      </div>
    );
  }

  if (screen === "otp") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>📱</div>
          <h2 style={styles.authTitle}>Verify Your Phone</h2>
          <p style={styles.authSub}>
            We sent a 6-digit OTP to <strong>{phone}</strong>
            <br />
            <span style={{ fontSize: 12, color: "#6c757d" }}>
              (Demo: check browser console for OTP)
            </span>
          </p>

          {formError && <div style={styles.errorBox}>{formError}</div>}
          {formSuccess && <div style={styles.successBox}>{formSuccess}</div>}

          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Enter 6-digit OTP</label>
            <input
              style={{ ...styles.input, textAlign: "center", fontSize: 24, letterSpacing: 8 }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>

          <div style={styles.legalNote}>
            <span>⚖️</span>
            <span>Phone verification creates a legally attributable identity record linked to any NDAs you sign via Confi.</span>
          </div>

          <button style={styles.primaryBtn} onClick={handleVerifyOtp}>
            Verify OTP
          </button>
          <button style={styles.ghostBtn} onClick={handleResendOtp}>
            Resend OTP
          </button>
          <button style={styles.ghostBtn} onClick={() => setScreen("register")}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (screen === "profile_setup") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>👤</div>
          <h2 style={styles.authTitle}>Set Up Profile</h2>
          <p style={styles.authSub}>This name appears on your NDA agreements.</p>

          {formError && <div style={styles.errorBox}>{formError}</div>}

          <InputField label="Display Name (legal name recommended)" value={displayName} onChange={setDisplayName} placeholder="Full Name" maxLength={60} />

          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Choose Avatar</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              {AVATARS.map((av) => (
                <button
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  style={{
                    fontSize: 32,
                    background: selectedAvatar === av ? "#0f172a" : "#f1f5f9",
                    border: selectedAvatar === av ? "2px solid #6366f1" : "2px solid transparent",
                    borderRadius: 12,
                    padding: "6px 10px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.legalNote}>
            <span>⚖️</span>
            <span>
              Your display name is associated with your verified phone number and email. It will appear on all NDA agreements you accept.
            </span>
          </div>

          <button style={styles.primaryBtn} onClick={handleProfileSave}>
            Save Profile & Continue
          </button>
        </div>
      </div>
    );
  }

  if (screen === "home" && user) {
    return (
      <div style={styles.appShell}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>{user.avatar}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{user.displayName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{user.email}</div>
                {user.phoneVerified && (
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Phone Verified</div>
                )}
              </div>
            </div>
            <button style={styles.iconBtn} onClick={handleLogout} title="Sign out">🚪</button>
          </div>

          <div style={styles.searchBar}>
            <span style={{ fontSize: 14 }}>🔍</span>
            <span style={{ color: "#94a3b8", fontSize: 14 }}>Search conversations…</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              return (
                <div
                  key={conv.id}
                  style={styles.convItem}
                  onClick={() => openConversation(conv)}
                >
                  <div style={{ position: "relative" }}>
                    <span style={{ fontSize: 32 }}>{conv.withAvatar}</span>
                    {conv.ndaActive && (
                      <span style={styles.ndaBadge}>🔒</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{conv.with}</span>
                      {last && <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatTime(last.ts)}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {last?.from === "me" ? "You: " : ""}{last?.text ?? ""}
                    </div>
                    {conv.ndaActive && (
                      <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginTop: 2 }}>
                        🔒 NDA Active
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.sidebarFooter}>
            <span style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", display: "block" }}>
              🔒 Confi Messaging — Legally-enforced confidentiality
            </span>
          </div>
        </div>

        {/* Empty state */}
        <div style={styles.mainEmpty}>
          <div style={{ fontSize: 64 }}>🔒</div>
          <h2 style={{ color: "#1e293b", marginBottom: 8 }}>Confi Messaging</h2>
          <p style={{ color: "#64748b", maxWidth: 340, textAlign: "center" }}>
            Select a conversation to start messaging. Enable Confidential Mode to automatically activate an international NDA covering your conversation.
          </p>
          <div style={{ marginTop: 24, padding: "16px 24px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", maxWidth: 360 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>Your Identity Record</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
              <div>👤 {user.displayName}</div>
              <div>📧 {user.email}</div>
              <div>📱 {user.phone || "Phone not set"} {user.phoneVerified ? "✓ Verified" : "⚠ Unverified"}</div>
              <div>📅 Joined {new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "chat" && user && activeConv) {
    return (
      <div style={styles.appShell}>
        {/* Sidebar (collapsed on chat) */}
        <div style={{ ...styles.sidebar, display: "flex" }}>
          <div style={styles.sidebarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>{user.avatar}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{user.displayName}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{user.email}</div>
              </div>
            </div>
            <button style={styles.iconBtn} onClick={handleLogout} title="Sign out">🚪</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              return (
                <div
                  key={conv.id}
                  style={{
                    ...styles.convItem,
                    background: conv.id === activeConv.id ? "#ede9fe" : "transparent",
                  }}
                  onClick={() => openConversation(conv)}
                >
                  <div style={{ position: "relative" }}>
                    <span style={{ fontSize: 32 }}>{conv.withAvatar}</span>
                    {conv.ndaActive && <span style={styles.ndaBadge}>🔒</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{conv.with}</span>
                      {last && <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatTime(last.ts)}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {last?.from === "me" ? "You: " : ""}{last?.text ?? ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Panel */}
        <div style={styles.chatPanel}>
          {/* Chat Header */}
          <div style={{ ...styles.chatHeader, background: confidentialMode ? "#1e1b4b" : "#ffffff" }}>
            <button style={styles.iconBtn} onClick={() => setScreen("home")}>←</button>
            <span style={{ fontSize: 28 }}>{activeConv.withAvatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: confidentialMode ? "#e0e7ff" : "#1e293b" }}>
                {activeConv.with}
              </div>
              {activeConv.ndaActive && activeConv.ndaAcceptedAt && (
                <div style={{ fontSize: 11, color: "#a5b4fc" }}>
                  🔒 NDA active since {formatDate(activeConv.ndaAcceptedAt)}
                </div>
              )}
              {!activeConv.ndaActive && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>No NDA active</div>
              )}
            </div>

            {/* Confidential Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: confidentialMode ? "#a5b4fc" : "#64748b", fontWeight: 600 }}>
                {confidentialMode ? "🔒 Confidential" : "Confidential"}
              </span>
              <button
                onClick={toggleConfidentialMode}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: confidentialMode ? "#6366f1" : "#cbd5e1",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  background: "white",
                  borderRadius: "50%",
                  position: "absolute",
                  top: 3,
                  left: confidentialMode ? 23 : 3,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
          </div>

          {/* Confidential Banner */}
          {confidentialMode && (
            <div style={styles.confidentialBanner}>
              <span>🔒</span>
              <span>
                <strong>Confidential Mode Active.</strong> All messages in this session are protected under an International NDA.
                {activeConv.ndaAcceptedAt && ` Accepted ${formatDate(activeConv.ndaAcceptedAt)}.`}
              </span>
            </div>
          )}

          {/* Messages */}
          <div style={styles.messagesArea}>
            {activeConv.messages.map((msg) => {
              const isMe = msg.from === "me";
              const isSystem = msg.from === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} style={styles.systemMessage}>
                    {msg.text}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isMe ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "68%",
                      padding: "10px 14px",
                      borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: isMe
                        ? msg.confidential ? "#4f46e5" : "#0f172a"
                        : msg.confidential ? "#ede9fe" : "#f1f5f9",
                      color: isMe ? "white" : "#1e293b",
                      fontSize: 14,
                      lineHeight: 1.5,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      position: "relative",
                    }}
                  >
                    {msg.confidential && (
                      <span style={{ fontSize: 10, opacity: 0.7, display: "block", marginBottom: 2 }}>
                        🔒 NDA Protected
                      </span>
                    )}
                    {msg.text}
                    <span style={{ fontSize: 10, opacity: 0.6, display: "block", marginTop: 4, textAlign: "right" }}>
                      {formatTime(msg.ts)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{
            ...styles.inputRow,
            background: confidentialMode ? "#1e1b4b" : "#ffffff",
            borderTop: `1px solid ${confidentialMode ? "#3730a3" : "#e2e8f0"}`,
          }}>
            <input
              style={{
                ...styles.chatInput,
                background: confidentialMode ? "#312e81" : "#f8fafc",
                color: confidentialMode ? "white" : "#1e293b",
                border: `1px solid ${confidentialMode ? "#4338ca" : "#e2e8f0"}`,
              }}
              placeholder={confidentialMode ? "🔒 Confidential message…" : "Message…"}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <button
              style={{
                ...styles.sendBtn,
                background: confidentialMode ? "#6366f1" : "#0f172a",
              }}
              onClick={sendMessage}
            >
              ➤
            </button>
          </div>
        </div>

        {/* NDA Activation Modal */}
        {showNdaModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚖️</div>
              <h3 style={{ textAlign: "center", marginBottom: 4, color: "#1e293b" }}>
                Activate Confidential Mode
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 16 }}>
                You are about to activate an <strong>International Non-Disclosure Agreement</strong> that covers all messages in this conversation.
              </p>

              <div style={styles.ndaIdentityBox}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Signing Party Identity</div>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <div>👤 <strong>{user.displayName}</strong></div>
                  <div>📧 {user.email}</div>
                  <div>📱 {user.phone || "No phone"} {user.phoneVerified ? "✓ Verified" : "⚠ Not Verified"}</div>
                  <div>🕐 {new Date().toLocaleString()}</div>
                </div>
              </div>

              <div style={styles.ndaTextBox}>
                <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", color: "#374151", lineHeight: 1.7, margin: 0 }}>
                  {NDA_TEXT}
                </pre>
              </div>

              <p style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginTop: 12 }}>
                ⚠️ By clicking "Accept & Activate", you are entering into a legally binding agreement. This action is logged and timestamped.
              </p>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button style={{ ...styles.ghostBtn, flex: 1 }} onClick={() => { setShowNdaModal(false); setConfidentialMode(false); }}>
                  Cancel
                </button>
                <button style={{ ...styles.primaryBtn, flex: 1, background: "#6366f1" }} onClick={activateNDA}>
                  Accept & Activate 🔒
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deactivate Confidential Mode Modal */}
        {showNdaToggleModal && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, maxWidth: 400 }}>
              <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>⚠️</div>
              <h3 style={{ textAlign: "center", color: "#1e293b" }}>Deactivate Confidential Mode?</h3>
              <p style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>
                The NDA remains legally active for messages already sent under Confidential Mode. Future messages in this session will not be marked as NDA-protected.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button style={{ ...styles.ghostBtn, flex: 1 }} onClick={() => setShowNdaToggleModal(false)}>
                  Keep Active
                </button>
                <button
                  style={{ ...styles.primaryBtn, flex: 1, background: "#ef4444" }}
                  onClick={deactivateConfidentialMode}
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  // Splash
  splashContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  },
  splashLogo: { fontSize: 72, marginBottom: 16 },
  splashTitle: { fontSize: 42, fontWeight: 800, color: "white", margin: 0 },
  splashSub: { fontSize: 16, color: "#a5b4fc", marginTop: 8 },
  splashSpinner: {
    marginTop: 40,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid #4338ca",
    borderTopColor: "#a5b4fc",
    animation: "spin 0.8s linear infinite",
  },

  // Auth
  authContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)",
    padding: 16,
  },
  authCard: {
    background: "white",
    borderRadius: 20,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
  },
  authLogo: { fontSize: 48, textAlign: "center", marginBottom: 12 },
  authTitle: { textAlign: "center", fontSize: 24, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" },
  authSub: { textAlign: "center", fontSize: 14, color: "#64748b", marginBottom: 24 },

  // Forms
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 15,
    color: "#1e293b",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    background: "#f8fafc",
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: "#0f172a",
    color: "white",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 10,
    transition: "opacity 0.15s",
  },
  ghostBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    background: "transparent",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 6,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#16a34a",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  legalNote: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12,
    color: "#92400e",
    lineHeight: 1.5,
    marginBottom: 20,
  },

  // App Shell
  appShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "#f8fafc",
  },
  sidebar: {
    width: 320,
    minWidth: 320,
    display: "flex",
    flexDirection: "column",
    background: "white",
    borderRight: "1px solid #e2e8f0",
    height: "100vh",
  },
  sidebarHeader: {
    padding: "16px 16px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #f1f5f9",
  },
  searchBar: {
    margin: "8px 12px",
    padding: "10px 14px",
    background: "#f8fafc",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #e2e8f0",
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    cursor: "pointer",
    borderRadius: 10,
    margin: "2px 6px",
    transition: "background 0.1s",
  },
  ndaBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    fontSize: 12,
    background: "white",
    borderRadius: "50%",
  },
  sidebarFooter: {
    padding: "12px 16px",
    borderTop: "1px solid #f1f5f9",
  },
  iconBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: 6,
    borderRadius: 8,
    color: "#64748b",
  },
  mainEmpty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  // Chat
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  confidentialBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    background: "linear-gradient(90deg, #1e1b4b, #312e81)",
    color: "#e0e7ff",
    fontSize: 13,
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
  },
  systemMessage: {
    alignSelf: "center",
    background: "#ede9fe",
    color: "#4338ca",
    fontSize: 12,
    padding: "8px 14px",
    borderRadius: 20,
    margin: "8px 0",
    textAlign: "center",
    maxWidth: "80%",
    border: "1px solid #c4b5fd",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    padding: "12px 16px",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 24,
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    color: "white",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Modals
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
  modalCard: {
    background: "white",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 560,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
  },
  ndaIdentityBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 16,
  },
  ndaTextBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "16px",
    maxHeight: 280,
    overflowY: "auto",
  },
};