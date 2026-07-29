/**
 * Confi Crypto Utilities
 * All cryptographic operations use the Web Crypto API (SubtleCrypto).
 * No external dependencies. Works in browser + Next.js edge runtime.
 */

// ─────────────────────────────────────────────
// OTP Generation
// ─────────────────────────────────────────────

export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const num = array[0] % 1000000;
  return num.toString().padStart(6, "0");
}

// ─────────────────────────────────────────────
// Confi ID Generation
// Format: CFID-XXXX-XXXX-XXXX (alphanumeric)
// ─────────────────────────────────────────────

export function generateConfiId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomSegment = (len: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map((b) => chars[b % chars.length])
      .join("");

  return `CFID-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

// ─────────────────────────────────────────────
// Phone Hashing (SHA-256)
// ─────────────────────────────────────────────

export async function hashPhone(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

// ─────────────────────────────────────────────
// Key Derivation from phone + OTP (PBKDF2)
// ─────────────────────────────────────────────

export async function generateKeyFromPhone(seed: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(seed),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = encoder.encode("confi-salt-v1-identity");

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─────────────────────────────────────────────
// AES-GCM Encryption
// ─────────────────────────────────────────────

export async function encryptCredentials(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const payload = {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
    algorithm: "AES-GCM" as const,
    keyDerivation: "PBKDF2" as const,
    iterations: 100000,
  };

  return JSON.stringify(payload);
}

// ─────────────────────────────────────────────
// AES-GCM Decryption
// ─────────────────────────────────────────────

export async function decryptCredentials(
  encryptedJson: string,
  key: CryptoKey
): Promise<string> {
  const payload = JSON.parse(encryptedJson);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plainBuffer);
}

// ─────────────────────────────────────────────
// Session Token (JWT-like, client-side)
// Real JWTs would be server-signed; this is a
// client-side commitment for the prototype.
// ─────────────────────────────────────────────

import type { Session, UserProfile } from "./types";

export function generateSessionToken(profile: UserProfile): Session {
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  // Build a deterministic token payload
  const payload = `${profile.confiId}:${profile.phoneHash}:${now}:${expiresAt}`;

  // Create a token by base64-encoding the payload + a random nonce
  const nonce = bufferToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const token = btoa(`${payload}:${nonce}`);

  // Signature = a SHA-256-ish commitment using our identity data
  // (In production this would be an HMAC with a server secret)
  const signature = btoa(
    `confi-sig:${profile.identityCommitment}:${now}`
  );

  return {
    token,
    confiId: profile.confiId,
    phoneHash: profile.phoneHash,
    issuedAt: now,
    expiresAt,
    signature,
  };
}

export function verifySessionToken(session: Session): boolean {
  if (!session || !session.token || !session.expiresAt) return false;
  if (Date.now() > session.expiresAt) return false;
  if (!session.confiId || !session.phoneHash) return false;

  // Verify token is decodable and contains expected fields
  try {
    const decoded = atob(session.token);
    const parts = decoded.split(":");
    if (parts.length < 4) return false;
    if (parts[0] !== session.confiId) return false;
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Buffer Utilities
// ─────────────────────────────────────────────

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}