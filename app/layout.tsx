import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Confidential Messaging",
  description: "Secure messaging with legally-binding NDA protection. Verified identity. End-to-end encrypted.",
  keywords: ["messaging", "confidential", "NDA", "encrypted", "secure"],
  authors: [{ name: "Confi" }],
  themeColor: "#00c896",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>",
  },
  openGraph: {
    title: "Confi — Confidential Messaging",
    description: "Secure messaging with legally-binding NDA protection.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}