// Verified identity types and utilities for NDA legal traceability

export interface VerifiedIdentity {
  identityId: string;
  email: string;
  displayName: string;
  phone: string;
  avatar: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

export interface NdaEligibility {
  eligible: boolean;
  reasons: string[];
  level: "none" | "basic" | "full";
}

/**
 * Determine NDA signing eligibility based on verified identity.
 * - "none": not eligible (email unverified)
 * - "basic": email verified only — can view NDA drafts
 * - "full": email + phone verified — can sign NDA and enter confidential sessions
 */
export function getNdaEligibility(identity: Partial<VerifiedIdentity>): NdaEligibility {
  const reasons: string[] = [];

  if (!identity.emailVerified) {
    reasons.push("Email address must be verified");
  }
  if (!identity.phoneVerified) {
    reasons.push("Phone number must be verified (required for NDA signing)");
  }
  if (!identity.displayName) {
    reasons.push("Display name is required for legal identification");
  }

  const level: NdaEligibility["level"] =
    identity.emailVerified && identity.phoneVerified && identity.displayName
      ? "full"
      : identity.emailVerified && identity.displayName
      ? "basic"
      : "none";

  return {
    eligible: level === "full",
    reasons,
    level,
  };
}

/**
 * Format identity for NDA preamble (legal document header).
 */
export function formatIdentityForNda(identity: VerifiedIdentity): string {
  const lines = [
    `PARTY IDENTITY RECORD`,
    `─────────────────────────────────────────`,
    `Identity ID  : ${identity.identityId}`,
    `Full Name    : ${identity.displayName}`,
    `Email        : ${identity.email} [${identity.emailVerified ? "VERIFIED" : "UNVERIFIED"}]`,
    `Phone        : ${identity.phone || "Not provided"} [${identity.phoneVerified ? "VERIFIED" : "UNVERIFIED"}]`,
    `Registered   : ${new Date(identity.createdAt).toUTCString()}`,
    `─────────────────────────────────────────`,
    `This identity record was established through Confi's multi-factor`,
    `verification process and is referenced in this NDA agreement.`,
  ];
  return lines.join("\n");
}

/**
 * Generate a stable audit string for logging NDA events.
 */
export function auditString(identity: VerifiedIdentity, event: string): string {
  return JSON.stringify({
    event,
    identityId: identity.identityId,
    email: identity.email,
    emailVerified: identity.emailVerified,
    phoneVerified: identity.phoneVerified,
    timestamp: new Date().toISOString(),
  });
}