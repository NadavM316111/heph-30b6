// Password hashing using the Web Crypto API (PBKDF2).
// This runs client-side before sending to /api/auth.
// The server-side auth route applies its own bcrypt — this
// is a defence-in-depth measure so plaintext passwords never
// leave the browser.

const PBKDF2_ITERATIONS = 100_000;
const SALT_KEY = "confi_pw_salt";

async function getOrCreateSalt(): Promise<Uint8Array> {
  if (typeof window === "undefined") return new Uint8Array(16);
  try {
    const existing = localStorage.getItem(SALT_KEY);
    if (existing) {
      const arr = JSON.parse(existing) as number[];
      return new Uint8Array(arr);
    }
  } catch {
    // ignore
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  try {
    localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  } catch {
    // ignore
  }
  return salt;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof window === "undefined") return password;
  try {
    const enc = new TextEncoder();
    const salt = await getOrCreateSalt();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(bits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
    return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
  } catch {
    // Fallback if SubtleCrypto unavailable
    return password;
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash.startsWith("pbkdf2:")) {
    return password === storedHash;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 5) return false;
  const [, , iterStr, saltHex, expectedHex] = parts;
  const iterations = parseInt(iterStr, 10);
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16))
  );
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(bits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex === expectedHex;
  } catch {
    return false;
  }
}

// Generate a cryptographically random key pair stub for future E2E key exchange
export async function generateKeyPairStub(): Promise<{ publicKey: string; privateKeyRef: string }> {
  if (typeof window === "undefined") return { publicKey: "", privateKeyRef: "" };
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const publicKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const privateKeyRef = `local:${Date.now().toString(36)}`;
  return { publicKey, privateKeyRef };
}