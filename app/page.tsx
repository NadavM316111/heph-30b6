"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "register"
  | "otp"
  | "email_backup"
  | "profile_setup"
  | "id_verify"
  | "selfie_verify"
  | "home"
  | "chat"
  | "settings"
  | "profile_view";

type VerificationStatus = "none" | "pending" | "verified" | "rejected";

type User = {
  id: string;
  phone: string;
  email?: string;
  displayName: string;
  avatar: string; // emoji
  verificationStatus: VerificationStatus;
  idType?: "government_id" | "selfie";
  sessionToken: string;
  createdAt: number;
  twoFAEnabled: boolean;
  passwordHash?: string;
};

type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  confidential: boolean;
  ndaAccepted?: boolean;
  read: boolean;
};

type Conversation = {
  id: string;
  participantIds: string[];
  participantNames: string[];
  participantAvatars: string[];
  messages: Message[];
  confidentialMode: boolean;
  ndaActive: boolean;
  lastActivity: number;
};

type AppState = {
  currentUser: User | null;
  conversations: Conversation[];
  contacts: User[];
};

// ─── Mock contacts (demo data) ────────────────────────────────────────────────
const MOCK_CONTACTS: User[] = [
  {
    id: "contact_1",
    phone: "+1 555-0101",
    email: "alice@example.com",
    displayName: "Alice Chen",
    avatar: "👩‍💼",
    verificationStatus: "verified",
    sessionToken: "mock",
    createdAt: Date.now() - 86400000 * 30,
    twoFAEnabled: true,
  },
  {
    id: "contact_2",
    phone: "+1 555-0102",
    displayName: "Bob Martinez",
    avatar: "👨‍💻",
    verificationStatus: "verified",
    sessionToken: "mock",
    createdAt: Date.now() - 86400000 * 20,
    twoFAEnabled: false,
  },
  {
    id: "contact_3",
    phone: "+1 555-0103",
    displayName: "Carol Smith",
    avatar: "👩‍🔬",
    verificationStatus: "none",
    sessionToken: "mock",
    createdAt: Date.now() - 86400000 * 10,
    twoFAEnabled: false,
  },
  {
    id: "contact_4",
    phone: "+1 555-0104",
    displayName: "David Park",
    avatar: "👨‍⚖️",
    verificationStatus: "verified",
    sessionToken: "mock",
    createdAt: Date.now() - 86400000 * 5,
    twoFAEnabled: true,
  },
];

const AVATARS = ["🧑", "👩", "👨", "🧑‍💼", "👩‍💼", "👨‍💼", "🧑‍💻", "👩‍💻", "👨‍💻", "🧑‍🎨", "👩‍🎨", "👨‍🎨", "🧑‍🔬", "👩‍🔬", "👨‍🔬", "🧑‍⚖️", "👩‍⚖️", "👨‍⚖️"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function generateJWT(userId: string, phone: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: userId, phone, iat: Date.now(), exp: Date.now() + 86400000 * 7 }));
  const sig = simpleHash(header + "." + payload + ".confi_secret_key");
  return `${header}.${payload}.${sig}`;
}

function verifyJWT(token: string): { sub: string; phone: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ts) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── NDA Text ─────────────────────────────────────────────────────────────────
const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of activation between the verified parties to this Confidential Mode conversation (collectively, "Parties") through the Confi Messaging Platform ("Platform").

RECITALS
WHEREAS, the Parties wish to exchange information of a confidential and proprietary nature through the Platform's Confidential Mode feature; and
WHEREAS, the Parties desire to protect such information from unauthorized disclosure;

NOW, THEREFORE, in consideration of the mutual covenants herein, the Parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any and all information disclosed through this Confidential Mode conversation, including but not limited to: business strategies, financial data, personal information, trade secrets, technical data, and any other information marked or understood to be confidential.

2. OBLIGATIONS OF RECEIVING PARTY
Each Party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for purposes related to this conversation; (d) protect Confidential Information with at least the same degree of care used to protect its own confidential information.

3. TERM
This Agreement shall remain in effect for a period of five (5) years from the date of activation, unless extended by mutual written agreement of the Parties.

4. JURISDICTION
This Agreement shall be governed by international law principles, including applicable provisions of the UNCITRAL Model Law, and shall be enforceable in any jurisdiction where the Parties are located.

5. REMEDIES
The Parties acknowledge that breach of this Agreement may cause irreparable harm and that monetary damages may be insufficient. The non-breaching Party shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.

6. SEVERABILITY
If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.

7. ENTIRE AGREEMENT
This Agreement, activated through the Confi Platform's Confidential Mode, constitutes the entire agreement between the Parties with respect to the subject matter hereof.

By activating Confidential Mode, both verified Parties accept and are legally bound by this Agreement.`;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [appState, setAppState] = useState<AppState>({ currentUser: null, conversations: [], contacts: MOCK_CONTACTS });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Registration state
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [twoFAEnabled, set2FA] = useState(false);

  // Verification state
  const [idType, setIdType] = useState<"government_id" | "selfie">("government_id");
  const [idFile, setIdFile] = useState<string | null>(null);
  const [selfieCapturing, setSelfieCapturing] = useState(false);
  const [selfieCount, setSelfieCount] = useState(0);
  const [verifyStep, setVerifyStep] = useState(0);
  const [verifyProgress, setVerifyProgress] = useState(0);

  // Chat state
  const [messageInput, setMessageInput] = useState("");
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaScrolled, setNdaScrolled] = useState(false);
  const [showConfidentialPrompt, setShowConfidentialPrompt] = useState(false);

  // UI state
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "privacy" | "security">("account");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaRef = useRef<HTMLDivElement>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: window.location.pathname }) }).catch(() => {});

    const stored = localStorage.getItem("confi_app_state");
    const token = localStorage.getItem("confi_session");

    if (stored && token) {
      const parsed: AppState = JSON.parse(stored);
      const jwtData = verifyJWT(token);
      if (jwtData && parsed.currentUser) {
        setAppState(prev => ({ ...parsed, contacts: MOCK_CONTACTS }));
        setTimeout(() => setScreen("home"), 1500);
        return;
      }
    }
    setTimeout(() => setScreen("register"), 1500);
  }, []);

  // ─── Persist state ────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState.currentUser) {
      localStorage.setItem("confi_app_state", JSON.stringify(appState));
    }
  }, [appState]);

  // ─── Scroll messages ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversationId, appState.conversations]);

  // ─── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  // ─── OTP Timer ────────────────────────────────────────────────────────────
  const startOtpTimer = useCallback(() => {
    setOtpTimer(60);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) { clearInterval(otpTimerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  // ─── Send OTP ─────────────────────────────────────────────────────────────
  const handleSendOTP = useCallback(() => {
    setError("");
    const fullPhone = countryCode + " " + phone.trim();
    if (phone.trim().length < 7) { setError("Enter a valid phone number"); return; }
    const code = generateOTP();
    setGeneratedOtp(code);
    setOtpSent(true);
    startOtpTimer();
    // Simulate SMS
    showToast(`📱 SMS sent to ${fullPhone} — Demo OTP: ${code}`);
    setScreen("otp");
  }, [phone, countryCode, startOtpTimer, showToast]);

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerifyOTP = useCallback(() => {
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit code"); return; }
    if (otp !== generatedOtp) { setError("Incorrect code. Please try again."); return; }
    setScreen("email_backup");
  }, [otp, generatedOtp]);

  // ─── Email & Password ─────────────────────────────────────────────────────
  const handleEmailBackup = useCallback(async () => {
    setError("");
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "signup", email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok && data.error && !data.error.includes("exist")) {
        setError(data.error);
        setLoading(false);
        return;
      }
    } catch {
      // Network error – proceed anyway (auth is best-effort here)
    }
    setLoading(false);
    setScreen("profile_setup");
  }, [email, password]);

  // ─── Profile setup ────────────────────────────────────────────────────────
  const handleProfileSetup = useCallback(() => {
    setError("");
    if (!displayName.trim()) { setError("Enter a display name"); return; }
    const fullPhone = countryCode + " " + phone;
    const userId = "user_" + generateId();
    const token = generateJWT(userId, fullPhone);
    const newUser: User = {
      id: userId,
      phone: fullPhone,
      email: email || undefined,
      displayName: displayName.trim(),
      avatar: selectedAvatar,
      verificationStatus: "none",
      sessionToken: token,
      createdAt: Date.now(),
      twoFAEnabled,
      passwordHash: simpleHash(password),
    };
    localStorage.setItem("confi_session", token);
    setAppState(prev => ({ ...prev, currentUser: newUser, contacts: MOCK_CONTACTS }));
    showToast("✅ Account created successfully!");
    setScreen("home");
  }, [displayName, selectedAvatar, countryCode, phone, email, password, twoFAEnabled, showToast]);

  // ─── Start ID Verification ────────────────────────────────────────────────
  const handleStartVerification = useCallback((type: "government_id" | "selfie") => {
    setIdType(type);
    setVerifyStep(0);
    setVerifyProgress(0);
    setIdFile(null);
    setSelfieCount(0);
    if (type === "selfie") {
      setScreen("selfie_verify");
    } else {
      setScreen("id_verify");
    }
  }, []);

  // ─── Simulate ID verification ─────────────────────────────────────────────
  const handleIDUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setIdFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmitID = useCallback(() => {
    if (!idFile) { setError("Please upload your ID document"); return; }
    setError("");
    setLoading(true);
    setVerifyStep(1);
    // Simulate AI verification steps
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setVerifyProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setLoading(false);
        setVerifyStep(2);
        setAppState(prev => ({
          ...prev,
          currentUser: prev.currentUser
            ? { ...prev.currentUser, verificationStatus: "verified", idType: "government_id" }
            : null,
        }));
        showToast("🎉 Identity verified! Confidential Mode unlocked.");
        setTimeout(() => setScreen("home"), 2000);
      }
    }, 300);
  }, [idFile, showToast]);

  // ─── Selfie verification ──────────────────────────────────────────────────
  const handleSelfieStep = useCallback(() => {
    setSelfieCapturing(true);
    setTimeout(() => {
      setSelfieCapturing(false);
      setSelfieCount(c => {
        const next = c + 1;
        if (next >= 3) {
          setVerifyStep(1);
          let progress = 0;
          const interval = setInterval(() => {
            progress += 8;
            setVerifyProgress(progress);
            if (progress >= 100) {
              clearInterval(interval);
              setVerifyStep(2);
              setAppState(prev => ({
                ...prev,
                currentUser: prev.currentUser
                  ? { ...prev.currentUser, verificationStatus: "verified", idType: "selfie" }
                  : null,
              }));
              showToast("🎉 Liveness check passed! Confidential Mode unlocked.");
              setTimeout(() => setScreen("home"), 2000);
            }
          }, 250);
        }
        return next;
      });
    }, 1500);
  }, [showToast]);

  // ─── Open conversation ────────────────────────────────────────────────────
  const handleOpenConversation = useCallback((contact: User) => {
    const existingId = appState.conversations.find(c =>
      c.participantIds.includes(contact.id) && c.participantIds.includes(appState.currentUser!.id)
    )?.id;

    if (existingId) {
      setActiveConversationId(existingId);
    } else {
      const newConv: Conversation = {
        id: "conv_" + generateId(),
        participantIds: [appState.currentUser!.id, contact.id],
        participantNames: [appState.currentUser!.displayName, contact.displayName],
        participantAvatars: [appState.currentUser!.avatar, contact.avatar],
        messages: [],
        confidentialMode: false,
        ndaActive: false,
        lastActivity: Date.now(),
      };
      setAppState(prev => ({ ...prev, conversations: [...prev.conversations, newConv] }));
      setActiveConversationId(newConv.id);
    }
    setScreen("chat");
  }, [appState.conversations, appState.currentUser]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || !activeConversationId) return;
    const conv = appState.conversations.find(c => c.id === activeConversationId);
    if (!conv) return;

    const newMsg: Message = {
      id: "msg_" + generateId(),
      senderId: appState.currentUser!.id,
      content: messageInput.trim(),
      timestamp: Date.now(),
      confidential: conv.confidentialMode,
      ndaAccepted: conv.ndaActive,
      read: false,
    };

    setAppState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, newMsg], lastActivity: Date.now() }
          : c
      ),
    }));
    setMessageInput("");
  }, [messageInput, activeConversationId, appState.conversations, appState.currentUser]);

  // ─── Toggle confidential mode ─────────────────────────────────────────────
  const handleToggleConfidential = useCallback(() => {
    if (!appState.currentUser) return;
    const conv = appState.conversations.find(c => c.id === activeConversationId);
    if (!conv) return;

    if (!conv.confidentialMode) {
      // Turning ON
      if (appState.currentUser.verificationStatus !== "verified") {
        setShowVerifyBanner(true);
        return;
      }
      setShowNDAModal(true);
      setNdaScrolled(false);
    } else {
      // Turning OFF
      setAppState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c =>
          c.id === activeConversationId
            ? { ...c, confidentialMode: false, ndaActive: false }
            : c
        ),
      }));
      showToast("Confidential Mode deactivated");
    }
  }, [appState.currentUser, appState.conversations, activeConversationId, showToast]);

  // ─── Accept NDA ───────────────────────────────────────────────────────────
  const handleAcceptNDA = useCallback(() => {
    setShowNDAModal(false);
    setAppState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === activeConversationId
          ? { ...c, confidentialMode: true, ndaActive: true }
          : c
      ),
    }));
    const systemMsg: Message = {
      id: "msg_" + generateId(),
      senderId: "system",
      content: "🔒 Confidential Mode is now active. This conversation is protected by an International NDA. All messages are covered under confidentiality rules.",
      timestamp: Date.now(),
      confidential: true,
      ndaAccepted: true,
      read: true,
    };
    setAppState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, systemMsg] }
          : c
      ),
    }));
    showToast("🔒 NDA activated. Confidential Mode is live.");
  }, [activeConversationId, showToast]);

  // ─── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    localStorage.removeItem("confi_session");
    localStorage.removeItem("confi_app_state");
    setAppState({ currentUser: null, conversations: [], contacts: MOCK_CONTACTS });
    setScreen("register");
    setPhone("");
    setEmail("");
    setPassword("");
    setOtp("");
    setDisplayName("");
  }, []);

  const activeConversation = appState.conversations.find(c => c.id === activeConversationId) || null;
  const otherParticipantName = activeConversation?.participantNames.find((_, i) => activeConversation.participantIds[i] !== appState.currentUser?.id) || "";
  const otherParticipantAvatar = activeConversation?.participantAvatars.find((_, i) => activeConversation.participantIds[i] !== appState.currentUser?.id) || "";
  const otherContact = appState.contacts.find(c => activeConversation?.participantIds.includes(c.id));

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={styles.root}>
      {/* Toast */}
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* NDA Modal */}
      {showNDAModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={{ fontSize: 24 }}>🔒</span>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, color: "#1a1a2e" }}>International NDA</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#666" }}>Scroll to bottom to accept</p>
            </div>
            <div
              ref={ndaRef}
              style={styles.ndaScroll}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setNdaScrolled(true);
              }}
            >
              <pre style={styles.ndaText}>{NDA_TEXT}</pre>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setShowNDAModal(false)}>Decline</button>
              <button
                style={{ ...styles.btnPrimary, opacity: ndaScrolled ? 1 : 0.4 }}
                disabled={!ndaScrolled}
                onClick={handleAcceptNDA}
              >
                Accept & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Banner */}
      {showVerifyBanner && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: 380 }}>
            <div style={{ textAlign: "center", padding: "24px 16px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
              <h2 style={{ margin: "0 0 8px", color: "#1a1a2e" }}>Verification Required</h2>
              <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>
                Confidential Mode requires identity verification. Verify your identity to activate the International NDA protection.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
                <button style={styles.btnSecondary} onClick={() => setShowVerifyBanner(false)}>Later</button>
                <button style={styles.btnPrimary} onClick={() => { setShowVerifyBanner(false); setScreen("id_verify"); setVerifyStep(0); setIdFile(null); }}>
                  Verify Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SPLASH ── */}
      {screen === "splash" && (
        <div style={styles.splash}>
          <div style={styles.splashLogo}>🔐</div>
          <h1 style={styles.splashTitle}>Confi</h1>
          <p style={styles.splashSub}>Confidential Messaging</p>
          <div style={styles.splashLoader}>
            <div style={styles.splashBar} />
          </div>
        </div>
      )}

      {/* ── REGISTER ── */}
      {screen === "register" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48 }}>🔐</div>
              <h1 style={styles.authTitle}>Welcome to Confi</h1>
              <p style={styles.authSub}>Enter your phone number to get started</p>
            </div>
            <label style={styles.label}>Phone Number</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                style={{ ...styles.input, width: 90, flex: "none" }}
              >
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+49">🇩🇪 +49</option>
                <option value="+33">🇫🇷 +33</option>
                <option value="+91">🇮🇳 +91</option>
                <option value="+86">🇨🇳 +86</option>
                <option value="+81">🇯🇵 +81</option>
                <option value="+55">🇧🇷 +55</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+27">🇿🇦 +27</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+65">🇸🇬 +65</option>
              </select>
              <input
                type="tel"
                placeholder="555-0100"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && handleSendOTP()}
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btnPrimary} onClick={handleSendOTP}>
              Send Verification Code 📲
            </button>
            <p style={styles.legalNote}>
              By continuing, you agree to our Terms of Service and Privacy Policy. Standard SMS rates may apply.
            </p>
          </div>
        </div>
      )}

      {/* ── OTP ── */}
      {screen === "otp" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => setScreen("register")}>← Back</button>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48 }}>📱</div>
              <h1 style={styles.authTitle}>Verify Phone</h1>
              <p style={styles.authSub}>We sent a 6-digit code to<br /><strong>{countryCode} {phone}</strong></p>
            </div>
            <label style={styles.label}>Verification Code</label>
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              style={{ ...styles.input, letterSpacing: 8, textAlign: "center", fontSize: 24, marginBottom: 16 }}
              onKeyDown={e => e.key === "Enter" && handleVerifyOTP()}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btnPrimary} onClick={handleVerifyOTP}>Verify Code ✓</button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              {otpTimer > 0 ? (
                <p style={{ color: "#888", fontSize: 13 }}>Resend code in {otpTimer}s</p>
              ) : (
                <button style={styles.linkBtn} onClick={handleSendOTP}>Resend Code</button>
              )}
            </div>
            <div style={styles.otpHint}>
              <span style={{ fontSize: 12 }}>💡</span>
              <span style={{ fontSize: 12, color: "#888" }}>Demo mode: The OTP was shown in the notification toast</span>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL BACKUP ── */}
      {screen === "email_backup" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48 }}>📧</div>
              <h1 style={styles.authTitle}>Email Backup</h1>
              <p style={styles.authSub}>Add email backup & create a password for account recovery</p>
            </div>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...styles.input, marginBottom: 12 }}
            />
            <label style={styles.label}>Password (min. 8 characters)</label>
            <input
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...styles.input, marginBottom: 16 }}
            />
            <div style={styles.toggle2FARow}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Enable Two-Factor Auth</div>
                <div style={{ fontSize: 12, color: "#888" }}>Extra security for your account</div>
              </div>
              <div
                style={{ ...styles.toggleSwitch, background: twoFAEnabled ? "#6c63ff" : "#ddd" }}
                onClick={() => set2FA(!twoFAEnabled)}
              >
                <div style={{ ...styles.toggleKnob, transform: twoFAEnabled ? "translateX(22px)" : "translateX(2px)" }} />
              </div>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btnPrimary} onClick={handleEmailBackup} disabled={loading}>
              {loading ? "Setting up…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ── PROFILE SETUP ── */}
      {screen === "profile_setup" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48 }}>👤</div>
              <h1 style={styles.authTitle}>Your Profile</h1>
              <p style={styles.authSub}>Choose a display name and avatar</p>
            </div>
            <div style={styles.avatarGrid}>
              {AVATARS.map(av => (
                <div
                  key={av}
                  style={{ ...styles.avatarOption, background: selectedAvatar === av ? "#ede9ff" : "#f5f5f5", border: selectedAvatar === av ? "2px solid #6c63ff" : "2px solid transparent" }}
                  onClick={() => setSelectedAvatar(av)}
                >
                  <span style={{ fontSize: 28 }}>{av}</span>
                </div>
              ))}
            </div>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{ ...styles.input, marginBottom: 16 }}
              onKeyDown={e => e.key === "Enter" && handleProfileSetup()}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btnPrimary} onClick={handleProfileSetup}>
              Create Account 🎉
            </button>
          </div>
        </div>
      )}

      {/* ── ID VERIFY ── */}
      {screen === "id_verify" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => setScreen("home")}>← Back</button>
            {verifyStep === 0 && (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 48 }}>🪪</div>
                  <h1 style={styles.authTitle}>ID Verification</h1>
                  <p style={styles.authSub}>Upload a government-issued ID to unlock Confidential Mode</p>
                </div>
                <div style={styles.idTypeRow}>
                  <button
                    style={{ ...styles.idTypeBtn, background: idType === "government_id" ? "#ede9ff" : "#f5f5f5", border: idType === "government_id" ? "2px solid #6c63ff" : "2px solid #ddd" }}
                    onClick={() => setIdType("government_id")}
                  >
                    <span style={{ fontSize: 24 }}>🪪</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Government ID</span>
                  </button>
                  <button
                    style={{ ...styles.idTypeBtn, background: idType === "selfie" ? "#ede9ff" : "#f5f5f5", border: idType === "selfie" ? "2px solid #6c63ff" : "2px solid #ddd" }}
                    onClick={() => { setIdType("selfie"); setScreen("selfie_verify"); }}
                  >
                    <span style={{ fontSize: 24 }}>🤳</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Selfie Check</span>
                  </button>
                </div>
                <div
                  style={styles.uploadZone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {idFile ? (
                    <img src={idFile} alt="ID" style={{ maxHeight: 120, borderRadius: 8, maxWidth: "100%" }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 32 }}>📄</span>
                      <p style={{ margin: "8px 0 0", color: "#888", fontSize: 14 }}>Click to upload your ID</p>
                      <p style={{ margin: 4, color: "#aaa", fontSize: 12 }}>Passport, Driver's License, or National ID</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleIDUpload} />
                {error && <p style={styles.error}>{error}</p>}
                <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={handleSubmitID} disabled={loading}>
                  Submit for Verification
                </button>
                <p style={styles.legalNote}>Your ID is processed securely and used only for identity verification. We never share your documents.</p>
              </>
            )}
            {verifyStep === 1 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <h2 style={{ color: "#1a1a2e", marginBottom: 8 }}>Verifying your ID</h2>
                <p style={{ color: "#888", marginBottom: 24 }}>AI-powered identity verification in progress…</p>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${verifyProgress}%` }} />
                </div>
                <p style={{ color: "#6c63ff", marginTop: 8, fontSize: 14 }}>{verifyProgress}%</p>
                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                  {["Document detected", "OCR extraction", "Authenticity check", "Identity confirmed"].map((step, i) => (
                    <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, opacity: verifyProgress > i * 25 ? 1 : 0.3 }}>
                      <span>{verifyProgress > (i + 1) * 25 ? "✅" : "⏳"}</span>
                      <span style={{ fontSize: 14 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {verifyStep === 2 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: "#22c55e", marginBottom: 8 }}>Verified!</h2>
                <p style={{ color: "#666" }}>Your identity has been confirmed. Confidential Mode is now available.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SELFIE VERIFY ── */}
      {screen === "selfie_verify" && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => setScreen("home")}>← Back</button>
            {verifyStep === 0 && (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 48 }}>🤳</div>
                  <h1 style={styles.authTitle}>Liveness Check</h1>
                  <p style={styles.authSub}>Complete 3 facial poses to verify your identity</p>
                </div>
                <div style={styles.selfieArea}>
                  {selfieCapturing ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 48, animation: "pulse 0.5s infinite" }}>📸</div>
                      <p style={{ color: "#6c63ff", fontWeight: 600 }}>Capturing…</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 48 }}>
                        {selfieCount === 0 ? "😐" : selfieCount === 1 ? "😊" : "😀"}
                      </div>
                      <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
                        {selfieCount === 0 ? "Look straight ahead" : selfieCount === 1 ? "Smile naturally" : "Turn slightly left"}
                      </p>
                    </div>
                  )}
                  <div style={styles.selfieProgress}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ ...styles.selfieStep, background: i < selfieCount ? "#6c63ff" : "#ddd" }} />
                    ))}
                  </div>
                </div>
                <p style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 16 }}>
                  Step {selfieCount + 1} of 3
                </p>
                <button style={styles.btnPrimary} onClick={handleSelfieStep} disabled={selfieCapturing}>
                  {selfieCapturing ? "Capturing…" : "📸 Capture"}
                </button>
              </>
            )}
            {verifyStep === 1 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
                <h2 style={{ color: "#1a1a2e", marginBottom: 8 }}>Liveness Analysis</h2>
                <p style={{ color: "#888", marginBottom: 24 }}>Processing facial recognition…</p>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${verifyProgress}%` }} />
                </div>
                <p style={{ color: "#6c63ff", marginTop: 8, fontSize: 14 }}>{verifyProgress}%</p>
              </div>
            )}
            {verifyStep === 2 && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                <h2 style={{ color: "#22c55e", marginBottom: 8 }}>Liveness Confirmed!</h2>
                <p style={{ color: "#666" }}>Your identity is verified. Confidential Mode is now available.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HOME ── */}
      {screen === "home" && appState.currentUser && (
        <div style={styles.appShell}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <div style={styles.sidebarLogo}>🔐 Confi</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.iconBtn} onClick={() => setScreen("profile_view")} title="Profile">👤</button>
                <button style={styles.iconBtn} onClick={() => setScreen("settings")} title="Settings">⚙️</button>
              </div>
            </div>

            {/* Current user */}
            <div style={styles.currentUserCard}>
              <div style={styles.avatarBig}>{appState.currentUser.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                  {appState.currentUser.displayName}
                  {appState.currentUser.verificationStatus === "verified" && <span style={styles.verifiedBadge}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis" }}>{appState.currentUser.phone}</div>
              </div>
            </div>

            {appState.currentUser.verificationStatus !== "verified" && (
              <div style={styles.verifyPrompt}>
                <span style={{ fontSize: 14 }}>🛡️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>Unverified account</div>
                  <div style={{ fontSize: 11, color: "#92400e" }}>Verify to unlock Confidential Mode</div>
                </div>
                <button style={styles.verifyBtn} onClick={() => { setVerifyStep(0); setIdFile(null); setScreen("id_verify"); }}>
                  Verify
                </button>
              </div>
            )}

            <div style={styles.sectionLabel}>Conversations</div>
            <div style={styles.convList}>
              {appState.conversations.length === 0 && (
                <div style={{ padding: "20px 16px", color: "#aaa", fontSize: 13, textAlign: "center" }}>
                  No conversations yet.<br />Start chatting below!
                </div>
              )}
              {[...appState.conversations]
                .sort((a, b) => b.lastActivity - a.lastActivity)
                .map(conv => {
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  const otherName = conv.participantNames.find((_, i) => conv.participantIds[i] !== appState.currentUser!.id);
                  const otherAv = conv.participantAvatars.find((_, i) => conv.participantIds[i] !== appState.currentUser!.id);
                  return (
                    <div
                      key={conv.id}
                      style={{ ...styles.convItem, background: conv.id === activeConversationId ? "#ede9ff" : "transparent" }}
                      onClick={() => { setActiveConversationId(conv.id); setScreen("chat"); }}
                    >
                      <div style={styles.convAvatar}>{otherAv}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{otherName}</span>
                          {conv.confidentialMode && <span style={{ fontSize: 10, background: "#6c63ff", color: "white", borderRadius: 4, padding: "1px 5px" }}>🔒 NDA</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lastMsg ? (lastMsg.confidential && !conv.confidentialMode ? "🔒 Confidential" : lastMsg.content.slice(0, 40)) : "No messages yet"}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>
                        {lastMsg ? formatTime(lastMsg.timestamp) : ""}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div style={styles.sectionLabel}>Contacts</div>
            <div style={styles.convList}>
              {appState.contacts.map(contact => (
                <div key={contact.id} style={styles.contactItem} onClick={() => handleOpenConversation(contact)}>
                  <div style={styles.convAvatar}>{contact.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{contact.displayName}</span>
                      {contact.verificationStatus === "verified" && <span style={{ ...styles.verifiedBadge, fontSize: 10 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{contact.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main area */}
          <div style={styles.mainArea}>
            <div style={styles.emptyState}>
              <div style={{ fontSize: 64 }}>🔐</div>
              <h2 style={{ color: "#1a1a2e", marginBottom: 8 }}>Confi Messaging</h2>
              <p style={{ color: "#888", maxWidth: 300, lineHeight: 1.6 }}>
                Select a contact to start a conversation. Enable Confidential Mode to activate an International NDA.
              </p>
              {appState.currentUser.verificationStatus !== "verified" && (
                <button style={{ ...styles.btnPrimary, marginTop: 20, maxWidth: 240 }} onClick={() => { setVerifyStep(0); setIdFile(null); setScreen("id_verify"); }}>
                  🛡️ Verify Identity
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT ── */}
      {screen === "chat" && appState.currentUser && activeConversation && (
        <div style={styles.appShell}>
          {/* Sidebar (collapsed on mobile conceptually) */}
          <div style={{ ...styles.sidebar, display: "flex" }}>
            <div style={styles.sidebarHeader}>
              <div style={styles.sidebarLogo}>🔐 Confi</div>
              <button style={styles.iconBtn} onClick={() => setScreen("settings")}>⚙️</button>
            </div>
            <div style={styles.currentUserCard}>
              <div style={styles.avatarBig}>{appState.currentUser.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                  {appState.currentUser.displayName}
                  {appState.currentUser.verificationStatus === "verified" && <span style={styles.verifiedBadge}>✓</span>}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>{appState.currentUser.phone}</div>
              </div>
            </div>
            {appState.currentUser.verificationStatus !== "verified" && (
              <div style={styles.verifyPrompt}>
                <span>🛡️</span>
                <div style={{ flex: 1, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: "#d97706" }}>Unverified</div>
                  <button style={styles.verifyBtn} onClick={() => { setVerifyStep(0); setIdFile(null); setScreen("id_verify"); }}>Verify</button>
                </div>
              </div>
            )}
            <div style={styles.sectionLabel}>Conversations</div>
            <div style={styles.convList}>
              {[...appState.conversations]
                .sort((a, b) => b.lastActivity - a.lastActivity)
                .map(conv => {
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  const otherName = conv.participantNames.find((_, i) => conv.participantIds[i] !== appState.currentUser!.id);
                  const otherAv = conv.participantAvatars.find((_, i) => conv.participantIds[i] !== appState.currentUser!.id);
                  return (
                    <div
                      key={conv.id}
                      style={{ ...styles.convItem, background: conv.id === activeConversationId ? "#ede9ff" : "transparent" }}
                      onClick={() => setActiveConversationId(conv.id)}
                    >
                      <div style={styles.convAvatar}>{otherAv}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{otherName}</span>
                          {conv.confidentialMode && <span style={{ fontSize: 9, background: "#6c63ff", color: "white", borderRadius: 3, padding: "1px 4px" }}>🔒</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lastMsg ? lastMsg.content.slice(0, 30) : "No messages"}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div style={styles.sectionLabel}>Contacts</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {appState.contacts.map(contact => (
                <div key={contact.id} style={styles.contactItem} onClick={() => handleOpenConversation(contact)}>
                  <div style={styles.convAvatar}>{contact.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{contact.displayName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{contact.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <div style={styles.chatPanel}>
            {/* Chat header */}
            <div style={{ ...styles.chatHeader, background: activeConversation.confidentialMode ? "linear-gradient(135deg, #1a1a2e, #16213e)" : "white" }}>
              <button style={{ ...styles.iconBtn, color: activeConversation.confidentialMode ? "white" : "#333" }} onClick={() => setScreen("home")}>←</button>
              <div style={styles.convAvatar}>{otherParticipantAvatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: activeConversation.confidentialMode ? "white" : "#1a1a2e", display: "flex", alignItems: "center", gap: 6 }}>
                  {otherParticipantName}
                  {otherContact?.verificationStatus === "verified" && <span style={{ ...styles.verifiedBadge, background: activeConversation.confidentialMode ? "#6c63ff" : "#6c63ff" }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: activeConversation.confidentialMode ? "#a0a0c0" : "#888" }}>
                  {activeConversation.confidentialMode ? "🔒 Confidential Mode • NDA Active" : "Standard Chat"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {activeConversation.ndaActive && (
                  <div style={styles.ndaBadge}>
                    <span>🔒</span><span>NDA</span>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 10, color: activeConversation.confidentialMode ? "#a0a0c0" : "#888", marginBottom: 3 }}>
                    Confidential Mode
                  </span>
                  <div
                    style={{ ...styles.toggleSwitch, background: activeConversation.confidentialMode ? "#6c63ff" : "#ddd" }}
                    onClick={handleToggleConfidential}
                  >
                    <div style={{ ...styles.toggleKnob, transform: activeConversation.confidentialMode ? "translateX(22px)" : "translateX(2px)" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Confidential mode banner */}
            {activeConversation.confidentialMode && (
              <div style={styles.confidentialBanner}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>International NDA Active</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>All messages are covered under strict confidentiality rules</span>
              </div>
            )}

            {/* Messages */}
            <div style={{ ...styles.messages, background: activeConversation.confidentialMode ? "#0f0f23" : "#f0f2f5" }}>
              {activeConversation.messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: activeConversation.confidentialMode ? "#555" : "#aaa" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{activeConversation.confidentialMode ? "🔒" : "💬"}</div>
                  <p style={{ fontSize: 14 }}>
                    {activeConversation.confidentialMode
                      ? "Confidential Mode is active. Your messages are NDA-protected."
                      : "Start a conversation with " + otherParticipantName}
                  </p>
                </div>
              )}
              {activeConversation.messages.map(msg => {
                const isMe = msg.senderId === appState.currentUser!.id;
                const isSystem = msg.senderId === "system";
                if (isSystem) {
                  return (
                    <div key={msg.id} style={styles.systemMsg}>
                      {msg.content}
                    </div>
                  );
                }
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 4 }}>
                    <div style={{
                      ...styles.bubble,
                      background: isMe
                        ? (msg.confidential ? "linear-gradient(135deg, #6c63ff, #a855f7)" : "#6c63ff")
                        : (msg.confidential ? "#1e1e3f" : "white"),
                      color: isMe ? "white" : (msg.confidential ? "#e0e0ff" : "#1a1a2e"),
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: isMe ? 16 : 4,
                    }}>
                      {msg.confidential && !isMe && <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>🔒 Confidential</div>}
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.content}</div>
                      <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 3, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        {formatTime(msg.timestamp)}
                        {msg.confidential && <span title="NDA Protected">🔒</span>}
                        {isMe && <span>{msg.read ? "✓✓" : "✓"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ ...styles.inputArea, background: activeConversation.confidentialMode ? "#16213e" : "white", borderTop: activeConversation.confidentialMode ? "1px solid #2a2a4a" : "1px solid #eee" }}>
              {activeConversation.confidentialMode && (
                <div style={{ fontSize: 11, color: "#6c63ff", padding: "4px 12px 0", fontWeight: 600 }}>
                  🔒 NDA Protected
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 8 }}>
                <input
                  type="text"
                  placeholder={activeConversation.confidentialMode ? "🔒 Confidential message…" : "Message…"}
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  style={{
                    ...styles.msgInput,
                    background: activeConversation.confidentialMode ? "#0f0f23" : "#f5f5f5",
                    color: activeConversation.confidentialMode ? "#e0e0ff" : "#1a1a2e",
                    border: activeConversation.confidentialMode ? "1px solid #2a2a4a" : "1px solid #eee",
                  }}
                />
                <button
                  style={{ ...styles.sendBtn, background: messageInput.trim() ? "#6c63ff" : "#ddd" }}
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE VIEW ── */}
      {screen === "profile_view" && appState.currentUser && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => setScreen("home")}>← Back</button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 64 }}>{appState.currentUser.avatar}</div>
              <h2 style={{ margin: "8px 0 4px", color: "#1a1a2e" }}>{appState.currentUser.displayName}</h2>
              {appState.currentUser.verificationStatus === "verified" && (
                <div style={styles.verifiedBadgeLarge}>✓ Verified Identity</div>
              )}
              <p style={{ color: "#888", fontSize: 14 }}>{appState.currentUser.phone}</p>
              {appState.currentUser.email && <p style={{ color: "#888", fontSize: 13 }}>{appState.currentUser.email}</p>}
            </div>
            <div style={styles.profileSection}>
              <div style={styles.profileRow}>
                <span>📱 Phone</span>
                <span>{appState.currentUser.phone}</span>
              </div>
              {appState.currentUser.email && (
                <div style={styles.profileRow}>
                  <span>📧 Email</span>
                  <span>{appState.currentUser.email}</span>
                </div>
              )}
              <div style={styles.profileRow}>
                <span>🛡️ Identity</span>
                <span style={{ color: appState.currentUser.verificationStatus === "verified" ? "#22c55e" : "#f59e0b" }}>
                  {appState.currentUser.verificationStatus === "verified"
                    ? `✓ Verified (${appState.currentUser.idType === "selfie" ? "Selfie" : "Gov. ID"})`
                    : "⚠ Not Verified"}
                </span>
              </div>
              <div style={styles.profileRow}>
                <span>🔐 2FA</span>
                <span>{appState.currentUser.twoFAEnabled ? "✅ Enabled" : "❌ Disabled"}</span>
              </div>
              <div style={styles.profileRow}>
                <span>🔒 Confidential Mode</span>
                <span>{appState.currentUser.verificationStatus === "verified" ? "✅ Available" : "🔒 Locked"}</span>
              </div>
              <div style={styles.profileRow}>
                <span>📅 Member Since</span>
                <span>{new Date(appState.currentUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {appState.currentUser.verificationStatus !== "verified" && (
              <button style={{ ...styles.btnPrimary, marginBottom: 12 }} onClick={() => { setVerifyStep(0); setIdFile(null); setScreen("id_verify"); }}>
                🛡️ Verify Identity
              </button>
            )}
            <button style={{ ...styles.btnSecondary, color: "#ef4444", borderColor: "#ef4444" }} onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {screen === "settings" && appState.currentUser && (
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <button style={styles.backBtn} onClick={() => setScreen("home")}>← Back</button>
            <h1 style={{ ...styles.authTitle, textAlign: "center", marginBottom: 16 }}>Settings</h1>
            <div style={styles.tabRow}>
              {(["account", "privacy", "security"] as const).map(tab => (
                <button
                  key={tab}
                  style={{ ...styles.tabBtn, background: settingsTab === tab ? "#6c63ff" : "#f5f5f5", color: settingsTab === tab ? "white" : "#666" }}
                  onClick={() => setSettingsTab(tab)}
                >
                  {tab === "account" ? "👤 Account" : tab === "privacy" ? "🔒 Privacy" : "🛡️ Security"}
                </button>
              ))}
            </div>

            {settingsTab === "account" && (
              <div style={styles.profileSection}>
                <div style={styles.profileRow}>
                  <span>Avatar</span>
                  <span style={{ fontSize: 24 }}>{appState.currentUser.avatar}</span>
                </div>
                <div style={styles.profileRow}>
                  <span>Name</span>
                  <span style={{ fontWeight: 600 }}>{appState.currentUser.displayName}</span>
                </div>
                <div style={styles.profileRow}>
                  <span>Phone</span>
                  <span>{appState.currentUser.phone}</span>
                </div>
                <div style={styles.profileRow}>
                  <span>Email</span>
                  <span>{appState.currentUser.email || "Not set"}</span>
                </div>
                <div style={styles.profileRow}>
                  <span>Member Since</span>
                  <span>{new Date(appState.currentUser.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {settingsTab === "privacy" && (
              <div style={styles.profileSection}>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Confidential Mode</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Activate NDA for conversations</div>
                  </div>
                  <span style={{ color: appState.currentUser.verificationStatus === "verified" ? "#22c55e" : "#f59e0b", fontSize: 13 }}>
                    {appState.currentUser.verificationStatus === "verified" ? "Available" : "Requires Verification"}
                  </span>
                </div>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Message Encryption</div>
                    <div style={{ fontSize: 12, color: "#888" }}>End-to-end encrypted</div>
                  </div>
                  <span style={{ color: "#22c55e", fontSize: 13 }}>Active</span>
                </div>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Read Receipts</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Show when messages are read</div>
                  </div>
                  <span style={{ color: "#22c55e", fontSize: 13 }}>On</span>
                </div>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>NDA History</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Active NDAs in conversations</div>
                  </div>
                  <span style={{ color: "#6c63ff", fontSize: 13 }}>
                    {appState.conversations.filter(c => c.ndaActive).length} active
                  </span>
                </div>
              </div>
            )}

            {settingsTab === "security" && (
              <div style={styles.profileSection}>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Two-Factor Auth</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Extra account security</div>
                  </div>
                  <div
                    style={{ ...styles.toggleSwitch, background: appState.currentUser.twoFAEnabled ? "#6c63ff" : "#ddd" }}
                    onClick={() => setAppState(prev => ({ ...prev, currentUser: prev.currentUser ? { ...prev.currentUser, twoFAEnabled: !prev.currentUser.twoFAEnabled } : null }))}
                  >
                    <div style={{ ...styles.toggleKnob, transform: appState.currentUser.twoFAEnabled ? "translateX(22px)" : "translateX(2px)" }} />
                  </div>
                </div>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Identity Verification</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Required for Confidential Mode</div>
                  </div>
                  <span style={{ color: appState.currentUser.verificationStatus === "verified" ? "#22c55e" : "#f59e0b", fontSize: 13 }}>
                    {appState.currentUser.verificationStatus === "verified" ? "✓ Verified" : "Pending"}
                  </span>
                </div>
                <div style={styles.settingItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Session</div>
                    <div style={{ fontSize: 12, color: "#888" }}>JWT • Expires in 7 days</div>
                  </div>
                  <span style={{ color: "#22c55e", fontSize: 13 }}>Active</span>
                </div>
                {appState.currentUser.verificationStatus !== "verified" && (
                  <button style={{ ...styles.btnPrimary, marginTop: 12 }} onClick={() => { setVerifyStep(0); setIdFile(null); setScreen("id_verify"); }}>
                    🛡️ Verify Identity Now
                  </button>
                )}
              </div>
            )}

            <button style={{ ...styles.btnSecondary, marginTop: 16, color: "#ef4444", borderColor: "#ef4444" }} onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: "relative",
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1a1a2e",
    color: "white",
    padding: "10px 20px",
    borderRadius: 24,
    fontSize: 13,
    fontWeight: 600,
    zIndex: 9999,
    maxWidth: "90vw",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  splash: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #6c63ff 100%)",
  },
  splashLogo: { fontSize: 80, marginBottom: 16 },
  splashTitle: { color: "white", fontSize: 42, fontWeight: 800, margin: "0 0 8px", letterSpacing: -1 },
  splashSub: { color: "rgba(255,255,255,0.7)", fontSize: 16, margin: "0 0 40px" },
  splashLoader: { width: 200, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" },
  splashBar: {
    height: "100%",
    width: "40%",
    background: "white",
    borderRadius: 2,
    animation: "slide 1.5s ease-in-out infinite",
  },
  authContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
    background: "linear-gradient(135deg, #f0f2f5 0%, #e8e9f5 100%)",
  },
  authCard: {
    background: "white",
    borderRadius: 20,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 40px rgba(108,99,255,0.12)",
  },
  authTitle: { fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: "8px 0 4px" },
  authSub: { fontSize: 14, color: "#888", margin: "0 0 24px", lineHeight: 1.5 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    transition: "border 0.2s",
    background: "#fafafa",
  },
  btnPrimary: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #6c63ff, #a855f7)",
    color: "white",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    width: "100%",
    padding: "12px",
    background: "white",
    color: "#6c63ff",
    border: "1.5px solid #6c63ff",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    padding: "0 0 16px",
    display: "block",
  },
  error: { color: "#ef4444", fontSize: 13, margin: "0 0 12px", fontWeight: 500 },
  legalNote: { fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 12, lineHeight: 1.6 },
  otpHint: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fef9c3",
    padding: "8px 12px",
    borderRadius: 8,
    marginTop: 12,
  },
  toggle2FARow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#f9f9f9",
    padding: "12px 14px",
    borderRadius: 10,
    marginBottom: 16,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    position: "relative",
    cursor: "pointer",
    transition: "background 0.3s",
    flexShrink: 0,
  },
  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.3s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    marginBottom: 20,
  },
  avatarOption: {
    borderRadius: 10,
    padding: 8,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  idTypeRow: { display: "flex", gap: 12, marginBottom: 20 },
  idTypeBtn: {
    flex: 1,
    padding: "14px 8px",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  uploadZone: {
    border: "2px dashed #ddd",
    borderRadius: 12,
    padding: "24px",
    textAlign: "center",
    cursor: "pointer",
    minHeight: 120,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: "border 0.2s",
  },
  progressBar: {
    width: "100%",
    height: 8,
    background: "#eee",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #6c63ff, #a855f7)",
    transition: "width 0.3s",
    borderRadius: 4,
  },
  selfieArea: {
    background: "#f9f9f9",
    borderRadius: 16,
    padding: "32px",
    textAlign: "center",
    marginBottom: 16,
    border: "2px solid #eee",
  },
  selfieProgress: { display: "flex", gap: 8, justifyContent: "center", marginTop: 16 },
  selfieStep: { width: 40, height: 6, borderRadius: 3, transition: "background 0.3s" },
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
    background: "white",
    borderRadius: 20,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    padding: "20px 24px 12px",
    borderBottom: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  ndaScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
  },
  ndaText: {
    fontSize: 12,
    lineHeight: 1.7,
    color: "#333",
    whiteSpace: "pre-wrap",
    fontFamily: "Georgia, serif",
    margin: 0,
  },
  modalFooter: {
    padding: "16px 24px",
    borderTop: "1px solid #eee",
    display: "flex",
    gap: 12,
  },
  appShell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
  },
  sidebar: {
    width: 300,
    flexShrink: 0,
    background: "white",
    borderRight: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "16px",
    borderBottom: "1px solid #eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sidebarLogo: { fontSize: 18, fontWeight: 800, color: "#1a1a2e" },
  iconBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 6px",
    borderRadius: 8,
    color: "#555",
  },
  currentUserCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderBottom: "1px solid #f5f5f5",
    background: "#fafafa",
  },
  avatarBig: { fontSize: 28, lineHeight: 1 },
  verifiedBadge: {
    background: "#6c63ff",
    color: "white",
    borderRadius: "50%",
    width: 16,
    height: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  },
  verifiedBadgeLarge: {
    display: "inline-block",
    background: "#6c63ff",
    color: "white",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },
  verifyPrompt: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#fef3c7",
    margin: "8px 12px",
    borderRadius: 10,
    fontSize: 12,
  },
  verifyBtn: {
    background: "#d97706",
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 1,
    padding: "12px 16px 4px",
  },
  convList: { overflowY: "auto", flex: "none", maxHeight: 200 },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    cursor: "pointer",
    borderRadius: 0,
    transition: "background 0.15s",
  },
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  convAvatar: { fontSize: 24, lineHeight: 1, flexShrink: 0 },
  mainArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2f5",
  },
  emptyState: {
    textAlign: "center",
    padding: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
    flexShrink: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  confidentialBanner: {
    background: "linear-gradient(90deg, #6c63ff, #a855f7)",
    color: "white",
    padding: "6px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    flexShrink: 0,
  },
  ndaBadge: {
    background: "rgba(108,99,255,0.15)",
    border: "1px solid #6c63ff",
    color: "#6c63ff",
    borderRadius: 8,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  bubble: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },
  systemMsg: {
    textAlign: "center",
    fontSize: 12,
    color: "#6c63ff",
    background: "rgba(108,99,255,0.08)",
    padding: "8px 16px",
    borderRadius: 12,
    margin: "8px 0",
    lineHeight: 1.6,
    border: "1px solid rgba(108,99,255,0.2)",
  },
  inputArea: {
    borderTop: "1px solid #eee",
    flexShrink: 0,
  },
  msgInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 20,
    fontSize: 14,
    outline: "none",
    resize: "none",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "none",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s",
  },
  profileSection: {
    background: "#f9f9f9",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  profileRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #eee",
    fontSize: 14,
  },
  settingItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid #eee",
  },
  tabRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    padding: "8px 4px",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};