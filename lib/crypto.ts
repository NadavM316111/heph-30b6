/**
 * Confi — Cryptographic identity key pair utilities
 *
 * Uses the Web Crypto API (SubtleCrypto) to generate Ed25519-compatible
 * ECDSA P-256 key pairs. These underpin:
 *   1. End-to-end encrypted message channels
 *   2. Legally binding NDA signatures
 *
 * Private keys NEVER leave the device — they are stored in localStorage
 * in exported JWK form. Only the public key is uploaded to the server.
 */

// ─── Key generation ──────────────────────────────────────────────────────────

/**
 * Generate a new ECDSA P-256 identity key pair.
 * P-256 is universally supported by Web Crypto API across all browsers.
 */
export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable so we can export/store
    ["sign", "verify"]
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────

/**
 * Export a public key as a Base64-encoded SPKI blob.
 * This is safe to upload to the server and share with contacts.
 */
export async function exportPublicKeyAsBase64(key: CryptoKey): Promise<string> {
  const spki = await window.crypto.subtle.exportKey("spki", key);
  return bufferToBase64(spki);
}

/**
 * Export a private key as a Base64-encoded PKCS8 blob.
 * Store ONLY in localStorage on the originating device.
 */
export async function exportPrivateKeyAsBase64(key: CryptoKey): Promise<string> {
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", key);
  return bufferToBase64(pkcs8);
}

// ─── Import helpers ───────────────────────────────────────────────────────────

/**
 * Re-import a stored public key from Base64 SPKI.
 */
export async function importPublicKeyFromBase64(b64: string): Promise<CryptoKey> {
  const spki = base64ToBuffer(b64);
  return window.crypto.subtle.importKey(
    "spki",
    spki,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/**
 * Re-import a stored private key from Base64 PKCS8.
 */
export async function importPrivateKeyFromBase64(b64: string): Promise<CryptoKey> {
  const pkcs8 = base64ToBuffer(b64);
  return window.crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

// ─── Sign / verify ────────────────────────────────────────────────────────────

/**
 * Sign an arbitrary string payload with the identity private key.
 * Returns a Base64-encoded DER signature.
 */
export async function signData(privateKey: CryptoKey, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const signature = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    data
  );
  return bufferToBase64(signature);
}

/**
 * Verify a signature produced by signData().
 * Returns true if the signature is valid for the given public key + payload.
 */
export async function verifySignature(
  publicKey: CryptoKey,
  payload: string,
  signatureB64: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const signature = base64ToBuffer(signatureB64);
  return window.crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    publicKey,
    signature,
    data
  );
}

/**
 * Derive a shared secret for ECDH key agreement (future use for message encryption).
 * Both parties need ECDH keys (not ECDSA); this is included for forward compatibility.
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

/**
 * Compute a short human-readable fingerprint of a public key (first 40 hex chars of SHA-256).
 * Used in the UI to let users verify each other's identity keys out-of-band.
 */
export async function keyFingerprint(publicKeyB64: string): Promise<string> {
  const buffer = base64ToBuffer(publicKeyB64);
  const hash = await window.crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Format as groups of 4 for readability: XXXX XXXX XXXX XXXX XXXX
  return hex.slice(0, 40).match(/.{1,4}/g)?.join(" ") ?? hex.slice(0, 40);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}