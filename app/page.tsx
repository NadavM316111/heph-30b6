"use client";

import { useEffect, useState, useCallback } from "react";

// ── types ──────────────────────────────────────────────────────────────────────
type Screen =
  | "splash"
  | "phone"
  | "otp"
  | "register"
  | "home"
  | "profile"
  | "chat";

interface UserSession {
  userId: string;
  displayName: string;
  phone: string;
  email: string;
  avatarSeed: string;
  cryptoId: string;
  createdAt: string;
}

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  ts: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatarSeed: string;
  lastMsg: string;
  ts: number;
  unread: number;
  confidential: boolean;
  messages: Message[];
}

// ── helpers ────────────────────────────────────────────────────────────────────
function genId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10).toUpperCase()
  );
}

function genCryptoId(): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `CONFI-${hex.toUpperCase()}`;
}

function avatarUrl(seed: string, size = 56): string {
  // Use DiceBear open-source SVG API (no key required)
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── demo conversations ─────────────────────────────────────────────────────────
const DEMO_CONVOS: Conversation[] = [
  {
    id: "c1",
    name: "Alice Chen",
    avatarSeed: "AliceChen",
    lastMsg: "Let's keep this strictly confidential.",
    ts: Date.now() - 120000,
    unread: 2,
    confidential: true,
    messages: [
      {
        id: "m1",
        text: "Hey! Can we discuss the merger details?",
        sender: "them",
        ts: Date.now() - 300000,
        confidential: true,
      },
      {
        id: "m2",
        text: "Sure, I've activated confidential mode.",
        sender: "me",
        ts: Date.now() - 240000,
        confidential: true,
      },
      {
        id: "m3",
        text: "Let's keep this strictly confidential.",
        sender: "them",
        ts: Date.now() - 120000,
        confidential: true,
      },
    ],
  },
  {
    id: "c2",
    name: "Bob Martinez",
    avatarSeed: "BobMartinez",
    lastMsg: "See you at 3pm!",
    ts: Date.now() - 3600000,
    unread: 0,
    confidential: false,
    messages: [
      {
        id: "m4",
        text: "Are we still meeting today?",
        sender: "them",
        ts: Date.now() - 7200000,
        confidential: false,
      },
      {
        id: "m5",
        text: "Yes, 3pm works for me.",
        sender: "me",
        ts: Date.now() - 3700000,
        confidential: false,
      },
      {
        id: "m6",
        text: "See you at 3pm!",
        sender: "them",
        ts: Date.now() - 3600000,
        confidential: false,
      },
    ],
  },
  {
    id: "c3",
    name: "Legal Team",
    avatarSeed: "LegalTeam99",
    lastMsg: "NDA has been countersigned.",
    ts: Date.now() - 86400000,
    unread: 1,
    confidential: true,
    messages: [
      {
        id: "m7",
        text: "Please review the attached NDA.",
        sender: "them",
        ts: Date.now() - 90000000,
        confidential: true,
      },
      {
        id: "m8",
        text: "Reviewed and signed.",
        sender: "me",
        ts: Date.now() - 87000000,
        confidential: true,
      },
      {
        id: "m9",
        text: "NDA has been countersigned.",
        sender: "them",
        ts: Date.now() - 86400000,
        confidential: true,
      },
    ],
  },
];

// ── NDA Modal ──────────────────────────────────────────────────────────────────
function NDAModal({
  onAccept,
  onDecline,
  userName,
  cryptoId,
}: {
  onAccept: () => void;
  onDecline: () => void;
  userName: string;
  cryptoId: string;
}) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.ndaModal}>
        <div style={styles.ndaHeader}>
          <div style={styles.ndaLockIcon}>🔐</div>
          <h2 style={styles.ndaTitle}>International NDA</h2>
          <p style={styles.ndaSubtitle}>Non-Disclosure Agreement</p>
        </div>

        <div style={styles.ndaBody}>
          <p style={styles.ndaDate}>Effective Date: {date}</p>

          <p style={styles.ndaClause}>
            <strong>PARTIES:</strong> This Non-Disclosure Agreement
            (&quot;Agreement&quot;) is entered into between{" "}
            <strong>{userName}</strong> (User ID:{" "}
            <code style={styles.cryptoCode}>{cryptoId.slice(0, 20)}…</code>)
            and all participants in this confidential conversation.
          </p>

          <p style={styles.ndaClause}>
            <strong>1. CONFIDENTIAL INFORMATION:</strong> All messages,
            attachments, and metadata exchanged in this conversation are
            designated as Confidential Information under the governing laws of
            applicable international jurisdictions, including but not limited to
            GDPR (EU 2016/679), applicable U.S. trade-secret statutes, and the
            UNCITRAL Model Law on Electronic Commerce.
          </p>

          <p style={styles.ndaClause}>
            <strong>2. OBLIGATIONS:</strong> Each party agrees to: (a) hold all
            Confidential Information in strict confidence; (b) not disclose,
            reproduce, or distribute such information to any third party without
            prior written consent; (c) use the information solely for the
            purpose of this conversation.
          </p>

          <p style={styles.ndaClause}>
            <strong>3. DURATION:</strong> Obligations survive for five (5) years
            from the date of last message in this conversation.
          </p>

          <p style={styles.ndaClause}>
            <strong>4. REMEDIES:</strong> Breach may result in equitable relief,
            injunctive remedies, and monetary damages as permitted by law.
          </p>

          <p style={styles.ndaClause}>
            <strong>5. CRYPTOGRAPHIC BINDING:</strong> Your unique Confi ID (
            <code style={styles.cryptoCode}>{cryptoId.slice(0, 20)}…</code>) is
            cryptographically linked to this agreement as your digital
            signature.
          </p>

          <p style={styles.ndaClause}>
            <strong>6. GOVERNING LAW:</strong> This Agreement shall be governed
            by the laws of the jurisdiction most protective of confidentiality
            rights, as determined by mutual agreement or arbitration.
          </p>
        </div>

        <div style={styles.ndaFooter}>
          <p style={styles.ndaAckText}>
            By tapping &quot;Accept &amp; Enable&quot; you acknowledge you have
            read, understood, and agree to be legally bound by this
            International NDA.
          </p>
          <div style={styles.ndaButtons}>
            <button style={styles.ndaDeclineBtn} onClick={onDecline}>
              Decline
            </button>
            <button style={styles.ndaAcceptBtn} onClick={onAccept}>
              ✓ Accept &amp; Enable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [session, setSession] = useState<UserSession | null>(null);
  const [convos, setConvos] = useState<Conversation[]>(DEMO_CONVOS);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [showNDA, setShowNDA] = useState(false);
  const [pendingConfiToggle, setPendingConfiToggle] = useState<string | null>(
    null
  );

  // Phone / OTP flow
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("default");
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Chat
  const [msgInput, setMsgInput] = useState("");

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  // ── init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const stored = localStorage.getItem("confi_session");
    if (stored) {
      try {
        const s: UserSession = JSON.parse(stored);
        setSession(s);
        setScreen("home");
      } catch {
        // ignore
      }
    } else {
      setTimeout(() => setScreen("phone"), 1800);
    }
  }, []);

  // ── auth handlers ────────────────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    if (!phone || phone.length < 7) {
      setAuthError("Enter a valid phone number.");
      return;
    }
    setIsLoading(true);
    setAuthError("");

    // Generate a 6-digit OTP (in production this would be sent via SMS)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(otp);

    // Simulate SMS delay
    await new Promise((r) => setTimeout(r, 800));

    // In dev, show the OTP in the UI (production would send real SMS)
    setIsLoading(false);
    setScreen("otp");
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpInput.length !== 6) {
      setAuthError("Enter the 6-digit code.");
      return;
    }
    if (otpInput !== generatedOtp) {
      setAuthError("Incorrect code. Try again.");
      return;
    }
    setAuthError("");

    // Check if user exists via /api/auth
    setIsLoading(true);
    const fullPhone = `${countryCode}${phone}`;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "login",
          email: `${fullPhone.replace(/\D/g, "")}@phone.confi`,
          password: generatedOtp,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        // Existing user — load profile from localStorage
        const storedProfile = localStorage.getItem(
          `confi_profile_${fullPhone.replace(/\D/g, "")}`
        );
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          const s: UserSession = {
            userId: genId(),
            displayName: profile.displayName || "Confi User",
            phone: fullPhone,
            email: profile.email || "",
            avatarSeed: profile.avatarSeed || "default",
            cryptoId: profile.cryptoId || genCryptoId(),
            createdAt: profile.createdAt || new Date().toISOString(),
          };
          setSession(s);
          localStorage.setItem("confi_session", JSON.stringify(s));
          setScreen("home");
        } else {
          setScreen("register");
        }
      } else {
        setScreen("register");
      }
    } catch {
      setScreen("register");
    } finally {
      setIsLoading(false);
    }
  }, [otpInput, generatedOtp, countryCode, phone]);

  const handleRegister = useCallback(async () => {
    if (!displayName.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    setIsLoading(true);
    setAuthError("");

    const fullPhone = `${countryCode}${phone}`;
    const pseudoEmail =
      email.trim() ||
      `${fullPhone.replace(/\D/g, "")}@phone.confi`;
    const cryptoId = genCryptoId();
    const seed = avatarSeed !== "default" ? avatarSeed : displayName;

    try {
      // Register via /api/auth
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "signup",
          email: pseudoEmail,
          password: generatedOtp,
        }),
      });
      const data = await res.json();
      if (data.error && !data.ok) {
        // Account may already exist — that's fine
      }

      const s: UserSession = {
        userId: genId(),
        displayName: displayName.trim(),
        phone: fullPhone,
        email: pseudoEmail,
        avatarSeed: seed,
        cryptoId,
        createdAt: new Date().toISOString(),
      };

      // Store profile keyed by phone
      localStorage.setItem(
        `confi_profile_${fullPhone.replace(/\D/g, "")}`,
        JSON.stringify(s)
      );
      localStorage.setItem("confi_session", JSON.stringify(s));
      setSession(s);
      setScreen("home");
    } catch {
      setAuthError("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    displayName,
    email,
    avatarSeed,
    countryCode,
    phone,
    generatedOtp,
  ]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("confi_session");
    setSession(null);
    setPhone("");
    setOtpInput("");
    setGeneratedOtp("");
    setDisplayName("");
    setEmail("");
    setAvatarSeed("default");
    setScreen("phone");
  }, []);

  // ── confidential mode ────────────────────────────────────────────────────────
  const handleToggleConfidential = useCallback(
    (convoId: string, currentState: boolean) => {
      if (!currentState) {
        // Turning ON — show NDA
        setPendingConfiToggle(convoId);
        setShowNDA(true);
      } else {
        // Turning OFF
        setConvos((prev) =>
          prev.map((c) =>
            c.id === convoId ? { ...c, confidential: false } : c
          )
        );
        if (activeConvo?.id === convoId) {
          setActiveConvo((prev) =>
            prev ? { ...prev, confidential: false } : prev
          );
        }
      }
    },
    [activeConvo]
  );

  const handleNDAAccept = useCallback(() => {
    if (!pendingConfiToggle) return;
    setConvos((prev) =>
      prev.map((c) =>
        c.id === pendingConfiToggle ? { ...c, confidential: true } : c
      )
    );
    if (activeConvo?.id === pendingConfiToggle) {
      setActiveConvo((prev) =>
        prev ? { ...prev, confidential: true } : prev
      );
    }
    setShowNDA(false);
    setPendingConfiToggle(null);
  }, [pendingConfiToggle, activeConvo]);

  const handleNDADecline = useCallback(() => {
    setShowNDA(false);
    setPendingConfiToggle(null);
  }, []);

  // ── chat ─────────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(() => {
    if (!msgInput.trim() || !activeConvo) return;
    const newMsg: Message = {
      id: genId(),
      text: msgInput.trim(),
      sender: "me",
      ts: Date.now(),
      confidential: activeConvo.confidential,
    };

    const updatedConvo: Conversation = {
      ...activeConvo,
      messages: [...activeConvo.messages, newMsg],
      lastMsg: newMsg.text,
      ts: newMsg.ts,
    };

    setActiveConvo(updatedConvo);
    setConvos((prev) =>
      prev.map((c) => (c.id === activeConvo.id ? updatedConvo : c))
    );
    setMsgInput("");

    // Simulate reply after 1.5s
    setTimeout(() => {
      const replies = [
        "Got it, understood.",
        "This stays between us.",
        "Noted. Confidentiality maintained.",
        "Thanks for the update.",
        "Acknowledged.",
      ];
      const reply: Message = {
        id: genId(),
        text: replies[Math.floor(Math.random() * replies.length)],
        sender: "them",
        ts: Date.now(),
        confidential: updatedConvo.confidential,
      };
      const withReply: Conversation = {
        ...updatedConvo,
        messages: [...updatedConvo.messages, reply],
        lastMsg: reply.text,
        ts: reply.ts,
      };
      setActiveConvo(withReply);
      setConvos((prev) =>
        prev.map((c) => (c.id === updatedConvo.id ? withReply : c))
      );
    }, 1500);
  }, [msgInput, activeConvo]);

  // ── profile save ─────────────────────────────────────────────────────────────
  const handleSaveName = useCallback(() => {
    if (!editName.trim() || !session) return;
    const updated: UserSession = { ...session, displayName: editName.trim() };
    setSession(updated);
    localStorage.setItem("confi_session", JSON.stringify(updated));
    localStorage.setItem(
      `confi_profile_${session.phone.replace(/\D/g, "")}`,
      JSON.stringify(updated)
    );
    setEditingName(false);
  }, [editName, session]);

  const handleChangeAvatar = useCallback(() => {
    if (!session) return;
    const seeds = [
      "Tigger",
      "Coco",
      "Max",
      "Luna",
      "Bear",
      "Milo",
      "Bella",
      "Zoe",
      "Charlie",
      "Molly",
    ];
    const seed = seeds[Math.floor(Math.random() * seeds.length)] + genId();
    const updated: UserSession = { ...session, avatarSeed: seed };
    setSession(updated);
    localStorage.setItem("confi_session", JSON.stringify(updated));
  }, [session]);

  // ── SCREENS ──────────────────────────────────────────────────────────────────

  // SPLASH
  if (screen === "splash") {
    return (
      <div style={styles.splash}>
        <div style={styles.splashInner}>
          <div style={styles.splashLogo}>🔒</div>
          <h1 style={styles.splashTitle}>Confi</h1>
          <p style={styles.splashTagline}>Confidential Messaging Redefined</p>
          <div style={styles.splashDots}>
            <span style={{ ...styles.dot, animationDelay: "0s" }} />
            <span style={{ ...styles.dot, animationDelay: "0.2s" }} />
            <span style={{ ...styles.dot, animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  // PHONE ENTRY
  if (screen === "phone") {
    return (
      <div style={styles.authScreen}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>🔒</div>
          <h1 style={styles.authTitle}>Confi</h1>
          <p style={styles.authSub}>Enter your phone number to continue</p>

          <div style={styles.phoneRow}>
            <select
              style={styles.countrySelect}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+49">🇩🇪 +49</option>
              <option value="+33">🇫🇷 +33</option>
              <option value="+81">🇯🇵 +81</option>
              <option value="+86">🇨🇳 +86</option>
              <option value="+91">🇮🇳 +91</option>
              <option value="+55">🇧🇷 +55</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+27">🇿🇦 +27</option>
              <option value="+234">🇳🇬 +234</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+65">🇸🇬 +65</option>
              <option value="+82">🇰🇷 +82</option>
              <option value="+7">🇷🇺 +7</option>
              <option value="+52">🇲🇽 +52</option>
              <option value="+34">🇪🇸 +34</option>
              <option value="+39">🇮🇹 +39</option>
            </select>
            <input
              style={styles.phoneInput}
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^0-9]/g, ""))
              }
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            />
          </div>

          {authError && <p style={styles.errorText}>{authError}</p>}

          <button
            style={{
              ...styles.primaryBtn,
              opacity: isLoading ? 0.7 : 1,
            }}
            onClick={handleSendOtp}
            disabled={isLoading}
          >
            {isLoading ? "Sending…" : "Send Verification Code →"}
          </button>

          <p style={styles.legalNote}>
            By continuing you agree to Confi&apos;s Terms and Privacy Policy.
            Your number is stored securely.
          </p>
        </div>
      </div>
    );
  }

  // OTP VERIFICATION
  if (screen === "otp") {
    return (
      <div style={styles.authScreen}>
        <div style={styles.authCard}>
          <button style={styles.backBtn} onClick={() => setScreen("phone")}>
            ← Back
          </button>
          <div style={styles.authLogo}>📱</div>
          <h2 style={styles.authTitle}>Verify your number</h2>
          <p style={styles.authSub}>
            We sent a code to{" "}
            <strong>
              {countryCode} {phone}
            </strong>
          </p>

          {/* Dev only: show OTP */}
          <div style={styles.devOtpBox}>
            <p style={styles.devOtpLabel}>
              📋 Dev mode — your code is:{" "}
              <strong style={styles.devOtpCode}>{generatedOtp}</strong>
            </p>
          </div>

          <input
            style={styles.otpInput}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otpInput}
            onChange={(e) =>
              setOtpInput(e.target.value.replace(/[^0-9]/g, ""))
            }
            onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
          />

          {authError && <p style={styles.errorText}>{authError}</p>}

          <button
            style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1 }}
            onClick={handleVerifyOtp}
            disabled={isLoading}
          >
            {isLoading ? "Verifying…" : "Verify Code →"}
          </button>

          <button
            style={styles.textBtn}
            onClick={() => {
              const otp = String(Math.floor(100000 + Math.random() * 900000));
              setGeneratedOtp(otp);
              setOtpInput("");
            }}
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  // REGISTER / PROFILE SETUP
  if (screen === "register") {
    const previewSeed =
      displayName.trim() || avatarSeed || "preview";

    const AVATAR_SEEDS = [
      "Alpha",
      "Beta",
      "Gamma",
      "Delta",
      "Epsilon",
      "Zeta",
      "Eta",
      "Theta",
    ];

    return (
      <div style={styles.authScreen}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>👤</div>
          <h2 style={styles.authTitle}>Set up your profile</h2>
          <p style={styles.authSub}>Your identity on Confi</p>

          {/* Avatar picker */}
          <div style={styles.avatarPreviewWrap}>
            <img
              src={avatarUrl(previewSeed, 80)}
              alt="avatar"
              style={styles.avatarPreviewLarge}
            />
          </div>

          <div style={styles.avatarGrid}>
            {AVATAR_SEEDS.map((s) => (
              <button
                key={s}
                style={{
                  ...styles.avatarChoice,
                  border:
                    avatarSeed === s
                      ? "2px solid #6C47FF"
                      : "2px solid transparent",
                }}
                onClick={() => setAvatarSeed(s)}
              >
                <img
                  src={avatarUrl(s, 40)}
                  alt={s}
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                />
              </button>
            ))}
          </div>

          <input
            style={styles.textInput}
            type="text"
            placeholder="Display name *"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            style={styles.textInput}
            type="email"
            placeholder="Email backup (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {authError && <p style={styles.errorText}>{authError}</p>}

          <button
            style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1 }}
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? "Creating account…" : "Create Account →"}
          </button>
        </div>
      </div>
    );
  }

  // HOME (conversation list)
  if (screen === "home" && session) {
    const sorted = [...convos].sort((a, b) => b.ts - a.ts);

    return (
      <div style={styles.appShell}>
        <div style={styles.topBar}>
          <h1 style={styles.appName}>🔒 Confi</h1>
          <div style={styles.topBarRight}>
            <button
              style={styles.iconBtn}
              onClick={() => setScreen("profile")}
              title="Profile"
            >
              <img
                src={avatarUrl(session.avatarSeed, 32)}
                alt="me"
                style={styles.topBarAvatar}
              />
            </button>
          </div>
        </div>

        <div style={styles.searchBar}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search conversations…"
            readOnly
          />
        </div>

        <div style={styles.convoList}>
          {sorted.map((c) => (
            <button
              key={c.id}
              style={styles.convoRow}
              onClick={() => {
                setActiveConvo(c);
                setConvos((prev) =>
                  prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x))
                );
                setScreen("chat");
              }}
            >
              <div style={styles.convoAvatarWrap}>
                <img
                  src={avatarUrl(c.avatarSeed, 48)}
                  alt={c.name}
                  style={styles.convoAvatar}
                />
                {c.confidential && (
                  <span style={styles.confidentialBadge}>🔐</span>
                )}
              </div>
              <div style={styles.convoInfo}>
                <div style={styles.convoTopLine}>
                  <span style={styles.convoName}>{c.name}</span>
                  <span style={styles.convoTime}>{formatTime(c.ts)}</span>
                </div>
                <div style={styles.convoBottomLine}>
                  <span style={styles.convoLastMsg}>{c.lastMsg}</span>
                  {c.unread > 0 && (
                    <span style={styles.unreadBadge}>{c.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          style={styles.fab}
          onClick={() => {
            // New convo — demo only
            const newConvo: Conversation = {
              id: genId(),
              name: "New Contact",
              avatarSeed: genId(),
              lastMsg: "",
              ts: Date.now(),
              unread: 0,
              confidential: false,
              messages: [],
            };
            setConvos((prev) => [newConvo, ...prev]);
            setActiveConvo(newConvo);
            setScreen("chat");
          }}
        >
          ✏️
        </button>
      </div>
    );
  }

  // CHAT SCREEN
  if (screen === "chat" && activeConvo && session) {
    return (
      <div style={styles.appShell}>
        {showNDA && (
          <NDAModal
            onAccept={handleNDAAccept}
            onDecline={handleNDADecline}
            userName={session.displayName}
            cryptoId={session.cryptoId}
          />
        )}

        <div
          style={{
            ...styles.chatTopBar,
            background: activeConvo.confidential
              ? "linear-gradient(135deg,#1a0533,#2d0057)"
              : "#1e1e2e",
          }}
        >
          <button
            style={styles.backIconBtn}
            onClick={() => setScreen("home")}
          >
            ←
          </button>
          <img
            src={avatarUrl(activeConvo.avatarSeed, 36)}
            alt={activeConvo.name}
            style={styles.chatAvatar}
          />
          <div style={styles.chatHeaderInfo}>
            <span style={styles.chatName}>{activeConvo.name}</span>
            <span style={styles.chatStatus}>
              {activeConvo.confidential ? "🔐 Confidential · NDA Active" : "● Online"}
            </span>
          </div>
          <div
            style={{
              ...styles.confiToggleWrap,
              background: activeConvo.confidential
                ? "rgba(108,71,255,0.3)"
                : "rgba(255,255,255,0.1)",
            }}
          >
            <span style={styles.confiLabel}>
              {activeConvo.confidential ? "🔐" : "🔓"}
            </span>
            <button
              style={{
                ...styles.toggleSwitch,
                background: activeConvo.confidential ? "#6C47FF" : "#555",
              }}
              onClick={() =>
                handleToggleConfidential(activeConvo.id, activeConvo.confidential)
              }
              title={
                activeConvo.confidential
                  ? "Disable Confidential Mode"
                  : "Enable Confidential Mode"
              }
            >
              <span
                style={{
                  ...styles.toggleThumb,
                  transform: activeConvo.confidential
                    ? "translateX(16px)"
                    : "translateX(0px)",
                }}
              />
            </button>
          </div>
        </div>

        {activeConvo.confidential && (
          <div style={styles.ndaBanner}>
            <span>
              🔐 This conversation is protected by an International NDA · ID:{" "}
              {session.cryptoId.slice(0, 16)}…
            </span>
          </div>
        )}

        <div style={styles.messageList}>
          {activeConvo.messages.length === 0 && (
            <p style={styles.emptyChat}>
              No messages yet.{" "}
              {activeConvo.confidential
                ? "NDA is active — messages are confidential."
                : "Say hello!"}
            </p>
          )}
          {activeConvo.messages.map((m) => (
            <div
              key={m.id}
              style={{
                ...styles.msgBubbleWrap,
                justifyContent: m.sender === "me" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.msgBubble,
                  background:
                    m.sender === "me"
                      ? activeConvo.confidential
                        ? "linear-gradient(135deg,#6C47FF,#8B5CF6)"
                        : "#6C47FF"
                      : activeConvo.confidential
                      ? "rgba(108,71,255,0.2)"
                      : "#2a2a3e",
                  borderBottomRightRadius: m.sender === "me" ? 4 : 16,
                  borderBottomLeftRadius: m.sender === "me" ? 16 : 4,
                  border: activeConvo.confidential
                    ? "1px solid rgba(108,71,255,0.3)"
                    : "none",
                }}
              >
                {m.confidential && (
                  <span style={styles.msgConfiIcon}>🔐 </span>
                )}
                <span style={styles.msgText}>{m.text}</span>
                <span style={styles.msgTime}>{formatTime(m.ts)}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            ...styles.inputBar,
            borderTop: activeConvo.confidential
              ? "1px solid rgba(108,71,255,0.4)"
              : "1px solid #2a2a3e",
          }}
        >
          <input
            style={{
              ...styles.msgInput,
              background: activeConvo.confidential
                ? "rgba(108,71,255,0.1)"
                : "#2a2a3e",
            }}
            placeholder={
              activeConvo.confidential
                ? "🔐 Confidential message…"
                : "Message…"
            }
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button
            style={{
              ...styles.sendBtn,
              background: activeConvo.confidential ? "#6C47FF" : "#6C47FF",
              opacity: msgInput.trim() ? 1 : 0.5,
            }}
            onClick={handleSendMessage}
            disabled={!msgInput.trim()}
          >
            ↑
          </button>
        </div>
      </div>
    );
  }

  // PROFILE SCREEN
  if (screen === "profile" && session) {
    return (
      <div style={styles.appShell}>
        <div style={styles.topBar}>
          <button style={styles.backIconBtn2} onClick={() => setScreen("home")}>
            ←
          </button>
          <h2 style={styles.topBarTitle}>Profile</h2>
          <div />
        </div>

        <div style={styles.profilePage}>
          <div style={styles.profileAvatarSection}>
            <img
              src={avatarUrl(session.avatarSeed, 96)}
              alt="avatar"
              style={styles.profileAvatar}
            />
            <button style={styles.changeAvatarBtn} onClick={handleChangeAvatar}>
              Change Avatar
            </button>
          </div>

          <div style={styles.profileCard}>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Display Name</span>
              {editingName ? (
                <div style={styles.editRow}>
                  <input
                    style={styles.editInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    autoFocus
                  />
                  <button style={styles.saveBtn} onClick={handleSaveName}>
                    Save
                  </button>
                </div>
              ) : (
                <div style={styles.editRow}>
                  <span style={styles.profileFieldValue}>
                    {session.displayName}
                  </span>
                  <button
                    style={styles.editBtn}
                    onClick={() => {
                      setEditName(session.displayName);
                      setEditingName(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Phone</span>
              <span style={styles.profileFieldValue}>{session.phone}</span>
            </div>

            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Email Backup</span>
              <span style={styles.profileFieldValue}>
                {session.email.includes("@phone.confi")
                  ? "Not set"
                  : session.email}
              </span>
            </div>

            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Member Since</span>
              <span style={styles.profileFieldValue}>
                {new Date(session.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Crypto ID / NDA binding */}
          <div style={styles.cryptoCard}>
            <div style={styles.cryptoCardHeader}>
              <span>🔐</span>
              <span style={styles.cryptoCardTitle}>Confi Cryptographic ID</span>
            </div>
            <p style={styles.cryptoCardSub}>
              This unique ID is cryptographically bound to every NDA you sign
              via Confi. It serves as your immutable digital identity for
              legally-binding confidential agreements.
            </p>
            <div style={styles.cryptoIdBox}>
              <code style={styles.cryptoIdText}>{session.cryptoId}</code>
            </div>
            <p style={styles.cryptoIdNote}>
              User ID: <code>{session.userId}</code>
            </p>
          </div>

          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  // Splash
  splash: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#0f0f1a 0%,#1a0533 50%,#0f0f1a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  splashInner: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  splashLogo: { fontSize: 64, lineHeight: 1 },
  splashTitle: {
    fontSize: 42,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-1px",
    margin: 0,
  },
  splashTagline: { color: "#a08ccc", fontSize: 16, margin: 0 },
  splashDots: { display: "flex", gap: 8, marginTop: 20 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6C47FF",
    animation: "pulse 1s infinite ease-in-out",
    display: "inline-block",
  },

  // Auth
  authScreen: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#0f0f1a 0%,#1a0533 50%,#0f0f1a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
  },
  authCard: {
    background: "#16162a",
    borderRadius: 24,
    padding: "36px 28px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    position: "relative",
  },
  authLogo: { fontSize: 42, textAlign: "center" as const },
  authTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#fff",
    textAlign: "center" as const,
    margin: 0,
  },
  authSub: {
    color: "#8888aa",
    textAlign: "center" as const,
    margin: 0,
    fontSize: 14,
  },
  phoneRow: { display: "flex", gap: 8 },
  countrySelect: {
    background: "#1e1e30",
    border: "1px solid #2a2a44",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 8px",
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
  },
  phoneInput: {
    flex: 1,
    background: "#1e1e30",
    border: "1px solid #2a2a44",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 16,
    outline: "none",
  },
  otpInput: {
    background: "#1e1e30",
    border: "2px solid #6C47FF",
    color: "#fff",
    borderRadius: 12,
    padding: "16px",
    fontSize: 32,
    outline: "none",
    textAlign: "center" as const,
    letterSpacing: 12,
    width: "100%",
    boxSizing: "border-box" as const,
  },
  textInput: {
    background: "#1e1e30",
    border: "1px solid #2a2a44",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  primaryBtn: {
    background: "linear-gradient(135deg,#6C47FF,#a78bfa)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  textBtn: {
    background: "none",
    border: "none",
    color: "#6C47FF",
    cursor: "pointer",
    fontSize: 14,
    textAlign: "center" as const,
    padding: 8,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
    margin: 0,
    textAlign: "center" as const,
  },
  legalNote: {
    color: "#555577",
    fontSize: 11,
    textAlign: "center" as const,
    margin: 0,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#8888aa",
    cursor: "pointer",
    fontSize: 14,
    textAlign: "left" as const,
    padding: 0,
  },
  devOtpBox: {
    background: "rgba(108,71,255,0.15)",
    border: "1px dashed #6C47FF",
    borderRadius: 10,
    padding: "10px 14px",
    textAlign: "center" as const,
  },
  devOtpLabel: { color: "#a08ccc", fontSize: 13, margin: 0 },
  devOtpCode: { color: "#c084fc", fontSize: 22, letterSpacing: 6 },
  avatarPreviewWrap: { display: "flex", justifyContent: "center" },
  avatarPreviewLarge: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    border: "3px solid #6C47FF",
  },
  avatarGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
  },
  avatarChoice: {
    background: "none",
    border: "2px solid transparent",
    borderRadius: "50%",
    padding: 2,
    cursor: "pointer",
  },

  // App shell
  appShell: {
    minHeight: "100vh",
    background: "#0f0f1a",
    display: "flex",
    flexDirection: "column",
    maxWidth: 520,
    margin: "0 auto",
    position: "relative",
  },
  topBar: {
    background: "#16162a",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #1e1e30",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  appName: { color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 },
  topBarRight: { display: "flex", alignItems: "center", gap: 12 },
  topBarTitle: { color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
  },
  topBarAvatar: { width: 32, height: 32, borderRadius: "50%" },
  searchBar: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    background: "#13131f",
    gap: 8,
    borderBottom: "1px solid #1e1e30",
  },
  searchIcon: { fontSize: 16, opacity: 0.5 },
  searchInput: {
    flex: 1,
    background: "#1e1e30",
    border: "none",
    color: "#888",
    borderRadius: 12,
    padding: "8px 14px",
    fontSize: 14,
    outline: "none",
  },
  convoList: {
    flex: 1,
    overflowY: "auto" as const,
    paddingBottom: 80,
  },
  convoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #1a1a2e",
    cursor: "pointer",
    width: "100%",
    textAlign: "left" as const,
  },
  convoAvatarWrap: { position: "relative", flexShrink: 0 },
  convoAvatar: { width: 48, height: 48, borderRadius: "50%" },
  confidentialBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    fontSize: 14,
    lineHeight: 1,
  },
  convoInfo: { flex: 1, minWidth: 0 },
  convoTopLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoName: {
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  convoTime: { color: "#555577", fontSize: 12, flexShrink: 0, marginLeft: 8 },
  convoBottomLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  convoLastMsg: {
    color: "#666688",
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  unreadBadge: {
    background: "#6C47FF",
    color: "#fff",
    borderRadius: "50%",
    minWidth: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 6,
    flexShrink: 0,
    padding: "0 5px",
    boxSizing: "border-box" as const,
  },
  fab: {
    position: "fixed" as const,
    bottom: 24,
    right: "calc(50% - 240px + 16px)",
    background: "linear-gradient(135deg,#6C47FF,#a78bfa)",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 56,
    height: 56,
    fontSize: 22,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(108,71,255,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },

  // Chat
  chatTopBar: {
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid #1e1e30",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  backIconBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    padding: "0 4px",
    flexShrink: 0,
  },
  backIconBtn2: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    padding: "0 4px",
    flexShrink: 0,
  },
  chatAvatar: { width: 36, height: 36, borderRadius: "50%", flexShrink: 0 },
  chatHeaderInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  chatName: {
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  chatStatus: { color: "#888aaa", fontSize: 11 },
  confiToggleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 20,
    flexShrink: 0,
  },
  confiLabel: { fontSize: 14 },
  toggleSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    position: "relative" as const,
    padding: 2,
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
  },
  toggleThumb: {
    width: 16,
    height: 16,
    background: "#fff",
    borderRadius: "50%",
    transition: "transform 0.2s",
    display: "block",
  },
  ndaBanner: {
    background: "linear-gradient(90deg,rgba(108,71,255,0.3),rgba(139,92,246,0.2))",
    borderBottom: "1px solid rgba(108,71,255,0.4)",
    padding: "6px 16px",
    fontSize: 11,
    color: "#c4b5fd",
    textAlign: "center" as const,
  },
  messageList: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingBottom: 80,
  },
  emptyChat: {
    color: "#444466",
    textAlign: "center" as const,
    fontSize: 14,
    marginTop: 40,
  },
  msgBubbleWrap: {
    display: "flex",
    width: "100%",
  },
  msgBubble: {
    maxWidth: "72%",
    padding: "10px 14px",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  msgConfiIcon: { fontSize: 11, opacity: 0.7 },
  msgText: { color: "#fff", fontSize: 14, lineHeight: 1.5 },
  msgTime: { color: "rgba(255,255,255,0.45)", fontSize: 10, alignSelf: "flex-end" as const },
  inputBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    background: "#16162a",
    position: "sticky" as const,
    bottom: 0,
  },
  msgInput: {
    flex: 1,
    border: "none",
    color: "#fff",
    borderRadius: 20,
    padding: "10px 16px",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    width: 40,
    height: 40,
    border: "none",
    borderRadius: "50%",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Profile
  profilePage: {
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto" as const,
    paddingBottom: 40,
  },
  profileAvatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    border: "3px solid #6C47FF",
  },
  changeAvatarBtn: {
    background: "rgba(108,71,255,0.15)",
    border: "1px solid rgba(108,71,255,0.4)",
    color: "#a78bfa",
    borderRadius: 12,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
  },
  profileCard: {
    background: "#16162a",
    borderRadius: 16,
    padding: "4px 0",
    overflow: "hidden",
  },
  profileField: {
    padding: "14px 18px",
    borderBottom: "1px solid #1e1e30",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  profileFieldLabel: { color: "#666688", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 1 },
  profileFieldValue: { color: "#fff", fontSize: 15 },
  editRow: { display: "flex", alignItems: "center", gap: 10 },
  editInput: {
    flex: 1,
    background: "#1e1e30",
    border: "1px solid #6C47FF",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 15,
    outline: "none",
  },
  saveBtn: {
    background: "#6C47FF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  editBtn: {
    background: "none",
    color: "#6C47FF",
    border: "none",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    marginLeft: "auto",
  },
  cryptoCard: {
    background: "linear-gradient(135deg,#1a0533,#16162a)",
    border: "1px solid rgba(108,71,255,0.4)",
    borderRadius: 16,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cryptoCardHeader: { display: "flex", alignItems: "center", gap: 8 },
  cryptoCardTitle: { color: "#c4b5fd", fontWeight: 700, fontSize: 15 },
  cryptoCardSub: { color: "#8888aa", fontSize: 12, lineHeight: 1.6, margin: 0 },
  cryptoIdBox: {
    background: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    padding: "10px 14px",
    overflow: "hidden",
  },
  cryptoIdText: {
    color: "#a78bfa",
    fontSize: 11,
    wordBreak: "break-all" as const,
    letterSpacing: 1,
    fontFamily: "monospace",
  },
  cryptoIdNote: { color: "#555577", fontSize: 11, margin: 0, fontFamily: "monospace" },
  logoutBtn: {
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.3)",
    color: "#ff6b6b",
    borderRadius: 14,
    padding: "14px",
    fontSize: 15,
    cursor: "pointer",
    fontWeight: 600,
  },

  // NDA Modal
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
    backdropFilter: "blur(4px)",
  },
  ndaModal: {
    background: "#16162a",
    borderRadius: 20,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 80px rgba(108,71,255,0.4)",
    border: "1px solid rgba(108,71,255,0.4)",
    overflow: "hidden",
  },
  ndaHeader: {
    background: "linear-gradient(135deg,#1a0533,#2d0057)",
    padding: "24px",
    textAlign: "center" as const,
    flexShrink: 0,
    borderBottom: "1px solid rgba(108,71,255,0.3)",
  },
  ndaLockIcon: { fontSize: 36, marginBottom: 8 },
  ndaTitle: { color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 4px" },
  ndaSubtitle: { color: "#a78bfa", fontSize: 14, margin: 0 },
  ndaBody: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  ndaDate: { color: "#888aaa", fontSize: 12, margin: 0 },
  ndaClause: {
    color: "#b0b0cc",
    fontSize: 12,
    lineHeight: 1.7,
    margin: 0,
  },
  cryptoCode: {
    background: "rgba(108,71,255,0.2)",
    color: "#a78bfa",
    borderRadius: 4,
    padding: "1px 5px",
    fontFamily: "monospace",
    fontSize: 11,
  },
  ndaFooter: {
    padding: "16px 24px",
    borderTop: "1px solid #1e1e30",
    background: "#13131f",
    flexShrink: 0,
  },
  ndaAckText: {
    color: "#666688",
    fontSize: 11,
    margin: "0 0 14px",
    lineHeight: 1.6,
    textAlign: "center" as const,
  },
  ndaButtons: { display: "flex", gap: 10 },
  ndaDeclineBtn: {
    flex: 1,
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.3)",
    color: "#ff6b6b",
    borderRadius: 12,
    padding: "12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  ndaAcceptBtn: {
    flex: 2,
    background: "linear-gradient(135deg,#6C47FF,#a78bfa)",
    border: "none",
    color: "#fff",
    borderRadius: 12,
    padding: "12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};