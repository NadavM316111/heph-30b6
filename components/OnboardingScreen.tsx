"use client";

import { useState } from "react";

interface Props {
  onComplete: () => void;
}

const slides = [
  {
    icon: "🔒",
    title: "Welcome to Confi",
    subtitle: "The World's First Legally Protected Messaging App",
    body: "Every conversation on Confi can be shielded by an internationally recognized Non-Disclosure Agreement — activated with a single tap.",
    accent: "#7c6cf0",
  },
  {
    icon: "📜",
    title: "International NDA Protection",
    subtitle: "Real Legal Weight. Real Consequences.",
    body: "When you enable Confidential Mode, both parties agree to a binding NDA governed by the laws of their registered jurisdiction. Your identity and country are required to make this enforceable.",
    accent: "#6cf0c2",
  },
  {
    icon: "🛡️",
    title: "Your Identity Is the Key",
    subtitle: "Legal Name + Country = Enforceable Contract",
    body: "We collect your legal full name and country so that any NDA you enter into is valid, enforceable, and jurisdictionally sound. This is not optional — it's what makes Confi different.",
    accent: "#f0c26c",
  },
  {
    icon: "✅",
    title: "Verify Once. Trust Always.",
    subtitle: "OTP Verification Protects Everyone",
    body: "Your email is verified via OTP to confirm identity. This ensures that every participant in a confidential conversation is a real, traceable individual — not an anonymous actor.",
    accent: "#6cf07c",
  },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const [current, setCurrent] = useState(0);

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const skip = () => onComplete();

  return (
    <div style={styles.container}>
      <button style={styles.skipBtn} onClick={skip}>
        Skip
      </button>

      <div style={styles.slideContainer}>
        <div style={{ ...styles.iconCircle, background: `${slide.accent}22`, border: `2px solid ${slide.accent}44` }}>
          <span style={styles.icon}>{slide.icon}</span>
        </div>

        <h1 style={{ ...styles.title, color: slide.accent }}>{slide.title}</h1>
        <h2 style={styles.subtitle}>{slide.subtitle}</h2>
        <p style={styles.body}>{slide.body}</p>
      </div>

      <div style={styles.dots}>
        {slides.map((_, i) => (
          <button
            key={i}
            style={{
              ...styles.dot,
              background: i === current ? slide.accent : "#333",
              width: i === current ? "24px" : "8px",
            }}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

      <button
        style={{ ...styles.nextBtn, background: slide.accent }}
        onClick={next}
      >
        {isLast ? "Get Started" : "Next"}
      </button>

      <p style={styles.legalNote}>
        By continuing, you agree to Confi&apos;s Terms of Service and acknowledge
        that confidential conversations may be subject to legally binding NDAs.
      </p>
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
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 28px",
    boxSizing: "border-box",
    gap: "20px",
    position: "relative",
  },
  skipBtn: {
    position: "absolute",
    top: "24px",
    right: "24px",
    background: "transparent",
    border: "1px solid #333",
    color: "#888",
    padding: "6px 16px",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "14px",
  },
  slideContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "16px",
    flex: 1,
    justifyContent: "center",
  },
  iconCircle: {
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "8px",
  },
  icon: {
    fontSize: "56px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    margin: 0,
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#ccc",
    margin: 0,
    lineHeight: "1.4",
  },
  body: {
    fontSize: "15px",
    color: "#888",
    lineHeight: "1.7",
    margin: 0,
    maxWidth: "340px",
  },
  dots: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  dot: {
    height: "8px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.3s ease",
    padding: 0,
  },
  nextBtn: {
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    color: "#000",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  legalNote: {
    fontSize: "11px",
    color: "#555",
    textAlign: "center",
    lineHeight: "1.5",
    maxWidth: "320px",
    margin: 0,
  },
};