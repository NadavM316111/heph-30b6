"use client";

import { useState } from "react";
import type { UserSession } from "@/app/page";
import { COUNTRIES } from "@/lib/countries";

interface Props {
  session: UserSession;
  onComplete: (fullName: string, country: string) => void;
}

export default function ProfileSetupScreen({ session, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [agreeNDA, setAgreeNDA] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  ).slice(0, 50);

  const validateFullName = (n: string) => {
    const parts = n.trim().split(/\s+/);
    return parts.length >= 2 && n.trim().length >= 4;
  };

  const handleStep1 = () => {
    setError("");
    if (!validateFullName(fullName)) {
      setError("Please enter your full legal name (first and last name required).");
      return;
    }
    if (!country) {
      setError("Please select your country of residence for NDA jurisdiction.");
      return;
    }
    setStep(2);
  };

  const handleComplete = async () => {
    if (!agreeNDA || !agreeTerms) {
      setError("You must agree to both the Terms of Service and the NDA framework to use Confi.");
      return;
    }
    setError("");
    setLoading(true);

    // Store profile via auth endpoint update (using login to refresh session)
    try {
      await new Promise((r) => setTimeout(r, 600));
      // In production, you'd call a dedicated profile endpoint
      // For now we pass data back to parent for localStorage storage
      onComplete(fullName.trim(), country);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCountry = COUNTRIES.find((c) => c.code === country);

  return (
    <div style={styles.container}>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: step === 1 ? "50%" : "100%" }} />
      </div>

      <div style={styles.header}>
        <div style={styles.iconCircle}>
          {step === 1 ? "👤" : "📜"}
        </div>
        <h1 style={styles.title}>
          {step === 1 ? "Your Legal Identity" : "Legal Agreement"}
        </h1>
        <p style={styles.subtitle}>
          {step === 1
            ? "Required for NDA enforcement and jurisdictional compliance"
            : "You must agree before activating confidential conversations"}
        </p>
        <div style={styles.stepIndicator}>
          Step {step} of 2
        </div>
      </div>

      {step === 1 && (
        <div style={styles.card}>
          <div style={styles.alertBox}>
            <span>⚖️</span>
            <p>
              Your <strong>legal full name</strong> and <strong>country</strong> are
              required to make NDAs enforceable. Use your government ID name.
            </p>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Legal Full Name <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Elizabeth Smith"
              style={styles.input}
              autoComplete="name"
            />
            <p style={styles.hint}>
              Must match your government-issued ID exactly.
            </p>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Country of Residence <span style={styles.required}>*</span>
            </label>
            {country ? (
              <div style={styles.selectedCountry}>
                <span style={styles.flag}>{selectedCountry?.flag}</span>
                <span style={styles.countryName}>{selectedCountry?.name}</span>
                <button
                  style={styles.changeBtn}
                  onClick={() => { setCountry(""); setCountrySearch(""); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search country..."
                  style={styles.input}
                />
                {countrySearch && (
                  <div style={styles.countryDropdown}>
                    {filteredCountries.length === 0 ? (
                      <p style={styles.noResults}>No countries found</p>
                    ) : (
                      filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          style={styles.countryOption}
                          onClick={() => {
                            setCountry(c.code);
                            setCountrySearch("");
                          }}
                        >
                          <span>{c.flag}</span>
                          <span>{c.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
            <p style={styles.hint}>
              NDA jurisdiction will be governed by the laws of this country.
            </p>
          </div>

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          <button style={styles.primaryBtn} onClick={handleStep1}>
            Continue to Agreement →
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={styles.card}>
          <div style={styles.summaryBox}>
            <h3 style={styles.summaryTitle}>Identity Summary</h3>
            <div style={styles.summaryRow}>
              <span style={styles.summaryKey}>Legal Name:</span>
              <span style={styles.summaryVal}>{fullName}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryKey}>Email:</span>
              <span style={styles.summaryVal}>{session.email}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryKey}>Jurisdiction:</span>
              <span style={styles.summaryVal}>
                {selectedCountry?.flag} {selectedCountry?.name}
              </span>
            </div>
          </div>

          <div style={styles.ndaPreview}>
            <h4 style={styles.ndaTitle}>📜 Confi NDA Framework — Summary</h4>
            <div style={styles.ndaScroll}>
              <p style={styles.ndaText}>
                <strong>1. Confidentiality Obligation:</strong> When Confidential Mode is
                activated in a conversation, both parties agree that all exchanged information
                constitutes confidential information under this Non-Disclosure Agreement.
              </p>
              <p style={styles.ndaText}>
                <strong>2. Jurisdiction:</strong> This NDA is governed by and construed
                in accordance with the laws of each party&apos;s registered country. International
                enforcement follows the Hague Convention and applicable bilateral treaties.
              </p>
              <p style={styles.ndaText}>
                <strong>3. Duration:</strong> Confidentiality obligations remain in effect
                for a period of five (5) years from the date the Confidential Mode was
                activated, unless otherwise agreed in writing.
              </p>
              <p style={styles.ndaText}>
                <strong>4. Permitted Disclosures:</strong> Information may be disclosed
                only if required by law, with prior written consent, or if independently
                developed without reference to the confidential information.
              </p>
              <p style={styles.ndaText}>
                <strong>5. Identity Binding:</strong> By providing your legal name and
                verified email, you acknowledge that any NDA activated under your account
                is legally binding on you personally as identified herein.
              </p>
              <p style={styles.ndaText}>
                <strong>6. Remedies:</strong> Breach of this agreement may result in
                injunctive relief, damages, and/or legal action in the applicable jurisdiction.
              </p>
            </div>
          </div>

          <div style={styles.checkRow} onClick={() => setAgreeTerms((v) => !v)}>
            <div style={{ ...styles.checkbox, ...(agreeTerms ? styles.checkboxChecked : {}) }}>
              {agreeTerms && <span>✓</span>}
            </div>
            <p style={styles.checkLabel}>
              I agree to Confi&apos;s <strong style={{ color: "#7c6cf0" }}>Terms of Service</strong>{" "}
              and <strong style={{ color: "#7c6cf0" }}>Privacy Policy</strong>
            </p>
          </div>

          <div style={styles.checkRow} onClick={() => setAgreeNDA((v) => !v)}>
            <div style={{ ...styles.checkbox, ...(agreeNDA ? styles.checkboxChecked : {}) }}>
              {agreeNDA && <span>✓</span>}
            </div>
            <p style={styles.checkLabel}>
              I understand and agree to the{" "}
              <strong style={{ color: "#6cf0c2" }}>Confi NDA Framework</strong> and
              acknowledge that activating Confidential Mode creates a legally binding
              obligation under my registered jurisdiction.
            </p>
          </div>

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          <div style={styles.btnRow}>
            <button style={styles.backBtn} onClick={() => setStep(1)}>
              ← Back
            </button>
            <button
              style={{
                ...styles.primaryBtn,
                flex: 2,
                opacity: loading ? 0.7 : 1,
              }}
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? "Saving..." : "Complete Setup ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "440px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px 40px",
    boxSizing: "border-box",
    gap: "20px",
  },
  progressBar: {
    width: "100%",
    height: "3px",
    background: "#1a1a28",
    position: "sticky",
    top: 0,
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #7c6cf0, #6cf0c2)",
    transition: "width 0.4s ease",
    borderRadius: "0 2px 2px 0",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
    paddingTop: "24px",
  },
  iconCircle: {
    width: "72px",
    height: "72px",
    background: "#1a1a28",
    border: "2px solid #7c6cf044",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: "13px",
    color: "#777",
    margin: 0,
    maxWidth: "280px",
    lineHeight: "1.5",
  },
  stepIndicator: {
    fontSize: "12px",
    color: "#7c6cf0",
    fontWeight: "600",
    background: "#1a1a28",
    padding: "4px 12px",
    borderRadius: "20px",
    border: "1px solid #7c6cf033",
  },
  card: {
    width: "100%",
    background: "#12121a",
    border: "1px solid #2a2a3a",
    borderRadius: "20px",
    padding: "24px 20px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  alertBox: {
    background: "#1a1428",
    border: "1px solid #7c6cf033",
    borderRadius: "10px",
    padding: "12px 14px",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    fontSize: "13px",
    color: "#bbb",
    lineHeight: "1.5",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    position: "relative",
  },
  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#aaa",
  },
  required: {
    color: "#f05c5c",
    marginLeft: "2px",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    background: "#1a1a28",
    border: "1.5px solid #2a2a3a",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  hint: {
    fontSize: "11px",
    color: "#555",
    margin: 0,
    lineHeight: "1.4",
  },
  selectedCountry: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#1a1a28",
    border: "1.5px solid #7c6cf044",
    borderRadius: "12px",
    padding: "12px 16px",
  },
  flag: {
    fontSize: "24px",
  },
  countryName: {
    flex: 1,
    color: "#fff",
    fontWeight: "600",
    fontSize: "15px",
  },
  changeBtn: {
    background: "transparent",
    border: "1px solid #7c6cf066",
    color: "#7c6cf0",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  countryDropdown: {
    background: "#1a1a28",
    border: "1px solid #2a2a3a",
    borderRadius: "12px",
    maxHeight: "200px",
    overflowY: "auto",
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 100,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  countryOption: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#ddd",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "14px",
    textAlign: "left",
  },
  noResults: {
    color: "#555",
    padding: "12px 14px",
    fontSize: "13px",
    margin: 0,
  },
  errorBox: {
    background: "#2a0f0f",
    border: "1px solid #f05c5c44",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#f05c5c",
    fontSize: "13px",
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #7c6cf0, #6cf0c2)",
    border: "none",
    borderRadius: "13px",
    color: "#000",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
  },
  summaryBox: {
    background: "#1a1a28",
    border: "1px solid #2a2a3a",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  summaryTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#7c6cf0",
    margin: "0 0 4px 0",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  summaryKey: {
    fontSize: "12px",
    color: "#666",
    flexShrink: 0,
  },
  summaryVal: {
    fontSize: "13px",
    color: "#fff",
    fontWeight: "600",
    textAlign: "right",
  },
  ndaPreview: {
    border: "1px solid #6cf0c233",
    borderRadius: "12px",
    overflow: "hidden",
  },
  ndaTitle: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#6cf0c2",
    margin: 0,
    padding: "12px 14px",
    background: "#0f1a18",
    borderBottom: "1px solid #6cf0c222",
  },
  ndaScroll: {
    maxHeight: "180px",
    overflowY: "auto",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "#0f1a18",
  },
  ndaText: {
    fontSize: "12px",
    color: "#888",
    margin: 0,
    lineHeight: "1.6",
  },
  checkRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    cursor: "pointer",
    padding: "4px 0",
  },
  checkbox: {
    width: "22px",
    height: "22px",
    border: "2px solid #333",
    borderRadius: "6px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
    fontWeight: "700",
    fontSize: "13px",
    transition: "all 0.2s",
    marginTop: "1px",
  },
  checkboxChecked: {
    background: "#7c6cf0",
    border: "2px solid #7c6cf0",
    color: "#fff",
  },
  checkLabel: {
    fontSize: "13px",
    color: "#bbb",
    margin: 0,
    lineHeight: "1.5",
  },
  btnRow: {
    display: "flex",
    gap: "10px",
    alignItems: "stretch",
  },
  backBtn: {
    flex: 1,
    padding: "14px",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "13px",
    color: "#888",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  },
};