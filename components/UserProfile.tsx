"use client";

import { useState } from "react";
import type { User } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";
import { getInitials, generateAvatarColor } from "@/lib/identity";

interface Props {
  user: User;
  onSave: (u: User) => void;
  onBack: () => void;
}

export default function UserProfile({ user, onSave, onBack }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [country, setCountry] = useState(user.country);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const countryObj = COUNTRIES.find((c) => c.code === user.country);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    const updated: User = {
      ...user,
      displayName: displayName.trim(),
      country,
      avatarInitials: getInitials(displayName.trim()),
      avatarColor: generateAvatarColor(user.email),
    };
    // Update stored identity
    const stored = localStorage.getItem(`confi_identity_${user.email}`);
    if (stored) {
      try {
        const identity = JSON.parse(stored);
        identity.displayName = displayName.trim();
        identity.country = country;
        localStorage.setItem(`confi_identity_${user.email}`, JSON.stringify(identity));
      } catch {
        // ignore
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave(updated);
    }, 800);
  };

  return (
    <div style={styles.card}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>

      <div style={styles.avatarSection}>
        <div style={{ ...styles.avatar, background: user.avatarColor }}>
          {user.avatarInitials}
        </div>
        <div style={styles.avatarBadge}>
          {user.identityVerified ? "✓ Verified" : "Unverified"}
        </div>
      </div>

      <h1 style={styles.title}>Your Profile</h1>

      <div style={styles.verifiedBanner}>
        <span>🔐</span>
        <div>
          <div style={styles.verifiedLabel}>Legal Identity Confirmed</div>
          <div style={styles.verifiedSub}>
            <strong>{user.fullName}</strong> · {countryObj?.flag} {countryObj?.name}
          </div>
          <div style={styles.verifiedNote}>
            This data is encrypted and legally binds NDAs to your identity.
            It cannot be changed without re-verification.
          </div>
        </div>
      </div>

      <div style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Email Address</label>
          <div style={styles.readOnly}>{user.email}</div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Display Name</label>
          <input
            style={styles.input}
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setError(""); }}
            placeholder="How others see you"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Country / Jurisdiction</label>
          <select
            style={styles.select}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      <div style={styles.sessionInfo}>
        <span style={styles.sessionLabel}>Session Token (JWT)</span>
        <code style={styles.sessionToken}>
          {user.sessionToken.slice(0, 40)}…
        </code>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "32px 40px",
    width: "100%",
    maxWidth: "480px",
    margin: "20px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
    animation: "fadeIn 0.3s ease-out",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#a78bfa",
    cursor: "pointer",
    fontSize: "14px",
    marginBottom: "20px",
    padding: 0,
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "24px",
    gap: "8px",
  },
  avatar: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "700",
    color: "white",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  avatarBadge: {
    background: "rgba(16,185,129,0.15)",
    border: "1px solid rgba(16,185,129,0.3)",
    color: "#10b981",
    fontSize: "12px",
    fontWeight: "600",
    padding: "2px 10px",
    borderRadius: "20px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "16px",
    textAlign: "center",
  },
  verifiedBanner: {
    display: "flex",
    gap: "12px",
    background: "rgba(16,185,129,0.07)",
    border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "24px",
    alignItems: "flex-start",
    fontSize: "13px",
  },
  verifiedLabel: {
    fontWeight: "700",
    color: "#10b981",
    marginBottom: "4px",
    fontSize: "13px",
  },
  verifiedSub: {
    color: "rgba(255,255,255,0.75)",
    marginBottom: "4px",
  },
  verifiedNote: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    lineHeight: 1.5,
  },
  form: { display: "flex", flexDirection: "column", gap: "0px" },
  inputGroup: { marginBottom: "18px" },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(30,27,75,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
    cursor: "pointer",
  },
  readOnly: {
    padding: "12px 16px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    color: "rgba(255,255,255,0.4)",
    fontSize: "15px",
  },
  error: {
    color: "#f87171",
    fontSize: "13px",
    marginBottom: "12px",
  },
  saveBtn: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(124,58,237,0.35)",
  },
  sessionInfo: {
    marginTop: "24px",
    padding: "14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "10px",
  },
  sessionLabel: {
    display: "block",
    fontSize: "11px",
    color: "rgba(255,255,255,0.3)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  sessionToken: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.25)",
    wordBreak: "break-all",
    fontFamily: "monospace",
  },
};