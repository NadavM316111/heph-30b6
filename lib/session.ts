/**
 * Confi — Client-side session and identity key storage
 *
 * JWT tokens and public-key metadata are stored in localStorage.
 * Private keys are ALSO stored in localStorage under a separate namespace,
 * keyed by email address. In a production app these would ideally be
 * stored in IndexedDB with non-extractable CryptoKey objects, but
 * localStorage is used here for maximum compatibility.
 */

const SESSION_KEY = "confi_session_v1";
const IDENTITY_KEY_PREFIX = "confi_identity_v1_";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionData {
  email: string;
  displayName: string;
  avatar: string;        // emoji char or "data:image/..." base64
  phone: string;
  publicKey: string;     // Base64 SPKI — safe to share
  token: string;         // JWT from server
}

export interface IdentityKeyData {
  privateKey: string;    // Base64 PKCS8 — NEVER transmit
  publicKey: string;     // Base64 SPKI  — mirror of server copy
  createdAt: string;     // ISO timestamp
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    console.warn("Confi: Could not persist session to localStorage");
  }
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionData;
    // Basic shape validation
    if (!parsed.email || !parsed.token) return null;
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

export function updateSessionField<K extends keyof SessionData>(
  field: K,
  value: SessionData[K]
): void {
  const s = loadSession();
  if (!s) return;
  s[field] = value;
  saveSession(s);
}

// ─── Identity key helpers ─────────────────────────────────────────────────────

/**
 * Persist the private key for the given email.
 * Only called ONCE at registration time on the originating device.
 */
export function saveIdentityKey(email: string, privateKeyB64: string, publicKeyB64?: string): void {
  try {
    const data: IdentityKeyData = {
      privateKey: privateKeyB64,
      publicKey: publicKeyB64 ?? "",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(IDENTITY_KEY_PREFIX + email, JSON.stringify(data));
  } catch {
    console.warn("Confi: Could not persist identity key to localStorage");
  }
}

/**
 * Retrieve the stored identity key pair for the given email.
 * Returns null if the user has never registered on this device.
 */
export function loadIdentityKey(email: string): IdentityKeyData | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY_PREFIX + email);
    if (!raw) return null;
    return JSON.parse(raw) as IdentityKeyData;
  } catch {
    return null;
  }
}

/**
 * Delete the stored identity key.
 * Called if the user explicitly revokes their identity or deletes their account.
 */
export function clearIdentityKey(email: string): void {
  try {
    localStorage.removeItem(IDENTITY_KEY_PREFIX + email);
  } catch {
    // ignore
  }
}

/**
 * List all emails that have an identity key stored on this device.
 */
export function listStoredIdentities(): string[] {
  const emails: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(IDENTITY_KEY_PREFIX)) {
        emails.push(key.slice(IDENTITY_KEY_PREFIX.length));
      }
    }
  } catch {
    // ignore
  }
  return emails;
}