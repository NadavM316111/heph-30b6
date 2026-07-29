/**
 * Confi Identity Utilities
 * Handles ID generation, OTP, validation for the identity layer.
 * These will tie into NDA signing — keep functions pure and deterministic.
 */

/**
 * Generate a unique Confi User ID.
 * Format: CNFI-XXXXXXXX-XXXX (URL-safe, uppercase)
 */
export function generateUserId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg1 = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  const seg2 = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `CNFI-${seg1}-${seg2}`;
}

/**
 * Generate a 6-digit OTP (numeric only).
 * In production this would be sent via SMS gateway (Twilio, etc).
 * In this demo it is logged to console.
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate a phone number:
 * - Must have 10–15 digits (after stripping +, spaces, dashes)
 * - Allow leading + for country code
 */
export function validatePhone(phone: string): boolean {
  const stripped = phone.replace(/[\s\-().]/g, "");
  return /^\+?[0-9]{10,15}$/.test(stripped);
}

/**
 * Validate an email address (RFC 5322 simplified).
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate a 6-digit numeric PIN.
 */
export function validatePin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Derive a display-safe truncated ID for UI use.
 * e.g. "CNFI-AB12CD34-5678" → "CNFI-AB12…5678"
 */
export function shortUserId(userId: string): string {
  if (!userId || userId.length < 10) return userId;
  const parts = userId.split("-");
  if (parts.length < 3) return userId;
  return `${parts[0]}-${parts[1].slice(0, 4)}…${parts[2]}`;
}

/**
 * Format a phone number for display.
 * Strips extra spaces, ensures + prefix.
 */
export function formatPhone(phone: string): string {
  const stripped = phone.replace(/\s+/g, "");
  return stripped.startsWith("+") ? stripped : `+${stripped}`;
}

/**
 * Returns the NDA-ready legal identity string.
 * Used in NDA document headers.
 */
export function ndaIdentityString(params: {
  legalName: string;
  userId: string;
  phone: string;
  country: string;
  countryCode: string;
  createdAt: string;
}): string {
  return [
    `Full Legal Name: ${params.legalName}`,
    `Confi User ID: ${params.userId}`,
    `Verified Phone: ${formatPhone(params.phone)}`,
    `Jurisdiction: ${params.country} (${params.countryCode})`,
    `Identity Verified: ${new Date(params.createdAt).toUTCString()}`,
  ].join("\n");
}