"use client";

import { useState, useEffect } from "react";
import { Session } from "@/lib/session";
import { getProfile, UserProfile } from "@/lib/profile";
import {
  searchContactsByPhone,
  getMyContacts,
  addContact,
  Contact,
} from "@/lib/contacts";
import { COUNTRY_CODES } from "@/lib/countryCodes";

interface Props {
  session: Session;
  onLogout: () => void;
  onEditProfile: () => void;
}

export default function ContactsScreen({ session, onLogout, onEditProfile }: Props) {
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchCountryCode, setSearchCountryCode] = useState("+1");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"contacts" | "discover">("contacts");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const profile = getProfile(session.email);
    setMyProfile(profile);
    const myContacts = getMyContacts(session.email);
    setContacts(myContacts);
  }, [session.email]);

  const handleSearch = () => {
    const fullPhone = `${searchCountryCode}${searchPhone.replace(/\D/g, "")}`;
    if (fullPhone.replace(/\D/g, "").length < 8) return;
    setSearching(true);
    // Simulate async search
    setTimeout(() => {
      const results = searchContactsByPhone(fullPhone, session.email);
      setSearchResults(results);
      setSearching(false);
    }, 500);
  };

  const handleAddContact = (profile: UserProfile) => {
    const contact: Contact = {
      ownerEmail: session.email,
      contactEmail: profile.email,
      contactPhone: profile.phone,
      displayName: profile.displayName,
      avatar: profile.avatar,
      addedAt: Date.now(),
    };
    addContact(contact);
    setAddedIds(prev => new Set(prev).add(profile.email));
    setContacts(getMyContacts(session.email));
  };

  const profile = myProfile;

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        {/* My Profile Header */}
        <div style={styles.myProfile}>
          <div style={styles.myAvatar}>
            {profile?.avatar || session.avatar || "👤"}
          </div>
          <div style={styles.myInfo}>
            <p style={styles.myName}>
              {profile?.displayName || session.displayName || session.email}
            </p>
            <p style={styles.myEmail}>{session.email}</p>
          </div>
          <button style={styles.editBtn} onClick={onEditProfile} title="Edit Profile">
            ✏️
          </button>
        </div>

        {/* Session Token Info */}
        <div style={styles.sessionBadge}>
          <span style={styles.sessionDot} />
          <span style={styles.sessionText}>
            Session active · expires {new Date(session.expiresAt).toLocaleDateString()}
          </span>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === "contacts" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("contacts")}
          >
            👥 Contacts ({contacts.length})
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "discover" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("discover")}
          >
            🔍 Discover
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "contacts" && (
          <div style={styles.contactsList}>
            {contacts.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyIcon}>🌐</p>
                <p style={styles.emptyText}>No contacts yet.</p>
                <p style={styles.emptyHint}>Use Discover to find people by phone number.</p>
              </div>
            ) : (
              contacts.map(c => (
                <div key={c.contactEmail} style={styles.contactCard}>
                  <div style={styles.contactAvatar}>{c.avatar || "👤"}</div>
                  <div style={styles.contactInfo}>
                    <p style={styles.contactName}>{c.displayName}</p>
                    <p style={styles.contactPhone}>{c.contactPhone}</p>
                  </div>
                  <div style={styles.contactBadge}>
                    <span style={styles.ndaTag}>NDA Ready</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "discover" && (
          <div style={styles.discoverSection}>
            <p style={styles.discoverHint}>
              Search for Confi users by phone number to add them as contacts.
            </p>
            <div style={styles.searchRow}>
              <select
                style={styles.countrySelect}
                value={searchCountryCode}
                onChange={e => setSearchCountryCode(e.target.value)}
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code + c.dial} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <input
                style={styles.searchInput}
                type="tel"
                placeholder="Phone number"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
              />
              <button style={styles.searchBtn} onClick={handleSearch} disabled={searching}>
                {searching ? "..." : "🔍"}
              </button>
            </div>

            {searchResults.length === 0 && searchPhone && !searching && (
              <p style={styles.noResults}>No users found with that number.</p>
            )}

            {searchResults.map(r => (
              <div key={r.email} style={styles.searchResultCard}>
                <div style={styles.contactAvatar}>{r.avatar || "👤"}</div>
                <div style={styles.contactInfo}>
                  <p style={styles.contactName}>{r.displayName}</p>
                  <p style={styles.contactPhone}>{r.phone}</p>
                </div>
                {addedIds.has(r.email) ? (
                  <span style={styles.addedBadge}>✓ Added</span>
                ) : (
                  <button
                    style={styles.addBtn}
                    onClick={() => handleAddContact(r)}
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button style={styles.logoutBtn} onClick={onLogout}>
          Sign Out
        </button>
      </div>

      {/* Main Panel */}
      <div style={styles.mainPanel}>
        <div style={styles.welcomePanel}>
          <div style={styles.welcomeIcon}>🔐</div>
          <h2 style={styles.welcomeTitle}>Welcome to Confi</h2>
          <p style={styles.welcomeText}>
            Your secure messaging platform with confidentiality protection.
            Select a contact to start a conversation.
          </p>
          <div style={styles.featureList}>
            {[
              { icon: "🛡️", title: "International NDA", desc: "Activate legal confidentiality on any conversation" },
              { icon: "🔑", title: "End-to-End Encrypted", desc: "Messages secured with key exchange" },
              { icon: "📋", title: "Minimal PII", desc: "We store only what's necessary" },
              { icon: "🌍", title: "Phone Discovery", desc: "Find contacts by phone number globally" },
            ].map(f => (
              <div key={f.title} style={styles.featureCard}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <div>
                  <p style={styles.featureTitle}>{f.title}</p>
                  <p style={styles.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Token Debug Panel */}
          <div style={styles.tokenDebug}>
            <p style={styles.tokenDebugTitle}>🔐 Session Token (JWT-style)</p>
            <code style={styles.tokenCode}>
              {session.token.length > 60
                ? `${session.token.slice(0, 30)}...${session.token.slice(-20)}`
                : session.token}
            </code>
            <p style={styles.tokenMeta}>
              Issued: {new Date(session.issuedAt).toLocaleString()} ·{" "}
              Expires: {new Date(session.expiresAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    width: "100%",
    maxWidth: "1100px",
    minHeight: "80vh",
    maxHeight: "90vh",
    margin: "20px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
  },
  sidebar: {
    width: "320px",
    minWidth: "280px",
    background: "rgba(0,0,0,0.4)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  myProfile: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 16px",
    background: "rgba(124,58,237,0.1)",
    borderBottom: "1px solid rgba(124,58,237,0.2)",
  },
  myAvatar: {
    fontSize: "36px",
    lineHeight: 1,
  },
  myInfo: {
    flex: 1,
    overflow: "hidden",
  },
  myName: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  myEmail: {
    color: "#8b8fa8",
    fontSize: "12px",
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  editBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px",
  },
  sessionBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 16px",
    background: "rgba(52,211,153,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  sessionDot: {
    width: "6px",
    height: "6px",
    background: "#34d399",
    borderRadius: "50%",
    flexShrink: 0,
  },
  sessionText: {
    color: "#4b5563",
    fontSize: "10px",
    fontFamily: "monospace",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tab: {
    flex: 1,
    padding: "12px 8px",
    background: "transparent",
    border: "none",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#a78bfa",
    borderBottom: "2px solid #7c3aed",
    background: "rgba(124,58,237,0.05)",
  },
  contactsList: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: {
    fontSize: "40px",
    margin: "0 0 10px",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 6px",
  },
  emptyHint: {
    color: "#4b5563",
    fontSize: "12px",
    margin: 0,
  },
  contactCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 8px",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "2px",
    transition: "background 0.15s",
  },
  contactAvatar: {
    fontSize: "30px",
    lineHeight: 1,
    flexShrink: 0,
  },
  contactInfo: {
    flex: 1,
    overflow: "hidden",
  },
  contactName: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 600,
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contactPhone: {
    color: "#6b7280",
    fontSize: "12px",
    margin: 0,
    fontFamily: "monospace",
  },
  contactBadge: {
    flexShrink: 0,
  },
  ndaTag: {
    background: "rgba(124,58,237,0.2)",
    color: "#a78bfa",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid rgba(124,58,237,0.3)",
  },
  discoverSection: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
  },
  discoverHint: {
    color: "#6b7280",
    fontSize: "12px",
    marginBottom: "12px",
    lineHeight: 1.5,
  },
  searchRow: {
    display: "flex",
    gap: "6px",
    marginBottom: "12px",
  },
  countrySelect: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "13px",
    padding: "8px 4px",
    outline: "none",
    minWidth: "65px",
  },
  searchInput: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "13px",
    padding: "8px 10px",
    outline: "none",
  },
  searchBtn: {
    background: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  noResults: {
    color: "#6b7280",
    fontSize: "13px",
    textAlign: "center",
    padding: "20px",
  },
  searchResultCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "10px",
    marginBottom: "6px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  addedBadge: {
    color: "#34d399",
    fontSize: "12px",
    fontWeight: 700,
    flexShrink: 0,
  },
  addBtn: {
    background: "rgba(124,58,237,0.3)",
    border: "1px solid rgba(124,58,237,0.4)",
    borderRadius: "6px",
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: 700,
    padding: "4px 10px",
    cursor: "pointer",
    flexShrink: 0,
  },
  logoutBtn: {
    margin: "8px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#6b7280",
    fontSize: "13px",
    padding: "10px",
    cursor: "pointer",
  },
  mainPanel: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
  },
  welcomePanel: {
    textAlign: "center",
    maxWidth: "480px",
  },
  welcomeIcon: {
    fontSize: "64px",
    marginBottom: "16px",
  },
  welcomeTitle: {
    color: "#ffffff",
    fontSize: "28px",
    fontWeight: 800,
    margin: "0 0 12px",
  },
  welcomeText: {
    color: "#8b8fa8",
    fontSize: "15px",
    lineHeight: 1.6,
    marginBottom: "32px",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    textAlign: "left",
    marginBottom: "32px",
  },
  featureCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "14px 16px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  featureIcon: {
    fontSize: "24px",
    flexShrink: 0,
  },
  featureTitle: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 700,
    margin: "0 0 2px",
  },
  featureDesc: {
    color: "#6b7280",
    fontSize: "12px",
    margin: 0,
    lineHeight: 1.4,
  },
  tokenDebug: {
    background: "rgba(0,0,0,0.3)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(124,58,237,0.2)",
    textAlign: "left",
  },
  tokenDebugTitle: {
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: "0 0 8px",
  },
  tokenCode: {
    display: "block",
    color: "#34d399",
    fontSize: "11px",
    fontFamily: "monospace",
    wordBreak: "break-all",
    background: "rgba(52,211,153,0.05)",
    padding: "8px",
    borderRadius: "6px",
    marginBottom: "8px",
  },
  tokenMeta: {
    color: "#4b5563",
    fontSize: "11px",
    fontFamily: "monospace",
    margin: 0,
  },
};