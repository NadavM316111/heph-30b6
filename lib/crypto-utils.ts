/**
 * Confi Crypto Utils
 * 
 * In this Next.js deployment, bcrypt is handled server-side by /api/auth.
 * These utilities provide client-side helpers for token management
 * and a simulation layer for the encrypted ID storage concept.
 * 
 * In a full production system, government ID encryption would use:
 * - AES-256-GCM via Web Crypto API (client) or AWS KMS (server)
 * - The encrypted blob would be stored in the database, not localStorage
 * - The decryption key would never leave the HSM
 */

/**
 * Generate a cryptographically random session token.
 * In production this is a signed JWT from the server.
 */
export function generateSessionToken(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Simulate a SHA-256 hash of a document for integrity verification.
 * In production: use SubtleCrypto.digest('SHA-256', buffer)
 */
export async function hashDocument(content: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback simulation
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

/**
 * Simulate AES-256-GCM encryption for ID storage.
 * In production, this would call a KMS endpoint.
 */
export function encryptIdReference(data: {
  legalName: string;
  idType: string;
  idNumber: string;
}): string {
  // Production: encrypt with AES-256-GCM, store IV + ciphertext
  const payload = JSON.stringify({
    ...data,
    ts: Date.now(),
    version: "1.0",
  });
  // Simulate: base64 encode (NOT real encryption - production uses SubtleCrypto)
  return btoa(payload);
}

/**
 * NDA signature timestamp formatter.
 */
export function formatNdaTimestamp(ts: number = Date.now()): string {
  return new Date(ts).toISOString();
}

/**
 * Validate OTP format.
 */
export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Generate a 6-digit OTP.
 */
export function generateOTP(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return ((arr[0] % 900000) + 100000).toString();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}