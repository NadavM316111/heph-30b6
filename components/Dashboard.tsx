"use client";

import { useState } from "react";
import type { AppUser } from "@/app/page";

type Props = {
  user: AppUser;
  onLogout: () => void;
};

type Tab = "chats" | "profile";

export default function Dashboard({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("chats");

  return (
    <div style={styles.container}>
      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerLogo}>🔐</span>
            <span style={styles.headerTitle}>Confi</span>
          </div>
          <div style={styles.headerRight}>
            {user.isVerified && (
              <div style={styles.verifiedPill}>✅ Verified</div>
            )}
            <button style={styles.logoutBtn} onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={styles.tabBar}>
          <button
            style={{ ...styles.tab, ...(tab === "chats" ? styles.tabActive : {}) }}
            onClick={() => setTab("chats")}
          >
            💬 Chats
          </button>
          <button
            style={{ ...styles.tab, ...(tab === "profile" ? styles.tabActive : {}) }}
            onClick={() => setTab("profile")}
          >
            👤 Profile
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {tab === "chats" && <ChatsPanel user={user} />}
          {tab === "profile" && <ProfilePanel user={user} />}
        </div>
      </div>
    </div>
  );
}

function ChatsPanel({ user }: { user: AppUser }) {
  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.welcomeCard}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="avatar" style={panelStyles.avatarImg} />
        ) : (
          <div style={panelStyles.avatarFallback}>
            {user.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
        <div>
          <div style={panelStyles.welcomeText}>Welcome back,</div>
          <div style={panelStyles.displayName}>{user.displayName || "User"}</div>
        </div>
      </div>

      {!user.isVerified && (
        <div style={panelStyles.verifyBanner}>
          <span>🔏</span>
          <div>
            <div style={panelStyles.verifyBannerTitle}>Complete Identity Verification</div>
            <div style={panelStyles.verifyBannerDesc}>
              Required to activate Confidential / NDA mode in conversations
            </div>
          </div>
        </div>
      )}

      <div style={panelStyles.featureList}>
        {[
          {
            icon: "💬",
            title: "Encrypted Messaging",
            desc: "End-to-end encrypted by default",
            available: true,
          },
          {
            icon: "🔏",
            title: "Confidential / NDA Mode",
            desc: "Legally protected conversations under international NDA",
            available: user.isVerified,
          },
          {
            icon: "📎",
            title: "Secure File Sharing",
            desc: "Share documents with full audit trail",
            available: user.isVerified,
          },
          {
            icon: "⚖️",
            title: "Legal Audit Log",
            desc: "Tamper-evident conversation records",
            available: user.isVerified,
          },
        ].map((f) => (
          <div
            key={f.title}
            style={{ ...panelStyles.featureItem, ...(f.available ? {} : panelStyles.featureItemLocked) }}
          >
            <span style={panelStyles.featureIcon}>{f.icon}</span>
            <div style={panelStyles.featureInfo}>
              <div style={panelStyles.featureTitle}>{f.title}</div>
              <div style={panelStyles.featureDesc}>{f.desc}</div>
            </div>
            {f.available ? (
              <span style={panelStyles.featureReady}>Ready</span>
            ) : (
              <span style={panelStyles.featureLock}>🔒</span>
            )}
          </div>
        ))}
      </div>

      <div style={panelStyles.comingSoon}>
        <span style={panelStyles.comingSoonBadge}>Coming Next</span>
        <p style={panelStyles.comingSoonText}>
          Real-time messaging, group chats, and NDA-mode conversations are being built next.
          Your verified identity is ready to back any confidential conversation.
        </p>
      </div>
    </div>
  );
}

function ProfilePanel({ user }: { user: AppUser }) {
  const verificationRecord = (() => {
    try {
      const v = localStorage.getItem("confi_verification");
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  })();

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.profileCard}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="avatar" style={panelStyles.profileAvatar} />
        ) : (
          <div style={panelStyles.profileAvatarFallback}>
            {user.displayName?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
        <div style={panelStyles.profileName}>{user.displayName || "No name set"}</div>
        <div style={panelStyles.profileEmail}>{user.email}</div>
        {user.phone && <div style={panelStyles.profilePhone}>📱 {user.phone}</div>}
        {user.isVerified ? (
          <div style={panelStyles.profileVerifiedBadge}>✅ Identity Verified</div>
        ) : (
          <div style={panelStyles.profileUnverifiedBadge}>⚠️ Not Verified</div>
        )}
      </div>

      {verificationRecord && (
        <div style={panelStyles.auditCard}>
          <div style={panelStyles.auditTitle}>🔏 Verification Record</div>
          <div style={panelStyles.auditGrid}>
            <AuditRow label="Verification ID" value={verificationRecord.verificationId} mono />
            <AuditRow label="Verified At" value={new Date(verificationRecord.verifiedAt).toLocaleString()} />
            <AuditRow
              label="Document Type"
              value={verificationRecord.docType?.replace("_", " ").toUpperCase()}
            />
            <AuditRow
              label="Liveness Checks"
              value={`${verificationRecord.livenessChecks?.length || 0}/5 passed`}
            />
            <AuditRow label="Audit Hash" value={verificationRecord.auditHash} mono />
          </div>
          <div style={panelStyles.auditNote}>
            This record is stored for NDA legal proceedings. Your verified identity backs any
            confidential conversation you participate in.
          </div>
        </div>
      )}

      <div style={panelStyles.sessionCard}>
        <div style={panelStyles.sessionTitle}>Session Info</div>
        <AuditRow label="Session Token" value={`${user.sessionToken?.slice(0, 16)}…`} mono />
        <AuditRow label="Account Email" value={user.email} />
      </div>
    </div>
  );
}

function AuditRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div style={auditRowStyles.row}>
      <span style={auditRowStyles.label}>{label}</span>
      <span style={{ ...auditRowStyles.value, ...(mono ? auditRowStyles.mono : {}) }}>
        {value || "—"}
      </span>
    </div>
  );
}

const auditRowStyles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    gap: "12px",
  },
  label: {
    color: "#64748b",
    fontSize: "12px",
    flexShrink: 0,
  },
  value: {
    color: "#94a3b8",
    fontSize: "12px",
    textAlign: "right",
    wordBreak: "break-all",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: "11px",
  },
};

const panelStyles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  welcomeCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px",
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: "12px",
  },
  avatarImg: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(99,102,241,0.5)",
  },
  avatarFallback: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: "20px",
    flexShrink: 0,
  },
  welcomeText: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  displayName: {
    color: "#fff",
    fontSize: "18px",
    fontWeight: 700,
  },
  verifyBanner: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    background: "rgba(251,191,36,0.08)",
    border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: "10px",
    alignItems: "flex-start",
    fontSize: "20px",
  },
  verifyBannerTitle: {
    color: "#fde68a",
    fontWeight: 600,
    fontSize: "13px",
    marginBottom: "3px",
  },
  verifyBannerDesc: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "10px",
  },
  featureItemLocked: {
    opacity: 0.55,
  },
  featureIcon: {
    fontSize: "22px",
    flexShrink: 0,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 600,
  },
  featureDesc: {
    color: "#64748b",
    fontSize: "12px",
    marginTop: "2px",
  },
  featureReady: {
    color: "#22c55e",
    fontSize: "11px",
    fontWeight: 600,
    background: "rgba(34,197,94,0.1)",
    padding: "2px 8px",
    borderRadius: "10px",
    border: "1px solid rgba(34,197,94,0.3)",
  },
  featureLock: {
    fontSize: "16px",
  },
  comingSoon: {
    border: "1px dashed rgba(99,102,241,0.3)",
    borderRadius: "10px",
    padding: "14px",
    textAlign: "center",
  },
  comingSoonBadge: {
    display: "inline-block",
    background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 10px",
    borderRadius: "10px",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  comingSoonText: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: 0,
  },
  profileCard: {
    textAlign: "center",
    padding: "24px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
  },
  profileAvatar: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid rgba(99,102,241,0.5)",
    margin: "0 auto 12px",
    display: "block",
  },
  profileAvatarFallback: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: "32px",
    margin: "0 auto 12px",
  },
  profileName: {
    color: "#fff",
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  profileEmail: {
    color: "#94a3b8",
    fontSize: "13px",
    marginBottom: "4px",
  },
  profilePhone: {
    color: "#64748b",
    fontSize: "12px",
    marginBottom: "12px",
  },
  profileVerifiedBadge: {
    display: "inline-block",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.4)",
    borderRadius: "20px",
    color: "#86efac",
    fontSize: "13px",
    fontWeight: 600,
    padding: "4px 16px",
  },
  profileUnverifiedBadge: {
    display: "inline-block",
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.3)",
    borderRadius: "20px",
    color: "#fde68a",
    fontSize: "13px",
    fontWeight: 600,
    padding: "4px 16px",
  },
  auditCard: {
    padding: "16px",
    background: "rgba(99,102,241,0.05)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: "12px",
  },
  auditTitle: {
    color: "#c7d2fe",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  auditGrid: {
    display: "flex",
    flexDirection: "column",
  },
  auditNote: {
    color: "#475569",
    fontSize: "11px",
    marginTop: "10px",
    lineHeight: 1.5,
  },
  sessionCard: {
    padding: "14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
  },
  sessionTitle: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "480px",
    padding: "16px",
    maxHeight: "95vh",
  },
  shell: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.2)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  headerLogo: {
    fontSize: "22px",
  },
  headerTitle: {
    color: "#fff",
    fontSize: "18px",
    fontWeight: 700,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  verifiedPill: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "20px",
    color: "#86efac",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 10px",
  },
  logoutBtn: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "12px",
    padding: "5px 12px",
    cursor: "pointer",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.1)",
  },
  tab: {
    flex: 1,
    padding: "13px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#a5b4fc",
    borderBottomColor: "#6366f1",
    background: "rgba(99,102,241,0.06)",
  },
  content: {
    padding: "20px",
    overflowY: "auto",
    flex: 1,
  },
};