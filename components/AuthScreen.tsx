"use client";

import { useState } from "react";

type Step =
  | "landing"
  | "phone_entry"
  | "otp_verify"
  | "email_entry"
  | "email_password"
  | "profile_setup"
  | "kyc_step";

interface AuthProps {
  onLogin: (sess: {
    email: string;
    token: string;
    userId: number;
    displayName: string;
    avatarColor: string;
    kycVerified: boolean;
  }) => void;
}

const AVATAR_COLORS = [
  "#6c63ff",
  "#3ecfcf",
  "#ff6584",
  "#f5a623",
  "#43e97b",
  "#fa709a",
  "#4facfe",
  "#a18cd1",
];

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Guatemala", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
  "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius",
  "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saudi Arabia",
  "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

export default function AuthScreen({ onLogin }: AuthProps) {
  const [step, setStep] = useState<Step>("landing");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignup, setIsSignup] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [country, setCountry] = useState("United States");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpLocked, setOtpLocked] = useState(false);

  const sendOtp = async () => {
    if (!phone.trim() || phone.length < 7) {
      setError("Enter a valid phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setOtpSent(true);
        setStep("otp_verify");
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch {
      setError("Network error. Try email instead.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpLocked) {
      setError("Too many attempts. Use email login instead.");
      return;
    }
    if (!otp.trim() || otp.length < 4) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.newUser) {
          setTempToken(data.tempToken || "");
          setTempEmail(data.email || "");
          setStep("profile_setup");
        } else {
          onLogin({
            email: data.email,
            token: data.token,
            userId: data.userId,
            displayName: data.displayName,
            avatarColor: data.avatarColor || AVATAR_COLORS[0],
            kycVerified: data.kycVerified || false,
          });
        }
      } else {
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);
        if (newAttempts >= 5) {
          setOtpLocked(true);
          setError("Too many failed attempts. Please use email login.");
        } else {
          setError(
            data.error ||
              `Invalid OTP. ${5 - newAttempts} attempts remaining.`
          );
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (!password.trim() || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: isSignup ? "signup" : "login",
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (isSignup) {
          setTempEmail(data.email);
          setStep("profile_setup");
        } else {
          const profileRes = await fetch("/api/profile/get", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email }),
          });
          const profileData = await profileRes.json();
          onLogin({
            email: data.email,
            token: data.token || generateLocalToken(data.email),
            userId: profileData.userId || 0,
            displayName: profileData.displayName || data.email.split("@")[0],
            avatarColor: profileData.avatarColor || AVATAR_COLORS[0],
            kycVerified: profileData.kycVerified || false,
          });
        }
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSetup = async () => {
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: tempEmail,
          displayName: displayName.trim(),
          avatarColor,
          tempToken,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTempToken(data.token || tempToken);
        setStep("kyc_step");
      } else {
        setError(data.error || "Profile setup failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleKyc = async () => {
    if (!legalFirstName.trim() || !legalLastName.trim()) {
      setError("Enter your full legal name");
      return;
    }
    if (!country) {
      setError("Select your country");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: tempEmail,
          legalFirstName: legalFirstName.trim(),
          legalLastName: legalLastName.trim(),
          country,
          idNumber: idNumber.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onLogin({
          email: tempEmail,
          token: data.token || tempToken,
          userId: data.userId || 0,
          displayName: displayName,
          avatarColor,
          kycVerified: data.kycVerified || false,
        });
      } else {
        setError(data.error || "KYC submission failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles();

  if (step === "landing") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🔐</div>
          <h1 style={styles.title}>Confi</h1>
          <p style={styles.subtitle}>
            Confidential messaging with legally-binding NDA protection
          </p>
          <div style={styles.features}>
            <div style={styles.featureItem}>
              <span>🛡️</span>
              <span>International NDA Protection</span>
            </div>
            <div style={styles.featureItem}>
              <span>🔒</span>
              <span>End-to-End Encrypted</span>
            </div>
            <div style={styles.featureItem}>
              <span>✅</span>
              <span>KYC Identity Verified</span>
            </div>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setStep("phone_entry")}
          >
            📱 Continue with Phone
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => {
              setIsSignup(true);
              setStep("email_entry");
            }}
          >
            ✉️ Sign up with Email
          </button>
          <p
            style={styles.linkText}
            onClick={() => {
              setIsSignup(false);
              setStep("email_entry");
            }}
          >
            Already have an account? <span style={styles.link}>Sign in</span>
          </p>
        </div>
      </div>
    );
  }

  if (step === "phone_entry") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => setStep("landing")}>
            ← Back
          </button>
          <div style={styles.logo}>📱</div>
          <h2 style={styles.title}>Phone Number</h2>
          <p style={styles.subtitle}>
            We'll send a verification code to your phone
          </p>
          <input
            style={styles.input}
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendOtp()}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={sendOtp}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
          <p
            style={styles.linkText}
            onClick={() => {
              setIsSignup(true);
              setStep("email_entry");
            }}
          >
            Use <span style={styles.link}>email instead</span>
          </p>
        </div>
      </div>
    );
  }

  if (step === "otp_verify") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => setStep("phone_entry")}>
            ← Back
          </button>
          <div style={styles.logo}>💬</div>
          <h2 style={styles.title}>Verify OTP</h2>
          <p style={styles.subtitle}>
            Enter the 6-digit code sent to {phone}
          </p>
          <input
            style={{ ...styles.input, letterSpacing: "0.3em", textAlign: "center" }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
            disabled={otpLocked}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{
              ...styles.primaryBtn,
              opacity: loading || otpLocked ? 0.7 : 1,
            }}
            onClick={verifyOtp}
            disabled={loading || otpLocked}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
          <p
            style={styles.linkText}
            onClick={() => {
              setOtpLocked(false);
              setOtpAttempts(0);
              setIsSignup(true);
              setStep("email_entry");
            }}
          >
            Use <span style={styles.link}>email instead</span>
          </p>
          <p style={styles.infoText}>
            ℹ️ For demo: OTP is displayed in server logs
          </p>
        </div>
      </div>
    );
  }

  if (step === "email_entry") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button style={styles.backBtn} onClick={() => setStep("landing")}>
            ← Back
          </button>
          <div style={styles.logo}>{isSignup ? "✉️" : "👋"}</div>
          <h2 style={styles.title}>
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>
          <p style={styles.subtitle}>
            {isSignup
              ? "Sign up with your email address"
              : "Sign in to your Confi account"}
          </p>
          <input
            style={styles.input}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && (
            <input
              style={styles.input}
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
            />
          )}
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={handleEmailAuth}
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : isSignup
              ? "Create Account"
              : "Sign In"}
          </button>
          <p
            style={styles.linkText}
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
              setPassword("");
              setConfirmPassword("");
            }}
          >
            {isSignup ? "Already have an account? " : "New to Confi? "}
            <span style={styles.link}>
              {isSignup ? "Sign in" : "Sign up"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  if (step === "profile_setup") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>👤</div>
          <h2 style={styles.title}>Set Up Profile</h2>
          <p style={styles.subtitle}>Choose how others will see you</p>
          <div style={styles.avatarPreview}>
            <div
              style={{
                ...styles.avatar,
                background: avatarColor,
                fontSize: 36,
                width: 80,
                height: 80,
              }}
            >
              {displayName ? displayName[0].toUpperCase() : "?"}
            </div>
          </div>
          <input
            style={styles.input}
            type="text"
            placeholder="Display name (e.g. Alex)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
          />
          <p style={{ color: "#8892b0", fontSize: 12, marginBottom: 12 }}>
            Choose avatar color:
          </p>
          <div style={styles.colorPicker}>
            {AVATAR_COLORS.map((c) => (
              <div
                key={c}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c,
                  cursor: "pointer",
                  border:
                    avatarColor === c ? "3px solid #fff" : "3px solid transparent",
                  transition: "transform 0.15s",
                  transform: avatarColor === c ? "scale(1.2)" : "scale(1)",
                }}
                onClick={() => setAvatarColor(c)}
              />
            ))}
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={handleProfileSetup}
            disabled={loading}
          >
            {loading ? "Saving…" : "Continue →"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "kyc_step") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🪪</div>
          <h2 style={styles.title}>Identity Verification</h2>
          <p style={styles.subtitle}>
            Required to activate NDA-protected conversations
          </p>
          <div style={styles.kycBanner}>
            <p style={{ fontSize: 12, color: "#ffd700", lineHeight: 1.5 }}>
              ⚖️ Your legal name is used to enforce International NDA
              protections. This information is encrypted and stored securely.
            </p>
          </div>
          <div style={styles.fieldRow}>
            <input
              style={{ ...styles.input, flex: 1, marginRight: 8 }}
              type="text"
              placeholder="Legal first name"
              value={legalFirstName}
              onChange={(e) => setLegalFirstName(e.target.value)}
            />
            <input
              style={{ ...styles.input, flex: 1 }}
              type="text"
              placeholder="Legal last name"
              value={legalLastName}
              onChange={(e) => setLegalLastName(e.target.value)}
            />
          </div>
          <select
            style={styles.select}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            style={styles.input}
            type="text"
            placeholder="Government ID / Passport number (optional)"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
            onClick={handleKyc}
            disabled={loading}
          >
            {loading ? "Submitting…" : "Complete Verification"}
          </button>
          <p
            style={styles.linkText}
            onClick={() => {
              onLogin({
                email: tempEmail,
                token: tempToken,
                userId: 0,
                displayName,
                avatarColor,
                kycVerified: false,
              });
            }}
          >
            Skip for now (NDA mode unavailable)
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function generateLocalToken(email: string): string {
  return btoa(`${email}:${Date.now()}:confi`);
}

function getStyles() {
  return {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0f1e 0%, #1a1f3a 50%, #0d1b2a 100%)",
      padding: 16,
    } as React.CSSProperties,
    card: {
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 24,
      padding: "40px 32px",
      width: "100%",
      maxWidth: 400,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 0,
    } as React.CSSProperties,
    logo: {
      fontSize: 56,
      marginBottom: 8,
    } as React.CSSProperties,
    title: {
      fontSize: 28,
      fontWeight: 700,
      color: "#fff",
      marginBottom: 8,
      textAlign: "center" as const,
    } as React.CSSProperties,
    subtitle: {
      fontSize: 14,
      color: "#8892b0",
      textAlign: "center" as const,
      marginBottom: 24,
      lineHeight: 1.5,
    } as React.CSSProperties,
    input: {
      width: "100%",
      padding: "14px 16px",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      color: "#fff",
      fontSize: 15,
      marginBottom: 12,
      transition: "border-color 0.2s",
    } as React.CSSProperties,
    select: {
      width: "100%",
      padding: "14px 16px",
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 12,
      color: "#fff",
      fontSize: 15,
      marginBottom: 12,
      cursor: "pointer",
    } as React.CSSProperties,
    primaryBtn: {
      width: "100%",
      padding: "14px 16px",
      background: "linear-gradient(135deg, #6c63ff, #3ecfcf)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 600,
      borderRadius: 12,
      marginBottom: 12,
      transition: "opacity 0.2s, transform 0.1s",
    } as React.CSSProperties,
    secondaryBtn: {
      width: "100%",
      padding: "14px 16px",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 500,
      borderRadius: 12,
      marginBottom: 12,
    } as React.CSSProperties,
    error: {
      color: "#ff6584",
      fontSize: 13,
      textAlign: "center" as const,
      marginBottom: 8,
      padding: "8px 12px",
      background: "rgba(255,101,132,0.1)",
      borderRadius: 8,
      width: "100%",
    } as React.CSSProperties,
    linkText: {
      fontSize: 13,
      color: "#8892b0",
      cursor: "pointer",
      marginTop: 4,
      textAlign: "center" as const,
    } as React.CSSProperties,
    link: {
      color: "#6c63ff",
      fontWeight: 600,
    } as React.CSSProperties,
    infoText: {
      fontSize: 11,
      color: "#4a5568",
      marginTop: 8,
      textAlign: "center" as const,
    } as React.CSSProperties,
    features: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 8,
      marginBottom: 24,
      width: "100%",
    } as React.CSSProperties,
    featureItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      color: "#a0aec0",
      padding: "8px 12px",
      background: "rgba(255,255,255,0.04)",
      borderRadius: 8,
    } as React.CSSProperties,
    backBtn: {
      alignSelf: "flex-start",
      background: "transparent",
      color: "#6c63ff",
      fontSize: 14,
      fontWeight: 500,
      marginBottom: 16,
      padding: 0,
    } as React.CSSProperties,
    avatarPreview: {
      marginBottom: 16,
    } as React.CSSProperties,
    avatar: {
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
    } as React.CSSProperties,
    colorPicker: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap" as const,
      justifyContent: "center",
      marginBottom: 20,
    } as React.CSSProperties,
    kycBanner: {
      width: "100%",
      padding: "10px 14px",
      background: "rgba(255,215,0,0.07)",
      border: "1px solid rgba(255,215,0,0.2)",
      borderRadius: 10,
      marginBottom: 16,
    } as React.CSSProperties,
    fieldRow: {
      display: "flex",
      width: "100%",
      gap: 0,
      marginBottom: 0,
    } as React.CSSProperties,
  };
}