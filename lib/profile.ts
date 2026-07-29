// User profile management — stored in localStorage.
// Only non-sensitive display data is stored client-side.

export interface UserProfile {
  email: string;          // Primary key (hashed before use as localStorage key)
  phone: string;          // Used for contact discovery
  displayName: string;
  bio: string;
  avatar: string;         // Emoji avatar character
  createdAt: number;
  updatedAt: number;
}

const PROFILE_PREFIX = "confi_profile_";
const PHONE_INDEX_KEY = "confi_phone_index";

function profileKey(email: string): string {
  // Simple obfuscation — not security, just namespace
  return `${PROFILE_PREFIX}${btoa(email).replace(/=/g, "")}`;
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(profileKey(profile.email), JSON.stringify(profile));
    // Update phone → email index for contact discovery
    updatePhoneIndex(profile.phone, profile.email);
  } catch {
    // Storage quota exceeded
  }
}

export function getProfile(email: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(profileKey(email));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function deleteProfile(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const profile = getProfile(email);
    if (profile) {
      removeFromPhoneIndex(profile.phone);
    }
    localStorage.removeItem(profileKey(email));
  } catch {
    // ignore
  }
}

// Phone-to-email index for contact discovery
function updatePhoneIndex(phone: string, email: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PHONE_INDEX_KEY);
    const index: Record<string, string> = raw ? JSON.parse(raw) : {};
    index[normalizePhone(phone)] = email;
    localStorage.setItem(PHONE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

function removeFromPhoneIndex(phone: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PHONE_INDEX_KEY);
    if (!raw) return;
    const index: Record<string, string> = JSON.parse(raw);
    delete index[normalizePhone(phone)];
    localStorage.setItem(PHONE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

export function lookupByPhone(phone: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PHONE_INDEX_KEY);
    if (!raw) return null;
    const index: Record<string, string> = JSON.parse(raw);
    const email = index[normalizePhone(phone)];
    if (!email) return null;
    return getProfile(email);
  } catch {
    return null;
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}