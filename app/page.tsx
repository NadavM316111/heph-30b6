"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "auth"
  | "otp"
  | "identity"
  | "profile-setup"
  | "home"
  | "chat"
  | "profile";

type AuthMode = "login" | "signup";

interface User {
  email: string;
  displayName: string;
  phone: string;
  avatarColor: string;
  legalName: string;
  idVerified: boolean;
  confidentialMode: boolean;
  joinedAt: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  participantName: string;
  participantEmail: string;
  participantColor: string;
  messages: Message[];
  confidentialMode: boolean;
  lastSeen: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    participantName: "Alex Rivera",
    participantEmail: "alex@example.com",
    participantColor: "#6366f1",
    confidentialMode: false,
    lastSeen: "2 min ago",
    messages: [
      { id: "m1", senderId: "alex@example.com", text: "Hey! Did you review the contract?", timestamp: Date.now() - 300000, confidential: false },
      { id: "m2", senderId: "me", text: "Yes, I'll send my comments shortly.", timestamp: Date.now() - 240000, confidential: false },
      { id: "m3", senderId: "alex@example.com", text: "Great, we need to finalize by Friday.", timestamp: Date.now() - 120000, confidential: false },
    ],
  },
  {
    id: "conv-2",
    participantName: "Jordan Chen",
    participantEmail: "jordan@example.com",
    participantColor: "#10b981",
    confidentialMode: true,
    lastSeen: "1 hr ago",
    messages: [
      { id: "m4", senderId: "jordan@example.com", text: "The acquisition terms are confidential.", timestamp: Date.now() - 7200000, confidential: true },
      { id: "m5", senderId: "me", text: "Understood. NDA is active on this channel.", timestamp: Date.now() - 7100000, confidential: true },
    ],
  },
  {
    id: "conv-3",
    participantName: "Sam Patel",
    participantEmail: "sam@example.com",
    participantColor: "#f59e0b",
    confidentialMode: false,
    lastSeen: "3 hr ago",
    messages: [
      { id: "m6", senderId: "sam@example.com", text: "Are we meeting tomorrow?", timestamp: Date.now() - 10800000, confidential: false },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function saveUser(user: User) {
  localStorage.setItem("confi_user", JSON.stringify(user));
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem("confi_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConversations(convos: Conversation[]) {
  localStorage.setItem("confi_conversations", JSON.stringify(convos));
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem("confi_conversations");
    return raw ? JSON.parse(raw) : DEMO_CONVERSATIONS;
  } catch {
    return DEMO_CONVERSATIONS;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, color, size = 42 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff",
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      letterSpacing: 0.5,
    }}>
      {initials(name)}
    </div>
  );
}

function NDABanner() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      border: "1px solid #4f46e5",
      borderRadius: 10, padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 10,
      margin: "8px 0",
    }}>
      <span style={{ fontSize: 20 }}>🔏</span>
      <div>
        <div style={{ color: "#c7d2fe", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
          CONFIDENTIAL MODE ACTIVE
        </div>
        <div style={{ color: "#a5b4fc", fontSize: 11 }}>
          Protected under International NDA · All parties legally bound
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid #e0e7ff", borderTopColor: "#6366f1",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);

  // Auth state
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [usePhone, setUsePhone] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpTarget, setOtpTarget] = useState("");
  const [otpExpected, setOtpExpected] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpPendingData, setOtpPendingData] = useState<{ email: string; password: string; phone: string } | null>(null);

  // Identity verification state
  const [idFirstName, setIdFirstName] = useState("");
  const [idLastName, setIdLastName] = useState("");
  const [idDOB, setIdDOB] = useState("");
  const [idCountry, setIdCountry] = useState("");
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [idLoading, setIdLoading] = useState(false);
  const [idError, setIdError] = useState("");
  const [idStep, setIdStep] = useState<"form" | "reviewing" | "done">("form");

  // Profile setup
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileError, setProfileError] = useState("");

  // Chat
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Profile screen
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    setTimeout(() => {
      const stored = loadUser();
      if (stored) {
        setUser(stored);
        setConversations(loadConversations());
        setScreen("home");
      } else {
        setScreen("auth");
      }
    }, 1800);
  }, []);

  // ── OTP Cooldown ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleAuth() {
    setAuthError("");
    const email = usePhone ? `${authPhone.replace(/\D/g, "")}@phone.confi` : authEmail.trim();
    if (!email || !authPassword) {
      setAuthError("Please fill in all fields.");
      return;
    }
    if (authMode === "signup" && !usePhone && !/\S+@\S+\.\S+/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (authMode === "signup" && authPassword.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email, password: authPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAuthError(data.error || "Authentication failed.");
        setAuthLoading(false);
        return;
      }

      if (authMode === "signup") {
        // Send OTP
        const otp = generateOTP();
        setOtpExpected(otp);
        setOtpTarget(usePhone ? authPhone : email);
        setOtpPendingData({ email, password: authPassword, phone: usePhone ? authPhone : "" });
        // In a real app this would send via Twilio/SendGrid
        // For demo, show it in console and an alert
        console.info(`[CONFI OTP] Your verification code is: ${otp}`);
        alert(`[Demo] Your OTP is: ${otp}\n\n(In production this is sent via SMS/Email)`);
        setOtpCooldown(60);
        setScreen("otp");
      } else {
        // Login — check if user profile exists
        const stored = loadUser();
        if (stored && stored.email === email) {
          setUser(stored);
          setConversations(loadConversations());
          setScreen("home");
        } else {
          // New device login, set minimal user
          const newUser: User = {
            email,
            displayName: email.split("@")[0],
            phone: "",
            avatarColor: randomColor(),
            legalName: "",
            idVerified: false,
            confidentialMode: false,
            joinedAt: new Date().toISOString(),
          };
          setUser(newUser);
          saveUser(newUser);
          setConversations(DEMO_CONVERSATIONS);
          saveConversations(DEMO_CONVERSATIONS);
          setScreen("home");
        }
      }
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setAuthLoading(false);
  }

  // ── OTP Verify ────────────────────────────────────────────────────────────

  function handleOTPVerify() {
    setOtpError("");
    if (otpCode.trim() !== otpExpected) {
      setOtpError("Incorrect code. Please try again.");
      return;
    }
    setScreen("identity");
  }

  function handleResendOTP() {
    const otp = generateOTP();
    setOtpExpected(otp);
    setOtpCode("");
    setOtpError("");
    console.info(`[CONFI OTP] Resent code: ${otp}`);
    alert(`[Demo] Resent OTP: ${otp}`);
    setOtpCooldown(60);
  }

  // ── Identity Verification ─────────────────────────────────────────────────

  function handleIDSubmit() {
    setIdError("");
    if (!idFirstName || !idLastName || !idDOB || !idCountry || !idNumber) {
      setIdError("Please complete all fields.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(idDOB)) {
      setIdError("Date of birth must be YYYY-MM-DD format.");
      return;
    }
    const age = (Date.now() - new Date(idDOB).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) {
      setIdError("You must be 18 or older to use Confi.");
      return;
    }
    setIdStep("reviewing");
    // Simulate async verification (Stripe Identity / Onfido would go here)
    setTimeout(() => {
      setIdStep("done");
    }, 3000);
  }

  function handleIDComplete() {
    const legalName = `${idFirstName.trim()} ${idLastName.trim()}`;
    const pending = otpPendingData;
    const email = pending?.email || authEmail;
    const phone = pending?.phone || authPhone;

    const newUser: User = {
      email,
      displayName: legalName,
      phone,
      avatarColor: randomColor(),
      legalName,
      idVerified: true,
      confidentialMode: false,
      joinedAt: new Date().toISOString(),
    };
    setUser(newUser);
    saveUser(newUser);
    setProfileDisplayName(legalName);
    setProfilePhone(phone);
    setConversations(DEMO_CONVERSATIONS);
    saveConversations(DEMO_CONVERSATIONS);
    setScreen("profile-setup");
  }

  // ── Profile Setup ─────────────────────────────────────────────────────────

  function handleProfileSave() {
    if (!profileDisplayName.trim()) {
      setProfileError("Please enter a display name.");
      return;
    }
    const updated: User = {
      ...user!,
      displayName: profileDisplayName.trim(),
      phone: profilePhone.trim(),
    };
    setUser(updated);
    saveUser(updated);
    setScreen("home");
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  function handleSendMessage() {
    if (!chatInput.trim() || !activeConvo || !user) return;
    const msg: Message = {
      id: generateId(),
      senderId: user.email,
      text: chatInput.trim(),
      timestamp: Date.now(),
      confidential: activeConvo.confidentialMode,
    };
    const updated = conversations.map(c =>
      c.id === activeConvo.id ? { ...c, messages: [...c.messages, msg] } : c
    );
    setConversations(updated);
    saveConversations(updated);
    const updatedConvo = updated.find(c => c.id === activeConvo.id)!;
    setActiveConvo(updatedConvo);
    setChatInput("");

    // Simulate reply
    setTimeout(() => {
      const replies = [
        "Got it, thanks!",
        "Understood.",
        "Can we discuss this further?",
        "I'll review and get back to you.",
        "Noted. Let's proceed.",
      ];
      const reply: Message = {
        id: generateId(),
        senderId: activeConvo.participantEmail,
        text: replies[Math.floor(Math.random() * replies.length)],
        timestamp: Date.now(),
        confidential: activeConvo.confidentialMode,
      };
      setConversations(prev => {
        const u = prev.map(c =>
          c.id === activeConvo.id ? { ...c, messages: [...c.messages, reply] } : c
        );
        saveConversations(u);
        setActiveConvo(u.find(c => c.id === activeConvo.id) || null);
        return u;
      });
    }, 1500 + Math.random() * 1500);
  }

  function toggleConversationConfidential(convoId: string) {
    if (!user?.idVerified) {
      alert("Identity verification is required to enable Confidential Mode. Please verify your ID in your profile settings.");
      return;
    }
    const updated = conversations.map(c =>
      c.id === convoId ? { ...c, confidentialMode: !c.confidentialMode } : c
    );
    setConversations(updated);
    saveConversations(updated);
    if (activeConvo?.id === convoId) {
      setActiveConvo(updated.find(c => c.id === convoId) || null);
    }
  }

  function toggleGlobalConfidential() {
    if (!user?.idVerified) {
      alert("You must complete identity verification before enabling Confidential Mode.");
      return;
    }
    const updated: User = { ...user, confidentialMode: !user.confidentialMode };
    setUser(updated);
    saveUser(updated);
  }

  // ── Profile Edit ──────────────────────────────────────────────────────────

  function handleSaveProfile() {
    if (!editDisplayName.trim()) return;
    const updated: User = { ...user!, displayName: editDisplayName.trim() };
    setUser(updated);
    saveUser(updated);
    setEditingProfile(false);
  }

  function handleLogout() {
    localStorage.removeItem("confi_user");
    setUser(null);
    setConversations([]);
    setActiveConvo(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthPhone("");
    setScreen("auth");
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // SPLASH
  if (screen === "splash") {
    return (
      <div style={styles.splashContainer}>
        <div style={styles.splashLogo}>🔏</div>
        <h1 style={styles.splashTitle}>Confi</h1>
        <p style={styles.splashSub}>Secure. Confidential. Legal.</p>
        <Spinner />
      </div>
    );
  }

  // AUTH
  if (screen === "auth") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔏</div>
            <h1 style={styles.authTitle}>Confi</h1>
            <p style={styles.authSub}>Messaging with legal protection</p>
          </div>

          <div style={styles.tabRow}>
            <button
              style={{ ...styles.tab, ...(authMode === "login" ? styles.tabActive : {}) }}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >Login</button>
            <button
              style={{ ...styles.tab, ...(authMode === "signup" ? styles.tabActive : {}) }}
              onClick={() => { setAuthMode("signup"); setAuthError(""); }}
            >Sign Up</button>
          </div>

          {authMode === "signup" && (
            <div style={styles.toggleRow}>
              <span style={styles.toggleLabel}>Use phone instead</span>
              <button
                style={{ ...styles.toggleBtn, background: usePhone ? "#6366f1" : "#e0e7ff" }}
                onClick={() => setUsePhone(p => !p)}
              >
                <span style={{
                  display: "block", width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", transform: usePhone ? "translateX(20px)" : "translateX(2px)",
                  transition: "transform 0.2s",
                }} />
              </button>
            </div>
          )}

          {usePhone && authMode === "signup" ? (
            <input
              style={styles.input}
              type="tel"
              placeholder="Phone number (+1 555 000 0000)"
              value={authPhone}
              onChange={e => setAuthPhone(e.target.value)}
            />
          ) : (
            <input
              style={styles.input}
              type="email"
              placeholder="Email address"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
            />
          )}

          <input
            style={styles.input}
            type="password"
            placeholder="Password (min 8 chars)"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
          />

          {authError && <div style={styles.errorBox}>{authError}</div>}

          <button
            style={{ ...styles.primaryBtn, opacity: authLoading ? 0.7 : 1 }}
            onClick={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? "Please wait…" : authMode === "signup" ? "Create Account" : "Sign In"}
          </button>

          {authMode === "signup" && (
            <p style={styles.finePrint}>
              By creating an account you agree to our Terms of Service. Identity verification is required to enable Confidential Mode and sign NDAs.
            </p>
          )}
        </div>
      </div>
    );
  }

  // OTP
  if (screen === "otp") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📱</div>
            <h2 style={styles.authTitle}>Verify Your {usePhone ? "Phone" : "Email"}</h2>
            <p style={styles.authSub}>
              We sent a 6-digit code to<br />
              <strong style={{ color: "#6366f1" }}>{otpTarget}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <input
                key={i}
                style={{
                  width: 44, height: 52, textAlign: "center",
                  fontSize: 22, fontWeight: 700,
                  border: "2px solid #c7d2fe", borderRadius: 10,
                  outline: "none", background: "#f8f9ff",
                  color: "#1e1b4b",
                }}
                maxLength={1}
                value={otpCode[i] || ""}
                onChange={e => {
                  const val = e.target.value.replace(/\D/, "");
                  const arr = otpCode.split("");
                  arr[i] = val;
                  setOtpCode(arr.join("").slice(0, 6));
                  if (val && i < 5) {
                    const next = document.getElementById(`otp-${i + 1}`);
                    if (next) (next as HTMLInputElement).focus();
                  }
                }}
                id={`otp-${i}`}
              />
            ))}
          </div>

          {otpError && <div style={styles.errorBox}>{otpError}</div>}

          <button style={styles.primaryBtn} onClick={handleOTPVerify}>
            Verify Code
          </button>

          <button
            style={{ ...styles.ghostBtn, marginTop: 12, opacity: otpCooldown > 0 ? 0.5 : 1 }}
            onClick={handleResendOTP}
            disabled={otpCooldown > 0}
          >
            {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend Code"}
          </button>
        </div>
      </div>
    );
  }

  // IDENTITY VERIFICATION
  if (screen === "identity") {
    return (
      <div style={styles.authContainer}>
        <div style={{ ...styles.authCard, maxWidth: 480 }}>
          {idStep === "form" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🪪</div>
                <h2 style={styles.authTitle}>Identity Verification</h2>
                <p style={styles.authSub}>
                  Required for NDA-binding Confidential Mode. Your legal name will be attached to any NDA agreements.
                </p>
              </div>

              <div style={styles.idBadge}>
                🔒 Government ID · Legally Binding · Encrypted Storage
              </div>

              <div style={styles.fieldRow}>
                <input
                  style={styles.input}
                  placeholder="Legal first name"
                  value={idFirstName}
                  onChange={e => setIdFirstName(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Legal last name"
                  value={idLastName}
                  onChange={e => setIdLastName(e.target.value)}
                />
              </div>

              <input
                style={styles.input}
                type="date"
                placeholder="Date of birth (YYYY-MM-DD)"
                value={idDOB}
                onChange={e => setIdDOB(e.target.value)}
              />

              <select style={styles.input} value={idCountry} onChange={e => setIdCountry(e.target.value)}>
                <option value="">Select issuing country</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
                <option value="SG">Singapore</option>
                <option value="IN">India</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
                <option value="ZA">South Africa</option>
                <option value="NG">Nigeria</option>
                <option value="AE">UAE</option>
                <option value="OTHER">Other</option>
              </select>

              <select style={styles.input} value={idType} onChange={e => setIdType(e.target.value)}>
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver&apos;s License</option>
                <option value="national_id">National ID Card</option>
                <option value="residence_permit">Residence Permit</option>
              </select>

              <input
                style={styles.input}
                placeholder="Document number"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
              />

              {idError && <div style={styles.errorBox}>{idError}</div>}

              <button style={styles.primaryBtn} onClick={handleIDSubmit}>
                Submit for Verification
              </button>

              <p style={styles.finePrint}>
                Your document details are encrypted and used solely for identity verification and NDA attribution. We never sell or share this data.
              </p>

              <button
                style={styles.ghostBtn}
                onClick={() => {
                  // Skip — user can verify later from profile
                  const email = otpPendingData?.email || authEmail;
                  const phone = otpPendingData?.phone || authPhone;
                  const newUser: User = {
                    email,
                    displayName: email.split("@")[0],
                    phone,
                    avatarColor: randomColor(),
                    legalName: "",
                    idVerified: false,
                    confidentialMode: false,
                    joinedAt: new Date().toISOString(),
                  };
                  setUser(newUser);
                  saveUser(newUser);
                  setConversations(DEMO_CONVERSATIONS);
                  saveConversations(DEMO_CONVERSATIONS);
                  setProfileDisplayName(newUser.displayName);
                  setScreen("profile-setup");
                }}
              >
                Skip for now (Confidential Mode unavailable)
              </button>
            </>
          )}

          {idStep === "reviewing" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
              <h2 style={{ color: "#1e1b4b", marginBottom: 8 }}>Reviewing Your ID</h2>
              <p style={{ color: "#64748b", marginBottom: 24 }}>
                Running automated verification checks…
              </p>
              <Spinner />
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                {["Document authenticity check", "Identity cross-reference", "Sanctions screening", "Age verification"].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#6366f1", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 11, color: "#fff",
                    }}>✓</div>
                    <span style={{ color: "#374151", fontSize: 14 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {idStep === "done" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: "#065f46", marginBottom: 8 }}>Identity Verified!</h2>
              <p style={{ color: "#374151", marginBottom: 8 }}>
                Legal name confirmed:
              </p>
              <div style={{
                background: "#ecfdf5", border: "2px solid #10b981",
                borderRadius: 10, padding: "12px 24px",
                fontSize: 18, fontWeight: 700, color: "#065f46",
                marginBottom: 24,
              }}>
                {idFirstName} {idLastName}
              </div>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
                Your identity has been verified and your legal name will be used for NDA attribution in Confidential Mode conversations.
              </p>
              <button style={styles.primaryBtn} onClick={handleIDComplete}>
                Continue to Profile Setup
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PROFILE SETUP
  if (screen === "profile-setup") {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>👤</div>
            <h2 style={styles.authTitle}>Set Up Your Profile</h2>
            <p style={styles.authSub}>How others will see you on Confi</p>
          </div>

          {user && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <Avatar name={profileDisplayName || "?"} color={user.avatarColor} size={72} />
            </div>
          )}

          <input
            style={styles.input}
            placeholder="Display name (visible to others)"
            value={profileDisplayName}
            onChange={e => setProfileDisplayName(e.target.value)}
          />

          {!usePhone && (
            <input
              style={styles.input}
              type="tel"
              placeholder="Phone number (optional)"
              value={profilePhone}
              onChange={e => setProfilePhone(e.target.value)}
            />
          )}

          {profileError && <div style={styles.errorBox}>{profileError}</div>}

          <button style={styles.primaryBtn} onClick={handleProfileSave}>
            Enter Confi
          </button>
        </div>
      </div>
    );
  }

  // HOME
  if (screen === "home" && user) {
    const lastMessages = conversations.map(c => {
      const last = c.messages[c.messages.length - 1];
      return { ...c, lastMessage: last };
    });

    return (
      <div style={styles.appShell}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={user.displayName} color={user.avatarColor} size={38} />
              <div>
                <div style={{ fontWeight: 700, color: "#1e1b4b", fontSize: 15 }}>{user.displayName}</div>
                <div style={{ fontSize: 11, color: user.idVerified ? "#10b981" : "#f59e0b" }}>
                  {user.idVerified ? "✓ ID Verified" : "⚠ Unverified"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={styles.iconBtn}
                title="Profile"
                onClick={() => {
                  setEditDisplayName(user.displayName);
                  setEditingProfile(false);
                  setScreen("profile");
                }}
              >⚙️</button>
            </div>
          </div>

          <div style={styles.searchBar}>
            <input style={styles.searchInput} placeholder="🔍  Search conversations…" readOnly />
          </div>

          <div style={styles.convoList}>
            {lastMessages.map(c => (
              <div
                key={c.id}
                style={{
                  ...styles.convoItem,
                  background: activeConvo?.id === c.id ? "#ede9fe" : "transparent",
                }}
                onClick={() => { setActiveConvo(c); setScreen("chat"); }}
              >
                <Avatar name={c.participantName} color={c.participantColor} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#1e1b4b", fontSize: 14 }}>{c.participantName}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      {c.lastMessage ? formatTime(c.lastMessage.timestamp) : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {c.confidentialMode && <span style={{ fontSize: 11 }}>🔏</span>}
                    <span style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.lastMessage
                        ? c.confidentialMode
                          ? "🔏 Confidential message"
                          : c.lastMessage.text
                        : "No messages yet"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Welcome panel */}
        <div style={styles.chatArea}>
          <div style={styles.welcomePanel}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔏</div>
            <h2 style={{ color: "#1e1b4b", marginBottom: 8 }}>Welcome to Confi</h2>
            <p style={{ color: "#64748b", maxWidth: 360, textAlign: "center", lineHeight: 1.6 }}>
              Select a conversation to start messaging. Enable Confidential Mode to activate an international NDA that legally binds all parties to confidentiality.
            </p>
            {!user.idVerified && (
              <div style={{ ...styles.idBadge, marginTop: 20, cursor: "pointer" }}
                onClick={() => {
                  setIdStep("form");
                  setScreen("identity");
                }}>
                ⚠ Complete ID verification to enable Confidential Mode →
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CHAT
  if (screen === "chat" && user && activeConvo) {
    const groupedMessages: { date: string; messages: Message[] }[] = [];
    activeConvo.messages.forEach(msg => {
      const date = formatDate(msg.timestamp);
      const last = groupedMessages[groupedMessages.length - 1];
      if (last && last.date === date) {
        last.messages.push(msg);
      } else {
        groupedMessages.push({ date, messages: [msg] });
      }
    });

    return (
      <div style={styles.appShell}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={user.displayName} color={user.avatarColor} size={38} />
              <div>
                <div style={{ fontWeight: 700, color: "#1e1b4b", fontSize: 15 }}>{user.displayName}</div>
                <div style={{ fontSize: 11, color: user.idVerified ? "#10b981" : "#f59e0b" }}>
                  {user.idVerified ? "✓ ID Verified" : "⚠ Unverified"}
                </div>
              </div>
            </div>
            <button
              style={styles.iconBtn}
              onClick={() => {
                setEditDisplayName(user.displayName);
                setEditingProfile(false);
                setScreen("profile");
              }}
            >⚙️</button>
          </div>

          <div style={styles.searchBar}>
            <input style={styles.searchInput} placeholder="🔍  Search conversations…" readOnly />
          </div>

          <div style={styles.convoList}>
            {conversations.map(c => {
              const last = c.messages[c.messages.length - 1];
              return (
                <div
                  key={c.id}
                  style={{
                    ...styles.convoItem,
                    background: activeConvo?.id === c.id ? "#ede9fe" : "transparent",
                  }}
                  onClick={() => setActiveConvo(c)}
                >
                  <Avatar name={c.participantName} color={c.participantColor} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, color: "#1e1b4b", fontSize: 14 }}>{c.participantName}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {last ? formatTime(last.timestamp) : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {c.confidentialMode && <span style={{ fontSize: 11 }}>🔏</span>}
                      <span style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {last ? (c.confidentialMode ? "🔏 Confidential message" : last.text) : "No messages yet"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div style={styles.chatArea}>
          {/* Chat header */}
          <div style={styles.chatHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={activeConvo.participantName} color={activeConvo.participantColor} size={40} />
              <div>
                <div style={{ fontWeight: 700, color: "#1e1b4b" }}>{activeConvo.participantName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{activeConvo.lastSeen}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: activeConvo.confidentialMode ? "#6366f1" : "#94a3b8", fontWeight: 600 }}>
                  {activeConvo.confidentialMode ? "🔏 Confidential" : "Standard"}
                </span>
                <button
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: activeConvo.confidentialMode ? "#6366f1" : "#cbd5e1",
                    border: "none", cursor: "pointer", position: "relative",
                    transition: "background 0.2s",
                  }}
                  onClick={() => toggleConversationConfidential(activeConvo.id)}
                  title="Toggle Confidential Mode"
                >
                  <span style={{
                    position: "absolute", top: 3,
                    left: activeConvo.confidentialMode ? 22 : 2,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                  }} />
                </button>
              </div>
              <button
                style={styles.iconBtn}
                onClick={() => setScreen("home")}
                title="Back"
              >✕</button>
            </div>
          </div>

          {/* NDA Banner */}
          {activeConvo.confidentialMode && (
            <div style={{ padding: "0 16px" }}>
              <NDABanner />
            </div>
          )}

          {/* Messages */}
          <div style={styles.messageList}>
            {groupedMessages.map((group, gi) => (
              <div key={gi}>
                <div style={styles.dateSeparator}>{group.date}</div>
                {group.messages.map(msg => {
                  const isMe = msg.senderId === user.email || msg.senderId === "me";
                  return (
                    <div key={msg.id} style={{
                      display: "flex",
                      justifyContent: isMe ? "flex-end" : "flex-start",
                      marginBottom: 8,
                      padding: "0 16px",
                    }}>
                      {!isMe && (
                        <Avatar name={activeConvo.participantName} color={activeConvo.participantColor} size={28} />
                      )}
                      <div style={{
                        maxWidth: "65%",
                        marginLeft: isMe ? 0 : 8,
                        marginRight: isMe ? 0 : 0,
                      }}>
                        <div style={{
                          background: isMe
                            ? (msg.confidential ? "#312e81" : "#6366f1")
                            : (msg.confidential ? "#1e1b4b" : "#f1f5f9"),
                          color: isMe || msg.confidential ? "#fff" : "#1e1b4b",
                          padding: "10px 14px",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          fontSize: 14,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                        }}>
                          {msg.confidential && (
                            <div style={{ fontSize: 10, color: "#a5b4fc", marginBottom: 4, letterSpacing: 0.5 }}>
                              🔏 NDA PROTECTED
                            </div>
                          )}
                          {msg.text}
                        </div>
                        <div style={{
                          fontSize: 11, color: "#94a3b8",
                          textAlign: isMe ? "right" : "left",
                          marginTop: 3,
                        }}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={styles.inputRow}>
            <input
              style={styles.messageInput}
              placeholder={activeConvo.confidentialMode ? "🔏 Confidential message…" : "Message…"}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            />
            <button
              style={{
                ...styles.sendBtn,
                background: activeConvo.confidentialMode ? "#312e81" : "#6366f1",
              }}
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
            >
              ➤
            </button>
          </div>

          {activeConvo.confidentialMode && user.legalName && (
            <div style={{ padding: "4px 16px 8px", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
              NDA attributed to: <strong>{user.legalName}</strong> · Legally binding international agreement
            </div>
          )}
        </div>
      </div>
    );
  }

  // PROFILE
  if (screen === "profile" && user) {
    return (
      <div style={styles.appShell}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <button style={styles.ghostBtn} onClick={() => setScreen("home")}>← Back</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "#f8f9ff" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px" }}>
            <h2 style={{ color: "#1e1b4b", marginBottom: 24, fontSize: 22 }}>Your Profile</h2>

            {/* Avatar + name */}
            <div style={styles.profileCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                <Avatar name={user.displayName} color={user.avatarColor} size={72} />
                <div>
                  {editingProfile ? (
                    <input
                      style={{ ...styles.input, marginBottom: 0 }}
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#1e1b4b" }}>{user.displayName}</div>
                  )}
                  <div style={{ fontSize: 13, color: "#64748b" }}>{user.email}</div>
                  {user.phone && <div style={{ fontSize: 13, color: "#64748b" }}>{user.phone}</div>}
                </div>
              </div>
              {editingProfile ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.primaryBtn} onClick={handleSaveProfile}>Save</button>
                  <button style={styles.ghostBtn} onClick={() => setEditingProfile(false)}>Cancel</button>
                </div>
              ) : (
                <button style={styles.ghostBtn} onClick={() => { setEditDisplayName(user.displayName); setEditingProfile(true); }}>
                  Edit Display Name
                </button>
              )}
            </div>

            {/* Identity status */}
            <div style={styles.profileCard}>
              <h3 style={{ color: "#1e1b4b", marginBottom: 16, fontSize: 16 }}>Identity Verification</h3>
              {user.idVerified ? (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", background: "#ecfdf5",
                    borderRadius: 10, border: "1px solid #10b981", marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#065f46" }}>Identity Verified</div>
                      <div style={{ fontSize: 13, color: "#047857" }}>Legal name: {user.legalName}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Your verified legal name will be attributed to all NDA agreements in Confidential Mode conversations.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", background: "#fffbeb",
                    borderRadius: 10, border: "1px solid #f59e0b", marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#92400e" }}>Not Verified</div>
                      <div style={{ fontSize: 13, color: "#b45309" }}>Required for Confidential Mode</div>
                    </div>
                  </div>
                  <button
                    style={styles.primaryBtn}
                    onClick={() => { setIdStep("form"); setScreen("identity"); }}
                  >
                    Verify Identity Now
                  </button>
                </div>
              )}
            </div>

            {/* Confidential mode */}
            <div style={styles.profileCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 4 }}>
                    🔏 Confidential Mode
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", maxWidth: 280 }}>
                    Activate global Confidential Mode — all new conversations will be NDA-protected.
                  </div>
                </div>
                <button
                  style={{
                    width: 52, height: 28, borderRadius: 14,
                    background: user.confidentialMode ? "#6366f1" : "#cbd5e1",
                    border: "none", cursor: "pointer", position: "relative",
                    transition: "background 0.2s", flexShrink: 0,
                  }}
                  onClick={toggleGlobalConfidential}
                >
                  <span style={{
                    position: "absolute", top: 4,
                    left: user.confidentialMode ? 26 : 4,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                  }} />
                </button>
              </div>
              {!user.idVerified && (
                <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 8 }}>
                  ⚠ Requires identity verification
                </div>
              )}
            </div>

            {/* NDA info */}
            <div style={styles.profileCard}>
              <h3 style={{ color: "#1e1b4b", marginBottom: 12, fontSize: 16 }}>About Confidential Mode</h3>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                <p style={{ marginBottom: 8 }}>
                  When Confidential Mode is enabled on a conversation, all parties automatically enter into a legally binding <strong>International Non-Disclosure Agreement (NDA)</strong>.
                </p>
                <p style={{ marginBottom: 8 }}>
                  The NDA covers all content exchanged within that conversation thread and is governed by international confidentiality law. Your verified legal name is used as the signatory.
                </p>
                <p>
                  Breaching confidentiality in a Confi Confidential conversation may result in legal liability under applicable NDA law in your jurisdiction.
                </p>
              </div>
            </div>

            {/* Joined */}
            <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginBottom: 16 }}>
              Member since {new Date(user.joinedAt).toLocaleDateString()}
            </div>

            <button
              style={{ ...styles.ghostBtn, color: "#ef4444", borderColor: "#fecaca", width: "100%" }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  splashContainer: {
    minHeight: "100vh",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)",
  },
  splashLogo: {
    fontSize: 72, marginBottom: 12,
  },
  splashTitle: {
    color: "#fff", fontSize: 42, fontWeight: 800,
    letterSpacing: -1, margin: 0,
  },
  splashSub: {
    color: "#a5b4fc", fontSize: 16, marginBottom: 32, marginTop: 6,
  },

  authContainer: {
    minHeight: "100vh",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #f0f4ff 0%, #e8eaff 100%)",
    padding: 16,
  },
  authCard: {
    background: "#fff", borderRadius: 20,
    padding: "36px 32px",
    width: "100%", maxWidth: 400,
    boxShadow: "0 20px 60px rgba(99,102,241,0.15)",
  },
  authTitle: {
    color: "#1e1b4b", fontSize: 26, fontWeight: 800,
    margin: "0 0 4px", letterSpacing: -0.5,
  },
  authSub: {
    color: "#64748b", fontSize: 14, margin: 0,
  },

  tabRow: {
    display: "flex", background: "#f1f5f9",
    borderRadius: 10, padding: 4, marginBottom: 20,
  },
  tab: {
    flex: 1, padding: "8px 0", border: "none",
    background: "transparent", borderRadius: 8,
    cursor: "pointer", fontSize: 14, fontWeight: 600,
    color: "#64748b", transition: "all 0.2s",
  },
  tabActive: {
    background: "#fff", color: "#6366f1",
    boxShadow: "0 2px 8px rgba(99,102,241,0.15)",
  },

  toggleRow: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 13, color: "#64748b",
  },
  toggleBtn: {
    width: 44, height: 24, borderRadius: 12,
    border: "none", cursor: "pointer",
    display: "flex", alignItems: "center",
    transition: "background 0.2s", padding: 0,
  },

  input: {
    width: "100%", padding: "12px 14px",
    border: "2px solid #e2e8f0", borderRadius: 10,
    fontSize: 14, color: "#1e1b4b",
    background: "#f8f9ff", marginBottom: 12,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  },

  errorBox: {
    background: "#fef2f2", border: "1px solid #fecaca",
    color: "#dc2626", padding: "10px 14px",
    borderRadius: 8, fontSize: 13, marginBottom: 12,
  },

  primaryBtn: {
    width: "100%", padding: "13px 0",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    letterSpacing: 0.3, transition: "opacity 0.2s",
  },

  ghostBtn: {
    width: "100%", padding: "11px 0",
    background: "transparent", color: "#6366f1",
    border: "2px solid #e0e7ff", borderRadius: 12,
    fontSize: 14, fontWeight: 600, cursor: "pointer",
  },

  finePrint: {
    fontSize: 11, color: "#94a3b8",
    textAlign: "center", marginTop: 12,
    lineHeight: 1.5,
  },

  idBadge: {
    background: "#ede9fe", color: "#5b21b6",
    borderRadius: 8, padding: "8px 14px",
    fontSize: 12, fontWeight: 700,
    textAlign: "center", marginBottom: 16,
    border: "1px solid #c4b5fd",
  },

  fieldRow: {
    display: "flex", gap: 8,
  },

  // App shell
  appShell: {
    display: "flex", height: "100vh",
    background: "#f8f9ff", overflow: "hidden",
  },

  sidebar: {
    width: 320, flexShrink: 0,
    background: "#fff", borderRight: "1px solid #e2e8f0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
  },

  sidebarHeader: {
    padding: "16px", borderBottom: "1px solid #e2e8f0",
    display: "flex", alignItems: "center",
    justifyContent: "space-between", background: "#fff",
  },

  searchBar: {
    padding: "10px 12px", borderBottom: "1px solid #f1f5f9",
  },

  searchInput: {
    width: "100%", padding: "8px 12px",
    border: "1px solid #e2e8f0", borderRadius: 20,
    fontSize: 13, color: "#64748b",
    background: "#f8f9ff", outline: "none",
    boxSizing: "border-box",
  },

  convoList: {
    flex: 1, overflowY: "auto",
  },

  convoItem: {
    display: "flex", alignItems: "center",
    gap: 12, padding: "12px 16px",
    cursor: "pointer", borderBottom: "1px solid #f8f9ff",
    transition: "background 0.15s",
  },

  iconBtn: {
    background: "transparent", border: "none",
    cursor: "pointer", fontSize: 18, padding: 4,
    borderRadius: 8,
  },

  // Chat area
  chatArea: {
    flex: 1, display: "flex", flexDirection: "column",
    overflow: "hidden",
  },

  chatHeader: {
    padding: "12px 16px", background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },

  messageList: {
    flex: 1, overflowY: "auto",
    padding: "16px 0",
  },

  dateSeparator: {
    textAlign: "center" as const,
    fontSize: 12, color: "#94a3b8",
    margin: "12px 0", padding: "4px 12px",
    background: "#f1f5f9", borderRadius: 20,
    display: "inline-block",
    position: "relative" as const,
    left: "50%",
    transform: "translateX(-50%)",
  },

  inputRow: {
    display: "flex", gap: 8,
    padding: "12px 16px",
    background: "#fff", borderTop: "1px solid #e2e8f0",
    alignItems: "center",
  },

  messageInput: {
    flex: 1, padding: "12px 16px",
    border: "2px solid #e2e8f0", borderRadius: 24,
    fontSize: 14, color: "#1e1b4b",
    background: "#f8f9ff", outline: "none",
  },

  sendBtn: {
    width: 44, height: 44, borderRadius: "50%",
    background: "#6366f1", color: "#fff",
    border: "none", cursor: "pointer",
    fontSize: 18, display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  welcomePanel: {
    flex: 1, display: "flex",
    flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center",
    padding: 32,
  },

  // Profile
  profileCard: {
    background: "#fff", borderRadius: 16,
    padding: "20px 24px", marginBottom: 16,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
};