"use client";

import { useEffect, useState, useCallback } from "react";
import { COUNTRIES } from "@/lib/countries";
import { generateUserId, generateOTP, validatePhone, validateEmail, validatePin } from "@/lib/identity";

type Screen =
  | "splash"
  | "welcome"
  | "phone-entry"
  | "otp-verify"
  | "email-backup"
  | "legal-name"
  | "country-select"
  | "display-name"
  | "avatar-select"
  | "pin-setup"
  | "pin-confirm"
  | "biometric-prompt"
  | "profile"
  | "pin-unlock"
  | "login-phone"
  | "login-otp"
  | "login-pin";

interface UserProfile {
  userId: string;
  phone: string;
  email: string;
  legalName: string;
  country: string;
  countryCode: string;
  displayName: string;
  avatarSeed: number;
  pinHash: string;
  biometricEnabled: boolean;
  createdAt: string;
  sessionToken: string;
}

const AVATAR_COUNT = 12;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [email, setEmail] = useState("");
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(0);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginGeneratedOtp, setLoginGeneratedOtp] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [sessionValid, setSessionValid] = useState(false);

  // Track page
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // Check biometric support
  useEffect(() => {
    if (
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
        (available) => setBiometricSupported(available)
      );
    }
  }, []);

  // Load session on mount
  useEffect(() => {
    const stored = localStorage.getItem("confi_profile");
    const token = localStorage.getItem("confi_session");
    if (stored && token) {
      try {
        const p: UserProfile = JSON.parse(stored);
        if (p.sessionToken === token) {
          setProfile(p);
          setSessionValid(true);
          // Check if biometric enabled
          if (p.biometricEnabled) {
            setScreen("biometric-prompt");
          } else {
            setScreen("pin-unlock");
          }
          return;
        }
      } catch {}
    }
    setTimeout(() => setScreen("welcome"), 1800);
  }, []);

  const clearError = () => setError("");

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  // --- OTP SEND (simulated, logged to console in dev) ---
  const handleSendOtp = useCallback(() => {
    if (!validatePhone(phone)) {
      showError("Enter a valid phone number (10-15 digits)");
      return;
    }
    const code = generateOTP();
    setGeneratedOtp(code);
    console.info(`[CONFI OTP] Code for ${phone}: ${code}`);
    showSuccess(`OTP sent to ${phone} (check console in demo)`);
    setScreen("otp-verify");
  }, [phone]);

  const handleVerifyOtp = useCallback(() => {
    if (otp.length !== 6) {
      showError("Enter the 6-digit OTP");
      return;
    }
    if (otp !== generatedOtp) {
      showError("Invalid OTP. Try again.");
      return;
    }
    showSuccess("Phone verified!");
    setScreen("email-backup");
  }, [otp, generatedOtp]);

  const handleEmailNext = useCallback(() => {
    if (email && !validateEmail(email)) {
      showError("Enter a valid email address");
      return;
    }
    setScreen("legal-name");
  }, [email]);

  const handleLegalNameNext = useCallback(() => {
    if (!legalName.trim() || legalName.trim().length < 3) {
      showError("Enter your full legal name (min 3 characters)");
      return;
    }
    setScreen("country-select");
  }, [legalName]);

  const handleCountrySelect = useCallback(
    (name: string, code: string) => {
      setCountry(name);
      setCountryCode(code);
      setScreen("display-name");
    },
    []
  );

  const handleDisplayNameNext = useCallback(() => {
    if (!displayName.trim() || displayName.trim().length < 2) {
      showError("Display name must be at least 2 characters");
      return;
    }
    setScreen("avatar-select");
  }, [displayName]);

  const handleAvatarNext = useCallback(() => {
    setScreen("pin-setup");
  }, []);

  const handlePinNext = useCallback(() => {
    if (!validatePin(pin)) {
      showError("PIN must be exactly 6 digits");
      return;
    }
    setScreen("pin-confirm");
  }, [pin]);

  const handlePinConfirm = useCallback(() => {
    if (pinConfirm !== pin) {
      showError("PINs do not match. Try again.");
      setPinConfirm("");
      return;
    }
    setScreen("biometric-prompt");
  }, [pin, pinConfirm]);

  const finishRegistration = useCallback(
    async (biometricEnabled: boolean) => {
      setLoading(true);
      try {
        // Register via /api/auth
        const userId = generateUserId();
        const emailToUse = email || `${phone.replace(/\D/g, "")}@confi.app`;

        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "signup",
            email: emailToUse,
            password: pin, // PIN as password — hashed server-side
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          // If account exists, try login
          if (data.error?.includes("exist") || data.error?.includes("duplicate")) {
            showError("An account with this contact already exists. Please login.");
            setLoading(false);
            setScreen("welcome");
            return;
          }
          showError(data.error || "Registration failed. Please try again.");
          setLoading(false);
          return;
        }

        const sessionToken = `confi_${userId}_${Date.now()}`;
        const newProfile: UserProfile = {
          userId,
          phone,
          email: emailToUse,
          legalName: legalName.trim(),
          country,
          countryCode,
          displayName: displayName.trim(),
          avatarSeed,
          pinHash: pin, // In production, this would be bcrypt hashed client-side or server-side
          biometricEnabled,
          createdAt: new Date().toISOString(),
          sessionToken,
        };

        localStorage.setItem("confi_profile", JSON.stringify(newProfile));
        localStorage.setItem("confi_session", sessionToken);
        setProfile(newProfile);
        setSessionValid(true);
        setScreen("profile");
        showSuccess("Account created successfully!");
      } catch {
        showError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, phone, pin, legalName, country, countryCode, displayName, avatarSeed]
  );

  const handleBiometricSetup = useCallback(async () => {
    if (!biometricSupported) {
      await finishRegistration(false);
      return;
    }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Confi Messaging", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(phone),
            name: phone,
            displayName: displayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });
      if (credential) {
        await finishRegistration(true);
      }
    } catch {
      // User declined or error — proceed without biometric
      await finishRegistration(false);
    }
  }, [biometricSupported, phone, displayName, finishRegistration]);

  // --- LOGIN FLOW ---
  const handleLoginSendOtp = useCallback(() => {
    if (!validatePhone(loginPhone)) {
      showError("Enter a valid phone number");
      return;
    }
    const code = generateOTP();
    setLoginGeneratedOtp(code);
    console.info(`[CONFI LOGIN OTP] Code for ${loginPhone}: ${code}`);
    showSuccess(`OTP sent (check console in demo)`);
    setScreen("login-otp");
  }, [loginPhone]);

  const handleLoginVerifyOtp = useCallback(() => {
    if (loginOtp !== loginGeneratedOtp) {
      showError("Invalid OTP");
      return;
    }
    // Check local profile
    const stored = localStorage.getItem("confi_profile");
    if (!stored) {
      showError("No account found for this number. Please sign up.");
      setScreen("welcome");
      return;
    }
    const p: UserProfile = JSON.parse(stored);
    if (p.phone !== loginPhone) {
      showError("Phone number doesn't match registered account.");
      return;
    }
    setProfile(p);
    setScreen("login-pin");
  }, [loginOtp, loginGeneratedOtp, loginPhone]);

  const handleLoginPin = useCallback(async () => {
    if (!profile) return;
    if (unlockPin !== profile.pinHash) {
      showError("Incorrect PIN");
      setUnlockPin("");
      return;
    }
    setLoading(true);
    try {
      const emailToUse = profile.email;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email: emailToUse, password: unlockPin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      const newToken = `confi_${profile.userId}_${Date.now()}`;
      const updated = { ...profile, sessionToken: newToken };
      localStorage.setItem("confi_profile", JSON.stringify(updated));
      localStorage.setItem("confi_session", newToken);
      setProfile(updated);
      setSessionValid(true);
      setScreen("profile");
    } catch {
      showError("Network error");
    } finally {
      setLoading(false);
    }
  }, [profile, unlockPin]);

  // --- UNLOCK FLOWS ---
  const handlePinUnlock = useCallback(async () => {
    if (!profile) return;
    if (unlockPin !== profile.pinHash) {
      showError("Incorrect PIN");
      setUnlockPin("");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email: profile.email, password: unlockPin }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }
      const newToken = `confi_${profile.userId}_${Date.now()}`;
      const updated = { ...profile, sessionToken: newToken };
      localStorage.setItem("confi_profile", JSON.stringify(updated));
      localStorage.setItem("confi_session", newToken);
      setProfile(updated);
      setSessionValid(true);
      setScreen("profile");
    } catch {
      showError("Network error");
    } finally {
      setLoading(false);
    }
  }, [profile, unlockPin]);

  const handleBiometricUnlock = useCallback(async () => {
    if (!profile) return;
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (assertion) {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "login", email: profile.email, password: profile.pinHash }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          showError("Authentication failed. Use PIN instead.");
          setScreen("pin-unlock");
          return;
        }
        const newToken = `confi_${profile.userId}_${Date.now()}`;
        const updated = { ...profile, sessionToken: newToken };
        localStorage.setItem("confi_profile", JSON.stringify(updated));
        localStorage.setItem("confi_session", newToken);
        setProfile(updated);
        setSessionValid(true);
        setScreen("profile");
      }
    } catch {
      showError("Biometric failed. Use your PIN.");
      setScreen("pin-unlock");
    }
  }, [profile]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("confi_session");
    setSessionValid(false);
    setProfile(null);
    setUnlockPin("");
    setOtp("");
    setPin("");
    setPinConfirm("");
    setPhone("");
    setEmail("");
    setLegalName("");
    setCountry("");
    setDisplayName("");
    setScreen("welcome");
  }, []);

  // Avatar SVG generator
  const renderAvatar = (seed: number, size = 64) => {
    const colors = [
      ["#6C63FF", "#A29BFE"],
      ["#FF6584", "#FDB5C8"],
      ["#43B89C", "#96E6D5"],
      ["#FF9F43", "#FFD08A"],
      ["#5F27CD", "#C8B6FF"],
      ["#1DD1A1", "#AAFCDC"],
      ["#FF6B6B", "#FFB8B8"],
      ["#54A0FF", "#A8D4FF"],
      ["#FF9FF3", "#FFD6FC"],
      ["#01CBC6", "#7EFCF6"],
      ["#F368E0", "#FFADF5"],
      ["#FF9F43", "#FFC07A"],
    ];
    const shapes = ["circle", "square", "triangle", "star"];
    const color = colors[seed % colors.length];
    const shape = shapes[seed % shapes.length];
    const initials = profile?.displayName
      ? profile.displayName.slice(0, 2).toUpperCase()
      : "C";

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ borderRadius: "50%", display: "block" }}
      >
        <defs>
          <linearGradient id={`grad-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color[0]} />
            <stop offset="100%" stopColor={color[1]} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill={`url(#grad-${seed})`} />
        {shape === "circle" && (
          <circle cx="32" cy="32" r="16" fill="rgba(255,255,255,0.2)" />
        )}
        {shape === "square" && (
          <rect x="18" y="18" width="28" height="28" rx="4" fill="rgba(255,255,255,0.2)" />
        )}
        {shape === "triangle" && (
          <polygon points="32,14 50,50 14,50" fill="rgba(255,255,255,0.2)" />
        )}
        {shape === "star" && (
          <polygon
            points="32,12 36,26 50,26 39,35 43,49 32,41 21,49 25,35 14,26 28,26"
            fill="rgba(255,255,255,0.2)"
          />
        )}
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fill="white"
          fontSize="16"
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {initials}
        </text>
      </svg>
    );
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ============ SCREENS ============

  if (screen === "splash") {
    return (
      <div style={styles.splash}>
        <div style={styles.splashLogo}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="40" fill="#6C63FF" />
            <path
              d="M20 30 Q20 20 30 20 L50 20 Q60 20 60 30 L60 45 Q60 55 50 55 L35 55 L25 65 L28 55 Q20 55 20 45 Z"
              fill="white"
            />
            <circle cx="32" cy="37" r="3" fill="#6C63FF" />
            <circle cx="40" cy="37" r="3" fill="#6C63FF" />
            <circle cx="48" cy="37" r="3" fill="#6C63FF" />
          </svg>
        </div>
        <div style={styles.splashTitle}>Confi</div>
        <div style={styles.splashSubtitle}>Confidential Messaging</div>
        <div style={styles.splashLoader}>
          <div style={styles.splashDot1} />
          <div style={styles.splashDot2} />
          <div style={styles.splashDot3} />
        </div>
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <div style={styles.screen}>
        <div style={styles.welcomeHero}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="60" fill="linear-gradient(135deg,#6C63FF,#A29BFE)" />
            <circle cx="60" cy="60" r="60" fill="#6C63FF" />
            <path
              d="M25 45 Q25 30 40 30 L80 30 Q95 30 95 45 L95 68 Q95 83 80 83 L55 83 L35 98 L39 83 Q25 83 25 68 Z"
              fill="white"
              opacity="0.95"
            />
            <circle cx="47" cy="57" r="4.5" fill="#6C63FF" />
            <circle cx="60" cy="57" r="4.5" fill="#6C63FF" />
            <circle cx="73" cy="57" r="4.5" fill="#6C63FF" />
            <rect x="38" y="38" width="20" height="3" rx="1.5" fill="#A29BFE" />
            <rect x="38" y="44" width="35" height="3" rx="1.5" fill="#C8B6FF" />
          </svg>
        </div>
        <h1 style={styles.welcomeTitle}>Welcome to Confi</h1>
        <p style={styles.welcomeDesc}>
          The world&apos;s first messaging app with built-in confidentiality agreements.
          Your conversations, legally protected.
        </p>
        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🔒</span>
            <span>End-to-end encrypted messages</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>📜</span>
            <span>International NDA protection</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>🌍</span>
            <span>Legally binding across 190+ countries</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureIcon}>👤</span>
            <span>Verified identity layer</span>
          </div>
        </div>
        <button
          style={styles.btnPrimary}
          onClick={() => setScreen("phone-entry")}
        >
          Create Account
        </button>
        <button
          style={styles.btnSecondary}
          onClick={() => setScreen("login-phone")}
        >
          I already have an account
        </button>
      </div>
    );
  }

  if (screen === "phone-entry") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("welcome")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>📱</div>
          <h2 style={styles.stepTitle}>Your Phone Number</h2>
          <p style={styles.stepDesc}>
            We&apos;ll send a verification code to confirm your number. This becomes your Confi ID.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Phone Number</label>
          <input
            style={styles.input}
            type="tel"
            placeholder="+1 234 567 8900"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
          />
          <p style={styles.hint}>Include country code (e.g., +1, +44, +91)</p>
        </div>
        <div style={styles.ndaNotice}>
          <span style={styles.ndaIcon}>📋</span>
          <span>Your phone number and legal identity will be used for NDA verification and contract signing.</span>
        </div>
        <button style={styles.btnPrimary} onClick={handleSendOtp}>
          Send Verification Code
        </button>
      </div>
    );
  }

  if (screen === "otp-verify") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("phone-entry")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🔢</div>
          <h2 style={styles.stepTitle}>Verify Your Number</h2>
          <p style={styles.stepDesc}>
            Enter the 6-digit code sent to <strong>{phone}</strong>
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        <div style={styles.otpContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              style={styles.otpBox}
              type="text"
              maxLength={1}
              value={otp[i] || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/, "");
                const arr = otp.split("");
                arr[i] = val;
                setOtp(arr.join(""));
                if (val && i < 5) {
                  const next = document.getElementById(`otp-${i + 1}`);
                  next?.focus();
                }
              }}
              id={`otp-${i}`}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !otp[i] && i > 0) {
                  const prev = document.getElementById(`otp-${i - 1}`);
                  prev?.focus();
                }
              }}
            />
          ))}
        </div>
        <p style={styles.devHint}>
          💡 Demo mode: Check browser console for OTP
        </p>
        <button style={styles.btnPrimary} onClick={handleVerifyOtp}>
          Verify
        </button>
        <button
          style={styles.btnLink}
          onClick={() => {
            const code = generateOTP();
            setGeneratedOtp(code);
            console.info(`[CONFI OTP RESEND] Code for ${phone}: ${code}`);
            showSuccess("New OTP sent!");
          }}
        >
          Resend Code
        </button>
      </div>
    );
  }

  if (screen === "email-backup") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("otp-verify")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>📧</div>
          <h2 style={styles.stepTitle}>Email Backup</h2>
          <p style={styles.stepDesc}>
            Add an email for account recovery and NDA delivery. Optional but recommended.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Email Address (optional)</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={styles.ndaNotice}>
          <span style={styles.ndaIcon}>📜</span>
          <span>NDA documents and legal notices will be delivered to this email address.</span>
        </div>
        <button style={styles.btnPrimary} onClick={handleEmailNext}>
          {email ? "Continue" : "Skip for now"}
        </button>
      </div>
    );
  }

  if (screen === "legal-name") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("email-backup")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>⚖️</div>
          <h2 style={styles.stepTitle}>Legal Full Name</h2>
          <p style={styles.stepDesc}>
            This name will appear on all Confi NDAs and confidentiality agreements.
            It must match your government-issued ID.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Full Legal Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="First Middle Last"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            autoComplete="name"
          />
          <p style={styles.hint}>As it appears on your passport or national ID</p>
        </div>
        <div style={styles.legalWarning}>
          <div style={styles.legalWarningTitle}>⚖️ Legal Notice</div>
          <div>
            By providing your legal name, you certify that this information is
            accurate and agree that it will be used to execute binding
            Non-Disclosure Agreements under applicable international law.
          </div>
        </div>
        <button style={styles.btnPrimary} onClick={handleLegalNameNext}>
          Continue
        </button>
      </div>
    );
  }

  if (screen === "country-select") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("legal-name")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🌍</div>
          <h2 style={styles.stepTitle}>Your Country</h2>
          <p style={styles.stepDesc}>
            Determines which legal jurisdiction governs your NDAs.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <input
          style={{ ...styles.input, marginBottom: 8 }}
          type="text"
          placeholder="Search countries..."
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
        />
        <div style={styles.countryList}>
          {filteredCountries.slice(0, 50).map((c) => (
            <button
              key={c.code}
              style={{
                ...styles.countryItem,
                ...(country === c.name ? styles.countryItemSelected : {}),
              }}
              onClick={() => handleCountrySelect(c.name, c.code)}
            >
              <span style={styles.countryFlag}>{c.flag}</span>
              <span style={styles.countryName}>{c.name}</span>
              <span style={styles.countryCode}>{c.code}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "display-name") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("country-select")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>💬</div>
          <h2 style={styles.stepTitle}>Display Name</h2>
          <p style={styles.stepDesc}>
            This is how other Confi users will see you. Can be different from your legal name.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Display Name *</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Your name or nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Your Unique Confi ID</label>
          <div style={styles.idDisplay}>
            🆔 Will be generated after signup
          </div>
        </div>
        <button style={styles.btnPrimary} onClick={handleDisplayNameNext}>
          Continue
        </button>
      </div>
    );
  }

  if (screen === "avatar-select") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("display-name")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🎨</div>
          <h2 style={styles.stepTitle}>Choose Your Avatar</h2>
          <p style={styles.stepDesc}>Pick a profile avatar for your Confi account.</p>
        </div>
        <div style={styles.avatarGrid}>
          {Array.from({ length: AVATAR_COUNT }).map((_, i) => (
            <button
              key={i}
              style={{
                ...styles.avatarOption,
                ...(avatarSeed === i ? styles.avatarOptionSelected : {}),
              }}
              onClick={() => setAvatarSeed(i)}
            >
              {renderAvatar(i, 56)}
            </button>
          ))}
        </div>
        <div style={styles.selectedPreview}>
          {renderAvatar(avatarSeed, 80)}
          <span style={styles.selectedPreviewName}>{displayName}</span>
        </div>
        <button style={styles.btnPrimary} onClick={handleAvatarNext}>
          Use This Avatar
        </button>
      </div>
    );
  }

  if (screen === "pin-setup") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("avatar-select")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🔐</div>
          <h2 style={styles.stepTitle}>Set Your PIN</h2>
          <p style={styles.stepDesc}>
            Create a 6-digit PIN to secure your account. This PIN unlocks the app and signs NDAs.
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.pinContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.pinDot,
                ...(pin.length > i ? styles.pinDotFilled : {}),
              }}
            />
          ))}
        </div>
        <input
          style={styles.hiddenInput}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/, ""))}
          autoFocus
          id="pin-input"
        />
        <div style={styles.numpadWrapper}>
          <Numpad value={pin} onChange={setPin} maxLength={6} />
        </div>
        <button style={styles.btnPrimary} onClick={handlePinNext} disabled={pin.length < 6}>
          Set PIN
        </button>
      </div>
    );
  }

  if (screen === "pin-confirm") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => { setScreen("pin-setup"); setPinConfirm(""); }}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>✅</div>
          <h2 style={styles.stepTitle}>Confirm PIN</h2>
          <p style={styles.stepDesc}>Re-enter your 6-digit PIN to confirm.</p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.pinContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.pinDot,
                ...(pinConfirm.length > i ? styles.pinDotFilled : {}),
              }}
            />
          ))}
        </div>
        <div style={styles.numpadWrapper}>
          <Numpad value={pinConfirm} onChange={setPinConfirm} maxLength={6} />
        </div>
        <button style={styles.btnPrimary} onClick={handlePinConfirm} disabled={pinConfirm.length < 6}>
          Confirm PIN
        </button>
      </div>
    );
  }

  if (screen === "biometric-prompt") {
    // Could be signup biometric setup OR returning user with biometric
    const isSetup = !sessionValid;
    return (
      <div style={styles.screen}>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>👁️</div>
          <h2 style={styles.stepTitle}>
            {isSetup ? "Enable Biometric Unlock" : `Welcome back, ${profile?.displayName}`}
          </h2>
          <p style={styles.stepDesc}>
            {isSetup
              ? "Use Face ID or fingerprint to unlock Confi instantly."
              : "Use biometric authentication to unlock your account."}
          </p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {!biometricSupported && (
          <div style={styles.warningBanner}>
            Biometric authentication is not available on this device/browser.
          </div>
        )}
        {isSetup ? (
          <>
            {biometricSupported && (
              <button
                style={{ ...styles.btnPrimary, ...styles.bioBtn }}
                onClick={handleBiometricSetup}
                disabled={loading}
              >
                <span style={styles.bioIcon}>🔏</span>
                {loading ? "Setting up..." : "Enable Face ID / Fingerprint"}
              </button>
            )}
            <button
              style={styles.btnSecondary}
              onClick={() => finishRegistration(false)}
              disabled={loading}
            >
              {loading ? "Creating account..." : "Skip, use PIN only"}
            </button>
          </>
        ) : (
          <>
            {profile?.biometricEnabled && biometricSupported && (
              <button
                style={{ ...styles.btnPrimary, ...styles.bioBtn }}
                onClick={handleBiometricUnlock}
              >
                <span style={styles.bioIcon}>🔏</span>
                Unlock with Biometrics
              </button>
            )}
            <button
              style={styles.btnSecondary}
              onClick={() => setScreen("pin-unlock")}
            >
              Use PIN instead
            </button>
          </>
        )}
      </div>
    );
  }

  if (screen === "pin-unlock") {
    return (
      <div style={styles.screen}>
        <div style={styles.stepHeader}>
          <div style={styles.avatarCenter}>
            {profile && renderAvatar(profile.avatarSeed, 72)}
          </div>
          <h2 style={styles.stepTitle}>
            {profile ? `Welcome back, ${profile.displayName}` : "Enter PIN"}
          </h2>
          <p style={styles.stepDesc}>Enter your 6-digit PIN to unlock</p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.pinContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.pinDot,
                ...(unlockPin.length > i ? styles.pinDotFilled : {}),
              }}
            />
          ))}
        </div>
        <div style={styles.numpadWrapper}>
          <Numpad value={unlockPin} onChange={setUnlockPin} maxLength={6} />
        </div>
        <button
          style={styles.btnPrimary}
          onClick={handlePinUnlock}
          disabled={unlockPin.length < 6 || loading}
        >
          {loading ? "Verifying..." : "Unlock"}
        </button>
        {profile?.biometricEnabled && biometricSupported && (
          <button style={styles.btnLink} onClick={() => setScreen("biometric-prompt")}>
            Use Biometrics
          </button>
        )}
        <button style={styles.btnLink} onClick={handleLogout}>
          Sign in with different account
        </button>
      </div>
    );
  }

  if (screen === "login-phone") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("welcome")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🔑</div>
          <h2 style={styles.stepTitle}>Sign In</h2>
          <p style={styles.stepDesc}>Enter your registered phone number</p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Phone Number</label>
          <input
            style={styles.input}
            type="tel"
            placeholder="+1 234 567 8900"
            value={loginPhone}
            onChange={(e) => setLoginPhone(e.target.value)}
          />
        </div>
        <button style={styles.btnPrimary} onClick={handleLoginSendOtp}>
          Send OTP
        </button>
      </div>
    );
  }

  if (screen === "login-otp") {
    return (
      <div style={styles.screen}>
        <button style={styles.backBtn} onClick={() => setScreen("login-phone")}>← Back</button>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🔢</div>
          <h2 style={styles.stepTitle}>Verify OTP</h2>
          <p style={styles.stepDesc}>Enter the code sent to {loginPhone}</p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        {success && <div style={styles.successBanner}>{success}</div>}
        <div style={styles.otpContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              style={styles.otpBox}
              type="text"
              maxLength={1}
              value={loginOtp[i] || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/, "");
                const arr = loginOtp.split("");
                arr[i] = val;
                setLoginOtp(arr.join(""));
                if (val && i < 5) {
                  const next = document.getElementById(`lotp-${i + 1}`);
                  next?.focus();
                }
              }}
              id={`lotp-${i}`}
            />
          ))}
        </div>
        <p style={styles.devHint}>💡 Check browser console for OTP</p>
        <button style={styles.btnPrimary} onClick={handleLoginVerifyOtp}>
          Verify
        </button>
      </div>
    );
  }

  if (screen === "login-pin") {
    return (
      <div style={styles.screen}>
        <div style={styles.stepHeader}>
          <div style={styles.stepIcon}>🔐</div>
          <h2 style={styles.stepTitle}>Enter PIN</h2>
          <p style={styles.stepDesc}>Enter your account PIN to sign in</p>
        </div>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <div style={styles.pinContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.pinDot,
                ...(unlockPin.length > i ? styles.pinDotFilled : {}),
              }}
            />
          ))}
        </div>
        <div style={styles.numpadWrapper}>
          <Numpad value={unlockPin} onChange={setUnlockPin} maxLength={6} />
        </div>
        <button
          style={styles.btnPrimary}
          onClick={handleLoginPin}
          disabled={unlockPin.length < 6 || loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    );
  }

  if (screen === "profile" && profile) {
    return (
      <div style={styles.screen}>
        {success && <div style={styles.successBanner}>{success}</div>}
        <div style={styles.profileHeader}>
          <div style={styles.profileAvatarWrap}>
            {renderAvatar(profile.avatarSeed, 96)}
          </div>
          <h2 style={styles.profileName}>{profile.displayName}</h2>
          <div style={styles.profileId}>
            <span style={styles.profileIdLabel}>Confi ID:</span>
            <span style={styles.profileIdValue}>{profile.userId}</span>
          </div>
          <div style={styles.verifiedBadge}>
            <span>✅ Verified Account</span>
          </div>
        </div>

        <div style={styles.profileSection}>
          <div style={styles.sectionTitle}>Personal Information</div>
          <div style={styles.profileCard}>
            <ProfileRow icon="⚖️" label="Legal Name" value={profile.legalName} />
            <ProfileRow icon="📱" label="Phone" value={profile.phone} />
            <ProfileRow icon="📧" label="Email" value={profile.email} />
            <ProfileRow icon="🌍" label="Country" value={`${profile.country} (${profile.countryCode})`} />
            <ProfileRow icon="🗓️" label="Member Since" value={new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
          </div>
        </div>

        <div style={styles.profileSection}>
          <div style={styles.sectionTitle}>Security</div>
          <div style={styles.profileCard}>
            <ProfileRow icon="🔐" label="PIN" value="6-digit PIN set" />
            <ProfileRow
              icon="👁️"
              label="Biometric Unlock"
              value={profile.biometricEnabled ? "Enabled" : "Disabled"}
              valueStyle={{ color: profile.biometricEnabled ? "#43B89C" : "#999" }}
            />
            <ProfileRow icon="🛡️" label="Session" value="Active" valueStyle={{ color: "#43B89C" }} />
          </div>
        </div>

        <div style={styles.profileSection}>
          <div style={styles.sectionTitle}>NDA Status</div>
          <div style={styles.profileCard}>
            <div style={styles.ndaStatusRow}>
              <span style={styles.ndaStatusIcon}>📋</span>
              <div style={styles.ndaStatusText}>
                <div style={styles.ndaStatusTitle}>Identity Verified</div>
                <div style={styles.ndaStatusDesc}>
                  Your legal name and country are captured. You can now activate
                  NDA protection on any conversation.
                </div>
              </div>
              <span style={styles.ndaStatusCheck}>✅</span>
            </div>
          </div>
        </div>

        <div style={styles.profileSection}>
          <div style={styles.sectionTitle}>Legal Jurisdiction</div>
          <div style={styles.jurisdictionCard}>
            <div style={styles.jurisdictionFlag}>🌐</div>
            <div>
              <div style={styles.jurisdictionTitle}>{profile.country}</div>
              <div style={styles.jurisdictionDesc}>
                All NDAs will be governed by the laws of {profile.country} and
                applicable international treaties including TRIPS, WIPO, and
                bilateral trade agreements.
              </div>
            </div>
          </div>
        </div>

        <button style={styles.btnDanger} onClick={handleLogout}>
          Sign Out
        </button>
        <div style={styles.footerNote}>
          Confi Identity v1.0 • NDA Engine Ready
        </div>
      </div>
    );
  }

  return null;
}

// Numpad component
function Numpad({
  value,
  onChange,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
}) {
  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit);
  };
  const del = () => onChange(value.slice(0, -1));

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div style={styles.numpad}>
      {keys.map((k, i) => (
        <button
          key={i}
          style={{
            ...styles.numpadKey,
            ...(k === "" ? styles.numpadKeyEmpty : {}),
            ...(k === "⌫" ? styles.numpadKeyDel : {}),
          }}
          onClick={() => (k === "⌫" ? del() : k !== "" ? press(k) : undefined)}
          disabled={k === ""}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// Profile row
function ProfileRow({
  icon,
  label,
  value,
  valueStyle,
}: {
  icon: string;
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div style={styles.profileRow}>
      <span style={styles.profileRowIcon}>{icon}</span>
      <div style={styles.profileRowContent}>
        <div style={styles.profileRowLabel}>{label}</div>
        <div style={{ ...styles.profileRowValue, ...valueStyle }}>{value}</div>
      </div>
    </div>
  );
}

// ============ STYLES ============
const styles: Record<string, React.CSSProperties> = {
  splash: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #6C63FF 0%, #A29BFE 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  splashLogo: {
    animation: "pulse 2s infinite",
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: 800,
    color: "white",
    letterSpacing: -1,
  },
  splashSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  splashLoader: {
    display: "flex",
    gap: 8,
    marginTop: 32,
  },
  splashDot1: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.5)",
  },
  splashDot2: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.75)",
  },
  splashDot3: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "white",
  },
  screen: {
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    padding: "24px 20px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    boxSizing: "border-box",
    background: "#0F0F1A",
    color: "#F0F0F0",
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "#A29BFE",
    fontSize: 16,
    cursor: "pointer",
    padding: "8px 0",
    textAlign: "left",
    fontFamily: "inherit",
  },
  welcomeHero: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 24,
    paddingBottom: 8,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 800,
    margin: 0,
    textAlign: "center",
    background: "linear-gradient(135deg, #6C63FF, #A29BFE)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  welcomeDesc: {
    textAlign: "center",
    color: "#AAA",
    fontSize: 15,
    lineHeight: 1.6,
    margin: 0,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "#1A1A2E",
    borderRadius: 16,
    padding: 20,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 15,
    color: "#E0E0E0",
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #6C63FF, #A29BFE)",
    color: "white",
    border: "none",
    borderRadius: 14,
    padding: "16px 24px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
    letterSpacing: 0.3,
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    background: "transparent",
    color: "#A29BFE",
    border: "2px solid #A29BFE",
    borderRadius: 14,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
  },
  btnLink: {
    background: "transparent",
    color: "#A29BFE",
    border: "none",
    padding: "8px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "underline",
  },
  btnDanger: {
    background: "transparent",
    color: "#FF6584",
    border: "2px solid #FF6584",
    borderRadius: 14,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
    marginTop: 8,
  },
  bioBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  bioIcon: {
    fontSize: 22,
  },
  stepHeader: {
    textAlign: "center" as const,
    paddingTop: 16,
  },
  stepIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: "8px 0",
    color: "#F0F0F0",
  },
  stepDesc: {
    color: "#AAA",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
    padding: "0 8px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#AAA",
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  input: {
    background: "#1A1A2E",
    border: "2px solid #2A2A4A",
    borderRadius: 12,
    padding: "14px 16px",
    fontSize: 16,
    color: "#F0F0F0",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    margin: 0,
  },
  ndaNotice: {
    background: "#1A1A2E",
    borderLeft: "3px solid #6C63FF",
    borderRadius: 8,
    padding: 14,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    color: "#AAA",
    lineHeight: 1.5,
  },
  ndaIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  legalWarning: {
    background: "#1A0A20",
    border: "1px solid #4A1A4A",
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    color: "#CC99CC",
    lineHeight: 1.6,
  },
  legalWarningTitle: {
    fontWeight: 700,
    marginBottom: 8,
    color: "#E0A0E0",
  },
  countryList: {
    flex: 1,
    overflowY: "auto" as const,
    maxHeight: "50vh",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  countryItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#1A1A2E",
    border: "2px solid transparent",
    borderRadius: 10,
    padding: "12px 16px",
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
    fontFamily: "inherit",
  },
  countryItemSelected: {
    borderColor: "#6C63FF",
    background: "#1F1A40",
  },
  countryFlag: {
    fontSize: 22,
    width: 30,
    textAlign: "center" as const,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: "#F0F0F0",
  },
  countryCode: {
    fontSize: 12,
    color: "#666",
  },
  idDisplay: {
    background: "#1A1A2E",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    color: "#A29BFE",
    fontFamily: "monospace",
  },
  avatarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  avatarOption: {
    background: "#1A1A2E",
    border: "2px solid transparent",
    borderRadius: 50,
    padding: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    margin: "0 auto",
  },
  avatarOptionSelected: {
    borderColor: "#6C63FF",
    background: "#1F1A40",
  },
  selectedPreview: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  selectedPreviewName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#F0F0F0",
  },
  pinContainer: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    padding: "24px 0",
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "2px solid #A29BFE",
    background: "transparent",
    transition: "background 0.15s",
  },
  pinDotFilled: {
    background: "#6C63FF",
    borderColor: "#6C63FF",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  numpadWrapper: {
    marginTop: 8,
  },
  numpad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    maxWidth: 280,
    margin: "0 auto",
  },
  numpadKey: {
    background: "#1A1A2E",
    border: "1px solid #2A2A4A",
    borderRadius: 50,
    width: 72,
    height: 72,
    fontSize: 24,
    fontWeight: 600,
    color: "#F0F0F0",
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
  },
  numpadKeyEmpty: {
    background: "transparent",
    border: "none",
    cursor: "default",
  },
  numpadKeyDel: {
    background: "transparent",
    border: "1px solid #2A2A4A",
    fontSize: 20,
    color: "#A29BFE",
  },
  otpContainer: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    padding: "16px 0",
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: 10,
    border: "2px solid #2A2A4A",
    background: "#1A1A2E",
    color: "#F0F0F0",
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
    fontFamily: "monospace",
  },
  devHint: {
    textAlign: "center" as const,
    fontSize: 12,
    color: "#666",
    margin: 0,
  },
  errorBanner: {
    background: "#2A0A15",
    border: "1px solid #FF6584",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    color: "#FF6584",
  },
  successBanner: {
    background: "#0A2A1A",
    border: "1px solid #43B89C",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    color: "#43B89C",
  },
  warningBanner: {
    background: "#2A2010",
    border: "1px solid #FF9F43",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    color: "#FF9F43",
  },
  profileHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 24,
    paddingBottom: 8,
  },
  profileAvatarWrap: {
    padding: 4,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6C63FF, #A29BFE)",
  },
  profileName: {
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
    color: "#F0F0F0",
  },
  profileId: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#1A1A2E",
    borderRadius: 8,
    padding: "6px 12px",
  },
  profileIdLabel: {
    fontSize: 12,
    color: "#666",
  },
  profileIdValue: {
    fontSize: 12,
    color: "#A29BFE",
    fontFamily: "monospace",
  },
  verifiedBadge: {
    background: "linear-gradient(135deg, #0A2A1A, #0F3A25)",
    border: "1px solid #43B89C",
    borderRadius: 20,
    padding: "4px 14px",
    fontSize: 13,
    color: "#43B89C",
    fontWeight: 600,
  },
  profileSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#666",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  profileCard: {
    background: "#1A1A2E",
    borderRadius: 16,
    overflow: "hidden",
  },
  profileRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    borderBottom: "1px solid #2A2A4A",
  },
  profileRowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  profileRowContent: {
    flex: 1,
  },
  profileRowLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  profileRowValue: {
    fontSize: 15,
    color: "#F0F0F0",
    fontWeight: 500,
  },
  ndaStatusRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "16px 18px",
  },
  ndaStatusIcon: {
    fontSize: 24,
    flexShrink: 0,
  },
  ndaStatusText: {
    flex: 1,
  },
  ndaStatusTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#F0F0F0",
    marginBottom: 4,
  },
  ndaStatusDesc: {
    fontSize: 13,
    color: "#AAA",
    lineHeight: 1.5,
  },
  ndaStatusCheck: {
    fontSize: 20,
    flexShrink: 0,
  },
  jurisdictionCard: {
    background: "#1A1A2E",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  jurisdictionFlag: {
    fontSize: 32,
    flexShrink: 0,
  },
  jurisdictionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#F0F0F0",
    marginBottom: 6,
  },
  jurisdictionDesc: {
    fontSize: 13,
    color: "#AAA",
    lineHeight: 1.5,
  },
  avatarCenter: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 8,
  },
  footerNote: {
    textAlign: "center",
    fontSize: 12,
    color: "#444",
    paddingBottom: 8,
  },
};