"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// ── types ──────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "login"
  | "signup"
  | "otp"
  | "profile"
  | "recovery"
  | "recovery-otp"
  | "conversations"
  | "chat";

interface User {
  email: string;
  fullName?: string;
  country?: string;
  phone?: string;
  profileComplete?: boolean;
  avatarColor?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  confidential?: boolean;
  ndaAccepted?: boolean;
}

interface Conversation {
  id: string;
  participantName: string;
  participantEmail: string;
  participantColor: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaActive: boolean;
  unread: number;
  lastMessage?: string;
  lastTimestamp?: number;
}

// ── static data ───────────────────────────────────────────────────────────
import { COUNTRIES } from "../lib/countries";

const AVATAR_COLORS = [
  "#6C63FF","#FF6584","#43B89C","#F7B731","#FC5C65",
  "#26de81","#4ECDC4","#FF8C42","#A29BFE","#00B894",
];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    participantName: "Alexandra Chen",
    participantEmail: "alex.chen@example.com",
    participantColor: "#6C63FF",
    messages: [
      { id: "m1", senderId: "alex.chen@example.com", text: "Hey! Are you free to discuss the merger details?", timestamp: Date.now() - 3600000, confidential: false },
      { id: "m2", senderId: "me", text: "Yes, let's talk. Should we enable confidential mode?", timestamp: Date.now() - 3500000, confidential: false },
    ],
    confidentialMode: false,
    ndaActive: false,
    unread: 1,
    lastMessage: "Yes, let's talk. Should we enable confidential mode?",
    lastTimestamp: Date.now() - 3500000,
  },
  {
    id: "conv-2",
    participantName: "Marcus Rivera",
    participantEmail: "m.rivera@example.com",
    participantColor: "#43B89C",
    messages: [
      { id: "m3", senderId: "m.rivera@example.com", text: "I've reviewed the NDAs — everything looks good.", timestamp: Date.now() - 86400000, confidential: true, ndaAccepted: true },
    ],
    confidentialMode: true,
    ndaActive: true,
    unread: 0,
    lastMessage: "🔒 Confidential message",
    lastTimestamp: Date.now() - 86400000,
  },
];

// ── helpers ────────────────────────────────────────────────────────────────
function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ══════════════════════════════════════════════════════════════════════════
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // auth forms
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpTarget, setOtpTarget] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  // profile form
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");

  // messaging
  const [msgText, setMsgText] = useState("");
  const [newChatEmail, setNewChatEmail] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [ndaPending, setNdaPending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const stored = localStorage.getItem("confi_user");
    const convs = localStorage.getItem("confi_conversations");
    if (stored) {
      const u: User = JSON.parse(stored);
      setUser(u);
      if (convs) setConversations(JSON.parse(convs));
      else setConversations(DEMO_CONVERSATIONS);
      setTimeout(() => setScreen(u.profileComplete ? "conversations" : "profile"), 1500);
    } else {
      setTimeout(() => setScreen("login"), 1500);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  const saveConversations = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    localStorage.setItem("confi_conversations", JSON.stringify(convs));
  }, []);

  // ── auth ────────────────────────────────────────────────────────────────
  async function handleSignup() {
    setError("");
    if (!email || !password) return setError("Email and password are required.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error || "Signup failed.");
      const otp = generateOTP();
      setGeneratedOtp(otp);
      setOtpTarget(email);
      alert(`[Demo OTP] Your verification code is: ${otp}`);
      setScreen("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError("");
    if (!email || !password) return setError("Email and password are required.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error || "Login failed.");
      const stored = localStorage.getItem("confi_user");
      if (stored) {
        const u: User = JSON.parse(stored);
        setUser(u);
        const convs = localStorage.getItem("confi_conversations");
        setConversations(convs ? JSON.parse(convs) : DEMO_CONVERSATIONS);
        setScreen(u.profileComplete ? "conversations" : "profile");
      } else {
        const u: User = { email: data.email, avatarColor: randomColor() };
        setUser(u);
        localStorage.setItem("confi_user", JSON.stringify(u));
        setConversations(DEMO_CONVERSATIONS);
        localStorage.setItem("confi_conversations", JSON.stringify(DEMO_CONVERSATIONS));
        setScreen("profile");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyOtp() {
    setError("");
    if (otpInput === generatedOtp) {
      const u: User = { email, phone, avatarColor: randomColor() };
      setUser(u);
      localStorage.setItem("confi_user", JSON.stringify(u));
      setConversations(DEMO_CONVERSATIONS);
      localStorage.setItem("confi_conversations", JSON.stringify(DEMO_CONVERSATIONS));
      setScreen("profile");
    } else {
      setError("Invalid OTP. Please try again.");
    }
  }

  function handleRecovery() {
    setError("");
    if (!recoveryEmail) return setError("Please enter your email.");
    const otp = generateOTP();
    setGeneratedOtp(otp);
    setOtpTarget(recoveryEmail);
    alert(`[Demo Recovery OTP] Your code is: ${otp}`);
    setScreen("recovery-otp");
  }

  function handleRecoveryOtp() {
    setError("");
    if (otpInput === generatedOtp) {
      alert("Identity verified! In production you would now set a new password.");
      setScreen("login");
    } else {
      setError("Invalid code.");
    }
  }

  // ── profile ─────────────────────────────────────────────────────────────
  function handleProfileSave() {
    setError("");
    if (!fullName.trim()) return setError("Legal full name is required.");
    if (!country) return setError("Country of residence is required.");
    const updated: User = {
      ...user!,
      fullName: fullName.trim(),
      country,
      phone,
      profileComplete: true,
    };
    setUser(updated);
    localStorage.setItem("confi_user", JSON.stringify(updated));
    setConversations(DEMO_CONVERSATIONS);
    localStorage.setItem("confi_conversations", JSON.stringify(DEMO_CONVERSATIONS));
    setScreen("conversations");
  }

  // ── messaging ────────────────────────────────────────────────────────────
  function openConversation(conv: Conversation) {
    const updated = conversations.map(c =>
      c.id === conv.id ? { ...c, unread: 0 } : c
    );
    saveConversations(updated);
    setActiveConv({ ...conv, unread: 0 });
    setScreen("chat");
  }

  function sendMessage() {
    if (!msgText.trim() || !activeConv) return;
    const isConfidential = activeConv.confidentialMode;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: user!.email,
      text: msgText.trim(),
      timestamp: Date.now(),
      confidential: isConfidential,
      ndaAccepted: isConfidential && activeConv.ndaActive,
    };
    const updatedConv: Conversation = {
      ...activeConv,
      messages: [...activeConv.messages, newMsg],
      lastMessage: isConfidential ? "🔒 Confidential message" : msgText.trim(),
      lastTimestamp: Date.now(),
    };
    setActiveConv(updatedConv);
    const updatedConvs = conversations.map(c =>
      c.id === activeConv.id ? updatedConv : c
    );
    saveConversations(updatedConvs);
    setMsgText("");

    // simulate reply after 2s
    setTimeout(() => {
      const reply: Message = {
        id: `m-${Date.now()}-r`,
        senderId: activeConv.participantEmail,
        text: isConfidential
          ? "Understood. This conversation is covered under our NDA."
          : "Got it! Talk soon.",
        timestamp: Date.now(),
        confidential: isConfidential,
        ndaAccepted: isConfidential,
      };
      setActiveConv(prev => prev ? { ...prev, messages: [...prev.messages, reply] } : prev);
      setConversations(prev => {
        const upd = prev.map(c => c.id === activeConv.id
          ? { ...c, messages: [...c.messages, newMsg, reply], lastMessage: reply.text, lastTimestamp: Date.now() }
          : c
        );
        localStorage.setItem("confi_conversations", JSON.stringify(upd));
        return upd;
      });
    }, 2000);
  }

  function toggleConfidentialMode(conv: Conversation) {
    if (!conv.confidentialMode) {
      // turning ON — show NDA
      setNdaPending(true);
      setShowNdaModal(true);
    } else {
      // turning OFF
      const updated: Conversation = { ...conv, confidentialMode: false, ndaActive: false };
      setActiveConv(updated);
      saveConversations(conversations.map(c => c.id === conv.id ? updated : c));
    }
  }

  function acceptNda() {
    if (!activeConv) return;
    const updated: Conversation = {
      ...activeConv,
      confidentialMode: true,
      ndaActive: true,
    };
    setActiveConv(updated);
    saveConversations(conversations.map(c => c.id === activeConv.id ? updated : c));
    setShowNdaModal(false);
    setNdaPending(false);
  }

  function createNewConversation() {
    if (!newChatEmail.trim() || !newChatName.trim()) return;
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      participantName: newChatName.trim(),
      participantEmail: newChatEmail.trim(),
      participantColor: randomColor(),
      messages: [],
      confidentialMode: false,
      ndaActive: false,
      unread: 0,
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setNewChatEmail("");
    setNewChatName("");
    setShowNewChat(false);
    openConversation(newConv);
  }

  function logout() {
    localStorage.removeItem("confi_user");
    setUser(null);
    setConversations([]);
    setActiveConv(null);
    setEmail("");
    setPassword("");
    setScreen("login");
  }

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── SPLASH ────────────────────────────────────────────────────────────────
  if (screen === "splash") {
    return (
      <div style={s.splash}>
        <div style={s.splashLogo}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <circle cx="36" cy="36" r="36" fill="#6C63FF" />
            <path d="M18 26h36v4H18zM18 34h24v4H18zM18 42h28v4H18z" fill="white" opacity="0.9" />
            <circle cx="52" cy="48" r="8" fill="#43B89C" />
            <path d="M49 48l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={s.splashTitle}>Confi</h1>
        <p style={s.splashSub}>Secure. Confidential. Trusted.</p>
        <div style={s.splashLoader}>
          <div style={s.splashDot} />
          <div style={{ ...s.splashDot, animationDelay: "0.2s" }} />
          <div style={{ ...s.splashDot, animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={s.authLogo}>
            <svg width="44" height="44" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="36" fill="#6C63FF" />
              <path d="M18 26h36v4H18zM18 34h24v4H18zM18 42h28v4H18z" fill="white" opacity="0.9" />
              <circle cx="52" cy="48" r="8" fill="#43B89C" />
              <path d="M49 48l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={s.authTitle}>Welcome back</h2>
          <p style={s.authSub}>Sign in to your Confi account</p>

          {error && <div style={s.errorBox}>{error}</div>}

          <label style={s.label}>Email address</label>
          <input style={s.input} type="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />

          <label style={s.label}>Password</label>
          <input style={s.input} type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button style={s.linkBtn} onClick={() => { setError(""); setScreen("recovery"); }}>
              Forgot password?
            </button>
          </div>

          <button style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p style={s.switchText}>
            Don&apos;t have an account?{" "}
            <button style={s.linkBtn} onClick={() => { setError(""); setScreen("signup"); }}>
              Create one
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── SIGNUP ────────────────────────────────────────────────────────────────
  if (screen === "signup") {
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={s.authLogo}>
            <svg width="44" height="44" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="36" fill="#6C63FF" />
              <path d="M18 26h36v4H18zM18 34h24v4H18zM18 42h28v4H18z" fill="white" opacity="0.9" />
              <circle cx="52" cy="48" r="8" fill="#43B89C" />
              <path d="M49 48l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={s.authTitle}>Create account</h2>
          <p style={s.authSub}>Join Confi — secure messaging with legal protection</p>

          {error && <div style={s.errorBox}>{error}</div>}

          <label style={s.label}>Email address</label>
          <input style={s.input} type="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)} />

          <label style={s.label}>Phone number (optional)</label>
          <input style={s.input} type="tel" placeholder="+1 234 567 8900"
            value={phone} onChange={e => setPhone(e.target.value)} />

          <label style={s.label}>Password</label>
          <input style={s.input} type="password" placeholder="Min 8 characters"
            value={password} onChange={e => setPassword(e.target.value)} />

          <label style={s.label}>Confirm password</label>
          <input style={s.input} type="password" placeholder="Repeat password"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

          <div style={s.infoBox}>
            🔐 Your password is hashed with bcrypt before storage. We never store plain-text credentials.
          </div>

          <button style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={handleSignup} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p style={s.switchText}>
            Already have an account?{" "}
            <button style={s.linkBtn} onClick={() => { setError(""); setScreen("login"); }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── OTP ───────────────────────────────────────────────────────────────────
  if (screen === "otp") {
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>📱</div>
          <h2 style={s.authTitle}>Verify your identity</h2>
          <p style={s.authSub}>
            A 6-digit code was sent to <strong>{otpTarget}</strong>
          </p>

          {error && <div style={s.errorBox}>{error}</div>}

          <label style={s.label}>Verification code</label>
          <input style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22 }}
            type="text" maxLength={6} placeholder="000000"
            value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))} />

          <button style={s.primaryBtn} onClick={handleVerifyOtp}>Verify Code</button>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button style={s.linkBtn} onClick={() => {
              const otp = generateOTP(); setGeneratedOtp(otp);
              alert(`[Demo OTP] New code: ${otp}`);
            }}>Resend code</button>
          </div>

          <button style={s.ghostBtn} onClick={() => setScreen("login")}>← Back to login</button>
        </div>
      </div>
    );
  }

  // ── RECOVERY ──────────────────────────────────────────────────────────────
  if (screen === "recovery") {
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🔑</div>
          <h2 style={s.authTitle}>Account recovery</h2>
          <p style={s.authSub}>Enter your email to receive a recovery code.</p>

          {error && <div style={s.errorBox}>{error}</div>}

          <label style={s.label}>Email address</label>
          <input style={s.input} type="email" placeholder="you@example.com"
            value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />

          <button style={s.primaryBtn} onClick={handleRecovery}>Send Recovery Code</button>
          <button style={s.ghostBtn} onClick={() => setScreen("login")}>← Back to login</button>
        </div>
      </div>
    );
  }

  if (screen === "recovery-otp") {
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🔓</div>
          <h2 style={s.authTitle}>Enter recovery code</h2>
          <p style={s.authSub}>Check your email at <strong>{recoveryEmail}</strong></p>

          {error && <div style={s.errorBox}>{error}</div>}

          <label style={s.label}>Recovery code</label>
          <input style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22 }}
            type="text" maxLength={6} placeholder="000000"
            value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))} />

          <button style={s.primaryBtn} onClick={handleRecoveryOtp}>Verify & Recover</button>
          <button style={s.ghostBtn} onClick={() => setScreen("login")}>← Back to login</button>
        </div>
      </div>
    );
  }

  // ── PROFILE SETUP ─────────────────────────────────────────────────────────
  if (screen === "profile") {
    return (
      <div style={s.authWrap}>
        <div style={{ ...s.authCard, maxWidth: 480 }}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>👤</div>
          <h2 style={s.authTitle}>Set up your profile</h2>
          <p style={s.authSub}>
            Your legal identity is required to generate enforceable NDA documents.
            This information is stored securely and never shared without your consent.
          </p>

          {error && <div style={s.errorBox}>{error}</div>}

          <div style={s.ndaBadge}>
            🛡️ NDA-ready profile — fields marked * are legally required
          </div>

          <label style={s.label}>Legal full name *</label>
          <input style={s.input} type="text" placeholder="As it appears on your ID"
            value={fullName} onChange={e => setFullName(e.target.value)} />

          <label style={s.label}>Country of residence *</label>
          <input style={s.input} type="text" placeholder="Search country…"
            value={countrySearch} onChange={e => setCountrySearch(e.target.value)} />
          {countrySearch && filteredCountries.length > 0 && (
            <div style={s.dropdown}>
              {filteredCountries.slice(0, 8).map(c => (
                <button key={c} style={s.dropdownItem} onClick={() => {
                  setCountry(c); setCountrySearch(c);
                  setCountrySearch("");
                  // keep display
                  setTimeout(() => setCountrySearch(c), 0);
                }}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {country && <div style={s.selectedTag}>✓ {country}</div>}

          <label style={s.label}>Phone number (for 2FA)</label>
          <input style={s.input} type="tel" placeholder="+1 234 567 8900"
            value={phone} onChange={e => setPhone(e.target.value)} />

          <div style={s.infoBox}>
            📋 Under international NDA law, your legal name and country are required to make agreements enforceable across jurisdictions.
          </div>

          <button style={s.primaryBtn} onClick={handleProfileSave}>
            Save Profile &amp; Continue
          </button>
        </div>
      </div>
    );
  }

  // ── CONVERSATIONS ─────────────────────────────────────────────────────────
  if (screen === "conversations") {
    const totalUnread = conversations.reduce((a, c) => a + c.unread, 0);
    return (
      <div style={s.appShell}>
        {/* header */}
        <div style={s.convHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 72 72" fill="none">
              <circle cx="36" cy="36" r="36" fill="#6C63FF" />
              <path d="M18 26h36v4H18zM18 34h24v4H18zM18 42h28v4H18z" fill="white" opacity="0.9" />
              <circle cx="52" cy="48" r="8" fill="#43B89C" />
              <path d="M49 48l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 20, color: "#1a1a2e" }}>Confi</span>
            {totalUnread > 0 && <span style={s.unreadBadge}>{totalUnread}</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.iconBtn} title="New chat" onClick={() => setShowNewChat(true)}>✏️</button>
            <button style={s.iconBtn} title="Profile" onClick={() => setShowProfile(true)}>
              <div style={{ ...s.avatarSm, background: user?.avatarColor }}>
                {initials(user?.fullName || user?.email || "U")}
              </div>
            </button>
          </div>
        </div>

        {/* search bar */}
        <div style={s.searchBar}>
          <span style={{ color: "#aaa", marginRight: 8 }}>🔍</span>
          <input style={s.searchInput} placeholder="Search conversations…" />
        </div>

        {/* list */}
        <div style={s.convList}>
          {conversations.length === 0 && (
            <div style={s.emptyState}>
              <div style={{ fontSize: 48 }}>💬</div>
              <p>No conversations yet.</p>
              <button style={s.primaryBtn} onClick={() => setShowNewChat(true)}>Start a chat</button>
            </div>
          )}
          {conversations.map(conv => (
            <button key={conv.id} style={s.convItem} onClick={() => openConversation(conv)}>
              <div style={{ ...s.avatar, background: conv.participantColor }}>
                {initials(conv.participantName)}
                {conv.ndaActive && <span style={s.ndaDot}>🔒</span>}
              </div>
              <div style={s.convInfo}>
                <div style={s.convTopRow}>
                  <span style={s.convName}>{conv.participantName}</span>
                  <span style={s.convTime}>{conv.lastTimestamp ? fmtTime(conv.lastTimestamp) : ""}</span>
                </div>
                <div style={s.convBottomRow}>
                  <span style={s.convPreview}>{conv.lastMessage || "Start a conversation"}</span>
                  {conv.unread > 0 && <span style={s.unreadPill}>{conv.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* new chat modal */}
        {showNewChat && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <h3 style={s.modalTitle}>New Conversation</h3>
              <label style={s.label}>Recipient name</label>
              <input style={s.input} placeholder="Full name"
                value={newChatName} onChange={e => setNewChatName(e.target.value)} />
              <label style={s.label}>Recipient email</label>
              <input style={s.input} placeholder="email@example.com"
                value={newChatEmail} onChange={e => setNewChatEmail(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={s.primaryBtn} onClick={createNewConversation}>Start Chat</button>
                <button style={s.ghostBtn} onClick={() => setShowNewChat(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* profile modal */}
        {showProfile && user && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <div style={{ ...s.avatar, ...s.avatarLg, background: user.avatarColor, margin: "0 auto 16px" }}>
                {initials(user.fullName || user.email)}
              </div>
              <h3 style={{ textAlign: "center", margin: "0 0 4px", color: "#1a1a2e" }}>
                {user.fullName || "No name set"}
              </h3>
              <p style={{ textAlign: "center", color: "#666", fontSize: 14, margin: "0 0 16px" }}>
                {user.email}
              </p>
              <div style={s.profileRow}><span>🌍</span><span>{user.country || "Country not set"}</span></div>
              <div style={s.profileRow}><span>📱</span><span>{user.phone || "Phone not set"}</span></div>
              <div style={{ ...s.ndaBadge, marginTop: 12 }}>
                🛡️ NDA-verified identity — your legal details are on file
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button style={s.ghostBtn} onClick={() => { setShowProfile(false); setScreen("profile"); }}>
                  Edit Profile
                </button>
                <button style={{ ...s.ghostBtn, color: "#FC5C65", borderColor: "#FC5C65" }}
                  onClick={logout}>
                  Sign Out
                </button>
              </div>
              <button style={{ ...s.ghostBtn, marginTop: 8 }} onClick={() => setShowProfile(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CHAT ──────────────────────────────────────────────────────────────────
  if (screen === "chat" && activeConv) {
    return (
      <div style={s.appShell}>
        {/* NDA modal */}
        {showNdaModal && (
          <div style={s.modalOverlay}>
            <div style={{ ...s.modal, maxWidth: 520 }}>
              <div style={s.ndaHeader}>
                <span style={{ fontSize: 32 }}>⚖️</span>
                <h3 style={s.ndaTitle}>International Non-Disclosure Agreement</h3>
              </div>
              <div style={s.ndaBody}>
                <p><strong>PARTIES:</strong></p>
                <p>Disclosing Party: <strong>{user?.fullName || user?.email}</strong> ({user?.country})</p>
                <p>Receiving Party: <strong>{activeConv.participantName}</strong></p>
                <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "12px 0" }} />
                <p><strong>CONFIDENTIALITY OBLIGATION</strong></p>
                <p>By enabling Confidential Mode, both parties agree that:</p>
                <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                  <li>All messages in this conversation are classified as <em>confidential information</em>.</li>
                  <li>Neither party shall disclose, share, copy, or reproduce any content from this conversation without prior written consent.</li>
                  <li>This agreement is governed by international commercial confidentiality law and applicable national laws of each party&apos;s country of residence.</li>
                  <li>Breach of this NDA may result in legal proceedings and monetary damages.</li>
                  <li>This agreement is binding from the moment of acceptance and persists indefinitely unless mutually terminated in writing.</li>
                  <li>Digital acceptance constitutes a legally binding signature under the E-Sign Act (US), eIDAS (EU), and equivalent international frameworks.</li>
                </ol>
                <p><strong>JURISDICTION:</strong> International — governed by UNCITRAL Model Law and local jurisdiction of each signatory.</p>
                <p><strong>EFFECTIVE DATE:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                <div style={s.ndaSignatureBlock}>
                  <div>
                    <strong>{user?.fullName || user?.email}</strong><br />
                    <small>{user?.country} | {user?.email}</small>
                  </div>
                  <div style={s.signatureLine}>Digital Signature</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.primaryBtn} onClick={acceptNda}>
                  ✓ I Accept & Activate Confidential Mode
                </button>
                <button style={s.ghostBtn} onClick={() => { setShowNdaModal(false); setNdaPending(false); }}>
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* chat header */}
        <div style={s.chatHeader}>
          <button style={s.backBtn} onClick={() => setScreen("conversations")}>←</button>
          <div style={{ ...s.avatar, background: activeConv.participantColor, width: 38, height: 38, fontSize: 14 }}>
            {initials(activeConv.participantName)}
          </div>
          <div style={{ flex: 1, marginLeft: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#1a1a2e" }}>{activeConv.participantName}</div>
            <div style={{ fontSize: 12, color: activeConv.ndaActive ? "#43B89C" : "#aaa" }}>
              {activeConv.ndaActive ? "🔒 NDA Active — Confidential" : "🟢 Online"}
            </div>
          </div>
          <button
            style={{
              ...s.confidentialToggle,
              background: activeConv.confidentialMode ? "#6C63FF" : "#f0f0f0",
              color: activeConv.confidentialMode ? "white" : "#666",
            }}
            onClick={() => toggleConfidentialMode(activeConv)}
            title={activeConv.confidentialMode ? "Disable confidential mode" : "Enable confidential mode"}
          >
            {activeConv.confidentialMode ? "🔒 Confidential ON" : "🔓 Confidential"}
          </button>
        </div>

        {/* NDA banner */}
        {activeConv.ndaActive && (
          <div style={s.ndaBanner}>
            ⚖️ This conversation is protected under an International NDA. All messages are legally confidential.
          </div>
        )}

        {/* messages */}
        <div style={s.messages}>
          {activeConv.messages.length === 0 && (
            <div style={s.emptyChat}>
              <div style={{ fontSize: 48 }}>👋</div>
              <p>Start your conversation with {activeConv.participantName}</p>
              {!activeConv.confidentialMode && (
                <p style={{ fontSize: 13, color: "#aaa" }}>
                  Enable Confidential Mode to protect your messages with an NDA.
                </p>
              )}
            </div>
          )}
          {activeConv.messages.map(msg => {
            const isMe = msg.senderId === user?.email;
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
                {!isMe && (
                  <div style={{ ...s.avatar, width: 28, height: 28, fontSize: 11, flexShrink: 0, marginRight: 6, alignSelf: "flex-end", background: activeConv.participantColor }}>
                    {initials(activeConv.participantName)}
                  </div>
                )}
                <div style={{
                  ...s.bubble,
                  background: isMe ? "#6C63FF" : "#f0f0f7",
                  color: isMe ? "white" : "#1a1a2e",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  border: msg.confidential ? (isMe ? "2px solid #43B89C" : "2px solid #43B89C") : "none",
                }}>
                  {msg.confidential && (
                    <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>🔒 Confidential</div>
                  )}
                  <div>{msg.text}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: "right" }}>
                    {fmtTime(msg.timestamp)}{isMe && " ✓✓"}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* input */}
        <div style={s.inputRow}>
          {activeConv.confidentialMode && (
            <div style={s.confiBadgeInput}>🔒</div>
          )}
          <input
            style={{ ...s.msgInput, background: activeConv.confidentialMode ? "#f8f6ff" : "white" }}
            placeholder={activeConv.confidentialMode ? "Confidential message…" : "Type a message…"}
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button style={s.sendBtn} onClick={sendMessage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// ── STYLES ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const s: Record<string, React.CSSProperties> = {
  // splash
  splash: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #6C63FF 0%, #43B89C 100%)",
  },
  splashLogo: { marginBottom: 16 },
  splashTitle: { color: "white", fontSize: 42, fontWeight: 800, margin: "0 0 6px", letterSpacing: -1 },
  splashSub: { color: "rgba(255,255,255,0.8)", fontSize: 16, margin: "0 0 32px" },
  splashLoader: { display: "flex", gap: 8 },
  splashDot: {
    width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.7)",
    animation: "bounce 0.8s infinite alternate",
  },

  // auth
  authWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f5f5fa", padding: "20px 16px",
  },
  authCard: {
    background: "white", borderRadius: 20, padding: "36px 32px",
    width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(108,99,255,0.12)",
  },
  authLogo: { textAlign: "center", marginBottom: 16 },
  authTitle: { textAlign: "center", fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: "#1a1a2e" },
  authSub: { textAlign: "center", color: "#666", fontSize: 14, margin: "0 0 24px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e0e0e0",
    fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 14,
    transition: "border-color 0.2s", fontFamily: "inherit",
  },
  primaryBtn: {
    width: "100%", padding: "14px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #6C63FF, #5a52d5)",
    color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
    marginBottom: 12, boxShadow: "0 4px 14px rgba(108,99,255,0.3)",
  },
  ghostBtn: {
    width: "100%", padding: "12px", borderRadius: 10,
    border: "1.5px solid #e0e0e0", background: "transparent",
    color: "#666", fontSize: 14, cursor: "pointer", marginBottom: 8,
  },
  linkBtn: {
    background: "none", border: "none", color: "#6C63FF",
    cursor: "pointer", fontSize: 14, fontWeight: 600, padding: 0,
  },
  switchText: { textAlign: "center", fontSize: 14, color: "#666", margin: "8px 0 0" },
  errorBox: {
    background: "#fff0f0", border: "1px solid #ffcdd2", borderRadius: 8,
    color: "#c62828", padding: "10px 14px", fontSize: 13, marginBottom: 14,
  },
  infoBox: {
    background: "#f0f7ff", border: "1px solid #b3d9ff", borderRadius: 8,
    color: "#1565c0", padding: "10px 14px", fontSize: 13, marginBottom: 14,
  },
  ndaBadge: {
    background: "linear-gradient(135deg, #6C63FF15, #43B89C15)",
    border: "1px solid #6C63FF40", borderRadius: 8,
    color: "#6C63FF", padding: "10px 14px", fontSize: 13,
    fontWeight: 600, marginBottom: 14, textAlign: "center",
  },
  dropdown: {
    background: "white", border: "1.5px solid #e0e0e0", borderRadius: 10,
    marginTop: -10, marginBottom: 14, maxHeight: 200, overflowY: "auto",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    display: "block", width: "100%", padding: "10px 14px",
    background: "none", border: "none", textAlign: "left",
    cursor: "pointer", fontSize: 14, color: "#1a1a2e",
    borderBottom: "1px solid #f5f5f5",
  },
  selectedTag: {
    display: "inline-block", padding: "4px 10px", borderRadius: 20,
    background: "#43B89C20", color: "#43B89C", fontSize: 13,
    fontWeight: 600, marginBottom: 14,
  },
  profileRow: {
    display: "flex", gap: 10, alignItems: "center",
    padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 14, color: "#444",
  },

  // app shell
  appShell: {
    display: "flex", flexDirection: "column", height: "100vh",
    maxWidth: 480, margin: "0 auto", background: "white",
    boxShadow: "0 0 60px rgba(0,0,0,0.1)",
  },

  // conversations
  convHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 12px", borderBottom: "1px solid #f0f0f0",
    background: "white", position: "sticky", top: 0, zIndex: 10,
  },
  searchBar: {
    display: "flex", alignItems: "center", padding: "8px 16px",
    background: "#f8f8fc", borderBottom: "1px solid #f0f0f0",
  },
  searchInput: {
    flex: 1, border: "none", background: "transparent",
    fontSize: 14, outline: "none", color: "#333",
  },
  convList: { flex: 1, overflowY: "auto" },
  convItem: {
    display: "flex", alignItems: "center", padding: "12px 16px",
    border: "none", background: "none", cursor: "pointer", width: "100%",
    borderBottom: "1px solid #f8f8fc", textAlign: "left",
    transition: "background 0.15s",
  },
  convInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  convTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  convName: { fontWeight: 600, fontSize: 15, color: "#1a1a2e" },
  convTime: { fontSize: 12, color: "#aaa", flexShrink: 0 },
  convBottomRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  convPreview: { fontSize: 13, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  unreadBadge: {
    background: "#6C63FF", color: "white", borderRadius: 10, padding: "2px 7px",
    fontSize: 11, fontWeight: 700, marginLeft: 8,
  },
  unreadPill: {
    background: "#6C63FF", color: "white", borderRadius: 10, padding: "2px 7px",
    fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8,
  },
  iconBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 18, padding: "6px", borderRadius: "50%",
  },
  avatar: {
    width: 46, height: 46, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 700, fontSize: 16, flexShrink: 0,
    position: "relative",
  },
  avatarSm: {
    width: 32, height: 32, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center",
    color: "white", fontWeight: 700, fontSize: 11,
  },
  avatarLg: { width: 72, height: 72, fontSize: 24 },
  ndaDot: { position: "absolute", bottom: -2, right: -2, fontSize: 12 },
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "60px 24px", gap: 12, color: "#aaa",
  },

  // chat
  chatHeader: {
    display: "flex", alignItems: "center", padding: "12px 12px",
    borderBottom: "1px solid #f0f0f0", background: "white",
    position: "sticky", top: 0, zIndex: 10, gap: 6,
  },
  backBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 20, color: "#6C63FF", padding: "4px 8px", borderRadius: 8,
  },
  confidentialToggle: {
    padding: "6px 12px", borderRadius: 20, border: "none",
    cursor: "pointer", fontSize: 12, fontWeight: 600,
    transition: "all 0.2s", whiteSpace: "nowrap",
  },
  ndaBanner: {
    background: "linear-gradient(135deg, #6C63FF, #43B89C)",
    color: "white", padding: "8px 16px", fontSize: 12,
    fontWeight: 500, textAlign: "center",
  },
  messages: {
    flex: 1, overflowY: "auto", padding: "16px",
    display: "flex", flexDirection: "column",
    background: "#fafafa",
  },
  bubble: {
    maxWidth: "72%", padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
    wordBreak: "break-word",
  },
  inputRow: {
    display: "flex", alignItems: "center", padding: "10px 12px",
    borderTop: "1px solid #f0f0f0", background: "white", gap: 8,
  },
  msgInput: {
    flex: 1, padding: "11px 14px", borderRadius: 24,
    border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: "50%", border: "none",
    background: "linear-gradient(135deg, #6C63FF, #5a52d5)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, boxShadow: "0 2px 8px rgba(108,99,255,0.4)",
  },
  confiBadgeInput: {
    fontSize: 16, flexShrink: 0,
  },
  emptyChat: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", color: "#aaa", textAlign: "center", padding: 24, gap: 8,
  },

  // modals
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, zIndex: 100,
  },
  modal: {
    background: "white", borderRadius: 20, padding: "28px 24px",
    width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 20px", color: "#1a1a2e" },

  // NDA modal
  ndaHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  ndaTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: 0 },
  ndaBody: {
    background: "#fafafa", borderRadius: 10, padding: "16px",
    fontSize: 13, lineHeight: 1.7, color: "#333", marginBottom: 16,
    border: "1px solid #eee", maxHeight: 360, overflowY: "auto",
  },
  ndaSignatureBlock: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    marginTop: 16, padding: "12px 0", borderTop: "1px solid #eee",
    fontSize: 13,
  },
  signatureLine: {
    borderTop: "1px solid #333", paddingTop: 4, fontSize: 12,
    color: "#666", width: 120, textAlign: "center",
  },
};