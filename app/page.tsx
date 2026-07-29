"use client";

import { useEffect, useState, useRef } from "react";

// ---------- Types ----------
interface User {
  confiId: string;
  email: string;
  phone: string;
  displayName: string;
  avatar: string;
  bio: string;
  createdAt: string;
}

interface Contact {
  confiId: string;
  displayName: string;
  avatar: string;
  phone: string;
  lastSeen: string;
}

interface Message {
  id: string;
  fromConfiId: string;
  toConfiId: string;
  text: string;
  ts: string;
  confidential: boolean;
  ndaAccepted?: boolean;
}

interface Conversation {
  contact: Contact;
  messages: Message[];
  confidentialMode: boolean;
}

type Screen =
  | "splash"
  | "phone-entry"
  | "otp-verify"
  | "profile-setup"
  | "recovery-setup"
  | "home"
  | "chat"
  | "profile-view"
  | "account-recovery";

// ---------- Helpers ----------
function generateConfiId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "CNFI-";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) id += "-";
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function avatarUrl(seed: string, size = 80): string {
  const colors = ["4F46E5", "7C3AED", "DB2777", "059669", "D97706", "DC2626"];
  const color = colors[Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length];
  const initials = seed.slice(0, 2).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${size / 2}" fill="#${color}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="${size * 0.35}" fill="white" font-weight="600">${initials}</text></svg>`
  )}`;
}

// ---------- Mock contacts data ----------
const MOCK_CONTACTS: Contact[] = [
  { confiId: "CNFI-DEMO-0001-XXXX", displayName: "Alice Monroe", avatar: "", phone: "+1 (555) 234-5678", lastSeen: new Date(Date.now() - 300000).toISOString() },
  { confiId: "CNFI-DEMO-0002-XXXX", displayName: "Bob Tran", avatar: "", phone: "+1 (555) 345-6789", lastSeen: new Date(Date.now() - 3600000).toISOString() },
  { confiId: "CNFI-DEMO-0003-XXXX", displayName: "Clara Singh", avatar: "", phone: "+44 20 7946 0958", lastSeen: new Date(Date.now() - 86400000).toISOString() },
  { confiId: "CNFI-DEMO-0004-XXXX", displayName: "David Park", avatar: "", phone: "+82 10-1234-5678", lastSeen: new Date(Date.now() - 172800000).toISOString() },
];

MOCK_CONTACTS.forEach((c) => { if (!c.avatar) c.avatar = avatarUrl(c.displayName); });

const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of acceptance between the parties engaging in this conversation via Confi Messaging Platform.

1. CONFIDENTIALITY OBLIGATION
All information shared within this conversation designated as "Confidential" shall be treated as proprietary and confidential. Parties agree not to disclose, reproduce, or transmit any such information to third parties without prior written consent.

2. JURISDICTION & GOVERNING LAW
This Agreement is governed by international commercial law principles, including but not limited to UNCITRAL Model Law provisions, and is enforceable across all signatory nations of the Hague Convention on Choice of Court Agreements.

3. SCOPE OF PROTECTION
Confidential information includes but is not limited to: business strategies, financial data, personal information, technical specifications, and any other material shared within this confidential conversation thread.

4. DURATION
This obligation of confidentiality shall remain in effect for a period of five (5) years from the date of disclosure, or indefinitely for information constituting trade secrets.

5. BINDING ON SUCCESSORS
This Agreement is binding upon and inures to the benefit of the parties and their respective heirs, executors, administrators, legal representatives, successors, and assigns.

6. DIGITAL SIGNATURE & CONFI ID BINDING
Your Confi User ID serves as your digital signature and is cryptographically bound to your verified phone number. Acceptance of this Agreement constitutes a legally binding electronic signature under applicable e-signature laws including the U.S. ESIGN Act and EU eIDAS Regulation.

7. REMEDIES
Breach of this Agreement may result in injunctive relief, monetary damages, and legal fees. Parties consent to jurisdiction in the venue of the enforcing party's choice.

By tapping "Accept & Enable Confidential Mode", you electronically sign this Agreement and agree to all terms herein.`;

// ---------- Main Component ----------
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpError, setOtpError] = useState("");
  const [profileData, setProfileData] = useState({ displayName: "", bio: "" });
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [conversations, setConversations] = useState<Map<string, Conversation>>(new Map());
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showNDA, setShowNDA] = useState(false);
  const [ndaConvoId, setNdaConvoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({ displayName: "", bio: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track page
  useEffect(() => {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: window.location.pathname }) }).catch(() => {});
  }, []);

  // Load session
  useEffect(() => {
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        const u = JSON.parse(stored) as User;
        setUser(u);
        initConversations(u.confiId);
        setScreen("home");
      } catch { /* ignore */ }
    }
    const splashTimer = setTimeout(() => {
      if (!localStorage.getItem("confi_user")) setScreen("phone-entry");
    }, 2000);
    return () => clearTimeout(splashTimer);
  }, []);

  // OTP timer
  useEffect(() => {
    if (screen === "otp-verify") {
      setOtpTimer(60);
      timerRef.current = setInterval(() => {
        setOtpTimer((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConvo]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function initConversations(myConfiId: string) {
    const stored = localStorage.getItem(`confi_convos_${myConfiId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored) as Array<[string, Conversation]>;
        setConversations(new Map(data));
        return;
      } catch { /* fallback */ }
    }
    // Seed with mock conversations
    const initial = new Map<string, Conversation>();
    MOCK_CONTACTS.slice(0, 2).forEach((contact) => {
      initial.set(contact.confiId, {
        contact,
        messages: [
          {
            id: `msg_${Date.now()}_1`,
            fromConfiId: contact.confiId,
            toConfiId: myConfiId,
            text: `Hey! Welcome to Confi. I'm ${contact.displayName} 👋`,
            ts: new Date(Date.now() - 3600000).toISOString(),
            confidential: false,
          },
          {
            id: `msg_${Date.now()}_2`,
            fromConfiId: myConfiId,
            toConfiId: contact.confiId,
            text: "Thanks! Excited to try this out.",
            ts: new Date(Date.now() - 3500000).toISOString(),
            confidential: false,
          },
        ],
        confidentialMode: false,
      });
    });
    setConversations(initial);
    saveConversations(myConfiId, initial);
  }

  function saveConversations(confiId: string, convos: Map<string, Conversation>) {
    localStorage.setItem(`confi_convos_${confiId}`, JSON.stringify(Array.from(convos.entries())));
  }

  // ---------- Auth Flow ----------
  async function handleSendOTP() {
    if (phone.replace(/\D/g, "").length < 7) { setError("Enter a valid phone number."); return; }
    setLoading(true);
    setError("");
    const otp = generateOTP();
    setGeneratedOtp(otp);
    // Simulate SMS delay
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setScreen("otp-verify");
    showToast(`📱 OTP sent! (Demo: ${otp})`);
  }

  async function handleVerifyOTP() {
    setOtpError("");
    if (otp.length !== 6) { setOtpError("Enter the 6-digit code."); return; }
    if (otp !== generatedOtp) { setOtpError("Incorrect code. Please try again."); return; }

    setLoading(true);
    const fullPhone = `${countryCode}${phone}`;
    const emailFallback = `${fullPhone.replace(/\D/g, "")}@confi.app`;

    // Check existing user
    const existing = localStorage.getItem("confi_user");
    if (existing) {
      const u = JSON.parse(existing) as User;
      if (u.phone === fullPhone) {
        setUser(u);
        initConversations(u.confiId);
        setLoading(false);
        setScreen("home");
        return;
      }
    }

    // Register via /api/auth
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: emailFallback, password: `otp_${otp}_${Date.now()}` }),
      });
      const data = await res.json();
      if (data.error && !data.error.includes("already")) {
        // Try login
        const res2 = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "login", email: emailFallback, password: `otp_fallback` }),
        });
        const d2 = await res2.json();
        if (d2.error) { setError("Auth error. Please try again."); setLoading(false); return; }
      }
    } catch { /* continue — local fallback */ }

    setLoading(false);
    setProfileData({ displayName: "", bio: "" });
    setScreen("profile-setup");
  }

  async function handleProfileSubmit() {
    if (!profileData.displayName.trim()) { setError("Display name is required."); return; }
    setLoading(true);
    const fullPhone = `${countryCode}${phone}`;
    const newUser: User = {
      confiId: generateConfiId(),
      email: `${fullPhone.replace(/\D/g, "")}@confi.app`,
      phone: fullPhone,
      displayName: profileData.displayName.trim(),
      avatar: avatarUrl(profileData.displayName.trim()),
      bio: profileData.bio.trim(),
      createdAt: new Date().toISOString(),
    };
    await new Promise((r) => setTimeout(r, 500));
    localStorage.setItem("confi_user", JSON.stringify(newUser));
    setUser(newUser);
    initConversations(newUser.confiId);
    setLoading(false);
    setScreen("recovery-setup");
  }

  function handleRecoverySetup() {
    if (recoveryEmail && !recoveryEmail.includes("@")) { setError("Enter a valid email."); return; }
    if (recoveryPin && recoveryPin.length < 4) { setError("PIN must be at least 4 digits."); return; }
    localStorage.setItem("confi_recovery", JSON.stringify({ email: recoveryEmail, pin: recoveryPin, confiId: user?.confiId }));
    setScreen("home");
    showToast("✅ Account recovery configured!");
  }

  function handleAccountRecovery() {
    const stored = localStorage.getItem("confi_recovery");
    if (!stored) { setError("No recovery info found."); return; }
    const rec = JSON.parse(stored);
    if (recoveryEmail !== rec.email && recoveryPin !== rec.pin) { setError("Recovery details don't match."); return; }
    const u = localStorage.getItem("confi_user");
    if (u) {
      const parsed = JSON.parse(u) as User;
      setUser(parsed);
      initConversations(parsed.confiId);
      setScreen("home");
      showToast("✅ Account recovered successfully!");
    } else {
      setError("No account found with these details.");
    }
  }

  function handleLogout() {
    setUser(null);
    setConversations(new Map());
    setScreen("phone-entry");
    setPhone("");
    setOtp("");
    setError("");
  }

  // ---------- Chat ----------
  function openChat(confiId: string) {
    if (!conversations.has(confiId)) {
      const contact = MOCK_CONTACTS.find((c) => c.confiId === confiId)!;
      const newConvo: Conversation = { contact, messages: [], confidentialMode: false };
      const updated = new Map(conversations);
      updated.set(confiId, newConvo);
      setConversations(updated);
      saveConversations(user!.confiId, updated);
    }
    setActiveConvo(confiId);
    setScreen("chat");
  }

  function sendMessage() {
    if (!messageInput.trim() || !activeConvo || !user) return;
    const convo = conversations.get(activeConvo)!;
    const msg: Message = {
      id: `msg_${Date.now()}`,
      fromConfiId: user.confiId,
      toConfiId: activeConvo,
      text: messageInput.trim(),
      ts: new Date().toISOString(),
      confidential: convo.confidentialMode,
      ndaAccepted: convo.confidentialMode,
    };
    const updated = new Map(conversations);
    const updatedConvo = { ...convo, messages: [...convo.messages, msg] };
    updated.set(activeConvo, updatedConvo);
    setConversations(updated);
    saveConversations(user.confiId, updated);
    setMessageInput("");

    // Simulate reply after delay
    setTimeout(() => {
      const replies = [
        "Got it, thanks!",
        "Interesting, tell me more.",
        "👍",
        "That makes sense.",
        "I'll look into that.",
        "Absolutely agree.",
        "Let's discuss further.",
      ];
      const reply: Message = {
        id: `msg_${Date.now()}_r`,
        fromConfiId: activeConvo,
        toConfiId: user.confiId,
        text: replies[Math.floor(Math.random() * replies.length)],
        ts: new Date().toISOString(),
        confidential: updatedConvo.confidentialMode,
        ndaAccepted: updatedConvo.confidentialMode,
      };
      setConversations((prev) => {
        const c = prev.get(activeConvo);
        if (!c) return prev;
        const m = new Map(prev);
        const updated2 = { ...c, messages: [...c.messages, reply] };
        m.set(activeConvo, updated2);
        saveConversations(user.confiId, m);
        return m;
      });
    }, 1200 + Math.random() * 1000);
  }

  function requestConfidentialMode(convoId: string) {
    setNdaConvoId(convoId);
    setShowNDA(true);
  }

  function acceptNDA() {
    if (!ndaConvoId || !user) return;
    const updated = new Map(conversations);
    const convo = updated.get(ndaConvoId);
    if (convo) {
      const systemMsg: Message = {
        id: `msg_nda_${Date.now()}`,
        fromConfiId: "SYSTEM",
        toConfiId: ndaConvoId,
        text: `🔒 CONFIDENTIAL MODE ACTIVATED\n\nBoth parties have digitally signed the International NDA via Confi ID: ${user.confiId}\n\nAll subsequent messages are protected under international confidentiality law.`,
        ts: new Date().toISOString(),
        confidential: true,
        ndaAccepted: true,
      };
      updated.set(ndaConvoId, { ...convo, confidentialMode: true, messages: [...convo.messages, systemMsg] });
      setConversations(updated);
      saveConversations(user.confiId, updated);
    }
    setShowNDA(false);
    setNdaConvoId(null);
    showToast("🔒 Confidential mode activated — NDA signed");
  }

  function disableConfidentialMode(convoId: string) {
    const updated = new Map(conversations);
    const convo = updated.get(convoId);
    if (convo) {
      const systemMsg: Message = {
        id: `msg_nda_off_${Date.now()}`,
        fromConfiId: "SYSTEM",
        toConfiId: convoId,
        text: "🔓 Confidential mode deactivated. Standard messaging resumed.",
        ts: new Date().toISOString(),
        confidential: false,
      };
      updated.set(convoId, { ...convo, confidentialMode: false, messages: [...convo.messages, systemMsg] });
      setConversations(updated);
      saveConversations(user!.confiId, updated);
    }
    showToast("🔓 Confidential mode disabled");
  }

  function saveProfileEdit() {
    if (!editProfile.displayName.trim() || !user) return;
    const updated: User = {
      ...user,
      displayName: editProfile.displayName.trim(),
      bio: editProfile.bio.trim(),
      avatar: avatarUrl(editProfile.displayName.trim()),
    };
    setUser(updated);
    localStorage.setItem("confi_user", JSON.stringify(updated));
    setEditingProfile(false);
    showToast("✅ Profile updated!");
  }

  const filteredContacts = MOCK_CONTACTS.filter(
    (c) =>
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const conversationList = Array.from(conversations.values()).sort((a, b) => {
    const aLast = a.messages[a.messages.length - 1]?.ts ?? "";
    const bLast = b.messages[b.messages.length - 1]?.ts ?? "";
    return bLast.localeCompare(aLast);
  });

  // ===================== RENDER =====================

  const styles = {
    app: {
      maxWidth: 430,
      margin: "0 auto",
      height: "100dvh",
      display: "flex",
      flexDirection: "column" as const,
      background: "#fff",
      position: "relative" as const,
      overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxShadow: "0 0 40px rgba(0,0,0,0.15)",
    },
  };

  // ---- SPLASH ----
  if (screen === "splash") {
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, backdropFilter: "blur(10px)", border: "2px solid rgba(255,255,255,0.3)" }}>
            <span style={{ fontSize: 40 }}>🔐</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: -1 }}>Confi</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", marginTop: 8, fontSize: 15 }}>Confidential Messaging, Globally Protected</p>
          <div style={{ marginTop: 40, display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i === 0 ? "#fff" : "rgba(255,255,255,0.4)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- PHONE ENTRY ----
  if (screen === "phone-entry") {
    const countryCodes = ["+1", "+44", "+91", "+61", "+33", "+49", "+81", "+86", "+82", "+55", "+34", "+39", "+7", "+971", "+65"];
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 32px" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🔐</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "#111" }}>Enter your number</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 15, lineHeight: 1.5 }}>We'll send a one-time verification code to your phone.</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>PHONE NUMBER</label>
            <div style={{ display: "flex", gap: 10 }}>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={{ padding: "14px 12px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 15, fontWeight: 600, color: "#111", background: "#f9fafb", cursor: "pointer" }}>
                {countryCodes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                style={{ flex: 1, padding: "14px 16px", borderRadius: 12, border: `2px solid ${error ? "#ef4444" : "#e5e7eb"}`, fontSize: 16, fontFamily: "inherit", outline: "none", color: "#111" }}
              />
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 6 }}>{error}</p>}
          </div>

          <button
            onClick={handleSendOTP}
            disabled={loading}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: loading ? "#a5b4fc" : "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginBottom: 16 }}
          >
            {loading ? "Sending…" : "Send Verification Code"}
          </button>

          <button onClick={() => { setRecoveryMode(true); setScreen("account-recovery"); }} style={{ background: "none", border: "none", color: "#4F46E5", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 8 }}>
            Recover existing account →
          </button>

          <div style={{ marginTop: "auto", padding: "16px 0 0", borderTop: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              By continuing, you agree to Confi's Terms of Service and Privacy Policy. Your number is used only for verification.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- OTP VERIFY ----
  if (screen === "otp-verify") {
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 32px" }}>
          <button onClick={() => { setScreen("phone-entry"); setOtp(""); setOtpError(""); }} style={{ background: "none", border: "none", color: "#4F46E5", fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0, marginBottom: 32 }}>
            ← Back
          </button>

          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#f0f0ff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>📱</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", color: "#111" }}>Verify your number</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Enter the 6-digit code sent to <strong>{countryCode} {phone}</strong>
            </p>
          </div>

          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
              style={{ width: "100%", padding: "18px 16px", borderRadius: 14, border: `2px solid ${otpError ? "#ef4444" : "#e5e7eb"}`, fontSize: 28, fontWeight: 700, textAlign: "center", letterSpacing: 16, fontFamily: "monospace", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
            {otpError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 6, textAlign: "center" }}>{otpError}</p>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
              {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Code expired"}
            </p>
            <button
              onClick={handleSendOTP}
              disabled={otpTimer > 0}
              style={{ background: "none", border: "none", color: otpTimer > 0 ? "#9ca3af" : "#4F46E5", fontSize: 13, fontWeight: 600, cursor: otpTimer > 0 ? "default" : "pointer" }}
            >
              Resend Code
            </button>
          </div>

          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: (loading || otp.length !== 6) ? "#e5e7eb" : "linear-gradient(135deg, #4F46E5, #7C3AED)", color: (loading || otp.length !== 6) ? "#9ca3af" : "#fff", fontSize: 16, fontWeight: 700, cursor: (loading || otp.length !== 6) ? "not-allowed" : "pointer" }}
          >
            {loading ? "Verifying…" : "Verify & Continue"}
          </button>

          <div style={{ marginTop: 20, padding: 16, background: "#fefce8", borderRadius: 12, border: "1px solid #fde68a" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
              <strong>🧪 Demo Mode:</strong> SMS integration requires Twilio in production. Your OTP was shown in the toast notification above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- PROFILE SETUP ----
  if (screen === "profile-setup") {
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 32px", overflowY: "auto" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: profileData.displayName ? `url("${avatarUrl(profileData.displayName)}")` : "linear-gradient(135deg, #e5e7eb, #d1d5db)", backgroundSize: "cover", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {!profileData.displayName && <span style={{ fontSize: 32, color: "#9ca3af" }}>👤</span>}
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", color: "#111", textAlign: "center" }}>Create your profile</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 14, lineHeight: 1.5, textAlign: "center" }}>This is how you'll appear to other Confi users.</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>DISPLAY NAME *</label>
            <input
              type="text"
              placeholder="Your name"
              value={profileData.displayName}
              onChange={(e) => { setProfileData({ ...profileData, displayName: e.target.value }); setError(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `2px solid ${error ? "#ef4444" : "#e5e7eb"}`, fontSize: 16, fontFamily: "inherit", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>SHORT BIO</label>
            <textarea
              placeholder="Tell people a bit about yourself…"
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              rows={3}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 15, fontFamily: "inherit", outline: "none", color: "#111", resize: "none", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ marginBottom: 20, padding: 16, background: "#f0f9ff", borderRadius: 12, border: "1px solid #bae6fd" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#0c4a6e", lineHeight: 1.5 }}>
              <strong>🔑 Your Confi ID</strong> will be generated upon profile creation. It serves as your digital identity for NDA signatures and is cryptographically bound to your verified phone number.
            </p>
          </div>

          <button
            onClick={handleProfileSubmit}
            disabled={loading || !profileData.displayName.trim()}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: (!profileData.displayName.trim() || loading) ? "#e5e7eb" : "linear-gradient(135deg, #4F46E5, #7C3AED)", color: (!profileData.displayName.trim() || loading) ? "#9ca3af" : "#fff", fontSize: 16, fontWeight: 700, cursor: (!profileData.displayName.trim() || loading) ? "not-allowed" : "pointer" }}
          >
            {loading ? "Creating profile…" : "Create Profile"}
          </button>
        </div>
      </div>
    );
  }

  // ---- RECOVERY SETUP ----
  if (screen === "recovery-setup") {
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 32px" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🛡️</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", color: "#111" }}>Account Recovery</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 15, lineHeight: 1.5 }}>Set up recovery options to regain access if you lose your phone.</p>
          </div>

          {user && (
            <div style={{ marginBottom: 20, padding: 16, background: "#f8fafc", borderRadius: 12, border: "2px solid #e2e8f0" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "#64748b" }}>YOUR CONFI ID</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#4F46E5", fontFamily: "monospace", letterSpacing: 1 }}>{user.confiId}</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>Store this safely — it's your permanent identifier for NDA binding.</p>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>RECOVERY EMAIL</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={recoveryEmail}
              onChange={(e) => { setRecoveryEmail(e.target.value); setError(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 16, fontFamily: "inherit", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>RECOVERY PIN (4-8 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={8}
              value={recoveryPin}
              onChange={(e) => { setRecoveryPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 20, fontFamily: "monospace", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button
            onClick={handleRecoverySetup}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
          >
            Set Up Recovery
          </button>
          <button
            onClick={() => setScreen("home")}
            style={{ width: "100%", padding: "14px", borderRadius: 14, border: "2px solid #e5e7eb", background: "#fff", color: "#666", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Skip for Now
          </button>
        </div>
      </div>
    );
  }

  // ---- ACCOUNT RECOVERY ----
  if (screen === "account-recovery") {
    return (
      <div style={styles.app}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 28px 32px" }}>
          <button onClick={() => setScreen("phone-entry")} style={{ background: "none", border: "none", color: "#4F46E5", fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0, marginBottom: 32 }}>
            ← Back
          </button>

          <div style={{ marginBottom: 32 }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 16 }}>🔓</span>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", color: "#111" }}>Recover Account</h2>
            <p style={{ color: "#666", margin: 0, fontSize: 15, lineHeight: 1.5 }}>Enter your recovery details to regain access.</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>RECOVERY EMAIL</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={recoveryEmail}
              onChange={(e) => { setRecoveryEmail(e.target.value); setError(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 16, fontFamily: "inherit", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>RECOVERY PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={8}
              value={recoveryPin}
              onChange={(e) => { setRecoveryPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 20, fontFamily: "monospace", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button
            onClick={handleAccountRecovery}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Recover Account
          </button>
        </div>
      </div>
    );
  }

  // ---- HOME ----
  if (screen === "home") {
    return (
      <div style={styles.app}>
        {/* Header */}
        <div style={{ padding: "52px 20px 12px", background: "#fff", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111" }}>Confi</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{user?.confiId}</p>
            </div>
            <button
              onClick={() => { setEditProfile({ displayName: user?.displayName ?? "", bio: user?.bio ?? "" }); setShowProfile(true); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <img src={user?.avatar} alt="avatar" style={{ width: 40, height: 40, borderRadius: 20, display: "block" }} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search messages or contacts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "11px 16px 11px 40px", borderRadius: 12, border: "none", background: "#f3f4f6", fontSize: 15, fontFamily: "inherit", outline: "none", color: "#111", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 16, pointerEvents: "none" }}>🔍</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {searchQuery ? (
            <div>
              <p style={{ padding: "12px 20px 4px", fontSize: 12, fontWeight: 600, color: "#9ca3af", margin: 0 }}>CONTACTS</p>
              {filteredContacts.map((contact) => (
                <button
                  key={contact.confiId}
                  onClick={() => openChat(contact.confiId)}
                  style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid #f9fafb", textAlign: "left" }}
                >
                  <img src={contact.avatar} alt="" style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111" }}>{contact.displayName}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{contact.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : conversationList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <span style={{ fontSize: 56, display: "block", marginBottom: 16 }}>💬</span>
              <h3 style={{ color: "#111", margin: "0 0 8px" }}>No conversations yet</h3>
              <p style={{ color: "#9ca3af", fontSize: 14 }}>Search for contacts above to start chatting</p>
            </div>
          ) : (
            conversationList.map(({ contact, messages, confidentialMode }) => {
              const last = messages[messages.length - 1];
              return (
                <button
                  key={contact.confiId}
                  onClick={() => openChat(contact.confiId)}
                  style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid #f9fafb", textAlign: "left" }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={contact.avatar} alt="" style={{ width: 52, height: 52, borderRadius: 26, display: "block" }} />
                    {confidentialMode && (
                      <span style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: "2px solid #fff" }}>🔒</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>{contact.displayName}</p>
                      {last && <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{formatTime(last.ts)}</p>}
                    </div>
                    {last && (
                      <p style={{ margin: 0, fontSize: 14, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {last.fromConfiId === "SYSTEM" ? "🔒 " : last.fromConfiId === user?.confiId ? "You: " : ""}
                        {last.text.replace(/\n.*/s, "")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Profile Overlay */}
        {showProfile && user && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 100 }}>
            <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 24px 40px", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111" }}>My Profile</h3>
                <button onClick={() => { setShowProfile(false); setEditingProfile(false); }} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>×</button>
              </div>

              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <img src={user.avatar} alt="" style={{ width: 80, height: 80, borderRadius: 40, margin: "0 auto 12px", display: "block" }} />
                {!editingProfile ? (
                  <>
                    <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#111" }}>{user.displayName}</h2>
                    <p style={{ margin: "0 0 8px", fontSize: 14, color: "#6b7280" }}>{user.bio || "No bio yet"}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{user.phone}</p>
                  </>
                ) : (
                  <>
                    <input value={editProfile.displayName} onChange={(e) => setEditProfile({ ...editProfile, displayName: e.target.value })} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 16, marginBottom: 10, textAlign: "center", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    <textarea value={editProfile.bio} onChange={(e) => setEditProfile({ ...editProfile, bio: e.target.value })} rows={2} placeholder="Short bio…" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }} />
                  </>
                )}
              </div>

              <div style={{ padding: 16, background: "#f8fafc", borderRadius: 12, marginBottom: 20, border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1 }}>YOUR CONFI ID</p>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#4F46E5", letterSpacing: 1 }}>{user.confiId}</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8" }}>NDA Signature Identifier · Cryptographically bound to {user.phone}</p>
              </div>

              {!editingProfile ? (
                <button onClick={() => { setEditingProfile(true); setEditProfile({ displayName: user.displayName, bio: user.bio }); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "2px solid #4F46E5", background: "#fff", color: "#4F46E5", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
                  Edit Profile
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button onClick={() => setEditingProfile(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "2px solid #e5e7eb", background: "#fff", color: "#666", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveProfileEdit} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Save</button>
                </div>
              )}

              <button onClick={handleLogout} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 20px", borderRadius: 100, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ---- CHAT ----
  if (screen === "chat" && activeConvo) {
    const convo = conversations.get(activeConvo);
    if (!convo) return null;
    const { contact, messages: msgs, confidentialMode } = convo;

    return (
      <div style={styles.app}>
        {/* Chat Header */}
        <div style={{ padding: "52px 16px 12px", background: confidentialMode ? "linear-gradient(135deg, #1e1b4b, #312e81)" : "#fff", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: confidentialMode ? "#fff" : "#4F46E5", fontSize: 22, cursor: "pointer", padding: 4 }}>←</button>
            <img src={contact.avatar} alt="" style={{ width: 40, height: 40, borderRadius: 20, border: confidentialMode ? "2px solid #818cf8" : "none" }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: confidentialMode ? "#fff" : "#111" }}>{contact.displayName}</p>
              <p style={{ margin: 0, fontSize: 12, color: confidentialMode ? "#a5b4fc" : "#9ca3af" }}>
                {confidentialMode ? "🔒 Confidential — NDA Active" : `Last seen ${formatDate(contact.lastSeen)}`}
              </p>
            </div>
            <button
              onClick={() => confidentialMode ? disableConfidentialMode(activeConvo) : requestConfidentialMode(activeConvo)}
              style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: confidentialMode ? "rgba(255,255,255,0.2)" : "#f0f0ff", color: confidentialMode ? "#fff" : "#4F46E5", fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(4px)" }}
            >
              {confidentialMode ? "🔒 ON" : "🔓 Confi"}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8, background: confidentialMode ? "#0f0e24" : "#f9fafb" }}>
          {msgs.map((msg) => {
            const isMe = msg.fromConfiId === user?.confiId;
            const isSystem = msg.fromConfiId === "SYSTEM";

            if (isSystem) {
              return (
                <div key={msg.id} style={{ textAlign: "center", padding: "8px 16px" }}>
                  <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 12, background: confidentialMode ? "rgba(79,70,229,0.3)" : "#e0e7ff", border: `1px solid ${confidentialMode ? "#4F46E5" : "#c7d2fe"}` }}>
                    <p style={{ margin: 0, fontSize: 12, color: confidentialMode ? "#a5b4fc" : "#4F46E5", fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-line" }}>{msg.text}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && <img src={contact.avatar} alt="" style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }} />}
                <div style={{ maxWidth: "72%" }}>
                  {msg.confidential && (
                    <p style={{ margin: "0 0 2px", fontSize: 10, color: confidentialMode ? "#818cf8" : "#6366f1", fontWeight: 600, textAlign: isMe ? "right" : "left" }}>🔒 CONFIDENTIAL</p>
                  )}
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isMe
                      ? confidentialMode ? "linear-gradient(135deg, #4338ca, #6d28d9)" : "linear-gradient(135deg, #4F46E5, #7C3AED)"
                      : confidentialMode ? "rgba(255,255,255,0.1)" : "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    border: !isMe && confidentialMode ? "1px solid rgba(255,255,255,0.15)" : "none",
                  }}>
                    <p style={{ margin: "0 0 4px", fontSize: 15, color: isMe ? "#fff" : confidentialMode ? "#e2e8f0" : "#111", lineHeight: 1.4 }}>{msg.text}</p>
                    <p style={{ margin: 0, fontSize: 11, color: isMe ? "rgba(255,255,255,0.7)" : confidentialMode ? "rgba(255,255,255,0.4)" : "#9ca3af", textAlign: "right" }}>{formatTime(msg.ts)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 32px", background: confidentialMode ? "#0f0e24" : "#fff", borderTop: `1px solid ${confidentialMode ? "rgba(255,255,255,0.1)" : "#f3f4f6"}` }}>
          {confidentialMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", background: "rgba(79,70,229,0.2)", borderRadius: 8 }}>
              <span style={{ fontSize: 12 }}>🔒</span>
              <p style={{ margin: 0, fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>Protected by International NDA · All messages encrypted & confidential</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <input
              type="text"
              placeholder={confidentialMode ? "🔒 Send confidential message…" : "Message…"}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 24, border: `2px solid ${confidentialMode ? "rgba(79,70,229,0.4)" : "#e5e7eb"}`, fontSize: 15, fontFamily: "inherit", outline: "none", color: confidentialMode ? "#fff" : "#111", background: confidentialMode ? "rgba(255,255,255,0.08)" : "#fff", caretColor: confidentialMode ? "#818cf8" : "#4F46E5" }}
            />
            <button
              onClick={sendMessage}
              disabled={!messageInput.trim()}
              style={{ width: 44, height: 44, borderRadius: 22, border: "none", background: messageInput.trim() ? "linear-gradient(135deg, #4F46E5, #7C3AED)" : "#e5e7eb", color: "#fff", fontSize: 18, cursor: messageInput.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              ↑
            </button>
          </div>
        </div>

        {/* NDA Modal */}
        {showNDA && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", zIndex: 200, backdropFilter: "blur(4px)" }}>
            <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 24px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111" }}>🔒 International NDA</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Review and sign to enable Confidential Mode</p>
                  </div>
                  <button onClick={() => { setShowNDA(false); setNdaConvoId(null); }} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>×</button>
                </div>

                {user && (
                  <div style={{ padding: "10px 14px", background: "#f0f9ff", borderRadius: 10, marginBottom: 12, border: "1px solid #bae6fd" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#0369a1" }}>
                      <strong>Signing as:</strong> {user.displayName} · <span style={{ fontFamily: "monospace" }}>{user.confiId}</span>
                    </p>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
                  <pre style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.7, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{NDA_TEXT}</pre>
                </div>
              </div>

              <div style={{ padding: "16px 24px 36px" }}>
                <div style={{ padding: "12px 16px", background: "#fef3c7", borderRadius: 10, marginBottom: 16, border: "1px solid #fde68a" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                    ⚖️ <strong>Legal Notice:</strong> By accepting, you create a binding electronic signature under ESIGN, eIDAS, and international commercial law, linked to your Confi ID and verified phone number.
                  </p>
                </div>
                <button
                  onClick={acceptNDA}
                  style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
                >
                  Accept & Enable Confidential Mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", padding: "12px 20px", borderRadius: 100, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  return null;
}