"use client";

import { useState } from "react";
import { SessionUser, saveSession } from "@/lib/session";

interface Props {
  user: SessionUser;
  fingerprint: string;
  onLogout: () => void;
}

type Tab = "chats" | "profile" | "security";

export default function Dashboard({ user, fingerprint, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("chats");
  const [editName, setEditName] = useState(user.displayName);
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = () => {
    const updated: SessionUser = { ...user, displayName: editName, avatar: editAvatar };
    localStorage.setItem(`confi_profile_${user.email}`, JSON.stringify(updated));
    saveSession(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sessionAge = Math.floor((Date.now() - user.lastSeen) / 1000 / 60);

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 28 }}>{user.avatar}</span>
          <div>
            <div style={s.headerName}>{user.displayName}</div>
            <div style={s.headerStatus}>🟢 Trusted Identity Verified</div>
          </div>
        </div>
        <button style={s.logoutBtn} onClick={onLogout}>Sign Out</button>
      </header>

      <div style={s.tabs}>
        {(["chats", "profile", "security"] as Tab[]).map((t) => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === "chats" ? "💬 Chats" : t === "profile" ? "👤 Profile" : "🔐 Security"}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {tab === "chats" && (
          <div style={s.panel}>
            <div style={s.emptyState}>
              <span style={{ fontSize: 48 }}>💬</span>
              <h2 style={s.emptyTitle}>No conversations yet</h2>
              <p style={s.emptyText}>
                Your identity has been verified and your device is trusted.
                Confidential conversations will appear here.
              </p>
              <div style={s.identityCard}>
                <div style={s.identityRow}>
                  <span style={s.identityLabel}>Verified Email</span>
                  <span style={s.identityValue}>{user.email}</span>
                </div>
                <div style={s.identityRow}>
                  <span style={s.identityLabel}>Unique ID</span>
                  <span style={{ ...s.identityValue, fontFamily: "monospace", fontSize: 11 }}>
                    {user.uid.slice(0, 20)}…
                  </span>
                </div>
                <div style={s.identityRow}>
                  <span style={s.identityLabel}>NDA Status</span>
                  <span style={{ ...s.identityValue, color: "#6ee7b7" }}>
                    ✅ {user.consentVersion} Accepted
                  </span>
                </div>
                <div style={s.identityRow}>
                  <span style={s.identityLabel}>Consent Date</span>
                  <span style={s.identityValue}>
                    {new Date(user.consentTimestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div style={s.panel}>
            <h2 style={s.panelTitle}>Your Profile</h2>
            <div style={s.profileAvatar}>{editAvatar}</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Display Name</label>
              <input
                style={s.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Email (verified, read-only)</label>
              <input style={{ ...s.input, opacity: 0.5 }} value={user.email} readOnly />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Unique Confi ID</label>
              <div style={s.uidBox}>{user.uid}</div>
            </div>
            <button style={s.saveBtn} onClick={handleSaveProfile}>
              {saved ? "✅ Saved!" : "Save Changes"}
            </button>
          </div>
        )}

        {tab === "security" && (
          <div style={s.panel}>
            <h2 style={s.panelTitle}>Security & Identity</h2>
            <div style={s.secCards}>
              <SecurityCard
                icon="🔑"
                title="Session ID"
                value={user.sessionId.slice(0, 24) + "…"}
                status="active"
                detail={`Active for ${sessionAge} minute(s)`}
              />
              <SecurityCard
                icon="📱"
                title="Device Fingerprint"
                value={fingerprint.slice(0, 24) + "…"}
                status="bound"
                detail="Session bound to this device"
              />
              <SecurityCard
                icon="⚖️"
                title="NDA Agreement"
                value={user.consentVersion || "NDA-v1.0"}
                status="signed"
                detail={`Signed ${new Date(user.consentTimestamp).toLocaleString()}`}
              />
              <SecurityCard
                icon="🌐"
                title="Identity Layer"
                value="International Verification"
                status="verified"
                detail="Legally traceable identity established"
              />
            </div>
            <div style={s.legalBox}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#6ee7b7" }}>
                🛡️ Legal Traceability Notice
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>
                Your identity on Confi is cryptographically bound to your verified email,
                device fingerprint, and session token. Any violation of confidentiality
                agreements is legally traceable to this specific identity and device.
                This information is retained for legal compliance purposes only.
              </p>
            </div>
            <button style={s.dangerBtn} onClick={onLogout}>
              🚪 Sign Out & Revoke Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityCard({
  icon, title, value, status, detail,
}: {
  icon: string; title: string; value: string; status: string; detail: string;
}) {
  const statusColors: Record<string, string> = {
    active: "#6ee7b7", bound: "#3b82f6", signed: "#a78bfa", verified: "#fbbf24",
  };
  return (
    <div style={secCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: statusColors[status] || "#6b7280",
          background: `${statusColors[status]}18`, borderRadius: 4, padding: "2px 6px",
          textTransform: "uppercase",
        }}>
          {status}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db", marginTop: 8 }}>{title}</div>
      <div style={{ fontSize: 10, fontFamily: "monospace", color: "#9ca3af", wordBreak: "break-all" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>{detail}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    background: "#0a0a0f", color: "#fff",
  },
  header: {
    background: "rgba(15,22,40,0.95)", borderBottom: "1px solid rgba(110,231,183,0.1)",
    padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
    backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerName: { fontSize: 15, fontWeight: 700, color: "#fff" },
  headerStatus: { fontSize: 11, color: "#6ee7b7" },
  logoutBtn: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 8, padding: "7px 14px", color: "#f87171", fontSize: 12,
    cursor: "pointer", fontWeight: 600,
  },
  tabs: {
    display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(15,22,40,0.5)",
  },
  tabBtn: {
    flex: 1, padding: "13px 8px", background: "transparent", border: "none",
    color: "#6b7280", fontSize: 13, cursor: "pointer", fontWeight: 600,
    borderBottom: "2px solid transparent", transition: "all 0.2s",
  },
  tabActive: {
    color: "#6ee7b7", borderBottom: "2px solid #6ee7b7",
    background: "rgba(110,231,183,0.05)",
  },
  content: { flex: 1, padding: "20px", maxWidth: 600, margin: "0 auto", width: "100%" },
  panel: { display: "flex", flexDirection: "column", gap: 16 },
  panelTitle: { fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 },
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", gap: 12, paddingTop: 40,
  },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 },
  emptyText: { fontSize: 13, color: "#6b7280", maxWidth: 320, lineHeight: 1.6, margin: 0 },
  identityCard: {
    background: "rgba(110,231,183,0.04)", border: "1px solid rgba(110,231,183,0.15)",
    borderRadius: 14, padding: "16px 20px", width: "100%", display: "flex",
    flexDirection: "column", gap: 10,
  },
  identityRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  identityLabel: { fontSize: 12, color: "#6b7280", minWidth: 100 },
  identityValue: { fontSize: 12, color: "#d1d5db", textAlign: "right", wordBreak: "break-all" },
  profileAvatar: {
    fontSize: 64, textAlign: "center", padding: 20,
    background: "rgba(255,255,255,0.03)", borderRadius: 16,
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#9ca3af", fontWeight: 600, letterSpacing: 0.5 },
  input: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none",
  },
  uidBox: {
    background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px",
    fontFamily: "monospace", fontSize: 11, color: "#6ee7b7",
    wordBreak: "break-all", lineHeight: 1.5,
  },
  saveBtn: {
    background: "linear-gradient(135deg, #6ee7b7, #3b82f6)", border: "none",
    borderRadius: 10, padding: "12px", color: "#0a0a0f", fontWeight: 700,
    fontSize: 14, cursor: "pointer",
  },
  secCards: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
  },
  legalBox: {
    background: "rgba(110,231,183,0.04)", border: "1px solid rgba(110,231,183,0.15)",
    borderRadius: 12, padding: "16px",
  },
  dangerBtn: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, padding: "12px", color: "#f87171", fontWeight: 600,
    fontSize: 14, cursor: "pointer",
  },
};

const secCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12, padding: "14px",
};