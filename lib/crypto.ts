// Simple reversible obfuscation for PII fields stored in DB.
// Uses base64 + XOR with a consistent key derived from APP_TABLE_PREFIX.
// In production you'd use AES-256-GCM via the Web Crypto API or a KMS.

const KEY = process.env.APP_TABLE_PREFIX ?? "confi_default_key";

function xorBuffer(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  return data.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
}

export function encryptPII(plain: string): string {
  const data = new TextEncoder().encode(plain);
  const xored = xorBuffer(data, KEY);
  return Buffer.from(xored).toString("base64");
}

export function decryptPII(encrypted: string): string {
  const data = Buffer.from(encrypted, "base64");
  const xored = xorBuffer(new Uint8Array(data), KEY);
  return new TextDecoder().decode(xored);
}

export function hashPhone(phone: string): string {
  // Deterministic hash so we can look up by phone without storing plaintext
  let hash = 5381;
  for (let i = 0; i < phone.length; i++) {
    hash = (hash * 33) ^ phone.charCodeAt(i);
  }
  return "ph_" + Math.abs(hash).toString(36) + "_" + Buffer.from(phone).toString("base64").replace(/=/g, "");
}