// Contact management and phone-number-based discovery.

import { lookupByPhone, UserProfile } from "@/lib/profile";

export interface Contact {
  ownerEmail: string;
  contactEmail: string;
  contactPhone: string;
  displayName: string;
  avatar: string;
  addedAt: number;
}

const CONTACTS_PREFIX = "confi_contacts_";

function contactsKey(ownerEmail: string): string {
  return `${CONTACTS_PREFIX}${btoa(ownerEmail).replace(/=/g, "")}`;
}

export function getMyContacts(ownerEmail: string): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(contactsKey(ownerEmail));
    if (!raw) return [];
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

export function addContact(contact: Contact): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getMyContacts(contact.ownerEmail);
    const alreadyExists = existing.some(c => c.contactEmail === contact.contactEmail);
    if (alreadyExists) return;
    const updated = [...existing, contact];
    localStorage.setItem(contactsKey(contact.ownerEmail), JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function removeContact(ownerEmail: string, contactEmail: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getMyContacts(ownerEmail);
    const updated = existing.filter(c => c.contactEmail !== contactEmail);
    localStorage.setItem(contactsKey(ownerEmail), JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Search for Confi users by phone number.
 * In production this would query the DB via an API route.
 * Here we search the local phone index (populated when any user
 * saves a profile on this device — works for demo / multi-account testing).
 */
export function searchContactsByPhone(
  fullPhone: string,
  requesterEmail: string
): UserProfile[] {
  if (typeof window === "undefined") return [];
  const result = lookupByPhone(fullPhone);
  if (!result) return [];
  // Don't return the requester themselves
  if (result.email === requesterEmail) return [];
  return [result];
}