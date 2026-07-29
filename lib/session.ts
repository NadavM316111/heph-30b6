export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  avatar: string;
  deviceFingerprint: string;
  sessionId: string;
  lastSeen: number;
  consentTimestamp: number;
  consentVersion?: string;
}

const SESSION_KEY = "confi_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function saveSession(user: SessionUser): void {
  const payload = { ...user, lastSeen: Date.now() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // storage quota exceeded or SSR
  }
}

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: SessionUser = JSON.parse(raw);
    if (!parsed.uid || !parsed.email) return null;
    // Check TTL
    if (Date.now() - parsed.lastSeen > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    // Refresh lastSeen
    saveSession(parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function isSessionBoundToDevice(user: SessionUser, currentFingerprint: string): boolean {
  return user.deviceFingerprint === currentFingerprint;
}