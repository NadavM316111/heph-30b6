// OTP management — in production you'd call an SMS/email gateway.
// Codes are stored in sessionStorage (not localStorage) so they
// disappear when the tab closes, limiting the attack window.

const OTP_PREFIX = "confi_otp_";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OTPRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export function generateOTP(): string {
  // Cryptographically random 6-digit code
  const arr = new Uint32Array(1);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    arr[0] = Math.floor(Math.random() * 1000000);
  }
  return String(arr[0] % 1000000).padStart(6, "0");
}

export function storeOTP(phone: string, code: string): void {
  if (typeof window === "undefined") return;
  const record: OTPRecord = {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  try {
    sessionStorage.setItem(
      `${OTP_PREFIX}${phone}`,
      JSON.stringify(record)
    );
  } catch {
    // Fallback to localStorage
    localStorage.setItem(
      `${OTP_PREFIX}${phone}`,
      JSON.stringify(record)
    );
  }
}

export function verifyOTP(phone: string, inputCode: string): boolean {
  if (typeof window === "undefined") return false;
  const key = `${OTP_PREFIX}${phone}`;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return false;
  }
  if (!raw) return false;

  let record: OTPRecord;
  try {
    record = JSON.parse(raw) as OTPRecord;
  } catch {
    return false;
  }

  if (Date.now() > record.expiresAt) {
    clearOTP(phone);
    return false;
  }

  record.attempts += 1;
  if (record.attempts > MAX_ATTEMPTS) {
    clearOTP(phone);
    return false;
  }

  // Constant-time comparison (best-effort in JS)
  const match = timingSafeEqual(record.code, inputCode.trim());
  if (match) {
    clearOTP(phone);
    return true;
  }

  // Persist updated attempt count
  try {
    sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    localStorage.setItem(key, JSON.stringify(record));
  }
  return false;
}

export function clearOTP(phone: string): void {
  if (typeof window === "undefined") return;
  const key = `${OTP_PREFIX}${phone}`;
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Best-effort timing-safe string comparison in JS
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}