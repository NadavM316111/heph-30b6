"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface User {
  email: string;
  display_name: string;
}

interface Conversation {
  id: number;
  other_email: string;
  other_display: string;
  last_message: string;
  last_at: string;
  confidential: boolean;
  unread: number;
}

interface Message {
  id: number;
  sender_email: string;
  sender_display: string;
  content: string;
  created_at: string;
  confidential: boolean;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [showNDA, setShowNDA] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    });
    const stored = localStorage.getItem("confi_user");
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
      pollRef.current = setInterval(fetchConversations, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentUser]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/conversations?email=${encodeURIComponent(currentUser.email)}`
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
  }, [currentUser]);

  const fetchMessages = useCallback(
    async (convId: number) => {
      try {
        const res = await fetch(
          `/api/messages?conv_id=${convId}&email=${encodeURIComponent(
            currentUser?.email || ""
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {}
    },
    [currentUser]
  );

  // Poll messages in active conversation
  useEffect(() => {
    if (!activeConv) return;
    const interval = setInterval(() => {
      fetchMessages(activeConv.id);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeConv, fetchMessages]);

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const body: Record<string, string> = { mode: authMode, email, password };
      if (authMode === "signup" && displayName) {
        body.display_name = displayName;
      }
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        // After auth, upsert display name
        if (authMode === "signup" && displayName) {
          await fetch("/api/users/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email, display_name: displayName }),
          });
        }
        // Fetch stored display name
        const uRes = await fetch(
          `/api/users/me?email=${encodeURIComponent(data.email)}`
        );
        let dn = data.email;
        if (uRes.ok) {
          const ud = await uRes.json();
          dn = ud.display_name || data.email;
        }
        const user: User = { email: data.email, display_name: dn };
        setCurrentUser(user);
        localStorage.setItem("confi_user", JSON.stringify(user));
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchName.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await fetch(
        `/api/users/search?display_name=${encodeURIComponent(searchName.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          if (data.user.email === currentUser?.email) {
            setSearchError("That's you!");
          } else {
            setSearchResult(data.user);
          }
        } else {
          setSearchError("No user found with that display name.");
        }
      } else {
        setSearchError("Search failed.");
      }
    } catch {
      setSearchError("Network error.");
    } finally {
      setSearching(false);
    }
  };

  const handleStartConversation = async (targetUser: User) => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_a: currentUser.email,
          email_b: targetUser.email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const conv: Conversation = {
          id: data.conv_id,
          other_email: targetUser.email,
          other_display: targetUser.display_name,
          last_message: "",
          last_at: new Date().toISOString(),
          confidential: false,
          unread: 0,
        };
        setActiveConv(conv);
        setShowNewChat(false);
        setSearchName("");
        setSearchResult(null);
        await fetchConversations();
      }
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeConv || !currentUser) return;
    setSendingMsg(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conv_id: activeConv.id,
          sender_email: currentUser.email,
          content: newMessage.trim(),
          confidential: confidentialMode,
        }),
      });
      if (res.ok) {
        setNewMessage("");
        await fetchMessages(activeConv.id);
        await fetchConversations();
      }
    } catch {}
    setSendingMsg(false);
  };

  const toggleConfidential = () => {
    if (!confidentialMode && !ndaAccepted) {
      setShowNDA(true);
    } else {
      setConfidentialMode(!confidentialMode);
    }
  };

  const acceptNDA = () => {
    setNdaAccepted(true);
    setConfidentialMode(true);
    setShowNDA(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("confi_user");
    setConversations([]);
    setActiveConv(null);
    setMessages([]);
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // ─── AUTH SCREEN ────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.logo}>🔒 Confi</div>
          <p style={styles.logoSub}>Confidential Messaging</p>
          <div style={styles.authTabs}>
            <button
              style={authMode === "login" ? styles.authTabActive : styles.authTab}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              style={authMode === "signup" ? styles.authTabActive : styles.authTab}
              onClick={() => setAuthMode("signup")}
            >
              Sign Up
            </button>
          </div>
          {authMode === "signup" && (
            <input
              style={styles.input}
              placeholder="Display Name (how others find you)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <input
            style={styles.input}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
          />
          {authError && <p style={styles.error}>{authError}</p>}
          <button
            style={styles.btnPrimary}
            onClick={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? "..." : authMode === "login" ? "Login" : "Create Account"}
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN APP ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.appContainer}>
      {/* NDA Modal */}
      {showNDA && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>🔐 International NDA — Confidential Mode</h2>
            <div style={styles.ndaText}>
              <p><strong>NON-DISCLOSURE AGREEMENT</strong></p>
              <p>
                By activating Confidential Mode, all parties in this conversation
                ("Parties") agree to the following binding terms:
              </p>
              <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                <li>
                  <strong>Confidentiality Obligation:</strong> All information
                  shared in this conversation is strictly confidential. Each Party
                  agrees not to disclose, reproduce, or distribute any content to
                  any third party without prior written consent.
                </li>
                <li>
                  <strong>International Jurisdiction:</strong> This agreement is
                  governed by international trade secret law and applicable laws of
                  the Parties' respective jurisdictions. Disputes shall be resolved
                  by binding international arbitration.
                </li>
                <li>
                  <strong>Duration:</strong> This agreement remains in force
                  indefinitely, surviving the termination of this conversation and
                  any business relationship between the Parties.
                </li>
                <li>
                  <strong>Remedies:</strong> Breach of this agreement may result in
                  injunctive relief and monetary damages to the fullest extent
                  permitted under applicable law.
                </li>
                <li>
                  <strong>Scope:</strong> Covers all text, files, images, and
                  metadata exchanged while Confidential Mode is active.
                </li>
                <li>
                  <strong>Acceptance:</strong> By clicking "I Accept & Activate",
                  you confirm you have authority to enter this agreement on behalf
                  of yourself and any entity you represent.
                </li>
              </ol>
            </div>
            <div style={styles.ndaActions}>
              <button style={styles.btnSecondary} onClick={() => setShowNDA(false)}>
                Decline
              </button>
              <button style={styles.btnDanger} onClick={acceptNDA}>
                I Accept & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>
            <div style={styles.sidebarTitle}>🔒 Confi</div>
            <div style={styles.sidebarUser}>{currentUser.display_name}</div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.iconBtn} onClick={() => setShowNewChat(true)} title="New Chat">
              ✏️
            </button>
            <button style={styles.iconBtn} onClick={handleLogout} title="Logout">
              🚪
            </button>
          </div>
        </div>

        {/* New Chat Panel */}
        {showNewChat && (
          <div style={styles.newChatPanel}>
            <div style={styles.newChatHeader}>
              <span>New Conversation</span>
              <button style={styles.iconBtn} onClick={() => { setShowNewChat(false); setSearchName(""); setSearchResult(null); setSearchError(""); }}>✕</button>
            </div>
            <div style={styles.searchRow}>
              <input
                style={{ ...styles.input, margin: 0, flex: 1 }}
                placeholder="Search by display name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
              />
              <button style={styles.btnSmall} onClick={handleSearchUser} disabled={searching}>
                {searching ? "..." : "Find"}
              </button>
            </div>
            {searchError && <p style={{ ...styles.error, padding: "4px 8px" }}>{searchError}</p>}
            {searchResult && (
              <div style={styles.searchResultCard}>
                <div style={styles.avatarSmall}>{searchResult.display_name[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.convName}>{searchResult.display_name}</div>
                  <div style={styles.convPreview}>{searchResult.email}</div>
                </div>
                <button
                  style={styles.btnSmall}
                  onClick={() => handleStartConversation(searchResult)}
                >
                  Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Conversation List */}
        <div style={styles.convList}>
          {conversations.length === 0 && (
            <div style={styles.emptyState}>
              <p>No conversations yet.</p>
              <p style={{ fontSize: 12 }}>Click ✏️ to start one.</p>
            </div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                ...styles.convItem,
                ...(activeConv?.id === conv.id ? styles.convItemActive : {}),
              }}
              onClick={() => {
                setActiveConv(conv);
                setConfidentialMode(conv.confidential);
              }}
            >
              <div style={styles.avatar}>{conv.other_display[0]?.toUpperCase() || "?"}</div>
              <div style={styles.convInfo}>
                <div style={styles.convTopRow}>
                  <span style={styles.convName}>{conv.other_display}</span>
                  {conv.confidential && <span style={styles.confiBadge}>🔐</span>}
                  <span style={styles.convTime}>{formatTime(conv.last_at)}</span>
                </div>
                <div style={styles.convPreview}>
                  {conv.last_message
                    ? conv.last_message.length > 40
                      ? conv.last_message.slice(0, 40) + "…"
                      : conv.last_message
                    : "Start the conversation"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.chatArea}>
        {!activeConv ? (
          <div style={styles.noChatSelected}>
            <div style={styles.noChatIcon}>🔒</div>
            <h2>Welcome to Confi</h2>
            <p>Select a conversation or start a new one.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div
              style={{
                ...styles.chatHeader,
                ...(confidentialMode ? styles.chatHeaderConfidential : {}),
              }}
            >
              <div style={styles.chatHeaderLeft}>
                <div style={styles.avatar}>{activeConv.other_display[0]?.toUpperCase()}</div>
                <div>
                  <div style={styles.chatHeaderName}>{activeConv.other_display}</div>
                  {confidentialMode && (
                    <div style={styles.confidentialLabel}>🔐 Confidential Mode — NDA Active</div>
                  )}
                </div>
              </div>
              <button
                style={{
                  ...styles.confToggleBtn,
                  ...(confidentialMode ? styles.confToggleBtnActive : {}),
                }}
                onClick={toggleConfidential}
              >
                {confidentialMode ? "🔐 Confidential ON" : "🔓 Confidential OFF"}
              </button>
            </div>

            {/* Messages */}
            <div style={styles.messagesArea}>
              {messages.length === 0 && (
                <div style={styles.emptyMessages}>
                  <p>No messages yet. Say hello! 👋</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_email === currentUser.email;
                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.messageBubbleWrapper,
                      justifyContent: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMe && (
                      <div style={styles.avatarTiny}>
                        {msg.sender_display[0]?.toUpperCase()}
                      </div>
                    )}
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(isMe ? styles.bubbleMe : styles.bubbleThem),
                        ...(msg.confidential ? styles.bubbleConfidential : {}),
                      }}
                    >
                      {msg.confidential && (
                        <div style={styles.msgConfiBadge}>🔐 Confidential</div>
                      )}
                      <div style={styles.msgContent}>{msg.content}</div>
                      <div style={styles.msgTime}>{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
              style={{
                ...styles.inputArea,
                ...(confidentialMode ? styles.inputAreaConfidential : {}),
              }}
            >
              {confidentialMode && (
                <div style={styles.ndaBanner}>
                  🔐 NDA Active — This conversation is covered by an international confidentiality agreement
                </div>
              )}
              <div style={styles.inputRow}>
                <input
                  style={styles.messageInput}
                  placeholder={
                    confidentialMode
                      ? "Type a confidential message..."
                      : "Type a message..."
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    ...(confidentialMode ? styles.sendBtnConfidential : {}),
                  }}
                  onClick={handleSendMessage}
                  disabled={sendingMsg || !newMessage.trim()}
                >
                  {sendingMsg ? "..." : "➤"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  authContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%)",
  },
  authCard: {
    background: "#1e1e2e",
    borderRadius: 16,
    padding: "40px 36px",
    width: 360,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: "#fff",
    textAlign: "center",
  },
  logoSub: {
    color: "#888",
    textAlign: "center",
    fontSize: 14,
    margin: 0,
  },
  authTabs: {
    display: "flex",
    gap: 8,
    marginBottom: 4,
  },
  authTab: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid #444",
    background: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 14,
  },
  authTabActive: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid #6c63ff",
    background: "#6c63ff",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#2a2a3e",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btnPrimary: {
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "#6c63ff",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  btnSecondary: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "1px solid #555",
    background: "transparent",
    color: "#ccc",
    fontSize: 14,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#e63946",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "#6c63ff",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  error: {
    color: "#e63946",
    fontSize: 13,
    margin: 0,
  },
  appContainer: {
    display: "flex",
    height: "100vh",
    background: "#0d0d1a",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    width: 320,
    background: "#161625",
    borderRight: "1px solid #2a2a3e",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "16px",
    borderBottom: "1px solid #2a2a3e",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#1a1a2e",
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#6c63ff",
  },
  sidebarUser: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    color: "#aaa",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
  },
  newChatPanel: {
    background: "#1e1e2e",
    borderBottom: "1px solid #2a2a3e",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  newChatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "#ccc",
  },
  searchRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  searchResultCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px",
    background: "#2a2a3e",
    borderRadius: 8,
  },
  convList: {
    flex: 1,
    overflowY: "auto",
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #1e1e2e",
    transition: "background 0.15s",
  },
  convItemActive: {
    background: "#2a2a4e",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c63ff, #e040fb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c63ff, #e040fb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  avatarTiny: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c63ff, #e040fb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  convInfo: {
    flex: 1,
    minWidth: 0,
  },
  convTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  convName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
  },
  confiBadge: {
    fontSize: 12,
  },
  convTime: {
    fontSize: 11,
    color: "#666",
    marginLeft: "auto",
  },
  convPreview: {
    fontSize: 12,
    color: "#888",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  emptyState: {
    textAlign: "center",
    padding: 40,
    color: "#555",
    fontSize: 14,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  noChatSelected: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#555",
    gap: 12,
  },
  noChatIcon: {
    fontSize: 64,
  },
  chatHeader: {
    padding: "14px 20px",
    background: "#161625",
    borderBottom: "1px solid #2a2a3e",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    transition: "background 0.3s",
  },
  chatHeaderConfidential: {
    background: "#1a0a2e",
    borderBottom: "1px solid #4a0a6e",
  },
  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: 600,
  },
  confidentialLabel: {
    fontSize: 11,
    color: "#d966ff",
    marginTop: 2,
  },
  confToggleBtn: {
    padding: "8px 16px",
    borderRadius: 20,
    border: "1px solid #444",
    background: "transparent",
    color: "#aaa",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  confToggleBtnActive: {
    border: "1px solid #9b30d0",
    background: "rgba(155, 48, 208, 0.2)",
    color: "#d966ff",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  emptyMessages: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#555",
    fontSize: 14,
  },
  messageBubbleWrapper: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  messageBubble: {
    maxWidth: "65%",
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.5,
    position: "relative",
  },
  bubbleMe: {
    background: "#6c63ff",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    background: "#2a2a3e",
    color: "#e0e0e0",
    borderBottomLeftRadius: 4,
  },
  bubbleConfidential: {
    border: "1px solid #9b30d0",
    background: "linear-gradient(135deg, #2a0a4e, #1a0a2e)",
  },
  msgConfiBadge: {
    fontSize: 10,
    color: "#d966ff",
    marginBottom: 4,
    fontWeight: 600,
  },
  msgContent: {
    wordBreak: "break-word",
  },
  msgTime: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
    textAlign: "right",
  },
  inputArea: {
    background: "#161625",
    borderTop: "1px solid #2a2a3e",
    padding: "12px 16px",
    transition: "background 0.3s",
  },
  inputAreaConfidential: {
    background: "#1a0a2e",
    borderTop: "1px solid #4a0a6e",
  },
  ndaBanner: {
    fontSize: 11,
    color: "#d966ff",
    marginBottom: 8,
    textAlign: "center",
    padding: "4px 8px",
    background: "rgba(155, 48, 208, 0.1)",
    borderRadius: 6,
    border: "1px solid rgba(155, 48, 208, 0.3)",
  },
  inputRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  messageInput: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 24,
    border: "1px solid #333",
    background: "#2a2a3e",
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "none",
    background: "#6c63ff",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnConfidential: {
    background: "#9b30d0",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: "#1e1e2e",
    borderRadius: 16,
    padding: 32,
    maxWidth: 560,
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto",
    border: "1px solid #4a0a6e",
    boxShadow: "0 0 60px rgba(155,48,208,0.3)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#d966ff",
    marginBottom: 16,
  },
  ndaText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "#ccc",
    marginBottom: 24,
  },
  ndaActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },
};