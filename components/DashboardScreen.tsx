"use client";

import { useState } from "react";
import type { UserSession } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  session: UserSession;
  onLogout: () => void;
}

export default function DashboardScreen({ session, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<"chats" | "profile">("chats");

  const selectedCountry = COUNTRIES.find((c) => c.code === session.country);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>🔒</div>
          <span style={styles.appName}>Confi</span>
        </div>
        <div style={styles.headerBadge}>
          <span style={styles.verifiedDot} />
          Verified Identity
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "chats" && (
        <div style={styles.content}>
          {/* Welcome Banner */}
          <div style={styles.welcomeBanner}>
            <div style={styles.welcomeAvatar}>{getInitials(session.fullName)}</div>
            <div>
              <p style={styles.welcomeName}>
                Welcome, {session.fullName?.split(" ")[0] || "User"}!
              </p>
              <p style={styles.welcomeSub}>Your identity is verified ✓</p>
            </div>
          </div>

          {/* Feature Cards */}
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <span style={styles.featureIcon}>🔒</span>
              <h3 style={styles.featureTitle}>Confidential Mode</h3>
              <p style={styles.featureDesc}>
                Activate an international NDA on any conversation with one tap.
              </p>
              <div style={styles.comingSoon}>Coming in Next Update</div>
            </div>
            <div style={styles.featureCard}>
              <span style={styles.featureIcon}>💬</span>
              <h3 style={styles.featureTitle}>Secure Messaging</h3>
              <p style={styles.featureDesc}>
                End-to-end encrypted conversations with verified users.
              </p>
              <div style={styles.comingSoon}>Coming Soon</div>
            </div>
          </div>

          {/* Status Summary */}
          <div style={styles.statusCard}>
            <h4 style={styles.statusTitle}>Account Status</h4>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Email Verified</span>
              <span style={styles.statusGreen}>✓ Yes</span>
            </div>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Legal Name</span>
              <span style={styles.statusGreen}>✓ {session.fullName}</span>
            </div>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>NDA Jurisdiction</span>
              <span style={styles.statusGreen}>
                {selectedCountry?.flag} {selectedCountry?.name}
              </span>
            </div>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>NDA Agreement</span>
              <span style={styles.statusGreen}>✓ Signed</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div style={styles.content}>
          <div style={styles.profileHeader}>
            <div style={styles.profileAvatar}>{getInitials(session.fullName)}</div>
            <h2 style={styles.profileName}>{session.fullName}</h2>
            <p style={styles.profileEmail}>{session.email}</p>
            <div style={styles.verifiedBadge}>
              <span>🛡️</span> Identity Verified — NDA Active
            </div>
          </div>

          <div style={styles.profileCard}>
            <h4 style={styles.profileSectionTitle}>Legal Identity</h4>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Full Legal Name</span>
              <span style={styles.profileFieldValue}>{session.fullName}</span>
            </div>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Email Address</span>
              <span style={styles.profileFieldValue}>{session.email}</span>
            </div>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Country / Jurisdiction</span>
              <span style={styles.profileFieldValue}>
                {selectedCountry?.flag} {selectedCountry?.name}
              </span>
            </div>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>NDA Framework</span>
              <span style={styles.profileFieldValue}>Confi International v1.0</span>
            </div>
          </div>

          <div style={styles.profileCard}>
            <h4 style={styles.profileSectionTitle}>Account Verification</h4>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Email OTP</span>
              <span style={styles.verifiedGreen}>✓ Verified</span>
            </div>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>Terms of Service</span>
              <span style={styles.verifiedGreen}>✓ Agreed</span>
            </div>
            <div style={styles.profileField}>
              <span style={styles.profileFieldLabel}>NDA Agreement</span>
              <span style={styles.verifiedGreen}>✓ Signed</span>
            </div>
          </div>

          <button style={styles.logoutBtn} onClick={onLogout}>
            Sign Out
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={styles.bottomNav}>
        <button
          style={{ ...styles.navBtn, ...(activeTab === "chats" ? styles.navBtnActive : {}) }}
          onClick={() => setActiveTab("chats")}
        >
          <span style={styles.navIcon}>💬</span>
          <span style={styles.navLabel}>Chats</span>
        </button>
        <button
          style={{ ...styles.navBtn, ...(activeTab === "profile" ? styles.navBtnActive : {}) }}
          onClick={() => setActiveTab("profile")}
        >
          <span style={styles.navIcon}>👤</span>
          <span style={styles.navLabel}>Profile</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "440px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0a0a0f",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    background: "#12121a",
    borderBottom: "1px solid #1e1e2e",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  logo: {
    fontSize: "22px",
  },
  appName: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#7c6cf0",
    letterSpacing: "-0.5px",
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#6cf07c",
    fontWeight: "600",
    background: "#0f2a12",
    padding: "4px 10px",
    borderRadius: "20px",
    border: "1px solid #6cf07c33",
  },
  verifiedDot: {
    width: "6px",
    height: "6px",
    background: "#6cf07c",
    borderRadius: "50%",
    display: "inline-block",
  },
  content: {
    flex: 1,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflowY: "auto",
    paddingBottom: "80px",
  },
  welcomeBanner: {
    background: "linear-gradient(135deg, #1a1428, #12121a)",
    border: "1px solid #7c6cf033",
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  welcomeAvatar: {
    width: "52px",
    height: "52px",
    background: "linear-gradient(135deg, #7c6cf0, #6cf0c2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
    fontWeight: "800",
    fontSize: "18px",
    flexShrink: 0,
  },
  welcomeName: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#fff",
    margin: "0 0 4px 0",
  },
  welcomeSub: {
    fontSize: "12px",
    color: "#6cf07c",
    margin: 0,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  featureCard: {
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "14px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  featureIcon: {
    fontSize: "28px",
  },
  featureTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#fff",
    margin: 0,
  },
  featureDesc: {
    fontSize: "12px",
    color: "#666",
    margin: 0,
    lineHeight: "1.4",
  },
  comingSoon: {
    fontSize: "10px",
    color: "#7c6cf0",
    background: "#1a1428",
    padding: "3px 8px",
    borderRadius: "8px",
    border: "1px solid #7c6cf033",
    display: "inline-block",
    width: "fit-content",
    fontWeight: "600",
  },
  statusCard: {
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "14px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  statusTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#aaa",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #1e1e2e",
  },
  statusLabel: {
    fontSize: "13px",
    color: "#777",
  },
  statusGreen: {
    fontSize: "13px",
    color: "#6cf07c",
    fontWeight: "600",
  },
  profileHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "12px 0",
  },
  profileAvatar: {
    width: "80px",
    height: "80px",
    background: "linear-gradient(135deg, #7c6cf0, #6cf0c2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
    fontWeight: "800",
    fontSize: "28px",
    marginBottom: "4px",
  },
  profileName: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#fff",
    margin: 0,
  },
  profileEmail: {
    fontSize: "13px",
    color: "#666",
    margin: 0,
  },
  verifiedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#6cf0c2",
    background: "#0f1a18",
    padding: "5px 12px",
    borderRadius: "20px",
    border: "1px solid #6cf0c233",
    fontWeight: "600",
  },
  profileCard: {
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "14px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  profileSectionTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#7c6cf0",
    margin: "0 0 12px 0",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  profileField: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "11px 0",
    borderBottom: "1px solid #1e1e2e",
  },
  profileFieldLabel: {
    fontSize: "13px",
    color: "#666",
  },
  profileFieldValue: {
    fontSize: "13px",
    color: "#ddd",
    fontWeight: "600",
    textAlign: "right",
    maxWidth: "180px",
    wordBreak: "break-word",
  },
  verifiedGreen: {
    fontSize: "13px",
    color: "#6cf07c",
    fontWeight: "600",
  },
  logoutBtn: {
    width: "100%",
    padding: "14px",
    background: "transparent",
    border: "1px solid #f05c5c44",
    borderRadius: "13px",
    color: "#f05c5c",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
    marginTop: "4px",
  },
  bottomNav: {
    display: "flex",
    background: "#12121a",
    borderTop: "1px solid #1e1e2e",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: "440px",
    margin: "0 auto",
    zIndex: 10,
  },
  navBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "12px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#555",
    transition: "color 0.2s",
  },
  navBtnActive: {
    color: "#7c6cf0",
  },
  navIcon: {
    fontSize: "22px",
  },
  navLabel: {
    fontSize: "11px",
    fontWeight: "600",
  },
};