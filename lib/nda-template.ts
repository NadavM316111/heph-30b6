/**
 * Confi — NDA Template Engine
 * 
 * Generates a legally-structured International NDA for Confidential Mode sessions.
 * This template is based on standard NDA clauses recognized in multiple jurisdictions.
 */

export interface NdaParty {
  legalName: string;
  email: string;
  sessionToken: string;
  verifiedAt?: string;
  country?: string;
}

export interface NdaMetadata {
  sessionId: string;
  signedAt: string;
  jurisdiction: string;
  effectiveDate: string;
  expiryDate: string;
  parties: [NdaParty, NdaParty];
}

/**
 * Jurisdictions recognized by the Confi platform NDA.
 */
export const SUPPORTED_JURISDICTIONS = [
  { code: "ICC", name: "ICC International Arbitration (Default)", region: "International" },
  { code: "US_NY", name: "New York, United States", region: "Americas" },
  { code: "UK_EW", name: "England & Wales, United Kingdom", region: "Europe" },
  { code: "EU_DE", name: "Germany (BGB)", region: "Europe" },
  { code: "SG", name: "Singapore (SIAC)", region: "Asia-Pacific" },
  { code: "AU_NSW", name: "New South Wales, Australia", region: "Asia-Pacific" },
  { code: "CA_ON", name: "Ontario, Canada", region: "Americas" },
  { code: "JP", name: "Japan (JCAA)", region: "Asia-Pacific" },
  { code: "UAE_DIFC", name: "DIFC, United Arab Emirates", region: "Middle East" },
  { code: "IN", name: "India (Arbitration Act 1996)", region: "Asia-Pacific" },
] as const;

/**
 * Generate a unique NDA session ID.
 */
export function generateNdaId(
  party1Email: string,
  party2Email: string,
  timestamp: number
): string {
  const raw = `${party1Email}|${party2Email}|${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `NDA-${Math.abs(hash).toString(36).toUpperCase().padStart(8, "0")}`;
}

/**
 * Generate the full NDA text with party details interpolated.
 */
export function generateNdaText(
  party1: NdaParty,
  party2: NdaParty,
  jurisdiction: string = "ICC International Arbitration"
): string {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);

  return `INTERNATIONAL NON-DISCLOSURE AGREEMENT
═══════════════════════════════════════════════════════════════

NDA Session ID: ${generateNdaId(party1.email, party2.email, now.getTime())}
Effective Date: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Platform: Confi Messaging Application

PARTIES
───────────────────────────────────────────────────────────────
Disclosing/Receiving Party 1:
  Legal Name:      ${party1.legalName}
  Email:           ${party1.email}
  Verified:        ${party1.verifiedAt ? new Date(party1.verifiedAt).toLocaleDateString() : "Pending"}
  Session Token:   ${party1.sessionToken.slice(0, 16)}…

Disclosing/Receiving Party 2:
  Legal Name:      ${party2.legalName || "[Pending Verification]"}
  Email:           ${party2.email}
  Verified:        ${party2.verifiedAt ? new Date(party2.verifiedAt).toLocaleDateString() : "Pending"}
  Session Token:   ${party2.sessionToken.slice(0, 16)}…

GOVERNING LAW: ${jurisdiction}

═══════════════════════════════════════════════════════════════

AGREEMENT

This International Non-Disclosure Agreement ("Agreement") is entered into as of the Effective Date above by and between the parties identified above (each a "Party" and collectively the "Parties"), communicating through the Confi Messaging Platform ("Platform").

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any and all information or data, whether oral, written, electronic, or in any other form, that is disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party") through this Platform's Confidential Mode, including but not limited to:

   (a) technical data, trade secrets, know-how, research, developments, and inventions;
   (b) product plans, products, services, customers, and customer lists;
   (c) business plans, financial projections, pricing, and market analyses;
   (d) software source code, algorithms, and system designs;
   (e) legal strategies, privileged communications, and settlement positions;
   (f) any other information marked or communicated as confidential.

2. NON-DISCLOSURE OBLIGATIONS

Each Party, in its capacity as Receiving Party, agrees to:

   (a) Hold all Confidential Information in strict confidence using at least the same degree of care used to protect its own most sensitive confidential information, but in no event less than reasonable care;
   (b) Not disclose any Confidential Information to any third party without the prior written consent of the Disclosing Party;
   (c) Use the Confidential Information solely for the purpose of the communication session conducted through this Platform;
   (d) Restrict access to Confidential Information to those of its representatives who need to know such information and who are bound by obligations of confidentiality at least as protective as those set forth herein;
   (e) Promptly notify the Disclosing Party of any unauthorized disclosure or use of Confidential Information.

3. EXCLUSIONS

The obligations of Section 2 shall not apply to information that:
   (a) Is or becomes publicly known through no breach of this Agreement;
   (b) Was rightfully known to the Receiving Party prior to disclosure;
   (c) Is independently developed by the Receiving Party without use of Confidential Information;
   (d) Must be disclosed pursuant to applicable law or court order, provided the Receiving Party gives prompt prior written notice where legally permissible.

4. TERM AND SURVIVAL

This Agreement shall commence on the Effective Date and shall remain in effect for five (5) years, until ${expiryDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Obligations with respect to trade secrets shall survive indefinitely.

5. REMEDIES

The Parties acknowledge that breach of this Agreement would cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, in addition to any other available remedies, injunctive or other equitable relief shall be available to the non-breaching Party without the necessity of proving actual damages or posting bond or other security.

6. GOVERNING LAW AND DISPUTE RESOLUTION

This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction specified above. Any dispute arising out of or relating to this Agreement shall be finally settled by arbitration under the applicable rules of the designated arbitral institution. The seat of arbitration shall be determined by the arbitral tribunal. The language of arbitration shall be English.

7. ELECTRONIC SIGNATURE AND IDENTITY VERIFICATION

Each Party confirms that:
   (a) Their legal identity has been verified through government-issued identification uploaded to and processed by the Platform;
   (b) The digital acceptance of this Agreement constitutes a legally binding electronic signature under the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN), the EU eIDAS Regulation (EU 910/2014), the UK Electronic Communications Act 2000, and equivalent national legislation worldwide;
   (c) The session token associated with their account serves as a unique identifier tying this signature to their verified identity.

8. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the Parties with respect to confidentiality of information exchanged through this Platform's Confidential Mode and supersedes all prior or contemporaneous agreements, understandings, negotiations, and discussions.

9. SEVERABILITY

If any provision of this Agreement is found to be unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall continue in full force and effect.

10. WAIVER

No waiver of any provision of this Agreement shall be effective unless in writing and signed by the waiving Party. No waiver shall constitute a waiver of any other provision.

═══════════════════════════════════════════════════════════════

DIGITAL SIGNATURE BLOCK

By activating Confidential Mode and clicking "I Agree & Sign NDA":

PARTY 1:
Signature:    [DIGITAL — ${party1.sessionToken.slice(0, 24)}]
Legal Name:   ${party1.legalName}
Date/Time:    ${now.toISOString()}
IP Hash:      [Recorded by Platform]

PARTY 2:
Signature:    [DIGITAL — ${party2.sessionToken.slice(0, 24)}]
Legal Name:   ${party2.legalName || "[Pending]"}
Date/Time:    [Upon acceptance by counterparty]
IP Hash:      [Recorded by Platform]

This document is digitally sealed by the Confi Platform.
NDA records are retained for the duration of the agreement term.
═══════════════════════════════════════════════════════════════`;
}

/**
 * Government ID document types accepted by the platform.
 */
export const ACCEPTED_ID_TYPES = [
  { value: "passport", label: "Passport", description: "International travel document" },
  { value: "national_id", label: "National Identity Card", description: "Government-issued national ID" },
  { value: "drivers_license", label: "Driver's License", description: "Valid driver's license with photo" },
  { value: "residence_permit", label: "Residence Permit", description: "Biometric residence permit" },
  { value: "military_id", label: "Military ID", description: "Armed forces identification card" },
] as const;

export type IdType = typeof ACCEPTED_ID_TYPES[number]["value"];