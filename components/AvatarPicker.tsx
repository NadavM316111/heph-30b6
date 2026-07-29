"use client";

const AVATARS = [
  "🦊","🐺","🦁","🐯","🐻","🦝","🦄","🐲","🦅","🦉",
  "🐙","🦈","🌙","⚡","🌊","🔮","💎","🛡️","🗝️","🌑",
];

interface Props {
  selected: string;
  onSelect: (avatar: string) => void;
}

export default function AvatarPicker({ selected, onSelect }: Props) {
  return (
    <div>
      <div style={label}>Choose Avatar</div>
      <div style={grid}>
        {AVATARS.map((a) => (
          <button
            key={a}
            style={{
              ...btn,
              background: selected === a ? "rgba(110,231,183,0.15)" : "rgba(255,255,255,0.04)",
              border: selected === a ? "2px solid #6ee7b7" : "2px solid transparent",
              transform: selected === a ? "scale(1.15)" : "scale(1)",
            }}
            onClick={() => onSelect(a)}
            type="button"
          >
            {a}
          </button>
        ))}
      </div>
      <div style={preview}>
        <span style={{ fontSize: 40 }}>{selected}</span>
      </div>
    </div>
  );
}

const label: React.CSSProperties = {
  fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 8, letterSpacing: 0.5,
};
const grid: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6,
};
const btn: React.CSSProperties = {
  fontSize: 20, borderRadius: 8, padding: "6px 8px",
  cursor: "pointer", transition: "all 0.15s", lineHeight: 1,
};
const preview: React.CSSProperties = {
  textAlign: "center", marginTop: 10,
};