/**
 * Confi Identity Utilities
 * Cryptographic identity helpers for the Confi messaging platform.
 * These run entirely client-side using the Web Crypto API — no keys required.
 */

export interface IdentityFingerprint {
  fingerprint: string;
  algorithm: "SHA-256";
  components: string[];
  generatedAt: string;
}

export interface NDARecord {
  ndaFingerprint: string;
  identityFingerprint: string;
  conversationId: string;
  legalName: string;
  acceptedAt: string;
}

/**
 * Generate a SHA-256 fingerprint from a string.
 */
export async function computeFingerprint(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build an identity fingerprint record from verified credentials.
 */
export async function buildIdentityFingerprint(params: {
  email: string;
  phone: string;
  legalName: string;
  passwordHash: string;
  deviceTimestamp: string;
  userAgent: string;
}): Promise<IdentityFingerprint> {
  const components = [
    params.email,
    params.phone,
    params.legalName,
    params.passwordHash,
    params.deviceTimestamp,
    params.userAgent,
  ];
  const raw = components.join("::");
  const fingerprint = await computeFingerprint(raw);
  return {
    fingerprint,
    algorithm: "SHA-256",
    components: components.map((_, i) => `component_${i}`), // Don't expose raw components
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build an NDA fingerprint anchored to an identity.
 */
export async function buildNDAFingerprint(params: {
  identityFingerprint: string;
  conversationId: string;
  acceptedAt: string;
}): Promise<string> {
  const raw = `NDA::${params.identityFingerprint}::${params.conversationId}::${params.acceptedAt}`;
  return computeFingerprint(raw);
}

/**
 * Generate a JWT-like session token (client-side, for UI state management).
 * NOTE: For production, real JWT signing happens server-side.
 */
export function generateSessionToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = btoa(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  // In production, this would be HMAC-SHA256 signed server-side
  const sig = btoa(`sig_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

/**
 * Decode the payload of a session token (no signature verification on client).
 */
export function decodeSessionToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Collect device metadata for identity anchoring.
 */
export function collectDeviceMetadata(): Record<string, string | number> {
  if (typeof window === "undefined") {
    return { environment: "server" };
  }
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    timestamp: new Date().toISOString(),
    cookiesEnabled: navigator.cookieEnabled ? 1 : 0,
    onLine: navigator.onLine ? 1 : 0,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
  };
}

/**
 * Validate password strength.
 * Returns an array of failed requirements (empty = all pass).
 */
export function validatePassword(password: string): string[] {
  const failures: string[] = [];
  if (password.length < 10) failures.push("At least 10 characters");
  if (!/[A-Z]/.test(password)) failures.push("At least one uppercase letter");
  if (!/[0-9]/.test(password)) failures.push("At least one number");
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("At least one special character");
  return failures;
}

/**
 * Validate phone number (international format).
 */
export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Validate legal name (letters, hyphens, apostrophes only).
 */
export function validateLegalName(name: string): boolean {
  return /^[A-Za-z\s\-']+$/.test(name.trim()) && name.trim().length >= 1;
}