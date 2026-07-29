"use client";

import { useState, useEffect, useRef } from "react";

interface Session {
  email: string;
  token: string;
  userId: number;
  displayName: string;
  avatarColor: string;
  kycVerified: boolean;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  content: string;
  timestamp: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatarColor: string;
  lastMessage: string;
  lastTime: number;
  unread: number;
  confidentialMode: boolean;
  ndaAccepted: boolean;
  messages: Message[];
}

interface MainAppProps {
  session: Session;
  onLogout: () => void;
  onSessionUpdate: (updates: Partial<Session>) => void;
}

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv_1",
    name: "Alice Chen",
    avatarColor: "#fa709a",
    lastMessage: "The contract details are ready",
    lastTime: Date.now() - 3600000,
    unread: 2,
    confidentialMode: false,
    ndaAccepted: false,
    messages: [
      {
        id: "m1",
        senderId: "alice",
        senderName: "Alice Chen",
        senderColor: "#fa709a",
        content: "Hey! I have the contract ready for review.",
        timestamp: Date.now() - 7200000,
        confidential: false,
      },
      {
        id: "m2",
        senderId: "alice",
        senderName: "Alice Chen",
        senderColor: "#fa709a",
        content: "The contract details are ready",
        timestamp: Date.now() - 3600000,
        confidential: false,
      },
    ],
  },
  {
    id: "conv_2",
    name: "Project Alpha Team",
    avatarColor: "#4facfe",
    lastMessage: "NDA mode activated for this channel",
    lastTime: Date.now() - 86400000,
    unread: 0,
    confidentialMode: true,
    ndaAccepted: true,
    messages: [
      {
        id: "m3",
        senderId: "bob",
        senderName: "Bob Martinez",
        senderColor: "#43e97b",
        content: "Activating confidential mode for our product launch discussion.",
        timestamp: Date.now() - 90000000,
        confidential: true,
      },
      {
        id: "m4",
        senderId: "alice",
        senderName: "Alice Chen",
        senderColor: "#fa709a",
        content: "NDA mode activated for this channel",
        timestamp: Date.now() - 86400000,
        confidential: true,
      },
    ],
  },
];

export default function MainApp({
  session,
  onLogout,
  onSessionUpdate,
}: MainAppProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [pendingNdaConvId, setPendingNdaConvId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  const sendMessage = () => {
    if (!messageInput.trim() || !activeConvId) return;
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      senderId: session.email,
      senderName: session.displayName,
      senderColor: session.avatarColor,
      content: messageInput.trim(),
      timestamp: Date.now(),
      confidential: activeConv?.confidentialMode || false,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: messageInput.trim(),
              lastTime: Date.now(),
              unread: 0,
            }
          : c
      )
    );
    setMessageInput("");
    inputRef.current?.focus();
  };

  const toggleConfidentialMode = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    if (!conv.confidentialMode) {
      if (!session.kycVerified) {
        setShowKycPrompt(true);
        return;
      }
      if (!conv.ndaAccepted) {
        setPendingNdaConvId(convId);
        setShowNdaModal(true);
        return;
      }
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, confidentialMode: !c.confidentialMode } : c
      )
    );
  };

  const acceptNda = () => {
    if (!pendingNdaConvId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === pendingNdaConvId
          ? { ...c, confidentialMode: true, ndaAccepted: true }
          : c
      )
    );
    const conv = conversations.find((c) => c.id === pendingNdaConvId);
    if (conv) {
      const ndaMsg: Message = {
        id: `nda_${Date.now()}`,
        senderId: "system",
        senderName: "System",
        senderColor: "#ffd700",
        content:
          "🔐 CONFIDENTIAL MODE ACTIVATED — This conversation is now protected under the Confi International NDA. All parties are bound by confidentiality obligations. Unauthorized disclosure may result in legal liability.",
        timestamp: Date.now(),
        confidential: true,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === pendingNdaConvId
            ? { ...c, messages: [...c.messages, ndaMsg] }
            : c
        )
      );
    }
    setShowNdaModal(false);
    setPendingNdaConvId(null);
  };

  const createNewChat = () => {
    if (!newChatName.trim()) return;
    const colors = [
      "#6c63ff", "#3ecfcf", "#ff6584", "#f5a623", "#43e97b",
      "#fa709a", "#4facfe", "#a18cd1",
    ];
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      name: newChatName.trim(),
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      lastMessage: "",
      lastTime: Date.now(),
      unread: 0,
      confidentialMode: false,
      ndaAccepted: false,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setNewChatName("");
    setShowNewChat(false);
  };

  const formatTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(ts).toLocaleDateString();
  };

  const s = styles;

  return (
    <div style={s.appContainer}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        {/* Sidebar Header */}
        <div style={s.sidebarHeader}>
          <div style={s.sidebarLogo}>
            <span style={{ fontSize: 20 }}>🔐</span>
            <span style={s.sidebarLogoText}>Confi</span>
          </div>
          <div style={s.headerActions}>
            <button
              style={s.iconBtn}
              onClick={() => setShowNewChat(true)}
              title="New conversation"
            >
              ✏️
            </button>
            <button
              style={s.iconBtn}
              onClick={() => setShowProfile(true)}
              title="Profile"
            >
              👤
            </button>
          </div>
        </div>

        {/* User card */}
        <div style={s.userCard}>
          <div
            style={{
              ...s.avatarSmall,
              background: session.avatarColor,
            }}
          >
            {session.displayName[0]?.toUpperCase() || "?"}
          </div>
          <div style={s.userInfo}>
            <span style={s.userName}>{session.displayName}</span>
            <span
              style={{
                ...s.kycBadge,
                background: session.kycVerified
                  ? "rgba(67,233,123,0.15)"
                  : "rgba(255,101,132,0.15)",
                color: session.kycVerified ? "#43e97b" : "#ff6584",
              }}
            >
              {session.kycVerified ? "✅ KYC Verified" : "⚠️ Unverified"}
            </span>
          </div>
        </div>

        {/* Conversations */}
        <div style={s.convList}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                ...s.convItem,
                background:
                  activeConvId === conv.id
                    ? "rgba(108,99,255,0.15)"
                    : "transparent",
                borderLeft:
                  activeConvId === conv.id
                    ? "3px solid #6c63ff"
                    : "3px solid transparent",
              }}
              onClick={() => {
                setActiveConvId(conv.id);
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === conv.id ? { ...c, unread: 0 } : c
                  )
                );
              }}
            >
              <div
                style={{
                  ...s.avatarMed,
                  background: conv.avatarColor,
                  position: "relative",
                }}
              >
                {conv.name[0].toUpperCase()}
                {conv.confidentialMode && (
                  <span style={s.confiBadge}>🔒</span>
                )}
              </div>
              <div style={s.convInfo}>
                <div style={s.convTop}>
                  <span style={s.convName}>{conv.name}</span>
                  <span style={s.convTime}>{formatTime(conv.lastTime)}</span>
                </div>
                <div style={s.convBottom}>
                  <span style={s.convLast}>
                    {conv.confidentialMode && "🔒 "}
                    {conv.lastMessage || "No messages yet"}
                  </span>
                  {conv.unread > 0 && (
                    <span style={s.unreadBadge}>{conv.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={s.chatArea}>
        {activeConv ? (
          <>
            {/* Chat header */}
            <div style={s.chatHeader}>
              <div style={s.chatHeaderLeft}>
                <div
                  style={{
                    ...s.avatarMed,
                    background: activeConv.avatarColor,
                  }}
                >
                  {activeConv.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={s.chatName}>{activeConv.name}</div>
                  <div style={s.chatStatus}>
                    {activeConv.confidentialMode
                      ? "🔒 Confidential Mode Active"
                      : "Active now"}
                  </div>
                </div>
              </div>
              <div style={s.chatHeaderRight}>
                <button
                  style={{
                    ...s.confidentialBtn,
                    background: activeConv.confidentialMode
                      ? "linear-gradient(135deg, #ffd700, #ff8c00)"
                      : "rgba(255,255,255,0.07)",
                    color: activeConv.confidentialMode ? "#000" : "#fff",
                    border: activeConv.confidentialMode
                      ? "none"
                      : "1px solid rgba(255,255,255,0.15)",
                  }}
                  onClick={() => toggleConfidentialMode(activeConv.id)}
                >
                  {activeConv.confidentialMode
                    ? "🔒 NDA Active"
                    : "🔓 Enable NDA"}
                </button>
              </div>
            </div>

            {/* NDA banner */}
            {activeConv.confidentialMode && (
              <div style={s.ndaBanner}>
                <span style={{ fontSize: 12 }}>⚖️</span>
                <span style={{ fontSize: 11, color: "#ffd700" }}>
                  This conversation is protected under the Confi International
                  NDA. All parties are legally bound to confidentiality.
                </span>
              </div>
            )}

            {/* Messages */}
            <div style={s.messagesContainer}>
              {activeConv.messages.map((msg) => {
                const isOwn = msg.senderId === session.email;
                const isSystem = msg.senderId === "system";
                if (isSystem) {
                  return (
                    <div key={msg.id} style={s.systemMsg}>
                      {msg.content}
                    </div>
                  );
                }
                return (
                  <div
                    key={msg.id}
                    style={{
                      ...s.messageRow,
                      flexDirection: isOwn ? "row-reverse" : "row",
                    }}
                  >
                    <div
                      style={{
                        ...s.avatarSmall,
                        background: msg.senderColor,
                        flexShrink: 0,
                      }}
                    >
                      {msg.senderName[0].toUpperCase()}
                    </div>
                    <div
                      style={{
                        ...s.messageBubble,
                        background: isOwn
                          ? "linear-gradient(135deg, #6c63ff, #4a45d4)"
                          : msg.confidential
                          ? "rgba(255,215,0,0.08)"
                          : "rgba(255,255,255,0.06)",
                        borderTopRightRadius: isOwn ? 4 : 18,
                        borderTopLeftRadius: isOwn ? 18 : 4,
                        border: msg.confidential
                          ? "1px solid rgba(255,215,0,0.2)"
                          : "none",
                        alignSelf: isOwn ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isOwn && (
                        <p style={s.msgSender}>{msg.senderName}</p>
                      )}
                      <p style={s.msgContent}>{msg.content}</p>
                      <div style={s.msgMeta}>
                        {msg.confidential && (
                          <span style={{ color: "#ffd700", fontSize: 10 }}>
                            🔒
                          </span>
                        )}
                        <span style={s.msgTime}>{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div style={s.inputArea}>
              {activeConv.confidentialMode && (
                <div style={s.inputConfiBadge}>🔒 NDA</div>
              )}
              <input
                ref={inputRef}
                style={s.messageInput}
                type="text"
                placeholder={
                  activeConv.confidentialMode
                    ? "Send confidential message…"
                    : "Type a message…"
                }
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                style={{
                  ...s.sendBtn,
                  opacity: messageInput.trim() ? 1 : 0.4,
                }}
                onClick={sendMessage}
                disabled={!messageInput.trim()}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div style={s.emptyState}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>🔐</div>
            <h2 style={{ color: "#fff", fontSize: 22, marginBottom: 8 }}>
              Welcome to Confi
            </h2>
            <p
              style={{ color: "#8892b0", fontSize: 14, textAlign: "center" }}
            >
              Select a conversation or start a new one.
              <br />
              Enable NDA mode for legally-protected messaging.
            </p>
          </div>
        )}
      </div>

      {/* NDA Modal */}
      {showNdaModal && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⚖️</div>
            <h2 style={s.modalTitle}>Confi International NDA</h2>
            <p style={s.modalSubtitle}>
              By enabling Confidential Mode, you agree to the following:
            </p>
            <div style={s.ndaText}>
              <p>
                <strong>CONFIDENTIALITY AGREEMENT</strong>
              </p>
              <p>
                This Non-Disclosure Agreement ("Agreement") is entered into
                by all participants in this conversation.
              </p>
              <p>
                <strong>1. CONFIDENTIAL INFORMATION</strong>
                <br />
                All information shared in this conversation while Confidential
                Mode is active shall be considered proprietary and confidential.
              </p>
              <p>
                <strong>2. OBLIGATIONS</strong>
                <br />
                Each party agrees to: (a) maintain strict confidentiality; (b)
                not disclose information to third parties; (c) use information
                solely for the purpose of this conversation.
              </p>
              <p>
                <strong>3. LEGAL ENFORCEABILITY</strong>
                <br />
                This agreement is enforceable under international commercial law
                including but not limited to UNCITRAL, the New York Convention,
                and applicable domestic laws of each party's jurisdiction.
              </p>
              <p>
                <strong>4. PENALTIES</strong>
                <br />
                Breach of this agreement may result in civil and/or criminal
                liability, injunctive relief, and damages as permitted by law.
              </p>
              <p>
                <strong>5. DURATION</strong>
                <br />
                This agreement remains in effect indefinitely for information
                shared during confidential sessions.
              </p>
              <p style={{ color: "#ffd700" }}>
                Your identity has been verified via KYC. Your legal name is
                bound to this agreement.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <button
                style={s.modalCancelBtn}
                onClick={() => {
                  setShowNdaModal(false);
                  setPendingNdaConvId(null);
                }}
              >
                Decline
              </button>
              <button style={s.modalAcceptBtn} onClick={acceptNda}>
                ✅ Accept & Activate NDA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC Prompt */}
      {showKycPrompt && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modal, maxWidth: 360 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🪪</div>
            <h2 style={s.modalTitle}>KYC Required</h2>
            <p style={s.modalSubtitle}>
              Identity verification is required before activating NDA-protected
              conversations. Please complete your KYC profile.
            </p>
            <button
              style={s.modalAcceptBtn}
              onClick={() => setShowKycPrompt(false)}
            >
              OK, Got it
            </button>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modal, maxWidth: 360 }}>
            <h2 style={s.modalTitle}>New Conversation</h2>
            <input
              style={s.modalInput}
              type="text"
              placeholder="Contact name or group name"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNewChat()}
              autoFocus
            />
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <button
                style={s.modalCancelBtn}
                onClick={() => {
                  setShowNewChat(false);
                  setNewChatName("");
                }}
              >
                Cancel
              </button>
              <button style={s.modalAcceptBtn} onClick={createNewChat}>
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Sidebar */}
      {showProfile && (
        <div style={s.modalOverlay} onClick={() => setShowProfile(false)}>
          <div
            style={s.profilePanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                ...s.avatarLarge,
                background: session.avatarColor,
              }}
            >
              {session.displayName[0]?.toUpperCase() || "?"}
            </div>
            <h2 style={{ color: "#fff", marginBottom: 4 }}>
              {session.displayName}
            </h2>
            <p style={{ color: "#8892b0", fontSize: 13, marginBottom: 8 }}>
              {session.email}
            </p>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: session.kycVerified
                  ? "rgba(67,233,123,0.15)"
                  : "rgba(255,101,132,0.15)",
                color: session.kycVerified ? "#43e97b" : "#ff6584",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              {session.kycVerified
                ? "✅ KYC Verified — NDA Mode Available"
                : "⚠️ Not KYC Verified — Complete to unlock NDA mode"}
            </div>
            <div style={s.profileStats}>
              <div style={s.statItem}>
                <span style={s.statNum}>
                  {conversations.filter((c) => c.ndaAccepted).length}
                </span>
                <span style={s.statLabel}>NDA Conversations</span>
              </div>
              <div style={s.statItem}>
                <span style={s.statNum}>{conversations.length}</span>
                <span style={s.statLabel}>Total Chats</span>
              </div>
            </div>
            <button style={s.logoutBtn} onClick={onLogout}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    display: "flex",
    height: "100vh",
    background: "#0a0f1e",
    overflow: "hidden",
  } as React.CSSProperties,
  sidebar: {
    width: 320,
    minWidth: 280,
    background: "rgba(255,255,255,0.03)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  } as React.CSSProperties,
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  } as React.CSSProperties,
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  sidebarLogoText: {
    fontSize: 18,
    fontWeight: 700,
    background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  } as React.CSSProperties,
  headerActions: {
    display: "flex",
    gap: 4,
  } as React.CSSProperties,
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "none",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#fff",
  } as React.CSSProperties,
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  } as React.CSSProperties,
  userInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  userName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  kycBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 10,
    display: "inline-block",
    width: "fit-content",
  } as React.CSSProperties,
  convList: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px 0",
  } as React.CSSProperties,
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
  } as React.CSSProperties,
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  } as React.CSSProperties,
  avatarMed: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 18,
    flexShrink: 0,
  } as React.CSSProperties,
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 32,
    marginBottom: 12,
  } as React.CSSProperties,
  confiBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    fontSize: 12,
    background: "#0a0f1e",
    borderRadius: "50%",
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  convInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  convTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  } as React.CSSProperties,
  convName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  convTime: {
    fontSize: 11,
    color: "#4a5568",
    flexShrink: 0,
    marginLeft: 4,
  } as React.CSSProperties,
  convBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  convLast: {
    fontSize: 12,
    color: "#8892b0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  unreadBadge: {
    background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
    color: "#fff",
    borderRadius: 10,
    padding: "1px 6px",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    marginLeft: 4,
  } as React.CSSProperties,
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    background: "#0d1117",
  } as React.CSSProperties,
  chatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.02)",
    flexShrink: 0,
  } as React.CSSProperties,
  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  chatName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
  } as React.CSSProperties,
  chatStatus: {
    fontSize: 12,
    color: "#8892b0",
  } as React.CSSProperties,
  chatHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  confidentialBtn: {
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  ndaBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 20px",
    background: "rgba(255,215,0,0.06)",
    borderBottom: "1px solid rgba(255,215,0,0.15)",
    flexShrink: 0,
  } as React.CSSProperties,
  messagesContainer: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  } as React.CSSProperties,
  messageRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  } as React.CSSProperties,
  messageBubble: {
    maxWidth: "68%",
    padding: "10px 14px",
    borderRadius: 18,
  } as React.CSSProperties,
  msgSender: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6c63ff",
    marginBottom: 4,
  } as React.CSSProperties,
  msgContent: {
    fontSize: 14,
    color: "#e6edf3",
    lineHeight: 1.5,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  msgMeta: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  } as React.CSSProperties,
  msgTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
  } as React.CSSProperties,
  systemMsg: {
    alignSelf: "center",
    maxWidth: "80%",
    padding: "8px 16px",
    background: "rgba(255,215,0,0.08)",
    border: "1px solid rgba(255,215,0,0.2)",
    borderRadius: 12,
    fontSize: 12,
    color: "#ffd700",
    textAlign: "center" as const,
    lineHeight: 1.5,
  } as React.CSSProperties,
  inputArea: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.02)",
    flexShrink: 0,
  } as React.CSSProperties,
  inputConfiBadge: {
    background: "rgba(255,215,0,0.15)",
    color: "#ffd700",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 8,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  messageInput: {
    flex: 1,
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    color: "#fff",
    fontSize: 14,
  } as React.CSSProperties,
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
    color: "#fff",
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  } as React.CSSProperties,
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  } as React.CSSProperties,
  modal: {
    background: "#141928",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  modalTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#fff",
    textAlign: "center" as const,
  } as React.CSSProperties,
  modalSubtitle: {
    fontSize: 13,
    color: "#8892b0",
    textAlign: "center" as const,
    lineHeight: 1.5,
  } as React.CSSProperties,
  ndaText: {
    width: "100%",
    maxHeight: 260,
    overflowY: "auto" as const,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "16px",
    fontSize: 12,
    color: "#a0aec0",
    lineHeight: 1.6,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  } as React.CSSProperties,
  modalInput: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    marginBottom: 4,
  } as React.CSSProperties,
  modalAcceptBtn: {
    flex: 1,
    padding: "12px",
    background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
  } as React.CSSProperties,
  modalCancelBtn: {
    flex: 1,
    padding: "12px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#8892b0",
    fontWeight: 500,
    fontSize: 14,
    borderRadius: 12,
    cursor: "pointer",
  } as React.CSSProperties,
  profilePanel: {
    background: "#141928",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 320,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  } as React.CSSProperties,
  profileStats: {
    display: "flex",
    gap: 24,
    marginBottom: 24,
  } as React.CSSProperties,
  statItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 2,
  } as React.CSSProperties,
  statNum: {
    fontSize: 24,
    fontWeight: 700,
    color: "#6c63ff",
  } as React.CSSProperties,
  statLabel: {
    fontSize: 11,
    color: "#8892b0",
    textAlign: "center" as const,
  } as React.CSSProperties,
  logoutBtn: {
    padding: "10px 24px",
    background: "rgba(255,101,132,0.12)",
    border: "1px solid rgba(255,101,132,0.3)",
    color: "#ff6584",
    fontWeight: 600,
    fontSize: 14,
    borderRadius: 12,
    cursor: "pointer",
  } as React.CSSProperties,
};