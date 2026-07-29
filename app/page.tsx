"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  phone: string;
  displayName: string;
  avatar: string;
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
  participantPhone: string;
  participantName: string;
  participantAvatar: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaAccepted: boolean;
  ndaAcceptedAt?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "#6C63FF", "#FF6584", "#43AA8B", "#F9C74F",
  "#577590", "#F3722C", "#90BE6D", "#277DA1",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── NDA Text ─────────────────────────────────────────────────────────────────

const NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

Effective upon acceptance, this Non-Disclosure Agreement ("Agreement") is entered into between all parties participating in this conversation ("Disclosing Party" and "Receiving Party", collectively "Parties") facilitated through Confi Messaging Application ("Platform").

1. CONFIDENTIAL INFORMATION
All information exchanged within this Confidential Session, including but not limited to text, media, ideas, business strategies, personal data, financial information, technical data, and any other communication, shall be deemed "Confidential Information" under this Agreement.

2. OBLIGATIONS
Each Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for the purposes of this conversation; (d) protect Confidential Information with at least the same degree of care used for their own confidential information, but no less than reasonable care.

3. INTERNATIONAL JURISDICTION
This Agreement shall be governed by and construed in accordance with the principles of international commercial law, including but not limited to the UNCITRAL Model Law, the Hague Convention on Choice of Court Agreements, and applicable national laws of the respective jurisdictions of the Parties. Any disputes shall be resolved through binding international arbitration under ICC Rules.

4. DURATION
The obligations of confidentiality shall survive the termination of this conversation and shall remain in effect for a period of five (5) years from the date of acceptance, or as otherwise required by applicable law.

5. REMEDIES
The Parties acknowledge that any breach of this Agreement may cause irreparable harm for which monetary damages would be inadequate, and that injunctive relief and other equitable remedies may be sought in any court of competent jurisdiction worldwide.

6. ELECTRONIC ACCEPTANCE
By clicking "I Accept & Activate Confidential Mode" below, each Party expressly acknowledges reading, understanding, and agreeing to be legally bound by the terms of this Agreement. Electronic acceptance constitutes a valid and binding signature under the UNCITRAL Model Law on Electronic Commerce and equivalent national legislation.

Platform: Confi Messaging Application
Agreement Reference: CONFI-NDA-INTL-2024`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfiApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [view, setView] = useState<"setup" | "chat">("setup");
  const [showNDA, setShowNDA] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [ndaConvTarget, setNdaConvTarget] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Setup form state
  const [setupPhone, setSetupPhone] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupError, setSetupError] = useState("");

  // New chat form
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatError, setNewChatError] = useState("");

  // ── Load from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("confi_account");
      if (saved) {
        setAccount(JSON.parse(saved));
        setView("chat");
      }
      const savedConvs = localStorage.getItem("confi_conversations");
      if (savedConvs) setConversations(JSON.parse(savedConvs));
    } catch {
      // ignore
    }
  }, []);

  // ── Track page ──
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // ── Persist conversations ──
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("confi_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, conversations]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Setup ──
  function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError("");
    const phone = setupPhone.replace(/\D/g, "");
    if (phone.length < 7 || phone.length > 15) {
      setSetupError("Please enter a valid phone number (7–15 digits).");
      return;
    }
    if (!setupName.trim()) {
      setSetupError("Display name is required.");
      return;
    }
    const acc: Account = {
      phone,
      displayName: setupName.trim(),
      avatar: avatarColor(setupName.trim()),
    };
    setAccount(acc);
    localStorage.setItem("confi_account", JSON.stringify(acc));
    setView("chat");
  }

  // ── New Chat ──
  function handleNewChat(e: React.FormEvent) {
    e.preventDefault();
    setNewChatError("");
    const phone = newChatPhone.replace(/\D/g, "");
    if (phone.length < 7 || phone.length > 15) {
      setNewChatError("Please enter a valid phone number.");
      return;
    }
    if (!newChatName.trim()) {
      setNewChatError("Contact name is required.");
      return;
    }
    if (phone === account?.phone) {
      setNewChatError("You can't chat with yourself.");
      return;
    }
    const existing = conversations.find((c) => c.participantPhone === phone);
    if (existing) {
      setActiveConvId(existing.id);
      setShowNewChat(false);
      setNewChatPhone("");
      setNewChatName("");
      return;
    }
    const conv: Conversation = {
      id: genId(),
      participantPhone: phone,
      participantName: newChatName.trim(),
      participantAvatar: avatarColor(newChatName.trim()),
      messages: [],
      confidentialMode: false,
      ndaAccepted: false,
    };
    setConversations((prev) => {
      const updated = [conv, ...prev];
      localStorage.setItem("confi_conversations", JSON.stringify(updated));
      return updated;
    });
    setActiveConvId(conv.id);
    setShowNewChat(false);
    setNewChatPhone("");
    setNewChatName("");
  }

  // ── Send Message ──
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !activeConvId || !account) return;
    const msg: Message = {
      id: genId(),
      senderId: account.phone,
      text: messageInput.trim(),
      timestamp: Date.now(),
      confidential: activeConv?.confidentialMode ?? false,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId ? { ...c, messages: [...c.messages, msg] } : c
      )
    );
    setMessageInput("");
  }

  // ── Toggle Confidential ──
  function handleToggleConfidential(convId: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    if (!conv.confidentialMode) {
      // turning ON → show NDA if not yet accepted
      if (!conv.ndaAccepted) {
        setNdaConvTarget(convId);
        setShowNDA(true);
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, confidentialMode: true } : c))
        );
      }
    } else {
      // turning OFF
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, confidentialMode: false } : c))
      );
    }
  }

  // ── Accept NDA ──
  function handleAcceptNDA() {
    if (!ndaConvTarget) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === ndaConvTarget
          ? { ...c, confidentialMode: true, ndaAccepted: true, ndaAcceptedAt: Date.now() }
          : c
      )
    );
    setShowNDA(false);
    setNdaConvTarget(null);
  }

  function handleDeclineNDA() {
    setShowNDA(false);
    setNdaConvTarget(null);
  }

  // ── Logout ──
  function handleLogout() {
    localStorage.removeItem("confi_account");
    localStorage.removeItem("confi_conversations");
    setAccount(null);
    setConversations([]);
    setActiveConvId(null);
    setView("setup");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Setup Screen
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === "setup") {
    return (
      <div style={styles.setupBg}>
        <div style={styles.setupCard}>
          <div style={styles.setupLogo}>
            <span style={styles.setupLogoIcon}>🔒</span>
            <span style={styles.setupLogoText}>Confi</span>
          </div>
          <p style={styles.setupSubtitle}>Secure messaging with confidentiality built in.</p>
          <form onSubmit={handleSetup} style={styles.setupForm}>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+1 555 000 0000"
              value={setupPhone}
              onChange={(e) => setSetupPhone(e.target.value)}
              required
            />
            <label style={styles.label}>Display Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Your name"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              maxLength={40}
              required
            />
            {setupError && <p style={styles.error}>{setupError}</p>}
            <button style={styles.primaryBtn} type="submit">
              Get Started
            </button>
          </form>
          <p style={styles.setupNote}>
            Your phone number is your unique ID. No SMS verification needed to get started.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Chat App
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.appContainer}>
      {/* ── Sidebar ── */}
      <div style={styles.sidebar}>
        {/* Sidebar Header */}
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarProfile}>
            <div
              style={{
                ...styles.avatarCircle,
                background: account?.avatar ?? "#6C63FF",
                width: 40,
                height: 40,
                fontSize: 15,
              }}
            >
              {getInitials(account?.displayName ?? "?")}
            </div>
            <div style={styles.sidebarProfileInfo}>
              <span style={styles.sidebarProfileName}>{account?.displayName}</span>
              <span style={styles.sidebarProfilePhone}>+{account?.phone}</span>
            </div>
          </div>
          <div style={styles.sidebarActions}>
            <button
              style={styles.iconBtn}
              title="New Chat"
              onClick={() => setShowNewChat(true)}
            >
              ✏️
            </button>
            <button style={styles.iconBtn} title="Logout" onClick={handleLogout}>
              🚪
            </button>
          </div>
        </div>

        {/* Search placeholder */}
        <div style={styles.searchBar}>
          <input style={styles.searchInput} type="text" placeholder="🔍  Search or start new chat" readOnly />
        </div>

        {/* Conversation List */}
        <div style={styles.convList}>
          {conversations.length === 0 && (
            <div style={styles.emptyConvs}>
              <p>No conversations yet.</p>
              <p style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                Tap ✏️ to start a new chat.
              </p>
            </div>
          )}
          {conversations.map((conv) => {
            const last = conv.messages[conv.messages.length - 1];
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                style={{
                  ...styles.convItem,
                  background: isActive ? "#f0eeff" : "transparent",
                  borderLeft: isActive ? "3px solid #6C63FF" : "3px solid transparent",
                }}
                onClick={() => setActiveConvId(conv.id)}
              >
                <div
                  style={{
                    ...styles.avatarCircle,
                    background: conv.participantAvatar,
                    width: 46,
                    height: 46,
                    fontSize: 17,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(conv.participantName)}
                </div>
                <div style={styles.convItemInfo}>
                  <div style={styles.convItemTop}>
                    <span style={styles.convItemName}>
                      {conv.participantName}
                      {conv.confidentialMode && (
                        <span style={styles.confiBadge}>🔒 NDA</span>
                      )}
                    </span>
                    {last && (
                      <span style={styles.convItemTime}>{formatTime(last.timestamp)}</span>
                    )}
                  </div>
                  <span style={styles.convItemPreview}>
                    {last
                      ? last.confidential
                        ? "🔒 Confidential message"
                        : last.text.length > 38
                        ? last.text.slice(0, 38) + "…"
                        : last.text
                      : "No messages yet"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div style={styles.chatArea}>
        {!activeConv ? (
          <div style={styles.noChatSelected}>
            <div style={styles.noChatContent}>
              <span style={{ fontSize: 64 }}>🔒</span>
              <h2 style={{ color: "#6C63FF", margin: "16px 0 8px" }}>Confi Messaging</h2>
              <p style={{ color: "#888", maxWidth: 340, textAlign: "center", lineHeight: 1.6 }}>
                Select a conversation or start a new one. Enable <strong>Confidential Mode</strong> in any
                chat to activate an international NDA covering the conversation.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div
              style={{
                ...styles.chatHeader,
                background: activeConv.confidentialMode
                  ? "linear-gradient(135deg,#1a0a2e,#3d1f6b)"
                  : "#fff",
                borderBottom: activeConv.confidentialMode
                  ? "1px solid #5a3e99"
                  : "1px solid #e8e8e8",
              }}
            >
              <div style={styles.chatHeaderLeft}>
                <div
                  style={{
                    ...styles.avatarCircle,
                    background: activeConv.participantAvatar,
                    width: 42,
                    height: 42,
                    fontSize: 16,
                  }}
                >
                  {getInitials(activeConv.participantName)}
                </div>
                <div style={styles.chatHeaderInfo}>
                  <span
                    style={{
                      ...styles.chatHeaderName,
                      color: activeConv.confidentialMode ? "#e0d4ff" : "#1a1a1a",
                    }}
                  >
                    {activeConv.participantName}
                  </span>
                  <span
                    style={{
                      ...styles.chatHeaderPhone,
                      color: activeConv.confidentialMode ? "#b39ddb" : "#888",
                    }}
                  >
                    +{activeConv.participantPhone}
                  </span>
                </div>
              </div>
              <div style={styles.chatHeaderRight}>
                {activeConv.confidentialMode && (
                  <div style={styles.ndaActiveBadge}>
                    <span>🔒 NDA ACTIVE</span>
                    {activeConv.ndaAcceptedAt && (
                      <span style={styles.ndaDate}>
                        Since {formatDate(activeConv.ndaAcceptedAt)}
                      </span>
                    )}
                  </div>
                )}
                <div style={styles.toggleWrapper}>
                  <span
                    style={{
                      fontSize: 12,
                      color: activeConv.confidentialMode ? "#c8b4f5" : "#888",
                      marginRight: 8,
                      fontWeight: 600,
                    }}
                  >
                    Confidential
                  </span>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      background: activeConv.confidentialMode ? "#6C63FF" : "#ccc",
                    }}
                    onClick={() => handleToggleConfidential(activeConv.id)}
                    aria-label="Toggle confidential mode"
                  >
                    <span
                      style={{
                        ...styles.toggleKnob,
                        transform: activeConv.confidentialMode
                          ? "translateX(22px)"
                          : "translateX(2px)",
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                ...styles.messagesContainer,
                background: activeConv.confidentialMode
                  ? "#0d0720"
                  : "#ece5dd",
              }}
            >
              {activeConv.messages.length === 0 && (
                <div style={styles.noMessages}>
                  <p style={{ color: activeConv.confidentialMode ? "#7c6aaa" : "#aaa" }}>
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              )}
              {activeConv.messages.map((msg, i) => {
                const isMine = msg.senderId === account?.phone;
                const showDate =
                  i === 0 ||
                  new Date(msg.timestamp).toDateString() !==
                    new Date(activeConv.messages[i - 1].timestamp).toDateString();
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={styles.dateDivider}>
                        <span
                          style={{
                            ...styles.dateDividerText,
                            background: activeConv.confidentialMode
                              ? "#1e0f3a"
                              : "#d9d9d9",
                            color: activeConv.confidentialMode ? "#a090c0" : "#666",
                          }}
                        >
                          {formatDate(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        marginBottom: 4,
                        padding: "0 12px",
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          background: isMine
                            ? activeConv.confidentialMode
                              ? "#5a3e99"
                              : "#dcf8c6"
                            : activeConv.confidentialMode
                            ? "#1e0f3a"
                            : "#fff",
                          color: activeConv.confidentialMode ? "#e8deff" : "#1a1a1a",
                          borderRadius: isMine
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          boxShadow: activeConv.confidentialMode
                            ? "0 1px 4px rgba(108,99,255,0.3)"
                            : "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                      >
                        {msg.confidential && (
                          <span style={styles.msgConfiBadge}>🔒</span>
                        )}
                        <span style={styles.msgText}>{msg.text}</span>
                        <span
                          style={{
                            ...styles.msgTime,
                            color: activeConv.confidentialMode
                              ? "#9880cc"
                              : "#999",
                          }}
                        >
                          {formatTime(msg.timestamp)}
                          {isMine && " ✓✓"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSend}
              style={{
                ...styles.inputBar,
                background: activeConv.confidentialMode ? "#1a0a2e" : "#f0f0f0",
                borderTop: activeConv.confidentialMode
                  ? "1px solid #3d1f6b"
                  : "1px solid #ddd",
              }}
            >
              <input
                style={{
                  ...styles.messageInput,
                  background: activeConv.confidentialMode ? "#2a1545" : "#fff",
                  color: activeConv.confidentialMode ? "#e0d4ff" : "#1a1a1a",
                  border: activeConv.confidentialMode
                    ? "1px solid #5a3e99"
                    : "1px solid #ddd",
                }}
                type="text"
                placeholder={
                  activeConv.confidentialMode
                    ? "🔒 Confidential message..."
                    : "Type a message..."
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button
                style={{
                  ...styles.sendBtn,
                  background: activeConv.confidentialMode ? "#5a3e99" : "#6C63FF",
                  opacity: messageInput.trim() ? 1 : 0.5,
                }}
                type="submit"
                disabled={!messageInput.trim()}
              >
                ➤
              </button>
            </form>
          </>
        )}
      </div>

      {/* ── New Chat Modal ── */}
      {showNewChat && (
        <div style={styles.modalOverlay} onClick={() => setShowNewChat(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>New Conversation</h3>
            <form onSubmit={handleNewChat} style={styles.setupForm}>
              <label style={styles.label}>Contact Phone Number</label>
              <input
                style={styles.input}
                type="tel"
                placeholder="+1 555 000 0000"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                required
                autoFocus
              />
              <label style={styles.label}>Contact Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Their display name"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                maxLength={40}
                required
              />
              {newChatError && <p style={styles.error}>{newChatError}</p>}
              <div style={styles.modalBtns}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => {
                    setShowNewChat(false);
                    setNewChatPhone("");
                    setNewChatName("");
                    setNewChatError("");
                  }}
                >
                  Cancel
                </button>
                <button style={styles.primaryBtn} type="submit">
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NDA Modal ── */}
      {showNDA && (
        <div style={styles.ndaOverlay}>
          <div style={styles.ndaCard}>
            <div style={styles.ndaHeader}>
              <span style={{ fontSize: 28 }}>🔒</span>
              <h2 style={styles.ndaTitle}>International Non-Disclosure Agreement</h2>
              <p style={styles.ndaSubtitle}>
                To activate Confidential Mode, you must accept this legally-binding NDA.
                All parties in this conversation are bound by its terms upon activation.
              </p>
            </div>
            <div style={styles.ndaBody}>
              <pre style={styles.ndaText}>{NDA_TEXT}</pre>
            </div>
            <div style={styles.ndaFooter}>
              <p style={styles.ndaWarning}>
                ⚠️ By accepting, you agree to be legally bound by the terms above under
                international law. This acceptance is timestamped and recorded.
              </p>
              <div style={styles.ndaActions}>
                <button style={styles.declineBtn} onClick={handleDeclineNDA}>
                  Decline
                </button>
                <button style={styles.acceptBtn} onClick={handleAcceptNDA}>
                  I Accept &amp; Activate Confidential Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Setup
  setupBg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#1a0a2e 0%,#3d1f6b 50%,#6C63FF 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  setupCard: {
    background: "#fff",
    borderRadius: 20,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
  },
  setupLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    justifyContent: "center",
  },
  setupLogoIcon: { fontSize: 36 },
  setupLogoText: {
    fontSize: 32,
    fontWeight: 800,
    color: "#6C63FF",
    letterSpacing: -1,
  },
  setupSubtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 32,
    fontSize: 15,
  },
  setupForm: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#555", marginTop: 8 },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1.5px solid #e0e0e0",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
    color: "#1a1a1a",
  },
  error: { color: "#e53e3e", fontSize: 13, margin: "4px 0 0" },
  primaryBtn: {
    marginTop: 16,
    padding: "13px",
    background: "linear-gradient(135deg,#6C63FF,#5a3e99)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(108,99,255,0.4)",
  },
  secondaryBtn: {
    padding: "11px 24px",
    background: "transparent",
    color: "#6C63FF",
    border: "2px solid #6C63FF",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  setupNote: {
    marginTop: 20,
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 1.6,
  },
  // App
  appContainer: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "#f5f5f5",
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif",
  },
  // Sidebar
  sidebar: {
    width: 360,
    minWidth: 280,
    borderRight: "1px solid #e8e8e8",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px 12px",
    background: "#f7f7f7",
    borderBottom: "1px solid #e8e8e8",
  },
  sidebarProfile: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  sidebarProfileInfo: {
    display: "flex",
    flexDirection: "column",
  },
  sidebarProfileName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  sidebarProfilePhone: {
    fontSize: 12,
    color: "#888",
  },
  sidebarActions: {
    display: "flex",
    gap: 4,
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    padding: "6px 8px",
    borderRadius: 8,
  },
  searchBar: {
    padding: "10px 12px",
    background: "#f7f7f7",
    borderBottom: "1px solid #e8e8e8",
  },
  searchInput: {
    width: "100%",
    padding: "8px 14px",
    borderRadius: 20,
    border: "none",
    background: "#ebebeb",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    color: "#555",
  },
  convList: {
    flex: 1,
    overflowY: "auto",
  },
  emptyConvs: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#888",
    fontSize: 15,
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #f2f2f2",
    transition: "background 0.15s",
  },
  avatarCircle: {
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    flexShrink: 0,
  },
  convItemInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  convItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convItemName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1a1a1a",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  confiBadge: {
    fontSize: 10,
    background: "#6C63FF",
    color: "#fff",
    borderRadius: 6,
    padding: "1px 6px",
    fontWeight: 700,
  },
  convItemTime: {
    fontSize: 11,
    color: "#aaa",
    flexShrink: 0,
  },
  convItemPreview: {
    fontSize: 13,
    color: "#888",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // Chat Area
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  noChatSelected: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
  },
  noChatContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: 40,
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    zIndex: 2,
    transition: "background 0.3s",
  },
  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  chatHeaderInfo: {
    display: "flex",
    flexDirection: "column",
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: 700,
    transition: "color 0.3s",
  },
  chatHeaderPhone: {
    fontSize: 12,
    transition: "color 0.3s",
  },
  chatHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  ndaActiveBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    background: "rgba(108,99,255,0.2)",
    border: "1px solid rgba(108,99,255,0.4)",
    borderRadius: 8,
    padding: "4px 10px",
  },
  ndaDate: {
    fontSize: 10,
    color: "#a090c0",
  },
  toggleWrapper: {
    display: "flex",
    alignItems: "center",
  },
  toggleBtn: {
    width: 48,
    height: 26,
    borderRadius: 13,
    border: "none",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.25s",
    padding: 0,
  },
  toggleKnob: {
    position: "absolute",
    top: 3,
    width: 20,
    height: 20,
    background: "#fff",
    borderRadius: "50%",
    transition: "transform 0.25s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    paddingTop: 12,
    paddingBottom: 12,
    transition: "background 0.3s",
  },
  noMessages: {
    display: "flex",
    justifyContent: "center",
    padding: "60px 20px",
  },
  dateDivider: {
    display: "flex",
    justifyContent: "center",
    margin: "12px 0",
  },
  dateDividerText: {
    fontSize: 12,
    borderRadius: 10,
    padding: "3px 12px",
    fontWeight: 500,
  },
  messageBubble: {
    maxWidth: "68%",
    padding: "8px 14px 6px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  msgConfiBadge: {
    fontSize: 10,
    marginBottom: 2,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  msgTime: {
    fontSize: 11,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  inputBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    transition: "background 0.3s",
  },
  messageInput: {
    flex: 1,
    padding: "11px 16px",
    borderRadius: 24,
    fontSize: 15,
    outline: "none",
    transition: "background 0.3s,color 0.3s",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
    flexShrink: 0,
  },
  // Modals
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20,
  },
  modalCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 20,
  },
  modalBtns: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  // NDA
  ndaOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(10,4,26,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 20,
    backdropFilter: "blur(4px)",
  },
  ndaCard: {
    background: "#13062a",
    border: "1px solid #5a3e99",
    borderRadius: 20,
    width: "100%",
    maxWidth: 680,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 80px rgba(108,99,255,0.4)",
    overflow: "hidden",
  },
  ndaHeader: {
    padding: "28px 32px 20px",
    borderBottom: "1px solid #2a1545",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 8,
    background: "linear-gradient(180deg,#1e0f3a,#13062a)",
  },
  ndaTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#e0d4ff",
    margin: 0,
    letterSpacing: -0.5,
  },
  ndaSubtitle: {
    fontSize: 13,
    color: "#9880cc",
    maxWidth: 480,
    lineHeight: 1.6,
    margin: 0,
  },
  ndaBody: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 32px",
    background: "#0d0720",
  },
  ndaText: {
    fontSize: 12,
    color: "#c8b4f5",
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
    fontFamily:
      "'Courier New',Courier,monospace",
    margin: 0,
  },
  ndaFooter: {
    padding: "20px 32px 24px",
    borderTop: "1px solid #2a1545",
    background: "linear-gradient(0deg,#1e0f3a,#13062a)",
  },
  ndaWarning: {
    fontSize: 12,
    color: "#f9c74f",
    marginBottom: 16,
    lineHeight: 1.6,
    background: "rgba(249,199,79,0.08)",
    border: "1px solid rgba(249,199,79,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
  },
  ndaActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },
  declineBtn: {
    padding: "12px 24px",
    background: "transparent",
    color: "#9880cc",
    border: "1px solid #5a3e99",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  acceptBtn: {
    padding: "12px 24px",
    background: "linear-gradient(135deg,#6C63FF,#5a3e99)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(108,99,255,0.5)",
  },
};