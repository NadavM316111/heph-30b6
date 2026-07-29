/**
 * Identity utilities for Confi
 * Handles OTP generation, hashing, JWT-style session tokens,
 * avatar generation, and lightweight client-side encryption.
 *
 * NOTE: In production, OTP validation and JWT signing happen on the server.
 * The client-side "encryption" here uses XOR with a derived key for
 * obfuscation in localStorage — real encryption is enforced server-side
 * via the DB layer and the /api/auth endpoint.
 */

/** Generate a cryptographically random 6-digit OTP */
export function generateOTP(): string {
  if (typeof window !== "undefined" && window.crypto) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return String(arr[0] % 1000000).padStart(6, "0");
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Simple deterministic hash for OTP comparison (client-side only) */
export function hashOTP(otp: string): string {
  let hash = 5381;
  for (let i = 0; i < otp.length; i++) {
    hash = ((hash << 5) + hash) ^ otp.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Generate a JWT-style session token (header.payload.signature format) */
export function buildSessionToken(email: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const payload = btoa(
    JSON.stringify({
      sub: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24h
      iss: "confi-app",
      purpose: "identity-session",
    })
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Client-side pseudo-signature (real signing is server-side)
  const sig = hashOTP(email + header + payload).slice(0, 16);

  return `${header}.${payload}.${sig}`;
}

/** XOR-based obfuscation for localStorage identity storage */
export function encryptIdentity(data: Record<string, string>): string {
  const json = JSON.stringify(data);
  const key = "confi-identity-key-v1";
  let result = "";
  for (let i = 0; i < json.length; i++) {
    result += String.fromCharCode(
      json.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result);
}

/** Reverse the XOR obfuscation */
export function decryptIdentity(encoded: string): Record<string, string> {
  const key = "confi-identity-key-v1";
  const raw = atob(encoded);
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    result += String.fromCharCode(
      raw.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return JSON.parse(result) as Record<string, string>;
}

const AVATAR_COLORS = [
  "linear-gradient(135deg, #7c3aed, #4f46e5)",
  "linear-gradient(135deg, #db2777, #9333ea)",
  "linear-gradient(135deg, #0891b2, #0e7490)",
  "linear-gradient(135deg, #059669, #0891b2)",
  "linear-gradient(135deg, #d97706, #dc2626)",
  "linear-gradient(135deg, #7c3aed, #db2777)",
  "linear-gradient(135deg, #4f46e5, #0891b2)",
  "linear-gradient(135deg, #16a34a, #0891b2)",
  "linear-gradient(135deg, #9333ea, #db2777)",
  "linear-gradient(135deg, #0ea5e9, #6366f1)",
];

/** Deterministically pick an avatar color from email */
export function generateAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Get initials from a display name */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Validate a JWT-style token (client-side expiry check only) */
export function isTokenValid(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}