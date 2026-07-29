"use client";

import { useState, useEffect } from "react";
import { Session, saveSession } from "@/lib/session";
import { getProfile, saveProfile, UserProfile } from "@/lib/profile";
import { AVATAR_OPTIONS } from "@/lib/avatars";

interface Props {
  session: Session;
  onSaved: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({ session, onSaved, onLogout }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const profile = getProfile(session.email);
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setSelectedAvatar(profile.avatar || AVATAR_OPTIONS[0]);
    }
  }, [session.email]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const profile: UserProfile = {
        email: session.email,
        phone: session.phone,
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: selectedAvatar,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveProfile(profile);

      // Update session with display name
      const updatedSession: Session = {
        ...session,
        displayName: displayName.trim(),
        avatar: selectedAvatar,
      };
      saveSession(updatedSession);

      setSuccessMsg("Profile saved!");
      setTimeout(() => {
        onSaved();
      }, 800);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>Your Profile</h2>
        <p style={styles.subtitle}>How others will see you on Confi</p>
      </div>

      {/* Avatar Selection */}
      <div style={styles.avatarSection}>
        <div style={styles.avatarPreview}>{selectedAvatar}</div>
        <p style={styles.avatarLabel}>Choose your avatar</p>
        <div style={styles.avatarGrid}>
          {AVATAR_OPTIONS.map((av) => (
            <button
              key={av}
              style={{
                ...styles.avatarOption,
                ...(selectedAvatar === av ? styles.avatarSelected : {}),
              }}
              onClick={() => setSelectedAvatar(av)}
            >
              {av}
            </button>
          ))}
        </div>
      </div>

      {/* Display Name */}
      <label style={styles.label}>Display Name *</label>
      <input
        style={styles.input}
        type="text"
        placeholder="Your name on Confi"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        maxLength={40}
      />

      {/* Bio */}
      <label style={styles.label}>Bio (optional)</label>
      <textarea
        style={styles.textarea}
        placeholder="Available for confidential messaging..."
        value={bio}
        onChange={e => setBio(e.target.value)}
        maxLength={120}
        rows={3}
      />
      <p style={styles.charCount}>{bio.length}/120</p>

      {/* Account Info */}
      <div style={styles.accountInfo}>
        <div style={styles.accountRow}>
          <span style={styles.accountIcon}>📧</span>
          <span style={styles.accountValue}>{session.email}</span>
        </div>
        {session.phone && (
          <div style={styles.accountRow}>
            <span style={styles.accountIcon}>📱</span>
            <span style={styles.accountValue}>{session.phone}</span>
          </div>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {successMsg && <p style={styles.success}>{successMsg}</p>}

      <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Profile & Continue →"}
      </button>

      <button style={styles.logoutBtn} onClick={onLogout}>
        Sign Out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "480px",
    margin: "20px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  header: {
    marginBottom: "28px",
  },
  title: {
    color: "#ffffff",
    fontSize: "26px",
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: "#8b8fa8",
    fontSize: "14px",
    marginTop: "6px",
    marginBottom: 0,
  },
  avatarSection: {
    textAlign: "center",
    marginBottom: "24px",
  },
  avatarPreview: {
    fontSize: "72px",
    lineHeight: 1,
    marginBottom: "8px",
    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
  },
  avatarLabel: {
    color: "#8b8fa8",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
  },
  avatarGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
  },
  avatarOption: {
    fontSize: "28px",
    background: "rgba(255,255,255,0.05)",
    border: "2px solid transparent",
    borderRadius: "10px",
    padding: "6px",
    cursor: "pointer",
    transition: "all 0.15s",
    lineHeight: 1,
  },
  avatarSelected: {
    border: "2px solid #7c3aed",
    background: "rgba(124,58,237,0.2)",
    boxShadow: "0 0 12px rgba(124,58,237,0.4)",
  },
  label: {
    display: "block",
    color: "#a0a3b1",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "6px",
    marginTop: "16px",
  },
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "15px",
    padding: "12px 14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "14px",
    padding: "12px 14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
  },
  charCount: {
    color: "#4b5563",
    fontSize: "11px",
    textAlign: "right",
    marginTop: "4px",
    marginBottom: 0,
  },
  accountInfo: {
    marginTop: "20px",
    background: "rgba(0,0,0,0.2)",
    borderRadius: "12px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  accountRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  accountIcon: {
    fontSize: "16px",
  },
  accountValue: {
    color: "#9ca3af",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  error: {
    color: "#f87171",
    fontSize: "13px",
    marginTop: "12px",
    padding: "10px 14px",
    background: "rgba(248,113,113,0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(248,113,113,0.2)",
  },
  success: {
    color: "#34d399",
    fontSize: "13px",
    marginTop: "12px",
    padding: "10px 14px",
    background: "rgba(52,211,153,0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(52,211,153,0.2)",
  },
  primaryBtn: {
    marginTop: "24px",
    width: "100%",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(124,58,237,0.4)",
  },
  logoutBtn: {
    marginTop: "10px",
    width: "100%",
    background: "transparent",
    color: "#6b7280",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    cursor: "pointer",
  },
};