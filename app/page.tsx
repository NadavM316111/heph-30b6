"use client";

import { useEffect, useState, useCallback } from "react";
import { COUNTRIES } from "@/lib/countries";

// ── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | "splash"
  | "auth"
  | "otp"
  | "profile-setup"
  | "kyc"
  | "main"
  | "chat"
  | "settings";

type AuthMode = "login" | "signup";

interface User {
  email: string;
  displayName: string;
  phone: string;
  avatarColor: string;
  kycVerified: boolean;
  legalName?: string;
  country?: string;
  deviceFingerprint?: string;
  sessionToken?: string;
  createdAt: string;
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
  participants: string[];
  displayName: string;
  lastMessage: string;
  lastTime: number;
  confidentialMode: boolean;
  ndaAccepted: boolean;
  ndaTimestamp?: number;
  messages: Message[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6C63FF", "#FF6584", "#43D9AD", "#F7B731",
  "#FC5C65", "#45AAF2", "#26DE81", "#FD9644",
];

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    participants: ["alice@demo.com"],
    displayName: "Alice Chen",
    lastMessage: "Can we switch to confidential mode?",
    lastTime: Date.now() - 1000 * 60 * 5,
    confidentialMode: false,
    ndaAccepted: false,
    messages: [
      { id: "m1", senderId: "alice@demo.com", text: "Hey! How are you?", timestamp: Date.now() - 1000 * 60 * 10, confidential: false },
      { id: "m2", senderId: "alice@demo.com", text: "Can we switch to confidential mode?", timestamp: Date.now() - 1000 * 60 * 5, confidential: false },
    ],
  },
  {
    id: "conv-2",
    participants: ["bob@demo.com"],
    displayName: "Bob Martinez",
    lastMessage: "The merger docs are ready 🔐",
    lastTime: Date.now() - 1000 * 60 * 30,
    confidentialMode: true,
    ndaAccepted: true,
    ndaTimestamp: Date.now() - 1000 * 60 * 60,
    messages: [
      { id: "m3", senderId: "bob@demo.com", text: "The merger docs are ready 🔐", timestamp: Date.now() - 1000 * 60 * 30, confidential: true },
    ],
  },
];

// ── Device Fingerprint ────────────────────────────────────────────────────────

function generateFingerprint(): string {
  const nav = typeof window !== "undefined" ? window.navigator : null;
  const raw = [
    nav?.userAgent ?? "",
    nav?.language ?? "",
    nav?.platform ?? "",
    screen?.width ?? 0,
    screen?.height ?? 0,
    screen?.colorDepth ?? 0,
    new Date().getTimezoneOffset(),
    nav?.hardwareConcurrency ?? 0,
  ].join("|");

  // Simple djb2 hash
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return "fp_" + Math.abs(hash).toString(16).padStart(8, "0");
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("");

  // Auth fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Profile setup
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  // KYC
  const [legalName, setLegalName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [kycError, setKycError] = useState("");
  const [kycLoading, setKycLoading] = useState(false);

  // Chat
  const [messageText, setMessageText] = useState("");
  const [ndaModalOpen, setNdaModalOpen] = useState(false);
  const [ndaScrolled, setNdaScrolled] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fp = generateFingerprint();
    setFingerprint(fp);

    // Track page
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Restore session
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        const parsed: User = JSON.parse(stored);
        setUser(parsed);
        const storedConvs = localStorage.getItem("confi_conversations");
        if (storedConvs) setConversations(JSON.parse(storedConvs));
        setScreen("main");
      } catch {
        localStorage.removeItem("confi_user");
      }
    }

    setTimeout(() => {
      if (!localStorage.getItem("confi_user")) setScreen("auth");
    }, 1800);
  }, []);

  const saveUser = useCallback((u: User) => {
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
  }, []);

  const saveConversations = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    localStorage.setItem("confi_conversations", JSON.stringify(convs));
  }, []);

  // ── Auth Flow ─────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    if (!phone || phone.length < 7) {
      setAuthError("Enter a valid phone number.");
      return;
    }
    const otp = generateOTP();
    setGeneratedOtp(otp);
    setOtpSent(true);
    setAuthError("");
    // In production this would call Twilio/SNS — here we surface it in UI for demo
    console.info(`[CONFI OTP] Code for ${phone}: ${otp}`);
    alert(`[Demo] Your OTP is: ${otp}\n(In production this is sent via SMS)`);
  };

  const handleAuth = async () => {
    setAuthError("");
    if (!email || !password) { setAuthError("Email and password are required."); return; }
    if (authMode === "signup" && !phone) { setAuthError("Phone number is required."); return; }
    if (authMode === "signup" && (!otpSent || otpInput !== generatedOtp)) {
      setAuthError("Please verify your phone number with the OTP first."); return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setAuthError(data.error ?? "Authentication failed."); return; }

      const token = generateToken();
      const newUser: User = {
        email: data.email,
        displayName: displayName || data.email.split("@")[0],
        phone: phone || "",
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        kycVerified: false,
        deviceFingerprint: fingerprint,
        sessionToken: token,
        createdAt: new Date().toISOString(),
      };

      if (authMode === "signup") {
        saveUser(newUser);
        setScreen("profile-setup");
      } else {
        // Login — check for existing profile
        const existing = localStorage.getItem("confi_user");
        if (existing) {
          const parsed: User = JSON.parse(existing);
          // Verify device fingerprint
          if (parsed.deviceFingerprint && parsed.deviceFingerprint !== fingerprint) {
            setAuthError("⚠️ New device detected. For security, please re-verify identity.");
          }
          saveUser({ ...parsed, sessionToken: token, deviceFingerprint: fingerprint });
        } else {
          saveUser(newUser);
          setScreen("profile-setup");
          return;
        }
        setScreen("main");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Profile Setup ─────────────────────────────────────────────────────────

  const handleProfileSave = () => {
    if (!displayName.trim()) { return; }
    if (!user) return;
    const updated = { ...user, displayName: displayName.trim(), avatarColor };
    saveUser(updated);
    setScreen("main");
  };

  // ── KYC ───────────────────────────────────────────────────────────────────

  const handleKYC = async () => {
    if (!legalName.trim() || !selectedCountry) {
      setKycError("Full legal name and country are required.");
      return;
    }
    if (legalName.trim().split(" ").length < 2) {
      setKycError("Please enter your full legal name (first and last name).");
      return;
    }
    setKycLoading(true);
    // Simulate server-side KYC verification delay
    await new Promise(r => setTimeout(r, 1200));
    setKycLoading(false);
    if (!user) return;
    const updated: User = {
      ...user,
      kycVerified: true,
      legalName: legalName.trim(),
      country: selectedCountry,
    };
    saveUser(updated);
    setScreen("main");
  };

  // ── Confidential Mode & NDA ────────────────────────────────────────────────

  const handleToggleConfidential = (conv: Conversation) => {
    if (!user) return;
    if (!conv.confidentialMode) {
      // Turning ON
      if (!user.kycVerified) {
        alert("⚖️ KYC Required\n\nConfidential Mode requires identity verification before activating an NDA.\n\nPlease complete your KYC profile.");
        setScreen("kyc");
        return;
      }
      setActiveConv(conv);
      setNdaModalOpen(true);
      setNdaScrolled(false);
    } else {
      // Turning OFF
      if (!confirm("Deactivate Confidential Mode? The NDA remains on record for past messages.")) return;
      const updated = conversations.map(c =>
        c.id === conv.id ? { ...c, confidentialMode: false } : c
      );
      saveConversations(updated);
      setActiveConv(updated.find(c => c.id === conv.id) ?? null);
    }
  };

  const handleAcceptNDA = () => {
    if (!activeConv || !user) return;
    const updated = conversations.map(c =>
      c.id === activeConv.id
        ? { ...c, confidentialMode: true, ndaAccepted: true, ndaTimestamp: Date.now() }
        : c
    );
    saveConversations(updated);
    setActiveConv(updated.find(c => c.id === activeConv.id) ?? null);
    setNdaModalOpen(false);
  };

  // ── Send Message ──────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!messageText.trim() || !activeConv || !user) return;
    const msg: Message = {
      id: "m" + Date.now(),
      senderId: user.email,
      text: messageText.trim(),
      timestamp: Date.now(),
      confidential: activeConv.confidentialMode,
    };
    const updated = conversations.map(c =>
      c.id === activeConv.id
        ? { ...c, messages: [...c.messages, msg], lastMessage: msg.text, lastTime: msg.timestamp }
        : c
    );
    saveConversations(updated);
    setActiveConv(updated.find(c => c.id === activeConv.id) ?? null);
    setMessageText("");
  };

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setScreen("auth");
    setEmail(""); setPassword(""); setPhone(""); setOtpInput("");
    setGeneratedOtp(""); setOtpSent(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── Splash ────────────────────────────────────────────────────────────────
  if (screen === "splash") {
    return (
      <div style={styles.splash}>
        <div style={styles.splashLogo}>🔐</div>
        <div style={styles.splashTitle}>Confi</div>
        <div style={styles.splashSub}>Messaging with legal confidentiality</div>
        <div style={styles.splashSpinner} />
      </div>
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (screen === "auth") {
    return (
      <div style={styles.authBg}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span style={{ fontSize: 44 }}>🔐</span>
            <h1 style={styles.authTitle}>Confi</h1>
            <p style={styles.authSubtitle}>Secure. Confidential. Legally binding.</p>
          </div>

          <div style={styles.tabRow}>
            <button
              style={{ ...styles.tab, ...(authMode === "signup" ? styles.tabActive : {}) }}
              onClick={() => { setAuthMode("signup"); setAuthError(""); }}
            >Sign Up</button>
            <button
              style={{ ...styles.tab, ...(authMode === "login" ? styles.tabActive : {}) }}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >Log In</button>
          </div>

          {authMode === "signup" && (
            <div style={styles.phoneRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type="tel"
                placeholder="Phone number (e.g. +1 555 0100)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <button style={styles.otpBtn} onClick={handleSendOTP}>
                {otpSent ? "Resend" : "Send OTP"}
              </button>
            </div>
          )}

          {authMode === "signup" && otpSent && (
            <input
              style={styles.input}
              type="text"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={otpInput}
              onChange={e => setOtpInput(e.target.value.replace(/\D/g, ""))}
            />
          )}

          {authMode === "signup" && otpSent && otpInput.length === 6 && otpInput === generatedOtp && (
            <div style={styles.verified}>✅ Phone verified</div>
          )}

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {authError && <div style={styles.error}>{authError}</div>}

          <button
            style={{ ...styles.primaryBtn, opacity: authLoading ? 0.7 : 1 }}
            onClick={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? "Please wait…" : authMode === "signup" ? "Create Account" : "Log In"}
          </button>

          <div style={styles.fingerprintNote}>
            🖥️ Device ID: <code style={{ fontSize: 11 }}>{fingerprint || "generating…"}</code>
          </div>
        </div>
      </div>
    );
  }

  // ── Profile Setup ─────────────────────────────────────────────────────────
  if (screen === "profile-setup") {
    return (
      <div style={styles.authBg}>
        <div style={styles.authCard}>
          <h2 style={styles.sectionTitle}>Set Up Your Profile</h2>
          <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>
            Choose how you appear to other users.
          </p>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ ...styles.avatar, backgroundColor: avatarColor, width: 80, height: 80, fontSize: 28, margin: "0 auto 16px" }}>
              {getInitials(displayName || "?")}
            </div>
            <div style={styles.colorRow}>
              {AVATAR_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  style={{
                    ...styles.colorSwatch,
                    backgroundColor: c,
                    border: avatarColor === c ? "3px solid #fff" : "3px solid transparent",
                    boxShadow: avatarColor === c ? "0 0 0 2px #6C63FF" : "none",
                  }}
                />
              ))}
            </div>
          </div>

          <input
            style={styles.input}
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />

          <button
            style={{ ...styles.primaryBtn, opacity: displayName.trim() ? 1 : 0.5 }}
            onClick={handleProfileSave}
            disabled={!displayName.trim()}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── KYC ───────────────────────────────────────────────────────────────────
  if (screen === "kyc") {
    return (
      <div style={styles.authBg}>
        <div style={styles.authCard}>
          <button style={styles.backBtn} onClick={() => setScreen("main")}>← Back</button>
          <h2 style={styles.sectionTitle}>Identity Verification</h2>
          <div style={styles.kycBadge}>⚖️ Required for Confidential Mode</div>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Confidential Mode activates an international NDA. For legal enforceability,
            your real identity must be on record. This information is encrypted and used
            solely for NDA attribution.
          </p>

          <label style={styles.label}>Full Legal Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Jane Elizabeth Smith"
            value={legalName}
            onChange={e => setLegalName(e.target.value)}
          />

          <label style={styles.label}>Country of Residence *</label>
          <select
            style={styles.select}
            value={selectedCountry}
            onChange={e => setSelectedCountry(e.target.value)}
          >
            <option value="">Select country…</option>
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          {kycError && <div style={styles.error}>{kycError}</div>}

          <div style={styles.legalNote}>
            📋 By submitting, you confirm that the information provided is accurate and
            that you are of legal age in your jurisdiction. False declaration may void NDA protections.
          </div>

          <button
            style={{ ...styles.primaryBtn, opacity: kycLoading ? 0.7 : 1 }}
            onClick={handleKYC}
            disabled={kycLoading}
          >
            {kycLoading ? "Verifying…" : "Verify Identity"}
          </button>
        </div>
      </div>
    );
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  if (screen === "settings" && user) {
    return (
      <div style={styles.appShell}>
        <div style={styles.topBar}>
          <button style={styles.iconBtn} onClick={() => setScreen("main")}>←</button>
          <span style={styles.topBarTitle}>Settings</span>
          <div />
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ ...styles.avatar, backgroundColor: user.avatarColor, width: 80, height: 80, fontSize: 28, margin: "0 auto 12px" }}>
              {getInitials(user.displayName)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{user.displayName}</div>
            <div style={{ color: "#888", fontSize: 13 }}>{user.email}</div>
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingsLabel}>ACCOUNT</div>
            <div style={styles.settingsRow}>
              <span>📱 Phone</span><span style={{ color: "#888" }}>{user.phone || "Not set"}</span>
            </div>
            <div style={styles.settingsRow}>
              <span>📧 Email</span><span style={{ color: "#888" }}>{user.email}</span>
            </div>
            <div style={styles.settingsRow}>
              <span>📅 Member since</span><span style={{ color: "#888" }}>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingsLabel}>SECURITY</div>
            <div style={styles.settingsRow}>
              <span>🖥️ Device ID</span>
              <span style={{ color: "#888", fontSize: 11, fontFamily: "monospace" }}>
                {user.deviceFingerprint ?? fingerprint}
              </span>
            </div>
            <div style={styles.settingsRow}>
              <span>🔑 Session Token</span>
              <span style={{ color: "#888", fontSize: 10, fontFamily: "monospace" }}>
                {(user.sessionToken ?? "").slice(0, 16)}…
              </span>
            </div>
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingsLabel}>IDENTITY (KYC)</div>
            {user.kycVerified ? (
              <>
                <div style={styles.settingsRow}>
                  <span>✅ Status</span><span style={{ color: "#43D9AD" }}>Verified</span>
                </div>
                <div style={styles.settingsRow}>
                  <span>👤 Legal Name</span><span style={{ color: "#888" }}>{user.legalName}</span>
                </div>
                <div style={styles.settingsRow}>
                  <span>🌍 Country</span>
                  <span style={{ color: "#888" }}>
                    {COUNTRIES.find(c => c.code === user.country)?.name ?? user.country}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ color: "#F7B731", marginBottom: 12 }}>⚠️ Identity not verified</div>
                <button style={styles.secondaryBtn} onClick={() => setScreen("kyc")}>
                  Complete KYC Verification
                </button>
              </div>
            )}
          </div>

          <button style={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
        </div>
      </div>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  if (screen === "chat" && activeConv && user) {
    return (
      <div style={styles.appShell}>
        {/* NDA Modal */}
        {ndaModalOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={{ marginTop: 0, color: "#6C63FF" }}>🔐 Activate Confidential Mode</h3>
              <p style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
                By activating Confidential Mode, you and the recipient enter into a legally binding
                Non-Disclosure Agreement (NDA) governed by international confidentiality law.
              </p>

              <div
                style={styles.ndaScroll}
                onScroll={e => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setNdaScrolled(true);
                }}
              >
                <strong>INTERNATIONAL NON-DISCLOSURE AGREEMENT</strong>
                <p>This Non-Disclosure Agreement ("Agreement") is entered into as of the date of activation
                  ("Effective Date") between the parties identified below, who have been verified through the
                  Confi platform's KYC process.</p>

                <strong>1. PARTIES</strong>
                <p>Party A: <em>{user.legalName}</em> (Country: {COUNTRIES.find(c => c.code === user.country)?.name ?? user.country}),
                  verified via device fingerprint <em>{user.deviceFingerprint}</em>.<br />
                  Party B: Recipient of this conversation thread identified within the Confi platform.</p>

                <strong>2. DEFINITION OF CONFIDENTIAL INFORMATION</strong>
                <p>All communications, documents, data, and information exchanged in this conversation thread
                  while Confidential Mode is active shall constitute "Confidential Information," regardless of
                  whether such information is marked as confidential.</p>

                <strong>3. OBLIGATIONS</strong>
                <p>Each party agrees to: (a) hold all Confidential Information in strict confidence;
                  (b) not disclose Confidential Information to any third party without prior written consent;
                  (c) use Confidential Information solely for purposes of this communication; and
                  (d) protect the Confidential Information using at least the same degree of care used to
                  protect their own confidential information, but in no event less than reasonable care.</p>

                <strong>4. GOVERNING LAW & JURISDICTION</strong>
                <p>This Agreement shall be governed by the laws applicable to international commercial
                  contracts, including but not limited to the UNCITRAL Model Law on International Commercial
                  Arbitration. Disputes shall be resolved by binding arbitration under ICC Rules.</p>

                <strong>5. TERM</strong>
                <p>This Agreement remains in effect for a period of five (5) years from the Effective Date,
                  or until all Confidential Information becomes publicly available through no fault of either party.</p>

                <strong>6. REMEDIES</strong>
                <p>The parties acknowledge that breach of this Agreement may cause irreparable harm for which
                  monetary damages are an inadequate remedy. Each party shall be entitled to seek injunctive
                  relief in addition to any other remedies available at law or in equity.</p>

                <strong>7. ELECTRONIC ACCEPTANCE</strong>
                <p>The parties agree that electronic acceptance of this Agreement, including acceptance via the
                  Confi platform, constitutes a valid and binding signature under applicable electronic
                  commerce laws, including the UN Convention on the Use of Electronic Communications in
                  International Contracts (2005).</p>

                <strong>8. SEVERABILITY</strong>
                <p>If any provision of this Agreement is found to be unenforceable, the remaining provisions
                  shall continue in full force and effect.</p>

                <p style={{ color: "#888", fontSize: 12 }}>
                  Session: {user.sessionToken?.slice(0, 24)}… | Device: {user.deviceFingerprint} |
                  Timestamp: {new Date().toISOString()}
                </p>
              </div>

              {!ndaScrolled && (
                <div style={{ color: "#F7B731", fontSize: 12, textAlign: "center", margin: "8px 0" }}>
                  ↓ Scroll to read the full agreement before accepting
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button style={styles.secondaryBtn} onClick={() => setNdaModalOpen(false)}>Cancel</button>
                <button
                  style={{ ...styles.primaryBtn, flex: 1, opacity: ndaScrolled ? 1 : 0.4, margin: 0 }}
                  onClick={handleAcceptNDA}
                  disabled={!ndaScrolled}
                >
                  ✅ I Accept the NDA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Top Bar */}
        <div style={{ ...styles.topBar, borderBottom: activeConv.confidentialMode ? "2px solid #6C63FF" : "1px solid #2a2a2a" }}>
          <button style={styles.iconBtn} onClick={() => { setScreen("main"); setActiveConv(null); }}>←</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...styles.avatar, backgroundColor: AVATAR_COLORS[activeConv.id.charCodeAt(5) % AVATAR_COLORS.length] }}>
              {getInitials(activeConv.displayName)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{activeConv.displayName}</div>
              {activeConv.confidentialMode && (
                <div style={{ fontSize: 11, color: "#6C63FF" }}>🔐 Confidential Mode • NDA Active</div>
              )}
            </div>
          </div>
          <button
            style={{
              ...styles.confiBadge,
              backgroundColor: activeConv.confidentialMode ? "#6C63FF" : "#2a2a2a",
              color: activeConv.confidentialMode ? "#fff" : "#888",
            }}
            onClick={() => handleToggleConfidential(activeConv)}
          >
            {activeConv.confidentialMode ? "🔐" : "🔓"}
          </button>
        </div>

        {/* NDA Banner */}
        {activeConv.confidentialMode && activeConv.ndaTimestamp && (
          <div style={styles.ndaBanner}>
            ⚖️ NDA active since {new Date(activeConv.ndaTimestamp).toLocaleString()} · All messages legally protected
          </div>
        )}

        {/* Messages */}
        <div style={styles.messageList}>
          {activeConv.messages.length === 0 && (
            <div style={{ textAlign: "center", color: "#555", padding: 32 }}>
              No messages yet. Start the conversation.
            </div>
          )}
          {activeConv.messages.map(msg => {
            const isMe = msg.senderId === user.email;
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{
                  ...styles.bubble,
                  backgroundColor: msg.confidential
                    ? (isMe ? "#4a3fa0" : "#2d2560")
                    : (isMe ? "#1a73e8" : "#2a2a2a"),
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                }}>
                  {msg.confidential && <div style={{ fontSize: 10, color: "#a89dff", marginBottom: 4 }}>🔐 Confidential</div>}
                  <div style={{ fontSize: 15 }}>{msg.text}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "right", marginTop: 4 }}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div style={styles.inputBar}>
          {activeConv.confidentialMode && (
            <span style={{ fontSize: 18 }}>🔐</span>
          )}
          <input
            style={styles.msgInput}
            type="text"
            placeholder={activeConv.confidentialMode ? "Confidential message…" : "Message…"}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <button style={styles.sendBtn} onClick={handleSend}>↑</button>
        </div>
      </div>
    );
  }

  // ── Main (Conversation List) ───────────────────────────────────────────────
  return (
    <div style={styles.appShell}>
      <div style={styles.topBar}>
        <div style={{ fontWeight: 800, fontSize: 22, color: "#6C63FF" }}>🔐 Confi</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!user?.kycVerified && (
            <button style={styles.kycAlert} onClick={() => setScreen("kyc")}>
              ⚠️ Verify ID
            </button>
          )}
          <button style={styles.iconBtn} onClick={() => setScreen("settings")}>
            {user && (
              <div style={{ ...styles.avatar, backgroundColor: user.avatarColor, width: 32, height: 32, fontSize: 13 }}>
                {getInitials(user.displayName)}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Welcome strip */}
      {user && (
        <div style={styles.welcomeStrip}>
          <span>👋 Welcome back, <strong>{user.displayName}</strong></span>
          {user.kycVerified
            ? <span style={{ color: "#43D9AD", fontSize: 12 }}>✅ KYC Verified</span>
            : <span style={{ color: "#F7B731", fontSize: 12 }}>⚠️ KYC Pending</span>
          }
        </div>
      )}

      <div style={{ padding: "12px 16px 6px", color: "#888", fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
        CONVERSATIONS
      </div>

      {conversations.map(conv => (
        <div
          key={conv.id}
          style={styles.convRow}
          onClick={() => { setActiveConv(conv); setScreen("chat"); }}
        >
          <div style={{ ...styles.avatar, backgroundColor: AVATAR_COLORS[conv.id.charCodeAt(5) % AVATAR_COLORS.length] }}>
            {getInitials(conv.displayName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{conv.displayName}</span>
              <span style={{ color: "#555", fontSize: 12 }}>{formatRelative(conv.lastTime)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              {conv.confidentialMode && <span style={{ fontSize: 12 }}>🔐</span>}
              <span style={{ color: "#888", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {conv.lastMessage}
              </span>
            </div>
          </div>
        </div>
      ))}

      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: "#555", fontSize: 13, marginBottom: 16 }}>
          Start a new confidential conversation
        </div>
        <button
          style={styles.newConvBtn}
          onClick={() => {
            const name = prompt("Recipient display name:");
            if (!name?.trim()) return;
            const newConv: Conversation = {
              id: "conv-" + Date.now(),
              participants: [name.trim()],
              displayName: name.trim(),
              lastMessage: "",
              lastTime: Date.now(),
              confidentialMode: false,
              ndaAccepted: false,
              messages: [],
            };
            const updated = [newConv, ...conversations];
            saveConversations(updated);
            setActiveConv(newConv);
            setScreen("chat");
          }}
        >
          + New Conversation
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  splash: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    height: "100vh", backgroundColor: "#0d0d0d", color: "#fff",
  },
  splashLogo: { fontSize: 64, marginBottom: 16 },
  splashTitle: { fontSize: 40, fontWeight: 800, color: "#6C63FF", letterSpacing: 2 },
  splashSub: { color: "#888", marginTop: 8, fontSize: 15 },
  splashSpinner: {
    marginTop: 40, width: 32, height: 32, borderRadius: "50%",
    border: "3px solid #2a2a2a", borderTop: "3px solid #6C63FF",
    animation: "spin 1s linear infinite",
  },

  authBg: {
    minHeight: "100vh", backgroundColor: "#0d0d0d", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  authCard: {
    backgroundColor: "#161616", borderRadius: 20, padding: 32,
    width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(108,99,255,0.15)",
  },
  authTitle: { fontSize: 32, fontWeight: 800, color: "#6C63FF", margin: "8px 0 4px" },
  authSubtitle: { color: "#888", fontSize: 14 },
  tabRow: { display: "flex", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
    backgroundColor: "#2a2a2a", color: "#888", cursor: "pointer", fontWeight: 600, fontSize: 14,
  },
  tabActive: { backgroundColor: "#6C63FF", color: "#fff" },
  input: {
    width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #2a2a2a",
    backgroundColor: "#0d0d0d", color: "#fff", fontSize: 14, marginBottom: 12,
    outline: "none", boxSizing: "border-box",
  },
  select: {
    width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #2a2a2a",
    backgroundColor: "#0d0d0d", color: "#fff", fontSize: 14, marginBottom: 12,
    outline: "none", boxSizing: "border-box",
  },
  phoneRow: { display: "flex", gap: 8, marginBottom: 0 },
  otpBtn: {
    padding: "12px 16px", borderRadius: 10, border: "none",
    backgroundColor: "#6C63FF", color: "#fff", cursor: "pointer", fontWeight: 600,
    whiteSpace: "nowrap", marginBottom: 12,
  },
  verified: { color: "#43D9AD", fontSize: 13, marginBottom: 12 },
  error: {
    backgroundColor: "#2d1515", color: "#FC5C65", padding: "10px 14px",
    borderRadius: 10, fontSize: 13, marginBottom: 12,
  },
  primaryBtn: {
    width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
    backgroundColor: "#6C63FF", color: "#fff", fontSize: 16, fontWeight: 700,
    cursor: "pointer", marginBottom: 12,
  },
  secondaryBtn: {
    padding: "10px 18px", borderRadius: 10, border: "1px solid #6C63FF",
    backgroundColor: "transparent", color: "#6C63FF", fontSize: 14, fontWeight: 600,
    cursor: "pointer",
  },
  fingerprintNote: {
    color: "#555", fontSize: 12, textAlign: "center", marginTop: 8, wordBreak: "break-all",
  },
  label: { display: "block", color: "#888", fontSize: 12, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 },
  kycBadge: {
    display: "inline-block", backgroundColor: "#1a1a2e", color: "#6C63FF",
    borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16,
  },
  legalNote: {
    backgroundColor: "#1a1a1a", borderLeft: "3px solid #6C63FF",
    padding: "12px 16px", borderRadius: 4, color: "#888", fontSize: 12,
    lineHeight: 1.6, marginBottom: 16,
  },

  appShell: { display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#0d0d0d", color: "#fff", maxWidth: 600, margin: "0 auto" },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", borderBottom: "1px solid #1e1e1e",
    backgroundColor: "#121212", position: "sticky" as const, top: 0, zIndex: 10,
  },
  topBarTitle: { fontWeight: 700, fontSize: 17 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 18, padding: 4 },
  welcomeStrip: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 16px", backgroundColor: "#161616", borderBottom: "1px solid #1e1e1e",
    fontSize: 14,
  },
  kycAlert: {
    backgroundColor: "#2d2000", color: "#F7B731", border: "1px solid #F7B731",
    borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600,
  },
  avatar: {
    width: 44, height: 44, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", color: "#fff",
    fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  colorRow: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" as const },
  colorSwatch: { width: 28, height: 28, borderRadius: "50%", cursor: "pointer", transition: "transform 0.15s" },
  convRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
    borderBottom: "1px solid #1a1a1a", cursor: "pointer", transition: "background 0.15s",
  },
  ndaBanner: {
    backgroundColor: "#1a1730", color: "#a89dff", padding: "8px 16px",
    fontSize: 12, textAlign: "center", borderBottom: "1px solid #2d2560",
  },
  messageList: { flex: 1, overflowY: "auto" as const, padding: "16px", display: "flex", flexDirection: "column" },
  bubble: { maxWidth: "75%", padding: "10px 14px", color: "#fff", wordBreak: "break-word" as const },
  inputBar: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
    borderTop: "1px solid #1e1e1e", backgroundColor: "#121212",
  },
  msgInput: {
    flex: 1, padding: "12px 16px", borderRadius: 24, border: "1px solid #2a2a2a",
    backgroundColor: "#1a1a1a", color: "#fff", fontSize: 14, outline: "none",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: "50%", backgroundColor: "#6C63FF",
    color: "#fff", border: "none", fontSize: 18, cursor: "pointer", fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  confiBadge: {
    padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer",
    fontSize: 18, transition: "background 0.2s",
  },
  newConvBtn: {
    padding: "12px 24px", borderRadius: 24, border: "none",
    backgroundColor: "#6C63FF", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  sectionTitle: { color: "#fff", fontWeight: 700, fontSize: 22, marginBottom: 8, marginTop: 0 },
  backBtn: {
    background: "none", border: "none", color: "#6C63FF", fontSize: 15,
    cursor: "pointer", padding: 0, marginBottom: 16, fontWeight: 600,
  },
  settingsSection: { marginBottom: 28 },
  settingsLabel: { color: "#555", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 },
  settingsRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid #1a1a1a", fontSize: 14,
  },
  logoutBtn: {
    width: "100%", padding: "14px 0", borderRadius: 10, border: "1px solid #FC5C65",
    backgroundColor: "transparent", color: "#FC5C65", fontSize: 15, fontWeight: 700,
    cursor: "pointer", marginTop: 8,
  },
  modalOverlay: {
    position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
  },
  modal: {
    backgroundColor: "#161616", borderRadius: 20, padding: 24,
    width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  ndaScroll: {
    height: 240, overflowY: "auto" as const, backgroundColor: "#0d0d0d",
    borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "#ccc",
    lineHeight: 1.7, border: "1px solid #2a2a2a",
  },
};