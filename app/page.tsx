"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  email: string;
  legalName?: string;
  idVerified?: boolean;
  sessionToken?: string;
}

interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  with: string;
  avatar: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaSigned: boolean;
}

type AppScreen =
  | "auth"
  | "otp"
  | "identity"
  | "chat-list"
  | "chat"
  | "nda-modal"
  | "id-upload";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    with: "Alex Rivera",
    avatar: "AR",
    messages: [
      {
        id: "m1",
        from: "Alex Rivera",
        text: "Hey! Are you free to discuss the Q3 strategy?",
        timestamp: Date.now() - 3600000,
        confidential: false,
      },
      {
        id: "m2",
        from: "me",
        text: "Yes, let me enable confidential mode first.",
        timestamp: Date.now() - 3500000,
        confidential: false,
      },
    ],
    confidentialMode: false,
    ndaSigned: false,
  },
  {
    id: "c2",
    with: "Jordan Kim",
    avatar: "JK",
    messages: [
      {
        id: "m3",
        from: "Jordan Kim",
        text: "The merger documents are ready for review.",
        timestamp: Date.now() - 7200000,
        confidential: true,
      },
    ],
    confidentialMode: true,
    ndaSigned: true,
  },
  {
    id: "c3",
    with: "Morgan Chen",
    avatar: "MC",
    messages: [
      {
        id: "m4",
        from: "Morgan Chen",
        text: "Coffee tomorrow?",
        timestamp: Date.now() - 86400000,
        confidential: false,
      },
    ],
    confidentialMode: false,
    ndaSigned: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(): string {
  return (
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000) return formatTime(ts);
  if (diff < 604800000)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── NDA Text ─────────────────────────────────────────────────────────────────

const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This International Non-Disclosure Agreement ("Agreement") is entered into as of the date of digital acceptance by and between the undersigned parties communicating through the Confi Messaging Platform ("Platform").

RECITALS

WHEREAS, the parties wish to explore and engage in confidential communications and may disclose to each other certain confidential and proprietary information; and

WHEREAS, the parties desire to protect such confidential information from unauthorized use and disclosure;

NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any and all information or data that has or could have commercial value or other utility in the business in which the Disclosing Party is engaged, including but not limited to technical data, trade secrets, know-how, research, product plans, products, services, customers, customer lists, markets, software, developments, inventions, processes, formulas, technology, designs, drawings, engineering, hardware configuration information, marketing, finances or other business information disclosed by the Disclosing Party during any Confidential Mode session on this Platform.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party agrees to: (a) hold the Confidential Information in strict confidence; (b) not to disclose the Confidential Information to any third parties without the prior written consent of the Disclosing Party; (c) use the Confidential Information solely for the purpose of the communication session; (d) protect the Confidential Information using the same degree of care used to protect its own confidential information, but in no event less than reasonable care.

3. JURISDICTION AND GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction mutually agreed upon by the parties, or in the absence of such agreement, under the principles of international commercial law as codified in UNIDROIT Principles of International Commercial Contracts. The parties hereby submit to the exclusive jurisdiction of international arbitration under ICC Rules.

4. TERM
This Agreement shall commence upon digital acceptance (clicking "I Agree & Sign NDA") and shall remain in effect for a period of five (5) years from the date of last communication in the Confidential Mode session, unless earlier terminated by mutual written consent.

5. REMEDIES
The parties acknowledge that breach of this Agreement would cause irreparable harm for which monetary damages would be inadequate. Accordingly, in addition to other available remedies, injunctive or other equitable relief shall be available to the non-breaching party without the necessity of proving actual damages or posting bond.

6. IDENTITY VERIFICATION & BINDING SIGNATURE
By activating Confidential Mode, each party confirms their legal identity has been verified through government-issued identification uploaded to the Platform. The digital acceptance constitutes a legally binding electronic signature under applicable electronic signature laws including the U.S. ESIGN Act, the EU eIDAS Regulation, and equivalent national legislation worldwide.

7. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior agreements, understandings, negotiations and discussions.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date of digital acceptance on the Confi Platform.`;

// ─── Sub-Components ───────────────────────────────────────────────────────────

function Avatar({
  initials,
  size = 42,
  color = "#6C5CE7",
}: {
  initials: string;
  size?: number;
  color?: string;
}) {
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
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

function ShieldIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ConfiApp() {
  // Auth state
  const [screen, setScreen] = useState<AppScreen>("auth");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpResendCount, setOtpResendCount] = useState(0);
  const [otpTimer, setOtpTimer] = useState(60);

  // Identity state
  const [legalName, setLegalName] = useState("");
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);

  // User state
  const [user, setUser] = useState<User | null>(null);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [pendingNdaConvId, setPendingNdaConvId] = useState<string | null>(null);
  const [ndaScrolled, setNdaScrolled] = useState(false);
  const [ndaSigning, setNdaSigning] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ndaScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Track page view
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Restore session
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        const u = JSON.parse(stored) as User;
        setUser(u);
        setEmail(u.email);
        if (u.idVerified) {
          setScreen("chat-list");
        } else {
          setScreen("identity");
        }
      } catch {
        localStorage.removeItem("confi_user");
      }
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConv?.messages]);

  useEffect(() => {
    if (screen === "otp") {
      startOtpTimer();
    }
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, otpResendCount]);

  function startOtpTimer() {
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    setOtpTimer(60);
    otpTimerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) {
          if (otpTimerRef.current) clearInterval(otpTimerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  // ─── Auth Handlers ────────────────────────────────────────────────────────────

  async function handleAuth() {
    setAuthError("");
    if (!email.trim()) { setAuthError("Email is required."); return; }
    if (!password) { setAuthError("Password is required."); return; }
    if (authMode === "signup") {
      if (password.length < 8) { setAuthError("Password must be at least 8 characters."); return; }
      if (password !== confirmPassword) { setAuthError("Passwords do not match."); return; }
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAuthError(data.error ?? "Authentication failed.");
        setAuthLoading(false);
        return;
      }

      // Generate and "send" OTP
      const otp = generateOTP();
      setGeneratedOTP(otp);
      console.info(`[Confi OTP] Your verification code: ${otp}`); // In production, send via SMS/email
      setOtpResendCount(0);
      setOtpCode("");
      setOtpError("");
      setScreen("otp");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleVerifyOTP() {
    setOtpError("");
    if (otpCode.length !== 6) { setOtpError("Enter the 6-digit code."); return; }
    if (otpCode !== generatedOTP) { setOtpError("Invalid code. Please try again."); return; }

    const token = generateToken();
    const u: User = { email: email.trim(), sessionToken: token };
    setUser(u);

    // Check if user has identity stored
    const idStored = localStorage.getItem(`confi_id_${email.trim()}`);
    if (idStored) {
      u.idVerified = true;
      u.legalName = JSON.parse(idStored).legalName;
      setUser({ ...u });
      localStorage.setItem("confi_user", JSON.stringify(u));
      setScreen("chat-list");
    } else {
      localStorage.setItem("confi_user", JSON.stringify(u));
      setScreen("identity");
    }
  }

  function handleResendOTP() {
    const otp = generateOTP();
    setGeneratedOTP(otp);
    console.info(`[Confi OTP] Resent code: ${otp}`);
    setOtpResendCount((n) => n + 1);
    setOtpCode("");
    setOtpError("");
  }

  // ─── Identity Handlers ────────────────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setIdentityError("File must be under 5MB.");
      return;
    }
    setIdentityError("");
    setIdFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      // In production: encrypt with AES-256 before storage
      // Here we store the base64 as a simulation of "encrypted at rest"
      const base64 = reader.result as string;
      setIdFile(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleIdentitySubmit() {
    setIdentityError("");
    if (!legalName.trim()) { setIdentityError("Legal name is required."); return; }
    if (!idNumber.trim()) { setIdentityError("Document number is required."); return; }
    if (!idFile) { setIdentityError("Please upload a copy of your ID document."); return; }

    setIdentityLoading(true);
    await new Promise((r) => setTimeout(r, 1500)); // Simulate verification

    const identityData = {
      legalName: legalName.trim(),
      idType,
      idNumber: idNumber.trim(),
      idFileHash: btoa(idFileName + Date.now()), // Simulate encrypted reference
      verifiedAt: new Date().toISOString(),
    };

    localStorage.setItem(`confi_id_${email.trim()}`, JSON.stringify(identityData));

    const updatedUser: User = {
      ...user!,
      legalName: legalName.trim(),
      idVerified: true,
    };
    setUser(updatedUser);
    localStorage.setItem("confi_user", JSON.stringify(updatedUser));
    setIdentityLoading(false);
    setScreen("chat-list");
  }

  function handleSkipIdentity() {
    setScreen("chat-list");
  }

  // ─── Chat Handlers ────────────────────────────────────────────────────────────

  function handleSendMessage() {
    if (!messageInput.trim() || !activeConvId) return;

    const newMsg: Message = {
      id: generateToken(),
      from: "me",
      text: messageInput.trim(),
      timestamp: Date.now(),
      confidential: activeConv?.confidentialMode ?? false,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, newMsg] }
          : c
      )
    );
    setMessageInput("");

    // Simulate reply after 1.5s
    setTimeout(() => {
      const reply: Message = {
        id: generateToken(),
        from: activeConv?.with ?? "Contact",
        text: activeConv?.confidentialMode
          ? "🔒 Understood. This conversation is protected under our NDA."
          : "Got it, thanks!",
        timestamp: Date.now(),
        confidential: activeConv?.confidentialMode ?? false,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, messages: [...c.messages, reply] }
            : c
        )
      );
    }, 1500);
  }

  function handleToggleConfidential(convId: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    if (!user?.idVerified) {
      setScreen("id-upload");
      return;
    }

    if (!conv.confidentialMode) {
      if (!conv.ndaSigned) {
        setPendingNdaConvId(convId);
        setNdaScrolled(false);
        setScreen("nda-modal");
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, confidentialMode: true } : c
          )
        );
      }
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, confidentialMode: false } : c
        )
      );
    }
  }

  async function handleSignNDA() {
    if (!ndaScrolled) return;
    setNdaSigning(true);
    await new Promise((r) => setTimeout(r, 1200));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === pendingNdaConvId
          ? { ...c, confidentialMode: true, ndaSigned: true }
          : c
      )
    );
    setNdaSigning(false);
    setScreen("chat");
    setPendingNdaConvId(null);
  }

  function handleNdaScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setNdaScrolled(true);
    }
  }

  function handleNewChat() {
    if (!newContactEmail.trim()) return;
    const initials = newContactEmail
      .split("@")[0]
      .slice(0, 2)
      .toUpperCase();
    const newConv: Conversation = {
      id: generateToken(),
      with: newContactEmail.trim(),
      avatar: initials,
      messages: [],
      confidentialMode: false,
      ndaSigned: false,
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setNewContactEmail("");
    setShowNewChat(false);
    setScreen("chat");
  }

  function handleLogout() {
    localStorage.removeItem("confi_user");
    setUser(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setScreen("auth");
    setAuthMode("login");
  }

  // ─── Filtered Conversations ───────────────────────────────────────────────────

  const filteredConvs = conversations.filter((c) =>
    c.with.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* AUTH SCREEN */}
      {screen === "auth" && (
        <div style={styles.centeredScreen}>
          <div style={styles.authCard}>
            <div style={styles.logoWrap}>
              <ShieldIcon size={36} color="#6C5CE7" />
              <h1 style={styles.logoText}>Confi</h1>
            </div>
            <p style={styles.tagline}>
              Secure messaging with legally binding confidentiality
            </p>

            <div style={styles.tabRow}>
              <button
                style={{
                  ...styles.tab,
                  ...(authMode === "login" ? styles.tabActive : {}),
                }}
                onClick={() => { setAuthMode("login"); setAuthError(""); }}
              >
                Log In
              </button>
              <button
                style={{
                  ...styles.tab,
                  ...(authMode === "signup" ? styles.tabActive : {}),
                }}
                onClick={() => { setAuthMode("signup"); setAuthError(""); }}
              >
                Sign Up
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                autoComplete="email"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder={authMode === "signup" ? "Min. 8 characters" : "Enter password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {authMode === "signup" && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  autoComplete="new-password"
                />
              </div>
            )}

            {authError && <p style={styles.errorText}>{authError}</p>}

            <button
              style={{
                ...styles.primaryBtn,
                opacity: authLoading ? 0.7 : 1,
              }}
              onClick={handleAuth}
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait…"
                : authMode === "login"
                ? "Log In & Verify"
                : "Create Account"}
            </button>

            <p style={styles.secureNote}>
              <LockIcon size={12} />
              &nbsp;Passwords are hashed server-side · Sessions expire after 24h
            </p>
          </div>
        </div>
      )}

      {/* OTP SCREEN */}
      {screen === "otp" && (
        <div style={styles.centeredScreen}>
          <div style={styles.authCard}>
            <div style={styles.logoWrap}>
              <ShieldIcon size={32} color="#6C5CE7" />
              <h1 style={styles.logoText}>Verify Identity</h1>
            </div>
            <p style={styles.tagline}>
              A 6-digit code was sent to <strong>{email}</strong>
            </p>
            <p style={{ ...styles.tagline, fontSize: 12, color: "#999" }}>
              (Check the browser console for the demo OTP code)
            </p>

            <div style={styles.otpRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  style={styles.otpInput}
                  maxLength={1}
                  value={otpCode[i] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const arr = otpCode.split("");
                    arr[i] = val;
                    const joined = arr.join("").slice(0, 6);
                    setOtpCode(joined);
                    if (val && i < 5) {
                      const next = document.querySelector<HTMLInputElement>(
                        `#otp-${i + 1}`
                      );
                      next?.focus();
                    }
                  }}
                  id={`otp-${i}`}
                  inputMode="numeric"
                />
              ))}
            </div>

            {otpError && <p style={styles.errorText}>{otpError}</p>}

            <button
              style={styles.primaryBtn}
              onClick={handleVerifyOTP}
            >
              Verify Code
            </button>

            <div style={styles.resendRow}>
              {otpTimer > 0 ? (
                <span style={styles.timerText}>
                  Resend in {otpTimer}s
                </span>
              ) : (
                <button style={styles.linkBtn} onClick={handleResendOTP}>
                  Resend Code
                </button>
              )}
            </div>

            <button
              style={styles.ghostBtn}
              onClick={() => setScreen("auth")}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* IDENTITY VERIFICATION SCREEN */}
      {screen === "identity" && (
        <div style={styles.centeredScreen}>
          <div style={{ ...styles.authCard, maxWidth: 480 }}>
            <div style={styles.logoWrap}>
              <ShieldIcon size={32} color="#6C5CE7" />
              <h1 style={styles.logoText}>Identity Verification</h1>
            </div>
            <p style={styles.tagline}>
              Required to activate Confidential Mode and anchor your NDA
              signature to a verified identity.
            </p>

            <div style={styles.infoBanner}>
              <LockIcon size={14} />
              <span style={{ marginLeft: 6, fontSize: 12 }}>
                Your ID is stored encrypted at rest. Only used for NDA
                verification.
              </span>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Legal Full Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="As it appears on your government ID"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Document Type</label>
              <select
                style={styles.input}
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
              >
                <option value="passport">Passport</option>
                <option value="national_id">National ID Card</option>
                <option value="drivers_license">Driver's License</option>
                <option value="residence_permit">Residence Permit</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Document Number</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. AB1234567"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Upload Document (max 5MB)</label>
              <div
                style={styles.uploadBox}
                onClick={() => fileInputRef.current?.click()}
              >
                {idFileName ? (
                  <span style={{ color: "#6C5CE7", fontSize: 14 }}>
                    ✓ {idFileName}
                  </span>
                ) : (
                  <span style={{ color: "#888", fontSize: 14 }}>
                    Click to upload JPG, PNG, or PDF
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </div>

            {identityError && (
              <p style={styles.errorText}>{identityError}</p>
            )}

            <button
              style={{
                ...styles.primaryBtn,
                opacity: identityLoading ? 0.7 : 1,
              }}
              onClick={handleIdentitySubmit}
              disabled={identityLoading}
            >
              {identityLoading ? "Verifying…" : "Submit & Verify Identity"}
            </button>

            <button style={styles.ghostBtn} onClick={handleSkipIdentity}>
              Skip for now (Confidential Mode unavailable)
            </button>
          </div>
        </div>
      )}

      {/* ID UPLOAD PROMPT (from chat) */}
      {screen === "id-upload" && (
        <div style={styles.centeredScreen}>
          <div style={styles.authCard}>
            <div style={styles.logoWrap}>
              <ShieldIcon size={32} color="#e17055" />
              <h1 style={{ ...styles.logoText, color: "#e17055" }}>
                Verification Required
              </h1>
            </div>
            <p style={styles.tagline}>
              You must verify your identity before activating Confidential Mode.
              This anchors the NDA to your legal person.
            </p>
            <button
              style={styles.primaryBtn}
              onClick={() => setScreen("identity")}
            >
              Verify Identity Now
            </button>
            <button
              style={styles.ghostBtn}
              onClick={() => setScreen("chat")}
            >
              ← Back to Chat
            </button>
          </div>
        </div>
      )}

      {/* NDA MODAL */}
      {screen === "nda-modal" && (
        <div style={styles.modalOverlay}>
          <div style={styles.ndaModal}>
            <div style={styles.ndaHeader}>
              <ShieldIcon size={22} color="#6C5CE7" />
              <h2 style={styles.ndaTitle}>International Non-Disclosure Agreement</h2>
            </div>

            <div style={styles.ndaParties}>
              <div style={styles.partyBadge}>
                <CheckIcon size={12} />
                <span style={{ marginLeft: 4 }}>
                  {user?.legalName ?? user?.email}
                </span>
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "#27ae60",
                    fontWeight: 600,
                  }}
                >
                  ID Verified
                </span>
              </div>
              <span style={{ color: "#aaa", fontSize: 12 }}>↔</span>
              <div style={styles.partyBadge}>
                <span>
                  {conversations.find((c) => c.id === pendingNdaConvId)?.with}
                </span>
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "#f39c12",
                    fontWeight: 600,
                  }}
                >
                  Remote Party
                </span>
              </div>
            </div>

            <p style={styles.ndaScrollHint}>
              {ndaScrolled ? (
                <span style={{ color: "#27ae60" }}>
                  ✓ You have read the full agreement
                </span>
              ) : (
                "↓ Scroll to the bottom to enable signing"
              )}
            </p>

            <div
              ref={ndaScrollRef}
              style={styles.ndaBody}
              onScroll={handleNdaScroll}
            >
              <pre style={styles.ndaText}>{NDA_TEXT}</pre>
              <div style={{ marginTop: 20, padding: "12px 0", borderTop: "1px solid #eee" }}>
                <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
                  <strong>Digital Signature Date:</strong>{" "}
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p style={{ fontSize: 13, color: "#555" }}>
                  <strong>Signatory:</strong> {user?.legalName ?? user?.email}
                </p>
                <p style={{ fontSize: 13, color: "#555" }}>
                  <strong>Session Token:</strong>{" "}
                  <code style={{ fontSize: 11, color: "#888" }}>
                    {user?.sessionToken?.slice(0, 24)}…
                  </code>
                </p>
              </div>
            </div>

            <div style={styles.ndaActions}>
              <button
                style={styles.ghostBtn}
                onClick={() => {
                  setScreen("chat");
                  setPendingNdaConvId(null);
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.primaryBtn,
                  opacity: ndaScrolled && !ndaSigning ? 1 : 0.45,
                  margin: 0,
                  flex: 1,
                }}
                onClick={handleSignNDA}
                disabled={!ndaScrolled || ndaSigning}
              >
                {ndaSigning ? "Signing…" : "I Agree & Sign NDA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT LIST */}
      {screen === "chat-list" && (
        <div style={styles.chatListScreen}>
          {/* Header */}
          <div style={styles.chatListHeader}>
            <div style={styles.headerLeft}>
              <ShieldIcon size={22} color="#fff" />
              <span style={styles.headerTitle}>Confi</span>
            </div>
            <div style={styles.headerRight}>
              <button
                style={styles.iconBtn}
                onClick={() => setShowNewChat(!showNewChat)}
                title="New Chat"
              >
                ✏️
              </button>
              <button
                style={styles.iconBtn}
                onClick={handleLogout}
                title="Logout"
              >
                👤
              </button>
            </div>
          </div>

          {/* User identity badge */}
          {user?.idVerified && (
            <div style={styles.verifiedBanner}>
              <ShieldIcon size={14} color="#27ae60" />
              <span style={{ marginLeft: 6, fontSize: 12, color: "#27ae60", fontWeight: 600 }}>
                Identity Verified — {user.legalName}
              </span>
            </div>
          )}

          {!user?.idVerified && (
            <div
              style={styles.unverifiedBanner}
              onClick={() => setScreen("identity")}
            >
              ⚠️ Verify your identity to unlock Confidential Mode →
            </div>
          )}

          {/* Search */}
          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="🔍 Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* New chat form */}
          {showNewChat && (
            <div style={styles.newChatForm}>
              <input
                style={{ ...styles.input, flex: 1, margin: 0 }}
                type="email"
                placeholder="Enter contact email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNewChat()}
              />
              <button style={styles.sendBtn} onClick={handleNewChat}>
                Start
              </button>
            </div>
          )}

          {/* Conversation list */}
          <div style={styles.convList}>
            {filteredConvs.length === 0 && (
              <p style={styles.emptyState}>No conversations found.</p>
            )}
            {filteredConvs.map((conv) => {
              const last = conv.messages[conv.messages.length - 1];
              return (
                <div
                  key={conv.id}
                  style={styles.convItem}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setScreen("chat");
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <Avatar initials={conv.avatar} />
                    {conv.confidentialMode && (
                      <div style={styles.lockBadge}>
                        <LockIcon size={8} />
                      </div>
                    )}
                  </div>
                  <div style={styles.convInfo}>
                    <div style={styles.convTopRow}>
                      <span style={styles.convName}>{conv.with}</span>
                      <span style={styles.convTime}>
                        {last ? formatDate(last.timestamp) : ""}
                      </span>
                    </div>
                    <div style={styles.convPreview}>
                      {conv.confidentialMode && (
                        <LockIcon size={11} />
                      )}
                      <span
                        style={{
                          marginLeft: conv.confidentialMode ? 4 : 0,
                          color: conv.confidentialMode ? "#6C5CE7" : "#888",
                          fontStyle: conv.confidentialMode ? "italic" : "normal",
                        }}
                      >
                        {last
                          ? conv.confidentialMode
                            ? "🔒 Confidential message"
                            : last.text.length > 45
                            ? last.text.slice(0, 45) + "…"
                            : last.text
                          : "No messages yet"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHAT VIEW */}
      {screen === "chat" && activeConv && (
        <div style={styles.chatScreen}>
          {/* Chat header */}
          <div style={styles.chatHeader}>
            <button
              style={styles.backBtn}
              onClick={() => setScreen("chat-list")}
            >
              ←
            </button>
            <Avatar initials={activeConv.avatar} size={36} />
            <div style={styles.chatHeaderInfo}>
              <span style={styles.chatHeaderName}>{activeConv.with}</span>
              {activeConv.ndaSigned && (
                <span style={styles.ndaBadge}>
                  <ShieldIcon size={10} color="#27ae60" /> NDA Active
                </span>
              )}
            </div>

            {/* Confidential mode toggle */}
            <div style={styles.confidentialToggle}>
              <span
                style={{
                  fontSize: 11,
                  color: activeConv.confidentialMode ? "#6C5CE7" : "#aaa",
                  fontWeight: 600,
                  marginRight: 6,
                }}
              >
                {activeConv.confidentialMode ? "🔒 Confidential" : "Confidential"}
              </span>
              <div
                style={{
                  ...styles.toggle,
                  background: activeConv.confidentialMode ? "#6C5CE7" : "#ccc",
                }}
                onClick={() => handleToggleConfidential(activeConv.id)}
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    transform: activeConv.confidentialMode
                      ? "translateX(20px)"
                      : "translateX(2px)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Confidential mode banner */}
          {activeConv.confidentialMode && (
            <div style={styles.confiBanner}>
              <ShieldIcon size={14} color="#fff" />
              <span style={{ marginLeft: 8, fontSize: 12, color: "#fff" }}>
                This conversation is protected by an International NDA · Signed{" "}
                {activeConv.ndaSigned ? "✓" : "Pending"}
              </span>
            </div>
          )}

          {/* Messages */}
          <div style={styles.messageList}>
            {activeConv.messages.length === 0 && (
              <div style={styles.emptyChat}>
                <Avatar initials={activeConv.avatar} size={56} />
                <p style={{ marginTop: 12, color: "#888", fontSize: 14 }}>
                  Start a conversation with {activeConv.with}
                </p>
                {user?.idVerified && (
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
                    Enable Confidential Mode for legally protected messaging
                  </p>
                )}
              </div>
            )}

            {activeConv.messages.map((msg) => {
              const isMe = msg.from === "me";
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  {!isMe && (
                    <Avatar
                      initials={activeConv.avatar}
                      size={28}
                      color="#a29bfe"
                    />
                  )}
                  <div
                    style={{
                      ...styles.bubble,
                      background: isMe
                        ? msg.confidential
                          ? "#4a3780"
                          : "#6C5CE7"
                        : msg.confidential
                        ? "#f0edf9"
                        : "#f0f0f0",
                      color: isMe ? "#fff" : "#222",
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: isMe ? 16 : 4,
                      marginLeft: isMe ? 0 : 8,
                      marginRight: isMe ? 0 : 0,
                    }}
                  >
                    {msg.confidential && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 4,
                          fontSize: 10,
                          color: isMe ? "#d4c8ff" : "#9b59b6",
                          fontWeight: 600,
                        }}
                      >
                        <LockIcon size={9} /> CONFIDENTIAL
                      </div>
                    )}
                    <span style={{ fontSize: 14, lineHeight: 1.5 }}>
                      {msg.text}
                    </span>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 4,
                        color: isMe ? "rgba(255,255,255,0.65)" : "#aaa",
                        textAlign: "right",
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div style={styles.inputBar}>
            <input
              style={styles.messageInput}
              type="text"
              placeholder={
                activeConv.confidentialMode
                  ? "🔒 Send confidential message…"
                  : "Type a message…"
              }
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              style={{
                ...styles.sendBtn,
                background: activeConv.confidentialMode ? "#4a3780" : "#6C5CE7",
              }}
              onClick={handleSendMessage}
            >
              ➤
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
    height: "100dvh",
    width: "100%",
    background: "#f5f5f7",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  centeredScreen: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    padding: "20px",
    overflowY: "auto",
  },
  authCard: {
    background: "#fff",
    borderRadius: 20,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 800,
    color: "#1a1a2e",
    margin: 0,
  },
  tagline: {
    color: "#666",
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 1.5,
  },
  tabRow: {
    display: "flex",
    background: "#f0f0f0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#888",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#fff",
    color: "#6C5CE7",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #e8e8e8",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: 500,
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    background: "#6C5CE7",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    margin: "8px 0",
    letterSpacing: "0.3px",
  },
  ghostBtn: {
    width: "100%",
    padding: "12px",
    background: "transparent",
    color: "#888",
    border: "1.5px solid #e8e8e8",
    borderRadius: 12,
    fontSize: 14,
    cursor: "pointer",
    margin: "4px 0",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#6C5CE7",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  secureNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#bbb",
    fontSize: 11,
    marginTop: 8,
  },
  otpRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  otpInput: {
    width: 44,
    height: 52,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    border: "2px solid #e8e8e8",
    borderRadius: 10,
    outline: "none",
    background: "#fafafa",
  },
  resendRow: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  timerText: {
    color: "#aaa",
    fontSize: 13,
  },
  infoBanner: {
    display: "flex",
    alignItems: "flex-start",
    background: "#f0edf9",
    border: "1px solid #d4c8ff",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 20,
    color: "#6C5CE7",
    fontSize: 13,
  },
  uploadBox: {
    border: "2px dashed #d4c8ff",
    borderRadius: 10,
    padding: "24px",
    textAlign: "center",
    cursor: "pointer",
    background: "#faf9ff",
    transition: "border-color 0.2s",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  ndaModal: {
    background: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 580,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    overflow: "hidden",
  },
  ndaHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px 24px 14px",
    borderBottom: "1px solid #eee",
  },
  ndaTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
  },
  ndaParties: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 24px",
    background: "#f9f9f9",
    borderBottom: "1px solid #eee",
    flexWrap: "wrap",
  },
  partyBadge: {
    display: "flex",
    alignItems: "center",
    background: "#fff",
    border: "1.5px solid #e0e0e0",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 600,
    color: "#333",
  },
  ndaScrollHint: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    padding: "8px 24px 0",
    margin: 0,
  },
  ndaBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
  },
  ndaText: {
    fontSize: 12,
    color: "#444",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    fontFamily: "Georgia, serif",
    margin: 0,
  },
  ndaActions: {
    display: "flex",
    gap: 10,
    padding: "16px 24px",
    borderTop: "1px solid #eee",
    alignItems: "center",
  },
  chatListScreen: {
    width: "100%",
    maxWidth: 480,
    height: "100%",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 40px rgba(0,0,0,0.08)",
  },
  chatListHeader: {
    background: "#6C5CE7",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  headerRight: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
    color: "#fff",
  },
  verifiedBanner: {
    display: "flex",
    alignItems: "center",
    background: "#f0faf4",
    borderBottom: "1px solid #d4edda",
    padding: "8px 16px",
    flexShrink: 0,
  },
  unverifiedBanner: {
    background: "#fff8e1",
    borderBottom: "1px solid #ffe082",
    padding: "8px 16px",
    fontSize: 13,
    color: "#f39c12",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  searchWrap: {
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
    flexShrink: 0,
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    border: "none",
    borderRadius: 20,
    background: "#f5f5f7",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  newChatForm: {
    display: "flex",
    gap: 8,
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
    alignItems: "center",
    flexShrink: 0,
  },
  convList: {
    flex: 1,
    overflowY: "auto",
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #f8f8f8",
    transition: "background 0.15s",
  },
  convInfo: {
    flex: 1,
    minWidth: 0,
  },
  convTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 3,
  },
  convName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1a1a2e",
  },
  convTime: {
    fontSize: 11,
    color: "#aaa",
  },
  convPreview: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    color: "#888",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  lockBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    background: "#6C5CE7",
    borderRadius: "50%",
    width: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  emptyState: {
    textAlign: "center",
    color: "#aaa",
    padding: "40px 20px",
    fontSize: 14,
  },
  chatScreen: {
    width: "100%",
    maxWidth: 480,
    height: "100%",
    background: "#f5f5f7",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 40px rgba(0,0,0,0.08)",
  },
  chatHeader: {
    background: "#fff",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid #eee",
    flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#6C5CE7",
    padding: "0 4px",
  },
  chatHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a2e",
    display: "block",
  },
  ndaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 11,
    color: "#27ae60",
    fontWeight: 600,
  },
  confidentialToggle: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    cursor: "pointer",
    position: "relative",
    transition: "background 0.3s",
    flexShrink: 0,
  },
  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    transition: "transform 0.3s",
  },
  confiBanner: {
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(90deg, #6C5CE7, #a29bfe)",
    padding: "8px 16px",
    flexShrink: 0,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  emptyChat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: "60px 20px",
    color: "#888",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
  },
  bubble: {
    maxWidth: "72%",
    padding: "10px 14px",
    borderRadius: 18,
    lineHeight: 1.4,
  },
  inputBar: {
    display: "flex",
    gap: 8,
    padding: "10px 12px",
    background: "#fff",
    borderTop: "1px solid #eee",
    alignItems: "center",
    flexShrink: 0,
  },
  messageInput: {
    flex: 1,
    padding: "10px 16px",
    border: "1.5px solid #e8e8e8",
    borderRadius: 22,
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
  },
  sendBtn: {
    background: "#6C5CE7",
    color: "#fff",
    border: "none",
    borderRadius: 22,
    padding: "10px 16px",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
  },
};