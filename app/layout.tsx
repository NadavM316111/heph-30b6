import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Confidential Messaging",
  description:
    "Secure, legally-protected messaging with international NDA activation. Verified identity layer with device fingerprinting for legal traceability.",
  keywords: ["confidential messaging", "NDA", "secure chat", "encrypted messaging"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body>{children}</body>
    </html>
  );
}