"use client";

import { useState, useRef } from "react";
import type { AppUser } from "@/app/page";

type Props = {
  user: AppUser;
  onComplete: (user: AppUser) => void;
};

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
];

const AVATAR_ICONS = ["😊", "🦁", "🐺", "🦊", "🐻", "🦋", "🌟", "⚡", "🔥", "💎"];

export default function ProfileSetup({ user, onComplete }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVATAR_ICONS[0]);
  const [usePhoto, setUsePhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoDataUrl(ev.target?.result as string);
      setUsePhoto(true);
    };
    reader.readAsDataURL(file);
  };

  const getAvatarUrl = () => {
    if (usePhoto && photoDataUrl) return photoDataUrl;
    // Generate an SVG avatar
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="40" fill="${selectedColor}"/>
      <text x="40" y="52" font-size="32" text-anchor="middle">${selectedIcon}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      setError("Please enter a display name");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    setError("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 600));

    const avatarUrl = getAvatarUrl();
    const profileData = {
      displayName: displayName.trim(),
      avatarUrl,
      isVerified: false,
    };
    localStorage.setItem("confi_profile", JSON.stringify(profileData));

    const updatedUser: AppUser = {
      ...user,
      displayName: displayName.trim(),
      avatarUrl,
    };

    setLoading(false);
    onComplete(updatedUser);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Set Up Your Profile</h2>
          <p style={styles.subtitle}>This is how others will see you on Confi</p>
        </div>

        {/* Avatar preview */}
        <div style={styles.avatarSection}>
          <div
            style={{
              ...styles.avatarPreview,
              background: !usePhoto ? selectedColor : "transparent",
            }}
            onClick={() => fileRef.current?.click()}
          >
            {usePhoto && photoDataUrl ? (
              <img src={photoDataUrl} alt="avatar" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarIcon}>{selectedIcon}</span>
            )}
            <div style={styles.avatarOverlay}>📷</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoUpload}
          />
          {usePhoto ? (
            <button
              style={styles.clearPhotoBtn}
              onClick={() => { setUsePhoto(false); setPhotoDataUrl(null); }}
            >
              Use icon instead
            </button>
          ) : (
            <button style={styles.clearPhotoBtn} onClick={() => fileRef.current?.click()}>
              Upload photo
            </button>
          )}
        </div>

        {/* Icon selector */}
        {!usePhoto && (
          <>
            <div style={styles.section}>
              <label style={styles.sectionLabel}>Pick an icon</label>
              <div style={styles.iconGrid}>
                {AVATAR_ICONS.map((icon) => (
                  <button
                    key={icon}
                    style={{
                      ...styles.iconBtn,
                      ...(selectedIcon === icon ? styles.iconBtnActive : {}),
                    }}
                    onClick={() => setSelectedIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.sectionLabel}>Pick a color</label>
              <div style={styles.colorGrid}>
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    style={{
                      ...styles.colorBtn,
                      background: color,
                      ...(selectedColor === color ? styles.colorBtnActive : {}),
                    }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Display name */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>Display Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Alex Johnson"
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <span style={styles.charCount}>{displayName.length}/40</span>
        </div>

        {/* Bio */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>Bio (optional)</label>
          <textarea
            style={{ ...styles.input, ...styles.textarea }}
            placeholder="A short bio about yourself..."
            value={bio}
            maxLength={120}
            onChange={(e) => setBio(e.target.value)}
          />
          <span style={styles.charCount}>{bio.length}/120</span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Continue →"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "440px",
    padding: "16px",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "36px 28px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  header: {
    textAlign: "center",
    marginBottom: "28px",
  },
  title: {
    color: "#fff",
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 0 6px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: 0,
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    marginBottom: "24px",
  },
  avatarPreview: {
    width: "88px",
    height: "88px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    border: "3px solid rgba(99,102,241,0.5)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  avatarIcon: {
    fontSize: "40px",
  },
  avatarOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    opacity: 0,
    transition: "opacity 0.2s",
  },
  clearPhotoBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    cursor: "pointer",
    fontSize: "13px",
  },
  section: {
    marginBottom: "16px",
    position: "relative",
  },
  sectionLabel: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: 500,
    display: "block",
    marginBottom: "8px",
  },
  iconGrid: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  iconBtn: {
    width: "40px",
    height: "40px",
    border: "2px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.05)",
    cursor: "pointer",
    fontSize: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  },
  iconBtnActive: {
    borderColor: "#6366f1",
    background: "rgba(99,102,241,0.2)",
    transform: "scale(1.1)",
  },
  colorGrid: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  colorBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s",
    outline: "none",
  },
  colorBtnActive: {
    border: "2px solid #fff",
    transform: "scale(1.2)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.3)",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  textarea: {
    minHeight: "80px",
    resize: "vertical",
  },
  charCount: {
    position: "absolute",
    right: "4px",
    bottom: "-18px",
    color: "#475569",
    fontSize: "11px",
  },
  error: {
    marginBottom: "12px",
    padding: "10px 14px",
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.4)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "14px",
  },
  btn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "8px",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
  },
};