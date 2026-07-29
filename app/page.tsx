"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── types ────────────────────────────────────────────────────────────────────
interface User {
  email: string;
  legalName: string;
  phone: string;
  kycAcknowledged: boolean;
  sessionToken: string;
  createdAt: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isConfidential: boolean;
  read: boolean;
}

interface Conversation {
  id: string;
  participantName: string;
  participantEmail: string;
  participantPhone: string;
  messages: Message[];
  isConfidentialMode: boolean;
  ndaActivatedAt?: number;
  lastMessage?: string;
  lastTimestamp?: number;
  unreadCount: number;
}

type Screen =
  | "auth"
  | "otp"
  | "kyc"
  | "profile-setup"
  | "conversations"
  | "chat"
  | "profile"
  | "new-conversation";

// ── helpers ──────────────────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
};

// Mock OTP store (in real app: SMS gateway)
const otpStore: Record<string, { code: string; expires: number }> = {};

const generateOTP = (phone: string): string => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[phone] = { code, expires: Date.now() + 5 * 60 * 1000 };
  return code; // In production, send via SMS gateway
};

const verifyOTP = (phone: string, code: string): boolean => {
  const entry = otpStore[phone];
  if (!entry) return false;
  if (Date.now() > entry.expires) return false;
  return entry.code === code;
};

// Rate limiting (client-side)
const rateLimitStore: Record<string, number[]> = {};
const checkRateLimit = (key: string, maxAttempts: number, windowMs: number): boolean => {
  const now = Date.now();
  if (!rateLimitStore[key]) rateLimitStore[key] = [];
  rateLimitStore[key] = rateLimitStore[key].filter((t) => now - t < windowMs);
  if (rateLimitStore[key].length >= maxAttempts) return false;
  rateLimitStore[key].push(now);
  return true;
};

// NDA text
const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of activation 
between the participants of this confidential conversation on the Confi Messaging Platform.

1. CONFIDENTIALITY OBLIGATIONS
   All information shared within this confidential conversation session ("Confidential 
   Information") shall be kept strictly confidential. Each party agrees not to disclose, 
   reproduce, or use such information for any purpose other than the intended communication.

2. SCOPE
   This Agreement covers all messages, files, images, and any other content shared during 
   the confidential session marked herein.

3. DURATION
   These obligations survive termination of the conversation and remain in effect for a 
   period of five (5) years from the date of activation.

4. JURISDICTION
   This Agreement shall be governed by international commercial law principles and, where 
   applicable, the laws of the jurisdiction in which the disclosing party is domiciled.

5. IDENTITY BINDING
   This Agreement is legally binding upon the verified legal names of all participants 
   as registered and KYC-verified on the Confi Platform.

6. BREACH
   Any unauthorized disclosure constitutes a material breach entitling the non-breaching 
   party to seek injunctive relief and damages.

By activating Confidential Mode, both parties acknowledge and agree to all terms above.`;

// ── main component ───────────────────────────────────────────────────────────
export default function ConfiApp() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [pendingConfidentialId, setPendingConfidentialId] = useState<string | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [kycChecked, setKycChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [profileBio, setProfileBio] = useState("");

  // New conversation
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // ── init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Track page
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    // Restore session
    const saved = localStorage.getItem("confi_user");
    if (saved) {
      try {
        const u = JSON.parse(saved) as User;
        setUser(u);
        setScreen("conversations");
      } catch {
        /* ignore */
      }
    }

    // Restore conversations
    const savedConvs = localStorage.getItem("confi_conversations");
    if (savedConvs) {
      try {
        setConversations(JSON.parse(savedConvs));
      } catch {
        /* ignore */
      }
    }

    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Persist conversations
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("confi_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, conversations]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── auth ───────────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError("");
    if (!checkRateLimit("auth", 5, 60000)) {
      setAuthError("Too many attempts. Please wait 1 minute.");
      return;
    }
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }
    if (authMode === "signup" && !phone) {
      setAuthError("Phone number is required.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAuthError(data.error ?? "Authentication failed.");
        setAuthLoading(false);
        return;
      }
      if (authMode === "signup") {
        // Proceed to phone OTP
        const otp = generateOTP(phone);
        setSimulatedOtp(otp);
        setScreen("otp");
      } else {
        // Login: restore profile from localStorage or go to conversations
        const savedProfile = localStorage.getItem(`confi_profile_${email}`);
        if (savedProfile) {
          const profile = JSON.parse(savedProfile);
          const u: User = {
            email: data.email,
            legalName: profile.legalName ?? "",
            phone: profile.phone ?? "",
            kycAcknowledged: profile.kycAcknowledged ?? false,
            sessionToken: genId(),
            createdAt: profile.createdAt ?? new Date().toISOString(),
          };
          setUser(u);
          localStorage.setItem("confi_user", JSON.stringify(u));
          setScreen("conversations");
        } else {
          // New device login — need profile setup
          const u: User = {
            email: data.email,
            legalName: "",
            phone: "",
            kycAcknowledged: false,
            sessionToken: genId(),
            createdAt: new Date().toISOString(),
          };
          setUser(u);
          localStorage.setItem("confi_user", JSON.stringify(u));
          setScreen("profile-setup");
        }
      }
    } catch {
      setAuthError("Network error. Please try again.");
    }
    setAuthLoading(false);
  };

  const handleOtpVerify = () => {
    setAuthError("");
    if (!checkRateLimit("otp", 3, 60000)) {
      setAuthError("Too many OTP attempts.");
      return;
    }
    const valid = verifyOTP(phone, otpCode);
    if (!valid) {
      setAuthError("Invalid or expired OTP. Code: " + simulatedOtp + " (demo)");
      return;
    }
    setScreen("kyc");
  };

  const handleKycSubmit = () => {
    if (!kycChecked) {
      setAuthError("You must acknowledge your real identity to continue.");
      return;
    }
    if (!legalName.trim()) {
      setAuthError("Legal name is required for NDA binding.");
      return;
    }
    setScreen("profile-setup");
  };

  const handleProfileSetup = () => {
    if (!legalName.trim()) {
      setAuthError("Legal name is required.");
      return;
    }
    const u: User = {
      email,
      legalName: legalName.trim(),
      phone,
      kycAcknowledged: kycChecked,
      sessionToken: genId(),
      createdAt: new Date().toISOString(),
    };
    setUser(u);
    localStorage.setItem("confi_user", JSON.stringify(u));
    localStorage.setItem(
      `confi_profile_${email}`,
      JSON.stringify({
        legalName: u.legalName,
        phone: u.phone,
        kycAcknowledged: u.kycAcknowledged,
        createdAt: u.createdAt,
        bio: profileBio,
      })
    );

    // Seed demo conversations
    const demo: Conversation[] = [
      {
        id: genId(),
        participantName: "Alice Chen",
        participantEmail: "alice@example.com",
        participantPhone: "+1-555-0101",
        messages: [
          {
            id: genId(),
            senderId: "alice@example.com",
            text: "Hey! Welcome to Confi 🎉",
            timestamp: Date.now() - 3600000,
            isConfidential: false,
            read: true,
          },
          {
            id: genId(),
            senderId: "alice@example.com",
            text: "Try enabling Confidential Mode for sensitive discussions.",
            timestamp: Date.now() - 3500000,
            isConfidential: false,
            read: false,
          },
        ],
        isConfidentialMode: false,
        lastMessage: "Try enabling Confidential Mode for sensitive discussions.",
        lastTimestamp: Date.now() - 3500000,
        unreadCount: 1,
      },
      {
        id: genId(),
        participantName: "Bob Martinez",
        participantEmail: "bob@example.com",
        participantPhone: "+1-555-0202",
        messages: [
          {
            id: genId(),
            senderId: "bob@example.com",
            text: "Can we discuss the contract details?",
            timestamp: Date.now() - 86400000,
            isConfidential: true,
            read: true,
          },
        ],
        isConfidentialMode: true,
        ndaActivatedAt: Date.now() - 86400000,
        lastMessage: "🔒 Can we discuss the contract details?",
        lastTimestamp: Date.now() - 86400000,
        unreadCount: 0,
      },
    ];
    setConversations(demo);
    localStorage.setItem("confi_conversations", JSON.stringify(demo));
    setScreen("conversations");
  };

  const handleLogout = () => {
    localStorage.removeItem("confi_user");
    setUser(null);
    setConversations([]);
    setActiveConvId(null);
    setScreen("auth");
    setEmail("");
    setPassword("");
    setPhone("");
    setLegalName("");
    setOtpCode("");
    setKycChecked(false);
  };

  // ── messaging ──────────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!messageInput.trim() || !activeConvId || !user) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;

    const msg: Message = {
      id: genId(),
      senderId: user.email,
      text: messageInput.trim(),
      timestamp: Date.now(),
      isConfidential: conv.isConfidentialMode,
      read: false,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              messages: [...c.messages, msg],
              lastMessage: conv.isConfidentialMode ? "🔒 " + msg.text : msg.text,
              lastTimestamp: msg.timestamp,
            }
          : c
      )
    );
    setMessageInput("");

    // Simulate reply after 2s
    setTimeout(() => {
      const replies = [
        "Got it, thanks!",
        "Understood.",
        "I'll look into that.",
        "Can you share more details?",
        "Agreed.",
      ];
      const reply: Message = {
        id: genId(),
        senderId: conv.participantEmail,
        text: replies[Math.floor(Math.random() * replies.length)],
        timestamp: Date.now(),
        isConfidential: conv.isConfidentialMode,
        read: false,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? {
                ...c,
                messages: [...c.messages, reply],
                lastMessage: conv.isConfidentialMode ? "🔒 " + reply.text : reply.text,
                lastTimestamp: reply.timestamp,
                unreadCount: c.unreadCount + 1,
              }
            : c
        )
      );
    }, 2000);
  };

  const toggleConfidentialMode = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    if (!conv.isConfidentialMode) {
      // Activating — show NDA
      setPendingConfidentialId(convId);
      setShowNdaModal(true);
    } else {
      // Deactivating
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, isConfidentialMode: false, ndaActivatedAt: undefined } : c
        )
      );
    }
  };

  const activateNda = () => {
    if (!pendingConfidentialId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === pendingConfidentialId
          ? { ...c, isConfidentialMode: true, ndaActivatedAt: Date.now() }
          : c
      )
    );
    setShowNdaModal(false);
    setPendingConfidentialId(null);
  };

  const openConversation = (convId: string) => {
    setActiveConvId(convId);
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
    setScreen("chat");
  };

  const createConversation = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const conv: Conversation = {
      id: genId(),
      participantName: newName.trim(),
      participantEmail: newEmail.trim(),
      participantPhone: "",
      messages: [],
      isConfidentialMode: false,
      lastMessage: "No messages yet",
      lastTimestamp: Date.now(),
      unreadCount: 0,
    };
    const updated = [conv, ...conversations];
    setConversations(updated);
    setNewName("");
    setNewEmail("");
    setActiveConvId(conv.id);
    setScreen("chat");
  };

  // ── styles ─────────────────────────────────────────────────────────────────
  const S = {
    app: {
      width: "100%",
      height: "100vh",
      display: "flex",
      flexDirection: "column" as const,
      background: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden",
      position: "relative" as const,
    },
    // Auth
    authWrap: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0f1a 100%)",
      padding: "20px",
    },
    authCard: {
      width: "100%",
      maxWidth: "420px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "20px",
      padding: "40px 36px",
      backdropFilter: "blur(20px)",
    },
    logo: {
      textAlign: "center" as const,
      marginBottom: "32px",
    },
    logoIcon: {
      fontSize: "48px",
      marginBottom: "8px",
      display: "block",
    },
    logoText: {
      fontSize: "28px",
      fontWeight: 700,
      background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "-0.5px",
    },
    logoSub: {
      fontSize: "13px",
      color: "#888",
      marginTop: "4px",
    },
    tabRow: {
      display: "flex",
      marginBottom: "24px",
      background: "rgba(255,255,255,0.05)",
      borderRadius: "10px",
      padding: "4px",
    },
    tab: (active: boolean) => ({
      flex: 1,
      padding: "9px",
      borderRadius: "7px",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
      transition: "all 0.2s",
      background: active ? "rgba(124,106,247,0.3)" : "transparent",
      color: active ? "#a78bfa" : "#888",
    }),
    label: {
      display: "block",
      fontSize: "12px",
      color: "#888",
      marginBottom: "6px",
      fontWeight: 500,
      letterSpacing: "0.5px",
      textTransform: "uppercase" as const,
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#e8e8f0",
      fontSize: "15px",
      outline: "none",
      marginBottom: "16px",
      boxSizing: "border-box" as const,
      transition: "border-color 0.2s",
    },
    textarea: {
      width: "100%",
      padding: "12px 14px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#e8e8f0",
      fontSize: "15px",
      outline: "none",
      marginBottom: "16px",
      boxSizing: "border-box" as const,
      resize: "none" as const,
      minHeight: "80px",
      fontFamily: "inherit",
    },
    btn: {
      width: "100%",
      padding: "13px",
      background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
      border: "none",
      borderRadius: "10px",
      color: "#fff",
      fontSize: "15px",
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s",
      marginTop: "4px",
    },
    btnSecondary: {
      width: "100%",
      padding: "12px",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "10px",
      color: "#c8c8d8",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      marginTop: "10px",
    },
    error: {
      background: "rgba(239,68,68,0.1)",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#f87171",
      fontSize: "13px",
      marginBottom: "16px",
    },
    success: {
      background: "rgba(34,197,94,0.1)",
      border: "1px solid rgba(34,197,94,0.3)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#4ade80",
      fontSize: "13px",
      marginBottom: "16px",
    },
    kycBox: {
      background: "rgba(124,106,247,0.08)",
      border: "1px solid rgba(124,106,247,0.2)",
      borderRadius: "12px",
      padding: "16px",
      marginBottom: "20px",
    },
    checkRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      marginTop: "8px",
    },
    // Conversations
    layout: {
      flex: 1,
      display: "flex",
      overflow: "hidden",
    },
    sidebar: {
      width: isMobile ? "100%" : "360px",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      flexDirection: "column" as const,
      background: "#0d0d14",
      flexShrink: 0,
    },
    sidebarHidden: {
      display: isMobile && screen === "chat" ? "none" : "flex",
      flexDirection: "column" as const,
    },
    chatArea: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      background: "#0a0a0f",
    },
    chatAreaHidden: {
      display: isMobile && screen !== "chat" ? "none" : "flex",
      flex: 1,
      flexDirection: "column" as const,
    },
    topBar: {
      padding: "16px 20px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#0d0d14",
    },
    avatar: (size: number, color?: string) => ({
      width: size,
      height: size,
      borderRadius: "50%",
      background: color ?? "linear-gradient(135deg, #7c6af7, #a78bfa)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.38,
      fontWeight: 700,
      color: "#fff",
      flexShrink: 0,
    }),
    convItem: (active: boolean) => ({
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "14px 18px",
      cursor: "pointer",
      background: active ? "rgba(124,106,247,0.1)" : "transparent",
      borderLeft: active ? "3px solid #7c6af7" : "3px solid transparent",
      transition: "background 0.15s",
    }),
    convContent: {
      flex: 1,
      minWidth: 0,
    },
    convName: {
      fontSize: "15px",
      fontWeight: 600,
      color: "#e8e8f0",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    convLast: {
      fontSize: "13px",
      color: "#666",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
      marginTop: "2px",
    },
    badge: {
      background: "#7c6af7",
      color: "#fff",
      borderRadius: "10px",
      padding: "2px 7px",
      fontSize: "11px",
      fontWeight: 700,
      minWidth: "18px",
      textAlign: "center" as const,
    },
    msgWrap: (mine: boolean) => ({
      display: "flex",
      justifyContent: mine ? "flex-end" : "flex-start",
      marginBottom: "6px",
      padding: "0 16px",
    }),
    msgBubble: (mine: boolean, confidential: boolean) => ({
      maxWidth: "72%",
      padding: "10px 14px",
      borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
      background: mine
        ? confidential
          ? "linear-gradient(135deg, #4c1d95, #6d28d9)"
          : "linear-gradient(135deg, #7c6af7, #6366f1)"
        : confidential
        ? "rgba(109,40,217,0.2)"
        : "rgba(255,255,255,0.08)",
      border: confidential ? "1px solid rgba(124,106,247,0.3)" : "none",
      fontSize: "14px",
      lineHeight: 1.5,
      wordBreak: "break-word" as const,
    }),
    msgMeta: {
      fontSize: "11px",
      color: "rgba(255,255,255,0.4)",
      marginTop: "4px",
      textAlign: "right" as const,
    },
    inputRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "14px 16px",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      background: "#0d0d14",
    },
    msgInput: {
      flex: 1,
      padding: "11px 16px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "24px",
      color: "#e8e8f0",
      fontSize: "14px",
      outline: "none",
      fontFamily: "inherit",
    },
    sendBtn: {
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      flexShrink: 0,
    },
    iconBtn: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "#888",
      fontSize: "20px",
      padding: "6px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    confidentialBanner: {
      background: "linear-gradient(135deg, rgba(76,29,149,0.4), rgba(109,40,217,0.2))",
      border: "1px solid rgba(124,106,247,0.3)",
      borderRadius: "12px",
      padding: "12px 16px",
      margin: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "13px",
      color: "#c4b5fd",
    },
    modal: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    },
    modalCard: {
      background: "#13131f",
      border: "1px solid rgba(124,106,247,0.3)",
      borderRadius: "20px",
      padding: "28px",
      maxWidth: "520px",
      width: "100%",
      maxHeight: "80vh",
      overflow: "auto",
    },
    ndaText: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      padding: "16px",
      fontSize: "12px",
      lineHeight: 1.7,
      color: "#aaa",
      maxHeight: "240px",
      overflow: "auto",
      marginBottom: "20px",
      fontFamily: "monospace",
      whiteSpace: "pre-wrap" as const,
    },
    // Profile screen
    profileWrap: {
      flex: 1,
      overflow: "auto",
      padding: "24px",
    },
    profileCard: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "16px",
    },
    tag: (color: string) => ({
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "20px",
      background: color,
      fontSize: "12px",
      fontWeight: 600,
    }),
    navBar: {
      display: "flex",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      background: "#0d0d14",
    },
    navItem: (active: boolean) => ({
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 8px",
      cursor: "pointer",
      color: active ? "#a78bfa" : "#555",
      fontSize: "10px",
      fontWeight: 500,
      gap: "4px",
      background: "transparent",
      border: "none",
    }),
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // ── NDA Modal ──────────────────────────────────────────────────────────────
  const NdaModal = () => (
    <div style={S.modal} onClick={() => setShowNdaModal(false)}>
      <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700 }}>
          Activate Confidential Mode
        </h2>
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "20px", margin: "0 0 16px" }}>
          By activating, you enter into a legally binding International NDA with{" "}
          <strong style={{ color: "#a78bfa" }}>
            {conversations.find((c) => c.id === pendingConfidentialId)?.participantName}
          </strong>
          . Signed as:{" "}
          <strong style={{ color: "#e8e8f0" }}>{user?.legalName}</strong>
        </p>
        <div style={S.ndaText}>{NDA_TEXT}</div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap" as const,
          }}
        >
          <button
            style={{ ...S.btn, flex: 1, marginTop: 0 }}
            onClick={activateNda}
          >
            ✅ I Agree — Activate NDA
          </button>
          <button
            style={{ ...S.btnSecondary, flex: 1, marginTop: 0 }}
            onClick={() => {
              setShowNdaModal(false);
              setPendingConfidentialId(null);
            }}
          >
            Cancel
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "#555", marginTop: "12px", textAlign: "center" }}>
          Legal name on record: {user?.legalName} · KYC Verified ·{" "}
          {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  // ── Render: Auth ───────────────────────────────────────────────────────────
  if (screen === "auth") {
    return (
      <div style={S.app}>
        <div style={S.authWrap}>
          <div style={S.authCard}>
            <div style={S.logo}>
              <span style={S.logoIcon}>🔐</span>
              <div style={S.logoText}>Confi</div>
              <div style={S.logoSub}>Confidential Messaging Platform</div>
            </div>
            <div style={S.tabRow}>
              <button style={S.tab(authMode === "login")} onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                Login
              </button>
              <button style={S.tab(authMode === "signup")} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                Sign Up
              </button>
            </div>
            {authError && <div style={S.error}>⚠️ {authError}</div>}
            <label style={S.label}>Email Address</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            />
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            />
            {authMode === "signup" && (
              <>
                <label style={S.label}>Phone Number</label>
                <input
                  style={S.input}
                  type="tel"
                  placeholder="+1-555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </>
            )}
            <button
              style={{ ...S.btn, opacity: authLoading ? 0.6 : 1 }}
              onClick={handleAuth}
              disabled={authLoading}
            >
              {authLoading ? "Please wait…" : authMode === "login" ? "Login" : "Create Account"}
            </button>
            {authMode === "login" && (
              <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "#555" }}>
                Use email backup if phone unavailable
              </div>
            )}
            <div
              style={{
                marginTop: "24px",
                padding: "12px",
                background: "rgba(124,106,247,0.06)",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
              }}
            >
              🛡️ GDPR compliant · Minimal PII · End-to-end encrypted metadata
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: OTP ────────────────────────────────────────────────────────────
  if (screen === "otp") {
    return (
      <div style={S.app}>
        <div style={S.authWrap}>
          <div style={S.authCard}>
            <div style={S.logo}>
              <span style={S.logoIcon}>📱</span>
              <div style={S.logoText}>Verify Phone</div>
              <div style={S.logoSub}>SMS OTP Verification</div>
            </div>
            {authError && <div style={S.error}>⚠️ {authError}</div>}
            <div style={S.success}>
              📨 OTP sent to {phone}
              <br />
              <strong>Demo code: {simulatedOtp}</strong> (shown for demo only)
            </div>
            <label style={S.label}>Enter 6-Digit OTP</label>
            <input
              style={{ ...S.input, textAlign: "center", fontSize: "24px", letterSpacing: "8px" }}
              type="text"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            />
            <button style={S.btn} onClick={handleOtpVerify}>
              Verify OTP
            </button>
            <button
              style={S.btnSecondary}
              onClick={() => {
                const otp = generateOTP(phone);
                setSimulatedOtp(otp);
                setAuthError("");
              }}
            >
              Resend OTP
            </button>
            <button style={{ ...S.btnSecondary, marginTop: "6px" }} onClick={() => setScreen("auth")}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: KYC ────────────────────────────────────────────────────────────
  if (screen === "kyc") {
    return (
      <div style={S.app}>
        <div style={S.authWrap}>
          <div style={S.authCard}>
            <div style={S.logo}>
              <span style={S.logoIcon}>🪪</span>
              <div style={S.logoText}>Identity Verification</div>
              <div style={S.logoSub}>KYC for NDA Binding</div>
            </div>
            {authError && <div style={S.error}>⚠️ {authError}</div>}
            <div style={S.kycBox}>
              <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#c4b5fd", fontWeight: 600 }}>
                ⚖️ Why we need this
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#888", lineHeight: 1.6 }}>
                Confi's Confidential Mode activates a real International NDA. For this to be
                legally enforceable, your identity must be verified. Your legal name will be used
                to bind NDA agreements.
              </p>
            </div>
            <label style={S.label}>Legal Full Name (as on government ID)</label>
            <input
              style={S.input}
              type="text"
              placeholder="First Middle Last"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <div style={S.checkRow}>
              <input
                type="checkbox"
                id="kyc"
                checked={kycChecked}
                onChange={(e) => setKycChecked(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#7c6af7", flexShrink: 0, marginTop: "2px" }}
              />
              <label htmlFor="kyc" style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.5, cursor: "pointer" }}>
                I confirm that the information provided is accurate and represents my real legal
                identity. I understand this information may be used to enforce NDA agreements
                entered through the Confi platform. I consent to minimal PII storage in accordance
                with GDPR.
              </label>
            </div>
            <button style={{ ...S.btn, marginTop: "20px" }} onClick={handleKycSubmit}>
              Confirm Identity & Continue
            </button>
            <p style={{ fontSize: "11px", color: "#444", textAlign: "center", marginTop: "16px" }}>
              🔒 Your data is encrypted at rest · Minimal PII policy · Right to erasure available
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Profile Setup ──────────────────────────────────────────────────
  if (screen === "profile-setup") {
    return (
      <div style={S.app}>
        <div style={S.authWrap}>
          <div style={S.authCard}>
            <div style={S.logo}>
              <span style={S.logoIcon}>👤</span>
              <div style={S.logoText}>Setup Profile</div>
              <div style={S.logoSub}>You&apos;re almost in</div>
            </div>
            {authError && <div style={S.error}>⚠️ {authError}</div>}
            <label style={S.label}>Legal Name (required for NDA)</label>
            <input
              style={S.input}
              type="text"
              placeholder="Your legal full name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <label style={S.label}>Bio (optional)</label>
            <textarea
              style={S.textarea}
              placeholder="Tell people about yourself…"
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
            />
            <button style={S.btn} onClick={handleProfileSetup}>
              Enter Confi 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Profile Screen ─────────────────────────────────────────────────
  if (screen === "profile" && user) {
    return (
      <div style={S.app}>
        {showNdaModal && <NdaModal />}
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen("conversations")}>
            ←
          </button>
          <span style={{ fontWeight: 700, fontSize: "17px" }}>My Profile</span>
          <button style={{ ...S.iconBtn, color: "#f87171" }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
        <div style={S.profileWrap}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "24px 0",
              gap: "12px",
            }}
          >
            <div style={S.avatar(80)}>
              {initials(user.legalName || user.email)}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700 }}>{user.legalName || "Unknown"}</div>
            <div style={{ color: "#888", fontSize: "14px" }}>{user.email}</div>
            {user.kycAcknowledged && (
              <span style={S.tag("rgba(34,197,94,0.15)")}>
                <span style={{ color: "#4ade80" }}>✓ KYC Verified</span>
              </span>
            )}
          </div>

          <div style={S.profileCard}>
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>
              Account Details
            </h3>
            {[
              { label: "Legal Name", value: user.legalName },
              { label: "Email", value: user.email },
              { label: "Phone", value: user.phone || "Not set" },
              { label: "Member Since", value: new Date(user.createdAt).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ color: "#888", fontSize: "14px" }}>{label}</span>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={S.profileCard}>
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>
              Privacy & Legal
            </h3>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: 1.7 }}>
              <p style={{ margin: "0 0 10px" }}>
                🛡️ <strong style={{ color: "#aaa" }}>GDPR Compliant:</strong> We store only your
                email, hashed password, legal name, and phone number. You have the right to
                erasure.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                🔒 <strong style={{ color: "#aaa" }}>NDA Binding:</strong> Your legal name "
                <em style={{ color: "#c4b5fd" }}>{user.legalName}</em>" is used to legally bind
                Confidential Mode agreements.
              </p>
              <p style={{ margin: 0 }}>
                ⚖️ <strong style={{ color: "#aaa" }}>Data Retention:</strong> Minimal PII, no
                third-party sharing, encrypted at rest.
              </p>
            </div>
          </div>

          <button
            style={{ ...S.btn, marginTop: "8px", background: "rgba(239,68,68,0.15)", color: "#f87171" }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Render: New Conversation ───────────────────────────────────────────────
  if (screen === "new-conversation") {
    return (
      <div style={S.app}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen("conversations")}>
            ←
          </button>
          <span style={{ fontWeight: 700, fontSize: "17px" }}>New Conversation</span>
          <div />
        </div>
        <div style={S.profileWrap}>
          <label style={S.label}>Contact Name</label>
          <input
            style={S.input}
            type="text"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <label style={S.label}>Contact Email</label>
          <input
            style={S.input}
            type="email"
            placeholder="contact@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button
            style={{ ...S.btn, opacity: !newName.trim() || !newEmail.trim() ? 0.5 : 1 }}
            onClick={createConversation}
            disabled={!newName.trim() || !newEmail.trim()}
          >
            Start Conversation
          </button>
          <button style={S.btnSecondary} onClick={() => setScreen("conversations")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Main App (Conversations + Chat) ────────────────────────────────
  if (!user) return null;

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div style={S.app}>
      {showNdaModal && <NdaModal />}

      {/* Header */}
      <div style={S.topBar}>
        {screen === "chat" && isMobile ? (
          <>
            <button style={S.iconBtn} onClick={() => setScreen("conversations")}>
              ←
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={S.avatar(36)}>
                {initials(activeConv?.participantName ?? "?")}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>
                  {activeConv?.participantName}
                </div>
                {activeConv?.isConfidentialMode && (
                  <div style={{ fontSize: "11px", color: "#a78bfa" }}>🔒 Confidential</div>
                )}
              </div>
            </div>
            <button
              style={{
                ...S.iconBtn,
                color: activeConv?.isConfidentialMode ? "#a78bfa" : "#555",
                fontSize: "22px",
              }}
              onClick={() => activeConvId && toggleConfidentialMode(activeConvId)}
            >
              🔒
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🔐</span>
              <span style={{ fontWeight: 800, fontSize: "18px", background: "linear-gradient(135deg, #7c6af7, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Confi
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {totalUnread > 0 && (
                <span style={{ ...S.badge, fontSize: "12px", padding: "4px 10px" }}>
                  {totalUnread}
                </span>
              )}
              <button style={S.iconBtn} onClick={() => setScreen("new-conversation")} title="New Chat">
                ✏️
              </button>
              <button style={S.iconBtn} onClick={() => setScreen("profile")} title="Profile">
                👤
              </button>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div style={S.layout}>
        {/* Sidebar */}
        <div
          style={{
            ...S.sidebar,
            display: isMobile && screen === "chat" ? "none" : "flex",
            flexDirection: "column",
          }}
        >
          {/* Search bar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <input
              style={{
                ...S.msgInput,
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)",
              }}
              placeholder="🔍 Search conversations…"
            />
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {conversations.length === 0 && (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#444",
                  fontSize: "14px",
                }}
              >
                No conversations yet.
                <br />
                <button
                  style={{ ...S.btn, marginTop: "16px", width: "auto", padding: "10px 20px" }}
                  onClick={() => setScreen("new-conversation")}
                >
                  Start one ✏️
                </button>
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                style={S.convItem(conv.id === activeConvId)}
                onClick={() => openConversation(conv.id)}
              >
                <div style={{ position: "relative" }}>
                  <div style={S.avatar(46)}>
                    {initials(conv.participantName)}
                  </div>
                  {conv.isConfidentialMode && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        fontSize: "14px",
                        lineHeight: 1,
                      }}
                    >
                      🔒
                    </div>
                  )}
                </div>
                <div style={S.convContent}>
                  <div style={S.convName}>
                    {conv.participantName}
                    {conv.isConfidentialMode && (
                      <span style={{ fontSize: "11px", color: "#7c6af7", fontWeight: 500 }}>
                        NDA
                      </span>
                    )}
                  </div>
                  <div style={S.convLast}>{conv.lastMessage ?? "No messages"}</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  {conv.lastTimestamp && (
                    <span style={{ fontSize: "11px", color: "#444" }}>
                      {formatTime(conv.lastTimestamp)}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span style={S.badge}>{conv.unreadCount}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div
          style={{
            display: isMobile && screen !== "chat" ? "none" : "flex",
            flex: 1,
            flexDirection: "column",
            background: "#0a0a0f",
          }}
        >
          {!activeConv ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                color: "#444",
              }}
            >
              <div style={{ fontSize: "64px" }}>🔐</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#555" }}>
                Select a conversation
              </div>
              <div style={{ fontSize: "14px", color: "#333" }}>
                Or start a new confidential chat
              </div>
              <button
                style={{ ...S.btn, width: "auto", padding: "11px 24px" }}
                onClick={() => setScreen("new-conversation")}
              >
                New Conversation ✏️
              </button>
            </div>
          ) : (
            <>
              {/* Chat header (desktop) */}
              {!isMobile && (
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#0d0d14",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={S.avatar(40)}>{initials(activeConv.participantName)}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "16px" }}>
                        {activeConv.participantName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#555" }}>
                        {activeConv.participantEmail}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {activeConv.isConfidentialMode && (
                      <span style={{ fontSize: "12px", color: "#a78bfa", background: "rgba(124,106,247,0.1)", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(124,106,247,0.2)" }}>
                        🔒 NDA Active
                      </span>
                    )}
                    <button
                      style={{
                        ...S.iconBtn,
                        padding: "8px 14px",
                        border: "1px solid",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        borderColor: activeConv.isConfidentialMode
                          ? "rgba(124,106,247,0.4)"
                          : "rgba(255,255,255,0.1)",
                        color: activeConv.isConfidentialMode ? "#a78bfa" : "#888",
                        background: activeConv.isConfidentialMode
                          ? "rgba(124,106,247,0.1)"
                          : "transparent",
                      }}
                      onClick={() => toggleConfidentialMode(activeConv.id)}
                    >
                      {activeConv.isConfidentialMode ? "🔒 Confidential ON" : "🔓 Confidential OFF"}
                    </button>
                  </div>
                </div>
              )}

              {/* Confidential banner */}
              {activeConv.isConfidentialMode && (
                <div style={S.confidentialBanner}>
                  <span style={{ fontSize: "20px" }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                      Confidential Mode Active — NDA Enforced
                    </div>
                    <div style={{ fontSize: "12px", color: "#9d8fd8" }}>
                      This conversation is covered by an International NDA activated on{" "}
                      {activeConv.ndaActivatedAt
                        ? new Date(activeConv.ndaActivatedAt).toLocaleString()
                        : "—"}
                      . Signed:{" "}
                      <strong style={{ color: "#c4b5fd" }}>{user.legalName}</strong> ↔{" "}
                      <strong style={{ color: "#c4b5fd" }}>{activeConv.participantName}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
                {activeConv.messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#444", padding: "40px 20px", fontSize: "14px" }}>
                    No messages yet. Say hello! 👋
                  </div>
                )}
                {activeConv.messages.map((msg, i) => {
                  const mine = msg.senderId === user.email;
                  const showDate =
                    i === 0 ||
                    formatDate(msg.timestamp) !==
                      formatDate(activeConv.messages[i - 1].timestamp);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: "12px",
                            color: "#444",
                            padding: "8px 0",
                          }}
                        >
                          {formatDate(msg.timestamp)}
                        </div>
                      )}
                      <div style={S.msgWrap(mine)}>
                        <div>
                          <div style={S.msgBubble(mine, msg.isConfidential)}>
                            {msg.isConfidential && (
                              <span style={{ fontSize: "10px", opacity: 0.6, display: "block", marginBottom: "4px" }}>
                                🔒 confidential
                              </span>
                            )}
                            {msg.text}
                          </div>
                          <div style={S.msgMeta}>
                            {formatTime(msg.timestamp)} {mine && "✓"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={S.inputRow}>
                <input
                  style={S.msgInput}
                  placeholder={
                    activeConv.isConfidentialMode
                      ? "🔒 Send confidential message…"
                      : "Type a message…"
                  }
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button style={S.sendBtn} onClick={sendMessage}>
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      {isMobile && screen !== "chat" && (
        <div style={S.navBar}>
          <button style={S.navItem(screen === "conversations")} onClick={() => setScreen("conversations")}>
            <span style={{ fontSize: "22px" }}>💬</span>
            Chats
          </button>
          <button style={S.navItem(false)} onClick={() => setScreen("new-conversation")}>
            <span style={{ fontSize: "22px" }}>✏️</span>
            New
          </button>
          <button style={S.navItem(screen === "profile")} onClick={() => setScreen("profile")}>
            <span style={{ fontSize: "22px" }}>👤</span>
            Profile
          </button>
        </div>
      )}
    </div>
  );
}