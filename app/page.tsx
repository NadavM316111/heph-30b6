"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  email: string;
  displayName: string;
  legalName: string;
  legalNameVerified: boolean;
  phone: string;
  avatarColor: string;
  sessionToken: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isConfidential: boolean;
}

interface Conversation {
  id: string;
  participantName: string;
  participantEmail: string;
  participantAvatarColor: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaActivatedAt?: number;
  ndaActivatedBy?: string;
}

type AuthStep =
  | "landing"
  | "signup_email"
  | "signup_phone"
  | "signup_otp"
  | "signup_password"
  | "signup_legalname"
  | "signup_profile"
  | "login"
  | "app";

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#6C63FF", "#FF6584", "#43B89C", "#F7B731", "#FC5C65",
  "#45AAF2", "#26de81", "#fd9644", "#a55eea", "#2bcbba",
];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv_1",
    participantName: "Alex Rivera",
    participantEmail: "alex@example.com",
    participantAvatarColor: "#6C63FF",
    confidentialMode: false,
    messages: [
      {
        id: "m1", senderId: "alex@example.com", senderName: "Alex Rivera",
        text: "Hey! Can we discuss the merger details?", timestamp: Date.now() - 3600000,
        isConfidential: false,
      },
      {
        id: "m2", senderId: "alex@example.com", senderName: "Alex Rivera",
        text: "I think we need to keep this strictly confidential.", timestamp: Date.now() - 3500000,
        isConfidential: false,
      },
    ],
  },
  {
    id: "conv_2",
    participantName: "Jordan Lee",
    participantEmail: "jordan@example.com",
    participantAvatarColor: "#FF6584",
    confidentialMode: true,
    ndaActivatedAt: Date.now() - 86400000,
    ndaActivatedBy: "jordan@example.com",
    messages: [
      {
        id: "m3", senderId: "jordan@example.com", senderName: "Jordan Lee",
        text: "The prototype specs are attached. NDA is active.", timestamp: Date.now() - 86400000,
        isConfidential: true,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0,
      userSelect: "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

function LockIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
      <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z" />
    </svg>
  );
}

function ShieldIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

// ─── NDA Modal ────────────────────────────────────────────────────────────────
function NDAModal({
  user,
  conversation,
  onAccept,
  onDecline,
}: {
  user: User;
  conversation: Conversation;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ndaDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 20) setScrolled(true);
  };

  if (!user.legalNameVerified) {
    return (
      <div style={styles.modalOverlay}>
        <div style={{ ...styles.modalBox, maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <ShieldIcon size={48} color="#FC5C65" />
            <h2 style={{ margin: "12px 0 8px", color: "#FC5C65" }}>Identity Not Verified</h2>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              You must verify your legal name before activating Confidential Mode.
              Your legal name will be legally binding on the NDA.
            </p>
          </div>
          <button onClick={onDecline} style={{ ...styles.btnPrimary, width: "100%", background: "#FC5C65" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalBox, maxWidth: 680 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <ShieldIcon size={28} color="#6C63FF" />
          <h2 style={{ margin: 0, color: "#1e293b" }}>International Non-Disclosure Agreement</h2>
        </div>

        <div style={{
          background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8,
          padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#713f12",
        }}>
          ⚠️ <strong>LEGALLY BINDING:</strong> This NDA is enforceable under applicable international law.
          Your verified legal name <strong>"{user.legalName}"</strong> will be attached to this agreement.
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            height: 320, overflowY: "auto", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "16px 20px", fontSize: 13, lineHeight: 1.8,
            color: "#334155", background: "#f8fafc",
          }}
        >
          <p style={{ textAlign: "center", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            CONFI MESSAGING — MUTUAL NON-DISCLOSURE AGREEMENT
          </p>
          <p style={{ textAlign: "center", color: "#64748b", marginBottom: 20 }}>
            Effective Date: {ndaDate}
          </p>

          <p><strong>PARTIES:</strong></p>
          <p>
            This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {ndaDate}, by and between:
          </p>
          <ul>
            <li><strong>Disclosing Party:</strong> {user.legalName} (Verified User, Confi Platform)</li>
            <li><strong>Receiving Party:</strong> {conversation.participantName} (Confi Platform Participant)</li>
          </ul>

          <p><strong>1. DEFINITION OF CONFIDENTIAL INFORMATION</strong></p>
          <p>
            "Confidential Information" means any data or information that is proprietary to either Party
            and not generally known to the public, whether in tangible or intangible form, whenever and
            however disclosed, including but not limited to: (i) any marketing strategies, plans, financial
            information, or projections, operations, sales estimates, business plans and performance results
            relating to the past, present or future business activities of such Party; (ii) plans for products
            or services, and customer or supplier lists; (iii) any scientific or technical information,
            invention, design, process, procedure, formula, improvement, technology or method; (iv) any
            concepts, reports, data, know-how, works-in-progress, designs, development tools, specifications,
            computer software, source code, object code, flow charts, databases, inventions, information
            and trade secrets; and (v) any other information that should reasonably be recognized as
            confidential information of the Disclosing Party.
          </p>

          <p><strong>2. OBLIGATIONS OF RECEIVING PARTY</strong></p>
          <p>The Receiving Party agrees to:</p>
          <ul>
            <li>Hold the Confidential Information in strict confidence;</li>
            <li>Not disclose, publish, or disseminate Confidential Information to anyone other than
              persons employed or engaged by the Receiving Party who have a need to know and have
              signed a confidentiality agreement with at least as protective terms;</li>
            <li>Use the Confidential Information solely for the purpose of the business relationship
              between the Parties;</li>
            <li>Protect Confidential Information using reasonable care, but no less than the same
              degree of care used to protect its own confidential information.</li>
          </ul>

          <p><strong>3. INTERNATIONAL JURISDICTION & GOVERNING LAW</strong></p>
          <p>
            This Agreement shall be governed by and construed in accordance with the laws of the
            jurisdiction in which the Disclosing Party is domiciled, with supplementary reference to
            the UNCITRAL Model Law on International Commercial Arbitration, the Hague Convention on
            Choice of Court Agreements (2005), and applicable provisions of the United Nations
            Convention on Contracts for the International Sale of Goods (CISG) where relevant.
            Any dispute arising under this Agreement shall be subject to binding international
            arbitration under ICC Rules.
          </p>

          <p><strong>4. TERM</strong></p>
          <p>
            This Agreement shall remain in effect for a period of five (5) years from the Effective
            Date, unless earlier terminated by mutual written consent of both Parties. Obligations
            with respect to Confidential Information disclosed prior to termination shall survive
            for an additional three (3) years following termination.
          </p>

          <p><strong>5. REMEDIES</strong></p>
          <p>
            Each Party acknowledges that breach of this Agreement may cause irreparable harm for
            which monetary damages would be an inadequate remedy. Accordingly, either Party may
            seek equitable relief, including injunction and specific performance, in addition to all
            other remedies available at law or in equity, without the requirement of posting bond
            or other security.
          </p>

          <p><strong>6. EXCEPTIONS</strong></p>
          <p>This Agreement does not apply to information that:</p>
          <ul>
            <li>Is or becomes publicly known through no breach of this Agreement;</li>
            <li>Was rightfully known to the Receiving Party prior to disclosure;</li>
            <li>Is independently developed by the Receiving Party without use of Confidential Information;</li>
            <li>Must be disclosed by law, regulation, or court order (with prior notice to Disclosing Party).</li>
          </ul>

          <p><strong>7. ENTIRE AGREEMENT</strong></p>
          <p>
            This Agreement constitutes the entire agreement between the Parties with respect to the
            subject matter hereof and supersedes all prior or contemporaneous agreements, understandings,
            negotiations and discussions, whether oral or written. This Agreement may not be amended
            except by a written instrument signed by both Parties. The digital acceptance of this
            Agreement within the Confi platform, using verified legal identity, constitutes a valid
            electronic signature under the UNCITRAL Model Law on Electronic Commerce and applicable
            national e-signature laws.
          </p>

          <p style={{ marginTop: 24, textAlign: "center", fontStyle: "italic", color: "#64748b" }}>
            — End of Agreement —
          </p>
        </div>

        {!scrolled && (
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "8px 0" }}>
            ↓ Scroll to read the full agreement before accepting
          </p>
        )}

        {scrolled && (
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 10, margin: "14px 0",
            cursor: "pointer", fontSize: 13, color: "#334155",
          }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
            />
            <span>
              I, <strong>{user.legalName}</strong>, have read and agree to the terms of this
              International Non-Disclosure Agreement. I understand this is legally binding.
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onDecline} style={{ ...styles.btnSecondary, flex: 1 }}>
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!agreed}
            style={{
              ...styles.btnPrimary, flex: 2,
              opacity: agreed ? 1 : 0.4,
              cursor: agreed ? "pointer" : "not-allowed",
            }}
          >
            <ShieldIcon size={14} color="#fff" /> Accept &amp; Activate Confidential Mode
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ user, onClose, onUpdate }: {
  user: User;
  onClose: () => void;
  onUpdate: (updates: Partial<User>) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [selectedColor, setSelectedColor] = useState(user.avatarColor);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      onUpdate({ displayName, avatarColor: selectedColor });
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalBox, maxWidth: 420 }}>
        <h2 style={{ margin: "0 0 20px", color: "#1e293b" }}>Edit Profile</h2>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Avatar name={displayName || "?"} color={selectedColor} size={80} />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Avatar Color</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: "50%", background: c,
                  border: selectedColor === c ? "3px solid #1e293b" : "3px solid transparent",
                  cursor: "pointer", padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
        </div>

        <div style={{
          background: "#f1f5f9", borderRadius: 8, padding: "12px 14px",
          marginBottom: 16, fontSize: 13,
        }}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#475569" }}>
            <ShieldIcon size={13} color="#6C63FF" /> Legal Name (NDA-Binding)
          </p>
          <p style={{ margin: 0, color: "#1e293b", fontWeight: 500 }}>{user.legalName}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
            Legal name cannot be changed after verification. Contact support if incorrect.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...styles.btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...styles.btnPrimary, flex: 2 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [step, setStep] = useState<AuthStep>("landing");
  const [user, setUser] = useState<User | null>(null);

  // Auth form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App state
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNDA, setShowNDA] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [newConvEmail, setNewConvEmail] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track page view
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Load persisted session
  useEffect(() => {
    try {
      const raw = localStorage.getItem("confi_user");
      if (raw) {
        const u = JSON.parse(raw) as User;
        setUser(u);
        setStep("app");
      }
      const convRaw = localStorage.getItem("confi_conversations");
      if (convRaw) setConversations(JSON.parse(convRaw));
    } catch {
      // ignore
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConvId]);

  const persistUser = (u: User) => {
    localStorage.setItem("confi_user", JSON.stringify(u));
  };

  const persistConversations = (convs: Conversation[]) => {
    localStorage.setItem("confi_conversations", JSON.stringify(convs));
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Auth handlers ──────────────────────────────────────────────────────────

  const handleSignupEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!email.includes("@")) { setAuthError("Enter a valid email address."); return; }
    setStep("signup_phone");
  };

  const handleSignupPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 7) { setAuthError("Enter a valid phone number."); return; }
    const code = generateOTP();
    setGeneratedOtp(code);
    // In production this would send real SMS; here we show it for demo
    alert(`[Demo] Your Confi OTP is: ${code}\n\nIn production this is sent via SMS.`);
    setStep("signup_otp");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (otp.trim() !== generatedOtp) {
      setAuthError("Incorrect OTP. Please try again.");
      return;
    }
    setStep("signup_password");
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (password.length < 8) { setAuthError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setAuthError("Passwords do not match."); return; }
    setStep("signup_legalname");
  };

  const handleLegalName = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!legalFirstName.trim() || !legalLastName.trim()) {
      setAuthError("Both first and last legal name are required.");
      return;
    }
    if (legalFirstName.trim().length < 2 || legalLastName.trim().length < 2) {
      setAuthError("Names must be at least 2 characters.");
      return;
    }
    setStep("signup_profile");
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!displayName.trim()) { setAuthError("Display name is required."); return; }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error ?? "Signup failed. Try a different email.");
        setAuthLoading(false);
        return;
      }
      const legalFullName = `${legalFirstName.trim()} ${legalLastName.trim()}`;
      const newUser: User = {
        email: data.email ?? email,
        displayName: displayName.trim(),
        legalName: legalFullName,
        legalNameVerified: true,
        phone,
        avatarColor,
        sessionToken: generateId(),
      };
      setUser(newUser);
      persistUser(newUser);
      setStep("app");
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setAuthLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error ?? "Login failed.");
        setAuthLoading(false);
        return;
      }
      // Restore or create user profile
      const existingRaw = localStorage.getItem("confi_user");
      let restoredUser: User;
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as User;
        if (existing.email === (data.email ?? email)) {
          restoredUser = { ...existing, sessionToken: generateId() };
        } else {
          restoredUser = {
            email: data.email ?? email,
            displayName: email.split("@")[0],
            legalName: "Not Verified",
            legalNameVerified: false,
            phone: "",
            avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
            sessionToken: generateId(),
          };
        }
      } else {
        restoredUser = {
          email: data.email ?? email,
          displayName: email.split("@")[0],
          legalName: "Not Verified",
          legalNameVerified: false,
          phone: "",
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          sessionToken: generateId(),
        };
      }
      setUser(restoredUser);
      persistUser(restoredUser);
      setStep("app");
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setStep("landing");
    setEmail("");
    setPassword("");
    setPhone("");
    setOtp("");
    setGeneratedOtp("");
    setLegalFirstName("");
    setLegalLastName("");
    setDisplayName("");
    setActiveConvId(null);
  };

  // ── Messaging handlers ─────────────────────────────────────────────────────

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConv || !user) return;
    const msg: Message = {
      id: generateId(),
      senderId: user.email,
      senderName: user.displayName,
      text: messageText.trim(),
      timestamp: Date.now(),
      isConfidential: activeConv.confidentialMode,
    };
    const updated = conversations.map((c) =>
      c.id === activeConv.id ? { ...c, messages: [...c.messages, msg] } : c
    );
    setConversations(updated);
    persistConversations(updated);
    setMessageText("");
  };

  const handleToggleConfidential = () => {
    if (!activeConv || !user) return;
    if (!activeConv.confidentialMode) {
      setShowNDA(true);
    } else {
      // Turn off
      const updated = conversations.map((c) =>
        c.id === activeConv.id
          ? { ...c, confidentialMode: false, ndaActivatedAt: undefined, ndaActivatedBy: undefined }
          : c
      );
      setConversations(updated);
      persistConversations(updated);
    }
  };

  const handleNDAAccept = () => {
    if (!activeConv || !user) return;
    const updated = conversations.map((c) =>
      c.id === activeConv.id
        ? { ...c, confidentialMode: true, ndaActivatedAt: Date.now(), ndaActivatedBy: user.email }
        : c
    );
    setConversations(updated);
    persistConversations(updated);
    setShowNDA(false);
  };

  const handleNewConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConvEmail.trim() || !newConvEmail.includes("@")) return;
    const existing = conversations.find((c) => c.participantEmail === newConvEmail.trim());
    if (existing) { setActiveConvId(existing.id); setShowNewConv(false); return; }
    const conv: Conversation = {
      id: generateId(),
      participantName: newConvEmail.split("@")[0],
      participantEmail: newConvEmail.trim(),
      participantAvatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      messages: [],
      confidentialMode: false,
    };
    const updated = [conv, ...conversations];
    setConversations(updated);
    persistConversations(updated);
    setActiveConvId(conv.id);
    setNewConvEmail("");
    setShowNewConv(false);
  };

  const filteredConvs = conversations.filter((c) =>
    c.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.participantEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render: Landing ────────────────────────────────────────────────────────
  if (step === "landing") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg,#6C63FF,#a855f7)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <LockIcon size={36} color="#fff" />
              </div>
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, color: "#1e293b" }}>
              Confi
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>
              Secure messaging with legally binding confidentiality
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setStep("signup_email")}
              style={{ ...styles.btnPrimary, padding: "14px 24px", fontSize: 15 }}
            >
              Create Account
            </button>
            <button
              onClick={() => setStep("login")}
              style={{ ...styles.btnSecondary, padding: "14px 24px", fontSize: 15 }}
            >
              Sign In
            </button>
          </div>

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🔐", text: "End-to-end encrypted messaging" },
              { icon: "⚖️", text: "International NDA with one tap" },
              { icon: "✅", text: "Legal identity verification" },
              { icon: "🌍", text: "Enforceable across jurisdictions" },
            ].map((f) => (
              <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569" }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Login ──────────────────────────────────────────────────────────
  if (step === "login") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("landing")} style={styles.backBtn}>← Back</button>
          <h2 style={styles.authTitle}>Welcome back</h2>
          <p style={styles.authSubtitle}>Sign in to your Confi account</p>
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input} type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input} type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" disabled={authLoading} style={styles.btnPrimary}>
              {authLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 16 }}>
            No account?{" "}
            <button onClick={() => setStep("signup_email")} style={styles.linkBtn}>
              Create one
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Signup — Email ─────────────────────────────────────────────────
  if (step === "signup_email") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("landing")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 1 of 5</div>
          <h2 style={styles.authTitle}>Your email address</h2>
          <p style={styles.authSubtitle}>We&apos;ll use this to identify your account.</p>
          <form onSubmit={handleSignupEmail} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input} type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
              />
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Continue</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Signup — Phone ─────────────────────────────────────────────────
  if (step === "signup_phone") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("signup_email")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 2 of 5</div>
          <h2 style={styles.authTitle}>Phone verification</h2>
          <p style={styles.authSubtitle}>
            Enter your phone number to receive a one-time code.
          </p>
          <form onSubmit={handleSignupPhone} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                style={styles.input} type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000" required autoFocus
              />
              <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Include country code (e.g. +1, +44, +91)
              </span>
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Send OTP</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Signup — OTP ───────────────────────────────────────────────────
  if (step === "signup_otp") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("signup_phone")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 2 of 5</div>
          <h2 style={styles.authTitle}>Enter OTP</h2>
          <p style={styles.authSubtitle}>
            A 6-digit code was sent to <strong>{phone}</strong>
          </p>
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>6-Digit Code</label>
              <input
                style={{ ...styles.input, letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                type="text" inputMode="numeric" maxLength={6}
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="------" required autoFocus
              />
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Verify</button>
            <button
              type="button"
              onClick={() => {
                const code = generateOTP();
                setGeneratedOtp(code);
                setOtp("");
                alert(`[Demo] New OTP: ${code}`);
              }}
              style={styles.linkBtn}
            >
              Resend OTP
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Signup — Password ──────────────────────────────────────────────
  if (step === "signup_password") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("signup_otp")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 3 of 5</div>
          <h2 style={styles.authTitle}>Create a password</h2>
          <p style={styles.authSubtitle}>Minimum 8 characters. Make it strong.</p>
          <form onSubmit={handleSetPassword} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input} type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoFocus
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                style={styles.input} type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Continue</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Signup — Legal Name ────────────────────────────────────────────
  if (step === "signup_legalname") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("signup_password")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 4 of 5</div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <ShieldIcon size={40} color="#6C63FF" />
          </div>
          <h2 style={styles.authTitle}>Identity Verification</h2>
          <p style={styles.authSubtitle}>
            Your legal name is required for NDA activation. It will be legally binding on any
            Non-Disclosure Agreement you activate on Confi.
          </p>
          <div style={{
            background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#713f12",
          }}>
            ⚠️ Enter your name <strong>exactly as it appears on your government-issued ID</strong>.
            This name will be used in legally binding international NDAs.
          </div>
          <form onSubmit={handleLegalName} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Legal First Name</label>
              <input
                style={styles.input} type="text" value={legalFirstName}
                onChange={(e) => setLegalFirstName(e.target.value)}
                placeholder="As on your ID" required autoFocus
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Legal Last Name</label>
              <input
                style={styles.input} type="text" value={legalLastName}
                onChange={(e) => setLegalLastName(e.target.value)}
                placeholder="As on your ID" required
              />
            </div>
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              fontSize: 12, color: "#475569", marginBottom: 12, cursor: "pointer",
            }}>
              <input type="checkbox" required style={{ marginTop: 2 }} />
              <span>
                I confirm that the name above matches my government-issued identification and
                I understand it will be used in legally binding NDAs on this platform.
              </span>
            </label>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Verify &amp; Continue</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Signup — Profile ───────────────────────────────────────────────
  if (step === "signup_profile") {
    return (
      <div style={styles.landingContainer}>
        <div style={styles.landingCard}>
          <button onClick={() => setStep("signup_legalname")} style={styles.backBtn}>← Back</button>
          <div style={styles.stepIndicator}>Step 5 of 5</div>
          <h2 style={styles.authTitle}>Set up your profile</h2>
          <p style={styles.authSubtitle}>
            Your display name is what others see. It can be a nickname — your legal name stays private.
          </p>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Avatar name={displayName || "?"} color={avatarColor} size={72} />
          </div>
          <form onSubmit={handleCreateProfile} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                style={styles.input} type="text" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nickname or full name" required autoFocus maxLength={40}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Avatar Color</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setAvatarColor(c)}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", background: c,
                      border: avatarColor === c ? "3px solid #1e293b" : "3px solid transparent",
                      cursor: "pointer", padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button type="submit" disabled={authLoading} style={styles.btnPrimary}>
              {authLoading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: App ────────────────────────────────────────────────────────────
  if (step === "app" && user) {
    return (
      <div style={styles.appContainer}>
        {/* NDA Modal */}
        {showNDA && activeConv && (
          <NDAModal
            user={user}
            conversation={activeConv}
            onAccept={handleNDAAccept}
            onDecline={() => setShowNDA(false)}
          />
        )}

        {/* Profile Modal */}
        {showProfile && (
          <ProfileModal
            user={user}
            onClose={() => setShowProfile(false)}
            onUpdate={(updates) => {
              const updated = { ...user, ...updates };
              setUser(updated);
              persistUser(updated);
            }}
          />
        )}

        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Sidebar Header */}
          <div style={styles.sidebarHeader}>
            <button onClick={() => setShowProfile(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Avatar name={user.displayName} color={user.avatarColor} size={40} />
            </button>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                {user.displayName}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: user.legalNameVerified ? "#22c55e" : "#f59e0b" }}>
                {user.legalNameVerified ? "✓ Identity Verified" : "⚠ Not Verified"}
              </p>
            </div>
            <button
              onClick={() => setShowNewConv(true)}
              style={{
                background: "#6C63FF", border: "none", borderRadius: "50%",
                width: 36, height: 36, display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 22,
              }}
              title="New conversation"
            >
              +
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: "0 12px 12px" }}>
            <input
              style={{ ...styles.input, margin: 0 }}
              placeholder="🔍 Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* New Conversation Form */}
          {showNewConv && (
            <form onSubmit={handleNewConversation} style={{ padding: "0 12px 12px", display: "flex", gap: 8 }}>
              <input
                style={{ ...styles.input, margin: 0, flex: 1 }}
                placeholder="Contact email…"
                value={newConvEmail}
                onChange={(e) => setNewConvEmail(e.target.value)}
                type="email"
                autoFocus
              />
              <button type="submit" style={{ ...styles.btnPrimary, padding: "8px 12px" }}>Go</button>
              <button type="button" onClick={() => setShowNewConv(false)} style={{ ...styles.btnSecondary, padding: "8px 10px" }}>✕</button>
            </form>
          )}

          {/* Conversation List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConvs.length === 0 && (
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
                No conversations yet. Hit + to start one.
              </p>
            )}
            {filteredConvs.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", width: "100%", border: "none",
                    background: isActive ? "#ede9fe" : "transparent",
                    cursor: "pointer", textAlign: "left",
                    borderLeft: isActive ? "3px solid #6C63FF" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <Avatar name={conv.participantName} color={conv.participantAvatarColor} size={44} />
                    {conv.confidentialMode && (
                      <div style={{
                        position: "absolute", bottom: -2, right: -2,
                        background: "#6C63FF", borderRadius: "50%",
                        width: 16, height: 16, display: "flex", alignItems: "center",
                        justifyContent: "center", border: "2px solid #fff",
                      }}>
                        <LockIcon size={9} color="#fff" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                        {conv.participantName}
                      </p>
                      {lastMsg && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>
                          {formatTime(lastMsg.timestamp)}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: "#64748b",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {conv.confidentialMode && <LockIcon size={10} color="#6C63FF" />}{" "}
                      {lastMsg ? lastMsg.text : "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
            <button onClick={handleLogout} style={{
              width: "100%", padding: "8px", background: "none", border: "1px solid #e2e8f0",
              borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#64748b",
            }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={styles.chatArea}>
          {!activeConv ? (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg,#6C63FF22,#a855f722)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <LockIcon size={36} color="#6C63FF" />
              </div>
              <h2 style={{ margin: 0, color: "#1e293b" }}>Confi Messaging</h2>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, textAlign: "center", maxWidth: 300 }}>
                Select a conversation or start a new one. Activate Confidential Mode to bind both
                parties to an international NDA.
              </p>
              <button onClick={() => setShowNewConv(true)} style={styles.btnPrimary}>
                + Start a Conversation
              </button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={styles.chatHeader}>
                <Avatar
                  name={activeConv.participantName}
                  color={activeConv.participantAvatarColor}
                  size={40}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                    {activeConv.participantName}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>
                    {activeConv.participantEmail}
                  </p>
                </div>

                {/* Confidential Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {activeConv.confidentialMode && (
                    <div style={{
                      background: "#ede9fe", borderRadius: 20, padding: "4px 10px",
                      display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6C63FF",
                    }}>
                      <ShieldIcon size={12} color="#6C63FF" />
                      <span>NDA Active</span>
                    </div>
                  )}
                  <button
                    onClick={handleToggleConfidential}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", border: "none", borderRadius: 20, cursor: "pointer",
                      background: activeConv.confidentialMode ? "#6C63FF" : "#f1f5f9",
                      color: activeConv.confidentialMode ? "#fff" : "#475569",
                      fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                    }}
                  >
                    <LockIcon size={13} color={activeConv.confidentialMode ? "#fff" : "#475569"} />
                    {activeConv.confidentialMode ? "Confidential ON" : "Confidential OFF"}
                  </button>
                </div>
              </div>

              {/* NDA Banner */}
              {activeConv.confidentialMode && activeConv.ndaActivatedAt && (
                <div style={{
                  background: "linear-gradient(90deg,#ede9fe,#e0e7ff)",
                  padding: "8px 20px",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12, color: "#4338ca", borderBottom: "1px solid #c7d2fe",
                }}>
                  <ShieldIcon size={14} color="#4338ca" />
                  <span>
                    <strong>International NDA Active</strong> — All messages in this conversation
                    are covered by a mutual NDA signed by both parties.
                    Activated {formatDate(activeConv.ndaActivatedAt)}.
                  </span>
                </div>
              )}

              {/* Messages */}
              <div style={styles.messageList}>
                {activeConv.messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, paddingTop: 40 }}>
                    No messages yet. Say hello!
                    {activeConv.confidentialMode && (
                      <p style={{ color: "#6C63FF", marginTop: 8 }}>
                        🔒 This conversation is protected by NDA
                      </p>
                    )}
                  </div>
                )}
                {activeConv.messages.map((msg) => {
                  const isOwn = msg.senderId === user.email;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: isOwn ? "row-reverse" : "row",
                        alignItems: "flex-end", gap: 8, marginBottom: 12,
                      }}
                    >
                      {!isOwn && (
                        <Avatar name={msg.senderName} color={activeConv.participantAvatarColor} size={30} />
                      )}
                      <div style={{
                        maxWidth: "65%",
                        background: isOwn
                          ? (msg.isConfidential ? "linear-gradient(135deg,#6C63FF,#a855f7)" : "#6C63FF")
                          : (msg.isConfidential ? "#ede9fe" : "#f1f5f9"),
                        color: isOwn ? "#fff" : "#1e293b",
                        borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        padding: "10px 14px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}>
                        {msg.isConfidential && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 10, opacity: 0.8, marginBottom: 4,
                          }}>
                            <LockIcon size={9} color={isOwn ? "#fff" : "#6C63FF"} />
                            <span>Confidential</span>
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{msg.text}</p>
                        <p style={{
                          margin: "4px 0 0", fontSize: 10,
                          opacity: 0.7, textAlign: "right",
                        }}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} style={styles.inputBar}>
                {activeConv.confidentialMode && (
                  <LockIcon size={16} color="#6C63FF" />
                )}
                <input
                  style={{
                    flex: 1, border: "1px solid #e2e8f0", borderRadius: 24,
                    padding: "10px 16px", fontSize: 14, outline: "none",
                    background: activeConv.confidentialMode ? "#faf5ff" : "#fff",
                  }}
                  placeholder={
                    activeConv.confidentialMode
                      ? "🔒 Confidential message (NDA protected)…"
                      : "Type a message…"
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  style={{
                    background: messageText.trim() ? "#6C63FF" : "#e2e8f0",
                    border: "none", borderRadius: "50%", width: 44, height: 44,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: messageText.trim() ? "pointer" : "not-allowed",
                    transition: "background 0.2s",
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill={messageText.trim() ? "#fff" : "#94a3b8"}>
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </form>
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
  landingContainer: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#f8f7ff 0%,#ede9fe 50%,#e0e7ff 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  },
  landingCard: {
    background: "#fff", borderRadius: 20, padding: "36px 32px",
    width: "100%", maxWidth: 420,
    boxShadow: "0 20px 60px rgba(108,99,255,0.15)",
  },
  authTitle: {
    margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: "#1e293b",
  },
  authSubtitle: {
    margin: "0 0 24px", fontSize: 14, color: "#64748b", lineHeight: 1.6,
  },
  stepIndicator: {
    display: "inline-block", background: "#ede9fe", color: "#6C63FF",
    fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
    marginBottom: 12,
  },
  backBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#6C63FF", fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16,
  },
  form: {
    display: "flex", flexDirection: "column", gap: 0,
  },
  fieldGroup: {
    display: "flex", flexDirection: "column", gap: 4, marginBottom: 16,
  },
  label: {
    fontSize: 13, fontWeight: 600, color: "#374151",
  },
  input: {
    padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10,
    fontSize: 14, outline: "none", transition: "border-color 0.2s",
    color: "#1e293b", background: "#fff",
    marginBottom: 0,
  },
  btnPrimary: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "11px 20px", background: "#6C63FF", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: "pointer", width: "100%", marginBottom: 8,
    transition: "background 0.2s",
  },
  btnSecondary: {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "11px 20px", background: "#f1f5f9", color: "#475569",
    border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: "pointer", width: "100%", marginBottom: 8,
  },
  linkBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#6C63FF", fontSize: 13, fontWeight: 600, padding: "4px 0",
    display: "block", width: "100%", textAlign: "center",
  },
  errorText: {
    color: "#FC5C65", fontSize: 13, margin: "0 0 10px",
    background: "#fff1f2", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid #FC5C65",
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20, backdropFilter: "blur(4px)",
  },
  modalBox: {
    background: "#fff", borderRadius: 20, padding: "28px 32px",
    width: "100%", maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
  },
  appContainer: {
    display: "flex", height: "100vh", overflow: "hidden", background: "#fff",
  },
  sidebar: {
    width: 320, flexShrink: 0, display: "flex", flexDirection: "column",
    borderRight: "1px solid #e2e8f0", background: "#fff", overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "16px", borderBottom: "1px solid #e2e8f0",
  },
  chatArea: {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fafafa",
  },
  chatHeader: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 20px", borderBottom: "1px solid #e2e8f0",
    background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  messageList: {
    flex: 1, overflowY: "auto", padding: "20px",
  },
  inputBar: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#fff",
  },
};