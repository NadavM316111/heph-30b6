"use client";

import type { User } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  user: User;
  onEditProfile: () => void;
  onLogout: () => void;
}

export default function Dashboard({ user, onEditProfile, onLogout }: Props) {
  const countryObj = COUNTRIES.find((c) => c.code === user.country);

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logoText}>🔐 Confi</span>
        </div>

        <div style={styles.userCard} onClick={onEditProfile}>
          <div style={{ ...styles.avatar, background: user.avatarColor }}>
            {user.avatarInitials}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user.displayName}</div>
            <div style={styles.userEmail}>{user.email}</div>
          </div>
          <span style={styles.editIcon}>✏️</span>
        </div>

        <div style={styles.idBadge}>
          <div style={styles.idBadgeRow}>
            <span style={styles.verifiedDot} />
            <span style={styles.idBadgeText}>Identity Verified</span>
          </div>
          <div style={styles.idBadgeCountry}>
            {countryObj?.flag} {countryObj?.name}
          </div>
        </div>

        <nav style={styles.nav}>
          <div style={{ ...styles.navItem, ...styles.navItemActive }}>
            💬 Messages
          </div>
          <div style={styles.navItem}>🔐 Confidential</div>
          <div style={styles.navItem}>📋 My NDAs</div>
          <div style={styles.navItem}>🔒 Security</div>
          <div style={styles.navItem}>⚙️ Settings</div>
        </nav>

        <button style={styles.logoutBtn} onClick={onLogout}>
          Sign Out
        </button>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        <div style={styles.welcomeCard}>
          <div style={styles.welcomeIcon}>🎉</div>
          <h1 style={styles.welcomeTitle}>
            Welcome to Confi, {user.displayName}!
          </h1>
          <p style={styles.welcomeText}>
            Your identity has been verified and encrypted. You are now ready to
            use Confidential Mode — legally binding NDAs will protect your
            sensitive conversations.
          </p>
        </div>

        <div style={styles.grid}>
          <div style={styles.gridCard}>
            <div style={styles.gridCardIcon}>🛡️</div>
            <div style={styles.gridCardTitle}>Legal Identity Active</div>
            <div style={styles.gridCardText}>
              Your full name <strong style={{ color: "#a78bfa" }}>{user.fullName}</strong> is
              encrypted and registered as the legally binding party for all
              Confidential Mode conversations.
            </div>
          </div>

          <div style={styles.gridCard}>
            <div style={styles.gridCardIcon}>⚖️</div>
            <div style={styles.gridCardTitle}>Jurisdiction</div>
            <div style={styles.gridCardText}>
              {countryObj?.flag} {countryObj?.name}
              <br />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                Governing law for your confidential agreements and NDA enforcement.
              </span>
            </div>
          </div>

          <div style={styles.gridCard}>
            <div style={styles.gridCardIcon}>🔑</div>
            <div style={styles.gridCardTitle}>Session Secured</div>
            <div style={styles.gridCardText}>
              Active JWT session token issued. All API requests are authenticated.
              Token expires in 24 hours.
            </div>
          </div>

          <div style={styles.gridCard}>
            <div style={styles.gridCardIcon}>📨</div>
            <div style={styles.gridCardTitle}>Confidential Mode Ready</div>
            <div style={styles.gridCardText}>
              Start a conversation and toggle Confidential Mode to activate an
              international NDA. Both parties must be verified.
            </div>
          </div>
        </div>

        <div style={styles.infoPanel}>
          <h2 style={styles.infoPanelTitle}>How Confidential Mode Works</h2>
          <div style={styles.steps}>
            {[
              { icon: "1️⃣", text: "Both participants must have verified identities on Confi." },
              { icon: "2️⃣", text: "Toggle Confidential Mode in any conversation to activate the NDA." },
              { icon: "3️⃣", text: "An international NDA is generated, stamped with your legal identity, jurisdiction, and timestamp." },
              { icon: "4️⃣", text: "All messages in the thread are legally covered under confidentiality obligations." },
              { icon: "5️⃣", text: "You can download a signed PDF copy of the NDA for your records." },
            ].map((s) => (
              <div key={s.icon} style={styles.step}>
                <span style={styles.stepIcon}>{s.icon}</span>
                <span style={styles.stepText}>{s.text}</span>
              </div>
            ))}
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
    margin: "20px",
    height: "calc(100vh - 40px)",
    maxHeight: "800px",
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
    animation: "fadeIn 0.4s ease-out",
  },
  sidebar: {
    width: "260px",
    flexShrink: 0,
    background: "rgba(0,0,0,0.25)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 16px",
  },
  sidebarHeader: {
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoText: {
    fontSize: "18px",
    fontWeight: "800",
    background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    borderRadius: "12px",
    cursor: "pointer",
    marginBottom: "12px",
    transition: "background 0.2s",
    background: "rgba(255,255,255,0.04)",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "700",
    color: "white",
    flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#ffffff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  userEmail: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  editIcon: { fontSize: "12px" },
  idBadge: {
    padding: "10px 12px",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: "10px",
    marginBottom: "20px",
  },
  idBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "4px",
  },
  verifiedDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 6px #10b981",
  },
  idBadgeText: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#10b981",
  },
  idBadgeCountry: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  navItem: {
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  navItemActive: {
    background: "rgba(124,58,237,0.2)",
    color: "#a78bfa",
    fontWeight: "600",
  },
  logoutBtn: {
    marginTop: "12px",
    padding: "10px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "28px",
  },
  welcomeCard: {
    background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))",
    border: "1px solid rgba(124,58,237,0.2)",
    borderRadius: "18px",
    padding: "28px",
    marginBottom: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  welcomeIcon: { fontSize: "32px" },
  welcomeTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
  },
  welcomeText: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.7,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "24px",
  },
  gridCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  gridCardIcon: { fontSize: "24px" },
  gridCardTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  gridCardText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.6,
  },
  infoPanel: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px",
    padding: "24px",
  },
  infoPanelTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    marginBottom: "16px",
  },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  step: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  stepIcon: { fontSize: "16px", flexShrink: 0 },
  stepText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
  },
};