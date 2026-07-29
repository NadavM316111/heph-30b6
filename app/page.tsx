"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ─── types ─────────────────────────────────────────────────── */
interface UserProfile {
  user_id: string;
  phone: string;
  email?: string;
  display_name: string;
  legal_name: string;
  avatar_seed: string;
  kyc_confirmed: boolean;
  verified: boolean;
  created_at: string;
}

type AuthStep =
  | "idle"
  | "phone"
  | "otp"
  | "password"
  | "profile"
  | "kyc"
  | "done";

type AuthMode = "register" | "login";

/* ─── tiny hash (no bcrypt in browser — we SHA-256 the password) */
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function avatarInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "#6c63ff","#8b5cf6","#ec4899","#10b981","#f59e0b","#3b82f6","#ef4444","#14b8a6",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ─── NDA text ───────────────────────────────────────────────── */
const KYC_TEXT = `CONFI MESSAGING — IDENTITY VERIFICATION & CONFIDENTIALITY ACKNOWLEDGMENT

By submitting your legal name below you confirm that:

1. LEGAL IDENTITY. The full legal name you provide is accurate and corresponds to a government-issued identity document. This identity becomes your binding legal persona within the Confi platform.

2. NDA BINDING. Any conversation you initiate or participate in with Confidential Mode enabled is automatically covered by an international Non-Disclosure Agreement governed by the United Nations Convention on Contracts for the International Sale of Goods (CISG) and applicable domestic confidentiality law. All parties are bound by their verified legal identities.

3. JURISDICTION. You consent to jurisdiction in the courts of your country of residence for any disputes arising from confidential communications made through this platform.

4. ACCURACY. You understand that providing a false legal name is a violation of these Terms and may constitute fraud under applicable law.

5. RETENTION. Confi stores your legal name in encrypted form solely for the purpose of enforcing the above obligations. It is never shared with third parties except as required by valid legal process.

By clicking "Confirm & Activate Account" you agree to all of the above.`;

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ConfiApp() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("register");

  // form state
  const [step, setStep] = useState<AuthStep>("idle");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [kycRead, setKycRead] = useState(false);
  const [avatarSeed] = useState(generateAvatarSeed);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // profile edit
  const [showProfile, setShowProfile] = useState(false);
  const [showNDA, setShowNDA] = useState(false);

  /* ── track page ── */
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  /* ── restore session ── */
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("confi_token");
      if (token) {
        try {
          const res = await fetch("/api/confi/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (data.ok) {
            setUser(data.user);
            setSessionToken(token);
          } else {
            localStorage.removeItem("confi_token");
          }
        } catch {
          localStorage.removeItem("confi_token");
        }
      }
      setBooting(false);
    })();
  }, []);

  /* ── OTP countdown ── */
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setInterval(() => {
        setOtpTimer((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpTimer]);

  const clearError = () => setError("");

  /* ── send OTP ── */
  const sendOtp = useCallback(async (ph: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/confi/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ph }),
      });
      const data = await res.json();
      if (data.ok) {
        setDemoOtp(data.demoCode || "");
        setStep("otp");
        setOtpTimer(60);
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── verify OTP ── */
  const verifyOtp = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/confi/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("password");
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [phone, otp]);

  /* ── register ── */
  const doRegister = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pwHash = await hashPassword(password);
      const res = await fetch("/api/confi/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          email: email || undefined,
          displayName,
          legalName,
          passwordHash: pwHash,
          avatarSeed,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("confi_token", data.token);
        setSessionToken(data.token);
        setUser(data.user);
        setStep("done");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [phone, email, displayName, legalName, password, avatarSeed]);

  /* ── login ── */
  const doLogin = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pwHash = await hashPassword(password);
      const res = await fetch("/api/confi/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, passwordHash: pwHash }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("confi_token", data.token);
        setSessionToken(data.token);
        setUser(data.user);
        setStep("done");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [phone, password]);

  /* ── logout ── */
  const doLogout = useCallback(async () => {
    try {
      await fetch("/api/confi/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken }),
      });
    } catch { /* ignore */ }
    localStorage.removeItem("confi_token");
    setUser(null);
    setSessionToken("");
    setStep("idle");
    setPhone("");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setLegalName("");
    setEmail("");
    setError("");
    setShowProfile(false);
  }, [sessionToken]);

  /* ════════════════════════════════════════════════════
     RENDER — loading
  ════════════════════════════════════════════════════ */
  if (booting) {
    return (
      <div style={S.center}>
        <div style={S.logo}>
          <LockIcon size={32} />
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Loading Confi…</p>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════
     RENDER — authenticated dashboard
  ════════════════════════════════════════════════════ */
  if (user) {
    return (
      <div style={S.appShell}>
        {/* Header */}
        <header style={S.header}>
          <div style={S.headerLeft}>
            <LockIcon size={20} color="var(--accent)" />
            <span style={S.headerTitle}>Confi</span>
            <span style={S.verifiedBadge}>
              <CheckIcon size={10} /> VERIFIED
            </span>
          </div>
          <div style={S.headerRight}>
            <button style={S.iconBtn} onClick={() => setShowNDA(true)} title="View NDA details">
              <ShieldIcon size={18} />
            </button>
            <button
              style={S.avatarBtn}
              onClick={() => setShowProfile(!showProfile)}
            >
              <Avatar seed={user.avatar_seed} name={user.display_name} size={36} />
            </button>
          </div>
        </header>

        {/* Profile panel */}
        {showProfile && (
          <div style={S.profilePanel} className="animate-fade">
            <div style={S.profileHeader}>
              <Avatar seed={user.avatar_seed} name={user.display_name} size={64} />
              <div>
                <div style={S.profileName}>{user.display_name}</div>
                <div style={S.profileId}>{user.user_id}</div>
                <div style={S.kycTag}>
                  <ShieldIcon size={11} color="var(--green)" />
                  KYC Verified
                </div>
              </div>
            </div>
            <div style={S.profileInfo}>
              <InfoRow label="Phone" value={user.phone} />
              {user.email && <InfoRow label="Email" value={user.email} />}
              <InfoRow label="Legal Name" value={user.legal_name} sensitive />
              <InfoRow label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
            </div>
            <button style={S.logoutBtn} onClick={doLogout}>
              Sign Out
            </button>
          </div>
        )}

        {/* NDA modal */}
        {showNDA && (
          <Modal onClose={() => setShowNDA(false)}>
            <div style={S.ndaModal}>
              <div style={S.ndaHeader}>
                <ShieldIcon size={24} color="var(--accent)" />
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  Your Confidentiality Agreement
                </h2>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
                This is the binding agreement attached to your verified identity.
              </p>
              <div style={S.ndaScroll}>
                <pre style={S.ndaPre}>{KYC_TEXT}</pre>
              </div>
              <div style={S.ndaFooter}>
                <span style={S.ndaSignature}>
                  Signed as: <strong>{user.legal_name}</strong>
                </span>
                <button style={S.accentBtn} onClick={() => setShowNDA(false)}>
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Main dashboard body */}
        <main style={S.dashMain}>
          <div style={S.dashCard} className="animate-fade">
            <div style={S.dashWelcome}>
              <Avatar seed={user.avatar_seed} name={user.display_name} size={56} />
              <div>
                <h1 style={S.dashTitle}>Welcome back, {user.display_name.split(" ")[0]}!</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
                  Your identity is verified and your account is ready.
                </p>
              </div>
            </div>

            <div style={S.statsRow}>
              <StatCard icon={<ShieldIcon size={20} color="var(--green)" />} label="KYC Status" value="Verified" color="var(--green)" />
              <StatCard icon={<LockIcon size={20} color="var(--accent)" />} label="Confidential Mode" value="Ready" color="var(--accent)" />
              <StatCard icon={<IdIcon size={20} color="var(--yellow)" />} label="User ID" value={user.user_id} color="var(--yellow)" />
            </div>

            <div style={S.ndaBanner}>
              <ShieldIcon size={16} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>International NDA Active</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                  Any Confidential Mode conversation you start is automatically covered
                  under your verified legal identity: <strong>{user.legal_name}</strong>
                </div>
              </div>
              <button style={S.linkBtn} onClick={() => setShowNDA(true)}>
                View Agreement →
              </button>
            </div>

            <div style={S.featureGrid}>
              <FeatureCard
                icon={<ChatIcon size={22} />}
                title="Secure Messaging"
                description="End-to-end encrypted conversations with NDA protection when Confidential Mode is on."
              />
              <FeatureCard
                icon={<ShieldIcon size={22} />}
                title="NDA-Protected Chats"
                description="Toggle Confidential Mode to bind any conversation under international confidentiality law."
              />
              <FeatureCard
                icon={<IdIcon size={22} />}
                title="Verified Identity"
                description="Your legal name is cryptographically tied to every confidential message you send."
              />
              <FeatureCard
                icon={<LockIcon size={22} />}
                title="KYC Compliance"
                description="Your identity has been confirmed and is stored securely for legal enforcement."
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════
     RENDER — auth flow
  ════════════════════════════════════════════════════ */
  return (
    <div style={S.authShell}>
      <div style={S.authCard} className="animate-fade">
        {/* Logo */}
        <div style={S.authLogo}>
          <div style={S.logoCircle}>
            <LockIcon size={28} color="#fff" />
          </div>
          <h1 style={S.authTitle}>Confi</h1>
          <p style={S.authSubtitle}>Secure messaging with legal identity protection</p>
        </div>

        {/* Mode toggle (only on idle/phone) */}
        {(step === "idle" || step === "phone") && (
          <div style={S.modeToggle}>
            <button
              style={{ ...S.modeBtn, ...(authMode === "register" ? S.modeBtnActive : {}) }}
              onClick={() => { setAuthMode("register"); setStep("phone"); clearError(); }}
            >
              Create Account
            </button>
            <button
              style={{ ...S.modeBtn, ...(authMode === "login" ? S.modeBtnActive : {}) }}
              onClick={() => { setAuthMode("login"); setStep("phone"); clearError(); }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Progress dots */}
        {step !== "idle" && step !== "done" && (
          <StepProgress
            steps={authMode === "register"
              ? ["Phone", "OTP", "Password", "Profile", "KYC"]
              : ["Phone", "OTP", "Password"]}
            current={
              authMode === "register"
                ? ["phone", "otp", "password", "profile", "kyc"].indexOf(step)
                : ["phone", "otp", "password"].indexOf(step)
            }
          />
        )}

        {error && (
          <div style={S.errorBox} className="animate-fade">
            <AlertIcon size={15} /> {error}
          </div>
        )}

        {/* ── STEP: idle ── */}
        {step === "idle" && (
          <div style={S.stepBody}>
            <p style={{ color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
              Confi combines end-to-end encrypted messaging with legally binding
              confidentiality agreements, verified by your real identity.
            </p>
            <button
              style={S.accentBtn}
              onClick={() => { setAuthMode("register"); setStep("phone"); }}
            >
              Get Started
            </button>
            <button
              style={S.ghostBtn}
              onClick={() => { setAuthMode("login"); setStep("phone"); }}
            >
              Already have an account? Sign in
            </button>
          </div>
        )}

        {/* ── STEP: phone ── */}
        {step === "phone" && (
          <div style={S.stepBody}>
            <label style={S.label}>
              {authMode === "register" ? "📱 Your Phone Number" : "📱 Phone Number"}
            </label>
            <input
              style={S.input}
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phone && sendOtp(phone)}
            />
            <p style={S.hint}>Include country code (e.g. +1, +44, +91)</p>

            {authMode === "register" && (
              <>
                <label style={{ ...S.label, marginTop: 12 }}>
                  📧 Email Backup <span style={S.optional}>(optional)</span>
                </label>
                <input
                  style={S.input}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            )}

            <button
              style={{ ...S.accentBtn, marginTop: 20, opacity: loading || !phone ? 0.6 : 1 }}
              disabled={loading || !phone}
              onClick={() => sendOtp(phone)}
            >
              {loading ? <span className="spinner" /> : "Send Verification Code"}
            </button>
          </div>
        )}

        {/* ── STEP: otp ── */}
        {step === "otp" && (
          <div style={S.stepBody}>
            <label style={S.label}>🔑 Verification Code</label>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
              Sent to <strong>{phone}</strong>
            </p>

            {/* Demo OTP display (remove when real SMS is configured) */}
            {demoOtp && (
              <div style={S.demoOtpBox}>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  DEMO — no SMS configured
                </span>
                <span style={S.demoOtpCode}>{demoOtp}</span>
              </div>
            )}

            <input
              style={{ ...S.input, letterSpacing: 8, fontSize: 22, textAlign: "center" }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
            />

            <button
              style={{ ...S.accentBtn, marginTop: 16, opacity: loading || otp.length < 6 ? 0.6 : 1 }}
              disabled={loading || otp.length < 6}
              onClick={verifyOtp}
            >
              {loading ? <span className="spinner" /> : "Verify Code"}
            </button>

            <button
              style={{ ...S.ghostBtn, fontSize: 13, marginTop: 8 }}
              disabled={otpTimer > 0}
              onClick={() => sendOtp(phone)}
            >
              {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend Code"}
            </button>
          </div>
        )}

        {/* ── STEP: password ── */}
        {step === "password" && (
          <div style={S.stepBody}>
            <label style={S.label}>
              {authMode === "register" ? "🔒 Create Password" : "🔒 Your Password"}
            </label>
            <input
              style={S.input}
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {authMode === "register" && (
              <>
                <label style={{ ...S.label, marginTop: 12 }}>🔒 Confirm Password</label>
                <input
                  style={S.input}
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </>
            )}

            <button
              style={{
                ...S.accentBtn,
                marginTop: 20,
                opacity: loading || password.length < 8 ? 0.6 : 1,
              }}
              disabled={loading || password.length < 8}
              onClick={() => {
                if (authMode === "register") {
                  if (password !== confirmPassword) {
                    setError("Passwords do not match");
                    return;
                  }
                  setStep("profile");
                } else {
                  doLogin();
                }
              }}
            >
              {loading ? <span className="spinner" /> : authMode === "register" ? "Continue" : "Sign In"}
            </button>
          </div>
        )}

        {/* ── STEP: profile ── */}
        {step === "profile" && (
          <div style={S.stepBody}>
            <div style={S.avatarPreview}>
              <Avatar seed={avatarSeed} name={displayName || "?"} size={64} />
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
                Your avatar
              </p>
            </div>

            <label style={S.label}>👤 Display Name</label>
            <input
              style={S.input}
              type="text"
              placeholder="How others see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p style={S.hint}>This can be a nickname — it&apos;s shown in chats.</p>

            <button
              style={{
                ...S.accentBtn,
                marginTop: 16,
                opacity: !displayName.trim() ? 0.6 : 1,
              }}
              disabled={!displayName.trim()}
              onClick={() => setStep("kyc")}
            >
              Continue to Identity Verification
            </button>
          </div>
        )}

        {/* ── STEP: kyc ── */}
        {step === "kyc" && (
          <div style={S.stepBody}>
            <div style={S.kycHeader}>
              <ShieldIcon size={28} color="var(--accent)" />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Identity Verification (KYC)</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>
                Your legal name creates a binding identity for NDA-protected conversations.
              </p>
            </div>

            <div style={S.ndaScroll}>
              <pre style={S.ndaPre}>{KYC_TEXT}</pre>
            </div>

            <label style={{ ...S.label, marginTop: 16 }}>⚖️ Your Full Legal Name</label>
            <input
              style={S.input}
              type="text"
              placeholder="As it appears on your ID"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <p style={S.hint}>This will be attached to any NDA-covered conversation.</p>

            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={kycRead}
                onChange={(e) => setKycRead(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>
                I have read and agree to the confidentiality terms above. I confirm
                my legal name is accurate.
              </span>
            </label>

            <button
              style={{
                ...S.accentBtn,
                marginTop: 16,
                opacity: loading || !legalName.trim() || !kycRead ? 0.6 : 1,
              }}
              disabled={loading || !legalName.trim() || !kycRead}
              onClick={doRegister}
            >
              {loading ? <span className="spinner" /> : "Confirm & Activate Account"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div style={S.stepBody}>
            <div style={{ textAlign: "center" }}>
              <div style={S.successCircle}>
                <CheckIcon size={32} color="#fff" />
              </div>
              <h2 style={{ marginTop: 16, fontWeight: 700 }}>You&apos;re all set!</h2>
              <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                Redirecting to your dashboard…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

function Avatar({ seed, name, size }: { seed: string; name: string; size: number }) {
  const initials = avatarInitials(name);
  const bg = avatarColor(seed);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
        boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${bg}44`,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: i <= current ? 28 : 8,
              height: 6,
              borderRadius: 4,
              background: i < current
                ? "var(--green)"
                : i === current
                ? "var(--accent)"
                : "var(--border2)",
              transition: "all 0.3s ease",
            }}
          />
          {i === current && (
            <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>{s}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={S.statCard}>
      {icon}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={S.featureCard}>
      <div style={S.featureIcon}>{icon}</div>
      <div style={S.featureTitle}>{title}</div>
      <div style={S.featureDesc}>{description}</div>
    </div>
  );
}

function InfoRow({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  const [show, setShow] = useState(!sensitive);
  return (
    <div style={S.infoRow}>
      <span style={S.infoLabel}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={S.infoValue}>{show ? value : "••••••••"}</span>
        {sensitive && (
          <button style={S.tinyBtn} onClick={() => setShow(!show)}>
            {show ? "hide" : "show"}
          </button>
        )}
      </span>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalContent} onClick={(e) => e.stopPropagation()} className="animate-fade">
        {children}
      </div>
    </div>
  );
}

/* ── Icons (inline SVG) ── */
function LockIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ size = 16, color = "var(--red)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IdIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <circle cx="8" cy="10" r="2" />
      <line x1="11" y1="10" x2="16" y2="10" />
    </svg>
  );
}

function ChatIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const S: Record<string, React.CSSProperties> = {
  /* ── Layout ── */
  center: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "var(--surface2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 32px var(--accent-glow)",
  },

  /* ── Auth shell ── */
  authShell: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  },
  authCard: {
    width: "100%",
    maxWidth: 420,
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border2)",
    padding: "32px 28px",
    boxShadow: "var(--shadow-lg)",
  },
  authLogo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 32px var(--accent-glow)",
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 800,
    background: "linear-gradient(135deg, var(--accent), #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: -0.5,
  },
  authSubtitle: {
    color: "var(--text-muted)",
    fontSize: 13,
    textAlign: "center",
  },
  modeToggle: {
    display: "flex",
    background: "var(--surface2)",
    borderRadius: "var(--radius-sm)",
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 6,
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.2s",
  },
  modeBtnActive: {
    background: "var(--surface3)",
    color: "var(--text)",
    boxShadow: "var(--shadow)",
  },

  /* ── Form ── */
  stepBody: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 2,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: "var(--surface2)",
    border: "1.5px solid var(--border2)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    fontSize: 15,
    transition: "border-color 0.2s",
  },
  hint: {
    fontSize: 11,
    color: "var(--text-dim)",
    marginTop: -4,
  },
  optional: {
    fontSize: 11,
    color: "var(--text-dim)",
    fontWeight: 400,
  },
  checkLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
    cursor: "pointer",
  },
  accentBtn: {
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    color: "#fff",
    borderRadius: "var(--radius-sm)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.2,
    boxShadow: "0 4px 16px var(--accent-glow)",
    transition: "opacity 0.2s, transform 0.1s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ghostBtn: {
    width: "100%",
    padding: "11px",
    background: "transparent",
    border: "1px solid var(--border2)",
    color: "var(--text-muted)",
    borderRadius: "var(--radius-sm)",
    fontSize: 14,
    fontWeight: 500,
    transition: "border-color 0.2s, color 0.2s",
  },
  errorBox: {
    padding: "10px 14px",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "var(--radius-sm)",
    color: "var(--red)",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  demoOtpBox: {
    padding: "12px 16px",
    background: "rgba(245,158,11,0.1)",
    border: "1px dashed rgba(245,158,11,0.4)",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  demoOtpCode: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 10,
    color: "var(--yellow)",
    fontVariantNumeric: "tabular-nums",
  },
  avatarPreview: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 8,
  },
  kycHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    textAlign: "center",
    padding: "12px 0",
  },
  ndaScroll: {
    maxHeight: 200,
    overflowY: "auto",
    background: "var(--surface2)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border2)",
    padding: "12px 14px",
  },
  ndaPre: {
    fontSize: 11,
    lineHeight: 1.7,
    color: "var(--text-muted)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "inherit",
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--green), #059669)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    boxShadow: "0 0 32px var(--green-glow)",
    animation: "pulse-ring 2s infinite",
  },

  /* ── App shell ── */
  appShell: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    height: 60,
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontWeight: 800,
    fontSize: 20,
    background: "linear-gradient(135deg, var(--accent), #a78bfa)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  verifiedBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: "var(--green)",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.3)",
    borderRadius: 20,
    padding: "2px 7px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--surface2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  },
  avatarBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
  },

  /* ── Profile panel ── */
  profilePanel: {
    position: "absolute",
    top: 68,
    right: 16,
    width: 300,
    background: "var(--surface)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    padding: 20,
    zIndex: 200,
    boxShadow: "var(--shadow-lg)",
  },
  profileHeader: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid var(--border)",
  },
  profileName: {
    fontWeight: 700,
    fontSize: 16,
  },
  profileId: {
    fontSize: 12,
    color: "var(--text-dim)",
    fontFamily: "monospace",
    marginTop: 2,
  },
  kycTag: {
    fontSize: 11,
    color: "var(--green)",
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    fontWeight: 600,
  },
  profileInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 16,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    borderBottom: "1px solid var(--border)",
  },
  infoLabel: {
    fontSize: 12,
    color: "var(--text-dim)",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: 500,
  },
  tinyBtn: {
    fontSize: 10,
    color: "var(--accent)",
    background: "transparent",
    border: "1px solid var(--border2)",
    borderRadius: 4,
    padding: "1px 6px",
    cursor: "pointer",
  },
  logoutBtn: {
    width: "100%",
    padding: "10px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "var(--red)",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontWeight: 600,
  },

  /* ── Dashboard ── */
  dashMain: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px",
  },
  dashCard: {
    width: "100%",
    maxWidth: 760,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  dashWelcome: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "24px",
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border2)",
  },
  dashTitle: {
    fontSize: 22,
    fontWeight: 800,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  statCard: {
    background: "var(--surface)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  ndaBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "18px 20px",
    background: "rgba(108,99,255,0.08)",
    border: "1px solid rgba(108,99,255,0.25)",
    borderRadius: "var(--radius)",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "var(--accent)",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    padding: 0,
    cursor: "pointer",
    flexShrink: 0,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  featureCard: {
    background: "var(--surface)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--radius)",
    padding: "20px",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "var(--surface2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    color: "var(--accent)",
  },
  featureTitle: {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.6,
  },

  /* ── NDA modal ── */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
    backdropFilter: "blur(4px)",
  },
  modalContent: {
    width: "100%",
    maxWidth: 560,
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border2)",
    boxShadow: "var(--shadow-lg)",
  },
  ndaModal: {
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  ndaHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  ndaFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    borderTop: "1px solid var(--border)",
  },
  ndaSignature: {
    fontSize: 13,
    color: "var(--text-muted)",
  },
};