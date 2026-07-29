"use client";

import { useEffect, useState } from "react";
import OnboardingScreen from "@/components/OnboardingScreen";
import AuthScreen from "@/components/AuthScreen";
import OTPScreen from "@/components/OTPScreen";
import ProfileSetupScreen from "@/components/ProfileSetupScreen";
import DashboardScreen from "@/components/DashboardScreen";

export type AppScreen =
  | "onboarding"
  | "auth"
  | "otp"
  | "profile-setup"
  | "dashboard";

export type UserSession = {
  email: string;
  token: string;
  fullName?: string;
  country?: string;
  profileComplete?: boolean;
  otpVerified?: boolean;
};

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("onboarding");
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});

    const stored = localStorage.getItem("confi_session");
    if (stored) {
      try {
        const parsed: UserSession = JSON.parse(stored);
        setSession(parsed);
        if (!parsed.otpVerified) {
          setScreen("otp");
        } else if (!parsed.profileComplete) {
          setScreen("profile-setup");
        } else {
          setScreen("dashboard");
        }
      } catch {
        localStorage.removeItem("confi_session");
        setScreen("onboarding");
      }
    } else {
      const onboardingDone = localStorage.getItem("confi_onboarding_done");
      if (onboardingDone) {
        setScreen("auth");
      } else {
        setScreen("onboarding");
      }
    }
    setIsLoading(false);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("confi_onboarding_done", "true");
    setScreen("auth");
  };

  const handleAuthSuccess = (sess: UserSession) => {
    localStorage.setItem("confi_session", JSON.stringify(sess));
    setSession(sess);
    setScreen("otp");
  };

  const handleOTPVerified = () => {
    if (!session) return;
    const updated = { ...session, otpVerified: true };
    localStorage.setItem("confi_session", JSON.stringify(updated));
    setSession(updated);
    if (!session.profileComplete) {
      setScreen("profile-setup");
    } else {
      setScreen("dashboard");
    }
  };

  const handleProfileComplete = (fullName: string, country: string) => {
    if (!session) return;
    const updated = { ...session, fullName, country, profileComplete: true };
    localStorage.setItem("confi_session", JSON.stringify(updated));
    setSession(updated);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("confi_session");
    setSession(null);
    setScreen("auth");
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.logoMark}>🔒</div>
        <p style={styles.loadingText}>Confi</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {screen === "onboarding" && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}
      {screen === "auth" && (
        <AuthScreen onSuccess={handleAuthSuccess} />
      )}
      {screen === "otp" && session && (
        <OTPScreen
          session={session}
          onVerified={handleOTPVerified}
          onBack={() => setScreen("auth")}
        />
      )}
      {screen === "profile-setup" && session && (
        <ProfileSetupScreen
          session={session}
          onComplete={handleProfileComplete}
        />
      )}
      {screen === "dashboard" && session && (
        <DashboardScreen session={session} onLogout={handleLogout} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  logoMark: {
    fontSize: "48px",
    animation: "pulse 1.5s infinite",
  },
  loadingText: {
    color: "#7c6cf0",
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "2px",
    margin: 0,
  },
};