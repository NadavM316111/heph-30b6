// Confi utility functions — shared across client and server

/**
 * Generate a unique Confi ID in format: CNFI-XXXX-XXXX-XXXX
 * Uses cryptographically random characters from a URL-safe alphabet
 * that avoids visually ambiguous characters (0, O, I, 1, l)
 */
export function generateConfiId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "CNFI";
  for (let segment = 0; segment < 3; segment++) {
    id += "-";
    for (let i = 0; i < 4; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return id; // e.g. CNFI-A3BX-MN7K-PQ2Y
}

/**
 * Generate a deterministic conversation ID from two Confi IDs
 * Always produces the same ID regardless of argument order
 */
export function makeConversationId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate a Confi ID format
 */
export function isValidConfiId(id: string): boolean {
  return /^CNFI-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(id);
}

/**
 * Format a phone number for display
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Generate an SVG avatar data URL from a display name
 */
export function generateAvatar(displayName: string, size = 80): string {
  const colors = ["4F46E5", "7C3AED", "DB2777", "059669", "D97706", "DC2626", "0891B2", "7C2D12"];
  const colorIndex =
    Math.abs(displayName.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length;
  const color = colors[colorIndex];
  const words = displayName.trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size / 2}" fill="#${color}"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
          font-family="-apple-system, BlinkMacSystemFont, sans-serif" 
          font-size="${size * 0.36}" fill="white" font-weight="700">${initials}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * NDA text — the legally-binding International NDA for Confidential Mode
 */
export const INTERNATIONAL_NDA_TEXT = `INTERNATIONAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the date of acceptance between the parties engaging in this conversation via Confi Messaging Platform ("Confi").

RECITALS
WHEREAS, the Parties desire to explore and engage in communications in which one Party may share confidential information with the other Party; and
WHEREAS, the Parties wish to protect such confidential information from unauthorized disclosure;

NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter set forth, the Parties agree as follows:

ARTICLE 1 — DEFINITION OF CONFIDENTIAL INFORMATION
1.1 "Confidential Information" means any and all information or data that has or could have commercial value or other utility in the business in which disclosing Party is engaged, shared within conversations designated as "Confidential" on the Confi platform.
1.2 Confidential Information includes but is not limited to: business strategies, financial data, personal information, technical specifications, trade secrets, proprietary methodologies, and any other material shared within confidential conversation threads.
1.3 Confidential Information does not include information that: (a) is or becomes publicly known through no breach of this Agreement; (b) was rightfully in the receiving Party's possession prior to disclosure; (c) is independently developed by the receiving Party without use of Confidential Information.

ARTICLE 2 — OBLIGATIONS OF RECEIVING PARTY
2.1 The receiving Party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party; (c) use Confidential Information solely for the purpose of the parties' communications; (d) protect Confidential Information with the same degree of care used for its own confidential information, but no less than reasonable care.

ARTICLE 3 — GOVERNING LAW & JURISDICTION
3.1 This Agreement shall be governed by international commercial law principles, including UNCITRAL Model Law provisions.
3.2 This Agreement is enforceable across all signatory nations of the Hague Convention on Choice of Court Agreements (2005).
3.3 Disputes shall be resolved by binding arbitration under ICC International Court of Arbitration rules.

ARTICLE 4 — DURATION
4.1 Obligations under this Agreement remain in effect for five (5) years from the date of each disclosure.
4.2 Obligations regarding trade secrets continue indefinitely.

ARTICLE 5 — REMEDIES
5.1 Breach of this Agreement entitles the non-breaching Party to seek: (a) injunctive or other equitable relief; (b) monetary damages; (c) attorneys' fees and costs.

ARTICLE 6 — ELECTRONIC SIGNATURE & CONFI ID BINDING
6.1 Your Confi User ID constitutes your electronic signature and is cryptographically bound to your verified phone number.
6.2 Acceptance of this Agreement constitutes a legally binding electronic signature under: the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN); the EU Electronic Identification and Trust Services Regulation (eIDAS); and applicable national e-signature laws worldwide.
6.3 The timestamp, IP address, device fingerprint, and Confi ID are recorded and constitute prima facie evidence of your acceptance.

ARTICLE 7 — SEVERABILITY
7.1 If any provision of this Agreement is found unenforceable, the remaining provisions continue in full force.

ARTICLE 8 — ENTIRE AGREEMENT
8.1 This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior negotiations, understandings, and agreements.

By tapping "Accept & Enable Confidential Mode", you:
• Electronically sign this Agreement
• Agree to all terms and conditions herein
• Acknowledge that your Confi ID and phone number are permanently bound to this signature
• Consent to this Agreement being enforceable under applicable international law

Confi ID: [YOUR_CONFI_ID]
Date: [CURRENT_DATE]
`;

export const NDA_VERSION = "1.0.0";