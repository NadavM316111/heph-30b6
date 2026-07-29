"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CONTACTS } from "@/lib/contacts";
import { logAuditEvent } from "@/lib/audit";

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isConfidential: boolean;
}

interface Conversation {
  id: string;
  contactId: string;
  messages: Message[];
  confidentialMode: boolean;
  ndaActivatedAt?: number;
  ndaActivatedBy?: string;
}

interface Props {
  user: { email: string; displayName: string; avatar: string };
  fingerprint: string;
  onLogout: () => void;
}

export default function MessagingApp({ user, fingerprint, onLogout }: Props) {
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [pendingConfidentialToggle, setPendingConfidentialToggle] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`confi_convs_${user.email}`);
    if (stored) {
      setConversations(JSON.parse(stored));
    }
  }, [user.email]);

  const saveConversations = useCallback((convs: Record<string, Conversation>) => {
    setConversations(convs);
    localStorage.setItem(`confi_convs_${user.email}`, JSON.stringify(convs));
  }, [user.email]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, conversations]);

  const openConversation = (contactId: string) => {
    const convId = [user.email, contactId].sort().join("__");
    if (!conversations[convId]) {
      const newConvs = {
        ...conversations,
        [convId]: {
          id: convId,
          contactId,
          messages: [],
          confidentialMode: false,
        },
      };
      saveConversations(newConvs);
    }
    setActiveConvId(convId);
    setSidebarOpen(false);
  };

  const sendMessage = () => {
    if (!messageText.trim() || !activeConvId) return;
    const conv = conversations[activeConvId];
    const msg: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      senderId: user.email,
      text: messageText.trim(),
      timestamp: Date.now(),
      isConfidential: conv.confidentialMode,
    };
    const updated = {
      ...conversations,
      [activeConvId]: {
        ...conv,
        messages: [...conv.messages, msg],
      },
    };
    saveConversations(updated);
    setMessageText("");

    if (conv.confidentialMode) {
      logAuditEvent({
        type: "CONFIDENTIAL_MESSAGE_SENT",
        email: user.email,
        fingerprint,
        metadata: {
          conversationId: activeConvId,
          messageId: msg.id,
          timestamp: msg.timestamp,
        },
      });

      setTimeout(() => {
        const contact = CONTACTS.find(c => c.id === conv.contactId);
        const reply: Message = {
          id: `msg_${Date.now()}_reply`,
          senderId: conv.contactId,
          text: getAutoReply(true),
          timestamp: Date.now(),
          isConfidential: true,
        };
        setConversations(prev => {
          const next = {
            ...prev,
            [activeConvId]: {
              ...prev[activeConvId],
              messages: [...prev[activeConvId].messages, reply],
            },
          };
          localStorage.setItem(`confi_convs_${user.email}`, JSON.stringify(next));
          return next;
        });
        if (contact) {
          logAuditEvent({
            type: "CONFIDENTIAL_MESSAGE_RECEIVED",
            email: user.email,
            fingerprint,
            metadata: { conversationId: activeConvId, messageId: reply.id },
          });
        }
      }, 1200 + Math.random() * 800);
    } else {
      setTimeout(() => {
        const reply: Message = {
          id: `msg_${Date.now()}_reply`,
          senderId: conv.contactId,
          text: getAutoReply(false),
          timestamp: Date.now(),
          isConfidential: false,
        };
        setConversations(prev => {
          const next = {
            ...prev,
            [activeConvId]: {
              ...prev[activeConvId],
              messages: [...prev[activeConvId].messages, reply],
            },
          };
          localStorage.setItem(`confi_convs_${user.email}`, JSON.stringify(next));
          return next;
        });
      }, 1000 + Math.random() * 1000);
    }
  };

  const initiateConfidentialToggle = () => {
    setPendingConfidentialToggle(true);
    setShowNdaModal(true);
  };

  const confirmNdaActivation = async () => {
    if (!activeConvId) return;
    const conv = conversations[activeConvId];
    const newMode = !conv.confidentialMode;
    const updated = {
      ...conversations,
      [activeConvId]: {
        ...conv,
        confidentialMode: newMode,
        ndaActivatedAt: newMode ? Date.now() : conv.ndaActivatedAt,
        ndaActivatedBy: newMode ? user.email : conv.ndaActivatedBy,
      },
    };
    saveConversations(updated);
    await logAuditEvent({
      type: newMode ? "NDA_ACTIVATED" : "NDA_DEACTIVATED",
      email: user.email,
      fingerprint,
      metadata: {
        conversationId: activeConvId,
        activatedAt: newMode ? new Date().toISOString() : null,
        contactId: conv.contactId,
      },
    });
    if (newMode) {
      const systemMsg: Message = {
        id: `sys_${Date.now()}`,
        senderId: "SYSTEM",
        text: `🔒 CONFIDENTIAL MODE ACTIVATED\n\nAn International NDA is now in effect for this conversation. All messages from this point are legally confidential. Activated by ${user.displayName} at ${new Date().toLocaleString()}.\n\nReference: NDA-${activeConvId.slice(0, 8).toUpperCase()}-${Date.now()}`,
        timestamp: Date.now(),
        isConfidential: true,
      };
      setConversations(prev => {
        const next = {
          ...prev,
          [activeConvId]: {
            ...prev[activeConvId],
            messages: [...prev[activeConvId].messages, systemMsg],
          },
        };
        localStorage.setItem(`confi_convs_${user.email}`, JSON.stringify(next));
        return next;
      });
    }
    setShowNdaModal(false);
    setPendingConfidentialToggle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeConv = activeConvId ? conversations[activeConvId] : null;
  const activeContact = activeConv ? CONTACTS.find(c => c.id === activeConv.contactId) : null;

  return (
    <div style={styles.appContainer}>
      {/* Sidebar */}
      <div style={{ ...styles.sidebar, ...(sidebarOpen ? {} : styles.sidebarHidden) }}>
        <div style={styles.sidebarHeader}>
          <div style={styles.userInfo} onClick={() => setShowProfile(true)}>
            <span style={styles.userAvatar}>{user.avatar}</span>
            <div>
              <div style={styles.userName}>{user.displayName}</div>
              <div style={styles.userEmail}>{user.email}</div>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={onLogout} title="Logout">↗</button>
        </div>
        <div style={styles.searchBar}>
          <input style={styles.searchInput} placeholder="🔍  Search conversations..." readOnly />
        </div>
        <div style={styles.contactList}>
          <div style={styles.sectionLabel}>Contacts</div>
          {CONTACTS.map(contact => {
            const convId = [user.email, contact.id].sort().join("__");
            const conv = conversations[convId];
            const lastMsg = conv?.messages[conv.messages.length - 1];
            return (
              <div
                key={contact.id}
                style={{
                  ...styles.contactItem,
                  ...(activeConvId === convId ? styles.contactItemActive : {}),
                }}
                onClick={() => openConversation(contact.id)}
              >
                <div style={styles.contactAvatar}>
                  {contact.avatar}
                  {conv?.confidentialMode && <span style={styles.confidentialDot}>🔒</span>}
                </div>
                <div style={styles.contactInfo}>
                  <div style={styles.contactName}>{contact.name}</div>
                  <div style={styles.contactPreview}>
                    {lastMsg ? (lastMsg.senderId === user.email ? "You: " : "") + (lastMsg.isConfidential ? "🔒 [Confidential]" : lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? "…" : "")) : contact.status}
                  </div>
                </div>
                {lastMsg && (
                  <div style={styles.contactTime}>{formatTime(lastMsg.timestamp)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.chatArea}>
        {activeConv && activeContact ? (
          <>
            {/* Chat Header */}
            <div style={{ ...styles.chatHeader, ...(activeConv.confidentialMode ? styles.chatHeaderConfidential : {}) }}>
              <button style={styles.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
              <div style={styles.chatHeaderAvatar}>{activeContact.avatar}</div>
              <div style={styles.chatHeaderInfo}>
                <div style={styles.chatHeaderName}>{activeContact.name}</div>
                <div style={styles.chatHeaderStatus}>
                  {activeConv.confidentialMode
                    ? `🔒 NDA Active • ${new Date(activeConv.ndaActivatedAt!).toLocaleDateString()}`
                    : activeContact.status}
                </div>
              </div>
              <button
                style={{
                  ...styles.confidentialToggle,
                  ...(activeConv.confidentialMode ? styles.confidentialToggleActive : {}),
                }}
                onClick={initiateConfidentialToggle}
                title={activeConv.confidentialMode ? "Deactivate Confidential Mode" : "Activate Confidential Mode (NDA)"}
              >
                {activeConv.confidentialMode ? "🔒 NDA Active" : "🔓 Confidential"}
              </button>
            </div>

            {/* Messages */}
            <div style={{ ...styles.messages, ...(activeConv.confidentialMode ? styles.messagesConfidential : {}) }}>
              {activeConv.confidentialMode && (
                <div style={styles.ndaBanner}>
                  <strong>🛡️ International NDA in Effect</strong><br />
                  <small>All messages in this conversation are legally confidential. Reference: NDA-{activeConvId?.slice(0, 8).toUpperCase()}</small>
                </div>
              )}
              {activeConv.messages.length === 0 && (
                <div style={styles.emptyChat}>
                  <span style={{ fontSize: "48px" }}>{activeContact.avatar}</span>
                  <p>Start a conversation with <strong>{activeContact.name}</strong></p>
                  <p style={{ fontSize: "13px", color: "#8892b0" }}>Toggle 🔒 Confidential to activate NDA protection</p>
                </div>
              )}
              {activeConv.messages.map(msg => {
                const isOwn = msg.senderId === user.email;
                const isSystem = msg.senderId === "SYSTEM";
                if (isSystem) {
                  return (
                    <div key={msg.id} style={styles.systemMessage}>
                      <pre style={styles.systemMessageText}>{msg.text}</pre>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} style={{ ...styles.messageRow, ...(isOwn ? styles.messageRowOwn : {}) }}>
                    {!isOwn && <span style={styles.msgAvatar}>{activeContact.avatar}</span>}
                    <div style={{
                      ...styles.messageBubble,
                      ...(isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther),
                      ...(msg.isConfidential ? styles.messageBubbleConfidential : {}),
                    }}>
                      {msg.isConfidential && <div style={styles.confidentialBadge}>🔒 Confidential</div>}
                      <div style={styles.messageText}>{msg.text}</div>
                      <div style={styles.messageTime}>{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ ...styles.inputArea, ...(activeConv.confidentialMode ? styles.inputAreaConfidential : {}) }}>
              {activeConv.confidentialMode && (
                <div style={styles.confidentialIndicator}>🔒 NDA Protected</div>
              )}
              <div style={styles.inputRow}>
                <textarea
                  style={styles.textInput}
                  placeholder={activeConv.confidentialMode ? "🔒 Type confidential message..." : "Type a message..."}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  style={{ ...styles.sendBtn, ...(activeConv.confidentialMode ? styles.sendBtnConfidential : {}) }}
                  onClick={sendMessage}
                  disabled={!messageText.trim()}
                >
                  ➤
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.welcomeScreen}>
            <button style={styles.menuBtn2} onClick={() => setSidebarOpen(true)}>☰ Contacts</button>
            <div style={styles.welcomeContent}>
              <div style={{ fontSize: "80px" }}>🔒</div>
              <h2 style={styles.welcomeTitle}>Confi Messaging</h2>
              <p style={styles.welcomeSubtitle}>Select a contact to start a secure conversation</p>
              <div style={styles.welcomeFeatures}>
                <div style={styles.welcomeFeature}>🛡️ International NDA protection</div>
                <div style={styles.welcomeFeature}>📋 Full audit trail</div>
                <div style={styles.welcomeFeature}>🔐 End-to-end encryption</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NDA Modal */}
      {showNdaModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowNdaModal(false); setPendingConfidentialToggle(false); }}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalIcon}>🔒</div>
            <h3 style={styles.modalTitle}>
              {activeConv?.confidentialMode ? "Deactivate Confidential Mode?" : "Activate Confidential Mode?"}
            </h3>
            {!activeConv?.confidentialMode ? (
              <>
                <p style={styles.modalText}>
                  By activating Confidential Mode, you and <strong>{activeContact?.name}</strong> will enter into a legally binding <strong>International Non-Disclosure Agreement (NDA)</strong>.
                </p>
                <div style={styles.modalNdaBox}>
                  <strong style={{ color: "#ffd700" }}>⚠️ Legal Notice</strong>
                  <p style={styles.modalNdaText}>
                    This NDA is enforceable under international law. All information shared in this conversation from this point forward is designated as legally confidential for a period of <strong>5 years</strong>. Breach may result in legal action.
                  </p>
                  <p style={styles.modalNdaText}>
                    Reference ID: <code style={{ color: "#64ffda" }}>NDA-{activeConvId?.slice(0, 8).toUpperCase()}-{Date.now()}</code>
                  </p>
                </div>
                <p style={{ ...styles.modalText, fontSize: "12px", color: "#8892b0" }}>
                  Your device fingerprint ({fingerprint.slice(0, 16)}...) will be recorded in the audit trail as your electronic signature.
                </p>
              </>
            ) : (
              <p style={styles.modalText}>
                Deactivating Confidential Mode will stop new messages from being covered by the NDA. Previously sent messages remain legally confidential.
              </p>
            )}
            <div style={styles.modalActions}>
              <button style={styles.modalCancelBtn} onClick={() => { setShowNdaModal(false); setPendingConfidentialToggle(false); }}>Cancel</button>
              <button style={styles.modalConfirmBtn} onClick={confirmNdaActivation}>
                {activeConv?.confidentialMode ? "Deactivate" : "I Agree — Activate NDA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div style={styles.modalOverlay} onClick={() => setShowProfile(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "64px", textAlign: "center" }}>{user.avatar}</div>
            <h3 style={styles.modalTitle}>{user.displayName}</h3>
            <p style={{ ...styles.modalText, color: "#8892b0" }}>{user.email}</p>
            <div style={styles.profileAuditInfo}>
              <div style={styles.auditRow}><span>Device ID</span><code style={{ color: "#64ffda", fontSize: "11px" }}>{fingerprint.slice(0, 24)}...</code></div>
              <div style={styles.auditRow}><span>GDPR Status</span><span style={{ color: "#64ffda" }}>✓ Compliant</span></div>
              <div style={styles.auditRow}><span>NDA Accepted</span><span style={{ color: "#64ffda" }}>✓ Yes</span></div>
              <div style={styles.auditRow}><span>Data Stored</span><span style={{ color: "#64ffda" }}>Minimal PII</span></div>
            </div>
            <button style={{ ...styles.primaryBtn, marginTop: "16px", background: "#ff4444" }} onClick={() => { setShowProfile(false); onLogout(); }}>
              Sign Out
            </button>
            <button style={{ ...styles.primaryBtn, marginTop: "8px" }} onClick={() => setShowProfile(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getAutoReply(confidential: boolean): string {
  const normalReplies = [
    "Got it, thanks!",
    "That makes sense.",
    "I'll look into that.",
    "Sounds good!",
    "Let me get back to you on that.",
    "Understood.",
    "Can we discuss this further?",
    "Interesting point.",
  ];
  const confidentialReplies = [
    "Understood. This stays between us.",
    "Acknowledged. NDA terms noted.",
    "Received under confidentiality.",
    "Noted. This information is protected.",
    "Confirmed. Treating this as strictly confidential.",
    "I understand my obligations under our NDA.",
  ];
  const arr = confidential ? confidentialReplies : normalReplies;
  return arr[Math.floor(Math.random() * arr.length)];
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: "flex",
    height: "100vh",
    background: "#1a1a2e",
    overflow: "hidden",
  },
  sidebar: {
    width: "320px",
    minWidth: "320px",
    background: "#16213e",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.3s ease",
  },
  sidebarHidden: {
    transform: "translateX(-100%)",
    position: "absolute",
    zIndex: 100,
    height: "100vh",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(135deg, #0f3460, #16213e)",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    flex: 1,
  },
  userAvatar: {
    fontSize: "32px",
    lineHeight: 1,
  },
  userName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: "15px",
  },
  userEmail: {
    color: "#8892b0",
    fontSize: "12px",
  },
  logoutBtn: {
    background: "transparent",
    border: "none",
    color: "#8892b0",
    cursor: "pointer",
    fontSize: "18px",
    padding: "4px 8px",
  },
  searchBar: {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    color: "#8892b0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  contactList: {
    flex: 1,
    overflowY: "auto",
  },
  sectionLabel: {
    color: "#8892b0",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "1px",
    padding: "12px 16px 6px",
    textTransform: "uppercase",
  },
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
    borderRadius: "0",
  },
  contactItemActive: {
    background: "rgba(0,212,255,0.1)",
    borderLeft: "3px solid #00d4ff",
  },
  contactAvatar: {
    fontSize: "32px",
    position: "relative",
    lineHeight: 1,
    flexShrink: 0,
  },
  confidentialDot: {
    position: "absolute",
    bottom: "-4px",
    right: "-4px",
    fontSize: "12px",
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    color: "#ccd6f6",
    fontWeight: "500",
    fontSize: "15px",
  },
  contactPreview: {
    color: "#8892b0",
    fontSize: "13px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contactTime: {
    color: "#8892b0",
    fontSize: "11px",
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    background: "#16213e",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  chatHeaderConfidential: {
    background: "linear-gradient(135deg, #0d1b2a, #1b0a2e)",
    borderBottom: "1px solid rgba(100,0,255,0.3)",
  },
  menuBtn: {
    background: "transparent",
    border: "none",
    color: "#8892b0",
    cursor: "pointer",
    fontSize: "18px",
    padding: "4px 8px",
    display: "none",
  },
  chatHeaderAvatar: {
    fontSize: "36px",
    lineHeight: 1,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: "16px",
  },
  chatHeaderStatus: {
    color: "#8892b0",
    fontSize: "13px",
  },
  confidentialToggle: {
    padding: "8px 16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "20px",
    color: "#ccd6f6",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },
  confidentialToggleActive: {
    background: "linear-gradient(135deg, #6a0dad, #0f3460)",
    border: "1px solid #6a0dad",
    color: "#fff",
    boxShadow: "0 0 20px rgba(106,13,173,0.4)",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  messagesConfidential: {
    background: "linear-gradient(180deg, #0d0a1e 0%, #1a0a2e 100%)",
  },
  ndaBanner: {
    background: "linear-gradient(135deg, rgba(106,13,173,0.3), rgba(15,52,96,0.3))",
    border: "1px solid rgba(106,13,173,0.5)",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#ccd6f6",
    fontSize: "13px",
    textAlign: "center",
    lineHeight: 1.6,
    marginBottom: "8px",
  },
  emptyChat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#8892b0",
    gap: "12px",
    padding: "40px",
    textAlign: "center",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
  },
  messageRowOwn: {
    flexDirection: "row-reverse",
  },
  msgAvatar: {
    fontSize: "24px",
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: "65%",
    padding: "10px 14px",
    borderRadius: "18px",
    wordBreak: "break-word",
  },
  messageBubbleOwn: {
    background: "linear-gradient(135deg, #00d4ff22, #0f3460)",
    border: "1px solid rgba(0,212,255,0.2)",
    borderBottomRightRadius: "4px",
  },
  messageBubbleOther: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderBottomLeftRadius: "4px",
  },
  messageBubbleConfidential: {
    borderColor: "rgba(106,13,173,0.5)",
    boxShadow: "0 0 8px rgba(106,13,173,0.2)",
  },
  confidentialBadge: {
    fontSize: "10px",
    color: "#a78bfa",
    fontWeight: "600",
    marginBottom: "4px",
    letterSpacing: "0.5px",
  },
  messageText: {
    color: "#ccd6f6",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  messageTime: {
    color: "#8892b0",
    fontSize: "11px",
    marginTop: "4px",
    textAlign: "right",
  },
  systemMessage: {
    background: "rgba(106,13,173,0.2)",
    border: "1px solid rgba(106,13,173,0.4)",
    borderRadius: "12px",
    padding: "16px",
    margin: "8px 0",
    textAlign: "center",
  },
  systemMessageText: {
    color: "#a78bfa",
    fontSize: "12px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    margin: 0,
    fontFamily: "monospace",
  },
  inputArea: {
    padding: "16px 20px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "#16213e",
    flexShrink: 0,
  },
  inputAreaConfidential: {
    background: "#0d0a1e",
    borderTop: "1px solid rgba(106,13,173,0.3)",
  },
  confidentialIndicator: {
    color: "#a78bfa",
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "8px",
    letterSpacing: "1px",
  },
  inputRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    padding: "12px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    color: "#ccd6f6",
    fontSize: "15px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  sendBtn: {
    width: "44px",
    height: "44px",
    background: "linear-gradient(135deg, #00d4ff, #0f3460)",
    border: "none",
    borderRadius: "50%",
    color: "#fff",
    cursor: "pointer",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.2s",
  },
  sendBtnConfidential: {
    background: "linear-gradient(135deg, #6a0dad, #0f3460)",
    boxShadow: "0 0 16px rgba(106,13,173,0.4)",
  },
  welcomeScreen: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    background: "#1a1a2e",
    position: "relative",
  },
  menuBtn2: {
    position: "absolute",
    top: "20px",
    left: "20px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#ccd6f6",
    borderRadius: "8px",
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: "14px",
  },
  welcomeContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center",
    padding: "20px",
  },
  welcomeTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#00d4ff",
    margin: 0,
  },
  welcomeSubtitle: {
    color: "#8892b0",
    fontSize: "15px",
    margin: 0,
  },
  welcomeFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  },
  welcomeFeature: {
    color: "#ccd6f6",
    fontSize: "14px",
    background: "rgba(255,255,255,0.05)",
    padding: "10px 20px",
    borderRadius: "20px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#16213e",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "24px",
    padding: "32px",
    maxWidth: "480px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalIcon: {
    fontSize: "48px",
    textAlign: "center",
    marginBottom: "16px",
  },
  modalTitle: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: "700",
    textAlign: "center",
    margin: "0 0 16px",
  },
  modalText: {
    color: "#ccd6f6",
    fontSize: "15px",
    lineHeight: 1.6,
    textAlign: "center",
  },
  modalNdaBox: {
    background: "rgba(255,215,0,0.08)",
    border: "1px solid rgba(255,215,0,0.3)",
    borderRadius: "12px",
    padding: "16px",
    margin: "16px 0",
  },
  modalNdaText: {
    color: "#ccd6f6",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: "8px 0 0",
  },
  modalActions: {
    display: "flex",
    gap: "12px",
    marginTop: "24px",
  },
  modalCancelBtn: {
    flex: 1,
    padding: "14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    color: "#ccd6f6",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "500",
  },
  modalConfirmBtn: {
    flex: 2,
    padding: "14px",
    background: "linear-gradient(135deg, #6a0dad, #0f3460)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "600",
  },
  profileAuditInfo: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    boxSizing: "border-box",
    marginTop: "12px",
  },
  auditRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    color: "#8892b0",
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #00d4ff, #0f3460)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },
};