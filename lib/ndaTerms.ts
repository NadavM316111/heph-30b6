export interface NDASection {
  title: string;
  body: string;
}

export const NDA_TERMS: NDASection[] = [
  {
    title: "Article 1 — Definitions",
    body: `For the purposes of this International Non-Disclosure and Confidentiality Agreement ("Agreement"), the following definitions apply: "Confidential Information" means any information, data, communications, documents, or materials exchanged through the Confi platform that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. "Party" and "Parties" refer to each verified user who has accepted this Agreement. "Platform" refers to the Confi Messaging Application and all associated services.`,
  },
  {
    title: "Article 2 — Scope of Confidentiality",
    body: `Each Party agrees to hold all Confidential Information received through the Platform in strict confidence. No Party shall disclose, publish, reproduce, summarize, or otherwise communicate Confidential Information to any third party without the express prior written consent of all other Parties to the relevant conversation. This obligation applies during the term of use and for a period of five (5) years following the termination of any confidential conversation thread.`,
  },
  {
    title: "Article 3 — Permitted Disclosures",
    body: `Confidential Information may be disclosed without consent only: (a) to comply with a valid court order or binding legal process, provided the disclosing party gives maximum permissible notice to other Parties; (b) to the extent such information is or becomes publicly available through no breach of this Agreement; (c) if independently developed without reference to the Confidential Information. The burden of proving any exception rests on the Party asserting it.`,
  },
  {
    title: "Article 4 — Verified Identity & Legal Traceability",
    body: `All users of the Platform are required to verify their identity prior to accessing any confidential features. By accepting this Agreement, each Party consents to the binding of their verified email address, unique user identifier, device fingerprint, and session token to their identity record. This binding ensures legal traceability for enforcement of this Agreement. Identity records are retained for a minimum of seven (7) years for legal compliance purposes.`,
  },
  {
    title: "Article 5 — Data Minimization & Encryption",
    body: `The Platform is designed to collect and retain the minimum personal information necessary for identity verification and legal compliance. All stored data is encrypted at rest using industry-standard cryptographic methods. The Platform does not sell, rent, or transfer personal data to third parties except as required by law or for the enforcement of this Agreement.`,
  },
  {
    title: "Article 6 — Governing Law & Jurisdiction",
    body: `This Agreement shall be governed by and construed in accordance with internationally recognized principles of contract law, including but not limited to the UNIDROIT Principles of International Commercial Contracts. The Parties agree that any dispute arising from this Agreement may be submitted to binding international arbitration under the UNCITRAL Arbitration Rules. The Parties irrevocably submit to the jurisdiction of arbitral tribunals constituted under said rules.`,
  },
  {
    title: "Article 7 — Remedies for Breach",
    body: `Each Party acknowledges that any breach of this Agreement would cause irreparable harm for which monetary damages would be an inadequate remedy. Accordingly, each Party agrees that in the event of a breach or threatened breach, the non-breaching Party shall be entitled to seek injunctive relief and other equitable remedies without the requirement of posting bond or other security. This right is in addition to and not in lieu of any other rights or remedies available at law or in equity.`,
  },
  {
    title: "Article 8 — Severability & Entire Agreement",
    body: `If any provision of this Agreement is found to be unenforceable under applicable law, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall continue in full force and effect. This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior agreements, representations, and understandings. This Agreement may only be modified by a written amendment signed by all Parties.`,
  },
  {
    title: "Article 9 — Electronic Acceptance",
    body: `The Parties agree that electronic acceptance of this Agreement (including acceptance through a digital interface with a verified identity) constitutes a valid and binding signature under applicable electronic signature laws, including but not limited to the UNCITRAL Model Law on Electronic Commerce, the EU eIDAS Regulation, and the United States Electronic Signatures in Global and National Commerce Act (ESIGN). The timestamp, user identifier, and device fingerprint recorded at the time of acceptance shall constitute conclusive evidence of the identity of the accepting party.`,
  },
  {
    title: "Article 10 — Acknowledgment",
    body: `By accepting this Agreement, you acknowledge that you have read and understood all provisions herein, that you have had the opportunity to seek independent legal counsel, that you are of legal age and capacity to enter into binding agreements in your jurisdiction, and that you agree to be bound by all terms and conditions set forth in this Agreement. Your acceptance is irrevocable and creates immediately binding legal obligations.`,
  },
];