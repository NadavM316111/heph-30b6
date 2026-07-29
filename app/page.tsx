"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  email: string;
  displayName: string;
  avatar: string;
  verified: boolean;
  phone?: string;
  createdAt: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  confidential: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  displayName: string;
  avatar: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaAcceptedBy: string[];
}

type Screen = "auth" | "otp" | "profile-setup" | "app";
type AuthMode = "login" | "signup";

// ─── Avatar helpers ───────────────────────────────────────────────────────────
const AVATARS = ["🦊","🐺","🦁","🐯","🐻","🦝","🐼","🦄","🐸","🦋","🐙","🦑","🐬","🦚","🦜"];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ avatar, name, size = 40 }: { avatar: string; name: string; size?: number }) {
  const isEmoji = avatar && avatar.length <= 2 && /\p{Emoji}/u.test(avatar);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: isEmoji ? "#e8f5e9" : "#128c7e",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: isEmoji ? size * 0.55 : size * 0.35,
      fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden",
      border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.15)"
    }}>
      {isEmoji ? avatar : initials(name)}
    </div>
  );
}

// ─── OTP generator (client-side mock — server would send real email) ──────────
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── NDA Modal ────────────────────────────────────────────────────────────────
function NDAModal({ onAccept, onDecline, peerName }: { onAccept: () => void; onDecline: () => void; peerName: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.65)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 480, width: "100%",
        padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.25)", maxHeight: "85vh", overflowY: "auto"
      }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 36 }}>🔒</div>
          <h2 style={{ margin: "8px 0 4px", color: "#1a1a2e", fontSize: 20 }}>Confidential Mode NDA</h2>
          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>International Non-Disclosure Agreement</p>
        </div>
        <div style={{
          background: "#f8f9fa", borderRadius: 10, padding: 16, fontSize: 12.5,
          lineHeight: 1.7, color: "#333", marginBottom: 20, border: "1px solid #e0e0e0"
        }}>
          <strong>MUTUAL NON-DISCLOSURE AGREEMENT</strong>
          <br /><br />
          This Mutual Non-Disclosure Agreement ("Agreement") is entered into between the participating parties
          in this Confi Messaging conversation (collectively, "Parties"), effective upon both Parties'
          digital acceptance within the Confi platform.
          <br /><br />
          <strong>1. CONFIDENTIAL INFORMATION</strong><br />
          "Confidential Information" means any data, text, files, or communications exchanged within
          a Confidential Mode conversation, including but not limited to business strategies, personal data,
          financial information, intellectual property, trade secrets, and any other information marked or
          reasonably understood to be confidential.
          <br /><br />
          <strong>2. OBLIGATIONS</strong><br />
          Each Party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose
          Confidential Information to any third party without prior written consent; (c) use Confidential
          Information solely for the purposes of the conversation; (d) promptly notify the other Party of
          any unauthorized disclosure.
          <br /><br />
          <strong>3. INTERNATIONAL JURISDICTION</strong><br />
          This Agreement is governed by applicable international commercial law, including principles from
          UNCITRAL Model Law on Electronic Commerce. The Parties agree that digital acceptance constitutes
          a legally binding signature under the UN Convention on the Use of Electronic Communications in
          International Contracts (2005) and applicable domestic e-signature laws.
          <br /><br />
          <strong>4. DURATION</strong><br />
          Obligations survive for five (5) years following the termination of Confidential Mode or deletion
          of the conversation, whichever is later.
          <br /><br />
          <strong>5. REMEDIES</strong><br />
          Breach of this Agreement may result in injunctive relief and monetary damages. The non-breaching
          Party is entitled to seek remedy in any competent jurisdiction.
          <br /><br />
          <strong>6. VERIFIED IDENTITY</strong><br />
          Acceptance of this Agreement is cryptographically linked to your verified Confi account identity.
          Your acceptance is timestamped and immutable.
          <br /><br />
          By clicking "Accept & Activate", you confirm you have read, understood, and agree to be legally
          bound by this Agreement with <strong>{peerName}</strong>.
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onDecline} style={{
            flex: 1, padding: "12px 0", borderRadius: 10, border: "1.5px solid #ddd",
            background: "#fff", color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 14
          }}>Decline</button>
          <button onClick={onAccept} style={{
            flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#128c7e,#075e54)", color: "#fff",
            fontWeight: 700, cursor: "pointer", fontSize: 14
          }}>Accept & Activate 🔒</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState("");
  const [otpError, setOtpError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [phone, setPhone] = useState("");

  // App state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNDA, setShowNDA] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }) }).catch(() => {});

    const saved = localStorage.getItem("confi_user");
    const savedConvs = localStorage.getItem("confi_convs");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
        setScreen("app");
      } catch { localStorage.removeItem("confi_user"); }
    }
    if (savedConvs) {
      try { setConversations(JSON.parse(savedConvs)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) localStorage.setItem("confi_convs", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConvId]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  async function handleAuth() {
    if (!email.trim() || !password.trim()) { setAuthError("Email and password required."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setAuthError("Enter a valid email."); return; }
    if (password.length < 8) { setAuthError("Password must be at least 8 characters."); return; }
    setAuthLoading(true); setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email: email.toLowerCase().trim(), password })
      });
      const data = await res.json();
      if (!data.ok) { setAuthError(data.error || "Authentication failed."); setAuthLoading(false); return; }

      if (authMode === "signup") {
        const code = generateOTP();
        setOtpSent(code);
        console.info(`[DEV] OTP for ${email}: ${code}`);
        setScreen("otp");
      } else {
        // Login — check if profile exists
        const profile = localStorage.getItem(`confi_profile_${email.toLowerCase().trim()}`);
        if (profile) {
          const u: User = JSON.parse(profile);
          setCurrentUser(u);
          localStorage.setItem("confi_user", JSON.stringify(u));
          setScreen("app");
        } else {
          // First login, need profile setup
          setScreen("profile-setup");
        }
      }
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setAuthLoading(false);
  }

  function handleVerifyOTP() {
    setOtpError("");
    if (otpInput.trim() === otpSent) {
      setScreen("profile-setup");
    } else {
      setOtpError("Invalid code. Please try again.");
    }
  }

  function handleProfileSave() {
    if (!displayName.trim()) return;
    const user: User = {
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      verified: true,
      phone: phone.trim() || undefined,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(`confi_profile_${user.email}`, JSON.stringify(user));
    localStorage.setItem("confi_user", JSON.stringify(user));
    setCurrentUser(user);
    setScreen("app");
  }

  function handleLogout() {
    localStorage.removeItem("confi_user");
    setCurrentUser(null);
    setConversations([]);
    setActiveConvId(null);
    setScreen("auth");
    setEmail(""); setPassword(""); setOtpInput(""); setOtpSent("");
  }

  // ── Conversation helpers ───────────────────────────────────────────────────
  function startNewChat() {
    if (!newChatEmail.trim() || !currentUser) return;
    const peer = newChatEmail.toLowerCase().trim();
    if (peer === currentUser.email) return;

    const existing = conversations.find(c => c.participants.includes(peer) && c.participants.includes(currentUser.email));
    if (existing) { setActiveConvId(existing.id); setShowNewChat(false); return; }

    const peerProfile = localStorage.getItem(`confi_profile_${peer}`);
    const peerUser: User = peerProfile ? JSON.parse(peerProfile) : {
      email: peer, displayName: peer.split("@")[0], avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      verified: false, createdAt: new Date().toISOString()
    };

    const conv: Conversation = {
      id: crypto.randomUUID(),
      participants: [currentUser.email, peer],
      displayName: peerUser.displayName,
      avatar: peerUser.avatar,
      messages: [],
      confidentialMode: false,
      ndaAcceptedBy: []
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setShowNewChat(false);
    setNewChatEmail("");
  }

  function sendMessage() {
    if (!messageText.trim() || !activeConvId || !currentUser) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.email,
      text: messageText.trim(),
      timestamp: new Date().toISOString(),
      confidential: activeConv?.confidentialMode ?? false
    };
    setConversations(prev => prev.map(c =>
      c.id === activeConvId ? { ...c, messages: [...c.messages, msg] } : c
    ));
    setMessageText("");
  }

  function toggleConfidential() {
    if (!activeConvId || !currentUser) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv) return;
    if (!conv.confidentialMode) {
      setShowNDA(true);
    } else {
      setConversations(prev => prev.map(c =>
        c.id === activeConvId ? { ...c, confidentialMode: false, ndaAcceptedBy: [] } : c
      ));
    }
  }

  function acceptNDA() {
    if (!activeConvId || !currentUser) return;
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      const ndaAcceptedBy = [...new Set([...c.ndaAcceptedBy, currentUser.email])];
      return { ...c, confidentialMode: true, ndaAcceptedBy };
    }));
    setShowNDA(false);
  }

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  // ── Screens ────────────────────────────────────────────────────────────────

  // Auth screen
  if (screen === "auth") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#075e54 0%,#128c7e 50%,#25d366 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: "100%", maxWidth: 400, boxShadow: "0 12px 48px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ margin: 0, fontSize: 26, color: "#1a1a2e", fontWeight: 800 }}>Confi</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>Confidential Messaging — Legally Protected</p>
        </div>

        <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {(["signup", "login"] as AuthMode[]).map(m => (
            <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
              background: authMode === m ? "#128c7e" : "transparent",
              color: authMode === m ? "#fff" : "#555", fontWeight: 600, cursor: "pointer",
              fontSize: 14, transition: "all .2s"
            }}>{m === "signup" ? "Sign Up" : "Log In"}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" type="email"
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={inputStyle} />
          <input value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password (8+ characters)" type="password"
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={inputStyle} />
          {authError && <p style={{ color: "#e53935", fontSize: 13, margin: 0 }}>{authError}</p>}
          <button onClick={handleAuth} disabled={authLoading} style={{
            padding: "14px 0", borderRadius: 12, border: "none",
            background: authLoading ? "#aaa" : "linear-gradient(135deg,#128c7e,#075e54)",
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: authLoading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(18,140,126,.35)"
          }}>
            {authLoading ? "Please wait…" : authMode === "signup" ? "Create Account →" : "Log In →"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 20, marginBottom: 0, lineHeight: 1.5 }}>
          By continuing you agree to our Terms of Service.<br />
          Phone verification adds NDA enforceability.
        </p>
      </div>
    </div>
  );

  // OTP screen
  if (screen === "otp") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#075e54,#25d366)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: "100%", maxWidth: 380, boxShadow: "0 12px 48px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 42 }}>📧</div>
          <h2 style={{ margin: "8px 0 4px", color: "#1a1a2e" }}>Verify Email</h2>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>
            We sent a 6-digit code to<br /><strong>{email}</strong>
          </p>
          <p style={{ color: "#25d366", fontSize: 11, marginTop: 8 }}>
            (Dev mode: check browser console for OTP)
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code" maxLength={6}
            style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: 700 }}
            onKeyDown={e => e.key === "Enter" && handleVerifyOTP()} />
          {otpError && <p style={{ color: "#e53935", fontSize: 13, margin: 0 }}>{otpError}</p>}
          <button onClick={handleVerifyOTP} style={{
            padding: "14px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#128c7e,#075e54)",
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer"
          }}>Verify & Continue →</button>
          <button onClick={() => { const c = generateOTP(); setOtpSent(c); console.info(`[DEV] New OTP: ${c}`); }}
            style={{ background: "none", border: "none", color: "#128c7e", cursor: "pointer", fontSize: 13 }}>
            Resend code
          </button>
        </div>
      </div>
    </div>
  );

  // Profile setup
  if (screen === "profile-setup") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#075e54,#25d366)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, width: "100%", maxWidth: 400, boxShadow: "0 12px 48px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 42 }}>👤</div>
          <h2 style={{ margin: "8px 0 4px", color: "#1a1a2e" }}>Set Up Profile</h2>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>Your verified identity for NDA enforcement</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="Display Name (legal name recommended)" style={inputStyle} />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone number (optional, strengthens NDA)" type="tel" style={inputStyle} />

          <p style={{ margin: 0, fontSize: 12, color: "#888", fontWeight: 600 }}>Choose avatar:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => setSelectedAvatar(a)} style={{
                width: 44, height: 44, borderRadius: "50%", border: selectedAvatar === a ? "3px solid #128c7e" : "2px solid #eee",
                background: selectedAvatar === a ? "#e8f5e9" : "#f9f9f9",
                fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}>{a}</button>
            ))}
          </div>

          <div style={{ background: "#e8f5e9", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar avatar={selectedAvatar} name={displayName || "You"} size={44} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>{displayName || "Your Name"}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#666" }}>{email}</p>
              {phone && <p style={{ margin: 0, fontSize: 11, color: "#888" }}>{phone}</p>}
            </div>
            <span style={{ marginLeft: "auto", background: "#25d366", color: "#fff", fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>
          </div>

          <button onClick={handleProfileSave} disabled={!displayName.trim()} style={{
            padding: "14px 0", borderRadius: 12, border: "none",
            background: displayName.trim() ? "linear-gradient(135deg,#128c7e,#075e54)" : "#ddd",
            color: displayName.trim() ? "#fff" : "#999",
            fontWeight: 700, fontSize: 15, cursor: displayName.trim() ? "pointer" : "not-allowed"
          }}>Save & Enter Confi →</button>
        </div>
      </div>
    </div>
  );

  // ── Main App ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f0f2f5" }}>

      {/* NDA Modal */}
      {showNDA && activeConv && currentUser && (
        <NDAModal
          peerName={activeConv.displayName}
          onAccept={acceptNDA}
          onDecline={() => setShowNDA(false)}
        />
      )}

      {/* Sidebar */}
      <div style={{
        width: 340, borderRight: "1px solid #e9ecef", background: "#fff",
        display: "flex", flexDirection: "column", flexShrink: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,.04)"
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#128c7e,#075e54)", padding: "16px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {currentUser && <Avatar avatar={currentUser.avatar} name={currentUser.displayName} size={38} />}
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "#fff", fontSize: 15 }}>{currentUser?.displayName}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25d366", display: "inline-block" }} />
                <p style={{ margin: 0, color: "rgba(255,255,255,.75)", fontSize: 11 }}>
                  {currentUser?.verified ? "✓ Verified" : "Unverified"}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowProfile(p => !p)} title="Profile" style={iconBtn}>👤</button>
            <button onClick={() => setShowNewChat(p => !p)} title="New chat" style={iconBtn}>✏️</button>
            <button onClick={handleLogout} title="Logout" style={iconBtn}>🚪</button>
          </div>
        </div>

        {/* Profile panel */}
        {showProfile && currentUser && (
          <div style={{ background: "#e8f5e9", padding: 16, borderBottom: "1px solid #ddd" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar avatar={currentUser.avatar} name={currentUser.displayName} size={52} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{currentUser.displayName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>{currentUser.email}</p>
                {currentUser.phone && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>📱 {currentUser.phone}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <span style={{ background: "#25d366", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>
                  <span style={{ background: "#128c7e", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>NDA READY</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New chat form */}
        {showNewChat && (
          <div style={{ padding: "12px 16px", background: "#f8f9fa", borderBottom: "1px solid #eee", display: "flex", gap: 8 }}>
            <input value={newChatEmail} onChange={e => setNewChatEmail(e.target.value)}
              placeholder="Enter email to chat…" style={{ ...inputStyle, margin: 0, flex: 1, fontSize: 13, padding: "9px 12px" }}
              onKeyDown={e => e.key === "Enter" && startNewChat()} />
            <button onClick={startNewChat} style={{
              background: "#128c7e", color: "#fff", border: "none", borderRadius: 10,
              padding: "0 16px", fontWeight: 700, cursor: "pointer", fontSize: 14
            }}>Go</button>
          </div>
        )}

        {/* Convo list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#bbb" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
              <p style={{ margin: 0, fontSize: 13 }}>No conversations yet.<br />Tap ✏️ to start chatting.</p>
            </div>
          )}
          {conversations.map(conv => {
            const last = conv.messages[conv.messages.length - 1];
            const isActive = conv.id === activeConvId;
            return (
              <div key={conv.id} onClick={() => setActiveConvId(conv.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", cursor: "pointer",
                background: isActive ? "#e8f5e9" : "transparent",
                borderBottom: "1px solid #f0f0f0",
                transition: "background .15s"
              }}>
                <div style={{ position: "relative" }}>
                  <Avatar avatar={conv.avatar} name={conv.displayName} size={46} />
                  {conv.confidentialMode && (
                    <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 14 }}>🔒</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.displayName}
                    </p>
                    {last && <span style={{ fontSize: 10, color: "#aaa", flexShrink: 0, marginLeft: 8 }}>
                      {new Date(last.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>}
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {last ? (last.confidential ? "🔒 Confidential message" : last.text) : "Start a conversation"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#aaa" }}>
            <div style={{ fontSize: 72 }}>🔐</div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#555" }}>Welcome to Confi</h2>
            <p style={{ margin: 0, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
              Select a conversation or start a new one.<br />
              Enable Confidential Mode to activate an international NDA.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              background: "linear-gradient(135deg,#128c7e,#075e54)", padding: "12px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 2px 8px rgba(0,0,0,.1)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar avatar={activeConv.avatar} name={activeConv.displayName} size={40} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#fff", fontSize: 15 }}>{activeConv.displayName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,.75)" }}>
                    {activeConv.participants.find(p => p !== currentUser?.email)}
                  </p>
                </div>
              </div>
              <button onClick={toggleConfidential} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 20, border: "none",
                background: activeConv.confidentialMode ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.2)",
                color: activeConv.confidentialMode ? "#128c7e" : "#fff",
                fontWeight: 700, cursor: "pointer", fontSize: 13, transition: "all .2s"
              }}>
                {activeConv.confidentialMode ? "🔒 Confidential ON" : "🔓 Go Confidential"}
              </button>
            </div>

            {/* NDA banner */}
            {activeConv.confidentialMode && (
              <div style={{
                background: "linear-gradient(135deg,#1a1a2e,#16213e)", padding: "10px 20px",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: "#fff", fontSize: 12, fontWeight: 700 }}>CONFIDENTIAL MODE ACTIVE — International NDA Enforced</p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,.6)", fontSize: 10 }}>
                    This conversation is protected under a legally binding NDA. Accepted by: {activeConv.ndaAcceptedBy.join(", ")}
                  </p>
                </div>
                <span style={{ background: "#25d366", color: "#fff", fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 800, flexShrink: 0 }}>ACTIVE</span>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#efeae2", display: "flex", flexDirection: "column", gap: 8 }}>
              {activeConv.messages.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>
                  <p style={{ fontSize: 13 }}>No messages yet. Say hello! 👋</p>
                  {!activeConv.confidentialMode && (
                    <p style={{ fontSize: 11 }}>Enable Confidential Mode to protect this conversation with an NDA.</p>
                  )}
                </div>
              )}
              {activeConv.messages.map(msg => {
                const isMine = msg.senderId === currentUser?.email;
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "72%", padding: "10px 14px", borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: msg.confidential
                        ? (isMine ? "linear-gradient(135deg,#1a1a2e,#16213e)" : "linear-gradient(135deg,#16213e,#0f3460)")
                        : (isMine ? "#dcf8c6" : "#fff"),
                      color: msg.confidential ? "#fff" : "#1a1a2e",
                      boxShadow: "0 1px 4px rgba(0,0,0,.1)"
                    }}>
                      {msg.confidential && (
                        <p style={{ margin: "0 0 4px", fontSize: 9, color: "rgba(255,255,255,.6)", letterSpacing: 1, fontWeight: 700 }}>🔒 CONFIDENTIAL</p>
                      )}
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{msg.text}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 10, color: msg.confidential ? "rgba(255,255,255,.5)" : "#888", textAlign: "right" }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {isMine && <span style={{ marginLeft: 4 }}>✓✓</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 16px", background: "#f0f2f5", borderTop: "1px solid #e9ecef", display: "flex", gap: 10, alignItems: "center" }}>
              {activeConv.confidentialMode && (
                <span style={{ fontSize: 18, flexShrink: 0 }} title="Confidential Mode ON">🔒</span>
              )}
              <input
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder={activeConv.confidentialMode ? "Send confidential message…" : "Type a message…"}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 24, border: "1px solid #ddd",
                  fontSize: 14, outline: "none", background: "#fff",
                  boxShadow: "inset 0 1px 4px rgba(0,0,0,.04)"
                }}
              />
              <button onClick={sendMessage} disabled={!messageText.trim()} style={{
                width: 46, height: 46, borderRadius: "50%", border: "none",
                background: messageText.trim() ? "linear-gradient(135deg,#128c7e,#075e54)" : "#ccc",
                color: "#fff", fontSize: 18, cursor: messageText.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: messageText.trim() ? "0 2px 8px rgba(18,140,126,.4)" : "none",
                transition: "all .2s"
              }}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "13px 16px", borderRadius: 12, border: "1.5px solid #e0e0e0",
  fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  background: "#fafafa", color: "#1a1a2e", transition: "border-color .2s"
};

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: "50%", border: "none",
  background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
};