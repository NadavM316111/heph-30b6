"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  confidential: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  confidentialMode: boolean;
  ndaAccepted: boolean;
  messages: Message[];
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Alice Mercer",
    avatar: "AM",
    lastMessage: "See you at the meeting tomorrow.",
    timestamp: Date.now() - 1000 * 60 * 5,
    unread: 2,
    confidentialMode: false,
    ndaAccepted: false,
    messages: [
      {
        id: "m1",
        sender: "Alice Mercer",
        text: "Hey, are you available tomorrow?",
        timestamp: Date.now() - 1000 * 60 * 10,
        confidential: false,
      },
      {
        id: "m2",
        sender: "me",
        text: "Yes, what time works for you?",
        timestamp: Date.now() - 1000 * 60 * 8,
        confidential: false,
      },
      {
        id: "m3",
        sender: "Alice Mercer",
        text: "See you at the meeting tomorrow.",
        timestamp: Date.now() - 1000 * 60 * 5,
        confidential: false,
      },
    ],
  },
  {
    id: "2",
    name: "Board Legal Team",
    avatar: "BL",
    lastMessage: "The acquisition terms are ready for review.",
    timestamp: Date.now() - 1000 * 60 * 30,
    unread: 1,
    confidentialMode: true,
    ndaAccepted: true,
    messages: [
      {
        id: "m4",
        sender: "Board Legal Team",
        text: "The acquisition terms are ready for review.",
        timestamp: Date.now() - 1000 * 60 * 30,
        confidential: true,
      },
    ],
  },
  {
    id: "3",
    name: "Marcus Webb",
    avatar: "MW",
    lastMessage: "Got it, I will send the report by Friday.",
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    unread: 0,
    confidentialMode: false,
    ndaAccepted: false,
    messages: [
      {
        id: "m5",
        sender: "Marcus Webb",
        text: "Can you send me the Q3 report?",
        timestamp: Date.now() - 1000 * 60 * 60 * 3,
        confidential: false,
      },
      {
        id: "m6",
        sender: "me",
        text: "Sure, I will get to it.",
        timestamp: Date.now() - 1000 * 60 * 60 * 2.5,
        confidential: false,
      },
      {
        id: "m7",
        sender: "Marcus Webb",
        text: "Got it, I will send the report by Friday.",
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        confidential: false,
      },
    ],
  },
];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatConvoTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 1000 * 60 * 60 * 24) return formatTime(timestamp);
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("confi_conversations");
      if (saved) return JSON.parse(saved);
    }
    return INITIAL_CONVERSATIONS;
  });

  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [ndaPendingConvoId, setNdaPendingConvoId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConvo = conversations.find((c) => c.id === activeConvoId) || null;

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    });
    const savedEmail = localStorage.getItem("confi_email");
    if (savedEmail) setUserEmail(savedEmail);
  }, []);

  useEffect(() => {
    localStorage.setItem("confi_conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages]);

  function handleAuth() {
    setAuthError("");
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: authMode, email: authEmail, password: authPassword }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setUserEmail(data.email);
          localStorage.setItem("confi_email", data.email);
          setShowAuth(false);
          setAuthEmail("");
          setAuthPassword("");
        } else {
          setAuthError(data.error || "Authentication failed.");
        }
      });
  }

  function handleLogout() {
    setUserEmail(null);
    localStorage.removeItem("confi_email");
  }

  function selectConvo(id: string) {
    setActiveConvoId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
    if (window.innerWidth < 768) setSidebarVisible(false);
  }

  function sendMessage() {
    if (!inputText.trim() || !activeConvoId) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      sender: "me",
      text: inputText.trim(),
      timestamp: Date.now(),
      confidential: activeConvo?.confidentialMode || false,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvoId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: newMsg.text,
              timestamp: newMsg.timestamp,
            }
          : c
      )
    );
    setInputText("");
  }

  function toggleConfidentialMode(convoId: string) {
    const convo = conversations.find((c) => c.id === convoId);
    if (!convo) return;
    if (!convo.confidentialMode && !convo.ndaAccepted) {
      setNdaPendingConvoId(convoId);
      setShowNdaModal(true);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId ? { ...c, confidentialMode: !c.confidentialMode } : c
        )
      );
    }
  }

  function acceptNda() {
    if (!ndaPendingConvoId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === ndaPendingConvoId
          ? { ...c, confidentialMode: true, ndaAccepted: true }
          : c
      )
    );
    setShowNdaModal(false);
    setNdaPendingConvoId(null);
  }

  function declineNda() {
    setShowNdaModal(false);
    setNdaPendingConvoId(null);
  }

  function createNewChat() {
    if (!newChatName.trim()) return;
    const initials = newChatName
      .trim()
      .split(" ")
      .map((w) => w[0]?.toUpperCase() || "")
      .slice(0, 2)
      .join("");
    const newConvo: Conversation = {
      id: `c${Date.now()}`,
      name: newChatName.trim(),
      avatar: initials || "??",
      lastMessage: "",
      timestamp: Date.now(),
      unread: 0,
      confidentialMode: false,
      ndaAccepted: false,
      messages: [],
    };
    setConversations((prev) => [newConvo, ...prev]);
    setShowNewChat(false);
    setNewChatName("");
    setActiveConvoId(newConvo.id);
    if (window.innerWidth < 768) setSidebarVisible(false);
  }

  return (
    <div style={styles.root}>
      {/* AUTH MODAL */}
      {showAuth && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>
              {authMode === "login" ? "Sign In" : "Create Account"}
            </h2>
            <input
              style={styles.modalInput}
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              style={styles.modalInput}
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
            {authError && <p style={styles.errorText}>{authError}</p>}
            <button style={styles.primaryBtn} onClick={handleAuth}>
              {authMode === "login" ? "Sign In" : "Sign Up"}
            </button>
            <button
              style={styles.linkBtn}
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
            >
              {authMode === "login"
                ? "No account? Sign Up"
                : "Have an account? Sign In"}
            </button>
            <button style={styles.ghostBtn} onClick={() => setShowAuth(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* NDA MODAL */}
      {showNdaModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={styles.ndaBadge}>CONFIDENTIAL</div>
            <h2 style={styles.modalTitle}>International Non-Disclosure Agreement</h2>
            <p style={styles.ndaSubtitle}>
              By enabling Confidential Mode, you are entering into a legally
              binding Non-Disclosure Agreement. Please read carefully.
            </p>
            <div style={styles.ndaScroll}>
              <p style={styles.ndaSection}><strong>INTERNATIONAL NON-DISCLOSURE AGREEMENT</strong></p>
              <p style={styles.ndaText}>
                This Non-Disclosure Agreement ("Agreement") is entered into as of
                the date of acceptance between the parties to this conversation
                ("Disclosing Party" and "Receiving Party"), collectively referred
                to as "Parties."
              </p>
              <p style={styles.ndaSection}>1. DEFINITION OF CONFIDENTIAL INFORMATION</p>
              <p style={styles.ndaText}>
                "Confidential Information" means any data or information, oral or
                written, disclosed by either Party that is designated as
                confidential or that reasonably should be understood to be
                confidential given the nature of the information and circumstances
                of disclosure, including but not limited to: business strategies,
                financial data, trade secrets, personal data, proprietary
                technology, client lists, and any communications exchanged while
                Confidential Mode is active within this application.
              </p>
              <p style={styles.ndaSection}>2. OBLIGATIONS OF RECEIVING PARTY</p>
              <p style={styles.ndaText}>
                The Receiving Party agrees to: (a) hold all Confidential
                Information in strict confidence; (b) not disclose Confidential
                Information to any third party without prior written consent; (c)
                use Confidential Information solely for the purpose of this
                communication; (d) protect Confidential Information using the same
                degree of care used to protect its own confidential information,
                but in no event less than reasonable care.
              </p>
              <p style={styles.ndaSection}>3. INTERNATIONAL JURISDICTION</p>
              <p style={styles.ndaText}>
                This Agreement shall be governed by and construed in accordance
                with applicable international law, including but not limited to
                the United Nations Convention on Contracts for the International
                Sale of Goods (CISG) where applicable, GDPR for EU residents, and
                equivalent data protection legislation in relevant jurisdictions.
                Disputes shall be resolved through binding international
                arbitration under the UNCITRAL Arbitration Rules.
              </p>
              <p style={styles.ndaSection}>4. TERM</p>
              <p style={styles.ndaText}>
                This Agreement shall remain in effect for a period of five (5)
                years from the date of acceptance, or until all Confidential
                Information disclosed hereunder ceases to be confidential through
                no breach of this Agreement, whichever occurs first.
              </p>
              <p style={styles.ndaSection}>5. REMEDIES</p>
              <p style={styles.ndaText}>
                The Parties acknowledge that any breach of this Agreement may
                cause irreparable harm and that monetary damages may be
                insufficient. Accordingly, the Disclosing Party shall be entitled
                to seek equitable relief, including injunction and specific
                performance, in addition to all other remedies available at law or
                in equity.
              </p>
              <p style={styles.ndaSection}>6. EXCEPTIONS</p>
              <p style={styles.ndaText}>
                Confidentiality obligations do not apply to information that: (a)
                is or becomes publicly available through no fault of the Receiving
                Party; (b) was known to the Receiving Party prior to disclosure;
                (c) is independently developed by the Receiving Party; or (d) is
                required to be disclosed by law or court order.
              </p>
              <p style={styles.ndaSection}>7. ENTIRE AGREEMENT</p>
              <p style={styles.ndaText}>
                This Agreement constitutes the entire agreement between the Parties
                with respect to confidentiality and supersedes all prior
                discussions and agreements. By clicking "I Accept," each Party
                acknowledges they have read, understood, and agree to be bound by
                this Agreement.
              </p>
            </div>
            <div style={styles.ndaActions}>
              <button style={styles.dangerBtn} onClick={declineNda}>
                Decline
              </button>
              <button style={styles.primaryBtn} onClick={acceptNda}>
                I Accept — Enable Confidential Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CHAT MODAL */}
      {showNewChat && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={styles.modalTitle}>New Conversation</h2>
            <input
              style={styles.modalInput}
              placeholder="Contact name"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNewChat()}
            />
            <button style={styles.primaryBtn} onClick={createNewChat}>
              Start Conversation
            </button>
            <button style={styles.ghostBtn} onClick={() => setShowNewChat(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div style={styles.layout}>
        {/* SIDEBAR */}
        {(sidebarVisible || !activeConvoId) && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <span style={styles.appName}>Confi</span>
              <div style={styles.headerActions}>
                {userEmail ? (
                  <button style={styles.iconBtn} onClick={handleLogout} title="Sign out">
                    Sign Out
                  </button>
                ) : (
                  <button style={styles.iconBtn} onClick={() => setShowAuth(true)} title="Sign in">
                    Sign In
                  </button>
                )}
                <button
                  style={styles.iconBtn}
                  onClick={() => setShowNewChat(true)}
                  title="New conversation"
                >
                  + New
                </button>
              </div>
            </div>
            {userEmail && (
              <div style={styles.userBanner}>{userEmail}</div>
            )}
            <div style={styles.convoList}>
              {conversations
                .slice()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((convo) => (
                  <div
                    key={convo.id}
                    style={{
                      ...styles.convoItem,
                      background:
                        convo.id === activeConvoId ? "#e8f0fe" : "transparent",
                      borderLeft:
                        convo.id === activeConvoId
                          ? "3px solid #1a73e8"
                          : "3px solid transparent",
                    }}
                    onClick={() => selectConvo(convo.id)}
                  >
                    <div
                      style={{
                        ...styles.avatar,
                        background: convo.confidentialMode ? "#1a1a2e" : "#1a73e8",
                      }}
                    >
                      {convo.avatar}
                    </div>
                    <div style={styles.convoMeta}>
                      <div style={styles.convoTop}>
                        <span style={styles.convoName}>{convo.name}</span>
                        <span style={styles.convoTime}>
                          {formatConvoTime(convo.timestamp)}
                        </span>
                      </div>
                      <div style={styles.convoBottom}>
                        <span style={styles.convoLast}>
                          {convo.confidentialMode && convo.lastMessage
                            ? "[ Confidential message ]"
                            : convo.lastMessage || "No messages yet"}
                        </span>
                        {convo.unread > 0 && (
                          <span style={styles.badge}>{convo.unread}</span>
                        )}
                        {convo.confidentialMode && (
                          <span style={styles.confiBadge}>NDA</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* CHAT AREA */}
        <div style={styles.chatArea}>
          {!activeConvo ? (
            <div style={styles.noChatSelected}>
              <div style={styles.noChatIcon}>C</div>
              <h2 style={styles.noChatTitle}>Confi Messaging</h2>
              <p style={styles.noChatSub}>
                Select a conversation to start messaging. Enable Confidential Mode
                to activate an international NDA that protects your conversation.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <div
                style={{
                  ...styles.chatHeader,
                  background: activeConvo.confidentialMode ? "#1a1a2e" : "#fff",
                  color: activeConvo.confidentialMode ? "#fff" : "#1a1a1a",
                  borderBottom: activeConvo.confidentialMode
                    ? "1px solid #333"
                    : "1px solid #e0e0e0",
                }}
              >
                {!sidebarVisible && (
                  <button
                    style={{
                      ...styles.backBtn,
                      color: activeConvo.confidentialMode ? "#fff" : "#1a1a1a",
                    }}
                    onClick={() => setSidebarVisible(true)}
                  >
                    Back
                  </button>
                )}
                <div
                  style={{
                    ...styles.avatar,
                    background: activeConvo.confidentialMode ? "#333" : "#1a73e8",
                  }}
                >
                  {activeConvo.avatar}
                </div>
                <div style={styles.chatHeaderMeta}>
                  <span style={styles.chatHeaderName}>{activeConvo.name}</span>
                  {activeConvo.confidentialMode && (
                    <span style={styles.ndaActive}>
                      CONFIDENTIAL MODE — NDA ACTIVE
                    </span>
                  )}
                </div>
                <div style={styles.confidentialToggleArea}>
                  <span
                    style={{
                      fontSize: 11,
                      marginRight: 8,
                      color: activeConvo.confidentialMode ? "#aaa" : "#666",
                    }}
                  >
                    Confidential
                  </span>
                  <button
                    onClick={() => toggleConfidentialMode(activeConvo.id)}
                    style={{
                      ...styles.toggle,
                      background: activeConvo.confidentialMode
                        ? "#c62828"
                        : "#ccc",
                    }}
                    title={
                      activeConvo.confidentialMode
                        ? "Disable Confidential Mode"
                        : "Enable Confidential Mode"
                    }
                  >
                    <span
                      style={{
                        ...styles.toggleKnob,
                        transform: activeConvo.confidentialMode
                          ? "translateX(20px)"
                          : "translateX(0px)",
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* NDA ACTIVE BANNER */}
              {activeConvo.confidentialMode && (
                <div style={styles.ndaBanner}>
                  This conversation is protected by an International Non-Disclosure
                  Agreement. All messages are confidential and legally binding.
                </div>
              )}

              {/* MESSAGES */}
              <div
                style={{
                  ...styles.messages,
                  background: activeConvo.confidentialMode ? "#0d0d1a" : "#f0f4f8",
                }}
              >
                {activeConvo.messages.length === 0 && (
                  <div style={styles.noMessages}>
                    No messages yet. Say hello.
                  </div>
                )}
                {activeConvo.messages.map((msg) => {
                  const isMe = msg.sender === "me";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.msgRow,
                        justifyContent: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      {msg.confidential && !isMe && (
                        <div style={styles.msgConfidentialDot} />
                      )}
                      <div
                        style={{
                          ...styles.msgBubble,
                          background: isMe
                            ? msg.confidential
                              ? "#4a0000"
                              : "#1a73e8"
                            : msg.confidential
                            ? "#1a0a2e"
                            : "#fff",
                          color: isMe
                            ? "#fff"
                            : msg.confidential
                            ? "#ddd"
                            : "#1a1a1a",
                          borderRadius: isMe
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          border: msg.confidential
                            ? "1px solid #555"
                            : "none",
                        }}
                      >
                        {msg.confidential && (
                          <div style={styles.msgConfidentialLabel}>
                            CONFIDENTIAL
                          </div>
                        )}
                        <p style={styles.msgText}>{msg.text}</p>
                        <span style={styles.msgTime}>
                          {formatTime(msg.timestamp)}
                          {msg.confidential && " — NDA Protected"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT */}
              <div
                style={{
                  ...styles.inputArea,
                  background: activeConvo.confidentialMode ? "#1a1a2e" : "#fff",
                  borderTop: activeConvo.confidentialMode
                    ? "1px solid #333"
                    : "1px solid #e0e0e0",
                }}
              >
                {activeConvo.confidentialMode && (
                  <span style={styles.inputConfidentialTag}>NDA</span>
                )}
                <input
                  style={{
                    ...styles.textInput,
                    background: activeConvo.confidentialMode ? "#0d0d1a" : "#f5f5f5",
                    color: activeConvo.confidentialMode ? "#fff" : "#1a1a1a",
                    border: activeConvo.confidentialMode
                      ? "1px solid #555"
                      : "1px solid #ddd",
                  }}
                  placeholder={
                    activeConvo.confidentialMode
                      ? "Type a confidential message..."
                      : "Type a message..."
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    background: activeConvo.confidentialMode ? "#c62828" : "#1a73e8",
                  }}
                  onClick={sendMessage}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: "#f0f4f8",
    overflow: "hidden",
  },
  layout: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 340,
    minWidth: 280,
    maxWidth: 340,
    background: "#fff",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flexShrink: 0,
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px",
    borderBottom: "1px solid #e0e0e0",
    background: "#fff",
  },
  appName: {
    fontWeight: 700,
    fontSize: 22,
    color: "#1a1a1a",
    letterSpacing: 1,
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  iconBtn: {
    padding: "6px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#f5f5f5",
    cursor: "pointer",
    fontSize: 13,
    color: "#444",
  },
  userBanner: {
    padding: "6px 16px",
    background: "#e8f0fe",
    fontSize: 12,
    color: "#1a73e8",
    borderBottom: "1px solid #d0dff8",
  },
  convoList: {
    flex: 1,
    overflowY: "auto",
  },
  convoItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#1a73e8",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  convoMeta: {
    flex: 1,
    overflow: "hidden",
  },
  convoTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  convoName: {
    fontWeight: 600,
    fontSize: 15,
    color: "#1a1a1a",
  },
  convoTime: {
    fontSize: 11,
    color: "#888",
  },
  convoBottom: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  convoLast: {
    fontSize: 13,
    color: "#666",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badge: {
    background: "#1a73e8",
    color: "#fff",
    borderRadius: "50%",
    width: 18,
    height: 18,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },
  confiBadge: {
    background: "#c62828",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 5px",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  noChatSelected: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#888",
    padding: 40,
  },
  noChatIcon: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "#1a73e8",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 36,
    fontWeight: 700,
    marginBottom: 20,
  },
  noChatTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 12,
  },
  noChatSub: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    maxWidth: 400,
    lineHeight: 1.6,
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 20px",
    gap: 12,
    flexShrink: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    marginRight: 4,
    padding: "4px 8px",
  },
  chatHeaderMeta: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  chatHeaderName: {
    fontWeight: 700,
    fontSize: 16,
  },
  ndaActive: {
    fontSize: 10,
    color: "#ff5252",
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  confidentialToggleArea: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s",
    padding: 0,
    display: "flex",
    alignItems: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    left: 2,
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  ndaBanner: {
    background: "#7b0000",
    color: "#ffcdd2",
    padding: "8px 20px",
    fontSize: 12,
    textAlign: "center",
    fontWeight: 500,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  noMessages: {
    textAlign: "center",
    color: "#888",
    fontSize: 14,
    marginTop: 40,
  },
  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
  },
  msgConfidentialDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#c62828",
    flexShrink: 0,
    marginBottom: 12,
  },
  msgBubble: {
    maxWidth: "68%",
    padding: "10px 14px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
  },
  msgConfidentialLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#ff5252",
    letterSpacing: 1,
    marginBottom: 4,
  },
  msgText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  msgTime: {
    display: "block",
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
    textAlign: "right",
  },
  inputArea: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    gap: 10,
    flexShrink: 0,
  },
  inputConfidentialTag: {
    background: "#c62828",
    color: "#fff",
    borderRadius: 4,
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 24,
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 24,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modalBox: {
    background: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a1a",
    textAlign: "center",
  },
  modalInput: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  primaryBtn: {
    padding: "12px",
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  dangerBtn: {
    padding: "12px",
    background: "#c62828",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    flex: 1,
  },
  ghostBtn: {
    padding: "10px",
    background: "transparent",
    color: "#666",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#1a73e8",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center" as const,
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
  },
  ndaBadge: {
    background: "#7b0000",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    textAlign: "center" as const,
    alignSelf: "center",
  },
  ndaSubtitle: {
    fontSize: 13,
    color: "#555",
    textAlign: "center" as const,
    lineHeight: 1.5,
    margin: 0,
  },
  ndaScroll: {
    background: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: "16px 18px",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#333",
    maxHeight: 300,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  ndaSection: {
    fontWeight: 700,
    color: "#1a1a1a",
    fontSize: 12,
    margin: 0,
    marginTop: 6,
  },
  ndaText: {
    margin: 0,
    color: "#444",
  },
  ndaActions: {
    display: "flex",
    gap: 10,
  },
};