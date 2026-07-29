"use client";

import { useState, useEffect, useRef } from "react";
import type { UserSession } from "@/app/page";

interface Props {
  session: UserSession;
  onVerified: () => void;
  onBack: () => void;
}

export default function OTPScreen({ session, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const generateAndSendOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setCountdown(60);
    setCanResend(false);
    // In production this would call an email/SMS service
    // For demo: log to console (replace with actual service when available)
    console.info(`[CONFI OTP] Code for ${session.email}: ${code}`);
    // Show the OTP in a dev-friendly info box
    setError("");
  };

  useEffect(() => {
    generateAndSendOtp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otp];
    updated[index] = value.slice(-1);
    setOtp(updated);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (attempts >= 5) {
      setError("Too many incorrect attempts. Please request a new code.");
      return;
    }

    setLoading(true);
    // Simulate async verification
    await new Promise((r) => setTimeout(r, 800));

    if (code === generatedOtp) {
      setLoading(false);
      onVerified();
    } else {
      setAttempts((a) => a + 1);
      setError(`Incorrect code. ${4 - attempts} attempts remaining.`);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={onBack}>
        ← Back
      </button>

      <div style={styles.header}>
        <div style={styles.iconCircle}>📧</div>
        <h1 style={styles.title}>Verify Your Email</h1>
        <p style={styles.subtitle}>
          We sent a 6-digit verification code to
        </p>
        <p style={styles.emailDisplay}>{session.email}</p>
      </div>

      <div style={styles.card}>
        <div style={styles.devNote}>
          <span style={styles.devNoteIcon}>🔧</span>
          <div>
            <p style={styles.devNoteTitle}>Development Mode</p>
            <p style={styles.devNoteText}>
              OTP service not yet connected. Your code:{" "}
              <strong style={{ color: "#6cf0c2", letterSpacing: "3px" }}>
                {generatedOtp}
              </strong>
            </p>
          </div>
        </div>

        <div style={styles.otpRow} onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              style={{
                ...styles.otpInput,
                borderColor: digit ? "#7c6cf0" : "#2a2a3a",
                background: digit ? "#1e1a3a" : "#1a1a28",
              }}
            />
          ))}
        </div>

        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        <button
          style={{ ...styles.verifyBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleVerify}
          disabled={loading || otp.join("").length < 6}
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>

        <div style={styles.resendRow}>
          {canResend ? (
            <button
              style={styles.resendBtn}
              onClick={() => {
                setAttempts(0);
                setOtp(["", "", "", "", "", ""]);
                generateAndSendOtp();
                inputRefs.current[0]?.focus();
              }}
            >
              Resend Code
            </button>
          ) : (
            <p style={styles.countdownText}>
              Resend available in{" "}
              <span style={{ color: "#7c6cf0" }}>{countdown}s</span>
            </p>
          )}
        </div>
      </div>

      <div style={styles.securityNote}>
        <span>🛡️</span>
        <p>
          Email verification ensures your identity is confirmed before any NDA
          can be attached to your account.
        </p>
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
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    boxSizing: "border-box",
    gap: "24px",
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    top: "24px",
    left: "20px",
    background: "transparent",
    border: "none",
    color: "#7c6cf0",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    padding: "4px 8px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  iconCircle: {
    width: "80px",
    height: "80px",
    background: "#1a1a28",
    border: "2px solid #7c6cf044",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "36px",
    marginBottom: "4px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    margin: 0,
  },
  emailDisplay: {
    fontSize: "15px",
    color: "#7c6cf0",
    fontWeight: "600",
    margin: 0,
    background: "#1a1a28",
    padding: "6px 16px",
    borderRadius: "20px",
    border: "1px solid #7c6cf033",
  },
  card: {
    width: "100%",
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "20px",
    padding: "28px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  devNote: {
    background: "#0f1a12",
    border: "1px solid #6cf07c33",
    borderRadius: "10px",
    padding: "12px 14px",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  devNoteIcon: {
    fontSize: "18px",
    flexShrink: 0,
  },
  devNoteTitle: {
    fontSize: "12px",
    color: "#6cf07c",
    fontWeight: "700",
    margin: "0 0 2px 0",
  },
  devNoteText: {
    fontSize: "12px",
    color: "#aaa",
    margin: 0,
    lineHeight: "1.4",
  },
  otpRow: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  otpInput: {
    width: "48px",
    height: "58px",
    textAlign: "center",
    fontSize: "24px",
    fontWeight: "700",
    color: "#fff",
    border: "2px solid #2a2a3a",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s",
    caretColor: "#7c6cf0",
  },
  errorBox: {
    background: "#2a0f0f",
    border: "1px solid #f05c5c44",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#f05c5c",
    fontSize: "13px",
  },
  verifyBtn: {
    width: "100%",
    padding: "15px",
    background: "linear-gradient(135deg, #7c6cf0, #6cf0c2)",
    border: "none",
    borderRadius: "13px",
    color: "#000",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  resendRow: {
    display: "flex",
    justifyContent: "center",
  },
  resendBtn: {
    background: "transparent",
    border: "1px solid #7c6cf0",
    color: "#7c6cf0",
    padding: "8px 20px",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  countdownText: {
    fontSize: "13px",
    color: "#555",
    margin: 0,
  },
  securityNote: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    maxWidth: "340px",
    padding: "0 4px",
  },
  // securityNoteText handled inline
};

// Fix unused styles warning
void styles;