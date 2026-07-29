export interface Session {
  email: string;
  phone: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
  displayName?: string;
  avatar?: string;
}

const SESSION_KEY = "confi_session_v1";
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function encodeSession(session: Session): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(session)));
  } catch {
    return JSON.stringify(session);
  }
}

function decodeSession(raw: string): Session | null {
  try {
    return JSON.parse(decodeURIComponent(atob(raw))) as Session;
  } catch {
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, encodeSession(session));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = decodeSession(raw);
    if (!session) return null;

    // Check expiry
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    // Refresh logic: if within threshold of expiry, extend
    if (session.expiresAt - Date.now() < REFRESH_THRESHOLD_MS) {
      const refreshed: Session = {
        ...session,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        token: refreshToken(session.token),
      };
      saveSession(refreshed);
      return refreshed;
    }

    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function refreshToken(oldToken: string): string {
  const ts = Date.now().toString(36);
  const tail = Math.random().toString(36).slice(2, 10);
  return `${oldToken.split(".")[0] || oldToken}.refreshed.${ts}.${tail}`;
}