/**
 * Client-side session utilities for Confi.
 * Real JWT signing happens server-side; this manages the local session state.
 */

export interface ConfiSession {
  email: string;
  displayName: string;
  avatar: string;
  phone: string;
  createdAt: string;
  sessionToken: string;
  refreshToken: string;
  pinHash: string | null;
  biometricEnabled: boolean;
  lastActive: number;
}

const SESSION_KEY = "confi_session";
const REFRESH_KEY = "confi_refresh";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateSecureToken(length = 64): string {
  const arr = new Uint8Array(length / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function saveSession(session: ConfiSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
  } catch (e) {
    console.warn("Failed to save session:", e);
  }
}

export function loadSession(): ConfiSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: ConfiSession = JSON.parse(raw);
    // Check session TTL
    if (Date.now() - session.lastActive > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function refreshSession(session: ConfiSession): ConfiSession {
  const refreshed: ConfiSession = {
    ...session,
    sessionToken: generateSecureToken(),
    lastActive: Date.now(),
  };
  saveSession(refreshed);
  return refreshed;
}

export function touchSession(): void {
  const session = loadSession();
  if (session) {
    session.lastActive = Date.now();
    saveSession(session);
  }
}

/**
 * PIN hashing — deterministic browser-safe hash.
 * Actual bcrypt hashing happens server-side via /api/auth.
 */
export function hashPinClient(pin: string): string {
  const salted = `confi_v1_${pin}_${pin.length}_secure`;
  let h = 0x811c9dc5;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const a = (h >>> 0).toString(36);
  const b = (Math.imul(h, 0xdeadbeef) >>> 0).toString(36);
  return `cpv1_${a}_${b}_${pin.length}`;
}

export function verifyPinClient(pin: string, stored: string): boolean {
  return hashPinClient(pin) === stored;
}

/**
 * Check if Web Authentication API (biometrics) is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}