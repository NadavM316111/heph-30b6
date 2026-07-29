"use client";

import { useEffect, useState, useRef } from "react";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  timestamp: Date;
  confidential: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
  confidentialMode: boolean;
  messages: Message[];
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatar: "SC",
    lastMessage: "Let's keep this between us 🔒",
    timestamp: "10:42 AM",
    unread: 2,
    online: true,
    confidentialMode: false,
    messages: [
      {
        id: "m1",
        text: "Hey! Did you see the proposal?",
        sender: "them",
        timestamp: new Date("2024-01-15T10:30:00"),
        confidential: false,
      },
      {
        id: "m2",
        text: "Yes, looks great. Let's keep this between us 🔒",
        sender: "me",
        timestamp: new Date("2024-01-15T10:42:00"),
        confidential: false,
      },
    ],
  },
  {
    id: "2",
    name: "Marcus Webb",
    avatar: "MW",
    lastMessage: "NDA activated — confidential channel",
    timestamp: "9:15 AM",
    unread: 0,
    online: true,
    confidentialMode: true,
    messages: [
      {
        id: "m3",
        text: "I need to share some sensitive project details.",
        sender: "them",
        timestamp: new Date("2024-01-15T09:00:00"),
        confidential: true,
      },
      {
        id: "m4",
        text: "Go ahead — confidential mode is on.",
        sender: "me",
        timestamp: new Date("2024-01-15T09:15:00"),
        confidential: true,
      },
    ],
  },
  {
    id: "3",
    name: "Priya Nair",
    avatar: "PN",
    lastMessage: "Meeting at 3pm confirmed",
    timestamp: "Yesterday",
    unread: 1,
    online: false,
    confidentialMode: false,
    messages: [
      {
        id: "m5",
        text: "Are we still on for the board meeting?",
        sender: "them",
        timestamp: new Date("2024-01-14T14:00:00"),
        confidential: false,
      },
      {
        id: "m6",
        text: "Meeting at 3pm confirmed",
        sender: "me",
        timestamp: new Date("2024-01-14T14:05:00"),
        confidential: false,
      },
    ],
  },
  {
    id: "4",
    name: "David Torres",
    avatar: "DT",
    lastMessage: "The acquisition terms are ready",
    timestamp: "Yesterday",
    unread: 3,
    online: false,
    confidentialMode: false,
    messages: [
      {
        id: "m7",
        text: "The acquisition terms are ready for review.",
        sender: "them",
        timestamp: new Date("2024-01-14T16:00:00"),
        confidential: false,
      },
    ],
  },
  {
    id: "5",
    name: "Leila Farouk",
    avatar: "LF",
    lastMessage: "Encrypted channel established",
    timestamp: "Mon",
    unread: 0,
    online: true,
    confidentialMode: false,
    messages: [
      {
        id: "m8",
        text: "Encrypted channel established. Ready.",
        sender: "them",
        timestamp: new Date("2024-01-13T11:00:00"),
        confidential: false,
      },
    ],
  },
];

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [ndaPending, setNdaPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("confi_conversations");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const revived = parsed.map((c: Conversation) => ({
          ...c,
          messages: c.messages.map((m: Message) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        setConversations(revived);
      } catch {
        setConversations(INITIAL_CONVERSATIONS);
      }
    } else {
      setConversations(INITIAL_CONVERSATIONS);
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    });
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("confi_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, conversations]);

  const selectedConv = conversations.find((c) => c.id === selectedId) || null;

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  }

  function sendMessage() {
    if (!inputText.trim() || !selectedId) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      text: inputText.trim(),
      sender: "me",
      timestamp: new Date(),
      confidential: selectedConv?.confidentialMode || false,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMessage: inputText.trim(),
              timestamp: "Just now",
            }
          : c
      )
    );
    setInputText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function requestConfidentialToggle() {
    if (!selectedConv) return;
    if (!selectedConv.confidentialMode) {
      setNdaPending(true);
      setShowNdaModal(true);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, confidentialMode: false } : c
        )
      );
    }
  }

  function acceptNda() {
    setShowNdaModal(false);
    setNdaPending(false);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              confidentialMode: true,
              messages: [
                ...c.messages,
                {
                  id: `nda_${Date.now()}`,
                  text: "🔒 Confidential mode activated. This conversation is now protected under an international NDA. All parties are bound by confidentiality obligations.",
                  sender: "me",
                  timestamp: new Date(),
                  confidential: true,
                },
              ],
            }
          : c
      )
    );
  }

  function declineNda() {
    setShowNdaModal(false);
    setNdaPending(false);
  }

  return (
    <>
      <div className="app-shell">
        {/* SIDEBAR */}
        <aside className={`sidebar${sidebarOpen ? "" : " sidebar-hidden"}`}>
          <div className="sidebar-header">
            <div className="app-brand">
              <span className="brand-icon">🔐</span>
              <span className="brand-name">Confi</span>
            </div>
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              ✕
            </button>
          </div>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="conv-list">
            {filtered.length === 0 && (
              <p className="no-results">No conversations found.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                className={`conv-item${selectedId === c.id ? " active" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                <div className="avatar-wrap">
                  <div
                    className="avatar"
                    style={{
                      background: c.confidentialMode
                        ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                        : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                    }}
                  >
                    {c.avatar}
                  </div>
                  {c.online && <span className="online-dot" />}
                </div>
                <div className="conv-info">
                  <div className="conv-top">
                    <span className="conv-name">
                      {c.confidentialMode && (
                        <span className="lock-badge">🔒</span>
                      )}
                      {c.name}
                    </span>
                    <span className="conv-time">{c.timestamp}</span>
                  </div>
                  <div className="conv-bottom">
                    <span className="conv-last">{c.lastMessage}</span>
                    {c.unread > 0 && (
                      <span className="unread-badge">{c.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN CHAT */}
        <main className="chat-area">
          {!sidebarOpen && (
            <button
              className="open-sidebar-btn"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
          )}

          {!selectedConv ? (
            <div className="empty-state">
              <div className="empty-icon">🔐</div>
              <h2>Welcome to Confi</h2>
              <p>Select a conversation to start messaging securely.</p>
              <p className="empty-sub">
                Activate <strong>Confidential Mode</strong> to protect sensitive
                conversations with an international NDA.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div
                className="chat-header"
                style={
                  selectedConv.confidentialMode
                    ? { borderBottom: "2px solid #7c3aed" }
                    : {}
                }
              >
                <div className="chat-header-left">
                  <div
                    className="avatar avatar-sm"
                    style={{
                      background: selectedConv.confidentialMode
                        ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                        : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                    }}
                  >
                    {selectedConv.avatar}
                  </div>
                  <div>
                    <div className="chat-name">{selectedConv.name}</div>
                    <div className="chat-status">
                      {selectedConv.online ? "Online" : "Offline"}
                      {selectedConv.confidentialMode && (
                        <span className="conf-status"> · 🔒 Confidential</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="chat-header-right">
                  <button
                    className={`conf-toggle-btn${selectedConv.confidentialMode ? " conf-active" : ""}`}
                    onClick={requestConfidentialToggle}
                    title={
                      selectedConv.confidentialMode
                        ? "Deactivate Confidential Mode"
                        : "Activate Confidential Mode"
                    }
                  >
                    {selectedConv.confidentialMode ? "🔒 Confidential ON" : "🔓 Confidential OFF"}
                  </button>
                </div>
              </div>

              {/* Confidential Banner */}
              {selectedConv.confidentialMode && (
                <div className="conf-banner">
                  🔒 This conversation is protected under an International NDA.
                  All messages are confidential and legally binding.
                </div>
              )}

              {/* Messages */}
              <div className="messages-area">
                {selectedConv.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`msg-row${msg.sender === "me" ? " msg-me" : " msg-them"}`}
                  >
                    <div
                      className={`msg-bubble${msg.confidential ? " msg-confidential" : ""}`}
                    >
                      {msg.confidential && msg.sender !== "me" && (
                        <span className="msg-lock">🔒 </span>
                      )}
                      {msg.text}
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="input-area">
                <input
                  type="text"
                  className="msg-input"
                  placeholder={
                    selectedConv.confidentialMode
                      ? "🔒 Send confidential message…"
                      : "Type a message…"
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={
                    selectedConv.confidentialMode
                      ? { borderColor: "#7c3aed" }
                      : {}
                  }
                />
                <button
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  style={
                    selectedConv.confidentialMode
                      ? { background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }
                      : {}
                  }
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* NDA MODAL */}
      {showNdaModal && ndaPending && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-icon">⚖️</div>
            <h2 className="modal-title">International NDA Agreement</h2>
            <p className="modal-subtitle">
              Confidential Mode — Legal Notice
            </p>
            <div className="nda-scroll">
              <p>
                <strong>INTERNATIONAL NON-DISCLOSURE AGREEMENT</strong>
              </p>
              <p>
                By activating Confidential Mode, you ("<strong>Disclosing Party</strong>")
                and the recipient ("<strong>Receiving Party</strong>") agree to the
                following terms effective immediately:
              </p>
              <p>
                <strong>1. Confidentiality Obligation.</strong> Both parties agree
                to hold in strict confidence all information exchanged within this
                conversation channel marked as Confidential. Neither party shall
                disclose, publish, or disseminate such information to any third party
                without prior written consent.
              </p>
              <p>
                <strong>2. Scope.</strong> This agreement covers all messages,
                files, documents, and communications transmitted through this
                Confidential conversation channel, regardless of form or medium.
              </p>
              <p>
                <strong>3. International Jurisdiction.</strong> This agreement shall
                be governed by and construed in accordance with internationally
                recognised principles of contract law and applicable treaties,
                including but not limited to those administered under the
                United Nations Commission on International Trade Law (UNCITRAL).
              </p>
              <p>
                <strong>4. Duration.</strong> Confidentiality obligations under this
                agreement shall remain in effect for a period of five (5) years from
                the date of activation, or as otherwise required by applicable law.
              </p>
              <p>
                <strong>5. Remedies.</strong> Any breach of this agreement may result
                in immediate legal action, including injunctive relief and claims for
                damages in the appropriate jurisdiction.
              </p>
              <p>
                <strong>6. Acceptance.</strong> By clicking "I Agree & Activate",
                both parties electronically consent to and are bound by the terms
                of this International Non-Disclosure Agreement.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-decline" onClick={declineNda}>
                Decline
              </button>
              <button className="btn-accept" onClick={acceptNda}>
                I Agree &amp; Activate 🔒
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}