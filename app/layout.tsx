import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Secure Confidential Messaging",
  description: "The world's first messaging app with built-in international NDA protection. Secure, encrypted, legally binding.",
  keywords: ["messaging", "NDA", "confidential", "secure", "encrypted", "legal"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}