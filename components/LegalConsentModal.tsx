"use client";

import { useState } from "react";
import { NDA_TERMS } from "@/lib/ndaTerms";

interface Props {
  email: string;
  displayName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function LegalConsentModal({ email, displayName, onAccept, onDecline }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const now = new Date().toISOString();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const near = el.scrollHeight - el.scrollTop <= el.clientHeight + 60;
    if (near) setScrolledToBottom(true);
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={header}>
          <span style={{ fontSize: 28 }}>⚖️</span>
          <div>
            <h2 style={title}>Legal Consent Required</h2>
            <p style={sub}>You must accept the terms before using Confi</p>
          </div>
        </div>

        <div style={metaBox}>
          <MetaRow label="Name" value={displayName} />
          <MetaRow label="Email" value={email} />
          <MetaRow label="Timestamp" value={now} />
          <MetaRow label="Agreement" value="International NDA v1.0" />
        </div>

        <div style={scrollBox} onScroll={handleScroll}>
          <div style={termContent}>
            {NDA_TERMS.map((section, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <h3 style={secTitle}>{section.title}</h3>
                <p style={secBody}>{section.body}</p>
              </div>
            ))}
          </div>
          {!scrolledToBottom && (
            <div style={scrollHint}>↓ Scroll to read all terms</div>
          )}
        </div>

        <label style={checkRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={!scrolledToBottom}
            style={{ width: 16, height: 16, accentColor: "#6ee7b7" }}
          />
          <span style={{ fontSize: 12, color: scrolledToBottom ? "#d1d5db" : "#6b7280", lineHeight: 1.5 }}>
            I have read and agree to the International NDA and Confidentiality Agreement.
            I understand this creates a legally binding obligation.
          </span>
        </label>

        <div style={btnRow}>
          <button style={declineBtn} onClick={onDecline}>Decline</button>
          <button
            style={{ ...acceptBtn, opacity: (checked && scrolledToBottom) ? 1 : 0.4 }}
            onClick={onAccept}
            disabled={!checked || !scrolledToBottom}
          >
            I Agree & Accept →
          </button>
        </div>

        <p style={footNote}>
          This agreement is timestamped, bound to your verified identity and device,
          and is enforceable under international law.
        </p>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, gap: 8 }}>
      <span style={{ color: "#6b7280", minWidth: 80 }}>{label}:</span>
      <span style={{ color: "#9ca3af", fontFamily: "monospace", wordBreak: "break-all", textAlign: "right" }}>{value}</span>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2000, backdropFilter: "blur(10px)", padding: 16,
};
const modal: React.CSSProperties = {
  background: "#0f1628", border: "1px solid rgba(110,231,183,0.25)",
  borderRadius: 20, padding: "28px 28px", maxWidth: 520, width: "100%",
  maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 16,
  boxShadow: "0 0 80px rgba(110,231,183,0.1)",
};
const header: React.CSSProperties = {
  display: "flex", gap: 14, alignItems: "center",
};
const title: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 };
const sub: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: 0 };
const metaBox: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)", borderRadius: 10,
  padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
  border: "1px solid rgba(255,255,255,0.06)",
};
const scrollBox: React.CSSProperties = {
  overflowY: "auto", flex: 1, maxHeight: 280,
  background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "14px 16px",
  border: "1px solid rgba(255,255,255,0.06)", position: "relative",
};
const termContent: React.CSSProperties = { display: "flex", flexDirection: "column" };
const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#6ee7b7", margin: "0 0 6px 0" };
const secBody: React.CSSProperties = { fontSize: 12, color: "#9ca3af", margin: 0, lineHeight: 1.7 };
const scrollHint: React.CSSProperties = {
  position: "sticky", bottom: 0, textAlign: "center",
  background: "linear-gradient(to bottom, transparent, rgba(15,22,40,0.95))",
  color: "#6b7280", fontSize: 11, padding: "8px 0",
};
const checkRow: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
};
const btnRow: React.CSSProperties = {
  display: "flex", gap: 10,
};
const declineBtn: React.CSSProperties = {
  flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 10, padding: "12px", color: "#f87171", fontWeight: 600,
  fontSize: 13, cursor: "pointer",
};
const acceptBtn: React.CSSProperties = {
  flex: 2, background: "linear-gradient(135deg, #6ee7b7, #3b82f6)",
  border: "none", borderRadius: 10, padding: "12px", color: "#0a0a0f",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const footNote: React.CSSProperties = {
  fontSize: 10, color: "#374151", textAlign: "center", margin: 0, lineHeight: 1.6,
};