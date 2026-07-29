"use client";

import { useState } from "react";
import { saveSession } from "@/lib/session";
import { AVATARS } from "@/lib/avatars";
import { logAuditEvent } from "@/lib/audit";

type Step = "landing" | "mode" | "email" | "otp" | "profile" | "terms";

interface Props {
  onLogin: (user: { email: string; displayName: string; avatar: string }) => void;
  fingerprint: string;
}

export default function AuthScreen({ onLogin, fingerprint }: Props) {
  const [step, setStep] = useState<Step>("landing");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleEmailSubmit = async () => {
    setError("");
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }
      const code = generateOtp();
      setGeneratedOtp(code);
      setOtpSent(true);
      console.info(`[CONFI OTP SIMULATION] Your OTP is: ${code} (In production, sent to ${email})`);
      await logAuditEvent({
        type: "OTP_SENT",
        email,
        fingerprint,
        metadata: { mode },
      });
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleOtpVerify = async () => {
    setError("");
    if (otp.trim() !== generatedOtp) {
      setError(`Invalid OTP. (Demo: check browser console for code)`);
      return;
    }
    await logAuditEvent({
      type: "OTP_VERIFIED",
      email,
      fingerprint,
      metadata: {},
    });
    if (mode === "signup") {
      setStep("profile");
    } else {
      const stored = localStorage.getItem(`confi_profile_${email}`);
      if (stored) {
        const profile = JSON.parse(stored);
        saveSession({ email, displayName: profile.displayName, avatar: profile.avatar });
        onLogin({ email, displayName: profile.displayName, avatar: profile.avatar });
      } else {
        setStep("profile");
      }
    }
  };

  const handleProfileSubmit = () => {
    setError("");
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    setStep("terms");
  };

  const handleTermsAccept = async () => {
    setError("");
    if (!termsAccepted || !ndaAccepted) {
      setError("You must accept both the Terms of Service and the NDA disclosure to continue.");
      return;
    }
    const profileData = { displayName: displayName.trim(), avatar: selectedAvatar };
    localStorage.setItem(`confi_profile_${email}`, JSON.stringify(profileData));
    await logAuditEvent({
      type: "TERMS_ACCEPTED",
      email,
      fingerprint,
      metadata: {
        tosAccepted: true,
        ndaDisclosureAccepted: true,
        timestamp: new Date().toISOString(),
      },
    });
    saveSession({ email, displayName: displayName.trim(), avatar: selectedAvatar });
    onLogin({ email, displayName: displayName.trim(), avatar: selectedAvatar });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {step === "landing" && (
          <LandingStep onNext={() => setStep("mode")} />
        )}
        {step === "mode" && (
          <ModeStep
            mode={mode}
            onModeChange={setMode}
            onNext={() => setStep("email")}
          />
        )}
        {step === "email" && (
          <EmailStep
            mode={mode}
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleEmailSubmit}
            onBack={() => setStep("mode")}
            error={error}
            loading={loading}
          />
        )}
        {step === "otp" && (
          <OtpStep
            email={email}
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleOtpVerify}
            onBack={() => setStep("email")}
            otpSent={otpSent}
            error={error}
          />
        )}
        {step === "profile" && (
          <ProfileStep
            displayName={displayName}
            selectedAvatar={selectedAvatar}
            onNameChange={setDisplayName}
            onAvatarChange={setSelectedAvatar}
            onSubmit={handleProfileSubmit}
            error={error}
          />
        )}
        {step === "terms" && (
          <TermsStep
            termsAccepted={termsAccepted}
            ndaAccepted={ndaAccepted}
            onTermsChange={setTermsAccepted}
            onNdaChange={setNdaAccepted}
            onAccept={handleTermsAccept}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

function LandingStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={styles.stepContainer}>
      <div style={styles.logo}>🔒</div>
      <h1 style={styles.title}>Confi</h1>
      <p style={styles.subtitle}>The world's first messaging app with built-in legally binding confidentiality.</p>
      <div style={styles.featureList}>
        <div style={styles.feature}><span style={styles.featureIcon}>🛡️</span> International NDA protection</div>
        <div style={styles.feature}><span style={styles.featureIcon}>🔐</span> End-to-end encrypted messaging</div>
        <div style={styles.feature}><span style={styles.featureIcon}>📋</span> Legal audit trail</div>
        <div style={styles.feature}><span style={styles.featureIcon}>🌍</span> Cross-border confidentiality</div>
      </div>
      <button style={styles.primaryBtn} onClick={onNext}>Get Started</button>
    </div>
  );
}

function ModeStep({ mode, onModeChange, onNext }: {
  mode: string;
  onModeChange: (m: "signup" | "login") => void;
  onNext: () => void;
}) {
  return (
    <div style={styles.stepContainer}>
      <div style={styles.logo}>🔒</div>
      <h2 style={styles.title}>Welcome to Confi</h2>
      <div style={styles.modeToggle}>
        <button
          style={{ ...styles.modeBtn, ...(mode === "signup" ? styles.modeBtnActive : {}) }}
          onClick={() => onModeChange("signup")}
        >
          Create Account
        </button>
        <button
          style={{ ...styles.modeBtn, ...(mode === "login" ? styles.modeBtnActive : {}) }}
          onClick={() => onModeChange("login")}
        >
          Sign In
        </button>
      </div>
      <button style={styles.primaryBtn} onClick={onNext}>Continue</button>
    </div>
  );
}

function EmailStep({ mode, email, password, onEmailChange, onPasswordChange, onSubmit, onBack, error, loading }: {
  mode: string;
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  error: string;
  loading: boolean;
}) {
  return (
    <div style={styles.stepContainer}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.logo}>📧</div>
      <h2 style={styles.title}>{mode === "signup" ? "Create Your Account" : "Welcome Back"}</h2>
      <p style={styles.subtitle}>We'll send a verification code to confirm your identity.</p>
      <input
        style={styles.input}
        type="email"
        placeholder="Email address"
        value={email}
        onChange={e => onEmailChange(e.target.value)}
        autoComplete="email"
      />
      <input
        style={styles.input}
        type="password"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={e => onPasswordChange(e.target.value)}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />
      {error && <div style={styles.error}>{error}</div>}
      <button style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={onSubmit} disabled={loading}>
        {loading ? "Sending OTP..." : "Send Verification Code"}
      </button>
    </div>
  );
}

function OtpStep({ email, otp, onOtpChange, onVerify, onBack, otpSent, error }: {
  email: string;
  otp: string;
  onOtpChange: (v: string) => void;
  onVerify: () => void;
  onBack: () => void;
  otpSent: boolean;
  error: string;
}) {
  return (
    <div style={styles.stepContainer}>
      <button style={styles.backBtn} onClick={onBack}>← Back</button>
      <div style={styles.logo}>🔢</div>
      <h2 style={styles.title}>Verify Your Identity</h2>
      {otpSent && (
        <div style={styles.infoBanner}>
          ✅ OTP sent to <strong>{email}</strong><br />
          <small style={{ color: "#64ffda" }}>Demo mode: check browser console (F12) for your OTP code</small>
        </div>
      )}
      <input
        style={{ ...styles.input, textAlign: "center", fontSize: "28px", letterSpacing: "12px" }}
        type="text"
        placeholder="000000"
        maxLength={6}
        value={otp}
        onChange={e => onOtpChange(e.target.value.replace(/\D/g, ""))}
      />
      {error && <div style={styles.error}>{error}</div>}
      <button style={styles.primaryBtn} onClick={onVerify}>Verify Code</button>
      <p style={styles.hint}>Didn't receive the code? <span style={styles.link} onClick={onBack}>Try again</span></p>
    </div>
  );
}

function ProfileStep({ displayName, selectedAvatar, onNameChange, onAvatarChange, onSubmit, error }: {
  displayName: string;
  selectedAvatar: string;
  onNameChange: (v: string) => void;
  onAvatarChange: (v: string) => void;
  onSubmit: () => void;
  error: string;
}) {
  return (
    <div style={styles.stepContainer}>
      <div style={styles.logo}>{selectedAvatar}</div>
      <h2 style={styles.title}>Create Your Profile</h2>
      <p style={styles.subtitle}>Choose how you'll appear in conversations.</p>
      <input
        style={styles.input}
        type="text"
        placeholder="Display name"
        value={displayName}
        onChange={e => onNameChange(e.target.value)}
        maxLength={30}
      />
      <div style={styles.avatarGrid}>
        {AVATARS.map(a => (
          <button
            key={a}
            style={{ ...styles.avatarBtn, ...(selectedAvatar === a ? styles.avatarBtnSelected : {}) }}
            onClick={() => onAvatarChange(a)}
          >
            {a}
          </button>
        ))}
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <button style={styles.primaryBtn} onClick={onSubmit}>Continue</button>
    </div>
  );
}

function TermsStep({ termsAccepted, ndaAccepted, onTermsChange, onNdaChange, onAccept, error }: {
  termsAccepted: boolean;
  ndaAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  onNdaChange: (v: boolean) => void;
  onAccept: () => void;
  error: string;
}) {
  return (
    <div style={styles.stepContainer}>
      <div style={styles.logo}>📜</div>
      <h2 style={styles.title}>Legal Agreement</h2>
      <div style={styles.legalBox}>
        <h3 style={styles.legalHeading}>Terms of Service & Privacy Policy</h3>
        <div style={styles.legalScroll}>
          <p style={styles.legalText}>
            <strong>CONFI MESSAGING APPLICATION — TERMS OF SERVICE</strong><br /><br />
            By creating an account, you agree to use Confi solely for lawful purposes. You acknowledge that Confi stores minimal personally identifiable information (PII) in compliance with the General Data Protection Regulation (GDPR) and applicable international privacy laws.<br /><br />
            <strong>DATA WE COLLECT:</strong> Email address (hashed), display name, device fingerprint (for security audit purposes only), message metadata. We do not sell your data to third parties.<br /><br />
            <strong>YOUR RIGHTS (GDPR):</strong> Right to access, rectify, erase, restrict processing, data portability, and object. Contact privacy@confi.app to exercise these rights.<br /><br />
            <strong>DATA RETENTION:</strong> Account data retained for 30 days after account deletion. Message content deleted immediately upon request.
          </p>
        </div>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => onTermsChange(e.target.checked)}
            style={styles.checkbox}
          />
          <span>I have read and agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong></span>
        </label>
      </div>

      <div style={{ ...styles.legalBox, borderColor: "#ffd700", marginTop: "16px" }}>
        <h3 style={{ ...styles.legalHeading, color: "#ffd700" }}>⚠️ IMPORTANT: NDA Disclosure</h3>
        <div style={styles.legalScroll}>
          <p style={styles.legalText}>
            <strong>NON-DISCLOSURE AGREEMENT CAPABILITY DISCLOSURE</strong><br /><br />
            Confi includes a "Confidential Mode" feature. When you or another party activates Confidential Mode in any conversation, <strong>both parties automatically enter into a legally binding International Non-Disclosure Agreement (NDA)</strong> governed by the following terms:<br /><br />
            <strong>JURISDICTION:</strong> The NDA is governed by international commercial law principles, including but not limited to UNCITRAL Model Law provisions, enforceable in the jurisdiction of either party's domicile.<br /><br />
            <strong>OBLIGATIONS:</strong> All information shared in a Confidential Mode conversation is designated as "Confidential Information." Parties agree not to disclose, reproduce, or use such information for any purpose other than the stated purpose of the conversation.<br /><br />
            <strong>DURATION:</strong> Confidentiality obligations survive termination of the conversation for a period of <strong>five (5) years</strong> unless otherwise agreed in writing.<br /><br />
            <strong>PENALTIES:</strong> Breach of the NDA may result in legal action including claims for injunctive relief and monetary damages.<br /><br />
            <strong>YOU ACKNOWLEDGE</strong> that activating Confidential Mode constitutes your legally binding electronic signature on the NDA, as recognized under the Electronic Signatures in Global and National Commerce Act (E-SIGN), eIDAS Regulation (EU), and equivalent international frameworks.<br /><br />
            <strong>THIS IS A REAL LEGAL AGREEMENT. IF YOU DO NOT UNDERSTAND THESE TERMS, CONSULT A LAWYER BEFORE USING CONFIDENTIAL MODE.</strong>
          </p>
        </div>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={ndaAccepted}
            onChange={e => onNdaChange(e.target.checked)}
            style={styles.checkbox}
          />
          <span>I understand and acknowledge that using <strong>Confidential Mode</strong> creates a <strong>legally binding international NDA</strong></span>
        </label>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      <button
        style={{ ...styles.primaryBtn, background: termsAccepted && ndaAccepted ? "linear-gradient(135deg, #00d4ff, #0f3460)" : "#333" }}
        onClick={onAccept}
      >
        Accept & Enter Confi
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    padding: "20px",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px",
    padding: "40px",
    width: "100%",
    maxWidth: "480px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  logo: {
    fontSize: "56px",
    lineHeight: 1,
  },
  title: {
    color: "#fff",
    fontSize: "28px",
    fontWeight: "700",
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    color: "#8892b0",
    fontSize: "15px",
    textAlign: "center",
    margin: 0,
    lineHeight: 1.6,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
    margin: "8px 0",
  },
  feature: {
    color: "#ccd6f6",
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(255,255,255,0.05)",
    padding: "12px 16px",
    borderRadius: "12px",
  },
  featureIcon: {
    fontSize: "20px",
  },
  modeToggle: {
    display: "flex",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "12px",
    padding: "4px",
    width: "100%",
  },
  modeBtn: {
    flex: 1,
    padding: "12px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#8892b0",
    background: "transparent",
    fontSize: "15px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  modeBtnActive: {
    background: "linear-gradient(135deg, #00d4ff, #0f3460)",
    color: "#fff",
  },
  primaryBtn: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #00d4ff, #0f3460)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: "8px",
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "transparent",
    border: "none",
    color: "#00d4ff",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  error: {
    background: "rgba(255,0,0,0.15)",
    border: "1px solid rgba(255,0,0,0.3)",
    color: "#ff6b6b",
    padding: "12px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    width: "100%",
    textAlign: "center",
  },
  infoBanner: {
    background: "rgba(0,212,255,0.1)",
    border: "1px solid rgba(0,212,255,0.3)",
    color: "#00d4ff",
    padding: "12px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    width: "100%",
    textAlign: "center",
    lineHeight: 1.6,
  },
  hint: {
    color: "#8892b0",
    fontSize: "13px",
    margin: 0,
  },
  link: {
    color: "#00d4ff",
    cursor: "pointer",
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "8px",
    width: "100%",
  },
  avatarBtn: {
    fontSize: "28px",
    background: "rgba(255,255,255,0.05)",
    border: "2px solid transparent",
    borderRadius: "10px",
    cursor: "pointer",
    padding: "6px",
    transition: "all 0.2s",
    aspectRatio: "1",
  },
  avatarBtnSelected: {
    border: "2px solid #00d4ff",
    background: "rgba(0,212,255,0.15)",
  },
  legalBox: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    padding: "16px",
    width: "100%",
    boxSizing: "border-box",
  },
  legalHeading: {
    color: "#00d4ff",
    fontSize: "14px",
    margin: "0 0 12px 0",
    fontWeight: "600",
  },
  legalScroll: {
    maxHeight: "160px",
    overflowY: "auto",
    marginBottom: "12px",
  },
  legalText: {
    color: "#8892b0",
    fontSize: "12px",
    lineHeight: 1.7,
    margin: 0,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    color: "#ccd6f6",
    fontSize: "13px",
    cursor: "pointer",
    lineHeight: 1.5,
  },
  checkbox: {
    width: "16px",
    height: "16px",
    marginTop: "2px",
    flexShrink: 0,
    accentColor: "#00d4ff",
  },
};