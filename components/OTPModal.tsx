"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

// Simulate OTP: in production, Twilio/Firebase would send this.
// We use a deterministic demo OTP stored in sessionStorage for the demo.
function generateDemoOTP(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  sessionStorage.setItem("confi_demo_otp", otp);
  return otp;
}

export default function OTPModal({ email, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [demoCode, setDemoCode] = useState("");
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const code = generateDemoOTP();
    setDemoCode(code);
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (idx: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = char;
    setOtp(next);
    if (char && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
    }
  };

  const handleVerify = async () => {
    const entered = otp.join("");
    if (entered.length < 6) { setError("Enter the complete 6-digit code."); return; }
    setLoading(true);
    setError("");
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    const stored = sessionStorage.getItem("confi_demo_otp");
    if (entered === stored) {
      sessionStorage.removeItem("confi_demo_otp");
      onVerified();
    } else {
      setError("Invalid code. Please try again.");
    }
    setLoading(false);
  };

  const handleResend = () => {
    const code = generateDemoOTP();
    setDemoCode(code);
    setCountdown(60);
    setCanResend(false);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={iconBox}>📨</div>
        <h2 style={title}>Verify Your Email</h2>
        <p style={sub}>
          We sent a 6-digit code to<br />
          <strong style={{ color: "#6ee7b7" }}>{email}</strong>
        </p>

        {/* Demo notice */}
        <div style={demoBanner}>
          <span>🧪 Demo Mode — Your code: </span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24", letterSpacing: 4 }}>
            {demoCode}
          </span>
        </div>

        <div style={otpRow} onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              style={{ ...otpInput, borderColor: digit ? "#6ee7b7" : "rgba(255,255,255,0.1)" }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && <div style={errStyle}>{error}</div>}

        <button style={verifyBtn} onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying…" : "Verify Code →"}
        </button>

        <div style={resendRow}>
          {canResend ? (
            <button style={resendBtn} onClick={handleResend}>Resend Code</button>
          ) : (
            <span style={{ color: "#6b7280", fontSize: 12 }}>
              Resend in {countdown}s
            </span>
          )}
        </div>

        <button style={backBtn} onClick={onBack}>← Change Email</button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  backdropFilter: "blur(8px)",
};
const modal: React.CSSProperties = {
  background: "#111827", border: "1px solid rgba(110,231,183,0.2)",
  borderRadius: 20, padding: "36px 32px", maxWidth: 380, width: "90%",
  display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
};
const iconBox: React.CSSProperties = { fontSize: 40 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: "#9ca3af", textAlign: "center", margin: 0, lineHeight: 1.6 };
const demoBanner: React.CSSProperties = {
  background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
  borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#d1d5db",
  textAlign: "center", width: "100%",
};
const otpRow: React.CSSProperties = {
  display: "flex", gap: 8, justifyContent: "center", marginTop: 4,
};
const otpInput: React.CSSProperties = {
  width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 700,
  background: "rgba(255,255,255,0.06)", border: "2px solid",
  borderRadius: 10, color: "#6ee7b7", outline: "none",
};
const errStyle: React.CSSProperties = {
  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12,
};
const verifyBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #6ee7b7, #3b82f6)", border: "none",
  borderRadius: 10, padding: "12px 28px", color: "#0a0a0f", fontWeight: 700,
  fontSize: 14, cursor: "pointer", width: "100%",
};
const resendRow: React.CSSProperties = { textAlign: "center" };
const resendBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: "#6ee7b7",
  fontSize: 13, cursor: "pointer", textDecoration: "underline",
};
const backBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: "#6b7280",
  fontSize: 12, cursor: "pointer",
};