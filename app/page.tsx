"use client";

import { useEffect, useState, useRef } from "react";

interface User {
  email: string;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  messages: Message[];
  confidentialMode: boolean;
  ndaAccepted: boolean;
  ndaAcceptedAt?: number;
  createdAt: number;
  lastActivity: number;
}

type AuthMode = "login" | "signup";

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function NDAModal({
  conversation,
  currentUser,
  onAccept,
  onDecline,
}: {
  conversation: Conversation;
  currentUser: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const now = new Date().toISOString();
  const other = conversation.participants.find((p) => p !== currentUser) || "Unknown";

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.ndaModal}>
        <div style={styles.ndaHeader}>
          <div style={styles.ndaHeaderIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={styles.ndaTitle}>Confidentiality Agreement</h2>
          <p style={styles.ndaSubtitle}>International Non-Disclosure Agreement</p>
        </div>

        <div style={styles.ndaBody}>
          <div style={styles.ndaMetaRow}>
            <div style={styles.ndaMeta}>
              <span style={styles.ndaMetaLabel}>Agreement Date</span>
              <span style={styles.ndaMetaValue}>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
            <div style={styles.ndaMeta}>
              <span style={styles.ndaMetaLabel}>Agreement Reference</span>
              <span style={styles.ndaMetaValue}>CNFI-{conversation.id.toUpperCase()}</span>
            </div>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>PARTIES</h3>
            <p style={styles.ndaText}>
              This Mutual Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into as of{" "}
              <strong>{now.split("T")[0]}</strong>, by and between{" "}
              <strong>{currentUser}</strong> (&quot;First Party&quot;) and{" "}
              <strong>{other}</strong> (&quot;Second Party&quot;), collectively referred to as the &quot;Parties.&quot;
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>1. DEFINITIONS</h3>
            <p style={styles.ndaText}>
              &quot;Confidential Information&quot; means any and all information or data that has or could have commercial value or other utility in the business in which the Disclosing Party is engaged. This includes all information or data that could be reasonably interpreted as confidential given the nature of the circumstances surrounding its disclosure, whether or not such information is specifically labeled as &quot;confidential&quot;.
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>2. OBLIGATIONS OF RECEIVING PARTY</h3>
            <p style={styles.ndaText}>
              Each Party agrees to: (a) hold the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third parties without prior written consent; (c) use the Confidential Information solely for the purpose of this conversation; (d) take all reasonable precautions to protect the confidentiality of such information.
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>3. INTERNATIONAL JURISDICTION</h3>
            <p style={styles.ndaText}>
              This Agreement shall be governed by and construed in accordance with principles of international commercial law. The Parties consent to jurisdiction in any competent court of law where either Party resides or operates. This Agreement shall be binding under the laws of the United Nations Convention on Contracts for the International Sale of Goods (CISG) where applicable, and under applicable national law in each Party&apos;s jurisdiction.
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>4. TERM</h3>
            <p style={styles.ndaText}>
              This Agreement shall remain in effect for a period of five (5) years from the date of execution, or until the Confidential Information no longer qualifies as confidential, whichever occurs first. Termination of this Agreement shall not relieve the Parties of obligations incurred prior to termination.
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>5. REMEDIES</h3>
            <p style={styles.ndaText}>
              The Parties acknowledge that any breach of this Agreement may cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, the Parties agree that equitable relief, including injunction and specific performance, shall be available remedies for any breach without the requirement to post bond or other security.
            </p>
          </div>

          <div style={styles.ndaSection}>
            <h3 style={styles.ndaSectionTitle}>6. DIGITAL ACCEPTANCE</h3>
            <p style={styles.ndaText}>
              By clicking &quot;I Accept This Agreement&quot;, the Parties each acknowledge they have read, understood, and agree to be bound by the terms of this Agreement. Digital acceptance constitutes a legally binding electronic signature under applicable electronic signature laws including the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN) and the EU eIDAS Regulation.
            </p>
          </div>

          <div style={styles.ndaWarningBox}>
            <p style={styles.ndaWarningText}>
              WARNING: Activating Confidential Mode places this conversation under legally binding confidentiality obligations. All messages exchanged in this conversation will be covered under this Agreement.
            </p>
          </div>
        </div>

        <div style={styles.ndaFooter}>
          <button onClick={onDecline} style={styles.ndaDeclineBtn}>
            Decline
          </button>
          <button onClick={onAccept} style={styles.ndaAcceptBtn}>
            I Accept This Agreement
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfiApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newChatEmail, setNewChatEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatError, setNewChatError] = useState("");
  const [showNDA, setShowNDA] = useState(false);
  const [pendingConfidential, setPendingConfidential] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("confi_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`confi_convs_${user.email}`);
      if (saved) {
        try {
          setConversations(JSON.parse(saved));
        } catch {}
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`confi_convs_${user.email}`, JSON.stringify(conversations));
    }
  }, [conversations, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, conversations]);

  const handleAuth = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please enter your email and password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: authMode, email: authEmail.trim().toLowerCase(), password: authPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        const u = { email: data.email };
        setUser(u);
        localStorage.setItem("confi_user", JSON.stringify(u));
      } else {
        setAuthError(data.error || "Authentication failed.");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setConversations([]);
    setActiveConvId(null);
    localStorage.removeItem("confi_user");
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  const handleNewChat = () => {
    const email = newChatEmail.trim().toLowerCase();
    if (!email) {
      setNewChatError("Please enter an email address.");
      return;
    }
    if (email === user?.email) {
      setNewChatError("You cannot message yourself.");
      return;
    }
    const existing = conversations.find(
      (c) => c.participants.includes(email) && c.participants.includes(user!.email)
    );
    if (existing) {
      setActiveConvId(existing.id);
      setShowNewChat(false);
      setNewChatEmail("");
      setNewChatError("");
      return;
    }
    const newConv: Conversation = {
      id: generateId(),
      participants: [user!.email, email],
      messages: [],
      confidentialMode: false,
      ndaAccepted: false,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setShowNewChat(false);
    setNewChatEmail("");
    setNewChatError("");
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activeConvId || !user) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;

    const msg: Message = {
      id: generateId(),
      sender: user.email,
      text: messageInput.trim(),
      timestamp: Date.now(),
      confidential: conv.confidentialMode,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, msg], lastActivity: Date.now() }
          : c
      )
    );
    setMessageInput("");
    inputRef.current?.focus();
  };

  const handleToggleConfidential = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    if (conv.confidentialMode) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, confidentialMode: false } : c
        )
      );
      return;
    }

    if (!conv.ndaAccepted) {
      setPendingConfidential(convId);
      setShowNDA(true);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, confidentialMode: true } : c
        )
      );
    }
  };

  const handleNDAAccept = () => {
    if (!pendingConfidential) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === pendingConfidential
          ? { ...c, confidentialMode: true, ndaAccepted: true, ndaAcceptedAt: Date.now() }
          : c
      )
    );
    setShowNDA(false);
    setPendingConfidential(null);
  };

  const handleNDADecline = () => {
    setShowNDA(false);
    setPendingConfidential(null);
  };

  const getOtherParticipant = (conv: Conversation) => {
    return conv.participants.find((p) => p !== user?.email) || "Unknown";
  };

  const getInitials = (email: string) => {
    return email.split("@")[0].substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (email: string) => {
    const colors = ["#2D6A4F", "#1B4F72", "#4A235A", "#1A5276", "#7B241C", "#145A32", "#784212", "#1F618D"];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const sortedConversations = [...conversations].sort((a, b) => b.lastActivity - a.lastActivity);

  if (!user) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <rect x="9" y="9" width="6" height="1" rx="0.5" fill="white" stroke="none" />
              <rect x="9" y="12" width="4" height="1" rx="0.5" fill="white" stroke="none" />
            </svg>
          </div>
          <h1 style={styles.authTitle}>Confi</h1>
          <p style={styles.authSubtitle}>Private. Secure. Confidential.</p>

          <div style={styles.authTabs}>
            <button
              style={{ ...styles.authTab, ...(authMode === "login" ? styles.authTabActive : {}) }}
              onClick={() => { setAuthMode("login"); setAuthError(""); }}
            >
              Sign In
            </button>
            <button
              style={{ ...styles.authTab, ...(authMode === "signup" ? styles.authTabActive : {}) }}
              onClick={() => { setAuthMode("signup"); setAuthError(""); }}
            >
              Create Account
            </button>
          </div>

          <div style={styles.authForm}>
            <div style={styles.authField}>
              <label style={styles.authLabel}>Email Address</label>
              <input
                style={styles.authInput}
                type="email"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            <div style={styles.authField}>
              <label style={styles.authLabel}>Password</label>
              <input
                style={styles.authInput}
                type="password"
                placeholder="Enter your password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            {authError && <p style={styles.authError}>{authError}</p>}
            <button
              style={{ ...styles.authSubmit, ...(authLoading ? styles.authSubmitDisabled : {}) }}
              onClick={handleAuth}
              disabled={authLoading}
            >
              {authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {showNDA && pendingConfidential && (
        <NDAModal
          conversation={conversations.find((c) => c.id === pendingConfidential)!}
          currentUser={user.email}
          onAccept={handleNDAAccept}
          onDecline={handleNDADecline}
        />
      )}

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarBrand}>
            <div style={styles.brandIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span style={styles.brandName}>Confi</span>
          </div>
          <div style={styles.sidebarActions}>
            <button
              style={styles.iconBtn}
              onClick={() => setShowNewChat(!showNewChat)}
              title="New conversation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div style={styles.userBar}>
          <div
            style={{ ...styles.avatar, background: getAvatarColor(user.email), width: 32, height: 32, fontSize: 11 }}
          >
            {getInitials(user.email)}
          </div>
          <div style={styles.userBarInfo}>
            <span style={styles.userBarEmail}>{user.email}</span>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {showNewChat && (
          <div style={styles.newChatBox}>
            <p style={styles.newChatLabel}>Start a new conversation</p>
            <input
              style={styles.newChatInput}
              type="email"
              placeholder="Enter email address..."
              value={newChatEmail}
              onChange={(e) => setNewChatEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewChat()}
              autoFocus
            />
            {newChatError && <p style={styles.newChatError}>{newChatError}</p>}
            <div style={styles.newChatActions}>
              <button style={styles.newChatCancel} onClick={() => { setShowNewChat(false); setNewChatEmail(""); setNewChatError(""); }}>
                Cancel
              </button>
              <button style={styles.newChatStart} onClick={handleNewChat}>
                Start Chat
              </button>
            </div>
          </div>
        )}

        <div style={styles.convList}>
          {sortedConversations.length === 0 && (
            <div style={styles.emptyConvs}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={styles.emptyConvsText}>No conversations yet.</p>
              <p style={styles.emptyConvsHint}>Click + to start one.</p>
            </div>
          )}
          {sortedConversations.map((conv) => {
            const other = getOtherParticipant(conv);
            const lastMsg = conv.messages[conv.messages.length - 1];
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                style={{
                  ...styles.convItem,
                  ...(isActive ? styles.convItemActive : {}),
                }}
                onClick={() => setActiveConvId(conv.id)}
              >
                <div
                  style={{ ...styles.avatar, background: getAvatarColor(other) }}
                >
                  {getInitials(other)}
                </div>
                <div style={styles.convItemContent}>
                  <div style={styles.convItemHeader}>
                    <span style={styles.convItemName}>{other.split("@")[0]}</span>
                    <span style={styles.convItemTime}>
                      {lastMsg ? formatDate(lastMsg.timestamp) : ""}
                    </span>
                  </div>
                  <div style={styles.convItemFooter}>
                    <span style={styles.convItemPreview}>
                      {lastMsg
                        ? conv.confidentialMode
                          ? "Confidential message"
                          : lastMsg.text.length > 35
                          ? lastMsg.text.substring(0, 35) + "..."
                          : lastMsg.text
                        : "No messages yet"}
                    </span>
                    {conv.confidentialMode && (
                      <span style={styles.confiBadge}>NDA</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.chatArea}>
        {!activeConv ? (
          <div style={styles.noChatSelected}>
            <div style={styles.noChatIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 style={styles.noChatTitle}>Select a conversation</h2>
            <p style={styles.noChatText}>Choose an existing conversation or start a new one.</p>
            <button style={styles.noChatBtn} onClick={() => setShowNewChat(true)}>
              New Conversation
            </button>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div style={{
              ...styles.chatHeader,
              ...(activeConv.confidentialMode ? styles.chatHeaderConfidential : {}),
            }}>
              <div style={styles.chatHeaderLeft}>
                <div style={{ ...styles.avatar, background: getAvatarColor(getOtherParticipant(activeConv)) }}>
                  {getInitials(getOtherParticipant(activeConv))}
                </div>
                <div style={styles.chatHeaderInfo}>
                  <span style={styles.chatHeaderName}>
                    {getOtherParticipant(activeConv).split("@")[0]}
                  </span>
                  <span style={styles.chatHeaderEmail}>
                    {getOtherParticipant(activeConv)}
                  </span>
                </div>
              </div>
              <div style={styles.chatHeaderRight}>
                {activeConv.confidentialMode && (
                  <div style={styles.ndaActiveBadge}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    NDA Active
                  </div>
                )}
                <div style={styles.confidentialToggle}>
                  <span style={styles.confidentialLabel}>Confidential Mode</span>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(activeConv.confidentialMode ? styles.toggleBtnOn : styles.toggleBtnOff),
                    }}
                    onClick={() => handleToggleConfidential(activeConv.id)}
                  >
                    <div style={{
                      ...styles.toggleKnob,
                      ...(activeConv.confidentialMode ? styles.toggleKnobOn : styles.toggleKnobOff),
                    }} />
                  </button>
                </div>
              </div>
            </div>

            {/* NDA Info Bar */}
            {activeConv.ndaAccepted && (
              <div style={styles.ndaInfoBar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>
                  This conversation is protected by a mutual Non-Disclosure Agreement accepted on{" "}
                  {new Date(activeConv.ndaAcceptedAt!).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                  . Reference: CNFI-{activeConv.id.toUpperCase()}
                </span>
              </div>
            )}

            {/* Messages */}
            <div style={{
              ...styles.messagesArea,
              ...(activeConv.confidentialMode ? styles.messagesAreaConfidential : {}),
            }}>
              {activeConv.messages.length === 0 && (
                <div style={styles.emptyMessages}>
                  <p style={styles.emptyMessagesText}>
                    This is the beginning of your conversation with{" "}
                    <strong>{getOtherParticipant(activeConv).split("@")[0]}</strong>.
                  </p>
                  {!activeConv.confidentialMode && (
                    <p style={styles.emptyMessagesHint}>
                      Enable Confidential Mode to place this conversation under a legally binding NDA.
                    </p>
                  )}
                </div>
              )}

              {activeConv.messages.map((msg, i) => {
                const isOwn = msg.sender === user.email;
                const prevMsg = activeConv.messages[i - 1];
                const showDate =
                  !prevMsg ||
                  new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={styles.dateSeparator}>
                        <span style={styles.dateSeparatorText}>{formatDate(msg.timestamp)}</span>
                      </div>
                    )}
                    <div style={{ ...styles.messageRow, ...(isOwn ? styles.messageRowOwn : {}) }}>
                      {!isOwn && (
                        <div style={{
                          ...styles.avatar,
                          ...styles.msgAvatar,
                          background: getAvatarColor(msg.sender),
                        }}>
                          {getInitials(msg.sender)}
                        </div>
                      )}
                      <div style={styles.messageBubbleWrapper}>
                        <div style={{
                          ...styles.messageBubble,
                          ...(isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther),
                          ...(msg.confidential ? styles.messageBubbleConfidential : {}),
                        }}>
                          {msg.text}
                        </div>
                        <div style={{ ...styles.messageTime, ...(isOwn ? styles.messageTimeOwn : {}) }}>
                          {msg.confidential && (
                            <span style={styles.msgConfidentialTag}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Confidential
                            </span>
                          )}
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div style={styles.inputBar}>
              {activeConv.confidentialMode && (
                <div style={styles.inputConfidentialIndicator}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Messages are confidential and covered by NDA
                </div>
              )}
              <div style={styles.inputRow}>
                <input
                  ref={inputRef}
                  style={{
                    ...styles.messageInput,
                    ...(activeConv.confidentialMode ? styles.messageInputConfidential : {}),
                  }}
                  type="text"
                  placeholder={activeConv.confidentialMode ? "Type a confidential message..." : "Type a message..."}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    ...(messageInput.trim() ? styles.sendBtnActive : styles.sendBtnInactive),
                    ...(activeConv.confidentialMode ? styles.sendBtnConfidential : {}),
                  }}
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  /* Auth */
  authPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
  },
  authCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
  },
  authLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  authTitle: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 4px",
    letterSpacing: "-0.5px",
  },
  authSubtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#64748b",
    margin: "0 0 32px",
  },
  authTabs: {
    display: "flex",
    background: "#f1f5f9",
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  authTab: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  authTabActive: {
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
    fontWeight: 600,
  },
  authForm: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  authField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  authLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    letterSpacing: "0.01em",
  },
  authInput: {
    padding: "12px 14px",
    borderRadius: 8,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    transition: "border-color 0.15s",
    background: "#fafafa",
  },
  authError: {
    fontSize: 13,
    color: "#dc2626",
    margin: 0,
    padding: "10px 12px",
    background: "#fef2f2",
    borderRadius: 6,
    border: "1px solid #fecaca",
  },
  authSubmit: {
    padding: "14px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    letterSpacing: "0.02em",
  },
  authSubmitDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  /* App Container */
  appContainer: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "#f8fafc",
  },

  /* Sidebar */
  sidebar: {
    width: 340,
    minWidth: 300,
    background: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    background: "#0f172a",
  },
  sidebarBrand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 20,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-0.3px",
  },
  sidebarActions: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "none",
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  userBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
  },
  userBarInfo: {
    flex: 1,
    minWidth: 0,
  },
  userBarEmail: {
    fontSize: 12,
    color: "#94a3b8",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logoutBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },

  newChatBox: {
    padding: "16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  newChatLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    margin: "0 0 8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  newChatInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid #e2e8f0",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
  },
  newChatError: {
    fontSize: 12,
    color: "#dc2626",
    margin: "6px 0 0",
  },
  newChatActions: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  newChatCancel: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 7,
    border: "1.5px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  newChatStart: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 7,
    border: "none",
    background: "#1e3a5f",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  convList: {
    flex: 1,
    overflowY: "auto",
  },
  emptyConvs: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
    gap: 8,
  },
  emptyConvsText: {
    fontSize: 14,
    color: "#94a3b8",
    margin: "8px 0 0",
    fontWeight: 500,
  },
  emptyConvsHint: {
    fontSize: 13,
    color: "#cbd5e1",
    margin: 0,
  },
  convItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.1s",
  },
  convItemActive: {
    background: "#eff6ff",
    borderLeft: "3px solid #1e3a5f",
  },
  convItemContent: {
    flex: 1,
    minWidth: 0,
  },
  convItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  convItemName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
    textTransform: "capitalize",
  },
  convItemTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  convItemFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  convItemPreview: {
    fontSize: 13,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  confiBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#b45309",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 4,
    padding: "1px 5px",
    letterSpacing: "0.05em",
    flexShrink: 0,
  },

  /* Avatar */
  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    letterSpacing: "0.05em",
  },

  /* Chat Area */
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f8fafc",
  },

  noChatSelected: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
  },
  noChatIcon: {
    marginBottom: 8,
    opacity: 0.4,
  },
  noChatTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: "#334155",
    margin: 0,
  },
  noChatText: {
    fontSize: 14,
    color: "#94a3b8",
    margin: 0,
    textAlign: "center",
  },
  noChatBtn: {
    marginTop: 8,
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    background: "#1e3a5f",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },

  chatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    gap: 16,
    transition: "background 0.3s",
  },
  chatHeaderConfidential: {
    background: "#fffbeb",
    borderBottom: "1px solid #fde68a",
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
    color: "#0f172a",
    textTransform: "capitalize",
  },
  chatHeaderEmail: {
    fontSize: 12,
    color: "#64748b",
  },
  chatHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  ndaActiveBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 700,
    color: "#92400e",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "5px 10px",
    letterSpacing: "0.05em",
  },
  confidentialToggle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  confidentialLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
    whiteSpace: "nowrap",
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s",
    flexShrink: 0,
    padding: 0,
  },
  toggleBtnOn: {
    background: "#92400e",
  },
  toggleBtnOff: {
    background: "#cbd5e1",
  },
  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "left 0.2s",
  },
  toggleKnobOn: {
    left: 22,
  },
  toggleKnobOff: {
    left: 2,
  },

  ndaInfoBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    background: "#fffbeb",
    borderBottom: "1px solid #fde68a",
    fontSize: 12,
    color: "#92400e",
    fontWeight: 500,
  },

  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  messagesAreaConfidential: {
    background: "#fffdf4",
  },

  emptyMessages: {
    textAlign: "center",
    padding: "32px 24px",
    margin: "auto",
    maxWidth: 400,
  },
  emptyMessagesText: {
    fontSize: 15,
    color: "#475569",
    margin: "0 0 8px",
  },
  emptyMessagesHint: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
  },

  dateSeparator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 0",
  },
  dateSeparatorText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 500,
    background: "#f1f5f9",
    padding: "4px 12px",
    borderRadius: 12,
  },

  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  messageRowOwn: {
    flexDirection: "row-reverse",
  },
  msgAvatar: {
    width: 28,
    height: 28,
    fontSize: 10,
    marginBottom: 2,
  },
  messageBubbleWrapper: {
    maxWidth: "65%",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  messageBubble: {
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  messageBubbleOwn: {
    background: "#1e3a5f",
    color: "#ffffff",
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    borderBottomLeftRadius: 4,
  },
  messageBubbleConfidential: {
    borderLeft: "3px solid #b45309",
  },
  messageTime: {
    fontSize: 11,
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  messageTimeOwn: {
    flexDirection: "row-reverse",
  },
  msgConfidentialTag: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    color: "#b45309",
    fontSize: 10,
    fontWeight: 600,
  },

  inputBar: {
    padding: "0 24px 24px",
    background: "#ffffff",
    borderTop: "1px solid #e2e8f0",
    paddingTop: 16,
  },
  inputConfidentialIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#b45309",
    fontWeight: 600,
    marginBottom: 10,
    letterSpacing: "0.02em",
  },
  inputRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  messageInput: {
    flex: 1,
    padding: "13px 18px",
    borderRadius: 24,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    background: "#f8fafc",
    transition: "border-color 0.15s",
  },
  messageInputConfidential: {
    border: "1.5px solid #fde68a",
    background: "#fffbeb",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  sendBtnActive: {
    background: "#1e3a5f",
    color: "#ffffff",
  },
  sendBtnInactive: {
    background: "#e2e8f0",
    color: "#94a3b8",
    cursor: "not-allowed",
  },
  sendBtnConfidential: {
    background: "#92400e",
    color: "#ffffff",
  },

  /* Modal */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 24,
  },
  ndaModal: {
    background: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 680,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
  },
  ndaHeader: {
    padding: "28px 32px 20px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "center",
    background: "#0f172a",
  },
  ndaHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: "rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    color: "#ffffff",
  },
  ndaTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  ndaSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  ndaBody: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 32px",
  },
  ndaMetaRow: {
    display: "flex",
    gap: 24,
    marginBottom: 24,
    padding: "16px",
    background: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  ndaMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  ndaMetaLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  ndaMetaValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 600,
  },
  ndaSection: {
    marginBottom: 20,
  },
  ndaSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    margin: "0 0 8px",
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: 6,
  },
  ndaText: {
    fontSize: 13.5,
    color: "#374151",
    lineHeight: 1.7,
    margin: 0,
  },
  ndaWarningBox: {
    marginTop: 20,
    padding: "14px 16px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 8,
    borderLeft: "4px solid #b45309",
  },
  ndaWarningText: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.5,
  },
  ndaFooter: {
    display: "flex",
    gap: 12,
    padding: "20px 32px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  ndaDeclineBtn: {
    flex: 1,
    padding: "13px",
    borderRadius: 8,
    border: "1.5px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  ndaAcceptBtn: {
    flex: 2,
    padding: "13px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.02em",
  },
};