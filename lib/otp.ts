/**
 * OTP management utilities for Confi.
 * In production, OTPs would be sent via server-side SMS/email.
 * This manages the client-side state and validation.
 */

export interface OtpRecord {
  code: string;
  contact: string;
  type: "email" | "phone";
  createdAt: number;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const OTP_KEY = "confi_otp_temp";
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;

export function generateOtpCode(length = 6): string {
  const digits = "0123456789";
  let result = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    result += digits[arr[i] % 10];
  }
  return result;
}

export function createOtpRecord(contact: string, type: "email" | "phone"): OtpRecord {
  const code = generateOtpCode(6);
  const record: OtpRecord = {
    code,
    contact,
    type,
    createdAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    verified: false,
  };
  // Store temporarily (in real app this lives server-side with the hash)
  sessionStorage.setItem(OTP_KEY, JSON.stringify(record));
  return record;
}

export function getOtpRecord(): OtpRecord | null {
  try {
    const raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function verifyOtpCode(code: string): { ok: boolean; error?: string } {
  const record = getOtpRecord();
  if (!record) return { ok: false, error: "No OTP found. Please request a new one." };
  if (record.verified) return { ok: false, error: "OTP already used." };
  if (Date.now() > record.expiresAt) {
    clearOtp();
    return { ok: false, error: "OTP has expired. Please request a new one." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    clearOtp();
    return { ok: false, error: "Too many attempts. Please request a new OTP." };
  }

  record.attempts += 1;
  sessionStorage.setItem(OTP_KEY, JSON.stringify(record));

  if (code !== record.code) {
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      ok: false,
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
        : "Too many attempts. Please request a new OTP.",
    };
  }

  record.verified = true;
  sessionStorage.setItem(OTP_KEY, JSON.stringify(record));
  return { ok: true };
}

export function clearOtp(): void {
  sessionStorage.removeItem(OTP_KEY);
}

export function getRemainingSeconds(record: OtpRecord): number {
  return Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000));
}

/**
 * Format OTP contact for display (mask middle digits)
 */
export function maskContact(contact: string, type: "email" | "phone"): string {
  if (type === "email") {
    const [user, domain] = contact.split("@");
    if (!user || !domain) return contact;
    const masked = user[0] + "*".repeat(Math.max(1, user.length - 2)) + user.slice(-1);
    return `${masked}@${domain}`;
  } else {
    // Phone: show country code + last 4
    const last4 = contact.slice(-4);
    const prefix = contact.slice(0, contact.length - 7);
    return `${prefix}***${last4}`;
  }
}